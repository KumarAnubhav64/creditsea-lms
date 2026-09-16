import { Types } from 'mongoose';
import { Role } from '../models/User';
import { LoanStatus } from '../models/Loan';
import { ApiError } from '../utils/ApiError';
import { loanRepository } from '../repositories/loanRepository';
import { paymentRepository } from '../repositories/paymentRepository';
import { userRepository } from '../repositories/userRepository';
import { computePostPayment } from './loanMath';
import { serializeLoan, serializeLoans } from '../serializers/loanSerializer';

/** String → ObjectId at the service boundary, so repositories always receive typed ids. */
const oid = (id: string): Types.ObjectId => new Types.ObjectId(id);

/** Which statuses each executive role may list (ADR-004 / DESIGN.md §7.1). */
const ROLE_ALLOWED_STATUSES: Partial<Record<Role, LoanStatus[]>> = {
  sanction: ['APPLIED', 'REJECTED'],
  disbursement: ['SANCTIONED'],
  collection: ['DISBURSED', 'CLOSED'],
  admin: ['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED'],
};

async function hydrate(loans: Array<Record<string, any>>) {
  const loanIds = loans.map((l) => l._id);
  const borrowerIds = loans.map((l) => l.borrower);
  const [payments, borrowers] = await Promise.all([
    paymentRepository.findByLoanIds(loanIds),
    userRepository.findManyByIds(borrowerIds),
  ]);
  return serializeLoans(loans, payments, borrowers);
}

export const loanService = {
  /** Role-scoped queue listing for the operations dashboard. */
  async listByStatus(actor: { id: string; role: Role }, status: LoanStatus) {
    const allowed = ROLE_ALLOWED_STATUSES[actor.role];
    if (!allowed) {
      throw ApiError.forbidden('Your role cannot list loans');
    }
    if (!allowed.includes(status)) {
      throw ApiError.forbidden(`Your role cannot view loans with status ${status}`);
    }
    const loans = await loanRepository.findByStatus(status);
    return hydrate(loans);
  },

  /** Detail view; borrowers may only read their own loans (404 masks existence). */
  async getById(actor: { id: string; role: Role }, loanId: string) {
    const loan = await loanRepository.findByIdLean(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');

    if (actor.role === 'borrower' && String(loan.borrower) !== actor.id) {
      throw ApiError.notFound('Loan not found');
    }
    return (await hydrate([loan]))[0];
  },

  /** Sanction decision: APPLIED → SANCTIONED (approve) or → REJECTED (reason required). */
  async decide(
    actorId: string,
    loanId: string,
    input: { action: 'APPROVE' | 'REJECT'; reason?: string }
  ) {
    if (input.action === 'REJECT' && (!input.reason || input.reason.trim().length < 5)) {
      throw ApiError.badRequest('A rejection reason of at least 5 characters is required');
    }

    const loan = await loanRepository.findById(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');
    if (loan.status !== 'APPLIED') {
      throw ApiError.conflict(`Only APPLIED loans can be decided - this loan is ${loan.status}`);
    }

    const now = new Date();
    if (input.action === 'APPROVE') {
      loan.status = 'SANCTIONED';
      loan.sanctionedAt = now;
      loan.decidedBy = oid(actorId);
      loan.statusHistory.push({ status: 'SANCTIONED', by: oid(actorId), at: now, note: 'Approved by sanction executive' });
    } else {
      loan.status = 'REJECTED';
      loan.rejectedAt = now;
      loan.rejectReason = input.reason!.trim();
      loan.decidedBy = oid(actorId);
      loan.statusHistory.push({ status: 'REJECTED', by: oid(actorId), at: now, note: `Rejected: ${input.reason!.trim()}` });
    }

    await loanRepository.save(loan);
    return (await hydrate([loan.toObject()]))[0];
  },

  /** Disbursement: SANCTIONED → DISBURSED. */
  async disburse(actorId: string, loanId: string) {
    const loan = await loanRepository.findById(loanId);
    if (!loan) throw ApiError.notFound('Loan not found');
    if (loan.status !== 'SANCTIONED') {
      throw ApiError.conflict(`Only SANCTIONED loans can be disbursed - this loan is ${loan.status}`);
    }

    const now = new Date();
    loan.status = 'DISBURSED';
    loan.disbursedAt = now;
    loan.disbursedBy = oid(actorId);
    loan.statusHistory.push({ status: 'DISBURSED', by: oid(actorId), at: now, note: 'Funds released by disbursement executive' });

    await loanRepository.save(loan);
    return (await hydrate([loan.toObject()]))[0];
  },

  /**
   * Collection: record a payment inside a transaction; auto-close the loan when
   * the outstanding hits zero (ADR-009, ADR-010). UTR duplicates surface as 409
   * from the unique index (ADR-008).
   */
  async recordPayment(
    actorId: string,
    loanId: string,
    input: { utr: string; amount: number; paymentDate: Date }
  ) {
    const mongoose = await import('mongoose');
    const session = await mongoose.default.startSession();

    try {
      let loanJson: Record<string, any> | null = null;
      let paymentJson: Record<string, any> | null = null;

      await session.withTransaction(async () => {
        const loan = await loanRepository.findById(loanId, session);
        if (!loan) throw ApiError.notFound('Loan not found');
        if (loan.status !== 'DISBURSED') {
          throw ApiError.conflict(`Payments can only be recorded on DISBURSED loans - this loan is ${loan.status}`);
        }

        const outstandingNow = Math.round((loan.totalRepayment - loan.paidAmount) * 100) / 100;
        if (input.amount > outstandingNow) {
          throw ApiError.badRequest(`Payment exceeds outstanding balance. Outstanding: ₹${outstandingNow.toLocaleString('en-IN')}`);
        }

        const plan = computePostPayment(loan.totalRepayment, loan.paidAmount, input.amount);
        const now = new Date();

        const payment = await paymentRepository.create(
          {
            loan: loan._id,
            utr: input.utr.toUpperCase(),
            amount: input.amount,
            paymentDate: input.paymentDate,
            recordedBy: oid(actorId),
          },
          session
        );

        loan.paidAmount = plan.newPaidAmount;
        if (plan.shouldAutoClose) {
          loan.status = 'CLOSED';
          loan.closedAt = now;
          loan.statusHistory.push({ status: 'CLOSED', by: oid(actorId), at: now, note: `Final payment ${input.utr} - loan auto-closed` });
        } else {
          loan.statusHistory.push({ status: 'DISBURSED', by: oid(actorId), at: now, note: `Payment ${input.utr} of ₹${input.amount} recorded` });
        }
        await loanRepository.save(loan, session);

        loanJson = loan.toObject();
        paymentJson = payment.toObject();
      });

      const borrower = await userRepository.findById(String(loanJson!.borrower));
      return {
        payment: paymentJson,
        loan: serializeLoan(
          loanJson!,
          undefined,
          borrower
            ? {
                id: borrower.id,
                name: borrower.name,
                email: borrower.email,
                monthlySalary: borrower.monthlySalary,
                employmentMode: borrower.employmentMode,
                salarySlipUrl: borrower.salarySlipUrl,
              }
            : undefined
        ),
      };
    } finally {
      await session.endSession();
    }
  },
};

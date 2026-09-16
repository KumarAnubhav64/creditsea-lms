import { ApiError } from '../utils/ApiError';
import { userRepository, BorrowerProfileUpdate } from '../repositories/userRepository';
import { loanRepository } from '../repositories/loanRepository';
import { paymentRepository } from '../repositories/paymentRepository';
import { serializeLoan, serializeLoans } from '../serializers/loanSerializer';
import { breInputSchema, evaluate, BreInput } from './bre';
import {
  simpleInterest,
  totalRepayment,
  AMOUNT_MIN,
  AMOUNT_MAX,
  TENURE_MIN,
  TENURE_MAX,
} from './loanMath';
import { deriveStage } from './dashboardService';

export const borrowerService = {
  /**
   * Step 2 — personal details + server-side BRE evaluation (ADR-003).
   * Throws 422 with per-rule failures when any business rule fails.
   */
  async updateDetails(userId: string, input: unknown) {
    const body: BreInput = breInputSchema.parse(input);
    const result = evaluate(body);
    if (!result.passed) {
      throw ApiError.unprocessable('Business rules failed', result.failures);
    }

    const update: BorrowerProfileUpdate = {
      name: body.fullName,
      pan: body.pan.toUpperCase(),
      dob: body.dob,
      monthlySalary: body.monthlySalary,
      employmentMode: body.employmentMode,
      brePassed: true,
      breCheckedAt: new Date(),
    };

    const user = await userRepository.updateProfile(userId, update);
    if (!user) throw ApiError.notFound('User not found');
    return user.toJSON();
  },

  /** Step 3 — persist salary slip URL after the upload middleware wrote the file. */
  async attachSalarySlip(userId: string, filename: string) {
    const user = await userRepository.setSalarySlipUrl(userId, `/uploads/${filename}`);
    if (!user) throw ApiError.notFound('User not found');
    return user.toJSON();
  },

  /** Step 4 — validate guards, compute terms server-side, create the APPLIED loan. */
  async applyForLoan(userId: string, input: { amount?: number; tenureDays?: number }) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    // Use saved loanConfig if not provided in body
    const amount = input.amount ?? user.loanConfig?.amount;
    const tenureDays = input.tenureDays ?? user.loanConfig?.tenureDays;

    if (!amount || !tenureDays) {
      throw ApiError.badRequest('Loan amount and tenure are required (save via loan-config first or pass in body)');
    }

    if (amount < AMOUNT_MIN || amount > AMOUNT_MAX) {
      throw ApiError.badRequest(`Loan amount must be between ₹${AMOUNT_MIN.toLocaleString('en-IN')} and ₹${AMOUNT_MAX.toLocaleString('en-IN')}`);
    }
    if (!Number.isInteger(tenureDays) || tenureDays < TENURE_MIN || tenureDays > TENURE_MAX) {
      throw ApiError.badRequest(`Tenure must be between ${TENURE_MIN} and ${TENURE_MAX} days`);
    }

    if (!user.brePassed) {
      throw ApiError.conflict('Complete the eligibility check (personal details) before applying');
    }
    if (!user.salarySlipUrl) {
      throw ApiError.conflict('Upload your salary slip before applying');
    }

    const si = simpleInterest(amount, 12, tenureDays);
    const loan = await loanRepository.create({
      borrower: user._id,
      amount,
      tenureDays,
      interestRate: 12,
      simpleInterest: si,
      totalRepayment: totalRepayment(amount, si),
      paidAmount: 0,
      salarySlipUrl: user.salarySlipUrl,
      status: 'APPLIED',
      appliedAt: new Date(),
      statusHistory: [
        { status: 'APPLIED', by: user._id, at: new Date(), note: 'Loan application submitted' },
      ],
    });
    return serializeLoan(loan.toObject());
  },

  /** Borrower's own loans with payments and outstanding balances. */
  async myLoans(userId: string) {
    const loans = await loanRepository.findByBorrower(userId);
    const loanIds = loans.map((l) => l._id);
    const payments = await paymentRepository.findByLoanIds(loanIds);
    return serializeLoans(loans, payments);
  },

  /** Registration funnel stage — derived, never stored (ADR-011). */
  async getStage(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    const json = user.toJSON() as any;
    return { stage: deriveStage(json), hasLoanConfig: !!(json.loanConfig?.amount) };
  },

  /** Step 4a — save loan config (principal + tenure) before applying. */
  async updateLoanConfig(userId: string, input: { amount: number; tenureDays: number }) {
    if (input.amount < AMOUNT_MIN || input.amount > AMOUNT_MAX) {
      throw ApiError.badRequest(`Loan amount must be between ₹${AMOUNT_MIN.toLocaleString('en-IN')} and ₹${AMOUNT_MAX.toLocaleString('en-IN')}`);
    }
    if (!Number.isInteger(input.tenureDays) || input.tenureDays < TENURE_MIN || input.tenureDays > TENURE_MAX) {
      throw ApiError.badRequest(`Tenure must be between ${TENURE_MIN} and ${TENURE_MAX} days`);
    }
    const user = await userRepository.setLoanConfig(userId, {
      amount: input.amount,
      tenureDays: input.tenureDays,
    });
    if (!user) throw ApiError.notFound('User not found');
    return user.toJSON();
  },
};

import { loanRepository } from '../repositories/loanRepository';
import { userRepository } from '../repositories/userRepository';
import { serializeLoans } from '../serializers/loanSerializer';
import { paymentRepository } from '../repositories/paymentRepository';
import { LOAN_STATUSES, type LoanStatus } from '../models/Loan';

/**
 * ADR-011 — the funnel stage is DERIVED from the user document and their loans,
 * never stored. A stored stage can drift; this cannot.
 */
export type LeadStage = 'REGISTERED' | 'BRE_VERIFIED' | 'SLIP_UPLOADED' | 'READY_TO_APPLY';

export function deriveStage(user: {
  brePassed?: boolean;
  pan?: string;
  monthlySalary?: number;
  employmentMode?: string;
  salarySlipUrl?: string;
  loanConfig?: { amount: number; tenureDays: number };
}): LeadStage {
  if (user.brePassed && user.pan && user.monthlySalary && user.employmentMode) {
    if (user.salarySlipUrl) return 'READY_TO_APPLY';
    return 'SLIP_UPLOADED';
  }
  if (user.pan || user.monthlySalary || user.employmentMode) return 'BRE_VERIFIED';
  return 'REGISTERED';
}

export const dashboardService = {
  /** Sales module: borrowers without loans (leads) + those who converted. */
  async leads() {
    const [borrowers, loans] = await Promise.all([
      userRepository.findBorrowers(),
      loanRepository.findAllMinimal(),
    ]);

    const byBorrower = new Map<string, { count: number; latestStatus?: string; latestAt?: Date }>();
    for (const loan of loans) {
      const key = String(loan.borrower);
      const entry = byBorrower.get(key) ?? { count: 0 };
      entry.count += 1;
      const loanAt = loan.createdAt ?? new Date(0);
      if (!entry.latestAt || loanAt > entry.latestAt) {
        entry.latestAt = loanAt;
        entry.latestStatus = loan.status;
      }
      byBorrower.set(key, entry);
    }

    const stageOf = (b: Record<string, any>) => deriveStage(b);

    const leadList = borrowers
      .filter((b) => (byBorrower.get(String(b._id))?.count ?? 0) === 0)
      .map((b) => ({
        id: String(b._id),
        name: b.name,
        email: b.email,
        createdAt: (b.createdAt ?? new Date()).toISOString(),
        stage: stageOf(b),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const converted = borrowers
      .filter((b) => (byBorrower.get(String(b._id))?.count ?? 0) > 0)
      .map((b) => ({
        id: String(b._id),
        name: b.name,
        email: b.email,
        loanCount: byBorrower.get(String(b._id))!.count,
        latestStatus: byBorrower.get(String(b._id))!.latestStatus,
      }))
      .sort((a, b) => b.loanCount - a.loanCount);

    return { leads: leadList, converted };
  },

  /** Sanction module: loans awaiting approve/reject. */
  async pendingSanction() {
    const loans = await loanRepository.findByStatus('APPLIED');
    return { loans: serializeLoans(loans, []) };
  },

  /** Disbursement module: SANCTIONED loans awaiting fund transfer. */
  async pendingDisbursement() {
    const loans = await loanRepository.findByStatus('SANCTIONED');
    return { loans: serializeLoans(loans, []) };
  },

  /** Collection module: DISBURSED loans with outstanding balance. */
  async pendingCollection() {
    const loans = await loanRepository.findByStatus('DISBURSED');
    const loanIds = loans.map((l) => l._id);
    const payments = await paymentRepository.findByLoanIds(loanIds);
    return { loans: serializeLoans(loans, payments) };
  },

  /** Admin: all loans with optional status filter. */
  async allLoans(status?: string) {
    const isValid = status && (LOAN_STATUSES as readonly string[]).includes(status);
    const loans = isValid
      ? await loanRepository.findByStatus(status as LoanStatus)
      : await loanRepository.findAllMinimal();
    const loanIds = loans.map((l) => l._id);
    const payments = await paymentRepository.findByLoanIds(loanIds);
    return { loans: serializeLoans(loans, payments) };
  },
};

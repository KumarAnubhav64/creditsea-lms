import { ClientSession, Types } from 'mongoose';
import { Loan, LoanDoc, LoanStatus, StatusEvent } from '../models/Loan';

export type LeanLoan = Record<string, any>;

export interface LoanCreateInput {
  borrower: Types.ObjectId;
  amount: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
  paidAmount: number;
  salarySlipUrl?: string;
  status: LoanStatus;
  appliedAt: Date;
  statusHistory: StatusEvent[];
}

/**
 * Data-access layer for loans — the ONLY module that issues Loan queries.
 * `save` accepts a session so services can persist inside transactions.
 */
export const loanRepository = {
  create(data: LoanCreateInput): Promise<LoanDoc> {
    return Loan.create(data);
  },

  findById(id: string, session?: ClientSession): Promise<LoanDoc | null> {
    const q = Loan.findById(id);
    if (session) q.session(session);
    return q.exec();
  },

  findByIdLean(id: string): Promise<LeanLoan | null> {
    return Loan.findById(id).lean().exec();
  },

  findByStatus(status: LoanStatus): Promise<LeanLoan[]> {
    return Loan.find({ status }).sort({ updatedAt: -1 }).lean().exec();
  },

  findByBorrower(borrowerId: string): Promise<LeanLoan[]> {
    return Loan.find({ borrower: borrowerId }).sort({ createdAt: -1 }).lean().exec();
  },

  /** Minimal projection for the sales funnel aggregation. */
  findAllMinimal(): Promise<LeanLoan[]> {
    return Loan.find().select('borrower status createdAt').lean().exec();
  },

  save(loan: LoanDoc, session?: ClientSession): Promise<LoanDoc> {
    return loan.save(session ? { session } : undefined);
  },
};

import { ClientSession, Types } from 'mongoose';
import { Payment, PaymentDoc } from '../models/Payment';

export type LeanPayment = Record<string, any>;

export interface PaymentCreateInput {
  loan: Types.ObjectId;
  utr: string;
  amount: number;
  paymentDate: Date;
  recordedBy: Types.ObjectId;
}

/**
 * Data-access layer for payments — the ONLY module that issues Payment queries.
 * `create` participates in the caller's transaction when a session is given,
 * so the unique UTR index (ADR-008) is enforced transactionally.
 */
export const paymentRepository = {
  async create(data: PaymentCreateInput, session?: ClientSession): Promise<PaymentDoc> {
    if (session) {
      const [doc] = await Payment.create([data], { session });
      return doc;
    }
    return Payment.create(data);
  },

  findByLoanIds(loanIds: Types.ObjectId[]): Promise<LeanPayment[]> {
    if (loanIds.length === 0) return Promise.resolve([]);
    return Payment.find({ loan: { $in: loanIds } })
      .sort({ paymentDate: 1, createdAt: 1 })
      .lean()
      .exec();
  },
};

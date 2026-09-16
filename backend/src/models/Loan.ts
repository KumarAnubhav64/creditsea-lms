import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export const LOAN_STATUSES = ['APPLIED', 'SANCTIONED', 'REJECTED', 'DISBURSED', 'CLOSED'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export interface StatusEvent {
  status: LoanStatus;
  by?: Types.ObjectId;
  at: Date;
  note?: string;
}

export interface LoanDoc extends Document {
  borrower: Types.ObjectId;
  amount: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
  paidAmount: number;
  status: LoanStatus;
  rejectReason?: string;
  decidedBy?: Types.ObjectId;
  disbursedBy?: Types.ObjectId;
  salarySlipUrl?: string;
  appliedAt: Date;
  sanctionedAt?: Date;
  rejectedAt?: Date;
  disbursedAt?: Date;
  closedAt?: Date;
  statusHistory: StatusEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const LoanSchema = new Schema<LoanDoc>(
  {
    borrower: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 50000, max: 500000 },
    tenureDays: { type: Number, required: true, min: 30, max: 365 },
    interestRate: { type: Number, required: true, default: 12 },
    simpleInterest: { type: Number, required: true },
    totalRepayment: { type: Number, required: true },
    paidAmount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: LOAN_STATUSES, required: true, default: 'APPLIED', index: true },
    rejectReason: { type: String },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    disbursedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    salarySlipUrl: { type: String },
    appliedAt: { type: Date, required: true, default: () => new Date() },
    sanctionedAt: { type: Date },
    rejectedAt: { type: Date },
    disbursedAt: { type: Date },
    closedAt: { type: Date },
    statusHistory: {
      type: [
        {
          _id: false,
          status: { type: String, enum: LOAN_STATUSES, required: true },
          by: { type: Schema.Types.ObjectId, ref: 'User' },
          at: { type: Date, required: true },
          note: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const Loan: Model<LoanDoc> = mongoose.model<LoanDoc>('Loan', LoanSchema);

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface PaymentDoc extends Document {
  loan: Types.ObjectId;
  utr: string;
  amount: number;
  paymentDate: Date;
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<PaymentDoc>(
  {
    loan: { type: Schema.Types.ObjectId, ref: 'Loan', required: true, index: true },
    // ADR-008: uniqueness enforced by the database, not application checks.
    utr: { type: String, required: true, uppercase: true, trim: true, unique: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Payment: Model<PaymentDoc> = mongoose.model<PaymentDoc>('Payment', PaymentSchema);

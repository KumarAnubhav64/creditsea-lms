import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'sales', 'sanction', 'disbursement', 'collection', 'borrower'] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYMENT_MODES = ['SALARIED', 'SELF_EMPLOYED', 'UNEMPLOYED'] as const;
export type EmploymentMode = (typeof EMPLOYMENT_MODES)[number];

export interface UserDoc extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  pan?: string;
  dob?: Date;
  monthlySalary?: number;
  employmentMode?: EmploymentMode;
  brePassed: boolean;
  breCheckedAt?: Date;
  salarySlipUrl?: string;
  loanConfig?: { amount: number; tenureDays: number };
  createdAt: Date;
  updatedAt: Date;
  comparePassword(plain: string): Promise<boolean>;
}

const UserSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, default: 'borrower' },
    pan: { type: String, uppercase: true, trim: true },
    dob: { type: Date },
    monthlySalary: { type: Number, min: 0 },
    employmentMode: { type: String, enum: EMPLOYMENT_MODES },
    brePassed: { type: Boolean, default: false },
    breCheckedAt: { type: Date },
    salarySlipUrl: { type: String },
    loanConfig: {
      amount: { type: Number },
      tenureDays: { type: Number },
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 10);
  }
  next();
});

UserSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Partial<Record<'_id' | '__v' | 'passwordHash' | 'id', unknown>>;
    r.id = (ret as { _id: { toString(): string } })._id.toString();
    delete r._id;
    delete r.__v;
    delete r.passwordHash;
    return ret;
  },
});

export const User: Model<UserDoc> = mongoose.model<UserDoc>('User', UserSchema);

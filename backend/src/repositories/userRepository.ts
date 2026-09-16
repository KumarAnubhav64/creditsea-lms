import { ClientSession } from 'mongoose';
import { User, UserDoc, Role, EmploymentMode } from '../models/User';

export type LeanUser = Record<string, any>;

export interface BorrowerProfileUpdate {
  name: string;
  pan: string;
  dob: Date;
  monthlySalary: number;
  employmentMode: EmploymentMode;
  brePassed: boolean;
  breCheckedAt: Date;
}

export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}

/**
 * Data-access layer for users — the ONLY module that issues User queries.
 * Services depend on this interface, never on the model directly.
 */
export const userRepository = {
  create(data: CreateUserInput): Promise<UserDoc> {
    return User.create(data);
  },

  findById(id: string, session?: ClientSession): Promise<UserDoc | null> {
    const q = User.findById(id);
    if (session) q.session(session);
    return q.exec();
  },

  findByEmail(email: string): Promise<UserDoc | null> {
    return User.findOne({ email }).exec();
  },

  updateProfile(id: string, update: BorrowerProfileUpdate): Promise<UserDoc | null> {
    return User.findByIdAndUpdate(id, update, { new: true }).exec();
  },

  setSalarySlipUrl(id: string, url: string): Promise<UserDoc | null> {
    return User.findByIdAndUpdate(id, { salarySlipUrl: url }, { new: true }).exec();
  },

  setLoanConfig(id: string, config: { amount: number; tenureDays: number }): Promise<UserDoc | null> {
    return User.findByIdAndUpdate(id, { loanConfig: config }, { new: true }).exec();
  },

  findBorrowers(): Promise<LeanUser[]> {
    return User.find({ role: 'borrower' }).lean().exec();
  },

  findManyByIds(ids: string[]): Promise<LeanUser[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return User.find({ _id: { $in: ids } }).lean().exec();
  },
};

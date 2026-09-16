export type Role = 'admin' | 'sales' | 'sanction' | 'disbursement' | 'collection' | 'borrower';
export type EmploymentMode = 'SALARIED' | 'SELF_EMPLOYED' | 'UNEMPLOYED';
export type LoanStatus = 'APPLIED' | 'SANCTIONED' | 'REJECTED' | 'DISBURSED' | 'CLOSED';
export type LeadStage = 'REGISTERED' | 'BRE_VERIFIED' | 'SLIP_UPLOADED' | 'READY_TO_APPLY';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  pan?: string;
  dob?: string;
  monthlySalary?: number;
  employmentMode?: EmploymentMode;
  brePassed?: boolean;
  breCheckedAt?: string;
  salarySlipUrl?: string;
  createdAt?: string;
}

export interface StatusEvent {
  status: LoanStatus;
  by?: string;
  at: string;
  note?: string;
}

export interface Payment {
  id: string;
  loan: string;
  utr: string;
  amount: number;
  paymentDate: string;
  recordedBy: string;
}

export interface BorrowerSummary {
  id: string;
  name: string;
  email: string;
  monthlySalary?: number;
  employmentMode?: string;
  salarySlipUrl?: string;
}

export interface Loan {
  id: string;
  borrower: string | BorrowerSummary;
  amount: number;
  tenureDays: number;
  interestRate: number;
  simpleInterest: number;
  totalRepayment: number;
  paidAmount: number;
  outstanding: number;
  status: LoanStatus;
  rejectReason?: string;
  appliedAt: string;
  sanctionedAt?: string;
  rejectedAt?: string;
  disbursedAt?: string;
  closedAt?: string;
  statusHistory: StatusEvent[];
  payments?: Payment[];
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  stage: LeadStage;
}

export interface ConvertedBorrower {
  id: string;
  name: string;
  email: string;
  loanCount: number;
  latestStatus?: LoanStatus;
}

export interface BreFailure {
  rule: 'AGE' | 'SALARY' | 'PAN' | 'EMPLOYMENT';
  message: string;
}

export const DASHBOARD_ROLES: Role[] = ['admin', 'sales', 'sanction', 'disbursement', 'collection'];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  sales: 'Sales',
  sanction: 'Sanction',
  disbursement: 'Disbursement',
  collection: 'Collection',
  borrower: 'Borrower',
};

export function isBorrowerSummary(b: Loan['borrower']): b is BorrowerSummary {
  return typeof b === 'object';
}

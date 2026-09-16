import { Types } from 'mongoose';
import { LoanStatus } from '../models/Loan';
import { outstanding } from '../services/loanMath';

export interface SerializedPayment {
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

export interface SerializedLoan {
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
  statusHistory: Array<{ status: LoanStatus; by?: string; at: string; note?: string }>;
  payments?: SerializedPayment[];
}

/**
 * Pure presentation layer — takes already-fetched documents and maps them to
 * API response shapes. No database access, fully unit-testable.
 */
function toId(v: unknown): string {
  if (v instanceof Types.ObjectId) return v.toString();
  if (typeof v === 'object' && v !== null && '_id' in (v as Record<string, unknown>)) {
    return (v as { _id: Types.ObjectId })._id.toString();
  }
  return String(v);
}

export function toBorrowerSummary(u: Record<string, any>): BorrowerSummary {
  return {
    id: toId(u._id ?? u.id),
    name: u.name,
    email: u.email,
    monthlySalary: u.monthlySalary,
    employmentMode: u.employmentMode,
    salarySlipUrl: u.salarySlipUrl,
  };
}

export function serializePayment(p: Record<string, any>): SerializedPayment {
  return {
    id: toId(p._id ?? p.id),
    loan: toId(p.loan),
    utr: p.utr,
    amount: p.amount,
    paymentDate: p.paymentDate instanceof Date ? p.paymentDate.toISOString() : String(p.paymentDate),
    recordedBy: toId(p.recordedBy),
  };
}

export function serializeLoan(
  loan: Record<string, any>,
  payments: SerializedPayment[] = [],
  borrower?: BorrowerSummary
): SerializedLoan {
  const total = loan.totalRepayment as number;
  const paid = (loan.paidAmount ?? 0) as number;
  const iso = (d: any): string | undefined =>
    d instanceof Date ? d.toISOString() : d ? String(d) : undefined;

  return {
    id: toId(loan._id ?? loan.id),
    borrower: borrower ?? toId(loan.borrower),
    amount: loan.amount,
    tenureDays: loan.tenureDays,
    interestRate: loan.interestRate,
    simpleInterest: loan.simpleInterest,
    totalRepayment: total,
    paidAmount: paid,
    outstanding: outstanding(total, paid),
    status: loan.status,
    rejectReason: loan.rejectReason,
    appliedAt: iso(loan.appliedAt ?? loan.createdAt) ?? new Date(0).toISOString(),
    sanctionedAt: iso(loan.sanctionedAt),
    rejectedAt: iso(loan.rejectedAt),
    disbursedAt: iso(loan.disbursedAt),
    closedAt: iso(loan.closedAt),
    statusHistory: (loan.statusHistory ?? []).map((e: Record<string, any>) => ({
      status: e.status,
      by: e.by ? toId(e.by) : undefined,
      at: iso(e.at) ?? new Date(0).toISOString(),
      note: e.note,
    })),
    payments,
  };
}

export function serializeLoans(
  loans: Array<Record<string, any>>,
  payments: Array<Record<string, any>> = [],
  borrowers: Array<Record<string, any>> = []
): SerializedLoan[] {
  const paymentsByLoan = new Map<string, SerializedPayment[]>();
  for (const p of payments) {
    const key = toId(p.loan);
    const list = paymentsByLoan.get(key) ?? [];
    list.push(serializePayment(p));
    paymentsByLoan.set(key, list);
  }

  const borrowersById = new Map<string, BorrowerSummary>();
  for (const b of borrowers) {
    const summary = toBorrowerSummary(b);
    borrowersById.set(summary.id, summary);
  }

  return loans.map((l) => {
    const id = toId(l._id ?? l.id);
    const borrowerSummary = borrowersById.get(toId(l.borrower));
    return serializeLoan(l, paymentsByLoan.get(id) ?? [], borrowerSummary);
  });
}

/** Indian-number-system + currency formatting shared by every module. */

export function inr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Client mirror of the server's loan math (ADR-003: server is authoritative,
// this copy exists only for instant slider feedback) ─────────────────────────
export const INTEREST_RATE = 12;
export const AMOUNT_MIN = 50000;
export const AMOUNT_MAX = 500000;
export const TENURE_MIN = 30;
export const TENURE_MAX = 365;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function simpleInterest(principal: number, tenureDays: number): number {
  return round2((principal * INTEREST_RATE * tenureDays) / (365 * 100));
}

export function totalRepayment(principal: number, tenureDays: number): number {
  return round2(principal + simpleInterest(principal, tenureDays));
}

// ── Client mirror of the BRE rules (same deal: UX hints only) ───────────────
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function ageInYears(dob: string): number {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export function breCheck(input: { pan: string; dob: string; monthlySalary: number; employmentMode: string }): string[] {
  const errors: string[] = [];
  const age = ageInYears(input.dob);
  if (age < 23 || age > 50) errors.push(`Age must be between 23 and 50 (you are ${age})`);
  if (input.monthlySalary < 25000) errors.push('Monthly salary must be at least ₹25,000');
  if (!PAN_REGEX.test(input.pan.toUpperCase())) errors.push('PAN must match the format ABCDE1234F');
  if (input.employmentMode === 'UNEMPLOYED') errors.push('Unemployed applicants are not eligible');
  return errors;
}

/**
 * Loan mathematics — simple interest, fixed 12% p.a., tenure in days (DESIGN.md §9).
 * Every monetary value is rounded to 2 decimal places so the client's live
 * calculation panel always matches the stored loan to the paisa.
 */
export const INTEREST_RATE = 12; // % per annum, fixed by business
export const AMOUNT_MIN = 50000;
export const AMOUNT_MAX = 500000;
export const TENURE_MIN = 30;
export const TENURE_MAX = 365;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** SI = (P × R × T) / (365 × 100), T in days */
export function simpleInterest(principal: number, ratePctPerYear: number, tenureDays: number): number {
  return round2((principal * ratePctPerYear * tenureDays) / (365 * 100));
}

export function totalRepayment(principal: number, si: number): number {
  return round2(principal + si);
}

export function outstanding(total: number, paid: number): number {
  return round2(total - paid);
}

export interface PostPaymentPlan {
  newPaidAmount: number;
  newOutstanding: number;
  shouldAutoClose: boolean;
}

/**
 * Pure decision function for ADR-010: given a loan's totals and a candidate
 * payment, compute the post-payment state. Extracted from the controller so
 * the auto-close logic is unit-testable without a database.
 */
export function computePostPayment(total: number, paid: number, paymentAmount: number): PostPaymentPlan {
  const newPaidAmount = round2(paid + paymentAmount);
  const newOutstanding = round2(total - newPaidAmount);
  // Round both sides before compare — float representation of rounded values
  // can still differ at the binary level (classic 0.1 + 0.2 problem).
  const shouldAutoClose = Math.round(newOutstanding * 100) === 0;
  return { newPaidAmount, newOutstanding, shouldAutoClose };
}

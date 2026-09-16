import { describe, it, expect } from 'vitest';
import {
  simpleInterest,
  totalRepayment,
  outstanding,
  round2,
  computePostPayment,
  INTEREST_RATE,
} from '../services/loanMath';

describe('loanMath — simple interest', () => {
  it('matches the assignment formula SI = (P × R × T) / (365 × 100)', () => {
    // P=200000, R=12, T=180 → (200000*12*180)/(365*100) = 432000000/36500 = 11835.616… → 11835.62
    expect(simpleInterest(200000, 12, 180)).toBe(11835.62);
  });

  it('handles the minimum configuration (₹50K / 30 days)', () => {
    // (50000*12*30)/36500 = 18000000/36500 = 493.150… → 493.15
    expect(simpleInterest(50000, 12, 30)).toBe(493.15);
  });

  it('handles the maximum configuration (₹5L / 365 days)', () => {
    // (500000*12*365)/36500 = 60000
    expect(simpleInterest(500000, 12, 365)).toBe(60000);
  });

  it('is linear in principal', () => {
    const half = simpleInterest(100000, INTEREST_RATE, 120);
    const full = simpleInterest(200000, INTEREST_RATE, 120);
    expect(round2(full / 2)).toBe(half);
  });
});

describe('loanMath — total repayment & outstanding', () => {
  it('total = principal + SI', () => {
    const si = simpleInterest(200000, 12, 180);
    expect(totalRepayment(200000, si)).toBe(211835.62);
  });

  it('outstanding decreases as payments accumulate', () => {
    const total = 211835.62;
    expect(outstanding(total, 0)).toBe(211835.62);
    expect(outstanding(total, 50000)).toBe(161835.62);
    expect(outstanding(total, 211835.62)).toBe(0);
  });

  it('rounds to 2 decimals', () => {
    expect(round2(11835.616438)).toBe(11835.62);
    expect(round2(0.005)).toBe(0.01);
    expect(round2(100)).toBe(100);
  });
});

describe('loanMath — auto-close decision (ADR-010)', () => {
  const total = 211835.62;

  it('does not close on partial payment', () => {
    const plan = computePostPayment(total, 0, 50000);
    expect(plan).toEqual({ newPaidAmount: 50000, newOutstanding: 161835.62, shouldAutoClose: false });
  });

  it('closes when the final payment zeroes the outstanding exactly', () => {
    const plan = computePostPayment(total, 50000, 161835.62);
    expect(plan.newPaidAmount).toBe(total);
    expect(plan.newOutstanding).toBe(0);
    expect(plan.shouldAutoClose).toBe(true);
  });

  it('closes on a single full repayment', () => {
    const plan = computePostPayment(total, 0, total);
    expect(plan.shouldAutoClose).toBe(true);
  });

  it('flag is false while even 1 paisa remains', () => {
    const plan = computePostPayment(total, 0, total - 0.01);
    expect(plan.newOutstanding).toBe(0.01);
    expect(plan.shouldAutoClose).toBe(false);
  });

  it('auto-closes after multiple partial payments that sum to total (float safety)', () => {
    // Simulate two payments: 100000 + 111835.62 = 211835.62
    const plan1 = computePostPayment(total, 0, 100000);
    expect(plan1.shouldAutoClose).toBe(false);
    const plan2 = computePostPayment(total, plan1.newPaidAmount, 111835.62);
    expect(plan2.shouldAutoClose).toBe(true);
    expect(plan2.newOutstanding).toBe(0);
  });

  it('auto-closes with three payments that sum to total', () => {
    const p1 = computePostPayment(total, 0, 50000);
    const p2 = computePostPayment(total, p1.newPaidAmount, 100000);
    const p3 = computePostPayment(total, p2.newPaidAmount, total - p2.newPaidAmount);
    expect(p3.shouldAutoClose).toBe(true);
    expect(p3.newOutstanding).toBe(0);
  });
});

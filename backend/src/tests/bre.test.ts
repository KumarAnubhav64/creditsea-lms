import { describe, it, expect } from 'vitest';
import { evaluate, ageInYears, BRE_RULES } from '../services/bre';

const valid = {
  fullName: 'Ravi Kumar',
  pan: 'ABCDE1234F',
  dob: new Date('1996-04-12'),
  monthlySalary: 42000,
  employmentMode: 'SALARIED' as const,
};

describe('BRE — ageInYears', () => {
  it('computes age correctly', () => {
    const now = new Date('2026-01-01');
    expect(ageInYears(new Date('1996-04-12'), now)).toBe(29);
    expect(ageInYears(new Date('1998-06-15'), now)).toBe(27);
    expect(ageInYears(new Date('2002-06-15'), now)).toBe(23);
  });
});

describe('BRE — happy path', () => {
  it('passes when all four rules are satisfied (salaried)', () => {
    const result = evaluate(valid);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('passes for self-employed applicants', () => {
    const result = evaluate({ ...valid, employmentMode: 'SELF_EMPLOYED' });
    expect(result.passed).toBe(true);
  });
});

describe('BRE — age rule (23–50)', () => {
  it('rejects a 22-year-old', () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 22);
    const result = evaluate({ ...valid, dob });
    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.rule)).toContain('AGE');
  });

  it('rejects a 51-year-old', () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 51);
    const result = evaluate({ ...valid, dob });
    expect(result.failures.map((f) => f.rule)).toContain('AGE');
  });

  it('accepts exactly 23 and exactly 50', () => {
    const young = new Date();
    young.setFullYear(young.getFullYear() - 23);
    const old = new Date();
    old.setFullYear(old.getFullYear() - 50);
    expect(evaluate({ ...valid, dob: young }).passed).toBe(true);
    expect(evaluate({ ...valid, dob: old }).passed).toBe(true);
  });
});

describe('BRE — salary rule (≥ ₹25,000)', () => {
  it('rejects ₹24,999', () => {
    const result = evaluate({ ...valid, monthlySalary: 24999 });
    expect(result.failures.map((f) => f.rule)).toContain('SALARY');
  });

  it('accepts exactly ₹25,000', () => {
    expect(evaluate({ ...valid, monthlySalary: 25000 }).passed).toBe(true);
  });
});

describe('BRE — PAN rule', () => {
  it.each(['ABCDE123', 'AB1DE2345F', 'ABCDEFGHI', '1234567890', '', 'AB!DE1234F'])(
    'rejects invalid PAN %s',
    (pan) => {
      const result = evaluate({ ...valid, pan });
      expect(result.failures.map((f) => f.rule)).toContain('PAN');
    }
  );

  it('accepts a well-formed PAN and normalizes case', () => {
    expect(BRE_RULES.PAN_REGEX.test('ABCDE1234F')).toBe(true);
    expect(evaluate({ ...valid, pan: 'abcde1234f' }).passed).toBe(true); // normalized, not rejected
  });
});

describe('BRE — employment rule', () => {
  it('rejects unemployed applicants', () => {
    const result = evaluate({ ...valid, employmentMode: 'UNEMPLOYED' });
    expect(result.failures.map((f) => f.rule)).toContain('EMPLOYMENT');
  });
});

describe('BRE — multiple failures reported together', () => {
  it('returns every failing rule, not just the first', () => {
    const result = evaluate({
      ...valid,
      dob: new Date('2005-01-01'), // too young
      monthlySalary: 10000, // too low
      pan: 'NOPE', // invalid
      employmentMode: 'UNEMPLOYED', // ineligible
    });
    expect(result.passed).toBe(false);
    expect(result.failures.map((f) => f.rule)).toEqual(['AGE', 'SALARY', 'PAN', 'EMPLOYMENT']);
    expect(result.failures.every((f) => f.message.length > 0)).toBe(true);
  });
});

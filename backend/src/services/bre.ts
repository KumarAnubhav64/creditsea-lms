/**
 * Business Rule Engine — single source of truth lives on the SERVER (ADR-003).
 * The borrower form duplicates these rules client-side for instant feedback only;
 * the server's verdict is the only one that unlocks loan progression.
 */
import { z } from 'zod';

export const BRE_RULES = {
  AGE_MIN: 23,
  AGE_MAX: 50,
  MIN_MONTHLY_SALARY: 25000,
  PAN_REGEX: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
} as const;

export const BRE_FAILURES = {
  AGE: `Applicant age must be between ${BRE_RULES.AGE_MIN} and ${BRE_RULES.AGE_MAX} years`,
  SALARY: `Monthly salary must be at least ₹${BRE_RULES.MIN_MONTHLY_SALARY.toLocaleString('en-IN')}`,
  PAN: 'PAN must be a valid format like ABCDE1234F',
  EMPLOYMENT: 'Unemployed applicants are not eligible for a loan',
} as const;

export type BreRule = keyof typeof BRE_FAILURES;

export interface BreFailure {
  rule: BreRule;
  message: string;
}

export interface BreResult {
  passed: boolean;
  failures: BreFailure[];
}

// Schema validates SHAPE only — rule semantics (PAN format, salary floor, age
// window, employment) live exclusively in evaluate() per ADR-003, so an invalid
// PAN surfaces as a 422 BRE failure rather than a 400 schema error.
export const breInputSchema = z.object({
  fullName: z.string().trim().min(3).max(80),
  pan: z.string().trim().toUpperCase(),
  dob: z.coerce.date(),
  monthlySalary: z.coerce.number().positive().max(10_000_000),
  employmentMode: z.enum(['SALARIED', 'SELF_EMPLOYED', 'UNEMPLOYED']),
});

export type BreInput = z.infer<typeof breInputSchema>;

export function ageInYears(dob: Date, at: Date = new Date()): number {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  return Math.floor((at.getTime() - dob.getTime()) / msPerYear);
}

export function evaluate(input: BreInput, now: Date = new Date()): BreResult {
  const failures: BreFailure[] = [];

  const age = ageInYears(input.dob, now);
  if (age < BRE_RULES.AGE_MIN || age > BRE_RULES.AGE_MAX) {
    failures.push({ rule: 'AGE', message: BRE_FAILURES.AGE });
  }
  if (input.monthlySalary < BRE_RULES.MIN_MONTHLY_SALARY) {
    failures.push({ rule: 'SALARY', message: BRE_FAILURES.SALARY });
  }
  if (!BRE_RULES.PAN_REGEX.test(input.pan.toUpperCase())) {
    failures.push({ rule: 'PAN', message: BRE_FAILURES.PAN });
  }
  if (input.employmentMode === 'UNEMPLOYED') {
    failures.push({ rule: 'EMPLOYMENT', message: BRE_FAILURES.EMPLOYMENT });
  }

  return { passed: failures.length === 0, failures };
}

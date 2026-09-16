import { describe, it, expect } from 'vitest';
import { deriveStage } from '../services/dashboardService';

const base = { pan: undefined, monthlySalary: undefined, employmentMode: undefined, brePassed: false, salarySlipUrl: undefined };

describe('sales funnel — deriveStage (ADR-011)', () => {
  it('REGISTERED for a bare signup', () => {
    expect(deriveStage(base)).toBe('REGISTERED');
  });

  it('BRE_VERIFIED once profile fields exist (even without passing BRE)', () => {
    expect(deriveStage({ ...base, pan: 'ABCDE1234F' })).toBe('BRE_VERIFIED');
    expect(deriveStage({ ...base, monthlySalary: 50000 })).toBe('BRE_VERIFIED');
  });

  it('SLIP_UPLOADED when BRE passed but slip not yet attached', () => {
    expect(
      deriveStage({ ...base, brePassed: true, pan: 'ABCDE1234F', monthlySalary: 50000, employmentMode: 'SALARIED' })
    ).toBe('SLIP_UPLOADED');
  });

  it('READY_TO_APPLY when BRE passed and slip attached', () => {
    expect(
      deriveStage({
        ...base,
        brePassed: true,
        pan: 'ABCDE1234F',
        monthlySalary: 50000,
        employmentMode: 'SALARIED',
        salarySlipUrl: '/uploads/x.pdf',
      })
    ).toBe('READY_TO_APPLY');
  });
});

'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { api, ApiClientError } from '@/lib/api';
import { inr, AMOUNT_MIN, AMOUNT_MAX, TENURE_MIN, TENURE_MAX, simpleInterest, round2 } from '@/lib/format';

export default function LoanConfigPage() {
  const router = useRouter();
  const [amount, setAmount] = useState(200000);
  const [tenureDays, setTenureDays] = useState(180);
  const [submitting, setSubmitting] = useState(false);

  const calc = useMemo(() => {
    const si = simpleInterest(amount, tenureDays);
    const total = round2(amount + si);
    return { si, total, daily: round2(total / tenureDays) };
  }, [amount, tenureDays]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/api/borrower/loan-config', { method: 'PATCH', body: { amount, tenureDays } });
      toast.success('Config saved');
      router.push('/borrower/loans');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="card p-4 lg:col-span-2">
        <h2 className="mb-3 text-[15px] font-bold text-[var(--navy)]">Loan Configuration</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="label mb-0">Principal</label>
              <span className="mono text-lg font-bold text-[var(--blue)]">{inr(amount)}</span>
            </div>
            <input type="range" min={AMOUNT_MIN} max={AMOUNT_MAX} step={10000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--text-dim)] mono"><span>{inr(AMOUNT_MIN)}</span><span>{inr(AMOUNT_MAX)}</span></div>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label className="label mb-0">Tenure</label>
              <span className="mono text-lg font-bold text-[var(--blue)]">{tenureDays} days</span>
            </div>
            <input type="range" min={TENURE_MIN} max={TENURE_MAX} step={1} value={tenureDays} onChange={(e) => setTenureDays(Number(e.target.value))} />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--text-dim)] mono"><span>{TENURE_MIN}d</span><span>{TENURE_MAX}d</span></div>
          </div>
          <div className="rounded-lg bg-[var(--surface-2)] p-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-[var(--text-dim)]">Interest (12% p.a.)</span><span className="mono font-semibold">{inr(calc.si)}</span></div>
            <div className="border-t border-[var(--border)] pt-1.5 flex justify-between"><span className="font-medium">Total</span><span className="mono text-base font-bold text-[var(--blue)]">{inr(calc.total)}</span></div>
            <div className="flex justify-between text-[11px] text-[var(--text-dim)]"><span>Daily</span><span className="mono">{inr(calc.daily)}/day</span></div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? 'Saving…' : 'Save & view loans'}</button>
        </form>
      </div>

      <div className="card p-4 self-start">
        <h3 className="mb-2 text-[13px] font-bold text-[var(--navy)]">Loan Terms</h3>
        <ul className="space-y-1.5 text-[12px] text-[var(--text-dim)]">
          <li>• Interest rate: <span className="mono font-medium text-[var(--navy)]">12% p.a.</span> (fixed)</li>
          <li>• Simple interest: <span className="mono font-medium text-[var(--navy)]">SI = (P × 12 × T) / (365 × 100)</span></li>
          <li>• Amount: <span className="mono font-medium text-[var(--navy)]">{inr(AMOUNT_MIN)} – {inr(AMOUNT_MAX)}</span></li>
          <li>• Tenure: <span className="mono font-medium text-[var(--navy)]">{TENURE_MIN} – {TENURE_MAX} days</span></li>
        </ul>
        <div className="mt-3 rounded-md bg-[var(--surface-2)] p-2 text-[11px] text-[var(--text-dim)]">
          Terms are frozen at application time. Changing this config before applying will update the terms.
        </div>
      </div>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api, ApiClientError } from '@/lib/api';
import type { User } from '@/lib/types';
import { breCheck } from '@/lib/format';

export default function PersonalDetailsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [pan, setPan] = useState('');
  const [salary, setSalary] = useState('');
  const [employment, setEmployment] = useState('SALARIED');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ user: User }>('/api/auth/me');
        setUser(res.user);
        setName(res.user.name || '');
        setEmail(res.user.email || '');
      } catch { /* redirect via layout */ }
    })();
  }, []);

  useEffect(() => {
    if (!dob || !pan || !salary) { setErrors([]); return; }
    setErrors(breCheck({ pan, dob, monthlySalary: Number(salary), employmentMode: employment }));
  }, [dob, pan, salary, employment]);

  if (!user) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api('/api/borrower/details', {
        method: 'PUT',
        body: { fullName: name, dob, pan: pan.toUpperCase(), monthlySalary: Number(salary), employmentMode: employment },
      });
      toast.success('Details saved');
      router.push('/borrower/salary-slip');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  const formReady = dob && pan && salary && errors.length === 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Form — 2 cols */}
      <div className="card p-4 lg:col-span-2">
        <h2 className="mb-3 text-[15px] font-bold text-[var(--navy)]">Personal Details</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} disabled />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Date of Birth</label>
              <input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
            </div>
            <div>
              <label className="label">PAN</label>
              <input className="input uppercase" placeholder="ABCDE1234F" maxLength={10} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} required />
            </div>
            <div>
              <label className="label">Employment</label>
              <select className="input" value={employment} onChange={(e) => setEmployment(e.target.value)}>
                <option value="SALARIED">Salaried</option>
                <option value="SELF_EMPLOYED">Self Employed</option>
                <option value="UNEMPLOYED">Unemployed</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Monthly Salary (₹)</label>
            <input className="input" type="number" min={25000} step={1000} placeholder="e.g. 50000" value={salary} onChange={(e) => setSalary(e.target.value)} required />
          </div>

          {errors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 space-y-0.5">
              {errors.map((e, i) => <div key={i} className="text-[12px] text-red-600">• {e}</div>)}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting || !formReady}>
            {submitting ? 'Saving…' : errors.length > 0 ? 'Fix errors above' : 'Save & continue'}
          </button>
        </form>
      </div>

      {/* BRE rules sidebar */}
      <div className="card p-4 self-start">
        <h3 className="mb-2 text-[13px] font-bold text-[var(--navy)]">Eligibility Rules</h3>
        <ul className="space-y-1.5 text-[12px]">
          <li className="flex items-start gap-2"><span className="mt-0.5 text-[var(--green)]">✓</span> Age between 23 and 50 years</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-[var(--green)]">✓</span> Monthly salary ≥ ₹25,000</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-[var(--green)]">✓</span> Valid PAN format (5 letters + 4 digits + 1 letter)</li>
          <li className="flex items-start gap-2"><span className="mt-0.5 text-[var(--green)]">✓</span> Not unemployed</li>
        </ul>
        <div className="mt-3 rounded-md bg-[var(--surface-2)] p-2 text-[11px] text-[var(--text-dim)]">
          These rules are checked server-side (ADR-003). All must pass to proceed.
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiClientError } from '@/lib/api';
import toast from 'react-hot-toast';
import type { Loan } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { inr, formatDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function MyLoansPage() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<Loan | null>(null);
  const [utr, setUtr] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paying, setPaying] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await api<{ loans: Loan[] }>('/api/borrower/loans');
      setLoans(res.loans);
    } catch (err) { setError(err instanceof Error ? err.message : 'Load failed'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchLoans(); }, [fetchLoans]);

  async function handleApply() {
    setApplying(true);
    try {
      await api('/api/loans/apply', { method: 'POST' });
      toast.success('Loan applied');
      void fetchLoans();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Apply failed');
    } finally { setApplying(false); }
  }

  async function handlePayment() {
    if (!paymentModal || !utr || !payAmount) return;
    setPaying(true);
    try {
      await api(`/api/borrower/loans/${paymentModal.id}/payments`, {
        method: 'POST',
        body: { utr, amount: Number(payAmount), paymentDate: payDate },
      });
      toast.success('Payment recorded');
      setPaymentModal(null); setUtr(''); setPayAmount('');
      void fetchLoans();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Payment failed');
    } finally { setPaying(false); }
  }

  if (loading) return <div className="py-12 text-center text-sm text-[var(--text-dim)]">Loading…</div>;
  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;

  const totalOutstanding = loans.reduce((sum, l) => sum + (l.outstanding || 0), 0);
  const totalPaid = loans.reduce((sum, l) => sum + (l.paidAmount || 0), 0);
  const closedCount = loans.filter(l => l.status === 'CLOSED').length;
  const disbursedLoans = loans.filter(l => l.status === 'DISBURSED');

  return (
    <div className="space-y-4">
      {/* Welcome + apply */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--navy)]">
            {user?.name ? `Hello, ${user.name.split(' ')[0]}` : 'My Dashboard'}
          </h1>
          <p className="text-xs text-[var(--text-dim)]">Your loan overview at a glance</p>
        </div>
        <button className="btn-primary text-xs" onClick={handleApply} disabled={applying}>
          {applying ? 'Applying…' : '+ New Loan'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Total Loans</p>
          <p className="mono mt-1 text-xl font-bold text-[var(--navy)]">{loans.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Outstanding</p>
          <p className="mono mt-1 text-xl font-bold text-[var(--blue)]">{inr(totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Total Paid</p>
          <p className="mono mt-1 text-xl font-bold text-[var(--green)]">{inr(totalPaid)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-dim)]">Closed</p>
          <p className="mono mt-1 text-xl font-bold text-[var(--text)]">{closedCount}</p>
        </div>
      </div>

      {/* Disbursed loans — pay now */}
      {disbursedLoans.length > 0 && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">Ready to Pay</p>
          <div className="mt-2 space-y-2">
            {disbursedLoans.map(loan => (
              <div key={loan.id} className="flex items-center justify-between">
                <div>
                  <span className="mono text-sm font-bold text-[var(--navy)]">{inr(loan.amount)}</span>
                  <span className="ml-2 text-[11px] text-[var(--text-dim)]">Outstanding <span className="mono font-semibold">{inr(loan.outstanding)}</span></span>
                </div>
                <button className="rounded-md bg-purple-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-purple-700" onClick={() => setPaymentModal(loan)}>
                  Pay Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guidance for new/incomplete borrowers */}
      {loans.length === 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-[13px] font-bold text-[var(--navy)]">Getting Started</h3>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">Follow these steps to apply for your first loan:</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Link href="/borrower/personal-details" className="rounded-lg border border-[var(--border)] p-3 transition-colors hover:border-[var(--blue)] hover:bg-[var(--blue-light)]">
              <p className="text-[12px] font-semibold text-[var(--navy)]">1. Personal Details</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Enter PAN, DOB, salary & employment</p>
            </Link>
            <Link href="/borrower/salary-slip" className="rounded-lg border border-[var(--border)] p-3 transition-colors hover:border-[var(--blue)] hover:bg-[var(--blue-light)]">
              <p className="text-[12px] font-semibold text-[var(--navy)]">2. Upload Salary Slip</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">PDF, JPG, or PNG - max 5 MB</p>
            </Link>
            <Link href="/borrower/loan-config" className="rounded-lg border border-[var(--border)] p-3 transition-colors hover:border-[var(--blue)] hover:bg-[var(--blue-light)]">
              <p className="text-[12px] font-semibold text-[var(--navy)]">3. Configure Loan</p>
              <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">Set amount & tenure with live calc</p>
            </Link>
          </div>
        </div>
      )}

      {/* All loans */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-dim)]">All Loans</h2>
        {loans.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--navy)]">No loans yet</p>
            <p className="mt-1 text-xs text-[var(--text-dim)]">Click "+ New Loan" above to apply for your first loan.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {loans.map((loan) => (
              <div key={loan.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--border-strong)]">
                <button className="flex w-full items-center justify-between px-3 py-2.5 text-left" onClick={() => setExpandedId(expandedId === loan.id ? null : loan.id)}>
                  <div className="flex items-center gap-3">
                    <span className="mono text-sm font-bold text-[var(--navy)]">{inr(loan.amount)}</span>
                    <StatusBadge status={loan.status} />
                    <span className="hidden text-[11px] text-[var(--text-dim)] sm:inline">{loan.tenureDays}d · 12% p.a.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {loan.paidAmount > 0 && (
                      <div className="hidden w-16 sm:block">
                        <div className="h-1 rounded-full bg-[var(--border)]">
                          <div className="h-1 rounded-full bg-[var(--green)]" style={{ width: `${Math.min(100, (loan.paidAmount / loan.totalRepayment) * 100)}%` }} />
                        </div>
                      </div>
                    )}
                    <span className="text-[11px] text-[var(--text-dim)]">{formatDate(loan.appliedAt)}</span>
                    <svg className={`h-4 w-4 text-[var(--text-dim)] transition-transform ${expandedId === loan.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expandedId === loan.id && (
                  <div className="border-t border-[var(--border)] px-3 py-2.5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
                      <div><span className="text-[var(--text-dim)]">SI:</span> <span className="mono font-medium">{inr(loan.simpleInterest)}</span></div>
                      <div><span className="text-[var(--text-dim)]">Total:</span> <span className="mono font-medium">{inr(loan.totalRepayment)}</span></div>
                      <div><span className="text-[var(--text-dim)]">Paid:</span> <span className="mono font-medium text-[var(--green)]">{inr(loan.paidAmount)}</span></div>
                      <div><span className="text-[var(--text-dim)]">Outstanding:</span> <span className="mono font-medium text-[var(--navy)]">{inr(loan.outstanding)}</span></div>
                    </div>
                    {loan.status === 'REJECTED' && loan.rejectReason && (
                      <div className="mt-2 rounded bg-red-50 px-2 py-1.5 text-[12px] text-red-600">Rejected: {loan.rejectReason}</div>
                    )}
                    {loan.status === 'DISBURSED' && (
                      <button className="mt-2 rounded-md bg-purple-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-purple-700" onClick={(e) => { e.stopPropagation(); setPaymentModal(loan); }}>
                        Make Payment
                      </button>
                    )}
                    {loan.statusHistory.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {loan.statusHistory.map((ev, i) => (
                          <div key={i} className="flex justify-between text-[11px] text-[var(--text-dim)]">
                            <span className="font-medium">{ev.status}{ev.note ? ` - ${ev.note}` : ''}</span>
                            <span className="mono">{formatDate(ev.at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment modal */}
      <Modal open={!!paymentModal} onClose={() => { setPaymentModal(null); setUtr(''); setPayAmount(''); }} title={`Pay Loan - ${paymentModal ? inr(paymentModal.outstanding) : ''} outstanding`}>
        <div className="space-y-3">
          <div>
            <label className="label">UTR Number</label>
            <input className="input" placeholder="e.g. UTR1234567890" value={utr} onChange={e => setUtr(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Amount (max {paymentModal ? inr(paymentModal.outstanding) : '-'})</label>
            <input className="input mono" type="number" min={1} max={paymentModal?.outstanding} step={0.01} value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="e.g. 50000" />
          </div>
          <div>
            <label className="label">Payment Date</label>
            <input className="input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-secondary text-xs" onClick={() => { setPaymentModal(null); setUtr(''); setPayAmount(''); }} disabled={paying}>Cancel</button>
            <button className="btn-primary text-xs" onClick={handlePayment} disabled={paying || !utr || !payAmount}>
              {paying ? 'Processing…' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { Loan } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader, EmptyState, LoadingRows, ErrorState } from '@/components/Page';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/lib/auth';
import { inr, formatDate } from '@/lib/format';

export default function CollectionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalLoan, setModalLoan] = useState<Loan | null>(null);
  const [utr, setUtr] = useState('');
  const [amount, setAmount] = useState('');
  const [acting, setActing] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const endpoint = isAdmin ? '/api/dashboard/admin/loans?status=DISBURSED' : '/api/dashboard/collection/pending';
      const res = await api<{ loans: Loan[] }>(endpoint);
      setLoans(res.loans);
    } catch (err) { setError(err instanceof Error ? err.message : 'Load failed'); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { void fetchLoans(); }, [fetchLoans]);

  async function handleRecord() {
    if (!modalLoan || !utr.trim() || !amount) return;
    setActing(true);
    try {
      await api(`/api/loans/${modalLoan.id}/payments`, { method: 'POST', body: { utr: utr.trim(), amount: Number(amount) } });
      setModalLoan(null); setUtr(''); setAmount(''); void fetchLoans();
    } catch (err) { alert(err instanceof ApiClientError ? err.message : 'Failed'); }
    finally { setActing(false); }
  }

  if (loading) return <LoadingRows />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Collection" subtitle="DISBURSED loans with outstanding balance" />
      {loans.length === 0 ? (
        <EmptyState title="Nothing to collect" />
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => {
            const b = typeof loan.borrower === 'object' ? loan.borrower : null;
            return (
              <div key={loan.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="mono text-xl font-bold text-[var(--navy)]">{inr(loan.amount)}</span>
                      <StatusBadge status={loan.status} />
                    </div>
                    {b && <p className="text-sm text-[var(--text-dim)]"><span className="font-medium text-[var(--navy)]">{b.name}</span> · {b.email}</p>}
                    <p className="text-sm text-[var(--text-dim)]">Outstanding: <span className="font-semibold text-[var(--navy)]">{inr(loan.outstanding)}</span>{loan.paidAmount > 0 && <> · Paid: {inr(loan.paidAmount)}</>}</p>
                    <p className="text-xs text-[var(--text-dim)]">Disbursed {formatDate(loan.disbursedAt)}</p>
                  </div>
                  <button className="btn-primary" onClick={() => setModalLoan(loan)}>Record payment</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!modalLoan} onClose={() => { setModalLoan(null); setUtr(''); setAmount(''); }} title="Record Payment">
        <div className="mb-4 space-y-3">
          <div>
            <label className="label">UTR</label>
            <input className="input mono" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="PAY1234567890" autoFocus />
          </div>
          <div>
            <label className="label">Amount (₹)</label>
            <input className="input mono" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={modalLoan ? `Outstanding: ${modalLoan.outstanding}` : ''} />
            {modalLoan && Number(amount) > modalLoan.outstanding && (
              <p className="mt-1 text-xs text-red-500">Amount exceeds outstanding</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => { setModalLoan(null); setUtr(''); setAmount(''); }} disabled={acting}>Cancel</button>
          <button className="btn-primary" onClick={handleRecord} disabled={acting || !utr.trim() || !amount || Number(amount) <= 0}>
            {acting ? 'Recording…' : 'Record payment'}
          </button>
        </div>
      </Modal>
    </>
  );
}

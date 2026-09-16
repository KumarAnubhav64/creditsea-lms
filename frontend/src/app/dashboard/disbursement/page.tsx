'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { Loan } from '@/lib/types';
import toast from 'react-hot-toast';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader, EmptyState, LoadingRows, ErrorState } from '@/components/Page';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/lib/auth';
import { inr, formatDate } from '@/lib/format';

export default function DisbursementPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalLoan, setModalLoan] = useState<Loan | null>(null);
  const [utr, setUtr] = useState('');
  const [acting, setActing] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const endpoint = isAdmin ? '/api/dashboard/admin/loans?status=SANCTIONED' : '/api/dashboard/disbursement/pending';
      const res = await api<{ loans: Loan[] }>(endpoint);
      setLoans(res.loans);
    } catch (err) { setError(err instanceof Error ? err.message : 'Load failed'); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { void fetchLoans(); }, [fetchLoans]);

  async function handleDisburse() {
    if (!modalLoan || !utr.trim()) return;
    setActing(true);
    try {
      await api(`/api/loans/${modalLoan.id}/disburse`, { method: 'PATCH', body: { utr: utr.trim() } });
      setModalLoan(null); setUtr(''); void fetchLoans();
    } catch (err) { toast.error(err instanceof ApiClientError ? err.message : 'Failed'); }
    finally { setActing(false); }
  }

  if (loading) return <LoadingRows />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Disbursement" subtitle="SANCTIONED loans awaiting fund transfer" />
      {loans.length === 0 ? (
        <EmptyState title="No loans to disburse" />
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
                    <p className="mono text-sm text-[var(--text-dim)]">Total repayment: {inr(loan.totalRepayment)}</p>
                    <p className="text-xs text-[var(--text-dim)]">Sanctioned {formatDate(loan.sanctionedAt)}</p>
                  </div>
                  <button className="btn-primary" onClick={() => setModalLoan(loan)}>Disburse</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!modalLoan} onClose={() => { setModalLoan(null); setUtr(''); }} title="Record Disbursement">
        <div className="mb-4">
          <label className="label">UTR (unique transaction reference)</label>
          <input className="input mono" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR1234567890" autoFocus />
        </div>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => { setModalLoan(null); setUtr(''); }} disabled={acting}>Cancel</button>
          <button className="btn-primary" onClick={handleDisburse} disabled={acting || !utr.trim()}>
            {acting ? 'Processing…' : 'Confirm disbursement'}
          </button>
        </div>
      </Modal>
    </>
  );
}

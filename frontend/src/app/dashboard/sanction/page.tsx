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

export default function SanctionPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ loan: Loan; action: 'APPROVE' | 'REJECT' } | null>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const endpoint = isAdmin ? '/api/dashboard/admin/loans?status=APPLIED' : '/api/dashboard/sanction/pending';
      const res = await api<{ loans: Loan[] }>(endpoint);
      setLoans(res.loans);
    } catch (err) { setError(err instanceof Error ? err.message : 'Load failed'); }
    finally { setLoading(false); }
  }, [isAdmin]);

  useEffect(() => { void fetchLoans(); }, [fetchLoans]);

  async function handleDecide() {
    if (!modal) return;
    setActing(true);
    try {
      await api(`/api/loans/${modal.loan.id}/decision`, {
        method: 'PATCH',
        body: { action: modal.action, ...(modal.action === 'REJECT' ? { reason } : {}) },
      });
      setModal(null); setReason(''); void fetchLoans();
    } catch (err) { toast.error(err instanceof ApiClientError ? err.message : 'Failed'); }
    finally { setActing(false); }
  }

  if (loading) return <LoadingRows />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Loan Sanction" subtitle="APPLIED loans awaiting decision" />
      {loans.length === 0 ? (
        <EmptyState title="No pending loans" description="All applied loans have been processed." />
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
                    {b && <p className="text-sm text-[var(--text-dim)]"><span className="font-medium text-[var(--navy)]">{b.name}</span> · {b.email}{b.monthlySalary ? ` · ${inr(b.monthlySalary)}/mo` : ''}</p>}
                    <p className="mono text-sm text-[var(--text-dim)]">{loan.tenureDays}d · SI {inr(loan.simpleInterest)} · Total {inr(loan.totalRepayment)}</p>
                    <p className="text-xs text-[var(--text-dim)]">Applied {formatDate(loan.appliedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" onClick={() => setModal({ loan, action: 'APPROVE' })}>Approve</button>
                    <button className="btn-danger text-xs" onClick={() => setModal({ loan, action: 'REJECT' })}>Reject</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!modal} onClose={() => { setModal(null); setReason(''); }} title={modal?.action === 'APPROVE' ? 'Approve Loan' : 'Reject Loan'}>
        {modal?.action === 'REJECT' && (
          <div className="mb-4">
            <label className="label">Rejection reason (required)</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Insufficient documentation" autoFocus />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={() => { setModal(null); setReason(''); }} disabled={acting}>Cancel</button>
          <button className={modal?.action === 'APPROVE' ? 'btn-primary' : 'btn-danger'} onClick={handleDecide} disabled={acting || (modal?.action === 'REJECT' && !reason.trim())}>
            {acting ? 'Processing…' : modal?.action === 'APPROVE' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </Modal>
    </>
  );
}

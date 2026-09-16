'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Lead } from '@/lib/types';
import { PageHeader, EmptyState, LoadingRows, ErrorState } from '@/components/Page';
import { StageBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/format';

export default function SalesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ leads: Lead[] }>('/api/dashboard/sales/leads');
      setLeads(res.leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchLeads(); }, [fetchLeads]);

  if (loading) return <LoadingRows />;
  if (error) return <ErrorState message={error} />;

  return (
    <>
      <PageHeader title="Sales Funnel" subtitle={`${leads.length} registered borrowers`} />
      {leads.length === 0 ? (
        <EmptyState title="No borrowers yet" description="Once borrowers register they will appear here." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">Name</th>
                <th className="th">Email</th>
                <th className="th">Stage</th>
                <th className="th">Joined</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-[var(--surface-2)] transition-colors">
                  <td className="td font-medium text-[var(--navy)]">{l.name}</td>
                  <td className="td text-[var(--text-dim)]">{l.email}</td>
                  <td className="td"><StageBadge stage={l.stage} /></td>
                  <td className="td text-[var(--text-dim)]">{formatDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

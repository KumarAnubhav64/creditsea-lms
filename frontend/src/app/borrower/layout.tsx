'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useRequireRole } from '@/components/useRequireRole';
import { LoadingRows } from '@/components/Page';
import { CreditSeaLogo } from '@/components/CreditSeaLogo';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { DASHBOARD_ROLES } from '@/lib/types';

type StageResponse = { stage: string };

const STEPS = [
  { n: 1, label: 'Details', path: '/borrower/personal-details' },
  { n: 2, label: 'Slip', path: '/borrower/salary-slip' },
  { n: 3, label: 'Config', path: '/borrower/loan-config' },
  { n: 4, label: 'Loans', path: '/borrower/loans' },
];

export default function BorrowerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [stage, setStage] = useState<string | null>(null);

  const fetchStage = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api<StageResponse>('/api/borrower/stage');
      setStage(res.stage);
    } catch { /* ok */ }
  }, [user]);

  useEffect(() => { void fetchStage(); }, [fetchStage]);

  useEffect(() => {
    if (!loading && user && DASHBOARD_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) return <LoadingRows />;
  if (!user || DASHBOARD_ROLES.includes(user.role)) return null;

  const stageIndex = stage === 'REGISTERED' ? 1 : stage === 'BRE_VERIFIED' ? 1 : stage === 'SLIP_UPLOADED' ? 2 : stage === 'READY_TO_APPLY' ? 4 : 3;
  const isOnStep = (path: string) => pathname === path;
  const isComplete = stageIndex >= 4;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <header className="border-b border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
          <Link href="/borrower" className="flex items-center gap-2">
            <CreditSeaLogo size={24} />
            <span className="text-sm font-bold text-[var(--navy)]">CreditSea</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--text-dim)]">{user.email}</span>
            {DASHBOARD_ROLES.includes(user.role) && (
              <Link href="/dashboard" className="btn-ghost text-xs">Dashboard</Link>
            )}
            <button onClick={() => { logout(); window.location.href = '/login'; }} className="btn-ghost text-xs">Sign out</button>
          </div>
        </div>
      </header>

      {/* Stepper — only show when not fully complete */}
      {!isComplete && (
        <div className="border-b border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <div className="mx-auto max-w-5xl px-4 py-2">
            <div className="flex items-center">
              {STEPS.map((step, i) => {
                const done = step.n < stageIndex;
                const active = step.n === stageIndex || isOnStep(step.path);
                return (
                  <div key={step.n} className="flex items-center">
                    <Link
                      href={done || active ? step.path : '#'}
                      className={`flex items-center gap-1.5 ${!done && !active ? 'pointer-events-none opacity-40' : ''}`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        done ? 'bg-[var(--green)] text-white' :
                        active ? 'bg-[var(--blue)] text-white' :
                        'bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--border)]'
                      }`}>{done ? '✓' : step.n}</span>
                      <span className={`hidden text-[12px] font-medium sm:block ${active ? 'text-[var(--navy)]' : 'text-[var(--text-dim)]'}`}>
                        {step.label}
                      </span>
                    </Link>
                    {i < 3 && <div className={`mx-2 h-px w-5 sm:w-10 ${done ? 'bg-[var(--green)]' : 'bg-[var(--border)]'}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-3">{children}</main>
    </div>
  );
}

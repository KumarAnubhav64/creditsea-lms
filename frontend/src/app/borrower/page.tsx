'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type StageResponse = { stage: string; hasLoanConfig: boolean };

export default function BorrowerHome() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  const fetchStage = useCallback(async () => {
    try {
      const res = await api<StageResponse>('/api/borrower/stage');
      // REGISTERED / BRE_VERIFIED → personal-details
      // SLIP_UPLOADED → salary-slip (slip not uploaded yet)
      // READY_TO_APPLY → loan-config or loans (config exists → loans, else config)
      if (res.stage === 'READY_TO_APPLY') router.replace(res.hasLoanConfig ? '/borrower/loans' : '/borrower/loan-config');
      else if (res.stage === 'SLIP_UPLOADED') router.replace('/borrower/salary-slip');
      else router.replace('/borrower/personal-details');
    } catch {
      router.replace('/borrower/personal-details');
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    if (!authLoading && user) void fetchStage();
  }, [authLoading, user, fetchStage]);

  return (
    <div className="flex h-64 items-center justify-center text-slate-400">
      {authLoading || checking ? 'Loading…' : 'Redirecting…'}
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { DASHBOARD_ROLES } from '@/lib/types';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (DASHBOARD_ROLES.includes(user.role)) router.replace('/dashboard');
    else router.replace('/borrower');
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading CreditSea…</div>
    </main>
  );
}

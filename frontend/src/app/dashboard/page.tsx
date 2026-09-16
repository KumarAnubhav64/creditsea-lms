'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user?.role === 'admin') router.replace('/dashboard/sales');
    else router.replace(`/dashboard/${user?.role}`);
  }, [user, router]);
  return <div className="flex h-64 items-center justify-center text-slate-400">Redirecting…</div>;
}

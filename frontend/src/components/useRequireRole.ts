'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import type { Role } from '@/lib/types';

/**
 * Client-side route guard — mirrors the backend's requireRole middleware for
 * UX (ADR-004). The API remains the security boundary; this only prevents
 * confusing dead-ends for logged-in users.
 */
export function useRequireRole(...allowed: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!allowed.includes(user.role)) {
      router.replace(user.role === 'borrower' ? '/borrower' : '/dashboard');
    }
  }, [user, loading, allowed, router, pathname]);

  return { user, loading, authorized: !loading && !!user && allowed.includes(user.role) };
}

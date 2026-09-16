'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { DASHBOARD_ROLES } from '@/lib/types';
import { CreditSeaLogo } from '@/components/CreditSeaLogo';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      router.replace(DASHBOARD_ROLES.includes(user.role) ? '/dashboard' : '/borrower');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4"><CreditSeaLogo size={48} /></div>
          <h1 className="text-2xl font-bold text-[var(--navy)]">Welcome back</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">Sign in to your CreditSea account</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@creditsea.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-[var(--text-dim)]">
            New borrower?{' '}
            <Link href="/signup" className="font-semibold text-[var(--blue)] hover:underline">
              Create an account
            </Link>
          </p>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--text-dim)]">
          Ops accounts are pre-seeded - see README
        </p>
      </div>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { CreditSeaLogo } from '@/components/CreditSeaLogo';

export default function SignupPage() {
  const { signup } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await signup(name, email, password);
      toast.success('Account created');
      router.replace('/borrower');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4"><CreditSeaLogo size={48} /></div>
          <h1 className="text-2xl font-bold text-[var(--navy)]">Create your account</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">Apply for a loan in four quick steps</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" className="input" placeholder="Ravi Kumar" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Sign up'}
          </button>

          <p className="text-center text-sm text-[var(--text-dim)]">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-[var(--blue)] hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}

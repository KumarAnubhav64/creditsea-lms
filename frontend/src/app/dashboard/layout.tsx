'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRequireRole } from '@/components/useRequireRole';
import { LoadingRows } from '@/components/Page';
import { CreditSeaLogo } from '@/components/CreditSeaLogo';
import type { Role } from '@/lib/types';
import { ROLE_LABELS } from '@/lib/types';

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: '/dashboard/sales', label: 'Leads', roles: ['sales', 'admin'] },
  { href: '/dashboard/sanction', label: 'Sanction', roles: ['sanction', 'admin'] },
  { href: '/dashboard/disbursement', label: 'Disbursement', roles: ['disbursement', 'admin'] },
  { href: '/dashboard/collection', label: 'Collection', roles: ['collection', 'admin'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useRequireRole('admin', 'sales', 'sanction', 'disbursement', 'collection');
  const pathname = usePathname();

  if (loading) return <LoadingRows />;
  if (!user) return null;

  // RBAC: redirect to first allowed route if user landed on unauthorized page
  const currentNav = NAV.find((n) => n.href === pathname);
  if (currentNav && !currentNav.roles.includes(user.role as Role)) {
    const allowed = NAV.find((n) => n.roles.includes(user.role as Role));
    if (allowed) {
      if (typeof window !== 'undefined') window.location.href = allowed.href;
      return <LoadingRows />;
    }
  }

  const filteredNav = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-[var(--border)] md:block" style={{ background: 'var(--surface)' }}>
        <div className="border-b border-[var(--border)] px-5 py-5">
          <div className="flex items-center gap-2.5">
            <CreditSeaLogo size={32} />
            <div>
              <p className="text-sm font-bold text-[var(--navy)]">CreditSea</p>
              <p className="text-xs text-[var(--text-dim)]">{ROLE_LABELS[user.role as Role]}</p>
            </div>
          </div>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {filteredNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--blue-light)] text-[var(--blue)]'
                    : 'text-[var(--text-dim)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3" style={{ background: 'var(--surface)' }}>
          <select
            className="input md:hidden text-sm"
            value={pathname}
            onChange={(e) => { window.location.href = e.target.value; }}
          >
            {filteredNav.map((n) => (
              <option key={n.href} value={n.href}>{n.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--text-dim)]">{user.name}</span>
            <button
              onClick={() => { localStorage.removeItem('creditsea_token'); window.location.href = '/login'; }}
              className="btn-ghost text-xs"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

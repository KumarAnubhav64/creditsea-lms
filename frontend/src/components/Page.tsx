import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-[var(--navy)]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--text-dim)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)]">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[var(--text-dim)]">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <p className="font-semibold text-[var(--navy)]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-[var(--text-dim)]">{description}</p>}
    </div>
  );
}

export function LoadingRows() {
  return (
    <div className="card divide-y divide-[var(--border)]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-5">
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface-2)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
          <div className="h-7 w-20 animate-pulse rounded-lg bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="font-semibold text-red-700">Something went wrong</p>
      <p className="mt-1 text-sm text-red-600">{message}</p>
    </div>
  );
}

'use client';

const STEPS = [
  { n: 1, label: 'Personal Details' },
  { n: 2, label: 'Salary Slip' },
  { n: 3, label: 'Loan Config' },
];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const state = step.n < current ? 'done' : step.n === current ? 'active' : 'todo';
        return (
          <li key={step.n} className="flex items-center">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  state === 'done'
                    ? 'bg-[var(--green)] text-white'
                    : state === 'active'
                      ? 'bg-[var(--blue)] text-white'
                      : 'bg-[var(--surface-2)] text-[var(--text-dim)] border border-[var(--border)]'
                }`}
              >
                {state === 'done' ? '✓' : step.n}
              </span>
              <span
                className={`hidden text-sm font-medium sm:block ${
                  state === 'active' ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-3 h-px w-8 sm:w-14 ${state === 'done' ? 'bg-[var(--green)]' : 'bg-[var(--border)]'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

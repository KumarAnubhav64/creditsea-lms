import type { LoanStatus } from '@/lib/types';

const STYLES: Record<LoanStatus, string> = {
  APPLIED: 'status status-applied',
  SANCTIONED: 'status status-sanctioned',
  REJECTED: 'status status-rejected',
  DISBURSED: 'status status-disbursed',
  CLOSED: 'status status-closed',
};

export function StatusBadge({ status }: { status: LoanStatus }) {
  return <span className={STYLES[status]}>{status}</span>;
}

const STAGE_STYLES: Record<string, string> = {
  REGISTERED: 'status stage-registered',
  BRE_VERIFIED: 'status stage-bre',
  SLIP_UPLOADED: 'status stage-slip',
  READY_TO_APPLY: 'status stage-ready',
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className={STAGE_STYLES[stage] ?? STAGE_STYLES.REGISTERED}>
      {stage.replaceAll('_', ' ')}
    </span>
  );
}

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Hourglass,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { Confidence, HumanOutcome, InvoiceStatus, JobStatus, SystemDecision } from '../../lib/types';
import { Badge, type BadgeTone } from './Badge';

const iconClass = 'w-3.5 h-3.5 shrink-0';
const cnSpin = `${iconClass} animate-spin`;

/** PASS / REVIEW / BLOCK chip. */
export const DecisionBadge: React.FC<{ decision: SystemDecision; size?: 'sm' | 'md' }> = ({
  decision,
  size = 'md',
}) => {
  if (decision === 'PASS') {
    return (
      <Badge tone="mint" size={size}>
        <CheckCircle2 className={iconClass} /> Pass
      </Badge>
    );
  }
  if (decision === 'REVIEW') {
    return (
      <Badge tone="amber" size={size}>
        <AlertTriangle className={iconClass} /> Review
      </Badge>
    );
  }
  return (
    <Badge tone="signal" size={size}>
      <ShieldAlert className={iconClass} /> Block
    </Badge>
  );
};

/** The human outcome attached to a finalized invoice (from run.human_outcome). */
export const OutcomeBadge: React.FC<{ outcome: HumanOutcome | null; size?: 'sm' | 'md' }> = ({
  outcome,
  size = 'md',
}) => {
  if (!outcome || outcome === 'pending') {
    return (
      <Badge tone="neutral" size={size}>
        <Hourglass className={iconClass} /> Awaiting decision
      </Badge>
    );
  }
  if (outcome === 'approved') {
    return (
      <Badge tone="mint" size={size}>
        <CheckCircle2 className={iconClass} /> Approved
      </Badge>
    );
  }
  if (outcome === 'rejected') {
    return (
      <Badge tone="neutral" size={size}>
        <XCircle className={iconClass} /> Rejected
      </Badge>
    );
  }
  return (
    <Badge tone="amber" size={size} className="border-signal/30 bg-signal-soft text-signal-deep">
      <RotateCcw className={iconClass} /> Block overridden
    </Badge>
  );
};

const JOB_TONE: Record<JobStatus, BadgeTone> = {
  QUEUED: 'neutral',
  RUNNING: 'blue',
  SUCCEEDED: 'mint',
  FAILED: 'signal',
};

export const JobBadge: React.FC<{ status: JobStatus; size?: 'sm' | 'md'; progress?: number }> = ({
  status,
  size = 'sm',
  progress,
}) => {
  const tone = JOB_TONE[status];
  const label =
    status === 'QUEUED'
      ? 'Queued'
      : status === 'RUNNING'
        ? progress !== undefined
          ? `Processing · ${progress}%`
          : 'Processing'
        : status === 'SUCCEEDED'
          ? 'Succeeded'
          : 'Failed';
  const icon =
    status === 'QUEUED' ? <CircleDashed className={iconClass} /> :
    status === 'RUNNING' ? <Clock className={cnSpin} /> :
    status === 'SUCCEEDED' ? <CheckCircle2 className={iconClass} /> :
    <XCircle className={iconClass} />;
  return (
    <Badge tone={tone} size={size} icon={icon}>
      {label}
    </Badge>
  );
};
const INVOICE_TONE: Partial<Record<InvoiceStatus, BadgeTone>> = {
  AWAITING_REVIEW: 'amber',
  BLOCKED: 'signal',
  EXTRACTION_FAILED: 'amber',
  FAILED: 'signal',
  APPROVED: 'mint',
  OVERRIDDEN: 'amber',
  COMPLETED: 'neutral',
  RECEIVED: 'blue',
  EXTRACTING: 'blue',
  AI_ANALYZED: 'blue',
  VALIDATING: 'blue',
  CLASSIFIED: 'blue',
  REJECTED: 'neutral',
};

const INVOICE_STATUS_TEXT: Record<InvoiceStatus, string> = {
  RECEIVED: 'Received',
  EXTRACTING: 'Extracting',
  AI_ANALYZED: 'Analysed',
  VALIDATING: 'Validating',
  CLASSIFIED: 'Classified',
  AWAITING_REVIEW: 'Awaiting review',
  BLOCKED: 'Blocked',
  EXTRACTION_FAILED: 'Extraction issue',
  FAILED: 'Failed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OVERRIDDEN: 'Overridden',
  COMPLETED: 'Completed',
};

/** Invoice lifecycle chip; pass run.human_outcome to disambiguate COMPLETED. */
export const InvoiceStatusBadge: React.FC<{
  status: InvoiceStatus;
  outcome?: HumanOutcome | null;
  size?: 'sm' | 'md';
}> = ({ status, outcome, size = 'sm' }) => {
  if (status === 'COMPLETED' && outcome && outcome !== 'pending') {
    return <OutcomeBadge outcome={outcome} size={size} />;
  }
  const tone = INVOICE_TONE[status] ?? 'neutral';
  const icon = status === 'BLOCKED' || status === 'FAILED' ? <XCircle className={iconClass} /> :
    status === 'AWAITING_REVIEW' ? <AlertTriangle className={iconClass} /> :
    status === 'COMPLETED' || status === 'APPROVED' ? <CheckCircle2 className={iconClass} /> : undefined;
  return (
    <Badge tone={tone} size={size} icon={icon}>
      {INVOICE_STATUS_TEXT[status] ?? status}
    </Badge>
  );
};

const CONFIDENCE_TONE: Record<Confidence, BadgeTone> = {
  high: 'mint',
  medium: 'amber',
  low: 'signal',
};

export const ConfidenceBadge: React.FC<{ confidence: Confidence; size?: 'sm' | 'md' }> = ({
  confidence,
  size = 'sm',
}) => (
  <Badge tone={CONFIDENCE_TONE[confidence]} size={size}>
    {confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : 'Low confidence'}
  </Badge>
);

/** Field-level extraction confidence, includes 'missing'. */
export const FieldConfidenceDot: React.FC<{ confidence: string }> = ({ confidence }) => {
  const color =
    confidence === 'high'
      ? 'bg-brand'
      : confidence === 'medium'
        ? 'bg-amber-500'
        : confidence === 'low'
          ? 'bg-signal'
          : 'bg-zinc-300';
  const label =
    confidence === 'high'
      ? 'high'
      : confidence === 'medium'
        ? 'medium'
        : confidence === 'low'
          ? 'low'
          : 'missing';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
};

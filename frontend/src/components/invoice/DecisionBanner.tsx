import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Confidence, HumanActionRequired, ReportPayload, SystemDecision } from '../../lib/types';
import { HUMAN_OUTCOME_LABEL } from '../../lib/constants';
import { Badge } from '../ui/Badge';

interface DecisionBannerProps {
  decision: SystemDecision;
  confidence: Confidence;
  report: ReportPayload;
  humanAction: HumanActionRequired;
  humanOutcome: 'approved' | 'rejected' | 'override_block' | 'pending' | null;
  className?: string;
}

const ACTION_TEXT: Record<HumanActionRequired, string> = {
  none: 'No human action required beyond the standard approval gate.',
  confirm_extraction: 'Confirm the corrected fields below, then continue.',
  investigate: 'Investigate the flagged issues before deciding.',
  escalate: 'Escalate per policy — this needs a documented override.',
  approve: 'This run awaits an approver decision.',
};

const CONFIG: Record<
  SystemDecision,
  { icon: React.ElementType; chip: string; ring: string; title: string }
> = {
  PASS: {
    icon: CheckCircle2,
    chip: 'bg-brand text-white',
    ring: 'bg-brand text-white border-brand',
    title: 'Recommendation: Pass',
  },
  REVIEW: {
    icon: AlertTriangle,
    chip: 'bg-amber-400 text-amber-950',
    ring: 'bg-amber-50 border-amber-300 text-amber-950',
    title: 'Recommendation: Review',
  },
  BLOCK: {
    icon: ShieldAlert,
    chip: 'bg-signal text-white',
    ring: 'bg-signal text-white border-signal',
    title: 'Recommendation: Block',
  },
};

export const DecisionBanner: React.FC<DecisionBannerProps> = ({
  decision,
  confidence,
  report,
  humanAction,
  humanOutcome,
  className,
}) => {
  const config = CONFIG[decision];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 sm:p-6',
        decision === 'PASS'
          ? 'border-brand/25 bg-mint'
          : decision === 'REVIEW'
            ? 'border-amber-300 bg-amber-50'
            : 'border-signal/40 bg-signal-soft',
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', config.chip)}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">System recommendation</p>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink mt-0.5 flex items-center gap-2.5 flex-wrap">
              {decision === 'PASS' ? 'Pass' : decision === 'REVIEW' ? 'Review' : 'Block'}
              <Badge tone={decision === 'PASS' ? 'mint' : decision === 'REVIEW' ? 'amber' : 'signal'} size="sm">
                {confidence === 'high' ? 'High confidence' : confidence === 'medium' ? 'Medium confidence' : 'Low confidence'}
              </Badge>
            </h2>
            <p className={cn('text-sm leading-relaxed mt-1.5 max-w-2xl', decision === 'BLOCK' ? 'text-signal-deep font-medium' : 'text-zinc-700')}>
              {report.recommendation.text}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          {humanOutcome && humanOutcome !== 'pending' ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Approver outcome</p>
              <p className="text-base font-extrabold text-ink mt-0.5">{HUMAN_OUTCOME_LABEL[humanOutcome]}</p>
            </>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Next step</p>
              <p className={cn('text-sm font-semibold mt-0.5 max-w-[220px]', decision === 'BLOCK' ? 'text-signal-deep' : 'text-zinc-800')}>
                {ACTION_TEXT[humanAction]}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-black/5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1">
          <Info className="w-3 h-3" />
          {report.checks.length} checks · {report.issues.length} issue{report.issues.length === 1 ? '' : 's'}
        </span>
        <span>Processing time {report.processing_time_seconds.toFixed(1)}s</span>
        <span>Report {report.report_id}</span>
        {decision !== 'PASS' && (
          <span className={cn('font-bold', decision === 'BLOCK' ? 'text-signal-deep' : 'text-amber-800')}>
            {decision === 'BLOCK' ? 'Hard stop — override requires a written reason.' : 'Does not auto-approve.'}
          </span>
        )}
      </div>
    </div>
  );
};

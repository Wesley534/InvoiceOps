import React from 'react';
import { CheckCircle2, MinusCircle, XCircle, AlertCircle } from 'lucide-react';
import type { ValidationCheck } from '../../lib/types';
import { SEVERITY_LABEL } from '../../lib/constants';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface ChecksTableProps {
  checks: ValidationCheck[];
}

function statusMeta(status: ValidationCheck['status']) {
  switch (status) {
    case 'pass':
      return { icon: CheckCircle2, iconClass: 'text-brand', rowClass: 'bg-mint/40' };
    case 'fail':
      return { icon: XCircle, iconClass: 'text-signal', rowClass: 'bg-signal-soft/50' };
    case 'error':
      return { icon: AlertCircle, iconClass: 'text-signal', rowClass: 'bg-signal-soft/40' };
    default:
      return { icon: MinusCircle, iconClass: 'text-zinc-400', rowClass: 'bg-zinc-50/60' };
  }
}

/** All 11 deterministic validation checks with their evidence. */
export const ChecksTable: React.FC<ChecksTableProps> = ({ checks }) => {
  const failed = checks.filter((c) => c.status === 'fail' || c.status === 'error').length;

  return (
    <Card
      header={{
        title: 'Validation checks',
        subtitle: `11 deterministic rules against the master-data registers · ${checks.length - failed} passing`,
        actions: failed > 0 ? (
          <Badge tone="signal" size="sm">{failed} issue{failed === 1 ? '' : 's'}</Badge>
        ) : (
          <Badge tone="mint" size="sm">All clear</Badge>
        ),
      }}
    >
      <ul className="divide-y divide-zinc-100">
        {checks.map((check) => {
          const meta = statusMeta(check.status);
          const Icon = meta.icon;
          return (
            <li key={check.check_id} className={cn('px-1 -mx-1 rounded-lg py-3 sm:px-2 sm:-mx-2', meta.rowClass)}>
              <div className="flex items-start gap-3">
                <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', meta.iconClass)} aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-sm font-bold text-ink">{check.name}</span>
                    <code className="text-[10px] font-mono text-zinc-400">{check.check_id}</code>
                    <Badge
                      tone={
                        check.severity === 'critical'
                          ? 'signal'
                          : check.severity === 'high'
                            ? 'amber'
                            : 'neutral'
                      }
                      size="sm"
                    >
                      {SEVERITY_LABEL[check.severity] ?? check.severity}
                    </Badge>
                    <Badge
                      size="sm"
                      tone={
                        check.status === 'pass'
                          ? 'mint'
                          : check.status === 'not_applicable'
                            ? 'neutral'
                            : 'signal'
                      }
                    >
                      {check.status === 'pass' ? 'Pass' : check.status === 'not_applicable' ? 'N/A' : check.status === 'error' ? 'Error' : 'Fail'}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">{check.detail}</p>
                  {check.evidence && check.evidence.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {check.evidence.map((ref) => (
                        <code key={ref} className="text-[10px] font-mono bg-white border border-zinc-200 rounded-md px-1.5 py-0.5 text-zinc-600">
                          {ref}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

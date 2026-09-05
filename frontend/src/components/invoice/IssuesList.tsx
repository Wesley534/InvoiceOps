import React from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { ReportIssue } from '../../lib/types';
import { cn } from '../../lib/utils';

interface IssuesListProps {
  issues: ReportIssue[];
}

/** Detected exceptions, one entry per failed check. */
export const IssuesList: React.FC<IssuesListProps> = ({ issues }) => {
  if (!issues || issues.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-ink flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        Detected issues ({issues.length})
      </h2>
      <ul className="space-y-2.5">
        {issues.map((issue, index) => {
          const isBlock = issue.tier === 'block';
          return (
            <li
              key={`${issue.check_id}-${index}`}
              className={cn(
                'rounded-xl border p-4 flex items-start gap-3',
                isBlock ? 'bg-signal-soft/60 border-signal/30' : 'bg-amber-50/70 border-amber-200',
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  isBlock ? 'bg-signal text-white' : 'bg-amber-400 text-amber-950',
                )}
              >
                {isBlock ? <ShieldAlert className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-[10px] font-extrabold uppercase tracking-wider', isBlock ? 'text-signal-deep' : 'text-amber-800')}>
                    {isBlock ? 'Blocking' : 'Needs review'}
                  </span>
                  <code className="text-[10px] font-mono text-zinc-400">{issue.check_id}</code>
                </div>
                <p className="text-sm text-zinc-800 leading-relaxed">{issue.description}</p>
                {issue.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {issue.evidence.map((ref) => (
                      <code key={ref} className="text-[10px] font-mono bg-white border border-zinc-200 rounded-md px-1.5 py-0.5 text-zinc-600">
                        {ref}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

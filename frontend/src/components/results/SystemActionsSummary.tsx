import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { SystemActionLog } from '../../types';
import { cn } from '../../lib/utils';

interface SystemActionsSummaryProps {
  actions: SystemActionLog[];
  humanInvolvementText?: string;
  className?: string;
}

export const SystemActionsSummary: React.FC<SystemActionsSummaryProps> = ({
  actions,
  humanInvolvementText,
  className
}) => {
  return (
    <div className={cn('bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-4', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Actions Taken by the System
          </h3>
          <p className="text-xs text-zinc-500">
            Transparent audit of the operations completed during this task.
          </p>
        </div>

        {humanInvolvementText && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{humanInvolvementText}</span>
          </span>
        )}
      </div>

      <div className="space-y-3">
        {actions.map((action, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50/70 border border-zinc-200/70 text-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-zinc-900 block">{action.title}</span>
              <p className="text-zinc-600 leading-relaxed font-normal">{action.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

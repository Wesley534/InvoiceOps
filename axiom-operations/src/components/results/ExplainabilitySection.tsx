import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Info
} from 'lucide-react';
import { ExplainabilityDetails } from '../../types';
import { cn } from '../../lib/utils';

interface ExplainabilitySectionProps {
  explainability?: ExplainabilityDetails;
  className?: string;
}

export const ExplainabilitySection: React.FC<ExplainabilitySectionProps> = ({
  explainability,
  className
}) => {
  const [isOpen, setIsOpen] = useState(true);

  if (!explainability) return null;

  return (
    <div className={cn('bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-xs', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-zinc-50/60 hover:bg-zinc-100/60 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-bold text-zinc-900">
            {explainability.question || 'Why did the system produce this result?'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
          <span>{isOpen ? 'Hide reasoning' : 'Show reasoning'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-6 space-y-5 border-t border-zinc-100">
          <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
            {explainability.summary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Information considered */}
            <div className="space-y-2 p-4 rounded-xl bg-zinc-50/70 border border-zinc-200/80">
              <span className="font-bold text-zinc-900 block text-[11px] uppercase tracking-wider">
                Information Considered
              </span>
              <ul className="space-y-1.5 text-zinc-600">
                {explainability.informationConsidered.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Rules and checks applied */}
            <div className="space-y-2 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80">
              <span className="font-bold text-emerald-950 block text-[11px] uppercase tracking-wider">
                Operational Rules & Checks Applied
              </span>
              <ul className="space-y-1.5 text-emerald-900">
                {explainability.rulesAndChecksApplied.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Assumptions */}
          {explainability.assumptionsMade && explainability.assumptionsMade.length > 0 && (
            <div className="pt-2 border-t border-zinc-100">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                Assumptions Made by the System
              </span>
              <ul className="text-xs text-zinc-600 space-y-1">
                {explainability.assumptionsMade.map((a, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

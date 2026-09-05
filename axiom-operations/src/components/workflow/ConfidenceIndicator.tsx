import React from 'react';
import { ShieldCheck, AlertCircle, HelpCircle } from 'lucide-react';
import { ConfidenceLevel } from '../../types';
import { cn } from '../../lib/utils';

interface ConfidenceIndicatorProps {
  level: ConfidenceLevel;
  reason?: string;
  showExplanation?: boolean;
  className?: string;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  level,
  reason,
  showExplanation = true,
  className
}) => {
  const config = {
    high: {
      label: 'Confidence: High',
      badgeStyles: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: ShieldCheck,
      iconColor: 'text-emerald-600',
      description: 'All facts verified against primary reference documents.'
    },
    medium: {
      label: 'Confidence: Medium',
      badgeStyles: 'bg-amber-50 text-amber-900 border-amber-200',
      icon: AlertCircle,
      iconColor: 'text-amber-600',
      description: 'Minor assumptions made based on standard operating norms.'
    },
    needs_review: {
      label: 'Confidence: Needs Review',
      badgeStyles: 'bg-amber-50 text-amber-900 border-amber-200',
      icon: AlertCircle,
      iconColor: 'text-amber-600',
      description: 'System identified a discrepancy that requires deliberate human confirmation.'
    }
  }[level];

  const Icon = config.icon;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-2xs',
            config.badgeStyles
          )}
        >
          <Icon className={cn('w-3.5 h-3.5', config.iconColor)} aria-hidden="true" />
          <span>{config.label}</span>
        </span>
      </div>

      {showExplanation && (
        <p className="text-xs text-zinc-600 leading-relaxed">
          {reason || config.description}
        </p>
      )}
    </div>
  );
};

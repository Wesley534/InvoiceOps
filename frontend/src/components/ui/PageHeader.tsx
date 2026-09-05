import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  description,
  onBack,
  actions,
  className,
}) => (
  <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4', className)}>
    <div className="min-w-0">
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 mb-3 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
      )}
      {eyebrow && (
        <div className="mb-1.5 text-xs font-bold text-brand-deep uppercase tracking-wider">{eyebrow}</div>
      )}
      <h1 className="text-2xl sm:text-3xl xl:text-[2.1rem] font-extrabold tracking-tight text-ink">{title}</h1>
      {description && <p className="text-[15px] text-zinc-600 mt-2 max-w-2xl leading-relaxed font-medium">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
  </div>
);

import React from 'react';
import { cn } from '../../lib/utils';

interface SpinnerProps {
  label?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ label, className }) => (
  <div className={cn('flex items-center justify-center gap-3 py-16 text-zinc-500', className)}>
    <svg className="w-6 h-6 animate-spin text-brand" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
    {label && <span className="text-sm">{label}</span>}
  </div>
);

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div
    className={cn(
      'flex flex-col items-center justify-center text-center px-6 py-12 border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50',
      className,
    )}
  >
    {icon && <div className="w-10 h-10 rounded-xl bg-mint text-brand-deep border border-brand/15 flex items-center justify-center mb-3">{icon}</div>}
    <p className="text-sm font-bold text-zinc-800">{title}</p>
    {description && <p className="text-xs text-zinc-500 mt-1 max-w-sm leading-relaxed">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

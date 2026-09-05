import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  PauseCircle,
  HelpCircle
} from 'lucide-react';
import { TaskStatus } from '../../types';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showIcon = true,
  className
}) => {
  const config = {
    completed: {
      label: 'Completed',
      icon: CheckCircle2,
      styles: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
      iconColor: 'text-emerald-600'
    },
    needs_review: {
      label: 'Needs Review',
      icon: AlertTriangle,
      styles: 'bg-amber-50 text-amber-900 border-amber-200/90',
      iconColor: 'text-amber-600'
    },
    running: {
      label: 'Running',
      icon: Clock,
      styles: 'bg-emerald-50 text-emerald-800 border-emerald-200/90 animate-pulse',
      iconColor: 'text-emerald-600 animate-spin'
    },
    queued: {
      label: 'Queued',
      icon: PauseCircle,
      styles: 'bg-zinc-100 text-zinc-700 border-zinc-200',
      iconColor: 'text-zinc-500'
    },
    partial_success: {
      label: 'Partial Success',
      icon: AlertTriangle,
      styles: 'bg-amber-50 text-amber-900 border-amber-200/90',
      iconColor: 'text-amber-600'
    },
    failed: {
      label: 'Action Required / Paused',
      icon: XCircle,
      styles: 'bg-rose-50 text-rose-800 border-rose-200/90',
      iconColor: 'text-rose-600'
    }
  }[status] || {
    label: status,
    icon: HelpCircle,
    styles: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    iconColor: 'text-zinc-500'
  };

  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2'
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border shadow-2xs select-none transition-colors',
        config.styles,
        sizeClasses,
        className
      )}
    >
      {showIcon && <Icon className={cn('w-3.5 h-3.5 shrink-0', config.iconColor)} aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
};

import React from 'react';
import { Lightbulb, Info, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface GuidanceAlertProps {
  type?: 'tip' | 'info' | 'caution' | 'ready';
  title?: string;
  message: string;
  className?: string;
}

export const GuidanceAlert: React.FC<GuidanceAlertProps> = ({
  type = 'tip',
  title,
  message,
  className
}) => {
  const config = {
    tip: {
      icon: Lightbulb,
      bg: 'bg-emerald-50/90 border-emerald-200/90 text-emerald-950',
      iconColor: 'text-emerald-600',
      defaultTitle: 'Helpful guidance'
    },
    info: {
      icon: Info,
      bg: 'bg-zinc-50 border-zinc-200 text-zinc-800',
      iconColor: 'text-zinc-500',
      defaultTitle: 'Operational note'
    },
    caution: {
      icon: AlertCircle,
      bg: 'bg-amber-50 border-amber-200 text-amber-950',
      iconColor: 'text-amber-600',
      defaultTitle: 'Suggestions to improve output'
    },
    ready: {
      icon: CheckCircle2,
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      iconColor: 'text-emerald-600',
      defaultTitle: 'Inputs look great'
    }
  }[type];

  const Icon = config.icon;

  return (
    <div className={cn('flex items-start gap-3 p-3.5 rounded-xl border text-xs leading-relaxed transition-all shadow-2xs', config.bg, className)}>
      <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', config.iconColor)} aria-hidden="true" />
      <div>
        <span className="font-bold block mb-0.5">{title || config.defaultTitle}</span>
        <p className="opacity-90 font-normal">{message}</p>
      </div>
    </div>
  );
};

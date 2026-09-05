import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const toneConfig: Record<Tone, { icon: React.ElementType; wrap: string; iconColor: string; titleColor: string }> = {
  info: { icon: Info, wrap: 'bg-sky-50 border-sky-200', iconColor: 'text-sky-600', titleColor: 'text-sky-900' },
  success: { icon: CheckCircle2, wrap: 'bg-mint border-brand/25', iconColor: 'text-brand', titleColor: 'text-brand-ink' },
  warning: { icon: AlertCircle, wrap: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-600', titleColor: 'text-amber-900' },
  error: { icon: XCircle, wrap: 'bg-signal-soft border-signal/30', iconColor: 'text-signal', titleColor: 'text-signal-deep' },
};

export const Alert: React.FC<AlertProps> = ({ tone = 'info', title, children, className, onDismiss }) => {
  const config = toneConfig[tone];
  const Icon = config.icon;
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed', config.wrap, className)} role="alert">
      <Icon className={cn('w-4 h-4 shrink-0 mt-px', config.iconColor)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className={cn('font-bold mb-0.5', config.titleColor)}>{title}</p>}
        {children && <div className="text-zinc-700">{children}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-zinc-400 hover:text-zinc-700 transition-colors shrink-0" aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  );
};

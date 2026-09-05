import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'mint'
  | 'amber'
  | 'signal'
  | 'ink'
  | 'forest'
  | 'blue';

interface BadgeProps {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  brand: 'bg-brand text-white border-brand',
  mint: 'bg-mint text-brand-deep border-brand/20',
  amber: 'bg-amber-50 text-amber-900 border-amber-200',
  signal: 'bg-signal text-white border-signal',
  ink: 'bg-ink text-white border-ink',
  forest: 'bg-forest text-white border-forest',
  blue: 'bg-sky-50 text-sky-800 border-sky-200',
};

const sizeClasses = {
  sm: 'text-[11px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

/** Small pill used for statuses, decisions and metadata chips. */
export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', size = 'md', icon, children, className }) => (
  <span
    className={cn(
      'inline-flex items-center font-medium rounded-full border whitespace-nowrap select-none',
      toneClasses[tone],
      sizeClasses[size],
      className,
    )}
  >
    {icon}
    {children}
  </span>
);

import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Renders a header row with an icon, title and right-aligned actions. */
  header?: {
    icon?: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: React.ReactNode;
  };
  padded?: boolean;
}

export const Card: React.FC<CardProps> = ({ header, padded = true, className, children, ...rest }) => (
  <div
    className={cn(
      'bg-white border border-zinc-200/90 rounded-2xl shadow-xs overflow-hidden',
      className,
    )}
    {...rest}
  >
    {header && (
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 sm:px-7 pt-5 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-3 min-w-0">
          {header.icon && (
            <div className="w-8 h-8 rounded-lg bg-mint text-brand-deep border border-brand/15 flex items-center justify-center shrink-0">
              {header.icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-[15px] font-extrabold text-ink truncate">{header.title}</h2>
            {header.subtitle && <p className="text-xs text-zinc-500 truncate mt-0.5">{header.subtitle}</p>}
          </div>
        </div>
        {header.actions && <div className="flex items-center gap-2 shrink-0">{header.actions}</div>}
      </div>
    )}
    <div className={cn(padded && 'p-6 sm:p-7')}>{children}</div>
  </div>
);

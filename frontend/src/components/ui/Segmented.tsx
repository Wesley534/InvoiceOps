import React from 'react';
import { cn } from '../../lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  return (
    <div
      className={cn('inline-flex flex-wrap items-center gap-1 p-1 bg-zinc-100/90 border border-zinc-200/70 rounded-xl', className)}
      role="tablist"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all select-none',
              active
                ? 'bg-white text-ink shadow-xs border border-zinc-200/80'
                : 'text-zinc-500 hover:text-zinc-800 border border-transparent',
            )}
          >
            {option.label}
            {typeof option.count === 'number' && (
              <span
                className={cn(
                  'px-1.5 py-px rounded-full text-[10px] font-bold',
                  active ? 'bg-mint text-brand-deep' : 'bg-zinc-200/80 text-zinc-600',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

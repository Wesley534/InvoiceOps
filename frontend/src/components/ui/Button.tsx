import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'ink' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-deep shadow-xs hover:shadow-sm focus-visible:ring-brand/40',
  ink: 'bg-coal text-white hover:bg-black shadow-xs hover:shadow-sm focus-visible:ring-black/30',
  secondary:
    'bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 shadow-2xs focus-visible:ring-zinc-300',
  ghost: 'bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-zinc-300',
  danger: 'bg-signal text-white hover:bg-signal-deep shadow-xs focus-visible:ring-signal/40',
  dangerGhost:
    'bg-signal-soft text-signal-deep border border-signal/30 hover:bg-[#fbe0e1] focus-visible:ring-signal/30',
};

const sizeClasses: Record<Size, string> = {
  xs: 'text-[11px] px-2.5 py-1.5 rounded-lg gap-1.5',
  sm: 'text-xs px-3 py-2 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-sm px-5 py-3 rounded-xl gap-2',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';

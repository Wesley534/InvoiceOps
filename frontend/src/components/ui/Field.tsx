import React from 'react';
import { cn } from '../../lib/utils';

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint/error wrapper shared by every form. */
export const Field: React.FC<FieldProps> = ({ label, hint, error, required, children, className }) => (
  <div className={cn('space-y-1.5', className)}>
    <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
      {label}
      {required && <span className="text-signal ml-0.5">*</span>}
    </label>
    {children}
    {hint && !error && <p className="text-[11px] text-zinc-500 leading-snug">{hint}</p>}
    {error && <p className="text-[11px] font-medium text-signal-deep leading-snug">{error}</p>}
  </div>
);

export const inputClasses = (hasError?: boolean) =>
  cn(
    'w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400',
    'focus:outline-none focus:ring-1 transition-colors',
    hasError
      ? 'border-signal/60 focus:border-signal focus:ring-signal/30'
      : 'border-zinc-300 focus:border-brand focus:ring-brand/25',
  );

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
}

export const TextInput: React.FC<TextInputProps> = ({ error, className, ...rest }) => (
  <input className={cn(inputClasses(Boolean(error)), className)} {...rest} />
);

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string | null;
}

export const TextArea: React.FC<TextAreaProps> = ({ error, className, ...rest }) => (
  <textarea className={cn(inputClasses(Boolean(error)), 'resize-y min-h-20 leading-relaxed', className)} {...rest} />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string | null;
}

export const Select: React.FC<SelectProps> = ({ error, className, children, ...rest }) => (
  <select className={cn(inputClasses(Boolean(error)), 'appearance-none pr-9 cursor-pointer', className)} {...rest}>
    {children}
  </select>
);

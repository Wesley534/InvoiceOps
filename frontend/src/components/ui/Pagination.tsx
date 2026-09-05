import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Page } from '../../lib/types';

interface PaginationProps {
  page: Page<unknown>;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ page, onPageChange, className }) => {
  if (!page || page.total === 0) return null;
  const { page: current, pages, total, size } = page;
  const from = total === 0 ? 0 : (current - 1) * (size || total) + 1;
  const to = Math.min(current * (size || total), total);

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-3 pt-1', className)}>
      <span className="text-[11px] text-zinc-500">
        Showing <span className="font-semibold text-zinc-700">{from}–{to}</span> of{' '}
        <span className="font-semibold text-zinc-700">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(current - 1)}
          disabled={current <= 1}
          className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-3 py-1 text-xs font-semibold text-zinc-700">
          Page {current} of {Math.max(pages, 1)}
        </span>
        <button
          onClick={() => onPageChange(current + 1)}
          disabled={current >= pages}
          className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

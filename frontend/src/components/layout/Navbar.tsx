import React from 'react';
import { Bell, FileUp, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { NAV_ITEMS } from './Sidebar';
import type { NavId } from './Sidebar';
import { cn } from '../../lib/utils';

interface NavbarProps {
  current: NavId | null;
  /** Free-form title for detail screens; falls back to the nav label. */
  contextTitle?: string;
  onNavigate: (id: NavId) => void;
  queueAttention: number;
  onOpenMobileMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  current,
  contextTitle,
  onNavigate,
  queueAttention,
  onOpenMobileMenu,
}) => {
  const { user, signOut } = useAuth();
  const currentLabel =
    contextTitle ??
    NAV_ITEMS.find((item) => item.id === current)?.label ??
    'InvoiceOps';

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs min-w-0">
          <span className="text-zinc-400 font-semibold tracking-tight shrink-0">InvoiceOps</span>
          <span className="text-zinc-300 shrink-0">/</span>
          <span className="text-zinc-900 font-semibold text-sm truncate">{currentLabel}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {queueAttention > 0 && (
          <button
            onClick={() => onNavigate('inbox')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span>{queueAttention} need{queueAttention === 1 ? 's' : ''} review</span>
          </button>
        )}

        {current !== 'upload' && (
          <button
            onClick={() => onNavigate('upload')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand hover:bg-brand-deep text-white shadow-xs transition-all active:scale-[0.98]"
          >
            <FileUp className="w-3.5 h-3.5" />
            Upload invoice
          </button>
        )}

        <span
          className={cn(
            'hidden md:inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide',
            user?.role === 'approver'
              ? 'bg-forest text-white'
              : 'bg-zinc-100 text-zinc-600 border border-zinc-200',
          )}
        >
          {user?.role}
        </span>

        <button
          onClick={signOut}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

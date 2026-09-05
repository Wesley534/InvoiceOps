import React from 'react';
import { FileCheck2, LogOut, X } from 'lucide-react';
import { NAV_ITEMS, initials } from './Sidebar';
import type { NavId } from './Sidebar';
import { cn } from '../../lib/utils';
import { useAuth } from '../../auth/AuthContext';
import type { QueueStats } from '../../lib/types';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  current: NavId | null;
  onNavigate: (id: NavId) => void;
  queueStats: QueueStats;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  current,
  onNavigate,
  queueStats,
}) => {
  const { user, signOut } = useAuth();
  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-forest text-white shadow-2xl flex flex-col p-4 animate-in slide-in-from-left duration-200">
        <div className="flex items-center justify-between mb-6 px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">
              Invoice<span className="text-accent">Ops</span>
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/60 hover:text-white transition-colors" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto" aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-colors',
                  active ? 'bg-white/12 text-white font-semibold' : 'text-white/65 hover:bg-white/8 hover:text-white',
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className={cn('w-4 h-4', active ? 'text-accent' : 'text-white/45')} />
                  {item.label}
                </span>
                {item.id === 'inbox' && queueStats.attention > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-signal text-white">
                    {queueStats.attention}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-white/10 mt-4">
          <div className="flex items-center gap-2.5 p-1">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold shrink-0">
              {initials(user?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-[10px] text-white/50 truncate capitalize">{user?.role}</p>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

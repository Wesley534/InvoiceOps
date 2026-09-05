import React from 'react';
import {
  FileCheck2,
  FileUp,
  Home,
  Inbox,
  Database,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../auth/AuthContext';
import type { QueueStats } from '../../lib/types';

export type NavId = 'dashboard' | 'upload' | 'inbox' | 'masterdata' | 'settings';

interface NavItem {
  id: NavId;
  label: string;
  icon: React.ElementType;
  isHighlight?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: Home },
  { id: 'upload', label: 'New invoice', icon: FileUp, isHighlight: true },
  { id: 'inbox', label: 'Invoices', icon: Inbox },
  { id: 'masterdata', label: 'Master data', icon: Database },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

interface SidebarProps {
  current: NavId | null;
  onNavigate: (id: NavId) => void;
  queueStats: QueueStats;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ current, onNavigate, queueStats, onSignOut }) => {
  const { user } = useAuth();
  const activeCount = queueStats.attention > 0 ? queueStats.attention : undefined;

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 shrink-0 h-screen sticky top-0 bg-forest text-white p-4 select-none z-30">
      <div className="space-y-7">
        {/* Brand */}
        <div
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 px-2 py-1.5 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 group-hover:bg-white/15 transition-colors">
            <FileCheck2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-[15px] tracking-tight text-white leading-none">Invoice</span>
              <span className="font-extrabold text-[15px] tracking-tight text-accent leading-none">Ops</span>
            </div>
            <span className="text-[11px] text-white/55 block leading-tight mt-1">
              Vendor invoice validation
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = current === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-white/12 text-white font-semibold ring-1 ring-white/15 shadow-sm'
                    : 'text-white/65 hover:text-white hover:bg-white/8',
                  item.isHighlight && !isActive && 'mt-2',
                )}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-accent' : 'text-white/45 group-hover:text-white/80')} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'inbox' && activeCount !== undefined && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-signal text-white">
                    {activeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom: governance note + user */}
      <div className="space-y-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs">
          <div className="flex items-center gap-2 text-white font-semibold mb-1">
            <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
            <span className="truncate">Human-in-the-loop</span>
          </div>
          <p className="text-[11px] text-white/55 leading-relaxed">
            Every run ends at an approver decision. Nothing is ever paid automatically.
          </p>
        </div>

        <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" onClick={() => onNavigate('settings')}>
          <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-white block leading-tight truncate">{user?.name}</span>
            <span className="text-[10px] text-white/50 block leading-tight truncate capitalize">{user?.role}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSignOut();
            }}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export { NAV_ITEMS };
export type { NavItem };

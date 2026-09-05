import React from 'react';
import { 
  Home, 
  PlusCircle, 
  Activity, 
  FileCheck2, 
  BarChart3, 
  Settings as SettingsIcon,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  pendingReviewsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  pendingReviewsCount
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'new_task', label: 'New Task', icon: PlusCircle, isHighlight: true },
    { id: 'activity', label: 'Activity', icon: Activity, badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined },
    { id: 'results', label: 'Results', icon: FileCheck2 },
    { id: 'evaluations', label: 'Evaluations', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="hidden lg:flex flex-col justify-between w-64 shrink-0 h-screen sticky top-0 bg-white border-r border-zinc-200/90 p-4 select-none z-30">
      <div className="space-y-6">
        {/* Brand Identity at top of far-left sidebar */}
        <div 
          onClick={() => onNavigate('dashboard')} 
          className="flex items-center gap-3 px-2 py-1.5 cursor-pointer group select-none"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-600 p-0.5 shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center">
            <div className="w-full h-full bg-emerald-600 rounded-[10px] flex items-center justify-center">
              <span className="text-white font-bold text-xs tracking-tight">AX</span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-tight text-zinc-900">Axiom</span>
              <span className="text-emerald-700 font-semibold text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
                OPS
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 block leading-tight">Operational AI OS</span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  isActive
                    ? 'bg-emerald-50/90 text-emerald-800 font-semibold border border-emerald-200/80 shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-colors',
                      isActive ? 'text-emerald-600' : 'text-zinc-400 group-hover:text-zinc-700'
                    )}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Area: Governance Status & User Profile */}
      <div className="space-y-3 pt-4 border-t border-zinc-100">
        <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-800 font-semibold mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">Human-in-the-loop</span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Sensitive actions mandate deliberate human approval.
          </p>
        </div>

        {/* User representation in bottom left */}
        <div 
          onClick={() => onNavigate('settings')}
          className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-zinc-100/70 cursor-pointer transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-xs font-bold text-zinc-700 shrink-0">
            AC
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold text-zinc-900 block leading-tight truncate">Alex Chen</span>
            <span className="text-[10px] text-zinc-500 block leading-tight truncate">Operations Lead</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

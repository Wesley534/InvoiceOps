import React from 'react';
import { Home, PlusCircle, Activity, FileCheck2, BarChart3, Settings as SettingsIcon, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  pendingReviewsCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
  pendingReviewsCount
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'new_task', label: 'New Task', icon: PlusCircle },
    { id: 'activity', label: 'Activity', icon: Activity, badge: pendingReviewsCount > 0 ? pendingReviewsCount : undefined },
    { id: 'results', label: 'Results', icon: FileCheck2 },
    { id: 'evaluations', label: 'Evaluations', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Slide-out Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs"
            onClick={onClose} 
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white border-r border-zinc-200 p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                    AX
                  </div>
                  <div>
                    <span className="font-bold text-sm text-zinc-900 block leading-tight">Axiom Operations</span>
                    <span className="text-[10px] text-zinc-500 block">AI Operations System</span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-6 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200/80'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn('w-5 h-5', isActive ? 'text-emerald-600' : 'text-zinc-400')} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-zinc-100 text-xs text-zinc-400">
              Axiom Operational System v1.0
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar on Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-zinc-200 px-2 py-1.5 flex items-center justify-around select-none">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors relative min-w-[54px]',
                isActive ? 'text-emerald-700 font-bold' : 'text-zinc-500 hover:text-zinc-900'
              )}
            >
              <Icon className={cn('w-5 h-5 mb-0.5', isActive ? 'text-emerald-600' : 'text-zinc-400')} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-emerald-600" />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
};

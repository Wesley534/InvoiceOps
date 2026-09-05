import React from 'react';
import { Plus, Bell, Menu } from 'lucide-react';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  pendingReviewsCount: number;
  onOpenMobileMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  pendingReviewsCount,
  onOpenMobileMenu
}) => {
  const pageTitles: Record<string, string> = {
    dashboard: 'Home Overview',
    new_task: 'Start a Task',
    run_details: 'Workflow Execution',
    activity: 'Activity & Audit Log',
    results: 'Verified Results',
    evaluations: 'Evaluation Benchmarks',
    settings: 'Settings & Preferences'
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-4 sm:px-8 flex items-center justify-between">
      {/* Left brand on mobile / Context on desktop */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Brand Identity */}
        <div 
          onClick={() => onNavigate('dashboard')} 
          className="lg:hidden flex items-center gap-2 cursor-pointer group select-none"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
            AX
          </div>
          <span className="font-bold text-sm text-zinc-900">Axiom</span>
        </div>

        {/* Desktop Page Context Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <span className="text-zinc-400 font-medium">Axiom</span>
          <span className="text-zinc-300">/</span>
          <span className="text-zinc-900 font-semibold text-sm">{pageTitles[currentPage] || 'Operations'}</span>
        </div>

        {/* Operational status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 ml-4 pl-4 border-l border-zinc-200 text-xs text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System operational & ready</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Pending approvals alert badge */}
        {pendingReviewsCount > 0 && (
          <button
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-colors"
            title="Tasks waiting for your review"
          >
            <Bell className="w-3.5 h-3.5 text-emerald-600" />
            <span>{pendingReviewsCount} needs review</span>
          </button>
        )}

        {/* Primary Start CTA */}
        {currentPage !== 'new_task' && (
          <button
            onClick={() => onNavigate('new_task')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Start a task</span>
          </button>
        )}
      </div>
    </header>
  );
};

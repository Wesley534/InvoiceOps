import React, { useState } from 'react';
import { 
  Search, 
  Calendar,
  FileText,
  Plus,
  ArrowRight
} from 'lucide-react';
import { TaskRun } from '../types';
import { StatusBadge } from '../components/workflow/StatusBadge';
import { cn } from '../lib/utils';

interface HistoryProps {
  runs: TaskRun[];
  onOpenTask: (taskId: string) => void;
  onNewTask: () => void;
}

export const History: React.FC<HistoryProps> = ({
  runs,
  onOpenTask,
  onNewTask
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'needs_review' | 'failed'>('all');

  const filteredRuns = runs.filter((run) => {
    // Search query match
    const matchesSearch = 
      run.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.id.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter match
    let matchesStatus = true;
    if (statusFilter === 'completed') {
      matchesStatus = run.status === 'completed';
    } else if (statusFilter === 'needs_review') {
      matchesStatus = run.status === 'needs_review' || (run.requiresApproval && run.approvalStatus === 'pending');
    } else if (statusFilter === 'failed') {
      matchesStatus = run.status === 'failed' || run.status === 'partial_success';
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Activity & History
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            Audit trail of all tasks executed, human reviews requested, and completed outputs.
          </p>
        </div>

        <button
          onClick={onNewTask}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Start a task</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by task name, keyword, or ID..."
            className="w-full bg-white border border-zinc-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none transition-colors"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 border border-zinc-200 rounded-xl overflow-x-auto text-xs">
          {(['all', 'completed', 'needs_review', 'failed'] as const).map((filter) => {
            const labels = {
              all: 'All Runs',
              completed: 'Completed',
              needs_review: 'Needs Review',
              failed: 'Failed / Partial'
            };
            const isActive = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  'px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-white text-emerald-800 font-semibold shadow-xs border border-emerald-200/60'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Runs Table / Cards List */}
      {filteredRuns.length > 0 ? (
        <div className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-xs divide-y divide-zinc-100">
          {filteredRuns.map((run) => (
            <div
              key={run.id}
              onClick={() => onOpenTask(run.id)}
              className="p-5 hover:bg-zinc-50/80 cursor-pointer transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 group"
            >
              {/* Left Details */}
              <div className="space-y-1.5 min-w-0 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-zinc-500 text-[11px]">{run.id}</span>
                  <span className="text-zinc-300">•</span>
                  <span className="text-zinc-500">{run.category}</span>
                  <span className="text-zinc-300">•</span>
                  <span className="text-zinc-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-400" />
                    {run.createdAt}
                  </span>
                </div>

                <h3 className="text-base font-bold text-zinc-900 group-hover:text-emerald-800 transition-colors">
                  {run.title}
                </h3>

                <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
                  {run.resultSummary || run.description}
                </p>

                {/* Human Governance tag */}
                <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-500">
                  <span>Governance:</span>
                  <span className="text-zinc-800 font-semibold">
                    {run.humanInvolvementText}
                  </span>
                </div>
              </div>

              {/* Right Metadata & Action */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-100">
                <div className="flex flex-col items-start sm:items-end text-xs">
                  <span className="text-zinc-400">Duration</span>
                  <span className="font-bold text-zinc-800 mt-0.5">
                    {run.actualDuration || run.estimatedDuration}
                  </span>
                </div>

                <StatusBadge status={run.status} size="md" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTask(run.id);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 transition-colors ml-auto sm:ml-0"
                >
                  <span>Open</span>
                  <ArrowRight className="w-3 h-3 text-zinc-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-zinc-200 bg-white p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">No tasks found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            {searchQuery
              ? `No runs matched your query "${searchQuery}". Try clearing search filters.`
              : 'Start your first task and your completed work and audit logs will appear here.'}
          </p>
          <button
            onClick={onNewTask}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Start a task</span>
          </button>
        </div>
      )}
    </div>
  );
};

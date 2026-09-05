import React from 'react';
import { 
  Plus, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  Play, 
  FileCheck2, 
  ChevronRight, 
  Eye 
} from 'lucide-react';
import { TaskRun } from '../types';
import { StatusBadge } from '../components/workflow/StatusBadge';
import { DEMO_TEMPLATES, IMPACT_STATS } from '../data/mockData';
import { cn } from '../lib/utils';

interface DashboardProps {
  runs: TaskRun[];
  onStartTask: () => void;
  onOpenTask: (taskId: string) => void;
  onTryExample: (templateId: string) => void;
  onNavigate: (page: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  runs,
  onStartTask,
  onOpenTask,
  onTryExample,
  onNavigate
}) => {
  const needsAttentionTasks = runs.filter((r) => r.status === 'needs_review' || r.requiresApproval && r.approvalStatus === 'pending');
  const runningTasks = runs.filter((r) => r.status === 'running');
  const recentRuns = runs.slice(0, 6);

  return (
    <div className="space-y-10 pb-16">
      {/* Top Greeting & Primary CTA Section */}
      <section className="relative rounded-3xl bg-white border border-zinc-200/90 p-6 sm:p-10 shadow-xs overflow-hidden">
        {/* Subtle decorative green ambient glow in corner */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50/80 rounded-full blur-3xl pointer-events-none -z-0" />

        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>AI Operations System</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
            Good morning, Alex.
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 mt-2 font-normal">
            Ready to get some work done?
          </p>

          <p className="text-sm text-zinc-600 mt-3 leading-relaxed max-w-xl">
            Give the system a task. It handles the repetitive work, shows you exactly what it did, asks for approval when needed, and produces clear, reliable results.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-7">
            <button
              onClick={onStartTask}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Start a task</span>
            </button>

            <button
              onClick={() => onTryExample('demo-campaign')}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold bg-zinc-100 hover:bg-zinc-200/80 text-zinc-800 border border-zinc-200/80 transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              <span>Try an example</span>
            </button>
          </div>
        </div>

        {/* Quick Example Scenarios Bar */}
        <div className="mt-8 pt-6 border-t border-zinc-100 relative z-10">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-3">
            One-click interactive demo scenarios:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEMO_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => onTryExample(tpl.id)}
                className="text-left p-3.5 rounded-xl bg-zinc-50/80 hover:bg-emerald-50/40 border border-zinc-200 hover:border-emerald-300 transition-all group shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-zinc-900 group-hover:text-emerald-800 transition-colors">
                    {tpl.title}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                </div>
                <span className="text-[11px] text-zinc-500 block leading-tight">
                  {tpl.tagline}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Currently Running Tasks (if any) */}
      {runningTasks.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
            <h2 className="text-base font-bold text-zinc-900">Currently Running</h2>
          </div>

          <div className="space-y-3">
            {runningTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onOpenTask(task.id)}
                className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 hover:bg-emerald-50 cursor-pointer transition-all shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-zinc-900 truncate">{task.title}</h4>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      {task.steps[task.currentStepIndex]?.statusMessage || 'Processing workflow...'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-zinc-500 hidden sm:inline">{task.estimatedDuration}</span>
                  <button className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-2xs">
                    View progress
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section: Needs your attention */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Needs your attention</h2>
              <p className="text-xs text-zinc-500">
                Tasks paused at human governance checkpoints waiting for your decision
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800">
            {needsAttentionTasks.length} {needsAttentionTasks.length === 1 ? 'task waiting' : 'tasks waiting'}
          </span>
        </div>

        {needsAttentionTasks.length > 0 ? (
          <div className="space-y-3">
            {needsAttentionTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white border-2 border-emerald-600/30 hover:border-emerald-600/60 transition-all shadow-xs group"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Waiting for your approval
                    </span>
                    <span className="text-zinc-300">•</span>
                    <span className="text-xs text-zinc-500">{task.createdAt}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-zinc-900 group-hover:text-emerald-800 transition-colors">
                    {task.title}
                  </h3>
                  <p className="text-xs text-zinc-600 leading-relaxed line-clamp-1">
                    {task.confidenceReason || task.description}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0">
                  <StatusBadge status={task.status} size="sm" />
                  <button
                    onClick={() => onOpenTask(task.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-[0.98]"
                  >
                    <span>Review</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-xs text-zinc-500 shadow-2xs">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <p className="font-bold text-zinc-900">All caught up!</p>
            <p className="mt-0.5">No tasks currently require your approval.</p>
          </div>
        )}
      </section>

      {/* Section: Impact (Simple Business Metrics) */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Impact & Productivity
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
              <span className="font-medium">Tasks completed</span>
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
              {IMPACT_STATS.tasksCompleted}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Across finance, marketing, and ops</p>
          </div>

          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
              <span className="font-medium">Time saved</span>
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
              {IMPACT_STATS.timeSavedHours} hrs
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">~30 mins saved per routine task</p>
          </div>

          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
              <span className="font-medium">Success rate</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-700">
              {IMPACT_STATS.successRatePercent}%
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">First-pass accuracy</p>
          </div>

          <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-2">
              <span className="font-medium">Manual reviews</span>
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-zinc-900">
              {IMPACT_STATS.manualReviewsPercent}%
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">Human gates triggered safely</p>
          </div>
        </div>
      </section>

      {/* Section: Recent Activity */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900">Recent Activity</h2>
          <button
            onClick={() => onNavigate('activity')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
          >
            <span>View all runs</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-xs divide-y divide-zinc-100">
          {recentRuns.map((task) => (
            <div
              key={task.id}
              onClick={() => onOpenTask(task.id)}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/80 cursor-pointer transition-colors group"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-900 group-hover:text-emerald-800 transition-colors truncate max-w-[280px] sm:max-w-md">
                    {task.title}
                  </span>
                  <span className="text-zinc-300 hidden sm:inline">•</span>
                  <span className="text-xs text-zinc-500 hidden sm:inline">{task.category}</span>
                </div>

                <p className="text-xs text-zinc-600 truncate max-w-xl">
                  {task.resultSummary || task.description}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-zinc-400 sm:hidden">
                  <span>{task.createdAt}</span>
                  <span>•</span>
                  <span>{task.actualDuration || task.estimatedDuration}</span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0">
                <span className="text-xs text-zinc-400 hidden sm:inline">
                  {task.createdAt}
                </span>

                <StatusBadge status={task.status} size="sm" />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTask(task.id);
                  }}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                  title="Inspect run"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

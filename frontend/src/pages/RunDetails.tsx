import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Clock, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  ShieldAlert, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { TaskRun } from '../types';
import { StatusBadge } from '../components/workflow/StatusBadge';
import { ProgressTracker } from '../components/workflow/ProgressTracker';
import { ApprovalCard } from '../components/approval/ApprovalCard';
import { ManualEditModal } from '../components/approval/ManualEditModal';
import { ResultViewer } from '../components/results/ResultViewer';
import { SystemActionsSummary } from '../components/results/SystemActionsSummary';
import { SourcesPanel } from '../components/results/SourcesPanel';
import { ExplainabilitySection } from '../components/results/ExplainabilitySection';

interface RunDetailsProps {
  task: TaskRun;
  onBack: () => void;
  onApproveTask: (taskId: string, note?: string) => void;
  onRequestChanges: (taskId: string, feedback: string) => void;
  onRejectTask: (taskId: string, reason: string) => void;
  onUpdateTaskResult: (taskId: string, newTitle: string, newContent: string) => void;
  onRunAgain: () => void;
  onRetryStep: (taskId: string) => void;
}

export const RunDetails: React.FC<RunDetailsProps> = ({
  task,
  onBack,
  onApproveTask,
  onRequestChanges,
  onRejectTask,
  onUpdateTaskResult,
  onRunAgain,
  onRetryStep
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const isCompleted = task.status === 'completed';
  const isNeedsReview = task.status === 'needs_review' || (task.requiresApproval && task.approvalStatus === 'pending');
  const isRunning = task.status === 'running';
  const isPartial = task.status === 'partial_success';
  const isFailed = task.status === 'failed';

  return (
    <div className="space-y-8 pb-16">
      {/* Header breadcrumb & navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 border border-zinc-200 transition-colors shadow-2xs"
            title="Back to previous screen"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mb-0.5">
              <span>Task Details</span>
              <ChevronRight className="w-3 h-3 text-zinc-300" />
              <span className="font-mono text-zinc-500">{task.id}</span>
              <span className="text-zinc-300">•</span>
              <span>{task.category}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 truncate max-w-xl">
              {task.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <StatusBadge status={task.status} size="lg" />
        </div>
      </div>

      {/* 1. If currently RUNNING -> Show large ProgressTracker */}
      {isRunning && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 text-center max-w-xl mx-auto space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900">
              {task.steps[task.currentStepIndex]?.statusMessage || 'System is processing your task...'}
            </h2>
            <p className="text-xs text-zinc-600 max-w-md mx-auto leading-relaxed">
              Analyzing files and applying operational cross-checks. You can leave this page; your task will continue running safely.
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <ProgressTracker
              steps={task.steps}
              currentStepIndex={task.currentStepIndex}
            />
          </div>
        </div>
      )}

      {/* 2. If NEEDS REVIEW -> Show Approval Gate Card prominently */}
      {isNeedsReview && (
        <div className="space-y-8">
          <ApprovalCard
            task={task}
            onApprove={(note) => onApproveTask(task.id, note)}
            onRequestChanges={(feedback) => onRequestChanges(task.id, feedback)}
            onEditManually={() => setIsEditModalOpen(true)}
            onReject={(reason) => onRejectTask(task.id, reason)}
          />

          {/* Sources and Explainability below approval card */}
          <div className="space-y-6 pt-2">
            <ExplainabilitySection explainability={task.explainability} />
            {task.sources && task.sources.length > 0 && (
              <SourcesPanel sources={task.sources} />
            )}
            <ProgressTracker
              steps={task.steps}
              currentStepIndex={task.currentStepIndex}
            />
          </div>
        </div>
      )}

      {/* 3. If COMPLETED or PARTIAL or FAILED -> Show ResultViewer & Evidence */}
      {(isCompleted || isPartial || isFailed) && !isNeedsReview && (
        <div className="space-y-8">
          <ResultViewer
            task={task}
            onEdit={() => setIsEditModalOpen(true)}
            onRunAgain={onRunAgain}
            onRetryStep={() => onRetryStep(task.id)}
          />

          <SystemActionsSummary
            actions={task.systemActions}
            humanInvolvementText={task.humanInvolvementText}
          />

          <ExplainabilitySection explainability={task.explainability} />

          {task.sources && task.sources.length > 0 && (
            <SourcesPanel sources={task.sources} />
          )}

          <div className="pt-2">
            <ProgressTracker
              steps={task.steps}
              currentStepIndex={task.currentStepIndex}
            />
          </div>
        </div>
      )}

      {/* Manual Edit Modal */}
      <ManualEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialTitle={task.resultTitle || task.title}
        initialContent={task.resultContent || task.resultSummary || ''}
        onSave={(newTitle, newContent) => {
          onUpdateTaskResult(task.id, newTitle, newContent);
        }}
      />
    </div>
  );
};

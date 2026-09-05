import React, { useState } from 'react';
import { 
  Check, 
  Edit3, 
  MessageSquare, 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { TaskRun } from '../../types';
import { StatusBadge } from '../workflow/StatusBadge';
import { ConfidenceIndicator } from '../workflow/ConfidenceIndicator';
import { cn } from '../../lib/utils';

interface ApprovalCardProps {
  task: TaskRun;
  onApprove: (note?: string) => void;
  onRequestChanges: (feedback: string) => void;
  onEditManually: () => void;
  onReject: (reason: string) => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  task,
  onApprove,
  onRequestChanges,
  onEditManually,
  onReject
}) => {
  const [feedback, setFeedback] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);

  const handleApprove = () => {
    onApprove('Approved by Alex Chen (Operations Lead)');
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    onRequestChanges(feedback);
    setFeedback('');
    setShowFeedbackInput(false);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    onReject(rejectReason);
    setRejectReason('');
    setShowRejectInput(false);
  };

  return (
    <div className="rounded-2xl border-2 border-emerald-600/30 bg-white p-6 sm:p-8 shadow-xs space-y-6">
      {/* Header with human-in-the-loop warning badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
            <span>Human Review Gate</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 mt-1">
            Your draft is ready. Please review before we continue.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600">
            The system completed the initial pass and paused for your authorization.
          </p>
        </div>

        <StatusBadge status="needs_review" size="lg" />
      </div>

      {/* External Action Warning (if external commit is involved) */}
      {task.externalActionWarning && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-xs sm:text-sm text-amber-950 space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Before we continue:</span>
          </div>
          <p className="text-amber-900/90 pl-6 leading-relaxed">
            {task.externalActionWarning}
          </p>
        </div>
      )}

      {/* Important Findings & Discrepancies */}
      {task.approvalWarning && (
        <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-800 space-y-1">
          <span className="font-bold text-zinc-900 uppercase tracking-wider block text-[11px]">
            Key finding requiring your sign-off:
          </span>
          <p className="leading-relaxed">{task.approvalWarning}</p>
        </div>
      )}

      {/* Draft Result Summary & Preview */}
      <div className="rounded-xl bg-zinc-50/80 border border-zinc-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            Draft Result
          </span>
          <button
            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>{isDetailsExpanded ? 'Collapse draft' : 'Expand full draft'}</span>
            {isDetailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <h4 className="text-base font-bold text-zinc-900">
          {task.resultTitle || task.title}
        </h4>

        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed font-normal">
          {task.resultSummary}
        </p>

        {isDetailsExpanded && task.resultContent && (
          <div className="mt-3 pt-3 border-t border-zinc-200 text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed bg-white p-4 rounded-lg border border-zinc-200/80">
            {task.resultContent}
          </div>
        )}
      </div>

      {/* Confidence Indicator */}
      <div className="pt-2">
        <ConfidenceIndicator
          level={task.confidence}
          reason={task.confidenceReason}
        />
      </div>

      {/* Interactive Action Bar */}
      <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Primary CTA in vivid green */}
          <button
            onClick={handleApprove}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Approve and continue</span>
          </button>

          <button
            onClick={() => {
              setShowFeedbackInput(!showFeedbackInput);
              setShowRejectInput(false);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-zinc-500" />
            <span>Request changes</span>
          </button>

          <button
            onClick={onEditManually}
            className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 transition-colors"
          >
            <Edit3 className="w-4 h-4 text-zinc-500" />
            <span>Edit manually</span>
          </button>
        </div>

        <button
          onClick={() => {
            setShowRejectInput(!showRejectInput);
            setShowFeedbackInput(false);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors ml-auto sm:ml-0"
        >
          <X className="w-3.5 h-3.5" />
          <span>Stop / Reject</span>
        </button>
      </div>

      {/* Feedback input drawer */}
      {showFeedbackInput && (
        <form onSubmit={handleSendFeedback} className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
          <label className="block text-xs font-semibold text-zinc-800">
            What should the system adjust?
          </label>
          <textarea
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Please recalculate with a 5% expedited fee discount instead, or adjust tone to be more executive..."
            className="w-full bg-white border border-zinc-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 rounded-lg p-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowFeedbackInput(false)}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white rounded-lg shadow-xs"
            >
              Submit changes
            </button>
          </div>
        </form>
      )}

      {/* Rejection input drawer */}
      {showRejectInput && (
        <form onSubmit={handleConfirmReject} className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 space-y-3">
          <label className="block text-xs font-semibold text-rose-900">
            Reason for rejecting this task:
          </label>
          <textarea
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Vendor unapproved, or PO already closed in ERP..."
            className="w-full bg-white border border-rose-300 focus:border-rose-500 rounded-lg p-3 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none"
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRejectInput(false)}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white rounded-lg"
            >
              Confirm Rejection
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

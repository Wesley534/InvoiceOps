import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Download, 
  Share2, 
  Edit3, 
  RotateCcw, 
  FileText,
  AlertTriangle,
  RefreshCw,
  Printer
} from 'lucide-react';
import { TaskRun } from '../../types';
import { StatusBadge } from '../workflow/StatusBadge';
import { ConfidenceIndicator } from '../workflow/ConfidenceIndicator';
import { cn } from '../../lib/utils';

interface ResultViewerProps {
  task: TaskRun;
  onEdit: () => void;
  onRunAgain: () => void;
  onRetryStep?: () => void;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({
  task,
  onEdit,
  onRunAgain,
  onRetryStep
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyText = () => {
    const textToCopy = `${task.resultTitle || task.title}\n\n${task.resultSummary || ''}\n\n${task.resultContent || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPartialOrFailed = task.status === 'partial_success' || task.status === 'failed';

  return (
    <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
      {/* Top Banner & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              {task.category}
            </span>
            <span className="text-zinc-300">•</span>
            <span className="text-xs text-zinc-400">Completed in {task.actualDuration || task.estimatedDuration}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            {task.resultTitle || task.title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={task.status} size="lg" />
        </div>
      </div>

      {/* Recoverable Partial Warning or Service Lag Alert */}
      {isPartialOrFailed && task.errorReason && (
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs sm:text-sm text-amber-950">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Operational Note</span>
          </div>
          <p className="text-amber-900/90 leading-relaxed font-normal">{task.errorReason}</p>
          {task.errorRecoveryAdvice && (
            <p className="text-emerald-800 font-medium pt-1">{task.errorRecoveryAdvice}</p>
          )}

          {task.canRetryVerification && onRetryStep && (
            <div className="pt-2">
              <button
                onClick={onRetryStep}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white rounded-lg shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry verification step</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Executive Summary Paragraph */}
      <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 text-sm text-zinc-800 leading-relaxed">
        <span className="font-bold text-zinc-900 block mb-1">Executive Summary:</span>
        {task.resultSummary}
      </div>

      {/* Structured Result Items / Metrics Grid */}
      {task.resultItems && task.resultItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {task.resultItems.map((item, idx) => (
            <div
              key={idx}
              className="bg-zinc-50/80 border border-zinc-200/80 rounded-xl p-4 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-medium">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-base font-bold text-zinc-900">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Result Content Body */}
      {task.resultContent && (
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Synthesized Findings & Output
          </span>
          <div className="bg-white border border-zinc-200/90 rounded-xl p-5 text-xs sm:text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
            {task.resultContent}
          </div>
        </div>
      )}

      {/* Confidence Indicator in result view */}
      <div className="pt-2">
        <ConfidenceIndicator
          level={task.confidence}
          reason={task.confidenceReason}
        />
      </div>

      {/* Bottom Action Toolbar */}
      <div className="pt-5 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyText}
            className={cn(
              'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all',
              copied
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
            )}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
            <span>{copied ? 'Copied to clipboard!' : 'Copy text'}</span>
          </button>

          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5 text-zinc-500" />
            <span>Edit text</span>
          </button>

          <button
            onClick={() => window.print()}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-zinc-500" />
            <span>Print report</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRunAgain}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
            <span>Run again</span>
          </button>

          <button
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <span>Use this result</span>
          </button>
        </div>
      </div>
    </div>
  );
};

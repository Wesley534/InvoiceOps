import React from 'react';
import { Check, Clock, XCircle, AlertTriangle, FileText } from 'lucide-react';
import { JOB_STAGES } from '../../lib/constants';
import { cn } from '../../lib/utils';
import type { Job } from '../../lib/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

interface JobProgressProps {
  job: Job | null;
  filename?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

const STAGE_ORDER = JOB_STAGES.map((step) => step.stage);
const STATUS_TEXT: Record<string, string> = {
  intake: 'Checking the file and preparing a safe workspace…',
  extracting: 'Reading fields, line items and amounts from the invoice…',
  validating: 'Running the 11 deterministic checks against master data…',
  classifying: 'Weighing every check into a recommendation…',
  reporting: 'Assembling the evidence package for your review…',
  done: 'Report ready — opening it now.',
};

export const JobProgress: React.FC<JobProgressProps> = ({ job, filename, onRetry, retrying }) => {
  if (!job) {
    return (
      <Card className="text-center">
        <p className="text-sm text-zinc-500">Locating the job…</p>
      </Card>
    );
  }

  const failed = job.status === 'FAILED';
  const queued = job.status === 'QUEUED';
  const currentIndex = job.status === 'SUCCEEDED' ? STAGE_ORDER.length : Math.max(0, STAGE_ORDER.indexOf(job.stage));

  const currentHint =
    job.stage === 'queued' && queued
      ? 'Waiting for a worker to pick the job up…'
      : STATUS_TEXT[job.stage] ?? JOB_STAGES[Math.min(currentIndex, STAGE_ORDER.length - 1)]?.hint;

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div
        className={cn(
          'rounded-2xl border p-5 sm:p-6 flex items-start gap-4',
          failed
            ? 'bg-signal-soft border-signal/30'
            : 'bg-forest text-white border-forest',
        )}
      >
        <div className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', failed ? 'bg-white/80 text-signal' : 'bg-white/10 text-accent')}>
          {failed ? <XCircle className="w-6 h-6" /> : queued ? <Clock className="w-6 h-6 animate-pulse" /> : <Clock className="w-6 h-6 animate-spin" />}
        </div>
        <div className="min-w-0 flex-1">
          {filename && (
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider opacity-70 mb-1">
              <FileText className="w-3 h-3" />
              <span className="truncate">{filename}</span>
            </p>
          )}
          <h2 className="text-base sm:text-lg font-bold leading-snug">
            {failed ? 'The run failed' : queued ? 'Queued' : 'Validating your invoice…'}
          </h2>
          <p className={cn('text-sm leading-relaxed mt-1', failed ? 'text-signal-deep' : 'text-white/70')}>
            {failed ? job.error ?? 'The job stopped unexpectedly.' : currentHint}
          </p>
        </div>
        <div className="shrink-0 hidden sm:block">
          {!failed && (
            <span className="text-2xl font-bold font-mono tabular-nums">{job.progress_pct}%</span>
          )}
        </div>
      </div>

      {/* Progress bar + steps */}
      {!failed && (
        <Card>
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
              <span className="font-semibold text-zinc-700">
                {job.status === 'SUCCEEDED' ? 'Completed' : 'Pipeline progress'}
              </span>
              <span className="font-mono">{job.progress_pct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-all duration-700 ease-out"
                style={{ width: `${job.progress_pct}%` }}
              />
            </div>
          </div>

          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {JOB_STAGES.map((step, index) => {
              const done = index < currentIndex || job.status === 'SUCCEEDED';
              const active = index === currentIndex && job.status !== 'SUCCEEDED';
              return (
                <li
                  key={step.stage}
                  className={cn(
                    'rounded-xl border p-3 flex items-start gap-2.5 text-left',
                    done
                      ? 'bg-mint/70 border-brand/20'
                      : active
                        ? 'bg-forest border-forest text-white'
                        : 'bg-zinc-50/70 border-zinc-100 text-zinc-400',
                  )}
                >
                  <span
                    className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-px',
                      done
                        ? 'bg-brand text-white'
                        : active
                          ? 'bg-white/10 text-accent'
                          : 'bg-zinc-200 text-zinc-500',
                    )}
                  >
                    {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : active ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                  </span>
                  <span className="min-w-0">
                    <span className={cn('block text-xs font-bold', active ? 'text-white' : done ? 'text-brand-ink' : 'text-zinc-500')}>
                      {step.label}
                    </span>
                    <span className={cn('block text-[11px] leading-snug mt-0.5', active ? 'text-white/60' : done ? 'text-zinc-500' : 'hidden')}>
                      {done && !active ? 'Done' : step.hint}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {failed && onRetry && (
        <div className="flex flex-wrap items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-signal" />
          <p className="text-xs text-zinc-600 flex-1">
            The PDF is still stored — you can re-run the pipeline without re-uploading.
          </p>
          <Button onClick={onRetry} loading={retrying} variant="ink">
            Retry run
          </Button>
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { 
  Check, 
  Clock, 
  AlertCircle, 
  Circle,
  HelpCircle
} from 'lucide-react';
import { WorkflowStep } from '../../types';
import { cn } from '../../lib/utils';

interface ProgressTrackerProps {
  steps: WorkflowStep[];
  currentStepIndex: number;
  className?: string;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  steps,
  currentStepIndex,
  className
}) => {
  const activeStep = steps[currentStepIndex] || steps[steps.length - 1];

  return (
    <div className={cn('bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-6', className)}>
      {/* Top Header: Current active status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-100">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Workflow Progress
          </span>
          <h3 className="text-base font-bold text-zinc-900 mt-0.5">
            {activeStep ? activeStep.name : 'Executing workflow...'}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500">
            Step {Math.min(currentStepIndex + 1, steps.length)} of {steps.length}
          </span>
          <div className="w-24 h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
              style={{
                width: `${Math.round(((currentStepIndex + 1) / steps.length) * 100)}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Live Status Message Banner */}
      {activeStep && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-950">
          <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 animate-spin" />
          <div>
            <span className="font-semibold text-emerald-900 block mb-0.5">What the system is doing right now:</span>
            <p className="text-emerald-800 leading-relaxed font-normal">{activeStep.statusMessage}</p>
          </div>
        </div>
      )}

      {/* Horizontal Steps Bar */}
      <div className="relative pt-2 pb-1">
        <div className="grid grid-cols-5 gap-2 relative">
          {steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isInProgress = step.status === 'in_progress';
            const isWarning = step.status === 'warning';
            const isPending = step.status === 'pending';

            return (
              <div key={step.id} className="flex flex-col items-center text-center relative group">
                {/* Connecting bar between steps */}
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      'absolute top-4 left-1/2 w-full h-0.5 -z-0 transition-colors',
                      idx < currentStepIndex ? 'bg-emerald-500' : 'bg-zinc-200'
                    )}
                  />
                )}

                {/* Node icon circle */}
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all z-10',
                    isCompleted
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700'
                      : isInProgress
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-700 ring-4 ring-emerald-100 animate-pulse'
                      : isWarning
                      ? 'bg-amber-50 border-amber-500 text-amber-800 ring-4 ring-amber-100'
                      : 'bg-white border-zinc-300 text-zinc-400'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                  ) : isInProgress ? (
                    <Clock className="w-4 h-4 text-emerald-600 animate-spin" />
                  ) : isWarning ? (
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Label below node */}
                <div className="mt-2.5 max-w-[90px]">
                  <span
                    className={cn(
                      'text-[11px] font-medium block leading-tight truncate',
                      isInProgress || isCompleted ? 'text-zinc-900 font-semibold' : 'text-zinc-400'
                    )}
                  >
                    {step.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

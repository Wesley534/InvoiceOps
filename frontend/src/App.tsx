import React, { useState, useEffect } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { Dashboard } from './pages/Dashboard';
import { NewRun } from './pages/NewRun';
import { RunDetails } from './pages/RunDetails';
import { History } from './pages/History';
import { Evaluations } from './pages/Evaluations';
import { Settings } from './pages/Settings';
import { INITIAL_RUNS } from './data/mockData';
import { TaskRun } from './types';
import confetti from 'canvas-confetti';

export default function App() {
  const [runs, setRuns] = useState<TaskRun[]>(INITIAL_RUNS);
  const [currentPage, setCurrentPage] = useState<string>('dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [prefillTemplateId, setPrefillTemplateId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Count tasks needing attention
  const pendingReviewsCount = runs.filter(
    (r) => r.status === 'needs_review' || (r.requiresApproval && r.approvalStatus === 'pending')
  ).length;

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setCurrentPage('run_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTryExample = (templateId: string) => {
    setPrefillTemplateId(templateId);
    setCurrentPage('new_task');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Launch a new workflow with step-by-step progress simulation
  const handleStartWorkflow = (newTask: TaskRun) => {
    setRuns((prev) => [newTask, ...prev]);
    setSelectedTaskId(newTask.id);
    setCurrentPage('run_details');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Simulate realistic step progression
    const totalSteps = newTask.steps.length;
    let stepIndex = 0;

    const interval = setInterval(() => {
      stepIndex++;
      if (stepIndex < totalSteps) {
        setRuns((prev) =>
          prev.map((r) => {
            if (r.id !== newTask.id) return r;
            const updatedSteps = [...r.steps];
            // Mark previous step completed
            if (updatedSteps[stepIndex - 1]) {
              updatedSteps[stepIndex - 1] = {
                ...updatedSteps[stepIndex - 1],
                status: 'completed'
              };
            }
            // Mark current step in progress
            if (updatedSteps[stepIndex]) {
              updatedSteps[stepIndex] = {
                ...updatedSteps[stepIndex],
                status: 'in_progress'
              };
            }
            return {
              ...r,
              steps: updatedSteps,
              currentStepIndex: stepIndex
            };
          })
        );
      } else {
        clearInterval(interval);
        // Completed all steps or pause at approval gate
        setRuns((prev) =>
          prev.map((r) => {
            if (r.id !== newTask.id) return r;
            const finalSteps = r.steps.map((s, idx) => ({
              ...s,
              status: (r.requiresApproval && idx === r.steps.length - 1)
                ? ('warning' as const)
                : ('completed' as const)
            }));

            const finalStatus = r.requiresApproval ? 'needs_review' : 'completed';

            if (finalStatus === 'completed') {
              try {
                confetti({
                  particleCount: 70,
                  spread: 70,
                  origin: { y: 0.6 }
                });
              } catch {}
            }

            return {
              ...r,
              steps: finalSteps,
              status: finalStatus,
              completedAt: finalStatus === 'completed' ? 'Just now' : undefined,
              actualDuration: '1m 15s'
            };
          })
        );
      }
    }, 1400);
  };

  // Human approval handler
  const handleApproveTask = (taskId: string, note?: string) => {
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id !== taskId) return r;
        return {
          ...r,
          status: 'completed',
          requiresApproval: false,
          approvalStatus: 'approved',
          approvalDecisionNote: note || 'Approved by operator',
          completedAt: 'Just now',
          confidence: 'high',
          systemActions: [
            ...r.systemActions,
            {
              title: 'Human review authorized',
              description: `Approved by Alex Chen (${note || 'Standard sign-off'}). Results dispatched.`
            }
          ],
          humanInvolvementText: 'Approved by human operator',
          steps: r.steps.map((s) => ({ ...s, status: 'completed' }))
        };
      })
    );
  };

  // Request changes handler
  const handleRequestChanges = (taskId: string, feedback: string) => {
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id !== taskId) return r;
        return {
          ...r,
          resultContent: `${r.resultContent}\n\n### Revision Applied\n- **Requested Change**: "${feedback}"\n- **System Adjustment**: Adjusted calculations and updated delivery schedule based on your feedback.`,
          systemActions: [
            ...r.systemActions,
            {
              title: 'Incorporated feedback',
              description: `Revised output based on instructions: "${feedback.slice(0, 40)}..."`
            }
          ]
        };
      })
    );
  };

  // Rejection handler
  const handleRejectTask = (taskId: string, reason: string) => {
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id !== taskId) return r;
        return {
          ...r,
          status: 'failed',
          approvalStatus: 'rejected',
          requiresApproval: false,
          errorReason: `Task cancelled by human operator. Reason: ${reason}`,
          humanInvolvementText: 'Terminated by human operator',
          systemActions: [
            ...r.systemActions,
            {
              title: 'Execution halted',
              description: `Operator rejected action: "${reason}"`
            }
          ]
        };
      })
    );
  };

  // Update task result from manual edit
  const handleUpdateTaskResult = (taskId: string, newTitle: string, newContent: string) => {
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id !== taskId) return r;
        return {
          ...r,
          resultTitle: newTitle,
          resultContent: newContent,
          systemActions: [
            ...r.systemActions,
            {
              title: 'Manual edits saved',
              description: 'Operator adjusted the generated text directly.'
            }
          ]
        };
      })
    );
  };

  // Retry verification on recoverable step error (Demo 3)
  const handleRetryStep = (taskId: string) => {
    setRuns((prev) =>
      prev.map((r) => {
        if (r.id !== taskId) return r;
        const fixedSteps = r.steps.map((s) => ({
          ...s,
          status: 'completed' as const,
          statusMessage: s.statusMessage.replace('could not reach', 'successfully reached')
        }));
        return {
          ...r,
          status: 'completed',
          requiresApproval: false,
          approvalStatus: 'approved',
          steps: fixedSteps,
          confidence: 'high',
          confidenceReason: 'All 5 data batches successfully verified after reconnection.',
          resultTitle: 'Customer Satisfaction Analysis (100% Complete Cohort)',
          resultSummary: 'Analysis of all 1,200 customer responses across North America and APAC. Overall satisfaction rating is 4.4 / 5.0.',
          errorReason: undefined,
          errorRecoveryAdvice: undefined,
          canRetryVerification: false,
          systemActions: [
            ...r.systemActions,
            {
              title: 'Reconnection successful',
              description: 'Retried verification step and retrieved missing Batch 5 without data loss.'
            }
          ]
        };
      })
    );
  };

  const currentTask = runs.find((r) => r.id === selectedTaskId) || runs[0];

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex selection:bg-emerald-100 selection:text-emerald-900">
      {/* Desktop Sidebar docked to the FAR LEFT */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        pendingReviewsCount={pendingReviewsCount}
      />

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        pendingReviewsCount={pendingReviewsCount}
      />

      {/* Main Area: Top Navbar + Page Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          pendingReviewsCount={pendingReviewsCount}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 py-8 max-w-6xl w-full mx-auto">
          {currentPage === 'dashboard' && (
            <Dashboard
              runs={runs}
              onStartTask={() => handleNavigate('new_task')}
              onOpenTask={handleOpenTask}
              onTryExample={handleTryExample}
              onNavigate={handleNavigate}
            />
          )}

          {currentPage === 'new_task' && (
            <NewRun
              onStartWorkflow={handleStartWorkflow}
              prefillTemplateId={prefillTemplateId}
              onClearPrefill={() => setPrefillTemplateId(null)}
            />
          )}

          {currentPage === 'run_details' && currentTask && (
            <RunDetails
              task={currentTask}
              onBack={() => handleNavigate('dashboard')}
              onApproveTask={handleApproveTask}
              onRequestChanges={handleRequestChanges}
              onRejectTask={handleRejectTask}
              onUpdateTaskResult={handleUpdateTaskResult}
              onRunAgain={() => handleNavigate('new_task')}
              onRetryStep={handleRetryStep}
            />
          )}

          {currentPage === 'activity' && (
            <History
              runs={runs}
              onOpenTask={handleOpenTask}
              onNewTask={() => handleNavigate('new_task')}
            />
          )}

          {currentPage === 'results' && (
            <div className="space-y-6">
              <div className="pb-4 border-b border-zinc-200">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                  Task Results
                </h1>
                <p className="text-sm text-zinc-600 mt-0.5">
                  Browse and inspect verified results produced across your operations.
                </p>
              </div>

              {runs.filter((r) => r.status === 'completed').length > 0 ? (
                <div className="space-y-8">
                  {runs
                    .filter((r) => r.status === 'completed')
                    .slice(0, 3)
                    .map((task) => (
                      <div key={task.id} className="border border-zinc-200/90 rounded-2xl p-6 bg-white shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
                          <div>
                            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                              {task.category}
                            </span>
                            <h3 className="text-lg font-bold text-zinc-900 mt-0.5">
                              {task.resultTitle || task.title}
                            </h3>
                          </div>
                          <button
                            onClick={() => handleOpenTask(task.id)}
                            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-800 border border-zinc-200 transition-colors self-start sm:self-auto"
                          >
                            Open full report & evidence
                          </button>
                        </div>
                        <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                          {task.resultSummary}
                        </p>
                        {task.resultItems && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                            {task.resultItems.map((it, idx) => (
                              <div key={idx} className="bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/80 text-xs">
                                <span className="text-zinc-500">{it.label}</span>
                                <p className="font-bold text-zinc-900 mt-0.5">{it.value}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  No completed results yet. Start a task to generate your first result.
                </div>
              )}
            </div>
          )}

          {currentPage === 'evaluations' && (
            <Evaluations onNewTask={() => handleNavigate('new_task')} />
          )}

          {currentPage === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}

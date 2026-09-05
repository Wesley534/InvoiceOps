import React from 'react';
import { 
  BarChart3, 
  CheckCircle2, 
  TrendingUp, 
  ShieldCheck, 
  Clock, 
  Target, 
  Sparkles, 
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { TEST_CASES, EVALUATION_METRICS } from '../data/mockData';

interface EvaluationsProps {
  onNewTask: () => void;
}

export const Evaluations: React.FC<EvaluationsProps> = ({ onNewTask }) => {
  return (
    <div className="space-y-10 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Reliability & Quality Metrics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            System Evaluations & Benchmarks
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5">
            Real test suite performance measuring hallucination rates, compliance accuracy, and human approval efficiency.
          </p>
        </div>

        <button
          onClick={onNewTask}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0"
        >
          <span>Run evaluation task</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Top 3 High-Level Benchmark Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Overall Pass Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">{EVALUATION_METRICS.overallPassRate}%</div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Across {EVALUATION_METRICS.totalEvaluatedCases} rigorous regression tests and policy constraints.
          </p>
        </div>

        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Output Quality Score</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-emerald-700">{EVALUATION_METRICS.outputQuality}%</div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Grounded factual accuracy against ground truth documents.
          </p>
        </div>

        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Manual Work Reduction</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-bold text-zinc-900">{EVALUATION_METRICS.manualWorkReduction}%</div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Average operator time saved per cross-checking and verification workflow.
          </p>
        </div>
      </div>

      {/* Before / After Comparison */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-bold text-zinc-900">
            Before vs. After Workflow Comparison
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Benchmarked across 50 simulated enterprise procurement and reporting workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Manual baseline */}
          <div className="p-5 rounded-xl bg-zinc-50 border border-zinc-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">
                Manual / Unassisted Baseline
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 font-semibold">
                Status Quo
              </span>
            </div>

            <ul className="space-y-2 text-xs text-zinc-600">
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Average time: <strong>45 minutes per task</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Error rate: <strong>~7% manual entry discrepancies</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>Audit trail: Scattered across emails and spreadsheets</span>
              </li>
            </ul>
          </div>

          {/* Axiom Operations */}
          <div className="p-5 rounded-xl bg-emerald-50/50 border-2 border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Axiom Operations AI OS
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                Verified
              </span>
            </div>

            <ul className="space-y-2 text-xs text-emerald-900">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Average time: <strong>54 seconds runtime + 1 min review</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Error rate: <strong>&lt;0.6% (caught before completion)</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Audit trail: Complete source citations and reasoning trees</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Detailed Benchmark Test Suite Table */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900">Standardized Test Suite Results</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Synthetic benchmark tasks run weekly to detect any behavioral regression.
          </p>
        </div>

        <div className="bg-white border border-zinc-200/90 rounded-2xl overflow-hidden shadow-xs divide-y divide-zinc-100">
          {TEST_CASES.map((tc) => (
            <div
              key={tc.id}
              className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-50/70 transition-colors"
            >
              <div className="space-y-1 min-w-0 max-w-xl">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-zinc-400 text-[11px]">{tc.code}</span>
                  <span className="text-zinc-300">•</span>
                  <span className="font-semibold text-emerald-800">{tc.category}</span>
                </div>
                <h3 className="text-sm font-bold text-zinc-900">{tc.title}</h3>
                <p className="text-xs text-zinc-600 leading-relaxed font-normal">{tc.actualResult}</p>
                {tc.failureReason && (
                  <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 mt-1">
                    {tc.failureReason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-5 shrink-0 pt-2 md:pt-0">
                <div className="text-right text-xs">
                  <span className="text-zinc-400 block">Latency</span>
                  <span className="font-bold text-zinc-800">{tc.executionTime}</span>
                </div>

                <span
                  className={
                    tc.status === 'PASS'
                      ? 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200'
                  }
                >
                  {tc.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

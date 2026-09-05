import React, { useState } from 'react';
import { 
  ArrowRight, 
  Sparkles, 
  Layers, 
  FileText, 
  Clock, 
  ShieldCheck, 
  Check, 
  X,
  Play
} from 'lucide-react';
import { UploadedFile, TaskRun } from '../types';
import { SmartDropzone } from '../components/forms/SmartDropzone';
import { GuidanceAlert } from '../components/forms/GuidanceAlert';
import { DEMO_TEMPLATES } from '../data/mockData';
import { generateId } from '../lib/utils';

interface NewRunProps {
  onStartWorkflow: (task: TaskRun) => void;
  prefillTemplateId?: string | null;
  onClearPrefill?: () => void;
}

export const NewRun: React.FC<NewRunProps> = ({
  onStartWorkflow,
  prefillTemplateId,
  onClearPrefill
}) => {
  const [taskDescription, setTaskDescription] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [targetAudience, setTargetAudience] = useState('');
  const [objective, setObjective] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('General Operations');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [activeFlowType, setActiveFlowType] = useState<'success' | 'approval' | 'partial_error'>('success');

  // Handle prefill template if supplied
  React.useEffect(() => {
    if (prefillTemplateId) {
      const template = DEMO_TEMPLATES.find((t) => t.id === prefillTemplateId);
      if (template) {
        setTaskDescription(template.prompt);
        setFiles(template.sampleFiles);
        setSelectedCategory(template.category);
        if (template.fields) {
          setTargetAudience(template.fields.targetAudience || '');
          setObjective(template.fields.campaignObjective || '');
          setDeadline(template.fields.deadline || '');
        }
        setActiveFlowType(template.flowType as any);
      }
      onClearPrefill?.();
    }
  }, [prefillTemplateId, onClearPrefill]);

  const handleApplyTemplate = (tpl: typeof DEMO_TEMPLATES[0]) => {
    setTaskDescription(tpl.prompt);
    setFiles(tpl.sampleFiles);
    setSelectedCategory(tpl.category);
    if (tpl.fields) {
      setTargetAudience(tpl.fields.targetAudience || '');
      setObjective(tpl.fields.campaignObjective || '');
      setDeadline(tpl.fields.deadline || '');
    }
    setActiveFlowType(tpl.flowType as any);
  };

  const handleAddFiles = (newFiles: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Determine friendly guidance alerts
  const getGuidanceTip = () => {
    if (!taskDescription.trim()) {
      return {
        type: 'tip' as const,
        message: 'Describe what you want done in everyday language. You can also click any template below to test instantly.'
      };
    }
    if (files.length === 0 && !taskDescription.toLowerCase().includes('generate')) {
      return {
        type: 'caution' as const,
        message: 'Attaching at least one reference document helps the system verify facts and ground the results in your company data.'
      };
    }
    if (taskDescription.length > 20 && !targetAudience.trim()) {
      return {
        type: 'tip' as const,
        message: "Specifying who this work is for (target audience or department) will help produce a more tailored outcome."
      };
    }
    return {
      type: 'ready' as const,
      message: 'Everything is set! You can review details and launch the workflow whenever you are ready.'
    };
  };

  const guidance = getGuidanceTip();

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDescription.trim()) return;
    setShowConfirmation(true);
  };

  const handleConfirmLaunch = () => {
    // Construct the new task run
    const newTask: TaskRun = {
      id: generateId('tsk'),
      title: taskDescription.length > 60 ? taskDescription.substring(0, 57) + '...' : taskDescription,
      description: taskDescription,
      category: selectedCategory,
      createdAt: 'Just now',
      status: 'running',
      estimatedDuration: 'About 1–2 minutes',
      confidence: activeFlowType === 'approval' ? 'needs_review' : 'high',
      confidenceReason: activeFlowType === 'approval' 
        ? 'Price variance between invoice and purchase order exceeds standard tolerance.'
        : 'Information verified against all attached source files.',
      files: files,
      steps: [
        { id: 's1', name: 'Understanding your request', status: 'in_progress', statusMessage: 'Reading task description and structuring target objectives...' },
        { id: 's2', name: 'Reviewing information', status: 'pending', statusMessage: `Reading ${files.length > 0 ? `${files.length} documents` : 'provided parameters'}...` },
        { id: 's3', name: 'Creating the draft', status: 'pending', statusMessage: 'Synthesizing recommendations and compiling findings...' },
        { id: 's4', name: 'Checking the result', status: 'pending', statusMessage: 'Checking facts and cross-verifying numbers against master rules...' },
        { id: 's5', name: 'Ready for review', status: 'pending', statusMessage: 'Preparing clean summary and decision package...' }
      ],
      currentStepIndex: 0,
      requiresApproval: activeFlowType === 'approval' || activeFlowType === 'partial_error',
      approvalStatus: 'pending',
      approvalWarning: activeFlowType === 'approval' ? 'Price discrepancy flagged between invoice and PO.' : undefined,
      externalActionWarning: activeFlowType === 'approval' ? 'Authorizing will forward payment details to the finance queue.' : undefined,
      resultTitle: taskDescription.length > 50 ? `${taskDescription.substring(0, 48)} Output` : `${taskDescription} Output`,
      resultSummary: `Successfully processed ${files.length} files and generated operational brief based on instructions.`,
      resultContent: `### Executive Overview\n- **Task Goal**: ${taskDescription}\n- **Target Audience**: ${targetAudience || 'Operational Team'}\n- **Core Priority**: ${objective || 'Efficient Execution'}\n\n### Key Findings & Recommendations\n1. **Core Insight**: Analyzed reference documents and identified streamlined procedures.\n2. **Compliance**: All operational safety checks applied.\n3. **Recommended Next Step**: Review the generated evidence points below and authorize rollout.`,
      resultItems: [
        { label: 'Audience Focus', value: targetAudience || 'Operations Team', badge: 'Targeted' },
        { label: 'Verification', value: `${files.length} Docs Checked`, badge: 'Verified' },
        { label: 'Governance', value: 'Human Gate Armed', badge: 'Safe' }
      ],
      systemActions: [
        { title: `Read ${files.length} uploaded documents`, description: 'Extracted key tables, policies, and text blocks.' },
        { title: 'Checked against operational rules', description: 'Validated formats and required information.' },
        { title: 'Compiled structured report', description: 'Formatted for executive presentation.' }
      ],
      humanInvolvementText: activeFlowType === 'approval' 
        ? '1 human approval required before completion'
        : 'Automated run with audit trail',
      sources: files.map((f, i) => ({
        id: `src-gen-${i}`,
        title: f.name,
        type: f.name.endsWith('.csv') ? 'csv' : f.name.endsWith('.pdf') ? 'pdf' : 'docx',
        relevanceScore: 92 + i,
        relevantExcerpt: `Verified operational section from ${f.name} supporting the conclusions.`,
        pageOrSection: `Section ${i + 1}`
      })),
      explainability: {
        question: 'Why did the system produce this result?',
        summary: `Result was generated by evaluating the requested task against ${files.length} reference documents.`,
        informationConsidered: [
          taskDescription,
          targetAudience ? `Target audience parameter: ${targetAudience}` : 'Default operational audience',
          ...files.map((f) => `Attachment: ${f.name}`)
        ],
        rulesAndChecksApplied: [
          'Document formatting integrity check (PASSED)',
          'Operational policy threshold evaluation (PASSED)',
          'Clear language review applied'
        ],
        assumptionsMade: [
          'Uploaded files represent current, authorized business records.'
        ]
      }
    };

    onStartWorkflow(newTask);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Top Heading */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>New Operational Task</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          What do you want to get done?
        </h1>
        <p className="text-sm text-zinc-600 mt-1">
          Describe what you need help with in plain words. The system will handle the repetitive work and ask for your approval at key checkpoints.
        </p>
      </div>

      {/* Quick Interactive Templates */}
      <div className="bg-white border border-zinc-200/90 rounded-2xl p-4 shadow-xs">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2.5">
          Need inspiration? Try a ready-made example:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {DEMO_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleApplyTemplate(tpl)}
              className="text-left p-3 rounded-xl bg-zinc-50/80 hover:bg-emerald-50/40 border border-zinc-200/80 hover:border-emerald-300 transition-all text-xs group"
            >
              <span className="font-bold text-zinc-900 group-hover:text-emerald-800 block truncate">
                {tpl.title}
              </span>
              <span className="text-[11px] text-zinc-500 mt-0.5 block line-clamp-1">
                {tpl.tagline}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Guided Form */}
      <form onSubmit={handleProceedToConfirm} className="space-y-6">
        {/* Large Input Area */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
          <label className="block text-sm font-bold text-zinc-900 mb-2">
            Task Description <span className="text-emerald-600">*</span>
          </label>
          <textarea
            rows={4}
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Describe what you need help with... (e.g. Create a campaign brief from the latest market research, or cross-check vendor invoice #MT-2026-0847 against purchase order PO-1001)"
            className="w-full bg-white border border-zinc-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 rounded-xl p-4 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none transition-colors resize-y leading-relaxed"
            required
          />

          <div className="mt-4">
            <GuidanceAlert 
              type={guidance.type} 
              message={guidance.message} 
            />
          </div>
        </div>

        {/* Supporting Documents Section */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Supporting Documents & Data
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Upload files the system should read, cross-check, or extract data from.
              </p>
            </div>
            <span className="text-xs font-medium text-zinc-400">Optional</span>
          </div>

          <SmartDropzone
            files={files}
            onAddFiles={handleAddFiles}
            onRemoveFile={handleRemoveFile}
          />
        </div>

        {/* Optional Structured Fields */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              Additional Details (Optional)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Providing specific context helps the system produce a more focused result.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                Target Audience / Department
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g. Operations leads, Finance, APAC team"
                className="w-full bg-white border border-zinc-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5">
                Primary Objective or Deadline
              </label>
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="e.g. Verify spend by Friday, Prepare Q3 launch"
                className="w-full bg-white border border-zinc-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-zinc-500">
            You will have a chance to confirm before the workflow begins.
          </span>
          <button
            type="submit"
            disabled={!taskDescription.trim()}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white shadow-xs hover:shadow-sm transition-all active:scale-[0.98]"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Confirmation Modal: "Ready to start?" */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-xl p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-emerald-600" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900">Ready to start?</h3>
              </div>
              <button
                onClick={() => setShowConfirmation(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Review your setup before the system begins processing. You can watch live progress on each step.
            </p>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-500">Task:</span>
                <span className="font-bold text-zinc-900 text-right max-w-[240px]">
                  {taskDescription}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Files attached:</span>
                <span className="font-bold text-zinc-900">
                  {files.length > 0 ? `${files.length} documents` : 'None (instruction-only)'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Estimated time:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  About 1–2 minutes
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-200 text-zinc-600">
                <span>Human oversight:</span>
                <span className="text-emerald-700 font-semibold">
                  Review gate enabled
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                Back to edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmation(false);
                  handleConfirmLaunch();
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
              >
                <span>Start task</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

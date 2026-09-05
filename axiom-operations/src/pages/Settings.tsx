import React, { useState } from 'react';
import { 
  Shield, 
  Bell, 
  Sliders, 
  Check, 
  User, 
  Database,
  Lock,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';

export const Settings: React.FC = () => {
  const [approvalThreshold, setApprovalThreshold] = useState('medium');
  const [requireSpendApproval, setRequireSpendApproval] = useState(true);
  const [requireExternalSendApproval, setRequireExternalSendApproval] = useState(true);
  const [autoSaveAuditLogs, setAutoSaveAuditLogs] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          Settings & Governance
        </h1>
        <p className="text-sm text-zinc-600 mt-1">
          Configure operational thresholds, human review mandates, and system behavioral boundaries.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Human Review Gates */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-100">
            <Shield className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-zinc-900">Human Approval Gates</h2>
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-semibold text-zinc-900 block">
                  Mandatory sign-off for financial transactions
                </span>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Always pause workflow and require explicit operator authorization before submitting invoices or payments.
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireSpendApproval}
                onChange={(e) => setRequireSpendApproval(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 pt-3 border-t border-zinc-100">
              <div>
                <span className="font-semibold text-zinc-900 block">
                  Mandatory sign-off before sending external communications
                </span>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Never dispatch emails or partner communications without human preview and edit capabilities.
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireExternalSendApproval}
                onChange={(e) => setRequireExternalSendApproval(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 mt-1 cursor-pointer"
              />
            </div>

            <div className="pt-3 border-t border-zinc-100 space-y-2">
              <label className="block font-semibold text-zinc-900 text-xs sm:text-sm">
                Confidence Threshold for Automatic Processing
              </label>
              <p className="text-zinc-500 text-xs">
                When the system's confidence falls below this level, it will automatically pause and request human verification.
              </p>
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {[
                  { id: 'high', label: 'Strict (High Only)', desc: 'Pause on any uncertainty' },
                  { id: 'medium', label: 'Balanced (Standard)', desc: 'Recommended default' },
                  { id: 'low', label: 'Permissive', desc: 'Fewer pauses' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setApprovalThreshold(item.id)}
                    className={cn(
                      'p-3 rounded-xl border text-left text-xs transition-all',
                      approvalThreshold === item.id
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold'
                        : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                    )}
                  >
                    <span className="block font-bold">{item.label}</span>
                    <span className="text-[10px] text-zinc-500 block mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audit & Data Retention */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-100">
            <Database className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-zinc-900">Audit & Observability</h2>
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="font-semibold text-zinc-900 block">
                  Preserve permanent explainability logs
                </span>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Store step-by-step reasoning and source citations alongside every completed task for compliance inspections.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoSaveAuditLogs}
                onChange={(e) => setAutoSaveAuditLogs(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 pt-3 border-t border-zinc-100">
              <div>
                <span className="font-semibold text-zinc-900 block">
                  Notify on required human intervention
                </span>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Send immediate alert when a running task reaches a gate requiring manual review.
                </p>
              </div>
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 mt-1 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Operator Profile */}
        <div className="bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-100">
            <User className="w-4 h-4 text-emerald-600" />
            <h2 className="text-base font-bold text-zinc-900">Active Operator</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Name & Title
              </label>
              <input
                type="text"
                defaultValue="Alex Chen — Operations Lead"
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Authorized Department
              </label>
              <input
                type="text"
                defaultValue="Global Operations & Strategy"
                className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {saved && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Settings successfully applied</span>
            </span>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <span>Save Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};

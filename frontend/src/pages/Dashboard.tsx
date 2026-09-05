import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileUp,
  Inbox,
  Activity,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { InvoiceListItem, QueueStats } from '../lib/types';
import { timeAgo } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { InvoiceStatusBadge } from '../components/ui/StatusBadges';
import { QUEUE_GROUPS } from '../lib/constants';

interface DashboardProps {
  items: InvoiceListItem[];
  queueStats: QueueStats;
  loading: boolean;
  onOpenInvoice: (invoice: InvoiceListItem) => void;
  onUpload: () => void;
  onGoInbox: () => void;
}

const groupOf = (status: string) => {
  for (const group of QUEUE_GROUPS) {
    if ((group.statuses as string[]).includes(status)) return group.id;
  }
  return 'processing';
};

export const Dashboard: React.FC<DashboardProps> = ({
  items,
  queueStats,
  loading,
  onOpenInvoice,
  onUpload,
  onGoInbox,
}) => {
  const { user } = useAuth();
  const firstName = user?.name?.split(/\s+/)[0] ?? 'there';
  const attention = items.filter((i) => groupOf(i.status) === 'attention').slice(0, 4);
  const recent = items.slice(0, 7);
  const finalized = Math.max(0, queueStats.total - queueStats.attention - queueStats.processing);

  const statCards = [
    {
      label: 'Awaiting decision',
      value: queueStats.attention,
      icon: AlertTriangle,
      iconClass: 'bg-amber-50 border-amber-200 text-amber-600',
      onClick: onGoInbox,
    },
    {
      label: 'In processing',
      value: queueStats.processing,
      icon: Clock,
      iconClass: 'bg-sky-50 border-sky-200 text-sky-600',
      onClick: onGoInbox,
    },
    {
      label: 'Finalized',
      value: finalized,
      icon: CheckCircle2,
      iconClass: 'bg-mint border-brand/20 text-brand',
      onClick: onGoInbox,
    },
    {
      label: 'Total invoices',
      value: queueStats.total,
      icon: Inbox,
      iconClass: 'bg-zinc-100 border-zinc-200 text-zinc-600',
      onClick: onGoInbox,
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Invoice pre-approval console"
        title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${firstName}.`}
        description="Upload a vendor invoice PDF and InvoiceOps will extract it, run the 11 validation checks, and hand you an evidence-backed PASS · REVIEW · BLOCK recommendation."
        actions={
          <Button onClick={onUpload}>
            <FileUp className="w-4 h-4" />
            Upload an invoice
          </Button>
        }
      />

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {statCards.map(({ label, value, icon: Icon, iconClass, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="text-left bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs hover:border-zinc-300 hover:shadow-sm transition-all"
          >
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-4 ${iconClass}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div className="text-3xl sm:text-[2rem] font-extrabold text-ink tabular-nums leading-none">{value}</div>
            <p className="text-[13px] text-zinc-500 mt-1.5 font-medium">{label}</p>
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          {/* Needs attention */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Needs your attention
              </h2>
              <button onClick={onGoInbox} className="text-xs font-semibold text-brand-deep hover:text-brand flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {loading ? (
              <Spinner label="Loading invoices…" className="py-8" />
            ) : attention.length > 0 ? (
              <div className="space-y-2.5">
                {attention.map((invoice) => (
                  <button
                    key={invoice.id}
                    onClick={() => onOpenInvoice(invoice)}
                    className="w-full text-left p-4 rounded-2xl bg-white border-2 border-amber-200 hover:border-amber-400/70 shadow-xs transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-zinc-500 font-medium truncate">{invoice.original_filename}</span>
                        {invoice.case_id && <Badge size="sm" tone="neutral">{invoice.case_id}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span>{timeAgo(invoice.received_at)}</span>
                        {invoice.run && <span>· {invoice.run.decision} recommendation</span>}
                      </div>
                    </div>
                    <InvoiceStatusBadge status={invoice.status} outcome={invoice.run?.human_outcome ?? null} />
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="w-5 h-5" />}
                title="All caught up"
                description="No invoices are paused at a decision gate right now."
              />
            )}
          </section>

          {/* Recent activity */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-ink flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              Recent activity
            </h2>
            {loading ? (
              <Spinner label="Loading…" className="py-8" />
            ) : recent.length > 0 ? (
              <Card padded={false}>
                <ul className="divide-y divide-zinc-100">
                  {recent.map((invoice) => (
                    <li key={invoice.id}>
                      <button
                        onClick={() => onOpenInvoice(invoice)}
                        className="w-full flex items-center justify-between gap-4 px-6 py-4 hover:bg-zinc-50/80 transition-colors text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{invoice.original_filename}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">
                            {invoice.case_id ? `${invoice.case_id} · ` : ''}
                            {timeAgo(invoice.received_at)}
                            {invoice.submitted_by ? ` · ${invoice.submitted_by}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          {invoice.run && <Badge size="sm" tone={invoice.run.decision === 'PASS' ? 'mint' : invoice.run.decision === 'REVIEW' ? 'amber' : 'signal'}>{invoice.run.decision}</Badge>}
                          <InvoiceStatusBadge status={invoice.status} outcome={invoice.run?.human_outcome ?? null} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <EmptyState
                icon={<FileUp className="w-5 h-5" />}
                title="No invoices yet"
                description="Upload your first vendor invoice to start a validation run."
                action={
                  <Button size="sm" onClick={onUpload}>
                    Upload an invoice
                  </Button>
                }
              />
            )}
          </section>
        </div>

        {/* Right rail */}
        <div className="space-y-5">
          <Card className="bg-forest border-forest text-white">
            <p className="text-xs font-bold uppercase tracking-wider text-accent mb-2">How the gate works</p>
            <ol className="space-y-2.5 text-xs text-white/75 leading-relaxed list-none">
              <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-white/10 text-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-px">1</span>Upload a PDF — a background job starts immediately.</li>
              <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-white/10 text-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-px">2</span>The pipeline extracts fields, runs 11 deterministic checks and classifies PASS · REVIEW · BLOCK.</li>
              <li className="flex gap-2.5"><span className="w-5 h-5 rounded-full bg-white/10 text-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-px">3</span>An approver reviews the evidence and makes the final call — logged, append-only.</li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
};

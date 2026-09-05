import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  FileSearch,
  Inbox as InboxIcon,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import { apiListInvoices, apiRetryInvoice, type InvoiceListParams } from '../lib/api';
import type { InvoiceListItem, Page } from '../lib/types';
import { QUEUE_GROUPS } from '../lib/constants';
import { timeAgo } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { EmptyState, Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { Segmented } from '../components/ui/Segmented';
import { Pagination } from '../components/ui/Pagination';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { InvoiceStatusBadge, JobBadge } from '../components/ui/StatusBadges';

type TabId = 'all' | 'attention' | 'processing' | 'finalized';
const PAGE_SIZE = 10;

const FINALIZED: string[] =
  QUEUE_GROUPS.find((g) => g.id === 'finalized')?.statuses ?? [];

function tabStatuses(tab: TabId): string[] | undefined {
  if (tab === 'all') return undefined;
  const group = QUEUE_GROUPS.find((g) => g.id === tab);
  return group?.statuses.map(String);
}

interface InboxProps {
  onOpenInvoice: (invoice: InvoiceListItem) => void;
  onUpload: () => void;
}

export const Inbox: React.FC<InboxProps> = ({ onOpenInvoice, onUpload }) => {
  const [tab, setTab] = useState<TabId>('all');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState<Page<InvoiceListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: InvoiceListParams = {
        page,
        size: PAGE_SIZE,
        q: q || undefined,
        status: tabStatuses(tab),
      };
      const result = await apiListInvoices(params);
      setData(result);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [page, q, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const changeTab = (next: TabId) => {
    setTab(next);
    setPage(1);
  };

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(searchInput.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setQ('');
    setSearchInput('');
    setPage(1);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pageAllSelectable = useMemo(
    () => items.filter((item) => isRetryable(item)).map((item) => item.id),
    [items],
  );

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageAllSelectable.length > 0 && pageAllSelectable.every((id) => next.has(id));
      for (const id of pageAllSelectable) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const retrySelected = async () => {
    const targets = items.filter((item) => selected.has(item.id) && isRetryable(item));
    setRetrying(true);
    setActionNote(null);
    const failures: string[] = [];
    let done = 0;
    for (const item of targets) {
      try {
        await apiRetryInvoice(item.id);
        done += 1;
      } catch {
        failures.push(item.original_filename);
      }
    }
    setRetrying(false);
    if (failures.length === 0) {
      setActionNote(`Queued ${done} retry run${done === 1 ? '' : 's'}.`);
    } else {
      setActionNote(`Queued ${done}; ${failures.length} could not be retried (${failures.slice(0, 2).join(', ')}…).`);
    }
    setSelected(new Set());
    await load();
  };

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        eyebrow="Queue & history"
        title="Invoices"
        description="Every submission, from received to finalized. Use the filter chips and pagination to page through records ten at a time."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={load} loading={loading}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={onUpload}>
              <Upload className="w-3.5 h-3.5" />
              Upload
            </Button>
          </div>
        }
      />

      {error && (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
      {actionNote && (
        <Alert tone={actionNote.startsWith('Queued') && !actionNote.includes('could not') ? 'success' : 'warning'} onDismiss={() => setActionNote(null)}>
          {actionNote}
        </Alert>
      )}

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <Segmented<TabId>
          value={tab}
          onChange={changeTab}
          options={[
            { value: 'all', label: 'All', count: tab === 'all' ? total : undefined },
            { value: 'attention', label: 'Needs attention', count: tab === 'attention' ? total : undefined },
            { value: 'processing', label: 'Processing', count: tab === 'processing' ? total : undefined },
            { value: 'finalized', label: 'Finalized', count: tab === 'finalized' ? total : undefined },
          ]}
        />
        <form onSubmit={runSearch} className="relative w-full xl:w-80">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search filename or case id…"
            className="w-full pl-9 pr-20 py-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/25 transition-colors"
            aria-label="Search invoices"
          />
          {q ? (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 hover:text-zinc-700"
            >
              Clear
            </button>
          ) : (
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-brand-deep hover:text-brand"
            >
              Search
            </button>
          )}
        </form>
      </div>

      {loading ? (
        <Spinner label="Loading invoices…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={q || tab !== 'all' ? <FileSearch className="w-5 h-5" /> : <InboxIcon className="w-5 h-5" />}
          title={q || tab !== 'all' ? 'Nothing in this view' : 'No invoices submitted yet'}
          description={
            q
              ? 'Try a different search term.'
              : tab !== 'all'
                ? 'No invoices match this group right now.'
                : 'Upload a vendor invoice PDF to start your first validation run.'
          }
          action={
            !q && tab === 'all' ? (
              <Button size="sm" onClick={onUpload}>
                <Upload className="w-3.5 h-3.5" />
                Upload an invoice
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card padded={false}>
            {/* Bulk action bar — for rows that failed and can be re-run */}
            {pageAllSelectable.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-zinc-100 bg-zinc-50/70">
                <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pageAllSelectable.length > 0 && pageAllSelectable.every((id) => selected.has(id))}
                    onChange={togglePage}
                    aria-label="Select all failed rows on this page"
                    className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand/30 accent-brand cursor-pointer"
                  />
                  Select failed runs on this page
                </label>
                {selected.size > 0 ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">
                      {selected.size} selected
                    </span>
                    <Button size="xs" variant="ink" onClick={retrySelected} loading={retrying}>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retry {selected.size} run{selected.size === 1 ? '' : 's'}
                    </Button>
                  </div>
                ) : (
                  <span className="text-[11px] text-zinc-400">Rows with a failed job can be queued again.</span>
                )}
              </div>
            )}

            <ul className="divide-y divide-zinc-100">
              {items.map((invoice) => {
                const inFlight = invoice.job && (invoice.job.status === 'QUEUED' || invoice.job.status === 'RUNNING');
                const retryable = isRetryable(invoice);
                const checked = selected.has(invoice.id);
                const finalized = FINALIZED.includes(invoice.status);
                return (
                  <li key={invoice.id} className="flex items-stretch">
                    {/* Selector column (retryable rows only) */}
                    <div className="flex items-center pl-4 sm:pl-6">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!retryable}
                        onChange={() => toggleRow(invoice.id)}
                        aria-label={`Select ${invoice.original_filename}`}
                        title={
                          retryable
                            ? 'Select for bulk retry'
                            : finalized || !invoice.job
                              ? 'Already finalised — cannot be re-run'
                              : inFlight
                                ? 'Currently processing — cannot be re-run yet'
                                : 'No failed job to retry'
                        }
                        className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand/30 accent-brand cursor-pointer disabled:cursor-not-allowed disabled:opacity-35"
                      />
                    </div>

                    <button
                      onClick={() => onOpenInvoice(invoice)}
                      className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-3 px-4 sm:px-6 py-5 hover:bg-mint/30 transition-colors text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-zinc-900 group-hover:text-brand-deep transition-colors truncate max-w-full">
                            {invoice.original_filename}
                          </span>
                          {invoice.case_id && <Badge size="sm" tone="neutral">{invoice.case_id}</Badge>}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1 font-mono truncate">
                          {invoice.id.slice(0, 8)}… · {timeAgo(invoice.received_at)}
                          {invoice.submitted_by ? ` · ${invoice.submitted_by}` : ''}
                        </p>
                        {invoice.job?.error && (
                          <p className="text-[11px] text-signal-deep mt-1 truncate">{invoice.job.error}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                        {inFlight && invoice.job ? (
                          <JobBadge status={invoice.job.status} progress={invoice.job.progress_pct} />
                        ) : (
                          invoice.run && (
                            <Badge
                              size="sm"
                              tone={
                                invoice.run.decision === 'PASS'
                                  ? 'mint'
                                  : invoice.run.decision === 'REVIEW'
                                    ? 'amber'
                                    : 'signal'
                              }
                            >
                              {invoice.run.decision}
                            </Badge>
                          )
                        )}
                        <InvoiceStatusBadge
                          status={invoice.status as InvoiceListItem['status']}
                          outcome={invoice.run?.human_outcome ?? null}
                        />
                        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Pagination page={data as Page<unknown>} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

function isRetryable(invoice: InvoiceListItem): boolean {
  if (!invoice.job) return false;
  return invoice.job.status === 'FAILED' || invoice.status === 'EXTRACTION_FAILED' || invoice.status === 'FAILED';
}

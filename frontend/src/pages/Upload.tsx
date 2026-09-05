import React, { useState } from 'react';
import {
  CheckCircle2,
  FileCheck2,
  FileUp,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import { apiUploadInvoice } from '../lib/api';
import type { UploadResult } from '../lib/api';
import { Dropzone } from '../components/ui/Dropzone';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert } from '../components/ui/Alert';
import { cn } from '../lib/utils';

interface UploadProps {
  /** Single-file quick path: navigates straight to the live job screen. */
  onStarted: (invoiceId: string, jobId: string) => void;
  onViewInbox: () => void;
}

type RowState = 'pending' | 'uploading' | 'done' | 'error';

interface UploadRow {
  file: File;
  state: RowState;
  message?: string;
  invoiceId?: string;
  jobId?: string;
}

export const Upload: React.FC<UploadProps> = ({ onStarted, onViewInbox }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchRow = (index: number, patch: Partial<UploadRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const start = async () => {
    if (files.length === 0 || busy) return;
    setError(null);
    setBusy(true);
    const queue = files.map<UploadRow>((file) => ({ file, state: 'pending' }));
    setRows(queue);

    const completed: UploadResult[] = [];
    for (let i = 0; i < queue.length; i++) {
      patchRow(i, { state: 'uploading' });
      try {
        const result = await apiUploadInvoice(queue[i].file);
        completed.push(result);
        patchRow(i, { state: 'done', invoiceId: result.invoice_id, jobId: result.job_id });
      } catch (err) {
        patchRow(i, {
          state: 'error',
          message: err instanceof Error ? err.message : 'Upload failed.',
        });
      }
    }

    setBusy(false);
    // Single file → dive straight into the live job like before.
    if (completed.length === 1 && queue.length === 1) {
      onStarted(completed[0].invoice_id, completed[0].job_id);
      return;
    }
    if (completed.length > 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const running = busy || rows.some((row) => row.state === 'uploading');
  const doneCount = rows.filter((row) => row.state === 'done').length;
  const failCount = rows.filter((row) => row.state === 'error').length;
  const allDone = rows.length > 0 && rows.every((row) => row.state === 'done' || row.state === 'error');

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <PageHeader
        eyebrow="New invoice"
        title="Upload vendor invoices"
        description="Add one or more PDFs — each starts its own validation run as a background job you can watch from the invoice queue."
        actions={
          allDone && doneCount > 0 ? (
            <Button onClick={onViewInbox}>
              <FileCheck2 className="w-4 h-4" />
              View {doneCount} job{doneCount === 1 ? '' : 's'} in queue
            </Button>
          ) : undefined
        }
      />

      {error && (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {allDone && failCount > 0 && (
        <Alert tone="warning" onDismiss={() => setError(null)}>
          {doneCount} uploaded successfully; {failCount} failed — see the file list below and retry them.
        </Alert>
      )}

      <Card>
        <div className="space-y-5">
          <Dropzone
            accept="application/pdf,.pdf"
            label="Drop vendor invoice PDFs here"
            hint="drag & drop"
            multiple
            disabled={running}
            files={files}
            onFilesChange={setFiles}
          />

          {/* Per-file progress (only while submitting) */}
          {rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((row, index) => (
                <li
                  key={`${row.file.name}-${row.file.size}`}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-2.5',
                    row.state === 'error'
                      ? 'border-signal/30 bg-signal-soft/60'
                      : row.state === 'done'
                        ? 'border-brand/25 bg-mint/60'
                        : 'border-zinc-200 bg-zinc-50/70',
                  )}
                >
                  {row.state === 'uploading' ? (
                    <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" />
                  ) : row.state === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                  ) : row.state === 'error' ? (
                    <XCircle className="w-4 h-4 text-signal shrink-0" />
                  ) : (
                    <FileUp className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-zinc-800 truncate">{row.file.name}</p>
                    <p
                      className={cn(
                        'text-[11px]',
                        row.state === 'error'
                          ? 'text-signal-deep'
                          : row.state === 'done'
                            ? 'text-brand-deep'
                            : 'text-zinc-500',
                      )}
                    >
                      {row.state === 'uploading' && `Uploading ${index + 1} of ${rows.length}…`}
                      {row.state === 'done' && 'Queued — processing in the background.'}
                      {row.state === 'error' && (row.message ?? 'Upload failed.')}
                      {row.state === 'pending' && 'Waiting…'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] text-zinc-500">
            {[
              { icon: Sparkles, text: 'Fields extracted with an AI-assisted ladder' },
              { icon: ShieldCheck, text: '11 deterministic checks, zero AI in the decision' },
              { icon: Zap, text: 'Each PDF runs in the background — leave freely' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-2 bg-zinc-50/80 border border-zinc-100 rounded-xl p-3">
                <Icon className="w-3.5 h-3.5 text-brand shrink-0 mt-px" />
                <span className="leading-snug">{text}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-100">
            <p className="text-[11px] text-zinc-400">
              {files.length === 0
                ? 'PDFs are validated (%PDF header, 25 MB limit) before a job is queued.'
                : allDone && failCount === 0 && !busy
                  ? 'All uploads queued — you can leave this page safely.'
                  : `Queuing ${files.length} PDF${files.length === 1 ? '' : 's'} — a job starts for each.`}
            </p>
            <Button onClick={start} loading={running} disabled={files.length === 0 || allDone}>
              <FileCheck2 className="w-4 h-4" />
              {rows.length === 0 ? `Start validation${files.length > 1 ? ` (${files.length})` : ''}` : running ? 'Uploading…' : 'Retry failed'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="bg-forest border-forest text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-accent mb-2">Sample evaluation invoices</p>
        <p className="text-xs text-white/65 leading-relaxed">
          The repository ships with the evaluation set at{' '}
          <code className="font-mono bg-white/10 rounded px-1 py-0.5 text-[11px]">invoiceops-evaluation-dataset/invoices</code>{' '}
          — CASE-001 (clean pass) is the fastest way to see the happy path end to end.
        </p>
      </Card>
    </div>
  );
};

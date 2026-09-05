import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { apiGetInvoice, apiGetJob, apiRetryInvoice } from '../lib/api';
import { usePolling, useAsyncState } from '../lib/hooks';
import { JobProgress } from '../components/invoice/JobProgress';
import { Alert } from '../components/ui/Alert';
import { Spinner } from '../components/ui/Spinner';
import { Badge } from '../components/ui/Badge';
import type { Job } from '../lib/types';
import { timeAgo } from '../lib/format';

interface ProcessingProps {
  invoiceId: string;
  initialJobId: string;
  onDone: (reportRunId: string) => void;
  onBack: () => void;
}

/** Polls one job until it terminates; remount (via key) to poll another. */
const JobPoller: React.FC<{
  invoiceId: string;
  jobId: string;
  onDone: (reportRunId: string) => void;
  onRetried: (newJobId: string) => void;
}> = ({ invoiceId, jobId, onDone, onRetried }) => {
  const doneRef = useRef(false);
  const { data: invoice, error: invoiceError } = useAsyncState(
    () => apiGetInvoice(invoiceId),
    [invoiceId],
  );

  const { result: job } = usePolling<Job>(
    () => apiGetJob(jobId),
    {
      intervalMs: 1500,
      shouldStop: (current) => current.status === 'SUCCEEDED' || current.status === 'FAILED',
    },
  );

  useEffect(() => {
    if (job?.status === 'SUCCEEDED' && job.report_id && !doneRef.current) {
      doneRef.current = true;
      onDone(job.report_id);
    }
  }, [job, onDone]);

  const [retrying, setRetrying] = useState(false);
  const retry = async () => {
    setRetrying(true);
    try {
      const result = await apiRetryInvoice(invoiceId);
      onRetried(result.job_id);
    } catch (err) {
      // Surface the error by keeping the failed job visible — JobProgress shows it.
      setRetrying(false);
      alert(err instanceof Error ? err.message : 'Retry failed.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <FileText className="w-3.5 h-3.5" />
        <span className="truncate">{invoice?.original_filename ?? 'Loading invoice…'}</span>
        {invoice?.case_id && <Badge size="sm" tone="neutral">{invoice.case_id}</Badge>}
        <span className="text-zinc-300">·</span>
        <span>{invoice ? timeAgo(invoice.received_at) : ''}</span>
      </div>

      {invoiceError && (
        <Alert tone="error" title="Could not load the invoice">
          {invoiceError.message}
        </Alert>
      )}

      {!invoice && !invoiceError && <Spinner label="Loading invoice…" />}

      <JobProgress
        job={job}
        filename={invoice?.original_filename}
        onRetry={retry}
        retrying={retrying}
      />

      {!job && (
        <Alert tone="info" title="Waiting for the job to report in…">
          First run can take up to a minute while the extraction and checks execute.
        </Alert>
      )}
    </div>
  );
};

export const Processing: React.FC<ProcessingProps> = ({ invoiceId, initialJobId, onDone, onBack }) => {
  const [jobId, setJobId] = useState(initialJobId);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-16">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to invoices
      </button>

      {/* Remounts the poller for each new job id (e.g. after a retry). */}
      <JobPoller
        key={jobId}
        invoiceId={invoiceId}
        jobId={jobId}
        onDone={onDone}
        onRetried={setJobId}
      />
    </div>
  );
};

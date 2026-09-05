import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, FileText } from 'lucide-react';import {
  apiDecide,
  apiDownloadReportMarkdown,
  apiGetInvoice,
  apiGetReport,
  apiPatchExtraction,
} from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import type { InvoiceDetail, Report } from '../lib/types';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { Alert } from '../components/ui/Alert';
import { DecisionBanner } from '../components/invoice/DecisionBanner';
import { ApprovalPanel } from '../components/invoice/ApprovalPanel';
import { IssuesList } from '../components/invoice/IssuesList';
import { ChecksTable } from '../components/invoice/ChecksTable';
import { ExtractionPanel } from '../components/invoice/ExtractionPanel';
import { EvidencePanel } from '../components/invoice/EvidencePanel';
import { formatDateTime } from '../lib/format';

interface ReportViewProps {
  reportRunId: string;
  onBack: () => void;
  onGoInvoices: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ reportRunId, onBack, onGoInvoices }) => {
  const { isApprover } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setLoadError(null);
    apiGetReport(reportRunId)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load the report.');
      });
    return () => {
      cancelled = true;
    };
  }, [reportRunId]);

  useEffect(() => {
    if (!report) return;
    let cancelled = false;
    apiGetInvoice(report.invoice_id)
      .then((detail) => {
        if (!cancelled) setInvoice(detail);
      })
      .catch(() => {
        // Non-fatal: the report itself is the source of truth.
      });
    return () => {
      cancelled = true;
    };
  }, [report]);

  const decide = async (outcome: 'approved' | 'rejected', reason?: string) => {
    setDeciding(true);
    setDecideError(null);
    try {
      await apiDecide({
        report_id: reportRunId,
        outcome,
        override_reason: reason,
      });
      // Refresh both the report (human_outcome) and the invoice (status).
      const fresh = await apiGetReport(reportRunId);
      setReport(fresh);
    } catch (err) {
      setDecideError(err instanceof Error ? err.message : 'The decision could not be recorded.');
    } finally {
      setDeciding(false);
    }
  };

  const correctFields = async (fields: Record<string, { value: string | null }>) => {
    setCorrecting(true);
    try {
      const result = await apiPatchExtraction(reportRunId, fields);
      setReport(result.report);
    } finally {
      setCorrecting(false);
    }
  };

  const downloadMarkdown = async () => {
    setDownloading(true);
    try {
      await apiDownloadReportMarkdown(reportRunId);
    } catch (err) {
      setDecideError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto py-10 space-y-4">
        <Alert tone="error" title="Could not open this report">{loadError}</Alert>
        <Button variant="secondary" onClick={onGoInvoices}>Back to invoices</Button>
      </div>
    );
  }

  if (!report) {
    return <Spinner label="Loading the validation report…" className="py-24" />;
  }

  const payload = report.report;
  const finalized = report.human_outcome !== null && report.human_outcome !== 'pending';
  const editable = !finalized;

  return (
    <div className="space-y-6 pb-20">
      {/* Breadcrumb header */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 mb-3 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1.5 flex-wrap">
          <FileText className="w-3.5 h-3.5 text-zinc-300" />
          <span className="text-zinc-600 font-medium truncate max-w-sm">{invoice?.original_filename ?? 'Invoice report'}</span>
          {invoice?.case_id && <Badge size="sm" tone="neutral">{invoice.case_id}</Badge>}
          <ChevronRight className="w-3 h-3 text-zinc-300 hidden sm:block" />
          <span className="hidden sm:inline">Validation report</span>
        </div>
        <PageHeader
          title={payload.decision === 'PASS' ? 'This invoice checks out' : payload.decision === 'REVIEW' ? 'Review needed before deciding' : 'This invoice is blocked'}
          description={`Prepared ${formatDateTime(report.created_at)} · Report ${payload.report_id}`}
          actions={
            <Button variant="secondary" onClick={downloadMarkdown} loading={downloading}>
              <Download className="w-4 h-4" />
              Markdown export
            </Button>
          }
        />
      </div>

      <DecisionBanner
        decision={payload.decision}
        confidence={payload.confidence}
        report={payload}
        humanAction={payload.human_action_required}
        humanOutcome={report.human_outcome}
      />

      {decideError && (
        <Alert tone="error" onDismiss={() => setDecideError(null)}>
          {decideError}
        </Alert>
      )}

      {/* Approval gate */}
      {(payload.human_action_required === 'approve' ||
        payload.human_action_required === 'escalate' ||
        payload.human_action_required === 'investigate' ||
        !finalized) && (
        <ApprovalPanel
          report={report}
          isApprover={isApprover}
          busy={deciding}
          error={decideError}
          onDecide={decide}
        />
      )}

      {payload.issues.length > 0 && <IssuesList issues={payload.issues} />}

      <ChecksTable checks={payload.checks} />

      <ExtractionPanel
        extraction={payload.extraction}
        editable={editable}
        busy={correcting}
        onCorrect={correctFields}
      />

      <EvidencePanel evidence={payload.evidence_package} />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-5">
        <p className="text-[11px] text-zinc-400">
          Every claim cites a check and a register record. Report {payload.report_id} · case {payload.case_id ?? '—'}
        </p>
        <Button variant="secondary" size="sm" onClick={onGoInvoices}>
          Go to invoice queue
        </Button>
      </div>
    </div>
  );
};

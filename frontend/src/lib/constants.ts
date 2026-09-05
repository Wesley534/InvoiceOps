import type {
  Confidence,
  ExtractionFieldKey,
  HumanOutcome,
  InvoiceStatus,
  JobStage,
  JobStatus,
  SystemDecision,
} from './types';

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const SYSTEM_DECISION_LABEL: Record<SystemDecision, string> = {
  PASS: 'Pass',
  REVIEW: 'Review',
  BLOCK: 'Block',
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export const HUMAN_OUTCOME_LABEL: Record<HumanOutcome, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  override_block: 'Override — approved',
  pending: 'Awaiting decision',
};

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  RECEIVED: 'Received',
  EXTRACTING: 'Extracting',
  AI_ANALYZED: 'AI analysed',
  VALIDATING: 'Validating',
  CLASSIFIED: 'Classified',
  AWAITING_REVIEW: 'Awaiting review',
  BLOCKED: 'Blocked',
  EXTRACTION_FAILED: 'Extraction failed',
  FAILED: 'Failed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OVERRIDDEN: 'Overridden',
  COMPLETED: 'Completed',
};

/** Queue groups used by the Inbox screen. */
export const QUEUE_GROUPS: Array<{
  id: 'attention' | 'processing' | 'finalized';
  label: string;
  statuses: InvoiceStatus[];
}> = [
  {
    id: 'attention',
    label: 'Needs attention',
    statuses: ['AWAITING_REVIEW', 'BLOCKED', 'EXTRACTION_FAILED'],
  },
  {
    id: 'processing',
    label: 'Processing',
    statuses: [
      'RECEIVED',
      'EXTRACTING',
      'AI_ANALYZED',
      'VALIDATING',
      'CLASSIFIED',
      'FAILED',
    ],
  },
  {
    id: 'finalized',
    label: 'Finalized',
    statuses: ['APPROVED', 'REJECTED', 'OVERRIDDEN', 'COMPLETED'],
  },
];

/** Ordered pipeline stages surfaced while a job runs. */
export const JOB_STAGES: Array<{ stage: JobStage; label: string; hint: string }> = [
  { stage: 'queued', label: 'Queued', hint: 'Waiting for a worker…' },
  { stage: 'intake', label: 'Intake', hint: 'Validating the PDF and storing it safely.' },
  { stage: 'extracting', label: 'Extracting', hint: 'Reading fields and line items from the invoice.' },
  { stage: 'validating', label: 'Validating', hint: 'Running the 11 deterministic checks against master data.' },
  { stage: 'classifying', label: 'Classifying', hint: 'Weighing check results into a recommendation.' },
  { stage: 'reporting', label: 'Reporting', hint: 'Assembling the evidence package.' },
  { stage: 'done', label: 'Done', hint: 'Report ready for review.' },
];

/** Fields that can be corrected on the report screen (gate G1). */
export const EXTRACTION_FIELD_KEYS: ExtractionFieldKey[] = [
  'invoice_number',
  'invoice_date',
  'vendor_name',
  'vendor_tax_pin',
  'po_number',
  'currency',
  'subtotal',
  'tax_rate',
  'tax_amount',
  'total_amount',
  'payment_notes',
];

export const EXTRACTION_FIELD_LABEL: Record<ExtractionFieldKey, string> = {
  invoice_number: 'Invoice number',
  invoice_date: 'Invoice date',
  vendor_name: 'Vendor name',
  vendor_tax_pin: 'Vendor tax PIN',
  po_number: 'Purchase order',
  currency: 'Currency',
  subtotal: 'Subtotal',
  tax_rate: 'Tax rate',
  tax_amount: 'Tax amount',
  total_amount: 'Total amount',
  payment_notes: 'Payment notes',
};

/** Textual label for a single check severity. */
export const SEVERITY_LABEL: Record<string, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

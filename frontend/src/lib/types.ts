/**
 * Domain types mirroring the InvoiceOps FastAPI responses and the JSON
 * contracts in ../contracts/*.schema.json. Types are intentionally narrow
 * where the backend enforces an enum, and deliberately loose for
 * database-backed records whose shape is register-specific.
 */

export type Role = 'reviewer' | 'approver';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface SessionInfo {
  access_token: string;
  role: Role;
  name: string;
  expires_in_seconds: number;
}

/** Flat paginated envelope used by every list endpoint. */
export interface Page<T> {
  success: boolean;
  count: number;
  search: string | null;
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Array<{ field: string; message: string; type?: string }> | unknown;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface Health {
  success: boolean;
  status: string;
  app: string;
  version: string;
  environment: string;
  database: string;
  master_data_loaded: boolean;
  master_data_counts: Record<string, number>;
  llm_enabled: boolean;
}

// ---------------------------------------------------------------------------
// Jobs & invoices
// ---------------------------------------------------------------------------

export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type JobStage =
  | 'queued'
  | 'intake'
  | 'extracting'
  | 'validating'
  | 'classifying'
  | 'reporting'
  | 'done';

export interface Job {
  success: boolean;
  id: string;
  invoice_id: string;
  attempt: number;
  status: JobStatus;
  stage: JobStage;
  progress_pct: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  report_id: string | null;
  decision: string | null;
}

export interface RunSummary {
  id: string;
  report_id: string;
  decision: SystemDecision;
  confidence: Confidence;
  human_outcome: HumanOutcome | null;
}

export interface InvoiceListItem {
  id: string;
  case_id: string | null;
  original_filename: string;
  file_hash: string;
  status: InvoiceStatus;
  received_at: string;
  submitted_by: string | null;
  job: {
    id: string;
    status: JobStatus;
    stage: JobStage;
    progress_pct: number;
    error: string | null;
  } | null;
  run: RunSummary | null;
}

export interface InvoiceDetail extends InvoiceListItem {
  source_path: string;
  extraction: ExtractionPayload | null;
}

// ---------------------------------------------------------------------------
// Reports (contract: contracts/validation_report.schema.json)
// ---------------------------------------------------------------------------

export type SystemDecision = 'PASS' | 'REVIEW' | 'BLOCK';
export type Confidence = 'high' | 'medium' | 'low';
export type HumanOutcome = 'approved' | 'rejected' | 'override_block' | 'pending';
export type HumanActionRequired =
  | 'none'
  | 'confirm_extraction'
  | 'investigate'
  | 'escalate'
  | 'approve';

export type InvoiceStatus =
  | 'RECEIVED'
  | 'EXTRACTING'
  | 'AI_ANALYZED'
  | 'VALIDATING'
  | 'CLASSIFIED'
  | 'AWAITING_REVIEW'
  | 'BLOCKED'
  | 'EXTRACTION_FAILED'
  | 'FAILED'
  | 'APPROVED'
  | 'REJECTED'
  | 'OVERRIDDEN'
  | 'COMPLETED';

export type FieldConfidence = 'high' | 'medium' | 'low' | 'missing';

export interface ExtractionField {
  value: string | null;
  confidence: FieldConfidence;
  source: string;
}

export type ExtractionFieldKey =
  | 'invoice_number'
  | 'invoice_date'
  | 'vendor_name'
  | 'vendor_tax_pin'
  | 'po_number'
  | 'currency'
  | 'subtotal'
  | 'tax_rate'
  | 'tax_amount'
  | 'total_amount'
  | 'payment_notes';

export interface LineItem {
  line_no: number;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  amount: string;
  confidence: FieldConfidence;
  source: string;
}

export interface ExtractionPayload {
  schema_version: string;
  case_id: string;
  source: string;
  extraction_method: string;
  extracted_at: string;
  fields: Partial<Record<ExtractionFieldKey, ExtractionField>>;
  line_items: LineItem[];
  document_quality: { legible: boolean; method: string; notes: string[] };
  extraction_issues: string[];
  prompt_injection_flags: Array<{ pattern: string; snippet: string }>;
}

export type CheckStatus = 'pass' | 'fail' | 'not_applicable' | 'error';

export interface ValidationCheck {
  check_id: string;
  name: string;
  status: CheckStatus;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
  evidence?: string[];
}

export interface ReportIssue {
  check_id: string;
  tier: 'block' | 'review';
  description: string;
  evidence: string[];
}

export interface EvidencePackage {
  vendor: Record<string, unknown> | null;
  po: Record<string, unknown> | null;
  receipts: Record<string, unknown>[];
  history: Record<string, unknown>[];
}

export interface ReportPayload {
  schema_version: string;
  report_id: string;
  case_id: string;
  source: string;
  decision: SystemDecision;
  confidence: Confidence;
  processing_time_seconds: number;
  extraction: ExtractionPayload;
  checks: ValidationCheck[];
  issues: ReportIssue[];
  recommendation: { text: string; tier: 'pass' | 'review' | 'block' };
  human_action_required: HumanActionRequired;
  evidence_package: EvidencePackage;
}

/** Envelope returned by GET /reports/{id}. */
export interface Report {
  success: boolean;
  id: string; // validation-run id
  invoice_id: string;
  job_id: string | null;
  report_id: string; // human RPT-XXXX-XXXX id
  decision: SystemDecision;
  confidence: Confidence;
  invoice_status: InvoiceStatus | null;
  human_outcome: HumanOutcome | null;
  created_at: string;
  report: ReportPayload;
}

// ---------------------------------------------------------------------------
// Master-data registers
// ---------------------------------------------------------------------------

export interface Vendor {
  vendor_id: string;
  legal_name: string;
  trading_name: string | null;
  tax_pin: string | null;
  vat_number: string | null;
  address: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  approved: boolean;
  default_currency: string | null;
  bank_account_identifier: string | null;
  vendor_category: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLine {
  id?: string;
  sort_order: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_treatment: string | null;
  tax_rate: number;
  line_subtotal: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  po_date: string | null;
  currency: string | null;
  description: string | null;
  status: string;
  delivery_status: string | null;
  subtotal: number;
  tax: number;
  total: number;
  lines: PurchaseOrderLine[];
}

export interface GoodsReceipt {
  id: string;
  grn_number: string;
  po_number: string;
  description: string;
  quantity_ordered: number;
  quantity_received: number;
  receipt_date: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessedInvoice {
  id: string;
  internal_id: string;
  invoice_number: string;
  vendor_id: string;
  invoice_date: string | null;
  po_number: string | null;
  currency: string | null;
  total_amount: number;
  processing_status: string | null;
  processing_date: string | null;
  created_at: string;
  updated_at: string;
}

export type MasterEntity = 'vendors' | 'purchase-orders' | 'goods-receipts' | 'processed-invoices';

/** Lightweight queue counters shown in the shell (computed from GET /invoices). */
export interface QueueStats {
  attention: number;
  processing: number;
  total: number;
}


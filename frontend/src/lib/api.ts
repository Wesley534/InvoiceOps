/**
 * API client for the InvoiceOps FastAPI backend.
 *
 * Every HTTP request the app makes lives here — pages and components never
 * build `fetch` calls themselves. The client:
 *   - resolves the base URL from VITE_API_URL (default http://localhost:8000)
 *   - attaches the Bearer token from session storage when present
 *   - normalizes the backend error envelope `{ success:false, error:{...} }`
 *     (and FastAPI's plain `{ detail }` form) into a thrown ApiError
 *   - notifies the auth layer on 401 so the UI can return to the login screen
 */

import type {
  GoodsReceipt,
  Health,
  InvoiceDetail,
  InvoiceListItem,
  Job,
  MasterEntity,
  Page,
  ProcessedInvoice,
  PurchaseOrder,
  Report,
  Role,
  SessionInfo,
  UserRecord,
  Vendor,
} from './types';

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

const TOKEN_KEY = 'invoiceops.access_token';
const USER_KEY = 'invoiceops.user';

// ---------------------------------------------------------------------------
// Session storage helpers (used by the auth context)
// ---------------------------------------------------------------------------

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): UserRecord | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as UserRecord) : null;
  } catch {
    return null;
  }
}

export function storeSession(info: SessionInfo, user: UserRecord): void {
  localStorage.setItem(TOKEN_KEY, info.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getApiBaseUrl(): string {
  return BASE_URL;
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let onUnauthorized: (() => void) | null = null;

/** The auth context registers this so a 401 can drop the session UI-wide. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// ---------------------------------------------------------------------------
// Low-level request helpers
// ---------------------------------------------------------------------------

type QueryValue = string | number | string[] | null | undefined;

function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && item !== undefined && item !== '') search.append(key, item);
      }
    } else if (value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function parseError(response: Response, fallback: string): Promise<ApiError> {
  let message = fallback;
  let code = 'error';
  let details: unknown;
  try {
    const body = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
      detail?: string | Array<{ msg: string }>;
    };
    if (body.error) {
      message = body.error.message ?? fallback;
      code = body.error.code ?? code;
      details = body.error.details;
    } else if (typeof body.detail === 'string') {
      message = body.detail;
    } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
      message = body.detail.map((d) => d.msg).join('; ');
      code = 'validation_error';
      details = body.detail;
    }
  } catch {
    // Non-JSON error body; keep the fallback message.
  }
  return new ApiError(response.status, message, code, details);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const isForm = options.body instanceof FormData;
  if (!isForm && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, `Cannot reach the backend at ${BASE_URL}. Is it running?`, 'unavailable');
  }

  if (response.status === 401) {
    onUnauthorized?.();
    throw await parseError(response, 'Your session has expired. Please sign in again.');
  }
  if (!response.ok) {
    throw await parseError(response, `Request failed (HTTP ${response.status}).`);
  }
  return (await response.json()) as T;
}

async function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

async function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthSession extends SessionInfo {
  user: UserRecord;
}

export async function apiLogin(email: string, password: string): Promise<AuthSession> {
  const info = await post<SessionInfo>('/auth/login', { email, password });
  const user = await apiMe(info.access_token);
  storeSession(info, user);
  return { ...info, user };
}

export async function apiRegister(input: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthSession> {
  const info = await post<SessionInfo>('/auth/register', input);
  const user = await apiMe(info.access_token);
  storeSession(info, user);
  return { ...info, user };
}

export function apiLogout(): void {
  clearSession();
}

export async function apiMe(token?: string): Promise<UserRecord> {
  const previous = getStoredToken();
  if (token && token !== previous) localStorage.setItem(TOKEN_KEY, token);
  try {
    return await get<UserRecord>('/auth/me');
  } finally {
    if (token && token !== previous) {
      if (previous) localStorage.setItem(TOKEN_KEY, previous);
      else localStorage.removeItem(TOKEN_KEY);
    }
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function apiHealth(): Promise<Health> {
  return get<Health>('/health');
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export interface InvoiceListParams {
  page?: number;
  size?: number;
  q?: string;
  /** Single status or repeated statuses (e.g. both sides of a queue group). */
  status?: string | string[];
}

export async function apiListInvoices(params: InvoiceListParams = {}): Promise<Page<InvoiceListItem>> {
  return get<Page<InvoiceListItem>>(
    `/invoices${buildQuery({
      page: params.page ?? 1,
      size: params.size ?? 10,
      q: params.q,
      status: params.status,
    })}`,
  );
}

export async function apiGetInvoice(invoiceId: string): Promise<InvoiceDetail> {
  return get<InvoiceDetail>(`/invoices/${encodeURIComponent(invoiceId)}`);
}

export interface UploadResult {
  success: boolean;
  invoice_id: string;
  job_id: string;
}

export async function apiUploadInvoice(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', file);
  return request<UploadResult>('/invoices', { method: 'POST', body: form });
}

export async function apiRetryInvoice(invoiceId: string): Promise<UploadResult> {
  return post<UploadResult>(`/invoices/${encodeURIComponent(invoiceId)}/retry`);
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function apiGetJob(jobId: string): Promise<Job> {
  return get<Job>(`/jobs/${encodeURIComponent(jobId)}`);
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function apiGetReport(reportId: string): Promise<Report> {
  return get<Report>(`/reports/${encodeURIComponent(reportId)}`);
}

export async function apiPatchExtraction(
  reportId: string,
  fields: Record<string, { value: string | null }>,
): Promise<{ success: boolean; report: Report; revalidated: boolean }> {
  return patch(`/reports/${encodeURIComponent(reportId)}/extraction`, { fields });
}

/** Download the markdown export as a file (needs the auth header, so it
 * cannot be a plain link). */
export async function apiDownloadReportMarkdown(reportId: string): Promise<void> {
  const token = getStoredToken();
  const response = await fetch(
    `${BASE_URL}/reports/${encodeURIComponent(reportId)}/markdown`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) {
    throw await parseError(response, 'Failed to download the report.');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `report-${reportId}.md`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export interface DecisionInput {
  report_id: string;
  outcome: 'approved' | 'rejected';
  override_reason?: string | null;
  notes?: string | null;
}

export async function apiDecide(input: DecisionInput): Promise<Record<string, unknown>> {
  return post('/decide', input);
}

// ---------------------------------------------------------------------------
// Master data — generic list/create/update/remove per register entity
// ---------------------------------------------------------------------------

export interface PageParams {
  page?: number;
  size?: number;
  q?: string;
  [key: string]: QueryValue;
}

type EntityRow = Vendor | PurchaseOrder | GoodsReceipt | ProcessedInvoice;

export async function apiListMaster<T extends EntityRow>(
  entity: MasterEntity,
  params: PageParams = {},
): Promise<Page<T>> {
  return get<Page<T>>(
    `/master-data/${entity}${buildQuery({ page: params.page ?? 1, size: params.size ?? 10, ...params })}`,
  );
}

export async function apiCreateMaster<T extends EntityRow>(
  entity: MasterEntity,
  payload: Record<string, unknown>,
): Promise<T & { success: boolean }> {
  return post<T & { success: boolean }>(`/master-data/${entity}`, payload);
}

export async function apiUpdateMaster<T extends EntityRow>(
  entity: MasterEntity,
  key: string,
  payload: Record<string, unknown>,
): Promise<T & { success: boolean }> {
  return patch<T & { success: boolean }>(
    `/master-data/${entity}/${encodeURIComponent(key)}`,
    payload,
  );
}

export async function apiDeleteMaster(
  entity: MasterEntity,
  key: string,
): Promise<{ success: boolean; detail: string }> {
  return del(`/master-data/${entity}/${encodeURIComponent(key)}`);
}

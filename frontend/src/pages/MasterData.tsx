import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  FileText,
  History,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { apiCreateMaster, apiDeleteMaster, apiListMaster, apiUpdateMaster } from '../lib/api';
import type { MasterEntity, Page } from '../lib/types';
import { formatDate, formatMoney, formatNumber } from '../lib/format';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState, Spinner } from '../components/ui/Spinner';
import { Pagination } from '../components/ui/Pagination';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { Field, TextInput, Select } from '../components/ui/Field';
import { Segmented } from '../components/ui/Segmented';
import { cn } from '../lib/utils';

// ---------------------------------------------------------------------------
// Form field & column schemas per register
// ---------------------------------------------------------------------------

type FieldType = 'text' | 'number' | 'date' | 'checkbox' | 'lines' | 'select';

interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  createOnly?: boolean; // not editable once created
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  min?: number;
  step?: number;
}

interface ColumnSpec<T = Record<string, unknown>> {
  label: string;
  render: (row: T) => React.ReactNode;
}

interface RegisterConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  id: MasterEntity;
  label: string;
  icon: React.ElementType;
  keyField: string; // natural key used in /master-data/{entity}/{key}
  searchPlaceholder: string;
  columns: ColumnSpec<T>[];
  fields: FieldSpec[];
}

type Row = Record<string, unknown>;

const money = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : formatMoney(Number(value)));
const date = (value: unknown) => (value ? formatDate(String(value)) : '—');
const qty = (value: unknown) => (value === null || value === undefined || value === '' ? '—' : formatNumber(Number(value)));

function textCell(key: string) {
  return (row: Row) => <span className="font-medium text-zinc-800">{String(row[key] ?? '') || '—'}</span>;
}
function idCell(key: string) {
  return (row: Row) => {
    const value = String(row[key] ?? '');
    if (!value) return '—';
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-md border border-brand/15 bg-mint px-1.5 py-[3px] font-mono text-[11px] font-semibold leading-none text-brand-deep">
        {value}
      </span>
    );
  };
}
function moneyCell(key: string) {
  return (row: Row) => <span className="font-mono tabular-nums">{money(row[key])}</span>;
}
function statusCell(key: string) {
  return (row: Row) => {
    const value = row[key];
    if (!value) return '—';
    const tone: 'mint' | 'amber' | 'neutral' =
      value === 'Open' || value === 'Paid' || value === 'active'
        ? 'mint'
        : value === 'Closed'
          ? 'neutral'
          : 'amber';
    return (
      <Badge size="sm" tone={tone}>
        {String(value)}
      </Badge>
    );
  };
}
function approvedCell(key: string) {
  return (row: Row) =>
    row[key] ? (
      <Badge size="sm" tone="mint">Approved</Badge>
    ) : (
      <Badge size="sm" tone="signal">Not approved</Badge>
    );
}
function lineCountCell() {
  return (row: Row) => (
    <Badge size="sm" tone="neutral">
      {(Array.isArray(row.lines) ? row.lines.length : 0)} lines
    </Badge>
  );
}

const CONFIGS: RegisterConfig[] = [
  {
    id: 'vendors',
    label: 'Vendors',
    icon: Building2,
    keyField: 'vendor_id',
    searchPlaceholder: 'Search code or name…',
    columns: [
      { label: 'Code', render: idCell('vendor_id') },
      { label: 'Legal name', render: textCell('legal_name') },
      { label: 'Trading name', render: textCell('trading_name') },
      { label: 'Email', render: (row) => <span className="text-zinc-500">{String(row.contact_email ?? '') || '—'}</span> },
      { label: 'Currency', render: (row) => <code className="font-mono text-xs">{String(row.default_currency ?? '') || '—'}</code> },
      { label: 'Category', render: textCell('vendor_category') },
      { label: 'Status', render: approvedCell('approved') },
    ],
    fields: [
      { name: 'vendor_id', label: 'Vendor code', type: 'text', required: true, createOnly: true, placeholder: 'V-999' },
      { name: 'legal_name', label: 'Legal name', type: 'text', required: true, placeholder: 'Pacific Trading Company Inc' },
      { name: 'trading_name', label: 'Trading name', type: 'text', placeholder: 'Pacific Trading' },
      { name: 'tax_pin', label: 'Tax PIN', type: 'text' },
      { name: 'vat_number', label: 'VAT number', type: 'text' },
      { name: 'address', label: 'Address', type: 'text' },
      { name: 'contact_email', label: 'Contact email', type: 'text' },
      { name: 'contact_phone', label: 'Contact phone', type: 'text' },
      { name: 'default_currency', label: 'Default currency', type: 'text', placeholder: 'USD', hint: 'ISO 4217 code (USD, EUR, KES…)' },
      { name: 'bank_account_identifier', label: 'Bank account', type: 'text' },
      { name: 'vendor_category', label: 'Vendor category', type: 'text' },
      { name: 'approved', label: 'Approved vendor', type: 'checkbox' },
    ],
  },
  {
    id: 'purchase-orders',
    label: 'Purchase orders',
    icon: FileText,
    keyField: 'po_number',
    searchPlaceholder: 'Search PO number…',
    columns: [
      { label: 'PO number', render: idCell('po_number') },
      { label: 'Vendor', render: idCell('vendor_id') },
      { label: 'Date', render: (row) => date(row.po_date) },
      { label: 'Currency', render: (row) => <code className="font-mono text-xs">{String(row.currency ?? '') || '—'}</code> },
      { label: 'Status', render: statusCell('status') },
      { label: 'Subtotal', render: moneyCell('subtotal') },
      { label: 'Total', render: moneyCell('total') },
      { label: 'Lines', render: lineCountCell() },
    ],
    fields: [
      { name: 'po_number', label: 'PO number', type: 'text', required: true, createOnly: true, placeholder: 'PO-1001' },
      { name: 'vendor_id', label: 'Vendor code', type: 'text', required: true, placeholder: 'V-002', hint: 'The vendor must exist first.' },
      { name: 'po_date', label: 'PO date', type: 'date' },
      { name: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
      { name: 'description', label: 'Description', type: 'text' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'Open', label: 'Open' },
          { value: 'Closed', label: 'Closed' },
          { value: 'Cancelled', label: 'Cancelled' },
          { value: 'Partially Delivered', label: 'Partially delivered' },
        ],
      },
      { name: 'delivery_status', label: 'Delivery status', type: 'text' },
      {
        name: 'lines',
        label: 'Line items',
        type: 'lines',
        required: true,
        hint: 'Totals are computed from the lines server-side — you do not enter them.',
      },
    ],
  },
  {
    id: 'goods-receipts',
    label: 'Goods receipts',
    icon: PackageCheck,
    keyField: 'id',
    searchPlaceholder: 'Search GRN number…',
    columns: [
      { label: 'GRN', render: idCell('grn_number') },
      { label: 'PO', render: idCell('po_number') },
      { label: 'Description', render: textCell('description') },
      { label: 'Ordered', render: (row) => qty(row.quantity_ordered) },
      { label: 'Received', render: (row) => <span className="font-bold tabular-nums">{qty(row.quantity_received)}</span> },
      { label: 'Date', render: (row) => date(row.receipt_date) },
      { label: 'Status', render: statusCell('status') },
    ],
    fields: [
      { name: 'grn_number', label: 'GRN number', type: 'text', required: true, createOnly: true, placeholder: 'GRN-2026-0451' },
      { name: 'po_number', label: 'PO number', type: 'text', required: true, createOnly: true, placeholder: 'PO-1001' },
      { name: 'description', label: 'Description', type: 'text', required: true },
      { name: 'quantity_ordered', label: 'Quantity ordered', type: 'number', required: true, min: 0 },
      { name: 'quantity_received', label: 'Quantity received', type: 'number', required: true, min: 0 },
      { name: 'receipt_date', label: 'Receipt date', type: 'date' },
      { name: 'status', label: 'Status', type: 'text', placeholder: 'e.g. Received' },
    ],
  },
  {
    id: 'processed-invoices',
    label: 'Processed invoices',
    icon: History,
    keyField: 'internal_id',
    searchPlaceholder: 'Search invoice number…',
    columns: [
      { label: 'Internal id', render: idCell('internal_id') },
      { label: 'Invoice number', render: idCell('invoice_number') },
      { label: 'Vendor', render: idCell('vendor_id') },
      { label: 'PO', render: (row) => <code className="font-mono text-[11px] text-zinc-600">{String(row.po_number ?? '') || '—'}</code> },
      { label: 'Invoice date', render: (row) => date(row.invoice_date) },
      { label: 'Currency', render: (row) => <code className="font-mono text-xs">{String(row.currency ?? '') || '—'}</code> },
      { label: 'Total', render: moneyCell('total_amount') },
      { label: 'Status', render: statusCell('processing_status') },
    ],
    fields: [
      { name: 'internal_id', label: 'Internal id', type: 'text', required: true, createOnly: true, placeholder: 'PI-2026-0001' },
      { name: 'invoice_number', label: 'Invoice number', type: 'text', required: true, placeholder: 'MT-2026-0847' },
      { name: 'vendor_id', label: 'Vendor code', type: 'text', required: true, placeholder: 'V-002' },
      { name: 'po_number', label: 'PO number', type: 'text', placeholder: 'PO-1001' },
      { name: 'invoice_date', label: 'Invoice date', type: 'date' },
      { name: 'currency', label: 'Currency', type: 'text', placeholder: 'USD' },
      { name: 'total_amount', label: 'Total amount', type: 'number', required: true, min: 0, step: 0.01 },
      { name: 'processing_status', label: 'Processing status', type: 'text', placeholder: 'e.g. Paid' },
      { name: 'processing_date', label: 'Processing date', type: 'date' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface LineDraft {
  key: string;
  description: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  tax_treatment: string;
}

function buildFormState(fields: FieldSpec[], row: Row | null): Record<string, string> {
  const state: Record<string, string> = {};
  for (const field of fields) {
    const value = row?.[field.name];
    if (field.type === 'checkbox') state[field.name] = String(Boolean(value));
    else state[field.name] = value === null || value === undefined ? '' : String(value);
  }
  return state;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const MasterData: React.FC = () => {
  const [entity, setEntity] = useState<MasterEntity>('vendors');
  const config = CONFIGS.find((c) => c.id === entity) ?? CONFIGS[0];

  const [rows, setRows] = useState<Row[]>([]);
  const [pageMeta, setPageMeta] = useState<Page<unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row: Row | null } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  const [bulking, setBulking] = useState(false);

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiListMaster(entity, { page: targetPage, size: 10, q: q || undefined });
        setRows(result.items.map((item) => item as unknown as Row));
        setPageMeta(result);
        setSelected(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load the register.');
      } finally {
        setLoading(false);
      }
    },
    [entity, q],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  const switchEntity = (next: MasterEntity) => {
    setEntity(next);
    setQ('');
    setSearchInput('');
    setPageMeta(null);
    setSelected(new Set());
  };

  const pageKeys = rows.map((row) => String(row[config.keyField] ?? '')).filter(Boolean);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every((key) => selected.has(key));

  const toggleKey = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const togglePageSelection = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of pageKeys) {
        if (allPageSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });

  const bulkDelete = async () => {
    const targets = pageKeys.filter((key) => selected.has(key));
    if (targets.length === 0) return;
    const noun = config.label.slice(0, -1);
    const label = targets.length === 1 ? noun : config.label.toLowerCase();
    if (
      !window.confirm(
        `Delete ${targets.length} ${label} (${targets.length <= 3 ? targets.join(', ') : `${targets.slice(0, 3).join(', ')}…`})? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulking(true);
    setBulkNote(null);
    const failures: string[] = [];
    let done = 0;
    for (const key of targets) {
      try {
        await apiDeleteMaster(entity, key);
        done += 1;
      } catch (err) {
        failures.push(err instanceof Error ? err.message : key);
      }
    }
    setBulking(false);
    setSelected(new Set());
    if (failures.length === 0) {
      setBulkNote(`Deleted ${done} ${done === 1 ? noun.toLowerCase() : label}.`);
    } else {
      setBulkNote(`Deleted ${done}; ${failures.length} could not be deleted (${failures[0]}).`);
    }
    await load();
  };

  const openCreate = () => {
    setModal({ mode: 'create', row: null });
    setForm(buildFormState(config.fields, null));
    setLines(initialLines());
    setFormError(null);
  };

  const openEdit = (row: Row) => {
    setModal({ mode: 'edit', row });
    setForm(buildFormState(config.fields, row));
    setLines(
      Array.isArray(row.lines)
        ? (row.lines as Array<{ description: string; quantity: number | string; unit_price: number | string; tax_rate: number | string; tax_treatment?: string | null }>).map((l) => ({
            key: `l-${Math.random().toString(36).slice(2, 7)}`,
            description: l.description,
            quantity: String(l.quantity),
            unit_price: String(l.unit_price),
            tax_rate: String(l.tax_rate ?? '0'),
            tax_treatment: l.tax_treatment ?? '',
          }))
        : initialLines(),
    );
    setFormError(null);
  };

  const initialLines = (): LineDraft[] => [
    { key: `l-${Math.random().toString(36).slice(2, 7)}`, description: '', quantity: '', unit_price: '', tax_rate: '0', tax_treatment: '' },
  ];

  const closeModal = () => {
    setModal(null);
    setFormError(null);
  };

  const setField = (name: string, value: string) => setForm((prev) => ({ ...prev, [name]: value }));

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const save = async () => {
    setFormError(null);
    // Validate required fields
    for (const field of config.fields) {
      if (!field.required) continue;
      if (field.type === 'lines') {
        const validLines = lines.filter((line) => line.description.trim());
        if (validLines.length === 0) {
          setFormError('Add at least one line item.');
          return;
        }
        continue;
      }
      const value = form[field.name] ?? '';
      if (field.type === 'checkbox') continue;
      if (!value.trim()) {
        setFormError(`“${field.label}” is required.`);
        return;
      }
    }

    // Assemble payload
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      if (field.createOnly && modal?.mode === 'edit') continue;
      const raw = form[field.name] ?? '';
      if (field.type === 'checkbox') {
        payload[field.name] = raw === 'true';
      } else if (field.type === 'number') {
        if (raw === '') {
          if (field.required) return;
          payload[field.name] = null;
        } else {
          const num = Number(raw);
          if (!Number.isFinite(num)) {
            setFormError(`“${field.label}” must be a number.`);
            return;
          }
          payload[field.name] = num;
        }
      } else if (field.type === 'date') {
        payload[field.name] = raw === '' ? null : raw;
      } else if (field.type === 'lines') {
        if (modal?.mode === 'create' || modal?.mode === 'edit') {
          const valid = lines.filter((line) => line.description.trim());
          payload[field.name] = valid.map((line) => {
            const quantity = Number(line.quantity);
            const unitPrice = Number(line.unit_price);
            const taxRate = line.tax_rate === '' ? 0 : Number(line.tax_rate);
            const out: Record<string, unknown> = {
              description: line.description.trim(),
              quantity,
              unit_price: unitPrice,
              tax_rate: Number.isFinite(taxRate) ? taxRate : 0,
            };
            if (line.tax_treatment.trim()) out.tax_treatment = line.tax_treatment.trim();
            return out;
          });
        }
      } else if (field.type === 'select') {
        payload[field.name] = raw === '' ? null : raw;
      } else if (field.type === 'text') {
        // Email/plain text — blank optional strings become null when the field is optional
        payload[field.name] = raw.trim() === '' && !field.required ? null : raw.trim() === '' && field.required ? null : raw.trim();
        if (field.required && raw.trim() === '') return;
      }
    }

    setSaving(true);
    try {
      const key = modal?.row ? String((modal.row as Row)[config.keyField] ?? '') : '';
      if (modal?.mode === 'edit') {
        // Remove create-only payload keys (backend PATCH ignores them anyway) and nulls that
        // would clobber existing values — only send what changed meaningfully.
        const cleaned: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(payload)) {
          if (v === null) continue;
          const original = (modal.row as Row)[k];
          if (k === 'lines' || JSON.stringify(v) !== JSON.stringify(original)) cleaned[k] = v;
        }
        await apiUpdateMaster(entity, key, cleaned);
      } else {
        await apiCreateMaster(entity, payload);
      }
      closeModal();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    const key = String(row[config.keyField] ?? '');
    if (!window.confirm(`Delete ${config.label.slice(0, -1)} ${key}? This cannot be undone.`)) return;
    try {
      await apiDeleteMaster(entity, key);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const editableFields = useMemo(
    () => (modal ? config.fields.filter((f) => !(f.createOnly && modal.mode === 'edit')) : []),
    [config, modal],
  );

  const searchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQ(searchInput.trim());
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Reference registers"
        title="Master data"
        description="The registers every validation run checks against: vendors, purchase orders, goods receipts and processed-invoice history. Writes are audited."
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Add {config.label === 'Goods receipts' ? 'receipt' : config.label === 'Purchase orders' ? 'purchase order' : config.label === 'Processed invoices' ? 'record' : 'vendor'}
          </Button>
        }
      />

      {error && (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Segmented<MasterEntity>
        value={entity}
        onChange={switchEntity}
        options={CONFIGS.map((c) => ({ value: c.id, label: c.label }))}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <form onSubmit={searchSubmit} className="relative w-full sm:w-96">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={config.searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/25 transition-colors"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setSearchInput('');
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 hover:text-zinc-700"
            >
              Clear
            </button>
          )}
        </form>
        <Button variant="secondary" size="sm" onClick={() => load()} loading={loading}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <Spinner label={`Loading ${config.label.toLowerCase()}…`} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<config.icon className="w-5 h-5" />}
          title={`No ${config.label.toLowerCase()} found`}
          description={q ? 'Try a different search.' : 'Add your first record to keep the registers healthy.'}
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" /> Add {config.label.slice(0, -1)}
            </Button>
          }
        />
      ) : (
        <>
          {bulkNote && (
            <Alert
              tone={bulkNote.startsWith('Deleted') && !bulkNote.includes('could not') ? 'success' : 'warning'}
              onDismiss={() => setBulkNote(null)}
            >
              {bulkNote}
            </Alert>
          )}

          <Card padded={false}>
            {/* Bulk toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-zinc-100 bg-zinc-50/70">
              <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelection}
                  aria-label={`Select all ${config.label.toLowerCase()} on this page`}
                  className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand/30 accent-brand cursor-pointer"
                />
                Select all on this page ({pageKeys.length})
              </label>
              {selected.size > 0 ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">{selected.size} selected</span>
                  <Button size="xs" variant="danger" onClick={bulkDelete} loading={bulking}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete {selected.size}
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-zinc-400">Tick rows for bulk deletion.</span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] min-w-[1000px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-zinc-100 bg-white">
                    <th className="w-12 px-3 py-4 text-center">
                      <span className="sr-only">Select</span>
                    </th>
                    {config.columns.map((column, index) => (
                      <th key={index} className="px-6 py-4 font-extrabold whitespace-nowrap">{column.label}</th>
                    ))}
                    <th className="px-6 py-4 font-extrabold text-right pr-7 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((row, index) => {
                    const rowKey = String(row[config.keyField] ?? '');
                    return (
                    <tr key={index} className="hover:bg-mint/25 transition-colors">
                      <td className="px-3 py-4 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={rowKey !== '' && selected.has(rowKey)}
                          onChange={() => toggleKey(rowKey)}
                          disabled={rowKey === ''}
                          aria-label={`Select row ${rowKey || index + 1}`}
                          className="w-4 h-4 rounded border-zinc-300 text-brand focus:ring-brand/30 accent-brand cursor-pointer disabled:opacity-40"
                        />
                      </td>
                      {config.columns.map((column, colIndex) => (
                        <td key={colIndex} className="px-6 py-4 align-middle font-medium">{column.render(row)}</td>
                      ))}
                      <td className="px-6 py-4 align-middle pr-7">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(row)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => remove(row)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-signal hover:bg-signal-soft transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          {pageMeta && pageMeta.total > 0 && (
            <Pagination page={pageMeta} onPageChange={(page) => load(page)} />
          )}
        </>
      )}

      {/* Create / edit modal */}
      <Modal
        open={modal !== null}
        onClose={closeModal}
        title={modal?.mode === 'edit' ? `Edit ${config.label.slice(0, -1).toLowerCase()}` : `Add ${config.label.slice(0, -1).toLowerCase()}`}
        subtitle={config.fields.filter((f) => f.createOnly).map((f) => f.label).join(', ') ? 'Natural keys cannot be changed after creation.' : undefined}
        wide={config.fields.some((f) => f.type === 'lines')}
        footer={
          <>
            <Button variant="ghost" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              {modal?.mode === 'edit' ? 'Save changes' : 'Create record'}
            </Button>
          </>
        }
      >
        {formError && (
          <Alert tone="error" className="mb-4" onDismiss={() => setFormError(null)}>
            {formError}
          </Alert>
        )}
        <div className={cn('grid gap-4', config.fields.some((f) => f.type === 'lines') ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
          {editableFields.map((field) => {
            if (field.type === 'lines') {
              return (
                <div key={field.name} className="sm:col-span-2 space-y-2.5">
                  <Field label={field.label} required={field.required} hint={field.hint}>
                    <div className="space-y-2">
                      {lines.map((line) => (
                        <div key={line.key} className="grid grid-cols-12 gap-2 rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5">
                          <div className="col-span-12">
                            <input
                              value={line.description}
                              onChange={(e) => updateLine(line.key, { description: e.target.value })}
                              placeholder="Description"
                              className={cn(inputMini)}
                              aria-label="Line description"
                            />
                          </div>
                          <div className="col-span-4">
                            <input
                              type="number"
                              min={0}
                              value={line.quantity}
                              onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                              placeholder="Qty"
                              className={cn(inputMini, 'font-mono')}
                              aria-label="Quantity"
                            />
                          </div>
                          <div className="col-span-4">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.unit_price}
                              onChange={(e) => updateLine(line.key, { unit_price: e.target.value })}
                              placeholder="Unit price"
                              className={cn(inputMini, 'font-mono')}
                              aria-label="Unit price"
                            />
                          </div>
                          <div className="col-span-3">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.tax_rate}
                              onChange={(e) => updateLine(line.key, { tax_rate: e.target.value })}
                              placeholder="Tax rate"
                              className={cn(inputMini, 'font-mono')}
                              aria-label="Tax rate (0.1 = 10%)"
                            />
                          </div>
                          <div className="col-span-1 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                              disabled={lines.length <= 1}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-signal hover:bg-signal-soft transition-colors disabled:opacity-30"
                              aria-label="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => [...prev, initialLines()[0]])}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-deep hover:text-brand"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add line
                    </button>
                  </Field>
                </div>
              );
            }

            return (
              <div key={field.name} className={cn(field.type === 'checkbox' && 'flex items-end', field.type === 'text' && (field.name === 'address' || field.name === 'bank_account_identifier') && 'sm:col-span-2')}>
                <Field label={field.label} required={field.required} hint={field.hint}>
                  {field.type === 'checkbox' ? (
                    <button
                      type="button"
                      onClick={() => setField(field.name, form[field.name] === 'true' ? 'false' : 'true')}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors w-full',
                        form[field.name] === 'true'
                          ? 'bg-mint border-brand/40 text-brand-deep'
                          : 'bg-zinc-50 border-zinc-200 text-zinc-500',
                      )}
                    >
                      <span
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                          form[field.name] === 'true' ? 'bg-brand border-brand' : 'bg-white border-zinc-300',
                        )}
                      >
                        {form[field.name] === 'true' && <span className="text-white text-[10px] leading-none">✓</span>}
                      </span>
                      {form[field.name] === 'true' ? 'Yes' : 'No'}
                    </button>
                  ) : field.type === 'select' ? (
                    <Select
                      value={form[field.name] ?? ''}
                      onChange={(e) => setField(field.name, e.target.value)}
                    >
                      <option value="">— None —</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                      min={field.min}
                      step={field.step}
                      value={form[field.name] ?? ''}
                      onChange={(e) => setField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      disabled={Boolean(field.createOnly && modal?.mode === 'edit')}
                    />
                  )}
                </Field>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};

const inputMini =
  'w-full bg-white border border-zinc-300 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/25 transition-colors';

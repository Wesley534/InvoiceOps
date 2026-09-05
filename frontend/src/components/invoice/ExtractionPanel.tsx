import React, { useEffect, useState } from 'react';
import { FileWarning, Pencil, Save, X, ShieldAlert } from 'lucide-react';
import type { ExtractionFieldKey, ExtractionPayload } from '../../lib/types';
import {
  EXTRACTION_FIELD_KEYS,
  EXTRACTION_FIELD_LABEL,
} from '../../lib/constants';
import { formatMoney, formatNumber, formatRate } from '../../lib/format';
import { cn } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FieldConfidenceDot } from '../ui/StatusBadges';
import { TextInput } from '../ui/Field';

interface ExtractionPanelProps {
  extraction: ExtractionPayload;
  /** Whether the reviewer may correct extracted fields (gate G1). */
  editable: boolean;
  busy?: boolean;
  onCorrect: (fields: Record<string, { value: string | null }>) => Promise<void>;
}

function displayValue(key: ExtractionFieldKey, value: string | null): string {
  if (value === null || value === '') return '—';
  if (key === 'subtotal' || key === 'tax_amount' || key === 'total_amount') {
    return formatMoney(value);
  }
  if (key === 'tax_rate') return formatRate(value);
  return value;
}

/** Extracted invoice fields (editable by reviewers, gate G1) + line items. */
export const ExtractionPanel: React.FC<ExtractionPanelProps> = ({
  extraction,
  editable,
  busy,
  onCorrect,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    const next: Record<string, string> = {};
    for (const key of EXTRACTION_FIELD_KEYS) {
      const field = extraction.fields[key];
      next[key] = field?.value ?? '';
    }
    setDraft(next);
    setError(null);
  }, [editing, extraction.fields]);

  const beginEdit = () => {
    if (!editable || editing) return;
    const next: Record<string, string> = {};
    for (const key of EXTRACTION_FIELD_KEYS) {
      next[key] = extraction.fields[key]?.value ?? '';
    }
    setDraft(next);
    setEditing(true);
    setError(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const fields: Record<string, { value: string | null }> = {};
    for (const key of EXTRACTION_FIELD_KEYS) {
      const raw = (draft[key] ?? '').trim();
      fields[key] = { value: raw === '' ? null : raw };
    }
    try {
      await onCorrect(fields);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save corrections.');
    }
  };

  const lowConfidenceCount =
    EXTRACTION_FIELD_KEYS.filter(
      (key) => extraction.fields[key]?.confidence === 'low' || extraction.fields[key]?.confidence === 'missing',
    ).length;

  return (
    <div className="space-y-5">
      <Card
        header={{
          icon: <Pencil className="w-4 h-4" />,
          title: 'Extracted invoice fields',
          subtitle: `Method: ${extraction.extraction_method.replaceAll('_', ' ')} · ${
            extraction.document_quality.legible ? 'Document legible' : 'Document degraded'
          }`,
          actions: editable && !editing ? (
            <Button size="sm" variant="secondary" onClick={beginEdit}>
              <Pencil className="w-3.5 h-3.5" />
              {lowConfidenceCount > 0 ? `Correct fields (${lowConfidenceCount})` : 'Correct fields'}
            </Button>
          ) : editing ? (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={submit} loading={busy}>
                <Save className="w-3.5 h-3.5" /> Re-validate
              </Button>
            </div>
          ) : undefined,
        }}
      >
        {error && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-signal-deep bg-signal-soft border border-signal/30 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        {editing && (
          <p className="mb-4 text-[11px] text-zinc-500 bg-mint border border-brand/20 rounded-lg px-3 py-2">
            Editing re-runs the checks and updates the decision. Leave a field blank to mark it missing — the
            system will never guess a value for you.
          </p>
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-4">
          {EXTRACTION_FIELD_KEYS.map((key) => {
            const field = extraction.fields[key];
            const value = field?.value ?? null;
            const confidence = field?.confidence ?? 'missing';

            return (
              <div key={key} className="min-w-0">
                <dt className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between gap-2">
                  {EXTRACTION_FIELD_LABEL[key]}
                  <FieldConfidenceDot confidence={confidence} />
                </dt>
                {editing ? (
                  <TextInput
                    value={draft[key] ?? ''}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="mt-1.5 !py-1.5 text-sm font-medium"
                    placeholder={confidence === 'missing' ? 'Missing — enter a value or leave blank' : ''}
                    aria-label={`Correct ${EXTRACTION_FIELD_LABEL[key]}`}
                  />
                ) : (
                  <dd
                    className={cn(
                      'mt-1 text-sm font-medium text-zinc-900 break-words',
                      value === null && 'italic text-zinc-400 font-normal',
                      confidence === 'low' && 'text-amber-900',
                      confidence === 'missing' && 'text-signal-deep',
                    )}
                  >
                    {displayValue(key, value)}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>

        {/* Line items */}
        <div className="mt-6 pt-5 border-t border-zinc-100">
          <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider mb-2.5">
            Line items ({extraction.line_items.length})
          </h3>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-left text-xs min-w-[560px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-200">
                  <th className="px-2 py-2 font-bold">#</th>
                  <th className="px-2 py-2 font-bold">Description</th>
                  <th className="px-2 py-2 font-bold text-right">Qty</th>
                  <th className="px-2 py-2 font-bold text-right">Unit price</th>
                  <th className="px-2 py-2 font-bold text-right">Tax</th>
                  <th className="px-2 py-2 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {extraction.line_items.map((line) => (
                  <tr key={line.line_no}>
                    <td className="px-2 py-2 font-mono text-zinc-400">{line.line_no}</td>
                    <td className="px-2 py-2 font-medium text-zinc-800 max-w-[260px]">
                      <span className="line-clamp-2">{line.description}</span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{formatNumber(line.quantity)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{formatMoney(line.unit_price)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{formatRate(line.tax_rate)}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums font-bold">{formatMoney(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Extraction issues & quality notes */}
      {(extraction.extraction_issues.length > 0 || extraction.document_quality.notes.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <FileWarning className="w-3.5 h-3.5" /> Extraction notes
          </h3>
          <ul className="space-y-1 text-xs text-amber-950/80 list-disc pl-4">
            {extraction.document_quality.notes.map((note, index) => (
              <li key={`note-${index}`}>{note}</li>
            ))}
            {extraction.extraction_issues.map((issue, index) => (
              <li key={`issue-${index}`}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Prompt-injection flags */}
      {extraction.prompt_injection_flags.length > 0 && (
        <div className="rounded-xl border border-signal/40 bg-signal-soft p-4">
          <h3 className="text-xs font-bold text-signal-deep uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" /> Anomalous instruction content detected
          </h3>
          <ul className="space-y-1.5">
            {extraction.prompt_injection_flags.map((flag, index) => (
              <li key={index} className="text-xs text-zinc-700">
                <Badge tone="signal" size="sm">{flag.pattern}</Badge>
                <span className="ml-2 font-mono text-[11px]">“{flag.snippet}”</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

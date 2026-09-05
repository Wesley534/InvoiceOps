import React from 'react';
import { Building2, FileText, PackageCheck, History } from 'lucide-react';
import type { EvidencePackage } from '../../lib/types';
import { formatDate, formatMoney, humanizeKey, formatNumber, formatRate } from '../../lib/format';
import { Card } from '../ui/Card';
import { cn } from '../../lib/utils';

interface EvidencePanelProps {
  evidence: EvidencePackage;
}

const TITLES = {
  vendor: { icon: Building2, label: 'Vendor register', singular: true },
  po: { icon: FileText, label: 'Purchase order', singular: true },
  receipts: { icon: PackageCheck, label: 'Goods receipts' },
  history: { icon: History, label: 'Processed-invoice history' },
};

/** Render a loose register record as readable key/value chips. */
function RecordGrid({ record }: { record: Record<string, unknown> }) {
  const entries = Object.entries(record).filter(
    ([key, value]) =>
      value !== null &&
      value !== undefined &&
      value !== '' &&
      !['created_at', 'updated_at', 'id', 'sort_order'].includes(key) &&
      !(Array.isArray(value) && value.length === 0),
  );

  if (entries.length === 0) return <p className="text-xs italic text-zinc-400">No details recorded.</p>;

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
      {entries.map(([key, value]) => {
        let display: string;
        if (key === 'po_date' || key === 'receipt_date' || key === 'invoice_date' || key === 'processing_date' || key.endsWith('_at')) {
          display = formatDate(String(value));
        } else if (['total', 'subtotal', 'tax', 'amount', 'unit_price', 'total_amount'].includes(key) || key.endsWith('_amount') || key.endsWith('_price')) {
          display = formatMoney(Number(value));
        } else if (key.endsWith('_rate') && typeof value === 'number' && value <= 1) {
          display = formatRate(value);
        } else if (['quantity', 'quantity_ordered', 'quantity_received', 'line_no'].includes(key)) {
          display = formatNumber(Number(value));
        } else if (typeof value === 'boolean') {
          display = value ? 'Yes' : 'No';
        } else if (Array.isArray(value)) {
          display = `List of ${value.length}`;
        } else {
          display = String(value);
        }
        return (
          <div key={key} className="min-w-0">
            <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{humanizeKey(key)}</dt>
            <dd className="text-xs font-medium text-zinc-800 break-words mt-0.5">{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Cross-document records supporting the decision. */
export const EvidencePanel: React.FC<EvidencePanelProps> = ({ evidence }) => {
  const sections: Array<{
    key: keyof typeof TITLES;
    records: Record<string, unknown>[];
  }> = [
    { key: 'vendor', records: evidence.vendor ? [evidence.vendor] : [] },
    { key: 'po', records: evidence.po ? [evidence.po] : [] },
    { key: 'receipts', records: evidence.receipts },
    { key: 'history', records: evidence.history },
  ];

  return (
    <Card
      header={{
        title: 'Evidence package',
        subtitle: 'The master-data records behind every claim in this report',
      }}
    >
      <div className="space-y-5">
        {sections.map(({ key, records: list }) => {
          const meta = TITLES[key];
          const Icon = meta.icon;
          return (
            <div key={key} className={cn('pb-5 border-b border-zinc-100 last:border-0 last:pb-0')}>
              <h3 className="flex items-center gap-2 text-xs font-bold text-zinc-700 uppercase tracking-wider mb-3">
                <Icon className="w-4 h-4 text-brand" />
                {meta.label}
                {list.length === 0 && <span className="font-normal normal-case text-zinc-400">· no match found</span>}
              </h3>
              {list.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">Lookup returned no record — cited as no match in the report.</p>
              ) : (
                <div className="space-y-3">
                  {list.map((item, index) => (
                    <div key={index} className="rounded-xl bg-zinc-50/80 border border-zinc-200/70 p-3.5">
                      <RecordGrid record={item as Record<string, unknown>} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

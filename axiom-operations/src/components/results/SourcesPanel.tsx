import React, { useState } from 'react';
import { 
  FileText, 
  Table, 
  ExternalLink, 
  Eye, 
  X, 
  CheckCircle2, 
  Sparkles,
  Search
} from 'lucide-react';
import { SourceDocument } from '../../types';
import { cn } from '../../lib/utils';

interface SourcesPanelProps {
  sources: SourceDocument[];
  className?: string;
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({
  sources,
  className
}) => {
  const [selectedSource, setSelectedSource] = useState<SourceDocument | null>(null);

  if (!sources || sources.length === 0) return null;

  return (
    <div className={cn('bg-white border border-zinc-200/90 rounded-2xl p-6 shadow-xs space-y-4', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-zinc-100">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
            Evidence & Supporting Documents
          </h3>
          <p className="text-xs text-zinc-500">
            Click any source to inspect the exact excerpts and figures the system verified.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto">
          {sources.length} sources verified
        </span>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sources.map((src) => (
          <div
            key={src.id}
            onClick={() => setSelectedSource(src)}
            className="flex items-start justify-between gap-3 p-4 rounded-xl bg-zinc-50/80 hover:bg-emerald-50/30 border border-zinc-200/90 hover:border-emerald-300 cursor-pointer transition-all group"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-100">
                {src.type === 'csv' ? <Table className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-zinc-900 group-hover:text-emerald-800 transition-colors block truncate">
                  {src.title}
                </span>
                <span className="text-[11px] text-zinc-500 block">
                  {src.pageOrSection || 'Entire document'}
                </span>
                <p className="text-xs text-zinc-600 mt-1 line-clamp-2 leading-relaxed font-normal">
                  "{src.relevantExcerpt}"
                </p>
              </div>
            </div>

            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
              {src.relevanceScore}% match
            </span>
          </div>
        ))}
      </div>

      {/* Detailed Document Excerpt Modal */}
      {selectedSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white border border-zinc-200 rounded-2xl shadow-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 truncate max-w-[280px]">
                    {selectedSource.title}
                  </h4>
                  <span className="text-[11px] text-zinc-500">{selectedSource.pageOrSection}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedSource(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-500 uppercase tracking-wider font-semibold block mb-1">
                  Extracted Evidence Excerpt
                </span>
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-800 leading-relaxed font-mono whitespace-pre-wrap">
                  "{selectedSource.relevantExcerpt}"
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Fact match score: <strong>{selectedSource.relevanceScore}% certainty</strong></span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSource(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-xs font-semibold text-zinc-800 rounded-xl transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

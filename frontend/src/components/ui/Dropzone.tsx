import React, { useRef, useState } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Alert } from './Alert';
import { Button } from './Button';

interface DropzoneProps {
  accept: string; // e.g. "application/pdf,.pdf"
  label?: string;
  hint?: string;
  multiple?: boolean;
  disabled?: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  accept,
  label = 'Drop files here',
  hint = 'or click to browse',
  multiple = true,
  disabled,
  files,
  onFilesChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = (incoming: File[]) => {
    const next = [...files];
    let rejected = 0;
    for (const file of incoming) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        rejected += 1;
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        rejected += 1;
        continue;
      }
      if (files.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    if (rejected > 0) {
      setError(`${rejected} file${rejected === 1 ? '' : 's'} skipped (PDFs only, up to 25 MB each).`);
    } else {
      setError(null);
    }
    onFilesChange(next);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />

      {files.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          disabled={disabled}
          className={cn(
            'w-full rounded-2xl border-2 border-dashed px-6 py-12 flex flex-col items-center justify-center gap-3 text-center transition-colors',
            dragging
              ? 'border-brand bg-mint'
              : 'border-zinc-300 bg-zinc-50/50 hover:border-brand/60 hover:bg-mint/40',
            disabled && 'opacity-60 pointer-events-none',
          )}
        >
          <div className="w-12 h-12 rounded-2xl bg-white border border-zinc-200 shadow-2xs flex items-center justify-center">
            <UploadCloud className={cn('w-6 h-6', dragging ? 'text-brand' : 'text-zinc-400')} />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-800">{label}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{multiple ? `${hint} — you can add several at once` : hint}</p>
          </div>
        </button>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
              <FileText className="w-4 h-4 text-brand-deep" />
              {files.length} PDF{files.length === 1 ? '' : 's'} ready
            </div>
            <Button size="xs" variant="secondary" onClick={openPicker} disabled={disabled}>
              <UploadCloud className="w-3.5 h-3.5" />
              Add more
            </Button>
          </div>
          <ul className="divide-y divide-zinc-100 border border-zinc-200 rounded-xl overflow-hidden">
            {files.map((file, index) => (
              <li key={`${file.name}-${file.size}-${index}`} className="flex items-center gap-3 bg-white px-4 py-2.5">
                <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                <span className="text-xs font-semibold text-zinc-800 truncate flex-1">{file.name}</span>
                <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={() => onFilesChange(files.filter((_, i) => i !== index))}
                  disabled={disabled}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-signal hover:bg-signal-soft transition-colors shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <Alert tone="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}
    </div>
  );
};

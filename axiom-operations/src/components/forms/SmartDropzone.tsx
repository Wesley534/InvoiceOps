import React, { useRef, useState } from 'react';
import { 
  Upload, 
  FileText, 
  Table, 
  Image, 
  X
} from 'lucide-react';
import { UploadedFile } from '../../types';
import { formatBytes, generateId, cn } from '../../lib/utils';

interface SmartDropzoneProps {
  files: UploadedFile[];
  onAddFiles: (files: UploadedFile[]) => void;
  onRemoveFile: (fileId: string) => void;
  maxFiles?: number;
  className?: string;
}

export const SmartDropzone: React.FC<SmartDropzoneProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  maxFiles = 10,
  className
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFiles = (fileList: FileList) => {
    const newFiles: UploadedFile[] = [];
    Array.from(fileList).forEach((f) => {
      const extension = f.name.split('.').pop()?.toLowerCase() || '';
      newFiles.push({
        id: generateId('doc'),
        name: f.name,
        size: f.size,
        type: extension,
        uploadDate: 'Today'
      });
    });
    onAddFiles(newFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'csv':
      case 'xlsx':
      case 'xls':
        return Table;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return Image;
      default:
        return FileText;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Interactive Drop Surface */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 select-none',
          isDragging
            ? 'border-emerald-500 bg-emerald-50/60 ring-4 ring-emerald-100'
            : 'border-zinc-300 hover:border-emerald-500 bg-zinc-50/60 hover:bg-emerald-50/20'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          accept=".pdf,.docx,.doc,.csv,.xlsx,.txt,.png,.jpg,.jpeg"
        />

        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shadow-2xs">
          <Upload className="w-6 h-6" />
        </div>

        <div>
          <span className="text-sm font-semibold text-zinc-900 block">
            Drag and drop files here, or <span className="text-emerald-600 underline">browse</span>
          </span>
          <span className="text-xs text-zinc-500 mt-1 block">
            Supports PDF, DOCX, CSV, Excel, TXT, and images up to 50MB
          </span>
        </div>
      </div>

      {/* Uploaded File Cards List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
            <span className="font-semibold text-zinc-700">Attached files ({files.length})</span>
            <span>Click 'X' to remove</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {files.map((file) => {
              const Icon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white border border-zinc-200 shadow-2xs text-xs group hover:border-zinc-300 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-zinc-900 block truncate max-w-[180px] sm:max-w-[200px]">
                        {file.name}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(file.id);
                    }}
                    className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

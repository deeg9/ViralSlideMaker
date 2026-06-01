'use client'

// Attachment cards for the carousel prompt input — a polished, Claude-style
// chat-input look adapted to the app's "Bloom Rose" palette. Presentational
// only; all state lives in GenerationForm.

import { Icon } from '@/components/ui/icon'

/** Human-readable byte size, e.g. "1.2 MB". */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

interface FilePreviewCardProps {
  file: File
  /** Object URL for image files; null for non-images. */
  previewUrl: string | null
  /** True while the form is uploading attachments at submit time. */
  uploading?: boolean
  onRemove: () => void
}

/** A single attached-file tile: image cover, or a file-type card fallback. */
export function FilePreviewCard({ file, previewUrl, uploading = false, onRemove }: FilePreviewCardProps) {
  const isImage = file.type.startsWith('image/') && !!previewUrl

  return (
    <div className="relative group flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-[#dbc1bc]/40 bg-[#fff0f0] animate-fade-in transition-colors hover:border-[#dbc1bc]">
      {isImage ? (
        <div className="w-full h-full relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl!} alt={file.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
        </div>
      ) : (
        <div className="w-full h-full p-3 flex flex-col justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white rounded">
              <Icon name="description" size="sm" className="text-[#7d6161]" />
            </div>
            <span className="text-[10px] font-medium text-[#7d6161] uppercase tracking-wider truncate">
              {file.name.split('.').pop()}
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-[#3d0000] truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-[#7d6161]">{formatFileSize(file.size)}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex items-center justify-center"
        aria-label={`Remove ${file.name}`}
      >
        <Icon name="close" size="sm" />
      </button>

      {uploading && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Icon name="progress_activity" size="lg" className="text-white animate-spin" />
        </div>
      )}
    </div>
  )
}

interface PastedContentCardProps {
  content: string
  onRemove: () => void
}

/** A tile for a long pasted text snippet captured out of the textarea. */
export function PastedContentCard({ content, onRemove }: PastedContentCardProps) {
  return (
    <div className="relative group flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-[#dbc1bc]/40 bg-white animate-fade-in p-3 flex flex-col justify-between shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="overflow-hidden w-full">
        <p className="text-[10px] text-[#7d6161] leading-[1.4] font-mono break-words whitespace-pre-wrap line-clamp-4 select-none">
          {content}
        </p>
      </div>

      <div className="flex items-center justify-between w-full mt-2">
        <div className="inline-flex items-center justify-center px-1.5 py-[2px] rounded border border-[#dbc1bc]/60 bg-white">
          <span className="text-[9px] font-bold text-[#7d6161] uppercase tracking-wider">Pasted</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 p-[3px] bg-white border border-[#dbc1bc]/60 rounded-full text-[#7d6161] hover:text-[#3d0000] transition-colors shadow-sm opacity-0 group-hover:opacity-100 flex items-center justify-center"
        aria-label="Remove pasted content"
      >
        <Icon name="close" size="sm" />
      </button>
    </div>
  )
}

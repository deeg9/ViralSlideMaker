'use client'
// Phase 74 Plan 03 (REF-02..REF-06): reference image uploader component.
// Native HTML5 drag-drop (no react-dropzone — confirmed absent from package.json
// and not added by this plan). Mirrors BrandKitLogoUploader naming convention.
//
// REF-06 SEPARATION (load-bearing): upload completion fires `onUploadComplete(row)`
// — provenance is preserved to projects.reference_assets even if the user
// abandons before generating. The "Extract style" CTA fires a SEPARATE
// `onExtractRequested(rows)` callback — only when the user explicitly clicks.
// This component does NOT call any vision/extraction endpoint itself; Phase 75
// owns extraction. The separation is enforced by the source-grep test in
// __tests__/reference-image-uploader.test.tsx (Test C10) — adding any
// `extract-style`, `extractStyleSpec`, or `/api/(vision|gemini|extract)*`
// reference here will fail CI.

import { useState, useRef, useCallback } from 'react'
import {
  validateReferenceUpload,
  validateGalleryCount,
  MAX_REFERENCE_COUNT,
  MIN_REFERENCE_COUNT,
} from '@/lib/storage/upload-reference-validation'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

export interface ReferenceImageUploaderProps {
  /** Fired after a successful upload — every successful upload writes one row.
   *  Phase 76 wires this to a server action that persists to
   *  projects.reference_assets (REF-07 provenance). */
  onUploadComplete?: (row: ReferenceAssetRow) => void
  /** Fired ONLY when the user clicks the "Extract style" CTA. Phase 75 wires
   *  this callback to its style-extraction service. REF-06 separation rule:
   *  upload ≠ extraction trigger. */
  onExtractRequested?: (rows: ReferenceAssetRow[]) => void
  /** Optional pre-seeded thumbnails (e.g., when re-opening a project that
   *  already has reference_assets in the DB). */
  initial?: ReferenceAssetRow[]
}

/** Thumbnail row in component state. _objectUrl is set for files uploaded in
 *  the current session (so we can render an instant preview without round-
 *  tripping the storage download). For pre-seeded `initial` rows the field is
 *  empty and the <img> falls back to the storage URL. */
type Thumb = ReferenceAssetRow & { _objectUrl: string }

const ACCEPT_ATTR = 'image/png,image/jpeg,image/webp,image/heic'

export function ReferenceImageUploader(props: ReferenceImageUploaderProps) {
  const [thumbs, setThumbs] = useState<Thumb[]>(() =>
    (props.initial ?? []).map((row) => ({ ...row, _objectUrl: '' })),
  )
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: File[]) => {
      setError(null)
      if (files.length === 0) return

      // 1. Gallery count validation (REF-03) — fail fast before any per-file work
      // We use the functional updater pattern by reading the latest length here.
      // setState is queued, but the cap check is conservative against the closure
      // value: if anything is in flight the user simply gets a clean error.
      // Read current count from state at call time
      let currentCount = 0
      setThumbs((prev) => {
        currentCount = prev.length
        return prev
      })
      const countCheck = validateGalleryCount(currentCount, files.length)
      if (!countCheck.ok) {
        setError(countCheck.message)
        return
      }

      // 2. Per-file validation + signed-URL upload (REF-04, REF-05)
      for (const file of files) {
        const v = validateReferenceUpload({
          filename: file.name,
          contentType: file.type,
          size_bytes: file.size,
        })
        if (!v.ok) {
          setError(v.message)
          return
        }

        // 2a. Mint signed URL via the route (REF-02)
        let mintRes: Response
        try {
          mintRes = (await fetch('/api/style-references/upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              size_bytes: file.size,
            }),
          })) as Response
        } catch {
          setError('Failed to mint upload URL.')
          return
        }
        if (!mintRes.ok) {
          setError('Failed to mint upload URL.')
          return
        }
        const { data } = await mintRes.json()

        // 2b. PUT direct to Storage (REF-02 — bypasses 4MB Vercel cap)
        let putRes: Response
        try {
          putRes = (await fetch(data.uploadUrl, {
            method: data.method,
            headers: data.headers,
            body: file,
          })) as Response
        } catch {
          setError('Upload failed. Please try again.')
          return
        }
        if (!putRes.ok) {
          setError('Upload failed. Please try again.')
          return
        }

        // 2c. Build ReferenceAssetRow + add thumbnail
        // - url: storage path (NOT a blob URL — durable reference for Phase 75
        //   to mint signed READ URLs against later)
        // - sha256: empty placeholder; Phase 73 prepareForVision computes the
        //   real SHA-256 of preprocessed bytes at extraction time
        // - mime_type / size_bytes / original_filename: provenance for forensics
        const objectUrl = URL.createObjectURL(file)
        const row: ReferenceAssetRow = {
          url: data.path,
          sha256: '',
          uploaded_at: new Date().toISOString(),
          mime_type: file.type as ReferenceAssetRow['mime_type'],
          size_bytes: file.size,
          original_filename: file.name,
        }
        setThumbs((prev) => [...prev, { ...row, _objectUrl: objectUrl }])
        props.onUploadComplete?.(row)
      }
    },
    [props],
  )

  const handleRemove = (idx: number) => {
    setThumbs((prev) => {
      const target = prev[idx]
      if (target?._objectUrl) URL.revokeObjectURL(target._objectUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleExtract = () => {
    // Strip the internal _objectUrl before handing rows to the consumer —
    // the persisted shape has only the fields declared on ReferenceAssetRow.
    const rows: ReferenceAssetRow[] = thumbs.map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _objectUrl, ...row } = t
      return row
    })
    props.onExtractRequested?.(rows)
  }

  // Native HTML5 drag-drop handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const onDragLeave = () => setIsDragOver(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    void handleFiles(files)
  }

  const ctaDisabled = thumbs.length < MIN_REFERENCE_COUNT || thumbs.length > MAX_REFERENCE_COUNT

  return (
    <div className="space-y-3">
      <div
        data-testid="reference-uploader-dropzone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={
          'border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ' +
          (isDragOver
            ? 'active border-[#3d0000] bg-[#fff0f0]'
            : 'border-[#e2cfcf] bg-white hover:bg-[#fafafa]')
        }
        role="button"
        aria-label="Drop reference images or click to choose"
      >
        <p className="text-sm font-semibold text-[#3d0000]">
          Drop reference images here, or click to choose
        </p>
        <p className="mt-1 text-[11px] text-[#7d6161]">
          PNG, JPEG, WEBP, HEIC — up to {MAX_REFERENCE_COUNT} images, 20 MB each
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Clear the input so re-selecting the same file fires onChange again
          e.target.value = ''
          void handleFiles(files)
        }}
        style={{ display: 'none' }}
      />

      {error && (
        <div
          role="alert"
          data-testid="uploader-error"
          className="text-[12px] font-semibold text-[#a30000] bg-[#fff0f0] border border-[#fadbdb] rounded-lg px-3 py-2"
        >
          {error}
        </div>
      )}

      <ul
        data-testid="thumb-row"
        className="grid grid-cols-4 gap-2"
      >
        {thumbs.map((t, i) => (
          <li
            key={`${t.url}-${i}`}
            className="relative aspect-square rounded-lg overflow-hidden bg-[#f5f5f5]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={t._objectUrl || t.url}
              alt={t.original_filename}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemove(i)}
              aria-label={`Remove ${t.original_filename}`}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-xs font-bold flex items-center justify-center hover:bg-black"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        data-testid="extract-style-cta"
        disabled={ctaDisabled}
        onClick={handleExtract}
        className={
          'w-full rounded-xl py-3 text-sm font-bold transition-colors ' +
          (ctaDisabled
            ? 'bg-[#e2cfcf] text-[#7d6161] cursor-not-allowed'
            : 'bg-[#3d0000] text-white hover:bg-[#5a0000]')
        }
      >
        Extract style
      </button>
    </div>
  )
}

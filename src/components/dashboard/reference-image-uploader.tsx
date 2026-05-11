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
//
// Phase 79 Plan 02 Task 2 (LEGAL-01): the FIRST upload click is gated by the
// ToS clickwrap modal when `tosAlreadyAccepted={false}` is passed. The
// component:
//   1. Defers the upload pipeline if the user has not yet accepted
//   2. Shows <TosClickwrapModal> bound to the injected `acceptTosAction`
//   3. On Accept → flips local `accepted` state → resumes the deferred upload
//   4. On Cancel → drops the deferred upload
// `tosAlreadyAccepted` defaults to TRUE so existing tests + non-style-from-
// reference call sites stay untouched. The page-level wiring (the new dashboard
// route that hosts the uploader) is responsible for computing the prop from
// `hasUserAcceptedCurrentTos()` server-side.

import { useState, useRef, useCallback } from 'react'
import {
  validateReferenceUpload,
  validateGalleryCount,
  MAX_REFERENCE_COUNT,
  MIN_REFERENCE_COUNT,
} from '@/lib/storage/upload-reference-validation'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'
import { TosClickwrapModal } from '@/components/style-from-reference/tos-clickwrap-modal'

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
  /** Phase 79 Plan 02 Task 2 (LEGAL-01): when `false`, the FIRST upload
   *  attempt opens the ToS clickwrap modal and defers the upload until the
   *  user accepts. Defaults to `true` so existing call sites (and the
   *  pre-Phase-79 baseline tests) stay byte-identical. The hosting page
   *  computes this server-side via `hasUserAcceptedCurrentTos`. */
  tosAlreadyAccepted?: boolean
  /** Phase 79 Plan 02 Task 2 (LEGAL-01): server action invoked when the user
   *  ticks the modal checkbox + clicks Accept. Wired to
   *  `acceptStyleFromReferenceTosAction` from
   *  src/app/(dashboard)/style-from-reference/actions.ts. */
  acceptTosAction?: (version: string) => Promise<{ ok: boolean; error?: unknown }>
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

  // Phase 79 Plan 02 Task 2 (LEGAL-01): clickwrap gating state.
  //   `accepted` mirrors the ToS-accepted lifecycle in component-local state:
  //     - seeded from the parent prop on mount (server-checked source of truth)
  //     - flipped to true after a successful Accept inside the modal (sticky
  //       for the rest of the session — second/third uploads skip the modal)
  //   `pendingFiles` holds the deferred File[] from a drop / change event
  //     that fired BEFORE acceptance; resumed in `handleAcceptedAndResume`.
  const [accepted, setAccepted] = useState<boolean>(props.tosAlreadyAccepted ?? true)
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)

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

  // Phase 79 Plan 02 Task 2 (LEGAL-01): the gating entry point. If the user
  // has already accepted, run the upload pipeline directly. Otherwise stash
  // the File[] in `pendingFiles` (which mounts the modal via the conditional
  // render below) and wait for Accept to flip `accepted` and resume.
  const gateAndUpload = useCallback(
    (files: File[]) => {
      if (files.length === 0) return
      if (accepted) {
        void handleFiles(files)
      } else {
        setPendingFiles(files)
      }
    },
    [accepted, handleFiles],
  )

  // Modal callbacks. On Accept we set `accepted=true` (sticky for the
  // session) AND drain any pending upload that was waiting on the gate.
  const handleAcceptedAndResume = useCallback(() => {
    setAccepted(true)
    const queued = pendingFiles
    setPendingFiles(null)
    if (queued && queued.length > 0) {
      void handleFiles(queued)
    }
  }, [pendingFiles, handleFiles])

  const handleCancelTos = useCallback(() => {
    // Drop the deferred upload — the user explicitly declined. They can
    // try again later; the modal will re-open on their next click.
    setPendingFiles(null)
  }, [])

  // Default no-op accept action so a misconfigured call site (no
  // `acceptTosAction` injected but `tosAlreadyAccepted=false`) still surfaces
  // the modal in a recognizable state instead of crashing on undefined.
  const acceptAction =
    props.acceptTosAction ?? (async () => ({ ok: false, error: 'no_action_wired' }))

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
    // Phase 79 LEGAL-01: route through the ToS gate (no-op when accepted).
    gateAndUpload(files)
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
          // Phase 79 LEGAL-01: route through the ToS gate (no-op when accepted).
          gateAndUpload(files)
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

      {/* Phase 79 Plan 02 Task 2 (LEGAL-01): clickwrap modal — mounts when
          the user has not yet accepted AND a deferred upload is queued. The
          modal exits the DOM as soon as `pendingFiles` clears (Accept or
          Cancel) so the rest of the test surface (no extra a11y nodes when
          ToS is not in play) stays clean. */}
      <TosClickwrapModal
        open={!accepted && pendingFiles !== null}
        onAccepted={handleAcceptedAndResume}
        onCancel={handleCancelTos}
        acceptAction={acceptAction}
      />
    </div>
  )
}

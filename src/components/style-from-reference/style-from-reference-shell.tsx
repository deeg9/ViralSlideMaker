'use client'

// Phase 76 Plan 01 (PREVIEW-01, PREVIEW-09):
// Client island composing the existing ReferenceImageUploader (Phase 74),
// the sticky reference thumbnail strip, and the spec-preview panel,
// wired to the state machine + extractStyleSpecAction Server Action.
//
// quick 260511-flj: PREVIEW-10 RefusalWarning gate REMOVED. The sticky strip
// no longer wires a per-reference slot for flag chips; refusalFlags is gone
// from the reducer. Liability for IP / right-of-publicity / trademark exposure
// shifted to the user via Phase 79 LEGAL-05 T&C strengthening + version bump.
//
// =====================================================================
// PREVIEW-01 INVARIANT (LOAD-BEARING):
// =====================================================================
// SpecPreviewPanel is rendered ONLY behind a `state.status === 'preview'`
// guard. The Generate CTA lives INSIDE SpecPreviewPanel — never in this
// file. The source-grep gate in __tests__/style-from-reference-shell.test.tsx
// (Test 5) asserts both invariants by reading this file as text. A
// future refactor that hoists the CTA into a non-preview subtree fails
// the test. The reducer is the second line of defense: GENERATE_CLICK
// from any non-preview status is a no-op (state-machine.ts).
// =====================================================================
//
// LEGAL-03 forward-compat (Test 9): zero forbidden mimicry-framing
// tokens in this file (see __tests__/style-from-reference-shell.test.tsx
// for the exact regex list). All copy uses "Inspired by" framing.

import { useReducer, useEffect, useCallback, useRef, useState } from 'react'
import { ReferenceImageUploader } from '@/components/dashboard/reference-image-uploader'
import { extractStyleSpecAction } from '@/app/(dashboard)/style-from-reference/actions'
import {
  specPreviewReducer,
  initialSpecPreviewState,
} from './state-machine'
import { StickyReferenceStrip } from './sticky-reference-strip'
import { SpecPreviewPanel } from './spec-preview-panel'
import { ErrorRouter } from './error-router'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { ExtractResult } from '@/lib/ai/extract-style-spec.types'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

export interface StyleFromReferenceShellProps {
  projectId: string
  brandKit: BrandKit | null
  brandKitAvailable: boolean
  // Phase 79 LEGAL-01: ToS clickwrap props pass through to ReferenceImageUploader.
  // tosAlreadyAccepted = false forces the modal to render before first upload.
  // Defaults preserve existing test behavior (ToS treated as accepted) when omitted.
  tosAlreadyAccepted?: boolean
  acceptTosAction?: () => Promise<{ ok: true } | { ok: false; error: string }>
}

function dispatchExtractResult(
  dispatch: React.Dispatch<{ type: string }> & ((a: unknown) => void),
  result: ExtractResult,
): void {
  if (result.ok) {
    ;(dispatch as unknown as (a: unknown) => void)({
      type: 'EXTRACT_SUCCESS',
      spec: result.spec,
      telemetry: result.telemetry,
    })
  } else {
    const detail =
      result.error === 'cap_reached'
        ? JSON.stringify(result.detail)
        : result.error === 'safety_blocked'
          ? result.reason
          : typeof result.detail === 'string'
            ? result.detail
            : undefined
    const recovery_suggestion =
      result.error === 'safety_blocked' ? result.recovery_suggestion : undefined
    ;(dispatch as unknown as (a: unknown) => void)({
      type: 'EXTRACT_ERROR',
      error: { kind: result.error, detail, recovery_suggestion },
      telemetry: result.telemetry,
    })
  }
}

export function StyleFromReferenceShell(props: StyleFromReferenceShellProps) {
  const [state, dispatch] = useReducer(specPreviewReducer, initialSpecPreviewState)

  // Session-local map of storage-path → blob preview URL for the sticky
  // strip. The slide-references bucket is private, so the persisted
  // `row.url` (a storage path) can't be used as <img src> directly. The
  // uploader mints a blob URL per file via URL.createObjectURL and we
  // store it here so the strip can render an instant thumbnail without a
  // signed-URL round-trip. Lives outside the reducer because the URLs
  // are non-persistent DOM handles — they're revoked on unmount.
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  useEffect(() => {
    return () => {
      // Revoke every minted blob URL when the shell unmounts so the
      // browser frees the underlying File buffer reference.
      Object.values(previewUrls).forEach((url) => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      })
    }
    // Intentionally empty deps: capture the latest map via the ref-like
    // pattern is unnecessary because new entries only ADD; revoke-on-
    // unmount is the only cleanup we need.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hydrate brand-kit availability into the reducer on mount + when prop changes.
  // useRef guard avoids dispatching on every render; useEffect handles the
  // BRAND_KIT_AVAILABILITY action whose only purpose is reducer-side state.
  useEffect(() => {
    dispatch({ type: 'BRAND_KIT_AVAILABILITY', available: props.brandKitAvailable })
  }, [props.brandKitAvailable])

  // Track latest references in a ref so RE_EXTRACT can read them without
  // refreshing its callback identity on every reference push.
  const referencesRef = useRef<ReferenceAssetRow[]>(state.references)
  referencesRef.current = state.references

  const handleExtract = useCallback(
    async (rows: ReferenceAssetRow[]) => {
      // Make sure the reducer knows about every uploaded row before transitioning.
      // The uploader stub in tests sends two rows in one call; the production
      // uploader fires onUploadComplete per file BEFORE onExtractRequested,
      // so reducer.references is already populated. We still seed any rows the
      // reducer hasn't seen (defensive — no-op in the production path).
      const known = new Set(state.references.map((r) => r.url))
      for (const row of rows) {
        if (!known.has(row.url)) {
          dispatch({ type: 'UPLOAD_ADDED', row })
        }
      }
      dispatch({ type: 'EXTRACT_START' })
      const result = await extractStyleSpecAction({
        projectId: props.projectId,
        references: rows,
      })
      dispatchExtractResult(
        dispatch as unknown as React.Dispatch<{ type: string }> & ((a: unknown) => void),
        result,
      )
    },
    [props.projectId, state.references],
  )

  const handleReExtract = useCallback(async () => {
    dispatch({ type: 'RE_EXTRACT_CLICK' })
    const result = await extractStyleSpecAction({
      projectId: props.projectId,
      references: referencesRef.current,
    })
    dispatchExtractResult(
      dispatch as unknown as React.Dispatch<{ type: string }> & ((a: unknown) => void),
      result,
    )
  }, [props.projectId])

  return (
    <div className="space-y-6">
      {/* PREVIEW-09: sticky strip rendered OUTSIDE every conditional block.
          quick 260511-flj removed the per-reference refusal-warning slot
          wiring; sticky strip now renders thumbnails only. */}
      <StickyReferenceStrip references={state.references} previewUrls={previewUrls} />

      {state.status === 'idle' && (
        <ReferenceImageUploader
          onUploadComplete={(row) => dispatch({ type: 'UPLOAD_ADDED', row })}
          onPreviewUrlReady={(storagePath, previewUrl) =>
            setPreviewUrls((prev) => ({ ...prev, [storagePath]: previewUrl }))
          }
          onExtractRequested={(rows) => {
            void handleExtract(rows)
          }}
          tosAlreadyAccepted={props.tosAlreadyAccepted}
          acceptTosAction={props.acceptTosAction}
        />
      )}

      {state.status === 'extracting' && (
        <ExtractingState />
      )}

      {state.status === 'preview' && (
        <SpecPreviewPanel
          state={state}
          dispatch={dispatch}
          brandKit={props.brandKit}
          onGenerate={() => dispatch({ type: 'GENERATE_CLICK' })}
          onReExtract={() => {
            void handleReExtract()
          }}
        />
      )}

      {state.status === 'generating' && (
        <div data-testid="generating-state" role="status" aria-live="polite">
          Generating your slideshow inspired by the references...
        </div>
      )}

      {/* ErrorRouter renders the right recovery surface per error.kind —
          including the full SafetyBlockRecovery panel that REPLACES the
          spec-preview on safety_blocked (PREVIEW-12). */}
      {state.status === 'error' && state.error && (
        <ErrorRouter state={state} dispatch={dispatch} />
      )}
    </div>
  )
}

function ExtractingState() {
  return (
    <div
      data-testid="extracting-state"
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-[#e2cfcf] bg-[#fff0f0] p-6 text-center"
    >
      <p className="text-sm font-semibold text-[#3d0000]">
        Analyzing your references...
      </p>
      <p className="mt-1 text-[12px] text-[#7d6161]">
        Extracting palette, typography, layout, and voice — usually under 10 seconds.
      </p>
    </div>
  )
}

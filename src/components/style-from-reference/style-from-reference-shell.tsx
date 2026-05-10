'use client'

// Phase 76 Plan 01 (PREVIEW-01, PREVIEW-09):
// Client island composing the existing ReferenceImageUploader (Phase 74),
// the sticky reference thumbnail strip, and the spec-preview panel,
// wired to the state machine + extractStyleSpecAction Server Action.
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

import { useReducer, useEffect, useCallback, useRef } from 'react'
import { ReferenceImageUploader } from '@/components/dashboard/reference-image-uploader'
import { extractStyleSpecAction } from '@/app/(dashboard)/style-from-reference/actions'
import {
  specPreviewReducer,
  initialSpecPreviewState,
  type SpecPreviewState,
} from './state-machine'
import { StickyReferenceStrip } from './sticky-reference-strip'
import { SpecPreviewPanel } from './spec-preview-panel'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { ExtractResult } from '@/lib/ai/extract-style-spec.types'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

export interface StyleFromReferenceShellProps {
  projectId: string
  brandKit: BrandKit | null
  brandKitAvailable: boolean
}

function dispatchExtractResult(
  dispatch: React.Dispatch<{ type: string }> & ((a: unknown) => void),
  result: ExtractResult,
): void {
  if (result.ok) {
    ;(dispatch as unknown as (a: unknown) => void)({
      type: 'EXTRACT_SUCCESS',
      spec: result.spec,
      refusalFlags: result.refusal_flags,
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
      {/* PREVIEW-09: sticky strip rendered OUTSIDE every conditional block. */}
      <StickyReferenceStrip references={state.references} />

      {state.status === 'idle' && (
        <ReferenceImageUploader
          onUploadComplete={(row) => dispatch({ type: 'UPLOAD_ADDED', row })}
          onExtractRequested={(rows) => {
            void handleExtract(rows)
          }}
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

      {state.status === 'error' && state.error && (
        <ErrorMount state={state} />
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

function ErrorMount({ state }: { state: SpecPreviewState }) {
  // Plan 76-03 will fill this slot with RefusalWarning + SafetyBlockRecovery
  // components routed by error.kind. This shell only exposes the mount point;
  // the error.kind text is rendered as the slot's text content so 76-03 (and
  // tests today) can see what kind of recovery is needed.
  return (
    <div
      data-testid="error-mount"
      data-error-kind={state.error?.kind}
      className="rounded-2xl border border-[#fadbdb] bg-[#fff0f0] p-6"
    >
      <p className="text-sm font-semibold text-[#a30000]">
        {state.error?.kind}
      </p>
      {state.error?.recovery_suggestion ? (
        <p className="mt-1 text-[12px] text-[#7d6161]">
          {state.error.recovery_suggestion}
        </p>
      ) : null}
    </div>
  )
}

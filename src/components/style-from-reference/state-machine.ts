// Phase 76 Plan 01 (PREVIEW-01, PREVIEW-09):
// Pure-function reducer for the spec-preview-and-confirm flow.
//
// quick 260511-flj: PREVIEW-10 refusal gate REMOVED — liability shifted to T&C
// (Phase 79 LEGAL-05). refusalFlags / refusalAcknowledged / CONFIRM_REFUSAL_WARNING
// have been deleted from this reducer. Generate is gated solely on
// hasAtLeastOneAspect now.
//
// =====================================================================
// PREVIEW-01 INVARIANT (LOAD-BEARING — DO NOT VIOLATE):
// =====================================================================
// `generating` is reachable ONLY from `preview` AND ONLY when at least
// one of `aspects.{palette,typography,layout,decorations}` is true.
// GENERATE_CLICK from any other status sets error='preview-required'
// and leaves status untouched. The shell renders Generate CTA inside
// a status==='preview' guard; the source-grep firewall in
// `__tests__/style-from-reference-shell.test.tsx` enforces the guard
// holds across refactors. The reducer is the second line of defense:
// even if a future refactor leaks the CTA into a non-preview subtree,
// the dispatch is a no-op.
// =====================================================================
//
// PURITY: no Date.now(), no random, no fetch, no console. Side effects
// (calling the Server Action) live in the shell's effect layer; the
// reducer only transitions state.
//
// LEGAL-03 forward-compat: this file ships zero UI copy. Strings here
// are stable internal error kinds (`preview-required` etc.). All
// user-facing copy lives in components, where Phase 79 grep gate
// enforces "Inspired by" framing.

import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { ExtractTelemetry } from '@/lib/ai/extract-style-spec.types'

// ------------------------------------------------------------------------- //
// Types                                                                     //
// ------------------------------------------------------------------------- //

export type SpecPreviewStatus =
  | 'idle'
  | 'extracting'
  | 'preview'
  | 'generating'
  | 'done'
  | 'error'

export type ErrorKind =
  | 'no-references'
  | 'preview-required'
  | 'no-aspects-selected'
  | 'no-retries-left'
  | 'cap_reached'
  | 'insufficient_credits'
  | 'safety_blocked'
  | 'extraction_failed'

export interface SpecPreviewError {
  kind: ErrorKind
  detail?: string
  recovery_suggestion?: string
}

export interface SpecPreviewAspects {
  palette: boolean
  typography: boolean
  layout: boolean
  decorations: boolean
}

export interface SpecPreviewState {
  status: SpecPreviewStatus
  references: ReferenceAssetRow[]
  spec: StyleSpec | null
  /** PREVIEW-07: 2 retries per generation; resets on UPLOAD_RESET (fresh upload). */
  retriesRemaining: number
  /** PREVIEW-06: per-aspect emit toggles. Defaults all-on per CONTEXT.md D-XX. */
  aspects: SpecPreviewAspects
  /** PREVIEW-08: visible only when brand-kit exists; toggled by user. */
  useBrandKitRemix: boolean
  brandKitAvailable: boolean
  error: SpecPreviewError | null
  lastTelemetry: ExtractTelemetry | null
}

export type SpecPreviewAction =
  | { type: 'UPLOAD_ADDED'; row: ReferenceAssetRow }
  | { type: 'UPLOAD_REMOVED'; index: number }
  | { type: 'UPLOAD_RESET'; references: ReferenceAssetRow[] }
  | { type: 'EXTRACT_START' }
  | {
      type: 'EXTRACT_SUCCESS'
      spec: StyleSpec
      telemetry: ExtractTelemetry
    }
  | {
      type: 'EXTRACT_ERROR'
      error: SpecPreviewError
      telemetry: ExtractTelemetry
    }
  | { type: 'RE_EXTRACT_CLICK' }
  | { type: 'TOGGLE_ASPECT'; aspect: keyof SpecPreviewAspects }
  | { type: 'TOGGLE_BRAND_KIT_REMIX' }
  | { type: 'GENERATE_CLICK' }
  | { type: 'GENERATE_DONE' }
  | { type: 'BRAND_KIT_AVAILABILITY'; available: boolean }
  | { type: 'CLEAR_ERROR' }

// ------------------------------------------------------------------------- //
// Initial state                                                             //
// ------------------------------------------------------------------------- //

export const initialSpecPreviewState: SpecPreviewState = {
  status: 'idle',
  references: [],
  spec: null,
  retriesRemaining: 2,
  aspects: { palette: true, typography: true, layout: true, decorations: true },
  useBrandKitRemix: false,
  brandKitAvailable: false,
  error: null,
  lastTelemetry: null,
}

// ------------------------------------------------------------------------- //
// Helpers                                                                   //
// ------------------------------------------------------------------------- //

function hasAtLeastOneAspect(aspects: SpecPreviewAspects): boolean {
  return aspects.palette || aspects.typography || aspects.layout || aspects.decorations
}

// ------------------------------------------------------------------------- //
// Reducer                                                                   //
// ------------------------------------------------------------------------- //

export function specPreviewReducer(
  state: SpecPreviewState,
  action: SpecPreviewAction,
): SpecPreviewState {
  switch (action.type) {
    case 'UPLOAD_ADDED':
      // Append; status stays where it was (upload is NOT an extraction trigger).
      return {
        ...state,
        references: [...state.references, action.row],
        // Clear a stale "no-references" error if user just uploaded.
        error: state.error?.kind === 'no-references' ? null : state.error,
      }

    case 'UPLOAD_REMOVED': {
      if (action.index < 0 || action.index >= state.references.length) return state
      const next = state.references.slice()
      next.splice(action.index, 1)
      return { ...state, references: next }
    }

    case 'UPLOAD_RESET':
      // Fresh upload set: PREVIEW-07 — retries reset to 2.
      return {
        ...initialSpecPreviewState,
        references: action.references,
        // Preserve brand-kit availability + per-aspect defaults from initial.
        brandKitAvailable: state.brandKitAvailable,
      }

    case 'EXTRACT_START':
      if (state.references.length < 1) {
        return { ...state, error: { kind: 'no-references' } }
      }
      return { ...state, status: 'extracting', error: null }

    case 'EXTRACT_SUCCESS':
      // Only fires from extracting — protect against leaks.
      if (state.status !== 'extracting') return state
      return {
        ...state,
        status: 'preview',
        spec: action.spec,
        lastTelemetry: action.telemetry,
        error: null,
      }

    case 'EXTRACT_ERROR':
      // retriesRemaining UNCHANGED on error per Test 5 / PREVIEW-07
      // (a failed attempt does not consume the user's retry budget).
      return {
        ...state,
        status: 'error',
        error: action.error,
        lastTelemetry: action.telemetry,
      }

    case 'RE_EXTRACT_CLICK':
      // Only meaningful from preview (or error after a previous preview); we
      // require status==='preview' for the user-facing surface.
      if (state.status !== 'preview') return state
      if (state.retriesRemaining <= 0) {
        return { ...state, error: { kind: 'no-retries-left' } }
      }
      return {
        ...state,
        status: 'extracting',
        retriesRemaining: state.retriesRemaining - 1,
        error: null,
      }

    case 'TOGGLE_ASPECT':
      return {
        ...state,
        aspects: { ...state.aspects, [action.aspect]: !state.aspects[action.aspect] },
        // Clear no-aspects error once user starts toggling
        error: state.error?.kind === 'no-aspects-selected' ? null : state.error,
      }

    case 'TOGGLE_BRAND_KIT_REMIX':
      // PREVIEW-08: the toggle is hidden when no brand kit; reducer enforces.
      if (!state.brandKitAvailable) return state
      return { ...state, useBrandKitRemix: !state.useBrandKitRemix }

    case 'GENERATE_CLICK':
      // PREVIEW-01 INVARIANT — load-bearing structural defense.
      if (state.status !== 'preview') {
        return { ...state, error: { kind: 'preview-required' } }
      }
      if (!hasAtLeastOneAspect(state.aspects)) {
        return { ...state, error: { kind: 'no-aspects-selected' } }
      }
      return { ...state, status: 'generating', error: null }

    case 'GENERATE_DONE':
      if (state.status !== 'generating') return state
      return { ...state, status: 'done' }

    case 'BRAND_KIT_AVAILABILITY':
      return { ...state, brandKitAvailable: action.available }

    case 'CLEAR_ERROR':
      return { ...state, error: null }

    default: {
      // Exhaustiveness check: adding a new SpecPreviewAction member without a
      // case here fails this assignment at TypeScript compile time.
      const _exhaustive: never = action
      void _exhaustive
      return state
    }
  }
}

// Phase 76 Plan 01 (PREVIEW-01, PREVIEW-09):
// State-machine reducer tests — load-bearing invariant defense for the
// mandatory non-skippable spec-preview flow. Pure-function tests; no DOM.
//
// quick 260511-flj: PREVIEW-10 RefusalWarning gate removed — Test 13
// (CONFIRM_REFUSAL_WARNING) deleted; Test 4 (EXTRACT_SUCCESS) and Test 12
// (UPLOAD_RESET) rewritten to drop refusalFlags / refusalAcknowledged
// assertions; FLAGS_FACE / FLAGS_NONE constants removed.

import { describe, it, expect } from 'vitest'
import {
  specPreviewReducer,
  initialSpecPreviewState,
  type SpecPreviewState,
  type SpecPreviewAction,
} from '../state-machine'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { ExtractTelemetry } from '@/lib/ai/extract-style-spec.types'

// ---- Fixtures ----

function makeRow(name = 'a.png'): ReferenceAssetRow {
  return {
    url: `user_x/${name}`,
    sha256: '',
    uploaded_at: '2026-05-10T00:00:00.000Z',
    mime_type: 'image/png',
    size_bytes: 1024,
    original_filename: name,
  }
}

function makeSpec(overrides: Partial<StyleSpec> = {}): StyleSpec {
  // Cast: Partial<StyleSpec> over a discriminated union (StyleSpec is intersected
  // with ArchetypeSlots in Phase 80) cannot be spread back into the union without
  // collapsing the discriminator. Spec contract is concrete here:
  // slideArchetype='full-bleed-text-overlay' (EmptySlots variant).
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#A8E0B0' },
    typography: { hookFontCategory: 'sans-serif' },
    layout: { hookPosition: 'top', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'Bold magazine voice',
    ...overrides,
  } as StyleSpec
}

function makeTelemetry(): ExtractTelemetry {
  return {
    vision_calls_count: 1,
    tokens_in: 100,
    tokens_out: 50,
    cache_hit: false,
    duration_ms: 1234,
  }
}

describe('Phase 76 Plan 01: specPreviewReducer — initial state + transitions', () => {
  it('Test 1: initialSpecPreviewState exposes the locked default shape', () => {
    expect(initialSpecPreviewState).toEqual<SpecPreviewState>({
      status: 'idle',
      references: [],
      spec: null,
      retriesRemaining: 2,
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      error: null,
      lastTelemetry: null,
    })
  })

  it('Test 2: UPLOAD_ADDED appends references and stays in idle (upload alone does not advance state)', () => {
    const row1 = makeRow('a.png')
    const row2 = makeRow('b.png')
    const s1 = specPreviewReducer(initialSpecPreviewState, { type: 'UPLOAD_ADDED', row: row1 })
    expect(s1.status).toBe('idle')
    expect(s1.references).toEqual([row1])
    const s2 = specPreviewReducer(s1, { type: 'UPLOAD_ADDED', row: row2 })
    expect(s2.status).toBe('idle')
    expect(s2.references).toHaveLength(2)
    expect(s2.references[1]).toEqual(row2)
  })

  it('Test 3: EXTRACT_START requires references >= 1; with empty refs sets error and stays idle', () => {
    // Empty refs → error + state unchanged status
    const sErr = specPreviewReducer(initialSpecPreviewState, { type: 'EXTRACT_START' })
    expect(sErr.status).toBe('idle')
    expect(sErr.error?.kind).toBe('no-references')
    // With refs → moves to extracting
    const withRef: SpecPreviewState = {
      ...initialSpecPreviewState,
      references: [makeRow()],
    }
    const sOk = specPreviewReducer(withRef, { type: 'EXTRACT_START' })
    expect(sOk.status).toBe('extracting')
    expect(sOk.error).toBeNull()
  })

  it('Test 4: EXTRACT_SUCCESS only fires from extracting; spec set, status=preview (quick 260511-flj: no refusalFlags)', () => {
    const extractingState: SpecPreviewState = {
      ...initialSpecPreviewState,
      references: [makeRow()],
      status: 'extracting',
    }
    const spec = makeSpec()
    const sOk = specPreviewReducer(extractingState, {
      type: 'EXTRACT_SUCCESS',
      spec,
      telemetry: makeTelemetry(),
    })
    expect(sOk.status).toBe('preview')
    expect(sOk.spec).toEqual(spec)
    expect(sOk.lastTelemetry).toEqual(makeTelemetry())

    // From idle → state unchanged (no leak)
    const sLeak = specPreviewReducer(initialSpecPreviewState, {
      type: 'EXTRACT_SUCCESS',
      spec,
      telemetry: makeTelemetry(),
    })
    expect(sLeak.status).toBe('idle')
    expect(sLeak.spec).toBeNull()
  })

  it('Test 5: EXTRACT_ERROR sets error.kind and status=error; retriesRemaining UNCHANGED on error', () => {
    const extractingState: SpecPreviewState = {
      ...initialSpecPreviewState,
      references: [makeRow()],
      status: 'extracting',
      retriesRemaining: 2,
    }
    const sBlocked = specPreviewReducer(extractingState, {
      type: 'EXTRACT_ERROR',
      error: { kind: 'safety_blocked', detail: 'block info', recovery_suggestion: 'try cropping' },
      telemetry: makeTelemetry(),
    })
    expect(sBlocked.status).toBe('error')
    expect(sBlocked.error?.kind).toBe('safety_blocked')
    expect(sBlocked.error?.recovery_suggestion).toBe('try cropping')
    expect(sBlocked.retriesRemaining).toBe(2) // UNCHANGED on error

    const sCap = specPreviewReducer(extractingState, {
      type: 'EXTRACT_ERROR',
      error: { kind: 'cap_reached' },
      telemetry: makeTelemetry(),
    })
    expect(sCap.status).toBe('error')
    expect(sCap.error?.kind).toBe('cap_reached')
    expect(sCap.retriesRemaining).toBe(2)
  })

  it('Test 6: PREVIEW-01 INVARIANT — GENERATE_CLICK from non-preview status is rejected', () => {
    const statuses: SpecPreviewState['status'][] = [
      'idle',
      'extracting',
      'generating',
      'done',
      'error',
    ]
    for (const status of statuses) {
      const state: SpecPreviewState = {
        ...initialSpecPreviewState,
        status,
        spec: makeSpec(),
      }
      const next = specPreviewReducer(state, { type: 'GENERATE_CLICK' })
      // Status MUST NOT advance to generating from any non-preview state.
      expect(next.status).toBe(status)
      expect(next.error?.kind).toBe('preview-required')
    }
  })

  it('Test 7: GENERATE_CLICK from preview with zero aspects blocked — error=no-aspects-selected', () => {
    const previewNoAspects: SpecPreviewState = {
      ...initialSpecPreviewState,
      status: 'preview',
      spec: makeSpec(),
      aspects: { palette: false, typography: false, layout: false, decorations: false },
    }
    const next = specPreviewReducer(previewNoAspects, { type: 'GENERATE_CLICK' })
    expect(next.status).toBe('preview')
    expect(next.error?.kind).toBe('no-aspects-selected')
  })

  it('Test 8: GENERATE_CLICK from preview with >=1 aspect → status=generating', () => {
    const ok: SpecPreviewState = {
      ...initialSpecPreviewState,
      status: 'preview',
      spec: makeSpec(),
      aspects: { palette: true, typography: false, layout: false, decorations: false },
    }
    const next = specPreviewReducer(ok, { type: 'GENERATE_CLICK' })
    expect(next.status).toBe('generating')
    expect(next.error).toBeNull()
  })

  it('Test 9: RE_EXTRACT_CLICK from preview decrements retriesRemaining and goes to extracting; zero retries blocked', () => {
    const preview2: SpecPreviewState = {
      ...initialSpecPreviewState,
      status: 'preview',
      spec: makeSpec(),
      references: [makeRow()],
      retriesRemaining: 2,
    }
    const s1 = specPreviewReducer(preview2, { type: 'RE_EXTRACT_CLICK' })
    expect(s1.status).toBe('extracting')
    expect(s1.retriesRemaining).toBe(1)

    const preview0: SpecPreviewState = { ...preview2, retriesRemaining: 0 }
    const blocked = specPreviewReducer(preview0, { type: 'RE_EXTRACT_CLICK' })
    expect(blocked.status).toBe('preview')
    expect(blocked.retriesRemaining).toBe(0)
    expect(blocked.error?.kind).toBe('no-retries-left')
  })

  it('Test 10: TOGGLE_ASPECT flips a single aspect; idempotent across two dispatches', () => {
    const preview: SpecPreviewState = {
      ...initialSpecPreviewState,
      status: 'preview',
      spec: makeSpec(),
    }
    const s1 = specPreviewReducer(preview, { type: 'TOGGLE_ASPECT', aspect: 'palette' })
    expect(s1.aspects.palette).toBe(false)
    expect(s1.aspects.typography).toBe(true)
    const s2 = specPreviewReducer(s1, { type: 'TOGGLE_ASPECT', aspect: 'palette' })
    expect(s2.aspects.palette).toBe(true) // back to original
    expect(s2.aspects).toEqual(preview.aspects)
  })

  // Test 11 (former remix-toggle reducer action) deleted — Phase 89
  // (BKSHELVE-06): the removed feature's action and its two state fields
  // no longer exist on the reducer.

  it('Test 12: UPLOAD_RESET resets retriesRemaining to 2, clears spec, sets status=idle', () => {
    const used: SpecPreviewState = {
      ...initialSpecPreviewState,
      status: 'preview',
      spec: makeSpec(),
      references: [makeRow('old.png')],
      retriesRemaining: 0,
    }
    const fresh = [makeRow('fresh.png')]
    const next = specPreviewReducer(used, { type: 'UPLOAD_RESET', references: fresh })
    expect(next.status).toBe('idle')
    expect(next.spec).toBeNull()
    expect(next.references).toEqual(fresh)
    expect(next.retriesRemaining).toBe(2)
    expect(next.error).toBeNull()
  })

  // Test 13 (CONFIRM_REFUSAL_WARNING) deleted — quick 260511-flj: gate removed.

  it('Test 14: discriminated-union exhaustiveness — every action type round-trips through the reducer', () => {
    // If a future action is added without a reducer case, this test still
    // returns a value (because of the typed default branch) — but TypeScript
    // will fail the build at the `_exhaustive: never` line in the reducer.
    // This runtime test simply asserts every documented action type produces
    // a SpecPreviewState (no throw, no undefined return).
    const allActions: SpecPreviewAction[] = [
      { type: 'UPLOAD_ADDED', row: makeRow() },
      { type: 'UPLOAD_REMOVED', index: 0 },
      { type: 'UPLOAD_RESET', references: [] },
      { type: 'EXTRACT_START' },
      { type: 'EXTRACT_SUCCESS', spec: makeSpec(), telemetry: makeTelemetry() },
      { type: 'EXTRACT_ERROR', error: { kind: 'extraction_failed' }, telemetry: makeTelemetry() },
      { type: 'RE_EXTRACT_CLICK' },
      { type: 'TOGGLE_ASPECT', aspect: 'palette' },
      { type: 'GENERATE_CLICK' },
      { type: 'GENERATE_DONE' },
      { type: 'CLEAR_ERROR' },
    ]
    for (const action of allActions) {
      const next = specPreviewReducer(initialSpecPreviewState, action)
      expect(next).toBeDefined()
      expect(typeof next.status).toBe('string')
    }
  })
})

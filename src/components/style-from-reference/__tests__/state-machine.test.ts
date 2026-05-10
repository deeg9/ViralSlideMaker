// Phase 76 Plan 01 (PREVIEW-01, PREVIEW-09):
// State-machine reducer tests — load-bearing invariant defense for the
// mandatory non-skippable spec-preview flow. Pure-function tests; no DOM.
//
// 14 tests pin every transition + the PREVIEW-01 invariant (Test 6) that
// makes "Generate without prior preview" structurally unreachable.

import { describe, it, expect } from 'vitest'
import {
  specPreviewReducer,
  initialSpecPreviewState,
  type SpecPreviewState,
  type SpecPreviewAction,
} from '../state-machine'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { RefusalFlags } from '@/lib/ai/refusal-pre-pass'
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
  return {
    schema_version: 1,
    palette: { mode: 'solid', primary: '#A8E0B0' },
    typography: { hookFontCategory: 'sans-serif' },
    layout: { hookPosition: 'top', density: 'medium' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'Bold magazine voice',
    ...overrides,
  }
}

function makeTelemetry(): ExtractTelemetry {
  return {
    vision_calls_count: 2,
    tokens_in: 100,
    tokens_out: 50,
    cache_hit: false,
    duration_ms: 1234,
  }
}

const FLAGS_NONE: RefusalFlags[] = []
const FLAGS_FACE: RefusalFlags[] = [
  { contains_logo: false, contains_face: true, contains_watermark: false },
]

describe('Phase 76 Plan 01: specPreviewReducer — initial state + transitions', () => {
  it('Test 1: initialSpecPreviewState exposes the locked default shape', () => {
    expect(initialSpecPreviewState).toEqual<SpecPreviewState>({
      status: 'idle',
      references: [],
      spec: null,
      refusalFlags: [],
      refusalAcknowledged: false,
      retriesRemaining: 2,
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      useBrandKitRemix: false,
      brandKitAvailable: false,
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

  it('Test 4: EXTRACT_SUCCESS only fires from extracting; spec + refusalFlags set, status=preview', () => {
    const extractingState: SpecPreviewState = {
      ...initialSpecPreviewState,
      references: [makeRow()],
      status: 'extracting',
    }
    const spec = makeSpec()
    const sOk = specPreviewReducer(extractingState, {
      type: 'EXTRACT_SUCCESS',
      spec,
      refusalFlags: FLAGS_FACE,
      telemetry: makeTelemetry(),
    })
    expect(sOk.status).toBe('preview')
    expect(sOk.spec).toEqual(spec)
    expect(sOk.refusalFlags).toEqual(FLAGS_FACE)
    expect(sOk.lastTelemetry).toEqual(makeTelemetry())

    // From idle → state unchanged (no leak)
    const sLeak = specPreviewReducer(initialSpecPreviewState, {
      type: 'EXTRACT_SUCCESS',
      spec,
      refusalFlags: FLAGS_NONE,
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

  it('Test 11: TOGGLE_BRAND_KIT_REMIX requires brandKitAvailable=true; otherwise unchanged', () => {
    const noKit: SpecPreviewState = {
      ...initialSpecPreviewState,
      status: 'preview',
      spec: makeSpec(),
      brandKitAvailable: false,
      useBrandKitRemix: false,
    }
    const sNoKit = specPreviewReducer(noKit, { type: 'TOGGLE_BRAND_KIT_REMIX' })
    expect(sNoKit.useBrandKitRemix).toBe(false) // unchanged

    const withKit: SpecPreviewState = { ...noKit, brandKitAvailable: true }
    const sWithKit = specPreviewReducer(withKit, { type: 'TOGGLE_BRAND_KIT_REMIX' })
    expect(sWithKit.useBrandKitRemix).toBe(true)
    const sWithKit2 = specPreviewReducer(sWithKit, { type: 'TOGGLE_BRAND_KIT_REMIX' })
    expect(sWithKit2.useBrandKitRemix).toBe(false)
  })

  it('Test 12: UPLOAD_RESET resets retriesRemaining to 2, clears spec, sets status=idle', () => {
    const used: SpecPreviewState = {
      ...initialSpecPreviewState,
      status: 'preview',
      spec: makeSpec(),
      references: [makeRow('old.png')],
      retriesRemaining: 0,
      refusalFlags: FLAGS_FACE,
      refusalAcknowledged: true,
    }
    const fresh = [makeRow('fresh.png')]
    const next = specPreviewReducer(used, { type: 'UPLOAD_RESET', references: fresh })
    expect(next.status).toBe('idle')
    expect(next.spec).toBeNull()
    expect(next.references).toEqual(fresh)
    expect(next.retriesRemaining).toBe(2)
    expect(next.refusalFlags).toEqual([])
    expect(next.refusalAcknowledged).toBe(false)
    expect(next.error).toBeNull()
  })

  it('Test 13: CONFIRM_REFUSAL_WARNING from preview flips refusalAcknowledged only — status unchanged', () => {
    const preview: SpecPreviewState = {
      ...initialSpecPreviewState,
      status: 'preview',
      spec: makeSpec(),
      refusalFlags: FLAGS_FACE,
      refusalAcknowledged: false,
    }
    const next = specPreviewReducer(preview, { type: 'CONFIRM_REFUSAL_WARNING' })
    expect(next.status).toBe('preview') // status MUST NOT advance
    expect(next.refusalAcknowledged).toBe(true)

    // From a non-preview status → no-op (does not flip the flag)
    const idle = specPreviewReducer(initialSpecPreviewState, { type: 'CONFIRM_REFUSAL_WARNING' })
    expect(idle.refusalAcknowledged).toBe(false)
  })

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
      { type: 'EXTRACT_SUCCESS', spec: makeSpec(), refusalFlags: FLAGS_NONE, telemetry: makeTelemetry() },
      { type: 'EXTRACT_ERROR', error: { kind: 'extraction_failed' }, telemetry: makeTelemetry() },
      { type: 'RE_EXTRACT_CLICK' },
      { type: 'TOGGLE_ASPECT', aspect: 'palette' },
      { type: 'TOGGLE_BRAND_KIT_REMIX' },
      { type: 'CONFIRM_REFUSAL_WARNING' },
      { type: 'GENERATE_CLICK' },
      { type: 'GENERATE_DONE' },
      { type: 'BRAND_KIT_AVAILABILITY', available: true },
      { type: 'CLEAR_ERROR' },
    ]
    for (const action of allActions) {
      const next = specPreviewReducer(initialSpecPreviewState, action)
      expect(next).toBeDefined()
      expect(typeof next.status).toBe('string')
    }
  })
})

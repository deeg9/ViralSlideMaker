// Phase 77 Plan 01 (EMIT-07):
// Unit tests for applyAspectFilter — the upstream zeroing seam that lets
// the projector stay pure (it consumes spec only, never reads aspect flags).
//
// 12 tests covering every aspect combination, referential transparency,
// immutability, neutral-default semantics.

import { describe, it, expect } from 'vitest'
import {
  applyAspectFilter,
  NEUTRAL_PALETTE_DEFAULT,
  NEUTRAL_TYPOGRAPHY_DEFAULT,
  NEUTRAL_LAYOUT_DEFAULT,
  NEUTRAL_DECORATIONS_DEFAULT,
} from '@/lib/ai/style-spec-aspect-filter'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { SpecPreviewAspects } from '@/components/style-from-reference/state-machine'

// Test fixture — Murphy Campbell magazine reference style (from
// .planning/research/ARCHITECTURE.md §"Example StyleSpec"): black background,
// mint accent, Anton hook, photo-bleed, sparse decorations.
function buildSpec(): StyleSpec {
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: {
      mode: 'solid',
      primary: '#000000',
      secondary: '#FFFFFF',
      accent: '#A8E6CF', // mint
    },
    typography: {
      hookFontCategory: 'display', // Anton
      bodyFontCategory: 'sans-serif',
    },
    layout: {
      hookPosition: 'bottom',
      density: 'tight',
    },
    imagery: {
      treatmentPreset: 'bw',
    },
    decorations: {
      preferredLucide: ['Star', 'Sparkles'],
      preferredShapes: ['circle', 'rect'],
      density: 'sparse',
    },
    rhythm: {
      cadence: 'punchy',
    },
    voice_note: 'editorial magazine bold',
  }
}

const ALL_TRUE: SpecPreviewAspects = {
  palette: true,
  typography: true,
  layout: true,
  decorations: true,
}

describe('applyAspectFilter', () => {
  // Test 1
  it('returns deep clone equal to spec when all aspects true', () => {
    const spec = buildSpec()
    const result = applyAspectFilter(spec, ALL_TRUE)
    expect(result).toEqual(spec)
    // Even when no neutralization happens, the helper must return a NEW object
    // (no mutation contract — see Test 8).
    expect(result).not.toBe(spec)
  })

  // Test 2
  it('replaces palette with NEUTRAL_PALETTE_DEFAULT when palette:false; other sections untouched', () => {
    const spec = buildSpec()
    const result = applyAspectFilter(spec, { ...ALL_TRUE, palette: false })
    expect(result.palette).toEqual(NEUTRAL_PALETTE_DEFAULT)
    expect(result.typography).toEqual(spec.typography)
    expect(result.layout).toEqual(spec.layout)
    expect(result.imagery).toEqual(spec.imagery)
    expect(result.decorations).toEqual(spec.decorations)
    expect(result.rhythm).toEqual(spec.rhythm)
    expect(result.voice_note).toBe(spec.voice_note)
  })

  // Test 3
  it('replaces typography with NEUTRAL_TYPOGRAPHY_DEFAULT when typography:false', () => {
    const spec = buildSpec()
    const result = applyAspectFilter(spec, { ...ALL_TRUE, typography: false })
    expect(result.typography).toEqual(NEUTRAL_TYPOGRAPHY_DEFAULT)
    expect(result.typography.hookFontCategory).toBeUndefined()
    expect(result.typography.bodyFontCategory).toBeUndefined()
    expect(result.palette).toEqual(spec.palette)
    expect(result.layout).toEqual(spec.layout)
    expect(result.decorations).toEqual(spec.decorations)
  })

  // Test 4
  it('replaces layout with NEUTRAL_LAYOUT_DEFAULT when layout:false', () => {
    const spec = buildSpec()
    const result = applyAspectFilter(spec, { ...ALL_TRUE, layout: false })
    expect(result.layout).toEqual(NEUTRAL_LAYOUT_DEFAULT)
    expect(result.layout.hookPosition).toBeUndefined()
    expect(result.layout.density).toBeUndefined()
    expect(result.palette).toEqual(spec.palette)
    expect(result.typography).toEqual(spec.typography)
    expect(result.decorations).toEqual(spec.decorations)
  })

  // Test 5
  it('replaces decorations with NEUTRAL_DECORATIONS_DEFAULT when decorations:false', () => {
    const spec = buildSpec()
    const result = applyAspectFilter(spec, { ...ALL_TRUE, decorations: false })
    expect(result.decorations).toEqual(NEUTRAL_DECORATIONS_DEFAULT)
    expect(result.decorations.preferredLucide).toEqual([])
    expect(result.decorations.preferredShapes).toEqual([])
    expect(result.decorations.density).toBeUndefined()
    expect(result.palette).toEqual(spec.palette)
    expect(result.typography).toEqual(spec.typography)
    expect(result.layout).toEqual(spec.layout)
  })

  // Test 6
  it('zeroes all 4 sections when all aspects false; preserves voice_note + rhythm + schema_version', () => {
    const spec = buildSpec()
    const allFalse: SpecPreviewAspects = {
      palette: false,
      typography: false,
      layout: false,
      decorations: false,
    }
    const result = applyAspectFilter(spec, allFalse)
    expect(result.palette).toEqual(NEUTRAL_PALETTE_DEFAULT)
    expect(result.typography).toEqual(NEUTRAL_TYPOGRAPHY_DEFAULT)
    expect(result.layout).toEqual(NEUTRAL_LAYOUT_DEFAULT)
    expect(result.decorations).toEqual(NEUTRAL_DECORATIONS_DEFAULT)
    // Preserved
    expect(result.voice_note).toBe(spec.voice_note)
    expect(result.rhythm).toEqual(spec.rhythm)
    expect(result.schema_version).toBe(spec.schema_version)
    // Imagery is NOT one of the 4 aspect toggles — preserved
    expect(result.imagery).toEqual(spec.imagery)
  })

  // Test 7 — REFERENTIAL TRANSPARENCY
  it('returns byte-identical JSON.stringify across 10 calls (referential transparency)', () => {
    const spec = buildSpec()
    const aspects: SpecPreviewAspects = {
      palette: true,
      typography: false,
      layout: true,
      decorations: false,
    }
    const first = JSON.stringify(applyAspectFilter(spec, aspects))
    for (let i = 0; i < 9; i += 1) {
      expect(JSON.stringify(applyAspectFilter(spec, aspects))).toBe(first)
    }
  })

  // Test 8 — IMMUTABILITY
  it('does not mutate the input spec', () => {
    const spec = buildSpec()
    const snapshot = JSON.parse(JSON.stringify(spec))
    applyAspectFilter(spec, { palette: false, typography: false, layout: false, decorations: false })
    expect(spec).toEqual(snapshot)
  })

  // Test 9
  it('preserves schema_version literal across all aspect combinations', () => {
    const spec = buildSpec()
    const cases: SpecPreviewAspects[] = [
      ALL_TRUE,
      { palette: false, typography: true, layout: true, decorations: true },
      { palette: true, typography: false, layout: true, decorations: true },
      { palette: true, typography: true, layout: false, decorations: true },
      { palette: true, typography: true, layout: true, decorations: false },
      { palette: false, typography: false, layout: false, decorations: false },
    ]
    for (const aspects of cases) {
      expect(applyAspectFilter(spec, aspects).schema_version).toBe(2)
    }
  })

  // Test 10
  it('preserves voice_note across all aspect combinations (it is a prompt input, never zeroed)', () => {
    const spec = buildSpec()
    const cases: SpecPreviewAspects[] = [
      ALL_TRUE,
      { palette: false, typography: false, layout: false, decorations: false },
      { palette: false, typography: true, layout: false, decorations: true },
    ]
    for (const aspects of cases) {
      expect(applyAspectFilter(spec, aspects).voice_note).toBe('editorial magazine bold')
    }
  })

  // Test 11
  it('preserves rhythm.cadence across all aspect combinations (rhythm is not a toggle)', () => {
    const spec = buildSpec()
    const cases: SpecPreviewAspects[] = [
      ALL_TRUE,
      { palette: false, typography: false, layout: false, decorations: false },
    ]
    for (const aspects of cases) {
      expect(applyAspectFilter(spec, aspects).rhythm.cadence).toBe('punchy')
    }
  })

  // Test 12
  it('NEUTRAL_PALETTE_DEFAULT is solid + white primary, no secondary/accent (template default fallback)', () => {
    expect(NEUTRAL_PALETTE_DEFAULT.mode).toBe('solid')
    expect(NEUTRAL_PALETTE_DEFAULT.primary).toBe('#FFFFFF')
    expect(NEUTRAL_PALETTE_DEFAULT.secondary).toBeUndefined()
    expect(NEUTRAL_PALETTE_DEFAULT.accent).toBeUndefined()
  })
})

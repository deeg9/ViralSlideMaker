// Phase 77 Plan 01 (EMIT-07) + Phase 76 (PREVIEW-08):
// Unit tests for applyBrandKitRemix — per-field merge of brand-kit values
// over StyleSpec values when the user toggles brand-kit-remix on.
//
// 11 tests covering null short-circuit, per-field merge semantics,
// immutability, purity.

import { describe, it, expect } from 'vitest'
import { applyBrandKitRemix } from '@/lib/ai/style-spec-brand-kit-merge'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { BrandKit } from '@/lib/types/brand-kit'

function buildSpec(): StyleSpec {
  return {
    schema_version: 1,
    palette: {
      mode: 'solid',
      primary: '#000000',
      secondary: '#FFFFFF',
      accent: '#A8E6CF',
    },
    typography: {
      hookFontCategory: 'display',
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
      preferredLucide: ['Star'],
      preferredShapes: ['circle'],
      density: 'sparse',
    },
    rhythm: {
      cadence: 'punchy',
    },
    voice_note: 'editorial magazine bold',
  }
}

function buildEmptyBrandKit(): BrandKit {
  return {
    id: 'bk-1',
    user_id: 'u-1',
    name: 'Empty Kit',
    primary_color: null,
    secondary_color: null,
    text_color: null,
    background_color: null,
    font_family: null,
    logo_url: null,
    logo_position: null,
    logo_size_pct: null,
    logo_opacity_pct: null,
    heading_font_family: null,
    body_font_family: null,
    accent_color: null,
    text_align: null,
    text_position: null,
    hook_style: null,
    overlay_opacity_pct: null,
    created_at: '2026-05-10T00:00:00Z',
    updated_at: '2026-05-10T00:00:00Z',
  }
}

describe('applyBrandKitRemix', () => {
  // Test 1
  it('returns spec referentially unchanged when brandKit is null (short-circuit)', () => {
    const spec = buildSpec()
    const result = applyBrandKitRemix(spec, null)
    expect(Object.is(result, spec)).toBe(true)
  })

  // Test 2
  it('returns spec unchanged when brand-kit has no overlapping fields', () => {
    const spec = buildSpec()
    const brandKit = buildEmptyBrandKit()
    const result = applyBrandKitRemix(spec, brandKit)
    expect(JSON.stringify(result)).toBe(JSON.stringify(spec))
  })

  // Test 3
  it('overrides spec.palette.primary when brandKit defines primary_color', () => {
    const spec = buildSpec()
    const brandKit = { ...buildEmptyBrandKit(), primary_color: '#FF0000' }
    const result = applyBrandKitRemix(spec, brandKit)
    expect(result.palette.primary).toBe('#FF0000')
    // Other palette fields preserved from spec
    expect(result.palette.secondary).toBe('#FFFFFF')
    expect(result.palette.accent).toBe('#A8E6CF')
    expect(result.palette.mode).toBe('solid')
  })

  // Test 4
  it('overrides spec.palette.accent when brandKit defines accent_color', () => {
    const spec = buildSpec()
    const brandKit = { ...buildEmptyBrandKit(), accent_color: '#00FF00' }
    const result = applyBrandKitRemix(spec, brandKit)
    expect(result.palette.accent).toBe('#00FF00')
    expect(result.palette.primary).toBe('#000000')
    expect(result.palette.secondary).toBe('#FFFFFF')
  })

  // Test 5
  it('overrides primary + secondary + accent when brandKit defines all 3; mode preserved from spec', () => {
    const spec = buildSpec()
    const brandKit = {
      ...buildEmptyBrandKit(),
      primary_color: '#111111',
      secondary_color: '#222222',
      accent_color: '#333333',
    }
    const result = applyBrandKitRemix(spec, brandKit)
    expect(result.palette.primary).toBe('#111111')
    expect(result.palette.secondary).toBe('#222222')
    expect(result.palette.accent).toBe('#333333')
    // Mode is structural — brand kit has no mode field; spec.palette.mode wins
    expect(result.palette.mode).toBe('solid')
  })

  // Test 6
  it('overrides hookFontCategory based on brandKit.heading_font_family category lookup', () => {
    const spec = buildSpec()
    // Anton is a display font in the catalog; use a known sans-serif font (Inter)
    // to verify the category resolution flips from 'display' → 'sans-serif'.
    const brandKit = { ...buildEmptyBrandKit(), heading_font_family: 'Inter' }
    const result = applyBrandKitRemix(spec, brandKit)
    expect(result.typography.hookFontCategory).toBe('sans-serif')
    // bodyFontCategory preserved from spec
    expect(result.typography.bodyFontCategory).toBe('sans-serif')
  })

  // Test 7
  it('overrides bodyFontCategory based on brandKit.body_font_family category lookup', () => {
    const spec = buildSpec()
    // Playfair Display is a serif font in the catalog
    const brandKit = { ...buildEmptyBrandKit(), body_font_family: 'Playfair Display' }
    const result = applyBrandKitRemix(spec, brandKit)
    expect(result.typography.bodyFontCategory).toBe('serif')
    // hookFontCategory preserved from spec
    expect(result.typography.hookFontCategory).toBe('display')
  })

  // Test 8 — PER-FIELD MERGE
  it('per-field merge: brandKit defines primary_color but not accent_color → accent preserved from spec', () => {
    const spec = buildSpec()
    const brandKit = { ...buildEmptyBrandKit(), primary_color: '#FF0000' }
    const result = applyBrandKitRemix(spec, brandKit)
    expect(result.palette.primary).toBe('#FF0000') // from brand kit
    expect(result.palette.accent).toBe('#A8E6CF') // preserved from spec
    expect(result.palette.secondary).toBe('#FFFFFF') // preserved from spec
  })

  // Test 9 — IMMUTABILITY
  it('does not mutate input spec or input brandKit', () => {
    const spec = buildSpec()
    const brandKit = {
      ...buildEmptyBrandKit(),
      primary_color: '#FF0000',
      accent_color: '#00FF00',
      heading_font_family: 'Inter',
    }
    const specSnapshot = JSON.parse(JSON.stringify(spec))
    const brandKitSnapshot = JSON.parse(JSON.stringify(brandKit))
    applyBrandKitRemix(spec, brandKit)
    expect(spec).toEqual(specSnapshot)
    expect(brandKit).toEqual(brandKitSnapshot)
  })

  // Test 10
  it('layout / imagery / decorations / rhythm / voice_note / schema_version all preserved (brand kit only touches palette + typography)', () => {
    const spec = buildSpec()
    const brandKit = {
      ...buildEmptyBrandKit(),
      primary_color: '#FF0000',
      heading_font_family: 'Inter',
    }
    const result = applyBrandKitRemix(spec, brandKit)
    expect(result.layout).toEqual(spec.layout)
    expect(result.imagery).toEqual(spec.imagery)
    expect(result.decorations).toEqual(spec.decorations)
    expect(result.rhythm).toEqual(spec.rhythm)
    expect(result.voice_note).toBe(spec.voice_note)
    expect(result.schema_version).toBe(1)
  })

  // Test 11 — PURITY
  it('returns byte-identical JSON.stringify across repeated calls', () => {
    const spec = buildSpec()
    const brandKit = {
      ...buildEmptyBrandKit(),
      primary_color: '#FF0000',
      accent_color: '#00FF00',
      body_font_family: 'Playfair Display',
    }
    const first = JSON.stringify(applyBrandKitRemix(spec, brandKit))
    for (let i = 0; i < 9; i += 1) {
      expect(JSON.stringify(applyBrandKitRemix(spec, brandKit))).toBe(first)
    }
  })
})

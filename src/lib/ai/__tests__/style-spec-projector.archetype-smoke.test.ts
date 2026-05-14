// Phase 80 Plan 04 smoke checks — verifies ARCHETYPE_TO_TEMPLATE emission
// + flat-color palette dispatch + caption-bar-top layout override + R7
// decoration-default fix end-to-end. NOT a full unit suite (that lands in
// Plan 07 with refreshed fixtures); this exists so the Plan 04 commit
// includes its own acceptance proof.
import { describe, it, expect } from 'vitest'
import {
  projectStyleSpecToSlideOverrides,
  pickFlatColorTemplate,
} from '@/lib/ai/style-spec-projector'
import { getTemplate } from '@/lib/render/templates'
import type { StyleSpec } from '@/lib/types/style-spec'

const tmpl = getTemplate('highlight-bar')

function makeSpec(slideArchetype: StyleSpec['slideArchetype'], overrides: Partial<StyleSpec> = {}): StyleSpec {
  return {
    schema_version: 2,
    slideArchetype,
    palette: { mode: 'solid', primary: '#FFEE00', accent: '#000000' },
    typography: { hookFontCategory: 'display', bodyFontCategory: 'sans-serif' },
    layout: { hookPosition: 'bottom', density: 'tight' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { preferredLucide: [], preferredShapes: [], density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'editorial',
    ...overrides,
  } as StyleSpec
}

describe('Phase 80 Plan 04 archetype routing', () => {
  it('caption-bar-bottom → magazine-bold (no cover)', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('caption-bar-bottom'), tmpl)
    expect(r.style_overrides.template_id_override).toBe('magazine-bold')
    expect(r.style_overrides.layout).toBeUndefined()
  })
  it('caption-bar-top → magazine-bold + layout: cover', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('caption-bar-top'), tmpl)
    expect(r.style_overrides.template_id_override).toBe('magazine-bold')
    expect(r.style_overrides.layout).toBe('cover')
  })
  it('full-bleed-text-overlay → news-drop', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('full-bleed-text-overlay'), tmpl)
    expect(r.style_overrides.template_id_override).toBe('news-drop')
  })
  it('photo-collage-2up → news-drop', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('photo-collage-2up'), tmpl)
    expect(r.style_overrides.template_id_override).toBe('news-drop')
  })
  it('photo-collage-grid → news-drop', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('photo-collage-grid'), tmpl)
    expect(r.style_overrides.template_id_override).toBe('news-drop')
  })
  it('editorial-serif → editorial-serif', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('editorial-serif'), tmpl)
    expect(r.style_overrides.template_id_override).toBe('editorial-serif')
  })
  it('notes-sticker → notes-app-chic', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('notes-sticker'), tmpl)
    expect(r.style_overrides.template_id_override).toBe('notes-app-chic')
  })

  describe('flat-color-background palette dispatch', () => {
    it('yellow primary (#FFEE00, hue ≈56°) → bold-yellow', () => {
      const r = projectStyleSpecToSlideOverrides(
        makeSpec('flat-color-background', { palette: { mode: 'solid', primary: '#FFEE00' } }),
        tmpl,
      )
      expect(r.style_overrides.template_id_override).toBe('bold-yellow')
    })
    it('pink primary (#FF1493, hue ≈328°) → y2k-pop', () => {
      const r = projectStyleSpecToSlideOverrides(
        makeSpec('flat-color-background', { palette: { mode: 'solid', primary: '#FF1493' } }),
        tmpl,
      )
      expect(r.style_overrides.template_id_override).toBe('y2k-pop')
    })
    it('blue primary (#0066FF) → bold-yellow (default branch)', () => {
      const r = projectStyleSpecToSlideOverrides(
        makeSpec('flat-color-background', { palette: { mode: 'solid', primary: '#0066FF' } }),
        tmpl,
      )
      expect(r.style_overrides.template_id_override).toBe('bold-yellow')
    })
    it('invalid hex parses → bold-yellow (default)', () => {
      expect(pickFlatColorTemplate('#xxxxxx')).toBe('bold-yellow')
    })
  })

  it('R7: empty preferredLucide returns empty narrowed list (not full corpus)', () => {
    const r = projectStyleSpecToSlideOverrides(makeSpec('caption-bar-bottom'), tmpl)
    expect(r.decorations.lucide).toEqual([])
    expect(r.decorations.shapes).toEqual([])
  })

  it('Default fallback (no slideArchetype) → news-drop (DEFAULT_FALLBACK_ARCHETYPE)', () => {
    // Cast bypasses the discriminated union — simulates a degraded payload that
    // somehow reaches the projector pre-validator. In production Plan 02
    // ALWAYS resolves the fallback before reaching here; this guards the
    // defensive `??` in the projector body.
    const spec = makeSpec('full-bleed-text-overlay')
    delete (spec as { slideArchetype?: unknown }).slideArchetype
    const r = projectStyleSpecToSlideOverrides(spec, tmpl)
    expect(r.style_overrides.template_id_override).toBe('news-drop')
  })

  it('Projector is pure across 5 calls (byte-identical JSON)', () => {
    const spec = makeSpec('caption-bar-bottom')
    const first = JSON.stringify(projectStyleSpecToSlideOverrides(spec, tmpl))
    for (let i = 0; i < 4; i += 1) {
      expect(JSON.stringify(projectStyleSpecToSlideOverrides(spec, tmpl))).toBe(first)
    }
  })
})

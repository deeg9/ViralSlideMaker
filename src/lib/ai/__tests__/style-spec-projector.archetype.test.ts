// Phase 80 Plan 07 (R6, R7): Comprehensive projector archetype unit test.
//
// Companion to style-spec-projector.archetype-smoke.test.ts (Plan 04's
// acceptance proof). This file is the full unit suite required by Plan 07:
//
//   - All 8 archetypes (the closed SLIDE_ARCHETYPES tuple) are exercised and
//     asserted to map to the correct `template_id_override` per the locked
//     ARCHETYPE_TO_TEMPLATE map.
//   - The `flat-color-background` palette-driven dispatch is exercised on
//     yellow / pink / blue / default-fallback hex inputs.
//   - The decoration-default fix (R7) is asserted in both the empty-array and
//     undefined-array shapes, AND the non-empty happy path is sanity-checked
//     so we know the fix didn't break it.
//   - The default fallback for missing `slideArchetype` is exercised against
//     the projector's defensive `??` (in production, Plan 02 resolves the
//     fallback BEFORE the projector runs — this test pins the degraded-payload
//     path).
//   - Purity: the projector is pure; two calls on identical input produce
//     byte-identical JSON.
//
// The test file has zero Supabase / Gemini SDK imports — the projector is a
// pure function (see source-grep firewall enforced elsewhere). This file
// stays consistent with that contract.
import { describe, it, expect } from 'vitest'
import { projectStyleSpecToSlideOverrides } from '@/lib/ai/style-spec-projector'
import { getTemplate } from '@/lib/render/templates'
import {
  SLIDE_ARCHETYPES,
  type SlideArchetype,
} from '@/lib/types/style-spec-archetypes'
import type { StyleSpec } from '@/lib/types/style-spec'

// Use highlight-bar as the (irrelevant) template arg — the projector ignores
// the template arg today (reserved for future template-aware fallbacks).
const tmpl = getTemplate('highlight-bar')

/**
 * Minimal schema-version-2 StyleSpec builder. Caller supplies the archetype
 * + optional overrides; the rest of the fields are pinned to test-stable
 * defaults so individual `it` blocks stay readable.
 */
function makeSpec(
  slideArchetype: SlideArchetype,
  overrides: Partial<StyleSpec> = {},
): StyleSpec {
  return {
    schema_version: 2,
    slideArchetype,
    palette: { mode: 'solid', primary: '#000000', accent: '#FFFFFF' },
    typography: { hookFontCategory: 'display', bodyFontCategory: 'sans-serif' },
    layout: { hookPosition: 'bottom', density: 'tight' },
    imagery: { treatmentPreset: 'bw' },
    decorations: { preferredLucide: [], preferredShapes: [], density: 'sparse' },
    rhythm: { cadence: 'punchy' },
    voice_note: 'editorial',
    ...overrides,
  } as StyleSpec
}

describe('Phase 80 Plan 07 — projector archetype routing (comprehensive)', () => {
  // ------------------------------------------------------------- //
  // 1. All 8 archetypes route to the correct template_id_override //
  //    (closed mapping in ARCHETYPE_TO_TEMPLATE).                 //
  // ------------------------------------------------------------- //
  describe('all 8 archetypes route to the correct template_id_override (closed mapping)', () => {
    it('iterates SLIDE_ARCHETYPES — coverage gate', () => {
      // Coverage assertion: the locked enum is the 8-value tuple. If a new
      // archetype lands without updating this test, this gate fails.
      expect(SLIDE_ARCHETYPES).toHaveLength(8)
    })

    it('caption-bar-bottom → magazine-bold (no layout override)', () => {
      const r = projectStyleSpecToSlideOverrides(makeSpec('caption-bar-bottom'), tmpl)
      expect(r.style_overrides.template_id_override).toBe('magazine-bold')
      expect(r.style_overrides.layout).toBeUndefined()
    })

    it("caption-bar-top → magazine-bold AND layout === 'cover'", () => {
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

    it('flat-color-background (palette.primary=#000000) → bold-yellow (default branch)', () => {
      // Black hex parses → hue 0 (delta = 0) — falls through to default
      // branch in pickFlatColorTemplate (yellow 45-65 / pink 310-350 / else
      // → bold-yellow).
      const r = projectStyleSpecToSlideOverrides(makeSpec('flat-color-background'), tmpl)
      expect(r.style_overrides.template_id_override).toBe('bold-yellow')
    })

    it('editorial-serif → editorial-serif', () => {
      const r = projectStyleSpecToSlideOverrides(makeSpec('editorial-serif'), tmpl)
      expect(r.style_overrides.template_id_override).toBe('editorial-serif')
    })

    it('notes-sticker → notes-app-chic', () => {
      const r = projectStyleSpecToSlideOverrides(makeSpec('notes-sticker'), tmpl)
      expect(r.style_overrides.template_id_override).toBe('notes-app-chic')
    })
  })

  // ------------------------------------------------------------- //
  // 2. flat-color-background palette-driven dispatch              //
  // ------------------------------------------------------------- //
  describe('flat-color-background palette-driven dispatch', () => {
    it("primary='#FFD600' (yellow, HSL hue ~52°) → bold-yellow", () => {
      const r = projectStyleSpecToSlideOverrides(
        makeSpec('flat-color-background', {
          palette: { mode: 'solid', primary: '#FFD600' },
        }),
        tmpl,
      )
      expect(r.style_overrides.template_id_override).toBe('bold-yellow')
    })

    it("primary='#FF1AC9' (pink/magenta, HSL hue ~318°) → y2k-pop", () => {
      const r = projectStyleSpecToSlideOverrides(
        makeSpec('flat-color-background', {
          palette: { mode: 'solid', primary: '#FF1AC9' },
        }),
        tmpl,
      )
      expect(r.style_overrides.template_id_override).toBe('y2k-pop')
    })

    it("primary='#3344FF' (blue, HSL hue ~234°) → bold-yellow (default)", () => {
      const r = projectStyleSpecToSlideOverrides(
        makeSpec('flat-color-background', {
          palette: { mode: 'solid', primary: '#3344FF' },
        }),
        tmpl,
      )
      expect(r.style_overrides.template_id_override).toBe('bold-yellow')
    })
  })

  // ------------------------------------------------------------- //
  // 3. R7 decoration default fix — empty preferredLucide          //
  //    returns empty narrowed list (NOT the full corpus).         //
  // ------------------------------------------------------------- //
  describe('R7 decoration default fix', () => {
    it('empty preferredLucide + empty preferredShapes → empty narrowed lists', () => {
      const r = projectStyleSpecToSlideOverrides(makeSpec('caption-bar-bottom'), tmpl)
      expect(r.decorations.lucide).toEqual([])
      expect(r.decorations.shapes).toEqual([])
    })

    it('undefined preferredLucide + undefined preferredShapes → empty narrowed lists (not full corpus)', () => {
      // Build a spec where decorations.preferredLucide / preferredShapes are
      // explicitly absent (undefined). The fix must NOT fall back to the full
      // 100-icon AI_LUCIDE_ALLOWLIST corpus — empty in, empty out.
      const r = projectStyleSpecToSlideOverrides(
        makeSpec('caption-bar-bottom', {
          decorations: { density: 'sparse' } as StyleSpec['decorations'],
        }),
        tmpl,
      )
      expect(r.decorations.lucide).toEqual([])
      expect(r.decorations.shapes).toEqual([])
    })
  })

  // ------------------------------------------------------------- //
  // 4. Non-empty preferredLucide still filters to corpus subset   //
  //    (happy-path sanity check — the fix didn't break filtering) //
  // ------------------------------------------------------------- //
  it("non-empty preferredLucide (['Star']) still filters to ['Star']", () => {
    // 'Star' is in AI_LUCIDE_ALLOWLIST (verified at src/lib/ai/schemas.ts:238).
    const r = projectStyleSpecToSlideOverrides(
      makeSpec('caption-bar-bottom', {
        decorations: {
          preferredLucide: ['Star'],
          preferredShapes: [],
          density: 'sparse',
        } as StyleSpec['decorations'],
      }),
      tmpl,
    )
    expect(r.decorations.lucide).toEqual(['Star'])
  })

  // ------------------------------------------------------------- //
  // 5. Default fallback when slideArchetype is undefined          //
  // ------------------------------------------------------------- //
  it('default fallback when slideArchetype is undefined → news-drop (DEFAULT_FALLBACK_ARCHETYPE = full-bleed-text-overlay)', () => {
    // In production, Plan 02's validator resolves the fallback BEFORE the
    // projector runs. This test pins the defensive `??` path in the
    // projector body — important guard against degraded payloads slipping
    // past the validator.
    const spec = makeSpec('full-bleed-text-overlay')
    delete (spec as { slideArchetype?: unknown }).slideArchetype
    const r = projectStyleSpecToSlideOverrides(spec as unknown as StyleSpec, tmpl)
    expect(r.style_overrides.template_id_override).toBe('news-drop')
  })

  // ------------------------------------------------------------- //
  // 6. Purity — same spec → byte-identical output                 //
  // ------------------------------------------------------------- //
  it('purity: same spec input produces byte-identical JSON output across 2 calls', () => {
    const spec = makeSpec('caption-bar-bottom')
    const first = JSON.stringify(projectStyleSpecToSlideOverrides(spec, tmpl))
    const second = JSON.stringify(projectStyleSpecToSlideOverrides(spec, tmpl))
    expect(second).toBe(first)
  })
})

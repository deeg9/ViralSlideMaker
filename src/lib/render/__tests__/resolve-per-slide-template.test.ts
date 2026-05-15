import { describe, it, expect } from 'vitest'
import { resolvePerSlideTemplate } from '../resolve-per-slide-template'
import { getTemplate, type SlideTemplate } from '../templates'
import { synthesizeBrandKitTemplate, BRAND_KIT_TEMPLATE_ID } from '@/lib/brand-kit/get-effective-template'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'
import type { BrandKit } from '@/lib/types/brand-kit'

/**
 * quick-260515-epn — unit coverage for the single-source-of-truth helper
 * that resolves a slide's effective SlideTemplate given (slide,
 * projectTemplate). Tests lock the precedence rules + the TPLREND-05
 * byte-identity gate (`===` reference equality when no override is set).
 *
 * Resolution precedence (most-specific first):
 *   1. slide.template_id_override  (top-level — generation pipeline lifts
 *      from style_overrides.template_id_override after PROJECTOR FUSION)
 *   2. slide.style_overrides?.template_id_override  (defensive pre-fusion
 *      shape — projector emit before generator lift)
 *   3. projectTemplate  (caller-resolved: brand-kit synthesis OR registry
 *      lookup by project.template_id — the helper is brand-kit-agnostic)
 *
 * Unknown ids silently fall back to projectTemplate (mirrors STYLESPEC-10 /
 * EMIT-08 / PARITY-03 closed-enum hygiene from STATE.md).
 */

function makeSlide(overrides: {
  template_id_override?: string
  style_overrides?: SlideStyleOverrides
} = {}): Slide {
  return {
    hook_text: 'HOOK',
    body_text: 'BODY',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    style_overrides: overrides.style_overrides,
    template_id_override: overrides.template_id_override,
  }
}

function makeBrandKit(): BrandKit {
  // Minimum viable BrandKit for synthesizeBrandKitTemplate. The shape comes
  // from src/lib/types/brand-kit.ts but the helper only reads string-ish
  // optional fields; we stub the required identity fields.
  return {
    id: 'bk-1',
    user_id: 'u-1',
    name: 'Acme',
    created_at: '2026-05-15T00:00:00Z',
    updated_at: '2026-05-15T00:00:00Z',
  } as unknown as BrandKit
}

describe('resolvePerSlideTemplate', () => {
  // -------------------------------------------------------------------------
  // Test 1: byte-identity gate (TPLREND-05)
  // -------------------------------------------------------------------------
  it('returns the projectTemplate by REFERENCE when slide has no override (TPLREND-05 byte-identity)', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const slide = makeSlide()
    const result = resolvePerSlideTemplate(slide, projectTemplate)
    // EXACT pointer equality — not deep-equal — locks the byte-identity gate.
    expect(result).toBe(projectTemplate)
  })

  // -------------------------------------------------------------------------
  // Test 2: top-level override wins → magazine-bold
  // -------------------------------------------------------------------------
  it('returns the magazine-bold template (id + backgroundMode) when slide.template_id_override = magazine-bold', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const slide = makeSlide({ template_id_override: 'magazine-bold' })
    const result = resolvePerSlideTemplate(slide, projectTemplate)
    expect(result.id).toBe('magazine-bold')
    // Double-checks the magazine-bold registry entry is unchanged — out-of-scope safety net.
    expect(result.backgroundMode).toBe('image-with-bottom-card')
  })

  // -------------------------------------------------------------------------
  // Test 3: style_overrides fallback (pre-fusion projector shape)
  // -------------------------------------------------------------------------
  it('honors style_overrides.template_id_override when top-level slot is empty (pre-fusion projector emit)', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const slide = makeSlide({
      style_overrides: { template_id_override: 'magazine-bold' },
    })
    const result = resolvePerSlideTemplate(slide, projectTemplate)
    expect(result.id).toBe('magazine-bold')
  })

  // -------------------------------------------------------------------------
  // Test 4: top-level wins over style_overrides when both are set
  // -------------------------------------------------------------------------
  it('top-level template_id_override wins when both slots are set to different ids', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const slide = makeSlide({
      template_id_override: 'magazine-bold',
      style_overrides: { template_id_override: 'documentary' },
    })
    const result = resolvePerSlideTemplate(slide, projectTemplate)
    expect(result.id).toBe('magazine-bold')
  })

  // -------------------------------------------------------------------------
  // Test 5: unknown id → silent-drop, return projectTemplate (not templates[0])
  // -------------------------------------------------------------------------
  it('silently falls back to projectTemplate (not templates[0]) when override id is not in TEMPLATE_IDS', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const slide = makeSlide({
      template_id_override: 'this-template-does-not-exist',
    })
    // No throws.
    const result = resolvePerSlideTemplate(slide, projectTemplate)
    // Returns the project template by reference — NOT the registry fallback
    // (templates[0] = highlight-bar). This is the silent-drop discipline
    // (STYLESPEC-10 / EMIT-08 / PARITY-03).
    expect(result).toBe(projectTemplate)
    expect(result.id).toBe('bold-yellow')
  })

  // -------------------------------------------------------------------------
  // Test 6: brand-kit passthrough (no override → caller-synthesized brand kit template wins)
  // -------------------------------------------------------------------------
  it('returns the synthesized brand-kit template unchanged when slide has no override', () => {
    const brandKitTemplate = synthesizeBrandKitTemplate(makeBrandKit())
    expect(brandKitTemplate.id).toBe(BRAND_KIT_TEMPLATE_ID)
    const slide = makeSlide()
    const result = resolvePerSlideTemplate(slide, brandKitTemplate)
    // Returned by reference — brand-kit synthesis is the caller's job; the
    // helper does not consult or rebuild brand-kit fields.
    expect(result).toBe(brandKitTemplate)
  })

  // -------------------------------------------------------------------------
  // Test 7: brand-kit + override → override wins (per-slide override > brand-kit)
  // -------------------------------------------------------------------------
  it('per-slide override beats brand-kit synthesis (precedence: override > brand-kit > project)', () => {
    const brandKitTemplate = synthesizeBrandKitTemplate(makeBrandKit())
    const slide = makeSlide({ template_id_override: 'magazine-bold' })
    const result = resolvePerSlideTemplate(slide, brandKitTemplate)
    expect(result.id).toBe('magazine-bold')
    expect(result.backgroundMode).toBe('image-with-bottom-card')
  })

  // -------------------------------------------------------------------------
  // Bonus: type-narrowing safety — helper accepts a Pick<> so callers don't
  // need a full Slide to test the predicate.
  // -------------------------------------------------------------------------
  it('accepts a Pick<Slide, "template_id_override" | "style_overrides"> shape', () => {
    const projectTemplate = getTemplate('bold-yellow')
    const minimal: Pick<Slide, 'template_id_override' | 'style_overrides'> = {
      template_id_override: 'magazine-bold',
    }
    const result: SlideTemplate = resolvePerSlideTemplate(minimal, projectTemplate)
    expect(result.id).toBe('magazine-bold')
  })
})

// Phase 85 Plan 01 Task 3 (RECGEN-01):
// Unit tests for applyLayoutRecipe — the deterministic recipe-application
// core. Covers: the SC3 no-op path (null/undefined recipe → byte-identical
// slides), caption-card 1:1 mapping, role mapping (0→cover, is_cta→cta,
// else→body), skip-emit on absent roles, hook band → numeric resolution,
// input immutability, and the accessory_label "intent only" contract.

import { describe, it, expect } from 'vitest'

import { applyLayoutRecipe } from '@/lib/ai/layout-recipe-apply'
import type { Slide } from '@/lib/types/slide'
import type { LayoutRecipe } from '@/lib/types/layout-recipe'

/** Minimal slide builder. */
function slide(overrides: Partial<Slide>): Slide {
  return {
    hook_text: 'HEADLINE',
    body_text: 'Supporting copy',
    image_query: 'news photo',
    is_cta: false,
    background_url: 'https://example.com/photo.jpg',
    pexels_photo_id: 100,
    ...overrides,
  }
}

/** A 4-slide fixture: slide 0 = cover, slide 3 = cta (is_cta), 1-2 = body. */
function buildSlides(): Slide[] {
  return [
    slide({ hook_text: 'COVER' }),
    slide({ hook_text: 'BODY ONE' }),
    slide({ hook_text: 'BODY TWO' }),
    slide({ hook_text: 'FOLLOW FOR MORE', is_cta: true }),
  ]
}

/**
 * A full recipe with cover/body/cta roles each carrying a DISTINCT
 * caption_card.x — so role mapping can be asserted by which slide got
 * which x value.
 */
function buildRecipe(): LayoutRecipe {
  return {
    schema_version: 1,
    accent_cadence: 'frequent',
    roles: {
      cover: {
        layout_mode: 'full-bleed-text-overlay',
        caption_card: {
          enabled: true,
          x: 11,
          y: 62,
          width: 78,
          height_pct: 38,
          blend_pct: 12,
          opacity: 0.85,
          position: 'bottom',
        },
        hook: { position_band: 'center', font_size_band: 'xl', text_align: 'center' },
        accessory_label: { enabled: true, position_band: 'top' },
      },
      body: {
        layout_mode: 'full-bleed-text-overlay',
        caption_card: {
          enabled: true,
          x: 22,
          y: 70,
          width: 70,
          height_pct: 30,
          blend_pct: 6,
          opacity: 0.9,
          position: 'top',
        },
        hook: { position_band: 'upper', font_size_band: 'md', text_align: 'left' },
      },
      cta: {
        layout_mode: 'full-bleed-text-overlay',
        caption_card: {
          enabled: true,
          x: 33,
          y: 55,
          width: 60,
          height_pct: 40,
          blend_pct: 20,
          opacity: 0.8,
          position: 'bottom',
        },
        hook: { position_band: 'bottom', font_size_band: 'lg', text_align: 'right' },
      },
    },
  }
}

describe('applyLayoutRecipe', () => {
  describe('SC3 — no-op path (no recipe)', () => {
    it('returns byte-identical slides when recipe is null', () => {
      const slides = buildSlides()
      const out = applyLayoutRecipe(slides, null)
      expect(JSON.stringify(out)).toBe(JSON.stringify(slides))
    })

    it('returns byte-identical slides when recipe is undefined', () => {
      const slides = buildSlides()
      const out = applyLayoutRecipe(slides, undefined)
      expect(JSON.stringify(out)).toBe(JSON.stringify(slides))
    })

    it('preserves pre-existing style_overrides byte-identically on the no-op path', () => {
      const slides = [
        slide({ style_overrides: { caption_bar_enabled: true, overlay_opacity: 45 } }),
      ]
      const out = applyLayoutRecipe(slides, null)
      expect(JSON.stringify(out)).toBe(JSON.stringify(slides))
    })
  })

  describe('caption-card geometry — 1:1 mapping into caption_bar_*', () => {
    it('maps every CaptionCardGeometry field to its caption_bar_* counterpart', () => {
      const out = applyLayoutRecipe(buildSlides(), buildRecipe())
      const cover = out[0].style_overrides!
      expect(cover.caption_bar_enabled).toBe(true)
      expect(cover.caption_bar_x).toBe(11)
      expect(cover.caption_bar_y).toBe(62)
      expect(cover.caption_bar_width).toBe(78)
      expect(cover.caption_bar_height_pct).toBe(38)
      expect(cover.caption_bar_blend_pct).toBe(12)
      expect(cover.caption_bar_opacity).toBe(0.85)
      expect(cover.caption_bar_position).toBe('bottom')
    })
  })

  describe('role mapping — slide 0 → cover, is_cta → cta, rest → body', () => {
    it('routes each slide to the correct recipe role (distinct caption_bar_x)', () => {
      const out = applyLayoutRecipe(buildSlides(), buildRecipe())
      // cover.x = 11, body.x = 22, cta.x = 33
      expect(out[0].style_overrides!.caption_bar_x).toBe(11) // slide 0 → cover
      expect(out[1].style_overrides!.caption_bar_x).toBe(22) // middle → body
      expect(out[2].style_overrides!.caption_bar_x).toBe(22) // middle → body
      expect(out[3].style_overrides!.caption_bar_x).toBe(33) // is_cta → cta
    })

    it('routes an is_cta slide that is not last to the cta role', () => {
      const slides = [
        slide({ hook_text: 'COVER' }),
        slide({ hook_text: 'EARLY CTA', is_cta: true }),
        slide({ hook_text: 'BODY' }),
      ]
      const out = applyLayoutRecipe(slides, buildRecipe())
      expect(out[1].style_overrides!.caption_bar_x).toBe(33) // cta role
      expect(out[2].style_overrides!.caption_bar_x).toBe(22) // body role
    })
  })

  describe('skip-emit — absent recipe role leaves the slide untouched', () => {
    it('leaves middle and cta slides unchanged when only the cover role is present', () => {
      const slides = buildSlides()
      const coverOnly: LayoutRecipe = {
        schema_version: 1,
        accent_cadence: 'none',
        roles: { cover: buildRecipe().roles.cover },
      }
      const out = applyLayoutRecipe(slides, coverOnly)
      // Cover shaped...
      expect(out[0].style_overrides!.caption_bar_x).toBe(11)
      // ...body and cta untouched (byte-identical to input).
      expect(JSON.stringify(out[1])).toBe(JSON.stringify(slides[1]))
      expect(JSON.stringify(out[2])).toBe(JSON.stringify(slides[2]))
      expect(JSON.stringify(out[3])).toBe(JSON.stringify(slides[3]))
    })
  })

  describe('hook band resolution → numeric style_overrides', () => {
    it('resolves position_band, font_size_band, and text_align deterministically', () => {
      const out = applyLayoutRecipe(buildSlides(), buildRecipe())
      // cover: position_band 'center' → y 46, font_size_band 'xl' → 176
      expect(out[0].style_overrides!.hook_position).toEqual({ x: 50, y: 46 })
      expect(out[0].style_overrides!.hook_font_size).toBe(176)
      expect(out[0].style_overrides!.text_align).toBe('center')
      // body: 'upper' → 28, 'md' → 112, 'left'
      expect(out[1].style_overrides!.hook_position).toEqual({ x: 50, y: 28 })
      expect(out[1].style_overrides!.hook_font_size).toBe(112)
      expect(out[1].style_overrides!.text_align).toBe('left')
      // cta: 'bottom' → 84, 'lg' → 140, 'right'
      expect(out[3].style_overrides!.hook_position).toEqual({ x: 50, y: 84 })
      expect(out[3].style_overrides!.hook_font_size).toBe(140)
      expect(out[3].style_overrides!.text_align).toBe('right')
    })

    it('preserves an existing hook_position.x while overriding y from the band', () => {
      const slides = [slide({ style_overrides: { hook_position: { x: 12, y: 99 } } })]
      const out = applyLayoutRecipe(slides, buildRecipe())
      expect(out[0].style_overrides!.hook_position).toEqual({ x: 12, y: 46 })
    })
  })

  describe('immutability', () => {
    it('does not mutate the input slides array or its objects', () => {
      const slides = buildSlides()
      const snapshot = JSON.stringify(slides)
      applyLayoutRecipe(slides, buildRecipe())
      expect(JSON.stringify(slides)).toBe(snapshot)
    })

    it('merges recipe geometry over existing style_overrides without dropping untouched keys', () => {
      const slides = [
        slide({ style_overrides: { overlay_opacity: 45, hook_text_color: '#fff' } }),
      ]
      const out = applyLayoutRecipe(slides, buildRecipe())
      const so = out[0].style_overrides!
      // Recipe-applied...
      expect(so.caption_bar_x).toBe(11)
      // ...existing keys preserved.
      expect(so.overlay_opacity).toBe(45)
      expect(so.hook_text_color).toBe('#fff')
    })
  })

  describe('accessory_label — intent only, never written as text', () => {
    it('does not set a slide accessory_label string even when the recipe role enables it', () => {
      const out = applyLayoutRecipe(buildSlides(), buildRecipe())
      // recipe.roles.cover.accessory_label.enabled === true, yet
      // applyLayoutRecipe writes no accessory_label text (Gemini-authored).
      expect(out[0].accessory_label).toBeUndefined()
    })

    it('preserves a Gemini-authored accessory_label through recipe application', () => {
      const slides = [slide({ accessory_label: 'Trending' })]
      const out = applyLayoutRecipe(slides, buildRecipe())
      expect(out[0].accessory_label).toBe('Trending')
    })
  })
})

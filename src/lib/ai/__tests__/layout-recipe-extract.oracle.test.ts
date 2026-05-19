// Phase 84 Plan 03 Task 3 (RECIPE-02):
// SC4 proof — extraction on an Oracle-pattern carousel reproduces the
// Oracle per-slide look:
//   cover  = blended caption card
//   middle = full-bleed photo, NO card
//   cta    = caption card + follow CTA
//
// The Oracle reference is the quick `260518-jhg` News Oracle template
// (Anton, accentColor #00E5FF, dark backdrop #0a0a0a, pill highlights,
// caption-card pattern). This test builds an Oracle-pattern Slide[]
// fixture and asserts extractLayoutRecipe reproduces that pattern.

import { describe, it, expect } from 'vitest'

import { extractLayoutRecipe } from '@/lib/ai/layout-recipe-extract'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

/** Minimal Oracle-style slide builder. */
function oracleSlide(overrides: Partial<Slide>): Slide {
  return {
    hook_text: 'HEADLINE',
    body_text: 'Supporting copy',
    image_query: 'news photo',
    is_cta: false,
    background_url: 'https://example.com/news-photo.jpg',
    pexels_photo_id: 100,
    ...overrides,
  }
}

/**
 * The Oracle carousel pattern (per quick 260518-jhg docs):
 *   slide 0  — COVER:  blended caption card (caption_bar_enabled + blend_pct > 0)
 *   slides 1-4 — BODY:  full-bleed news photo, NO caption card
 *   slide 5  — CTA:     caption card + follow CTA hook
 */
const ORACLE_SLIDES: Slide[] = [
  // Cover — blended caption card.
  oracleSlide({
    hook_text: 'THE NEWS ORACLE SPEAKS',
    hook_segments: [{ text: 'ORACLE', accent: true }],
    style_overrides: {
      caption_bar_enabled: true,
      caption_bar_position: 'bottom',
      caption_bar_blend_pct: 18,
      caption_bar_height_pct: 42,
      caption_bar_opacity: 0.9,
      caption_bar_x: 0,
      caption_bar_y: 58,
      caption_bar_width: 100,
      hook_text_color: '#fadbdb',
      hook_font_size: 120,
      text_align: 'center',
    },
  }),
  // Body middles 1-4 — full-bleed photo, no caption card.
  oracleSlide({
    style_overrides: { hook_font_size: 96, text_position: 'center', text_align: 'center' },
  }),
  oracleSlide({
    style_overrides: { hook_font_size: 96, text_position: 'center', text_align: 'center' },
  }),
  oracleSlide({
    hook_segments: [{ text: 'KEY', highlightStyle: 'pill', highlightColor: '#00E5FF' }],
    style_overrides: { hook_font_size: 96, text_position: 'center', text_align: 'center' },
  }),
  oracleSlide({
    style_overrides: { hook_font_size: 96, text_position: 'center', text_align: 'center' },
  }),
  // CTA — caption card + follow CTA.
  oracleSlide({
    is_cta: true,
    hook_text: 'FOLLOW FOR MORE',
    accessory_label: 'TAP FOLLOW',
    style_overrides: {
      caption_bar_enabled: true,
      caption_bar_position: 'bottom',
      caption_bar_blend_pct: 0,
      caption_bar_height_pct: 38,
      caption_bar_opacity: 0.85,
      hook_font_size: 100,
      text_align: 'center',
    },
  }),
]

/** Oracle template flat style — matches src/lib/render/templates/news-oracle.ts. */
const ORACLE_TEMPLATE_STYLE: Partial<SlideStyleOverrides> = {
  background_color: '#0a0a0a',
  text_color: '#ffffff',
  hook_font_family: "'Anton', sans-serif",
}

describe('Phase 84 SC4 — extraction reproduces the Oracle look', () => {
  it('cover role is a blended caption card', () => {
    const { recipe } = extractLayoutRecipe(ORACLE_SLIDES, ORACLE_TEMPLATE_STYLE)
    const cover = recipe.roles.cover
    expect(cover).toBeDefined()
    expect(cover?.layout_mode).toBe('caption-bar-bottom')
    expect(cover?.caption_card?.enabled).toBe(true)
    // The defining Oracle cover trait — the caption card edge is BLENDED.
    expect(cover?.caption_card?.blend_pct).toBeGreaterThan(0)
  })

  it('body/middle role is a full-bleed photo with NO caption card', () => {
    const { recipe } = extractLayoutRecipe(ORACLE_SLIDES, ORACLE_TEMPLATE_STYLE)
    const body = recipe.roles.body
    expect(body).toBeDefined()
    expect(body?.layout_mode).toBe('full-bleed-text-overlay')
    expect(body?.caption_card).toBeUndefined()
  })

  it('cta role is a caption card (follow CTA)', () => {
    const { recipe } = extractLayoutRecipe(ORACLE_SLIDES, ORACLE_TEMPLATE_STYLE)
    const cta = recipe.roles.cta
    expect(cta).toBeDefined()
    expect(['caption-bar-bottom', 'caption-bar-top']).toContain(cta?.layout_mode)
    expect(cta?.caption_card?.enabled).toBe(true)
    // The CTA carries the accessory-label kicker ("TAP FOLLOW").
    expect(cta?.accessory_label?.enabled).toBe(true)
  })

  it('recipe carries schema_version 1 and the Oracle accent cadence', () => {
    const { recipe } = extractLayoutRecipe(ORACLE_SLIDES, ORACLE_TEMPLATE_STYLE)
    expect(recipe.schema_version).toBe(1)
    // One of four body slides carries a highlight pill → sparse cadence.
    expect(recipe.accent_cadence).toBe('sparse')
  })

  it('flat style reproduces the Oracle template style', () => {
    const { flatStyle } = extractLayoutRecipe(ORACLE_SLIDES, ORACLE_TEMPLATE_STYLE)
    // background_color + hook font come from the template fallback.
    expect(flatStyle.background_color).toBe('#0a0a0a')
    expect(flatStyle.hook_font_family).toBe("'Anton', sans-serif")
  })

  it('extraction on the Oracle carousel is deterministic', () => {
    const a = extractLayoutRecipe(ORACLE_SLIDES, ORACLE_TEMPLATE_STYLE)
    const b = extractLayoutRecipe(ORACLE_SLIDES, ORACLE_TEMPLATE_STYLE)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

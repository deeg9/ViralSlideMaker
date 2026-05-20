// Phase 84 Plan 03 Task 2 (RECIPE-02):
// extractLayoutRecipe unit tests — determinism, role partition, archetype
// classification, median geometry, accent cadence, flat style, skip-emit.

import { describe, it, expect } from 'vitest'

import { extractLayoutRecipe } from '@/lib/ai/layout-recipe-extract'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

/** Build a minimal valid Slide, overridable per test. */
function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Headline',
    body_text: 'Body copy',
    image_query: 'news photo',
    is_cta: false,
    background_url: 'https://example.com/photo.jpg',
    pexels_photo_id: 1,
    ...overrides,
  }
}

/** Build a slide with a caption bar enabled. */
function captionSlide(so: Partial<SlideStyleOverrides> = {}, rest: Partial<Slide> = {}): Slide {
  return makeSlide({
    style_overrides: { caption_bar_enabled: true, ...so },
    ...rest,
  })
}

describe('Phase 84 extractLayoutRecipe', () => {
  it('is deterministic — two calls on the same input produce equal output', () => {
    const slides = [
      captionSlide(),
      makeSlide(),
      makeSlide(),
      makeSlide({ is_cta: true }),
    ]
    const a = extractLayoutRecipe(slides)
    const b = extractLayoutRecipe(slides)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('partitions a 4-slide carousel into cover / body / cta roles', () => {
    const { recipe } = extractLayoutRecipe([
      makeSlide(),
      makeSlide(),
      makeSlide(),
      makeSlide({ is_cta: true }),
    ])
    expect(recipe.roles.cover).toBeDefined()
    expect(recipe.roles.body).toBeDefined()
    expect(recipe.roles.cta).toBeDefined()
  })

  it('skip-emits body and cta for a 1-slide carousel', () => {
    const { recipe } = extractLayoutRecipe([makeSlide()])
    expect(recipe.roles.cover).toBeDefined()
    expect(recipe.roles.body).toBeUndefined()
    expect(recipe.roles.cta).toBeUndefined()
  })

  it('skip-emits cta when no slide has is_cta', () => {
    const { recipe } = extractLayoutRecipe([makeSlide(), makeSlide(), makeSlide()])
    expect(recipe.roles.cta).toBeUndefined()
    expect(recipe.roles.body).toBeDefined()
  })

  it('classifies caption-bar-enabled body slides as caption-bar-bottom', () => {
    const { recipe } = extractLayoutRecipe([
      makeSlide(),
      captionSlide(),
      captionSlide(),
    ])
    expect(recipe.roles.body?.layout_mode).toBe('caption-bar-bottom')
    expect(recipe.roles.body?.caption_card?.enabled).toBe(true)
  })

  it('classifies a caption bar positioned top as caption-bar-top', () => {
    const { recipe } = extractLayoutRecipe([
      makeSlide(),
      captionSlide({ caption_bar_position: 'top' }),
      captionSlide({ caption_bar_position: 'top' }),
    ])
    expect(recipe.roles.body?.layout_mode).toBe('caption-bar-top')
  })

  it('defaults plain photo body slides to full-bleed-text-overlay', () => {
    const { recipe } = extractLayoutRecipe([makeSlide(), makeSlide(), makeSlide()])
    expect(recipe.roles.body?.layout_mode).toBe('full-bleed-text-overlay')
    expect(recipe.roles.body?.caption_card).toBeUndefined()
  })

  it('classifies a slide with exactly 2 custom_images as photo-collage-2up', () => {
    const collage = makeSlide({
      custom_images: [
        { id: 'a', url: 'u1', x: 0, y: 0, width: 50, height: 100 },
        { id: 'b', url: 'u2', x: 50, y: 0, width: 50, height: 100 },
      ],
    })
    const { recipe } = extractLayoutRecipe([makeSlide(), collage, collage])
    expect(recipe.roles.body?.layout_mode).toBe('photo-collage-2up')
  })

  it('uses the median of caption_bar_height_pct across body slides', () => {
    const { recipe } = extractLayoutRecipe([
      makeSlide(),
      captionSlide({ caption_bar_height_pct: 30 }),
      captionSlide({ caption_bar_height_pct: 40 }),
      captionSlide({ caption_bar_height_pct: 50 }),
    ])
    expect(recipe.roles.body?.caption_card?.height_pct).toBe(40)
  })

  it('clamps an out-of-range caption_bar_opacity via the validator round-trip', () => {
    const { recipe } = extractLayoutRecipe([
      makeSlide(),
      captionSlide({ caption_bar_opacity: 9 }),
      captionSlide({ caption_bar_opacity: 9 }),
    ])
    expect(recipe.roles.body?.caption_card?.opacity).toBe(1)
  })

  it('reports accent_cadence frequent when all body slides carry accents, none otherwise', () => {
    const accented = makeSlide({
      hook_segments: [{ text: 'word', accent: true }],
    })
    const frequent = extractLayoutRecipe([makeSlide(), accented, accented, accented])
    expect(frequent.recipe.accent_cadence).toBe('frequent')

    const none = extractLayoutRecipe([makeSlide(), makeSlide(), makeSlide()])
    expect(none.recipe.accent_cadence).toBe('none')
  })

  it('enables the accessory_label slot when a role slide has a non-empty label', () => {
    const { recipe } = extractLayoutRecipe([
      makeSlide(),
      makeSlide(),
      makeSlide({ is_cta: true, accessory_label: 'BREAKING' }),
    ])
    expect(recipe.roles.cta?.accessory_label?.enabled).toBe(true)
    expect(recipe.roles.cta?.accessory_label?.position_band).toBe('top')
  })

  it('returns an empty-roles recipe for an empty slide array without throwing', () => {
    const result = extractLayoutRecipe([])
    expect(result.recipe).toEqual({
      schema_version: 1,
      accent_cadence: 'none',
      roles: {},
    })
    expect(result.flatStyle).toEqual({})
  })

  it('derives flat style from the most-common per-slide override, with template fallback', () => {
    const slides = [
      makeSlide({ style_overrides: { text_color: '#111111' } }),
      makeSlide({ style_overrides: { text_color: '#111111' } }),
      makeSlide({ style_overrides: { text_color: '#111111' } }),
    ]
    const { flatStyle } = extractLayoutRecipe(slides, { background_color: '#0a0a0a' })
    expect(flatStyle.text_color).toBe('#111111')
    // background_color has no per-slide value → falls back to the template.
    expect(flatStyle.background_color).toBe('#0a0a0a')
  })

  it('is synchronous — the return value is not a Promise', () => {
    const result = extractLayoutRecipe([makeSlide()])
    expect(result).not.toBeInstanceOf(Promise)
    expect(typeof result.recipe).toBe('object')
  })
})

describe('quick-260520-064 — R4 regression (news-oracle cover accessory_label)', () => {
  it('enables roles.cover.accessory_label when a news-oracle cover carries "BREAKING NEWS"', () => {
    // Mirrors the production shape after the adapter D1 fallback fires:
    // the cover slide's legacy accessory_label string is populated (the
    // recipe extractor reads slide.accessory_label, NOT the derived text_boxes).
    const cover = makeSlide({
      accessory_label: 'BREAKING NEWS',
      style_overrides: { caption_bar_enabled: true },
    })
    const { recipe } = extractLayoutRecipe([
      cover,
      makeSlide(),
      makeSlide({ is_cta: true }),
    ])
    expect(recipe.roles.cover?.accessory_label?.enabled).toBe(true)
    expect(recipe.roles.cover?.accessory_label?.position_band).toBe('top')
  })

  it('does NOT enable roles.cover.accessory_label when the cover carries "" (user opted out)', () => {
    // The extractor filters on .trim().length > 0 — an explicit empty string
    // must NOT enable the slot. This preserves user opt-out through the
    // recipe → saved-template re-apply path.
    const cover = makeSlide({
      accessory_label: '',
      style_overrides: { caption_bar_enabled: true },
    })
    const { recipe } = extractLayoutRecipe([
      cover,
      makeSlide(),
      makeSlide({ is_cta: true }),
    ])
    expect(recipe.roles.cover?.accessory_label).toBeUndefined()
  })
})

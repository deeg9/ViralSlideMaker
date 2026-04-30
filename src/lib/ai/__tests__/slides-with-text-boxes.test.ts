import { describe, test, expect } from 'vitest'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 51 contract tests: every Slide flowing through `legacyToTextBoxes` must produce
 * a populated `text_boxes[]` without throwing. This is the AI-ingest boundary contract —
 * `generate-slides.ts` calls the same adapter post-Zod-parse so the Carousel returned to
 * `actions.ts` already has `text_boxes[]` set on every slide before it hits Supabase.
 *
 * AIGEN-01 (rewriting Gemini's JSON schema) is deferred to v2.9; this light-touch path
 * delivers identical observable state with zero regression risk to v2.7's premium tier.
 */

function makeBaseSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

describe('AI output → text_boxes population (Phase 51 light-touch)', () => {
  test('typical news slide produces text_boxes with hook + body roles in order', () => {
    const slide: Slide = makeBaseSlide({
      hook_text: 'Folk singer fights back',
      body_text: 'TR3NDING',
      hook_segments: [
        { text: 'Folk', accent: false },
        { text: 'singer', accent: true },
      ],
      image_query: 'folk singer',
    })

    const boxes = legacyToTextBoxes(slide)

    expect(boxes).toHaveLength(2)
    expect(boxes[0].role).toBe('hook')
    expect(boxes[0].text).toBe('Folk singer fights back')
    expect(boxes[0].segments).toEqual([
      { text: 'Folk', accent: false },
      { text: 'singer', accent: true },
    ])
    expect(boxes[1].role).toBe('body')
    expect(boxes[1].text).toBe('TR3NDING')
  })

  test('empty hook_text → text_boxes still has hook entry with empty text (never throws)', () => {
    const slide: Slide = makeBaseSlide({
      hook_text: '',
      body_text: 'Body only',
    })

    const boxes = legacyToTextBoxes(slide)

    expect(boxes).toHaveLength(2)
    expect(boxes[0].role).toBe('hook')
    expect(boxes[0].text).toBe('')
    expect(boxes[1].role).toBe('body')
    expect(boxes[1].text).toBe('Body only')
  })

  test('missing segments → text_boxes segments absent, no throw', () => {
    const slide: Slide = makeBaseSlide({
      hook_text: 'No segments here',
      body_text: 'Body without segments either',
      // hook_segments and body_segments intentionally undefined
    })

    expect(() => legacyToTextBoxes(slide)).not.toThrow()

    const boxes = legacyToTextBoxes(slide)
    expect(boxes[0].segments).toBeUndefined()
    expect(boxes[1].segments).toBeUndefined()
  })

  test('hook with shadow + outline + highlight effects → text_boxes[0].effects populated', () => {
    const slide: Slide = makeBaseSlide({
      hook_text: 'Effects everywhere',
      body_text: 'Body',
      style_overrides: {
        hook_text_effects: {
          shadow: { enabled: true, color: '#00000080', size: 'md' },
          outline: { enabled: true, color: '#000000', width: 4 },
          highlight: { enabled: true, color: '#FFFF00CC', style: 'tight', padding: 8 },
        },
      },
    })

    const boxes = legacyToTextBoxes(slide)

    expect(boxes[0].effects).toBeDefined()
    expect(boxes[0].effects?.shadow?.enabled).toBe(true)
    expect(boxes[0].effects?.outline?.enabled).toBe(true)
    expect(boxes[0].effects?.outline?.width).toBe(4)
    expect(boxes[0].effects?.highlight?.enabled).toBe(true)
    expect(boxes[0].effects?.highlight?.style).toBe('tight')
  })

  test('5-box magazine-bold-style slide round-trips without info loss', () => {
    const slide: Slide = makeBaseSlide({
      hook_text: 'BIG BOLD HEADLINE',
      body_text: 'Mint card body copy.',
      hook_segments: [
        { text: 'BIG', accent: false },
        { text: 'BOLD', accent: true, highlightColor: '#A8E0B0', highlightStyle: 'pill' },
        { text: 'HEADLINE', accent: false },
      ],
      image_query: 'magazine portrait',
      style_overrides: {
        hook_font_family: 'Anton',
        hook_font_size: 96,
        hook_text_color: '#000000',
        body_font_size: 32,
        text_position: 'bottom',
        overlay_opacity: 60,
      },
      custom_texts: [
        {
          id: 'custom-1',
          text: 'TR3NDING',
          x: 10,
          y: 10,
          width: 30,
          font_family: 'Anton',
          font_size: 24,
          color: '#A8E0B0',
        },
        {
          id: 'custom-2',
          text: '01 / 07',
          x: 80,
          y: 10,
          width: 15,
          font_size: 20,
        },
        {
          id: 'custom-3',
          text: 'FOLK SINGER',
          x: 10,
          y: 30,
          width: 80,
          font_size: 48,
          font_weight: 700,
        },
      ],
    })

    const boxes = legacyToTextBoxes(slide)

    // 2 (hook + body) + 3 (custom) = 5 boxes
    expect(boxes).toHaveLength(5)
    expect(boxes[0].role).toBe('hook')
    expect(boxes[0].text).toBe('BIG BOLD HEADLINE')
    expect(boxes[0].font_family).toBe('Anton')
    expect(boxes[0].font_size).toBe(96)
    expect(boxes[0].segments?.[1].highlightColor).toBe('#A8E0B0')
    expect(boxes[1].role).toBe('body')
    expect(boxes[1].font_size).toBe(32)
    expect(boxes[2].role).toBe('custom')
    expect(boxes[2].text).toBe('TR3NDING')
    expect(boxes[3].text).toBe('01 / 07')
    expect(boxes[4].text).toBe('FOLK SINGER')
    expect(boxes[4].font_weight).toBe(700)

    // Each box has a populated id (UUID from crypto.randomUUID for hook+body; preserved for custom)
    for (const box of boxes) {
      expect(typeof box.id).toBe('string')
      expect(box.id.length).toBeGreaterThan(0)
    }
    expect(boxes[2].id).toBe('custom-1')
  })

  test('legacyToTextBoxes does not throw for any of 10 random Slide fuzz inputs', () => {
    const baseFields: Array<Partial<Slide>> = [
      { hook_text: 'A', body_text: 'B' },
      { hook_text: '', body_text: '' },
      { hook_text: 'Long '.repeat(50), body_text: 'x' },
      {
        hook_text: 'h',
        body_text: 'b',
        hook_segments: [{ text: 'h', accent: true }],
      },
      {
        hook_text: 'h',
        body_text: 'b',
        body_segments: [{ text: 'b', accent: false, highlightColor: '#FF0000' }],
      },
      {
        hook_text: 'h',
        body_text: 'b',
        style_overrides: { text_align: 'center', text_position: 'top' },
      },
      {
        hook_text: 'h',
        body_text: 'b',
        style_overrides: {
          hook_position: { x: 25, y: 50 },
          body_position: { x: 75, y: 80 },
          hook_width: 70,
          body_width: 60,
        },
      },
      {
        hook_text: 'h',
        body_text: 'b',
        custom_texts: [],
      },
      {
        hook_text: 'h',
        body_text: 'b',
        custom_texts: [
          { id: 'c1', text: 'one', x: 10, y: 10, width: 50 },
          { id: 'c2', text: 'two', x: 20, y: 70, width: 40 },
        ],
      },
      {
        hook_text: 'h',
        body_text: 'b',
        hook_segments: [],
        body_segments: [],
        style_overrides: {},
        custom_texts: [],
      },
    ]

    for (const overrides of baseFields) {
      const slide = makeBaseSlide(overrides)
      expect(() => legacyToTextBoxes(slide)).not.toThrow()
      const boxes = legacyToTextBoxes(slide)
      // Always at least hook + body emitted (2)
      expect(boxes.length).toBeGreaterThanOrEqual(2)
      expect(boxes[0].role).toBe('hook')
      expect(boxes[1].role).toBe('body')
    }
  })
})

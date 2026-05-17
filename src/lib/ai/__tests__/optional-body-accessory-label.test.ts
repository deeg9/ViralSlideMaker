// Phase 82 (R4, R5) — structural tests for optional body_text + the optional
// accessory_label field. Proves headline-only slides validate, pre-Phase-82
// carousels still validate (back-compat), and accessory_label maps to a
// distinct small text box rather than being merged into the headline.
//
// Pure schema/adapter tests — no network, no live Gemini.

import { describe, it, expect } from 'vitest'
import { CarouselSchema, SlideContentSchema } from '@/lib/ai/schemas'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/** Minimal valid slide (Gemini-shaped) — body_text omitted by default. */
function slideNoBody(hook: string) {
  return {
    hook_text: hook,
    image_query: 'photojournalism news scene',
    is_cta: false,
    role: 'reframe' as const,
  }
}

/** Minimal valid slide WITH body_text (pre-Phase-82 shape). */
function slideWithBody(hook: string, body: string) {
  return { ...slideNoBody(hook), body_text: body }
}

describe('Phase 82 R4 — optional body_text', () => {
  it('CarouselSchema.parse succeeds for a carousel with headline-only slides (no body_text key)', () => {
    const carousel = {
      title: 'Breaking News',
      slides: [slideNoBody('FIRST HEADLINE'), slideNoBody('SECOND HEADLINE'), slideNoBody('THIRD HEADLINE')],
    }
    expect(() => CarouselSchema.parse(carousel)).not.toThrow()
  })

  it('CarouselSchema.parse succeeds when a slide has body_text as an empty string', () => {
    const carousel = {
      title: 'Breaking News',
      slides: [slideWithBody('HEADLINE A', ''), slideNoBody('HEADLINE B'), slideNoBody('HEADLINE C')],
    }
    expect(() => CarouselSchema.parse(carousel)).not.toThrow()
  })

  it('CarouselSchema.parse still succeeds for a pre-Phase-82 carousel where every slide has body_text (back-compat)', () => {
    const carousel = {
      title: 'Classic Carousel',
      slides: [
        slideWithBody('HOOK ONE', 'Supporting detail one.'),
        slideWithBody('HOOK TWO', 'Supporting detail two.'),
        slideWithBody('HOOK THREE', 'Supporting detail three.'),
      ],
    }
    expect(() => CarouselSchema.parse(carousel)).not.toThrow()
  })
})

describe('Phase 82 R5 — optional accessory_label', () => {
  it('SlideContentSchema.parse accepts a slide WITH an accessory_label string', () => {
    const slide = { ...slideNoBody('BIG HEADLINE'), accessory_label: 'TRENDING NEWS' }
    const parsed = SlideContentSchema.parse(slide)
    expect(parsed.accessory_label).toBe('TRENDING NEWS')
  })

  it('SlideContentSchema.parse accepts a slide WITHOUT accessory_label (zero accessory labels still validates)', () => {
    const slide = slideNoBody('BIG HEADLINE')
    const parsed = SlideContentSchema.parse(slide)
    expect(parsed.accessory_label).toBeUndefined()
  })
})

describe('Phase 82 R4/R5 — legacyToTextBoxes adapter', () => {
  it('produces no body text box for a slide with body_text absent (only the headline box)', () => {
    const slide = {
      hook_text: 'HEADLINE ONLY',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
    } as unknown as Slide
    const boxes = legacyToTextBoxes(slide)
    expect(boxes.some((b) => b.role === 'body')).toBe(false)
    expect(boxes.some((b) => b.role === 'hook')).toBe(true)
  })

  it('maps accessory_label to a distinct small text box, not merged into the headline', () => {
    const slide = {
      hook_text: 'Tech Giant Cuts Jobs',
      accessory_label: 'TRENDING NEWS',
      image_query: 'q',
      is_cta: false,
      background_url: null,
      pexels_photo_id: null,
    } as unknown as Slide
    const boxes = legacyToTextBoxes(slide)
    const hookBox = boxes.find((b) => b.role === 'hook')
    const labelBox = boxes.find((b) => b.role === 'custom' && b.text === 'TRENDING NEWS')
    // The accessory label is its own entry, uppercased, not in the headline.
    expect(labelBox).toBeDefined()
    expect(hookBox?.text).not.toContain('TRENDING NEWS')
    expect(labelBox?.text).toBe('TRENDING NEWS')
  })
})

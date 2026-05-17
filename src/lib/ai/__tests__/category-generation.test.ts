// Phase 82 (R10) — the structural verification suite.
//
// This is the single suite the SPEC R10 gate runs against ("structural test
// suite passes"). It covers every automatable acceptance criterion: category
// routing (R1), optional body_text (R4), accent emission (R2/R3), the optional
// accessory_label (R5), and the keeper-only / category-filtered picker (R7/R8).
//
// Pure schema / registry / prompt-assembly tests — no network, no live Gemini.

import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/ai/prompts'
import { CarouselSchema, SlideContentSchema } from '@/lib/ai/schemas'
import { CATEGORIES, getCategory } from '@/lib/ai/categories'
import { pickerTemplates, HIDDEN_FROM_PICKER, getTemplate, templates } from '@/lib/render/templates'

describe('Phase 82 R1 — category routing', () => {
  it('the copy module is selected by category, not template', () => {
    const newsPrompt = buildSystemPrompt('paper-essay', 'news')
    const factsPrompt = buildSystemPrompt('paper-essay', 'facts')
    expect(newsPrompt).toContain('CONTENT CATEGORY: NEWS')
    expect(factsPrompt).toContain('CONTENT CATEGORY: FACTS & INFO')
    expect(newsPrompt).not.toEqual(factsPrompt)
  })

  it('a category prompt instructs headline-first, body-omitted output', () => {
    const prompt = buildSystemPrompt('news-cyan', 'news')
    expect(prompt.toLowerCase()).toContain('headline')
    expect(prompt.toLowerCase()).toContain('omit body text')
  })
})

describe('Phase 82 R4 — optional body_text', () => {
  const headlineOnly = {
    hook_text: 'BIG HEADLINE',
    image_query: 'q',
    is_cta: false,
    role: 'reframe' as const,
  }

  it('a carousel with headline-only slides (absent body_text) passes CarouselSchema.parse', () => {
    const carousel = { title: 'T', slides: [headlineOnly, headlineOnly, headlineOnly] }
    expect(() => CarouselSchema.parse(carousel)).not.toThrow()
  })

  it('a carousel where every slide has body_text still parses (back-compat)', () => {
    const withBody = { ...headlineOnly, body_text: 'supporting detail' }
    const carousel = { title: 'T', slides: [withBody, withBody, withBody] }
    expect(() => CarouselSchema.parse(carousel)).not.toThrow()
  })
})

describe('Phase 82 R2/R3 — accent emission', () => {
  it('a slide with hook_segments carrying an accent:true segment validates and preserves it', () => {
    const slide = {
      hook_text: 'TECH GIANT CUTS 19000 JOBS',
      hook_segments: [
        { text: 'TECH GIANT', accent: true },
        { text: 'CUTS', accent: false },
        { text: '19000', accent: true },
        { text: 'JOBS', accent: false },
      ],
      image_query: 'q',
      is_cta: false,
      role: 'cover' as const,
    }
    const parsed = SlideContentSchema.parse(slide)
    expect(parsed.hook_segments?.some((s) => s.accent === true)).toBe(true)
  })
})

describe('Phase 82 R5 — optional accessory_label', () => {
  const base = { hook_text: 'H', image_query: 'q', is_cta: false, role: 'reframe' as const }

  it('a slide WITH an accessory_label validates', () => {
    expect(SlideContentSchema.parse({ ...base, accessory_label: 'TRENDING NEWS' }).accessory_label).toBe(
      'TRENDING NEWS',
    )
  })

  it('a slide WITHOUT an accessory_label validates (zero accessory labels still valid)', () => {
    expect(SlideContentSchema.parse(base).accessory_label).toBeUndefined()
  })
})

describe('Phase 82 R7/R8 — keeper-only / category-filtered picker', () => {
  it('no HIDDEN_FROM_PICKER id appears in pickerTemplates', () => {
    for (const t of pickerTemplates) {
      expect(HIDDEN_FROM_PICKER.has(t.id)).toBe(false)
    }
  })

  it('every category templateId resolves to a picker-visible template (no hidden-template routing)', () => {
    const pickerIds = new Set(pickerTemplates.map((t) => t.id))
    for (const category of CATEGORIES) {
      for (const id of category.templateIds) {
        expect(pickerIds.has(id)).toBe(true)
      }
    }
  })

  it('a culled (hidden) template still resolves via getTemplate — renderer retained', () => {
    for (const hiddenId of HIDDEN_FROM_PICKER) {
      const resolved = getTemplate(hiddenId)
      expect(resolved).toBeDefined()
      // getTemplate must resolve the actual hidden template, not silently
      // fall through to templates[0] for an id that IS registered.
      if (templates.some((t) => t.id === hiddenId)) {
        expect(resolved.id).toBe(hiddenId)
      }
    }
  })

  it('getCategory resolves both shipping categories; an unknown id returns undefined', () => {
    expect(getCategory('news')).toBeDefined()
    expect(getCategory('facts')).toBeDefined()
    expect(getCategory('not-a-category')).toBeUndefined()
  })
})

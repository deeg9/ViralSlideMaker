import { describe, it, expect } from 'vitest'
import {
  resolveAIColor,
  resolveAIPosition,
  buildAIDecorationId,
  resolveAIDecoration,
  AI_POSITION_RECTS,
} from '../resolve-ai-decoration'
import {
  DecorationSchema,
  AI_POSITION_ANCHORS,
  type DecorationEmitContent,
} from '../schemas'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates'

/**
 * Phase 71 (AI-03, AI-04): pure-function resolvers that map closed-enum
 * AI emit (named tokens / semantic anchors) → explicit hex + safe-zone
 * % coords. Never throws — silent fallback on unknown tokens / anchors.
 */

function makeTemplate(overrides: Partial<SlideTemplate> = {}): SlideTemplate {
  return {
    id: 'test-template',
    name: 'Test',
    thumbnail: '',
    fontFamily: 'Inter',
    hookFontSize: '64px',
    bodyFontSize: '32px',
    textColor: '#000000',
    backgroundColor: '#FFFFFF',
    overlayColor: '#000000',
    overlayOpacity: 50,
    textAlign: 'left',
    textPosition: 'bottom',
    hookStyle: 'normal',
    accentColor: '#FF0000',
    ...overrides,
  } as SlideTemplate
}

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'h',
    body_text: 'b',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

describe('Phase 71 (AI-03): resolveAIColor — token → hex', () => {
  it("Test 1: 'accent' → template.accentColor", () => {
    const t = makeTemplate({ accentColor: '#FF0000', textColor: '#000000' })
    expect(resolveAIColor('accent', makeSlide(), t)).toBe('#FF0000')
  })

  it("Test 2: 'accent' fallback to textColor when accentColor undefined", () => {
    const t = makeTemplate({ accentColor: undefined, textColor: '#222222' })
    expect(resolveAIColor('accent', makeSlide(), t)).toBe('#222222')
  })

  it("Test 3: 'palette-vibrant' → derived_palette[0]", () => {
    const slide = makeSlide({
      style_overrides: { derived_palette: ['#AABBCC', '#1', '#2', '#3', '#4', '#5'] },
    })
    expect(resolveAIColor('palette-vibrant', slide, makeTemplate())).toBe('#AABBCC')
  })

  it("Test 4: 'palette-dark-muted' → derived_palette[4]", () => {
    const slide = makeSlide({
      style_overrides: {
        derived_palette: ['#0', '#1', '#2', '#3', '#DDEEFF', '#5'],
      },
    })
    expect(resolveAIColor('palette-dark-muted', slide, makeTemplate())).toBe('#DDEEFF')
  })

  it("Test 5: 'palette-light' → derived_palette[5] (LightMuted)", () => {
    const slide = makeSlide({
      style_overrides: {
        derived_palette: ['#0', '#1', '#2', '#3', '#4', '#FAFAFA'],
      },
    })
    expect(resolveAIColor('palette-light', slide, makeTemplate())).toBe('#FAFAFA')
  })

  it("Test 6: 'on-light' → '#0F172A' / 'on-dark' → '#F8FAFC'", () => {
    expect(resolveAIColor('on-light', makeSlide(), makeTemplate())).toBe('#0F172A')
    expect(resolveAIColor('on-dark', makeSlide(), makeTemplate())).toBe('#F8FAFC')
  })

  it('Test 7: unknown token → fallback to template.accentColor (or textColor); never throws', () => {
    const t = makeTemplate({ accentColor: '#FF0000', textColor: '#000000' })
    expect(() => resolveAIColor('garbage' as never, makeSlide(), t)).not.toThrow()
    expect(resolveAIColor('garbage' as never, makeSlide(), t)).toBe('#FF0000')

    const tNoAccent = makeTemplate({ accentColor: undefined, textColor: '#333333' })
    expect(resolveAIColor('garbage' as never, makeSlide(), tNoAccent)).toBe('#333333')
  })
})

describe('Phase 71 (AI-03): resolveAIPosition — anchor → safe-zone rect', () => {
  it("Test 8: 'top-right' → exact safe-zone rect { x: 70, y: 8, width: 22, height: 16 }", () => {
    expect(resolveAIPosition('top-right')).toEqual({ x: 70, y: 8, width: 22, height: 16 })
  })

  it('Test 9: all 7 anchors return distinct rects', () => {
    const rects = AI_POSITION_ANCHORS.map((a) => resolveAIPosition(a))
    const serialized = new Set(rects.map((r) => `${r.x}|${r.y}|${r.width}|${r.height}`))
    expect(serialized.size).toBe(7)
  })

  it('Test 10: unknown anchor → center fallback', () => {
    expect(resolveAIPosition('garbage')).toEqual(AI_POSITION_RECTS.center)
  })

  it('Test 11: every anchor stays within 0..100 percent bounds', () => {
    for (const a of AI_POSITION_ANCHORS) {
      const r = resolveAIPosition(a)
      expect(r.x).toBeGreaterThanOrEqual(0)
      expect(r.y).toBeGreaterThanOrEqual(0)
      expect(r.x + r.width).toBeLessThanOrEqual(100)
      expect(r.y + r.height).toBeLessThanOrEqual(100)
    }
  })
})

describe('Phase 71 (AI-03, AI-04): resolveAIDecoration — full round-trip', () => {
  it('Test 12: icon emit → full Decoration validates against DecorationSchema', () => {
    const emitted: DecorationEmitContent = {
      kind: 'icon',
      lucideName: 'Heart',
      color: 'accent',
      position: 'top-right',
    }
    const t = makeTemplate({ accentColor: '#FF0000' })
    const result = resolveAIDecoration(emitted, makeSlide(), t, 0, 0)
    expect(result.kind).toBe('icon')
    expect(result.id).toBe('ai-deco-0-0')
    if (result.kind === 'icon') {
      expect(result.color).toBe('#FF0000')
      expect(result.lucideName).toBe('Heart')
      expect(result.strokeWidth).toBe(2)
    }
    expect(result.position).toEqual({ x: 70, y: 8, width: 22, height: 16 })
    expect(DecorationSchema.safeParse(result).success).toBe(true)
  })

  it('Test 13: shape emit with cornerRadius → full Decoration with fill hex preserved', () => {
    const emitted: DecorationEmitContent = {
      kind: 'shape',
      shapeKind: 'rect',
      color: 'palette-vibrant',
      position: 'center',
      cornerRadius: 8,
    }
    const slide = makeSlide({
      style_overrides: { derived_palette: ['#123456', '#1', '#2', '#3', '#4', '#5'] },
    })
    const result = resolveAIDecoration(emitted, slide, makeTemplate(), 1, 0)
    expect(result.kind).toBe('shape')
    expect(result.id).toBe('ai-deco-1-0')
    if (result.kind === 'shape') {
      expect(result.fill).toBe('#123456')
      expect(result.cornerRadius).toBe(8)
      expect(result.shapeKind).toBe('rect')
    }
    expect(DecorationSchema.safeParse(result).success).toBe(true)
  })

  it('buildAIDecorationId is deterministic and includes slideIndex + decorationIndex', () => {
    expect(buildAIDecorationId(0, 0)).toBe('ai-deco-0-0')
    expect(buildAIDecorationId(2, 1)).toBe('ai-deco-2-1')
    // stability: repeated invocation returns identical id
    expect(buildAIDecorationId(0, 0)).toBe(buildAIDecorationId(0, 0))
  })

  it('rotation passthrough preserved on icon', () => {
    const emitted: DecorationEmitContent = {
      kind: 'icon',
      lucideName: 'Star',
      color: 'accent',
      position: 'bottom-left',
      rotation: 45,
    }
    const result = resolveAIDecoration(emitted, makeSlide(), makeTemplate(), 0, 0)
    expect(result.rotation).toBe(45)
  })
})

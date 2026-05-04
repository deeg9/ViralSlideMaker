// Phase 71 (AI-05): advisory monoculture gate for AI-emitted decorations.
//
// Mirrors v2.9 hookOpeningTrigram diversity advisory pattern (D-14):
// metric runs and emits console.warn on threshold trip; CI is NEVER failed
// in v2.12. v3.0+ may promote to retry-on-detection or fail-CI by importing
// DEFAULT_MONOCULTURE_THRESHOLD and asserting against it.
//
// Per-discriminator frequency: icons and shapes are independent populations.
// A 4/4 icon dominance does NOT consider shapes in the denominator.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  decorationDiversityCheck,
  DEFAULT_MONOCULTURE_THRESHOLD,
} from '../decoration-diversity-check'

// Tiny factory helpers — keep tests readable.
function iconDeco(lucideName: string, id = lucideName) {
  return {
    id,
    kind: 'icon' as const,
    lucideName,
    color: '#ffffff',
    strokeWidth: 2,
    rect: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
  }
}

function shapeDeco(shapeKind: string, id = shapeKind) {
  return {
    id,
    kind: 'shape' as const,
    shapeKind,
    fill: '#ffffff',
    rect: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
  }
}

describe('Phase 71 (AI-05): decorationDiversityCheck advisory monoculture gate', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Test 1: no decorations across slides → silent pass', () => {
    const slides = [
      { decorations: undefined },
      { decorations: [] },
      {},
    ]
    const result = decorationDiversityCheck(slides)
    expect(result.warned).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('Test 2: low-diversity below threshold → no warn (40% < 60%)', () => {
    // 5 slides each with 1 icon: Heart×2, Star×2, Check×1 → max 2/5 = 40%
    const slides = [
      { decorations: [iconDeco('Heart', 'a')] },
      { decorations: [iconDeco('Heart', 'b')] },
      { decorations: [iconDeco('Star', 'c')] },
      { decorations: [iconDeco('Star', 'd')] },
      { decorations: [iconDeco('Check', 'e')] },
    ]
    const result = decorationDiversityCheck(slides)
    expect(result.warned).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('Test 3: high name dominance ≥60% → warn fires (Heart 4/5 = 80%)', () => {
    const slides = [
      { decorations: [iconDeco('Heart', 'a')] },
      { decorations: [iconDeco('Heart', 'b')] },
      { decorations: [iconDeco('Heart', 'c')] },
      { decorations: [iconDeco('Heart', 'd')] },
      { decorations: [iconDeco('Star', 'e')] },
    ]
    const result = decorationDiversityCheck(slides)
    expect(result.warned).toBe(true)
    expect(result.dominantKind).toBe('icon')
    expect(result.dominantName).toBe('Heart')
    expect(result.dominantCount).toBe(4)
    expect(result.total).toBe(5)
    expect(result.share).toBeCloseTo(0.8, 2)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const msg = String(warnSpy.mock.calls[0][0])
    expect(msg).toContain('Heart')
    expect(msg).toContain('80')
  })

  it('Test 4: high shapeKind dominance ≥60% → warn fires (rect 4/5 = 80%)', () => {
    const slides = [
      { decorations: [shapeDeco('rect', 'a')] },
      { decorations: [shapeDeco('rect', 'b')] },
      { decorations: [shapeDeco('rect', 'c')] },
      { decorations: [shapeDeco('rect', 'd')] },
      { decorations: [shapeDeco('circle', 'e')] },
    ]
    const result = decorationDiversityCheck(slides)
    expect(result.warned).toBe(true)
    expect(result.dominantKind).toBe('shape')
    expect(result.dominantShapeKind).toBe('rect')
    expect(result.dominantCount).toBe(4)
    expect(result.total).toBe(5)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const msg = String(warnSpy.mock.calls[0][0])
    expect(msg).toContain('rect')
  })

  it('Test 5: threshold edge — exactly 60% triggers warn (>= comparison)', () => {
    // Heart 3 / Star 2 = 60.0% → warn fires (>= per CONTEXT decision)
    const slides = [
      { decorations: [iconDeco('Heart', 'a')] },
      { decorations: [iconDeco('Heart', 'b')] },
      { decorations: [iconDeco('Heart', 'c')] },
      { decorations: [iconDeco('Star', 'd')] },
      { decorations: [iconDeco('Star', 'e')] },
    ]
    const result = decorationDiversityCheck(slides)
    expect(result.warned).toBe(true)
    expect(result.share).toBeCloseTo(0.6, 5)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('Test 6: threshold edge — 59% does NOT warn', () => {
    // 100 entries: Heart 59 + Star 41 → 0.59 < 0.60
    const decorations = [
      ...Array.from({ length: 59 }, (_, i) => iconDeco('Heart', `h${i}`)),
      ...Array.from({ length: 41 }, (_, i) => iconDeco('Star', `s${i}`)),
    ]
    const slides = [{ decorations }]
    const result = decorationDiversityCheck(slides)
    expect(result.warned).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('Test 7: mixed icon + shape — per-discriminator frequency (icons separate from shapes)', () => {
    // 4 Heart icons + 1 rect shape → icon population = 4 (Heart 100% of icons),
    // shape population = 1 (rect 100% of shapes). Heart dominates icons; warn fires.
    // The point: the icon dominance is computed against icon total (4), NOT
    // against (icons + shapes) = 5.
    const slides = [
      { decorations: [iconDeco('Heart', 'a')] },
      { decorations: [iconDeco('Heart', 'b')] },
      { decorations: [iconDeco('Heart', 'c')] },
      { decorations: [iconDeco('Heart', 'd')] },
      { decorations: [shapeDeco('rect', 'e')] },
    ]
    const result = decorationDiversityCheck(slides)
    expect(result.warned).toBe(true)
    // Icon dominance 4/4 = 100% wins over shape 1/1 (also 100%) — first
    // candidate inspected, but either way: icon population is 4, NOT 5.
    expect(result.total).toBe(4)
    expect(result.dominantCount).toBe(4)
  })

  it('Test 8: multiple decorations per slide counted individually', () => {
    // 1 slide with [Heart, Heart] → name 'Heart' counts as 2 toward icon population.
    const slides = [
      { decorations: [iconDeco('Heart', 'a'), iconDeco('Heart', 'b')] },
    ]
    const result = decorationDiversityCheck(slides)
    // 2/2 = 100% dominance → warn fires
    expect(result.warned).toBe(true)
    expect(result.dominantCount).toBe(2)
    expect(result.total).toBe(2)
  })

  it('Test 9: opts.carouselId appears in warn message', () => {
    const slides = [
      { decorations: [iconDeco('Heart', 'a')] },
      { decorations: [iconDeco('Heart', 'b')] },
      { decorations: [iconDeco('Heart', 'c')] },
    ]
    decorationDiversityCheck(slides, { carouselId: 'abc-123' })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const msg = String(warnSpy.mock.calls[0][0])
    expect(msg).toContain('abc-123')
  })

  it('Test 10: custom threshold override (0.40 triggers on 40%)', () => {
    // 2 Heart / 5 total = 40% → triggers when threshold = 0.40
    const slides = [
      { decorations: [iconDeco('Heart', 'a')] },
      { decorations: [iconDeco('Heart', 'b')] },
      { decorations: [iconDeco('Star', 'c')] },
      { decorations: [iconDeco('Plus', 'd')] },
      { decorations: [iconDeco('Check', 'e')] },
    ]
    const result = decorationDiversityCheck(slides, { threshold: 0.4 })
    expect(result.warned).toBe(true)
    expect(result.share).toBeCloseTo(0.4, 5)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('Test 11: never throws on malformed entries (skip non-DecorationContent)', () => {
    const slides = [
      { decorations: [null, undefined, 'not-a-decoration', { kind: 'unknown' }] as unknown[] },
      { decorations: [iconDeco('Heart', 'a')] },
    ]
    // Should not throw — graceful skip of malformed entries.
    expect(() => decorationDiversityCheck(slides)).not.toThrow()
    const result = decorationDiversityCheck(slides)
    // Only 1 valid icon entry → total=1, dominance 100% → warn fires.
    expect(result.warned).toBe(true)
    expect(result.dominantCount).toBe(1)
    expect(result.total).toBe(1)
  })

  it('Test 12: DEFAULT_MONOCULTURE_THRESHOLD exported and equals 0.60', () => {
    expect(DEFAULT_MONOCULTURE_THRESHOLD).toBe(0.6)
  })
})

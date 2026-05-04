import { describe, test, expect } from 'vitest'
import type {
  Slide,
  Decoration,
  IconDecoration,
  ShapeDecoration,
} from '@/lib/types/slide'
import {
  elementsInRect,
  type Rect,
} from '@/lib/editor/transforms/element-rect-intersect'

/**
 * Phase 72 Plan 01 (ROTATE-04, EDITOR-07): rotation-aware marquee intersect
 * tests. elementsInRect must use the rotation-aware AABB envelope when a
 * decoration carries a rotation field — so a 45°-rotated decoration's
 * marquee selection considers the rotated-corner extent.
 */

function makeIconDec(
  id: string,
  pos: { x: number; y: number; width: number; height: number },
  overrides: Partial<IconDecoration> = {},
): IconDecoration {
  return {
    kind: 'icon',
    id,
    position: pos,
    lucideName: 'Heart',
    color: '#FF0000',
    strokeWidth: 2,
    ...overrides,
  }
}

function makeShapeDec(
  id: string,
  pos: { x: number; y: number; width: number; height: number },
  overrides: Partial<ShapeDecoration> = {},
): ShapeDecoration {
  return {
    kind: 'shape',
    id,
    position: pos,
    shapeKind: 'rect',
    fill: '#00FF00',
    ...overrides,
  }
}

function makeSlideD(opts: { decorations?: Decoration[] }): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    decorations: opts.decorations,
  }
}

describe('elementsInRect — rotation-aware decoration extension', () => {
  test('Test 22: marquee overlapping rotated extent (but NOT raw position rect) → decoration IS selected', () => {
    // 10×10 square at (50, 50) rotated 45°. Raw rect: x in [50, 60].
    // Rotated extent: x in [55 - sqrt(2)*5, 55 + sqrt(2)*5] ≈ [47.93, 62.07].
    // Marquee at x in [46, 49]: overlaps rotated extent (47.93..49) but not raw [50..60].
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 50, y: 50, width: 10, height: 10 }, { rotation: 45 }),
      ],
    })
    const rect: Rect = { x: 46, y: 50, w: 3, h: 10 }  // (46..49) × (50..60)
    expect(elementsInRect(slide, rect)).toEqual(['d1'])
  })

  test('Test 23: marquee strictly inside rotated extent corners (outside raw position rect on the OTHER side) → decoration IS selected', () => {
    // Rotated extent on the right: x ≈ 62.07. Raw rect ends at 60.
    // Marquee at x in [60.5, 61.5]: overlaps rotated extent only (raw rect is [50..60]).
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 50, y: 50, width: 10, height: 10 }, { rotation: 45 }),
      ],
    })
    const rect: Rect = { x: 60.5, y: 53, w: 1, h: 4 }
    expect(elementsInRect(slide, rect)).toEqual(['d1'])
  })

  test('Test 24: marquee strictly outside the rotated extent → decoration NOT selected', () => {
    // Rotated extent: ~47.93..62.07. Marquee at x in [80, 90]: no overlap.
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 50, y: 50, width: 10, height: 10 }, { rotation: 45 }),
      ],
    })
    const rect: Rect = { x: 80, y: 80, w: 10, h: 10 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('Test 25: rotation=0 (or undefined) → rectilinear intersect behavior unchanged (regression pin)', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 10, y: 10, width: 10, height: 10 }, { rotation: 0 }),
      ],
    })
    // Marquee covers entire canvas → d1 selected
    expect(elementsInRect(slide, { x: 0, y: 0, w: 100, h: 100 })).toEqual(['d1'])
    // Marquee strictly outside raw rect → not selected
    expect(elementsInRect(slide, { x: 30, y: 30, w: 5, h: 5 })).toEqual([])
  })

  test('Test 26: locked rotated decoration EXCLUDED from marquee (LOCK-05 carry-forward)', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec(
          'd-locked',
          { x: 50, y: 50, width: 10, height: 10 },
          { rotation: 45, locked: true },
        ),
        makeShapeDec(
          'd-movable',
          { x: 50, y: 50, width: 10, height: 10 },
          { rotation: 45 },
        ),
      ],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual(['d-movable'])
  })
})

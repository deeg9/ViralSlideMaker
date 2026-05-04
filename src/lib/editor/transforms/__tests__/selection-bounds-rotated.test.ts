import { describe, test, expect } from 'vitest'
import type {
  Slide,
  TextBox,
  CustomImage,
  Decoration,
  IconDecoration,
  ShapeDecoration,
} from '@/lib/types/slide'
import {
  computeSelectionBounds,
  type AABB,
} from '@/lib/editor/transforms/selection-bounds'

/**
 * Phase 72 Plan 01 (ROTATE-04, EDITOR-07): rotation-aware union AABB tests
 * for computeSelectionBounds. Decorations contribute their rotation-aware
 * AABB (computeRotatedAABB) when rotation is set; non-decoration scopes
 * (text_boxes / custom_images / watermark) use rectilinear bounds (no
 * rotation field on those scopes in v2.12).
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

function makeCustomTextBox(
  id: string,
  x: number,
  y: number,
  width: number,
): TextBox {
  return {
    id,
    role: 'custom',
    text: '',
    position: { anchor: 'custom', x, y, width },
  }
}

function makeCustomImage(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): CustomImage {
  return { id, url: 'https://example.com/x.png', x, y, width, height }
}

function makeSlideD(opts: {
  text_boxes?: TextBox[]
  custom_images?: CustomImage[]
  decorations?: Decoration[]
}): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: opts.text_boxes,
    custom_images: opts.custom_images,
    decorations: opts.decorations,
  }
}

describe('computeSelectionBounds — rotation-aware decoration extension', () => {
  test('Test 11: single decoration rotation=0 = pre-existing rectilinear behavior (regression pin)', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 10, y: 20, width: 30, height: 40 }, { rotation: 0 }),
      ],
    })
    expect(computeSelectionBounds(slide, ['d1'])).toEqual<AABB>({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })

  test('Test 12: single decoration rotation=45 → bounds match rotation-aware AABB of that decoration', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 50, y: 50, width: 10, height: 10 }, { rotation: 45 }),
      ],
    })
    const r = computeSelectionBounds(slide, ['d1'])
    expect(r).not.toBeNull()
    if (r) {
      // 45° on a 10×10 square at (50, 50) → sqrt(2)*10 wide centered at (55, 55)
      const expectedExtent = Math.sqrt(2) * 10
      expect(r.width).toBeCloseTo(expectedExtent, 5)
      expect(r.height).toBeCloseTo(expectedExtent, 5)
      expect(r.x + r.width / 2).toBeCloseTo(55, 5)
      expect(r.y + r.height / 2).toBeCloseTo(55, 5)
    }
  })

  test('Test 13: multi-select [decoration_rot45, decoration_rot0] → union AABB encloses BOTH bounds', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 0, y: 0, width: 10, height: 10 }, { rotation: 45 }),
        makeShapeDec('d2', { x: 50, y: 50, width: 20, height: 20 }, { rotation: 0 }),
      ],
    })
    const r = computeSelectionBounds(slide, ['d1', 'd2'])
    expect(r).not.toBeNull()
    if (r) {
      // d1 rotated 45° around (5, 5): corners reach x=5 - sqrt(2)*5 ≈ -2.07 and x=5 + sqrt(2)*5 ≈ 12.07.
      // d2 rectilinear: x in [50, 70], y in [50, 70].
      // Union: minX ≈ -2.07, maxX = 70, minY ≈ -2.07, maxY = 70.
      expect(r.x).toBeCloseTo(5 - Math.sqrt(2) * 5, 5)
      expect(r.y).toBeCloseTo(5 - Math.sqrt(2) * 5, 5)
      expect(r.x + r.width).toBeCloseTo(70, 5)
      expect(r.y + r.height).toBeCloseTo(70, 5)
    }
  })

  test('Test 14: multi-select [decoration_rot45, text_box, custom_image] → union spans rotated decoration + raw rectilinear other scopes', () => {
    const slide = makeSlideD({
      text_boxes: [makeCustomTextBox('tb1', 80, 0, 10)],
      custom_images: [makeCustomImage('ci1', 0, 80, 5, 5)],
      decorations: [
        makeIconDec('d1', { x: 50, y: 50, width: 10, height: 10 }, { rotation: 45 }),
      ],
    })
    const r = computeSelectionBounds(slide, ['tb1', 'ci1', 'd1'])
    expect(r).not.toBeNull()
    if (r) {
      // tb1: x=80, y=0, w=10, h=0 → contributes maxX=90.
      // ci1: x=0, y=80, w=5, h=5 → contributes minX=0.
      // d1 rotated: extent ≈ 14.142 around center (55, 55). minY ≈ 47.93.
      // Union: minX = 0, minY = 0 (tb1 y=0), maxX = 90, maxY = 85 (ci1 80+5).
      expect(r.x).toBeCloseTo(0, 5)
      expect(r.y).toBeCloseTo(0, 5)
      expect(r.x + r.width).toBeCloseTo(90, 5)
      expect(r.y + r.height).toBeCloseTo(85, 5)
    }
  })

  test('Test 15: locked rotated decoration INCLUDED in bounds (Phase 63 D-01 + LOCK-04)', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec(
          'd1',
          { x: 50, y: 50, width: 10, height: 10 },
          { rotation: 45, locked: true },
        ),
      ],
    })
    const r = computeSelectionBounds(slide, ['d1'])
    expect(r).not.toBeNull()
    if (r) {
      // Locked decoration still contributes — read side includes locked.
      const expectedExtent = Math.sqrt(2) * 10
      expect(r.width).toBeCloseTo(expectedExtent, 5)
      expect(r.height).toBeCloseTo(expectedExtent, 5)
    }
  })

  test('Test 16: hidden rotated decoration EXCLUDED from bounds (Phase 64 LOCK-07)', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec(
          'd-hidden',
          { x: 50, y: 50, width: 10, height: 10 },
          { rotation: 45, hidden: true },
        ),
        makeShapeDec(
          'd-visible',
          { x: 80, y: 80, width: 10, height: 10 },
          { rotation: 0 },
        ),
      ],
    })
    const r = computeSelectionBounds(slide, ['d-hidden', 'd-visible'])
    expect(r).not.toBeNull()
    if (r) {
      // Only d-visible contributes; bounds = its own AABB (no rotation).
      expect(r.x).toBe(80)
      expect(r.y).toBe(80)
      expect(r.width).toBe(10)
      expect(r.height).toBe(10)
    }
  })
})

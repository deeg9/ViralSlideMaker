import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { Slide, TextBox, CustomImage, Watermark } from '@/lib/types/slide'
import {
  computeSelectionBounds,
  type AABB,
} from '@/lib/editor/transforms/selection-bounds'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers (mirrors text-box-adapter.test.ts + use-selection-model.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

function makeCustomImage(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): CustomImage {
  return { id, url: 'https://example.com/x.png', x, y, width, height }
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

function makeStructuralTextBox(
  id: string,
  anchor: 'top' | 'center' | 'bottom',
): TextBox {
  return {
    id,
    role: 'hook',
    text: 'hello',
    position: { anchor },
  }
}

function makeWatermark(
  id: string,
  position: 'top-left' | 'bottom-left' | 'bottom-right' = 'bottom-right',
): Watermark {
  return { id, enabled: true, position }
}

function makeSlide(opts: {
  text_boxes?: TextBox[]
  custom_images?: CustomImage[]
  watermark?: Watermark
} = {}): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: opts.text_boxes,
    custom_images: opts.custom_images,
    watermark: opts.watermark,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('computeSelectionBounds — empty / stale id cases', () => {
  test('Test 1: empty ids returns null', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 10, 10, 20, 20)],
    })
    expect(computeSelectionBounds(slide, [])).toBe(null)
  })

  test('Test 2: only stale ids returns null', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 10, 10, 20, 20)],
    })
    expect(computeSelectionBounds(slide, ['nonexistent'])).toBe(null)
  })
})

describe('computeSelectionBounds — single element', () => {
  test('Test 3: single custom_image returns its bounds verbatim', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 10, 20, 30, 40)],
    })
    const result = computeSelectionBounds(slide, ['img1'])
    expect(result).toEqual<AABB>({ x: 10, y: 20, width: 30, height: 40 })
  })
})

describe('computeSelectionBounds — multi-element union', () => {
  test('Test 4: two custom_images at (10,10,20,20) and (50,50,30,30) → union (10,10,70,70)', () => {
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 10, 10, 20, 20),
        makeCustomImage('b', 50, 50, 30, 30),
      ],
    })
    const result = computeSelectionBounds(slide, ['a', 'b'])
    expect(result).toEqual<AABB>({ x: 10, y: 10, width: 70, height: 70 })
  })

  test('Test 5: union of one custom-anchor TextBox and one custom_image', () => {
    // custom TextBox at x=5, y=5, width=40 (height treated as 0 — Phase 60 known gap)
    // custom_image at x=10, y=10, w=20, h=20
    const slide = makeSlide({
      text_boxes: [makeCustomTextBox('tb', 5, 5, 40)],
      custom_images: [makeCustomImage('img', 10, 10, 20, 20)],
    })
    const result = computeSelectionBounds(slide, ['tb', 'img'])
    // TextBox rect: (5,5,40,0), Image rect: (10,10,20,20)
    // minX=5, minY=5, maxX=max(45,30)=45, maxY=max(5,30)=30
    expect(result).toEqual<AABB>({ x: 5, y: 5, width: 40, height: 25 })
  })
})

describe('computeSelectionBounds — Phase 60 known gaps (skip semantics)', () => {
  test('Test 6: structural-anchor TextBox skipped; only remaining elements counted', () => {
    const slide = makeSlide({
      text_boxes: [
        makeStructuralTextBox('hook1', 'top'),
        makeCustomTextBox('cb', 10, 10, 30),
      ],
    })
    // hook1 has anchor='top' → skipped per Phase 60 known-gap
    // cb has anchor='custom' → included with rect (10,10,30,0)
    const result = computeSelectionBounds(slide, ['hook1', 'cb'])
    expect(result).toEqual<AABB>({ x: 10, y: 10, width: 30, height: 0 })
  })

  test('Test 6b: only structural-anchor TextBoxes selected → returns null', () => {
    const slide = makeSlide({
      text_boxes: [makeStructuralTextBox('hook1', 'top')],
    })
    expect(computeSelectionBounds(slide, ['hook1'])).toBe(null)
  })

  // Phase 63 D-01: Tests 7 / 7b are SUPERSEDED by Tests 12 / 13 below. The
  // Phase 60 watermark-skip gap is closed: watermark contributes its
  // placeholder rect to the union AABB. Read-side ALIGN-10 is now uniform
  // across element types; the move-side filter is the caller's job.
})

describe('computeSelectionBounds — purity invariant', () => {
  test('Test 8: source file imports no React, no DOM, no use-client', () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/lib/editor/transforms/selection-bounds.ts',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    expect(src).not.toMatch(/from ['"]react['"]/)
    expect(src).not.toMatch(/['"]use client['"]/)
    expect(src).not.toMatch(/document\.|window\./)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 63 D-01: locked + watermark INCLUDED in bounds (read side of
// ALIGN-10). Closes Phase 60 known gaps #2 (watermark) and partially #3
// (locked elements were already implicitly included; tests pin that).
// The MOVE side filter (locked/watermark exclusion from translation) is
// the caller's job — see align.ts and the ALIGN/DISTRIBUTE reducer cases.
// ─────────────────────────────────────────────────────────────────────────────

describe('computeSelectionBounds — Phase 63 (locked + watermark in bounds)', () => {
  test('Test 11 (ALIGN-10 read): selection containing a locked custom_image returns bounds INCLUDING that image', () => {
    const lockedImg: CustomImage = {
      id: 'locked-img',
      url: 'https://example.com/x.png',
      x: 5,
      y: 5,
      width: 25,
      height: 25,
      locked: true,
    }
    const slide = makeSlide({
      custom_images: [lockedImg, makeCustomImage('free', 50, 50, 20, 20)],
    })
    const result = computeSelectionBounds(slide, ['locked-img', 'free'])
    // locked-img: rect (5,5,25,25); free: rect (50,50,20,20)
    // minX=5, minY=5, maxX=70, maxY=70 → width=65, height=65
    expect(result).toEqual<AABB>({ x: 5, y: 5, width: 65, height: 65 })
  })

  test('Test 12: selection containing watermark contributes a placeholder rect (bottom-right anchor)', () => {
    const slide = makeSlide({
      watermark: makeWatermark('w_0', 'bottom-right'),
      custom_images: [makeCustomImage('img', 10, 10, 20, 20)],
    })
    const result = computeSelectionBounds(slide, ['w_0', 'img'])
    // Watermark placeholder: 18% wide × 5% tall, anchored bottom-right (x=82, y=95)
    // img: rect (10,10,20,20)
    // minX=10, minY=10, maxX=max(30, 82+18=100)=100, maxY=max(30, 95+5=100)=100
    expect(result).not.toBeNull()
    expect(result!.x).toBe(10)
    expect(result!.y).toBe(10)
    expect(result!.width).toBe(90)
    expect(result!.height).toBe(90)
  })

  test('Test 12b: only watermark (top-left) selected → returns its placeholder rect', () => {
    const slide = makeSlide({
      watermark: makeWatermark('w_0', 'top-left'),
    })
    const result = computeSelectionBounds(slide, ['w_0'])
    // top-left placeholder: x=0, y=0, width=18, height=5
    expect(result).toEqual<AABB>({ x: 0, y: 0, width: 18, height: 5 })
  })

  test('Test 12c: only watermark (bottom-left) selected → returns its placeholder rect', () => {
    const slide = makeSlide({
      watermark: makeWatermark('w_0', 'bottom-left'),
    })
    const result = computeSelectionBounds(slide, ['w_0'])
    // bottom-left placeholder: x=0, y=95, width=18, height=5
    expect(result).toEqual<AABB>({ x: 0, y: 95, width: 18, height: 5 })
  })

  test('Test 13: selection of ONLY watermark + ONLY locked custom_image — both contribute; bounds equals union', () => {
    const lockedImg: CustomImage = {
      id: 'locked-img',
      url: 'https://example.com/x.png',
      x: 40,
      y: 40,
      width: 10,
      height: 10,
      locked: true,
    }
    const slide = makeSlide({
      custom_images: [lockedImg],
      watermark: makeWatermark('w_0', 'top-left'),
    })
    const result = computeSelectionBounds(slide, ['w_0', 'locked-img'])
    // watermark top-left: (0,0,18,5); locked-img: (40,40,10,10)
    // minX=0, minY=0, maxX=max(18,50)=50, maxY=max(5,50)=50
    expect(result).toEqual<AABB>({ x: 0, y: 0, width: 50, height: 50 })
  })

  test('Test 14 (purity): no React / use-client / DOM imports after the Phase 63 lift', () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/lib/editor/transforms/selection-bounds.ts',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    expect(src).not.toMatch(/from ['"]react['"]/)
    expect(src).not.toMatch(/['"]use client['"]/)
    expect(src).not.toMatch(/document\.|window\./)
    // Phase 63 invariants (close-the-gap):
    //   - "Watermark intentionally skipped" comment must be gone.
    //   - No `locked` skip in this read-only function.
    expect(src).not.toMatch(/Watermark intentionally skipped/)
    expect(src).not.toMatch(/if\s*\([^)]*\.locked\b/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 64 Plan 02 (LOCK-07): hidden-skip in computeSelectionBounds. Hidden
// elements are EXCLUDED from the union AABB so a hidden element does not pad
// the alignment-target bounds. Locked still INCLUDED (Phase 63 D-01 contract);
// the two filters are SEPARATE.
// ─────────────────────────────────────────────────────────────────────────────

describe('computeSelectionBounds — Phase 64 Plan 02 (LOCK-07): hidden-skip', () => {
  test('Test SB-H1: hidden custom_image NOT included in union AABB; only the visible image contributes', () => {
    const hiddenImg: CustomImage = {
      id: 'hidden-img',
      url: 'https://example.com/h.png',
      x: 90,
      y: 90,
      width: 5,
      height: 5,
      hidden: true,
    }
    const slide = makeSlide({
      custom_images: [makeCustomImage('visible', 10, 10, 20, 20), hiddenImg],
    })
    const result = computeSelectionBounds(slide, ['visible', 'hidden-img'])
    // Only 'visible' contributes — bounds equal its rect (10,10,20,20).
    expect(result).toEqual<AABB>({ x: 10, y: 10, width: 20, height: 20 })
  })

  test('Test SB-H2: ALL hidden ids → null bounds (no contributing elements)', () => {
    const hiddenImg: CustomImage = {
      id: 'h1',
      url: 'https://example.com/h.png',
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      hidden: true,
    }
    const hiddenTb: TextBox = {
      id: 'h-tb',
      role: 'custom',
      text: '',
      position: { anchor: 'custom', x: 30, y: 30, width: 40 },
      hidden: true,
    }
    const slide = makeSlide({
      custom_images: [hiddenImg],
      text_boxes: [hiddenTb],
    })
    expect(computeSelectionBounds(slide, ['h1', 'h-tb'])).toBe(null)
  })

  test('Test SB-H3: hidden custom-anchor TextBox NOT included; visible TextBox contributes', () => {
    const hiddenTb: TextBox = {
      id: 'h-tb',
      role: 'custom',
      text: '',
      position: { anchor: 'custom', x: 80, y: 80, width: 15 },
      hidden: true,
    }
    const slide = makeSlide({
      text_boxes: [makeCustomTextBox('vtb', 5, 5, 40), hiddenTb],
    })
    const result = computeSelectionBounds(slide, ['vtb', 'h-tb'])
    // Only the visible TextBox contributes; rect (5,5,40,0) — height=0 per Phase 60 known gap.
    expect(result).toEqual<AABB>({ x: 5, y: 5, width: 40, height: 0 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 68 Plan 02 (EDITOR-13): selection bounds extended for decorations.
// Decoration position is a 4-tuple {x, y, width, height} of % units. Locked
// INCLUDED in bounds (Phase 63 D-01); hidden EXCLUDED (Phase 64 LOCK-07).
// Rotation-aware AABB lift is Phase 72 EDITOR-07.
// ─────────────────────────────────────────────────────────────────────────────

import type { Decoration, IconDecoration, ShapeDecoration } from '@/lib/types/slide'

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

function makeSlideD(opts: {
  text_boxes?: TextBox[]
  custom_images?: CustomImage[]
  decorations?: Decoration[]
  watermark?: Watermark
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
    watermark: opts.watermark,
  }
}

describe('computeSelectionBounds — Phase 68 Plan 02 decoration extension', () => {
  test('SB-1: selection ids = [decoration_id] returns AABB matching the freeform x/y/width/height', () => {
    const slide = makeSlideD({
      decorations: [makeIconDec('d1', { x: 10, y: 20, width: 30, height: 40 })],
    })
    expect(computeSelectionBounds(slide, ['d1'])).toEqual<AABB>({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })

  test('SB-2: locked decoration INCLUDED in bounds (Phase 63 D-01)', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 10, y: 10, width: 10, height: 10 }, { locked: true }),
      ],
    })
    expect(computeSelectionBounds(slide, ['d1'])).toEqual<AABB>({
      x: 10,
      y: 10,
      width: 10,
      height: 10,
    })
  })

  test('SB-3: hidden decoration EXCLUDED (Phase 64 LOCK-07)', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 10, y: 10, width: 10, height: 10 }, { hidden: true }),
        makeShapeDec('d2', { x: 50, y: 50, width: 20, height: 20 }),
      ],
    })
    const r = computeSelectionBounds(slide, ['d1', 'd2'])
    // Only d2 contributes; bounds = its own AABB
    expect(r).toEqual<AABB>({ x: 50, y: 50, width: 20, height: 20 })
  })

  test('SB-4: multi-selection [text_box + decoration] returns union AABB', () => {
    const slide = makeSlideD({
      text_boxes: [makeCustomTextBox('tb1', 0, 0, 10)],
      decorations: [makeIconDec('d1', { x: 50, y: 50, width: 20, height: 20 })],
    })
    const r = computeSelectionBounds(slide, ['tb1', 'd1'])
    expect(r).not.toBeNull()
    if (r) {
      // tb1 contributes (0,0,10,0); d1 contributes (50,50,20,20)
      // union: minX=0, minY=0, maxX=70, maxY=70 → (0,0,70,70)
      expect(r.x).toBe(0)
      expect(r.y).toBe(0)
      expect(r.width).toBe(70)
      expect(r.height).toBe(70)
    }
  })

  test('SB-5: decoration at (10,10,20,30) returns {x:10,y:10,width:20,height:30}', () => {
    const slide = makeSlideD({
      decorations: [makeIconDec('d1', { x: 10, y: 10, width: 20, height: 30 })],
    })
    expect(computeSelectionBounds(slide, ['d1'])).toEqual<AABB>({
      x: 10,
      y: 10,
      width: 20,
      height: 30,
    })
  })
})

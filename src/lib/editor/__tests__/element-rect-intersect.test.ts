import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type {
  Slide,
  TextBox,
  CustomImage,
  Watermark,
} from '@/lib/types/slide'
import {
  elementsInRect,
  type Rect,
} from '@/lib/editor/transforms/element-rect-intersect'

/**
 * Phase 61 (SEL-05): elementsInRect pure-helper tests.
 *
 * Coordinate space: rect AND element AABBs are percentages of REF_WIDTH
 * (1080) × REF_HEIGHT (1920). Plan 61-02 converts selecto's pixel coords
 * to % BEFORE calling.
 *
 * Mode: Figma intersect (hitRate=0). Any overlap counts — even 1px.
 *
 * Conservative scope (mirrors Plan 60-05 selection-bounds.ts):
 *   - SKIP watermark (Phase 60 known gap)
 *   - SKIP TextBoxes with anchor !== 'custom' (no x/y to resolve)
 *   - INCLUDE locked elements (Phase 64 wires locked semantics later)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
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
  role: 'hook' | 'body',
  anchor: 'top' | 'center' | 'bottom',
): TextBox {
  return {
    id,
    role,
    text: 'hello',
    position: { anchor },
  }
}

function makeWatermark(id: string): Watermark {
  return { id, enabled: true, position: 'bottom-right' }
}

function makeSlide(opts: {
  text_boxes?: TextBox[]
  custom_images?: CustomImage[]
  watermark?: Watermark
} = {}): Slide {
  return {
    hook_text: 'H',
    body_text: 'B',
    image_query: 'q',
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

describe('elementsInRect — empty / no-element cases', () => {
  test('Test 1: empty slide returns []', () => {
    const slide = makeSlide()
    const rect: Rect = { x: 0, y: 0, w: 50, h: 50 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })
})

describe('elementsInRect — custom_image intersect mode', () => {
  test('Test 2: rect fully containing 1 custom_image returns [id]', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 20, 20, 10, 10)],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual(['img1'])
  })

  test('Test 3: rect partially overlapping 1 custom_image returns [id]', () => {
    // image at (10..30, 10..30); rect at (25..40, 25..40) → overlap (25..30, 25..30)
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 10, 10, 20, 20)],
    })
    const rect: Rect = { x: 25, y: 25, w: 15, h: 15 }
    expect(elementsInRect(slide, rect)).toEqual(['img1'])
  })

  test('Test 4: rect adjacent-but-not-touching 1 custom_image returns []', () => {
    // image at (10..30, 10..30); rect at (40..50, 40..50) → no overlap, gap of 10
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 10, 10, 20, 20)],
    })
    const rect: Rect = { x: 40, y: 40, w: 10, h: 10 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('Test 5: rect overlapping 2 custom_images returns both ids in source order', () => {
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 0, 0, 30, 30),
        makeCustomImage('b', 50, 50, 30, 30),
      ],
    })
    const rect: Rect = { x: 10, y: 10, w: 70, h: 70 }
    expect(elementsInRect(slide, rect)).toEqual(['a', 'b'])
  })
})

describe('elementsInRect — TextBox custom-anchor inclusion', () => {
  test('Test 6: TextBox with anchor=custom included when rect overlaps', () => {
    // custom textbox uses 1-px-strip approx (h=1) per module header.
    // tb at x=10, y=10, w=20 → strip rect (10..30, 10..11)
    // selecting rect (0..50, 0..50) clearly overlaps the strip.
    const slide = makeSlide({
      text_boxes: [makeCustomTextBox('tb1', 10, 10, 20)],
    })
    const rect: Rect = { x: 0, y: 0, w: 50, h: 50 }
    expect(elementsInRect(slide, rect)).toEqual(['tb1'])
  })
})

describe('elementsInRect — Phase 60 known gaps (skip semantics)', () => {
  test('Test 7: TextBox role=hook (anchor !== custom) is skipped', () => {
    const slide = makeSlide({
      text_boxes: [makeStructuralTextBox('hook1', 'hook', 'top')],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('Test 8: TextBox role=body (anchor !== custom) is skipped', () => {
    const slide = makeSlide({
      text_boxes: [makeStructuralTextBox('body1', 'body', 'center')],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('Test 9: rect over watermark area returns [] (watermark skipped)', () => {
    const slide = makeSlide({
      watermark: makeWatermark('w_0'),
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('Test 10: mixed slide — custom_image + custom textbox + hook → hook skipped', () => {
    const slide = makeSlide({
      text_boxes: [
        makeStructuralTextBox('hook1', 'hook', 'top'),
        makeCustomTextBox('ctb', 0, 0, 20),
      ],
      custom_images: [makeCustomImage('img', 50, 50, 10, 10)],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    // ctb walked first (text_boxes), then img (custom_images), hook1 skipped
    expect(elementsInRect(slide, rect)).toEqual(['ctb', 'img'])
  })
})

describe('elementsInRect — degenerate / defensive cases', () => {
  test('Test 11: zero-area rect returns []', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 10, 10, 20, 20)],
    })
    const rect: Rect = { x: 15, y: 15, w: 0, h: 0 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('Test 12: TextBox role=custom missing x/y/width → skipped', () => {
    const slide = makeSlide({
      text_boxes: [
        // intentionally malformed — anchor=custom but no x/y/width
        {
          id: 'broken',
          role: 'custom',
          text: '',
          position: { anchor: 'custom' },
        } as TextBox,
      ],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })
})

describe('elementsInRect — purity invariant', () => {
  test('Test 13: source file imports no React, no DOM, no use-client', () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/lib/editor/transforms/element-rect-intersect.ts',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    expect(src).not.toMatch(/from ['"]react['"]/)
    expect(src).not.toMatch(/['"]use client['"]/)
    expect(src).not.toMatch(/document\.|window\./)
  })
})

describe('elementsInRect — hitRate=0 contract (any overlap counts)', () => {
  test('Test 14: 1px overlap on a custom_image returns its id', () => {
    // image at x=10..30, y=10..30
    // rect overlapping by 1 unit on x: x=29..30 (w=1), y=29..30 (h=1) — single corner unit
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 10, 10, 20, 20)],
    })
    const rect: Rect = { x: 29, y: 29, w: 1, h: 1 }
    expect(elementsInRect(slide, rect)).toEqual(['img1'])
  })
})

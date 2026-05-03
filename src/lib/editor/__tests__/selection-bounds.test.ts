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

function makeWatermark(id: string): Watermark {
  return { id, enabled: true, position: 'bottom-right' }
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

  test('Test 7: watermark id silently skipped — returns bounds of OTHER elements only', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('img', 10, 10, 20, 20)],
      watermark: makeWatermark('w_0'),
    })
    const result = computeSelectionBounds(slide, ['w_0', 'img'])
    expect(result).toEqual<AABB>({ x: 10, y: 10, width: 20, height: 20 })
  })

  test('Test 7b: only watermark selected → returns null (Phase 60 gap)', () => {
    const slide = makeSlide({ watermark: makeWatermark('w_0') })
    expect(computeSelectionBounds(slide, ['w_0'])).toBe(null)
  })
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

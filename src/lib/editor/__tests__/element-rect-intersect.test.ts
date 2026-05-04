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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 64 Plan 01 (LOCK-05): elementsInRect skips elements with locked === true.
// Closes the Phase 61 documented gap. Figma + Canva model — locked elements
// remain selectable via direct click but are excluded from marquee results so
// users can drag-select around them without disturbing locked decoration.
// ─────────────────────────────────────────────────────────────────────────────
describe('elementsInRect — Phase 64 Plan 01 (LOCK-05): locked-skip filter', () => {
  test('Test LR1: locked custom-anchor TextBox NOT in marquee result', () => {
    const slide = makeSlide({
      text_boxes: [
        // identical AABB to Test 6, but with locked=true → must NOT appear.
        { ...makeCustomTextBox('tb-locked', 10, 10, 20), locked: true },
      ],
    })
    const rect: Rect = { x: 0, y: 0, w: 50, h: 50 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('Test LR2: locked custom_image NOT in marquee result', () => {
    const slide = makeSlide({
      custom_images: [{ ...makeCustomImage('img-locked', 20, 20, 10, 10), locked: true }],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('Test LR3: marquee with [unlocked, locked, unlocked] returns only the two unlocked ids; source-order preserved', () => {
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 0, 0, 10, 10),
        { ...makeCustomImage('b', 20, 20, 10, 10), locked: true },
        makeCustomImage('c', 40, 40, 10, 10),
      ],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual(['a', 'c'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 68 Plan 02 (EDITOR-04): elementsInRect extended for decorations.
// Decoration.position is a 4-tuple {x, y, width, height} of % units (mirrors
// CustomImage layout semantics). LOCK-05 carry-forward — locked decorations
// excluded so users can drag-select around them. Rotation-aware corners are
// Phase 72 EDITOR-07 lift target — this phase intersects rectilinear AABB only.
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
    hook_text: 'H',
    body_text: 'B',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: opts.text_boxes,
    custom_images: opts.custom_images,
    decorations: opts.decorations,
    watermark: opts.watermark,
  }
}

describe('elementsInRect — Phase 68 Plan 02 decoration extension', () => {
  test('EI-1: elementsInRect on rect overlapping a decoration returns [decoration_id]', () => {
    const slide = makeSlideD({
      decorations: [makeIconDec('d1', { x: 10, y: 10, width: 10, height: 10 })],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual(['d1'])
  })

  test('EI-2: elementsInRect EXCLUDES locked decoration (LOCK-05)', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 10, y: 10, width: 10, height: 10 }, { locked: true }),
        makeShapeDec('d2', { x: 30, y: 30, width: 10, height: 10 }),
      ],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual(['d2'])
  })

  test('EI-3: returns ids in canonical order: custom_images BEFORE decorations (slide source order pinned)', () => {
    const slide = makeSlideD({
      custom_images: [makeCustomImage('ci1', 5, 5, 10, 10)],
      decorations: [makeIconDec('d1', { x: 20, y: 20, width: 10, height: 10 })],
    })
    const rect: Rect = { x: 0, y: 0, w: 100, h: 100 }
    expect(elementsInRect(slide, rect)).toEqual(['ci1', 'd1'])
  })

  test('EI-4: rect of zero size returns [] (existing guard preserved)', () => {
    const slide = makeSlideD({
      decorations: [makeIconDec('d1', { x: 10, y: 10, width: 10, height: 10 })],
    })
    const rect: Rect = { x: 0, y: 0, w: 0, h: 0 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })

  test('EI-5: rect strictly outside decoration bounds excludes it (1px-separation invariant)', () => {
    const slide = makeSlideD({
      decorations: [makeIconDec('d1', { x: 10, y: 10, width: 10, height: 10 })],
    })
    // Rect at (50,50) → (60,60); decoration at (10,10) → (20,20). No overlap.
    const rect: Rect = { x: 50, y: 50, w: 10, h: 10 }
    expect(elementsInRect(slide, rect)).toEqual([])
  })
})

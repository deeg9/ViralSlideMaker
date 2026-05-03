import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { Slide, TextBox, CustomImage, Watermark } from '@/lib/types/slide'
import {
  alignElements,
  distributeElements,
  type AlignAxis,
  type AlignTarget,
  type DistributeAxis,
  type AlignPatch,
} from '@/lib/editor/transforms/align'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers — mirrors selection-bounds.test.ts conventions
// ─────────────────────────────────────────────────────────────────────────────

function makeCustomImage(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extras: Partial<CustomImage> = {},
): CustomImage {
  return { id, url: 'https://example.com/x.png', x, y, width, height, ...extras }
}

function makeCustomTextBox(
  id: string,
  x: number,
  y: number,
  width: number,
  extras: Partial<TextBox> = {},
): TextBox {
  return {
    id,
    role: 'custom',
    text: '',
    position: { anchor: 'custom', x, y, width },
    ...extras,
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

function findPatch(
  patches: AlignPatch[],
  id: string,
): AlignPatch | undefined {
  return patches.find((p) => p.id === id)
}

// ─────────────────────────────────────────────────────────────────────────────
// alignElements — 6-axis × N=1 (target='canvas') and N>=2 (target='selection')
// ─────────────────────────────────────────────────────────────────────────────

describe('alignElements — N=1 target=canvas (1080×1920)', () => {
  test('A1: left axis with x=30 width=20 → patch.x = 0', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 30, 40, 20, 20)],
    })
    const patches = alignElements(
      slide,
      ['a'],
      'left' as AlignAxis,
      'canvas' as AlignTarget,
    )
    expect(patches.length).toBe(1)
    expect(patches[0].id).toBe('a')
    expect(patches[0].patch.x).toBe(0)
    // y untouched on horizontal axis
    expect(patches[0].patch.y).toBeUndefined()
  })

  test('A2: right axis with x=30 width=20 → patch.x = 80', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 30, 40, 20, 20)],
    })
    const patches = alignElements(slide, ['a'], 'right', 'canvas')
    expect(patches[0].patch.x).toBe(80)
    expect(patches[0].patch.y).toBeUndefined()
  })

  test('A3: center-h axis with x=30 width=20 → patch.x = 40 (50 - width/2)', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 30, 40, 20, 20)],
    })
    const patches = alignElements(slide, ['a'], 'center-h', 'canvas')
    expect(patches[0].patch.x).toBe(40)
  })

  test('A4: top axis → patch.y = 0', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 30, 40, 20, 20)],
    })
    const patches = alignElements(slide, ['a'], 'top', 'canvas')
    expect(patches[0].patch.y).toBe(0)
    expect(patches[0].patch.x).toBeUndefined()
  })

  test('A5: bottom axis with height=20 → patch.y = 80', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 30, 40, 20, 20)],
    })
    const patches = alignElements(slide, ['a'], 'bottom', 'canvas')
    expect(patches[0].patch.y).toBe(80)
  })

  test('A6: center-v axis with height=20 → patch.y = 40', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 30, 40, 20, 20)],
    })
    const patches = alignElements(slide, ['a'], 'center-v', 'canvas')
    expect(patches[0].patch.y).toBe(40)
  })
})

describe('alignElements — N>=2 target=selection union AABB', () => {
  test('A7: left axis, N=3 — every patch.x = bounds.x (leftmost left edge of all 3)', () => {
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 10, 10, 20, 20),
        makeCustomImage('b', 30, 30, 20, 20),
        makeCustomImage('c', 50, 50, 20, 20),
      ],
    })
    const patches = alignElements(slide, ['a', 'b', 'c'], 'left', 'selection')
    expect(patches.length).toBe(3)
    expect(findPatch(patches, 'a')!.patch.x).toBe(10)
    expect(findPatch(patches, 'b')!.patch.x).toBe(10)
    expect(findPatch(patches, 'c')!.patch.x).toBe(10)
  })

  test('A8: center-h axis, N=3 — each patch.x = bounds.x + bounds.width/2 - element.width/2', () => {
    // Bounds: a@(10,10,20,20), b@(30,30,20,20), c@(50,50,20,20)
    //   minX=10, maxX=70 → bounds.width=60, bounds.center_x = 10 + 30 = 40
    // Each element width=20 → patch.x = 40 - 10 = 30
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 10, 10, 20, 20),
        makeCustomImage('b', 30, 30, 20, 20),
        makeCustomImage('c', 50, 50, 20, 20),
      ],
    })
    const patches = alignElements(
      slide,
      ['a', 'b', 'c'],
      'center-h',
      'selection',
    )
    expect(findPatch(patches, 'a')!.patch.x).toBe(30)
    expect(findPatch(patches, 'b')!.patch.x).toBe(30)
    expect(findPatch(patches, 'c')!.patch.x).toBe(30)
  })

  test('A9: right axis, N=3 — each patch.x = bounds.x + bounds.width - element.width', () => {
    // Bounds right edge = 70. Elements width=20 → patch.x = 50.
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 10, 10, 20, 20),
        makeCustomImage('b', 30, 30, 20, 20),
        makeCustomImage('c', 50, 50, 20, 20),
      ],
    })
    const patches = alignElements(slide, ['a', 'b', 'c'], 'right', 'selection')
    expect(findPatch(patches, 'a')!.patch.x).toBe(50)
    expect(findPatch(patches, 'b')!.patch.x).toBe(50)
    expect(findPatch(patches, 'c')!.patch.x).toBe(50)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Move-side filters: locked, watermark, structural-anchor
// ─────────────────────────────────────────────────────────────────────────────

describe('alignElements — locked / watermark / structural-anchor filtering', () => {
  test('A10: N=3 with one locked, target=selection — bounds includes locked, patches list excludes locked', () => {
    // bounds spans 'a' (locked, x=10) through 'c' (x=50,width=20) → leftmost=10
    const lockedImg = makeCustomImage('a', 10, 10, 20, 20, { locked: true })
    const slide = makeSlide({
      custom_images: [
        lockedImg,
        makeCustomImage('b', 30, 30, 20, 20),
        makeCustomImage('c', 50, 50, 20, 20),
      ],
    })
    const patches = alignElements(
      slide,
      ['a', 'b', 'c'],
      'left',
      'selection',
    )
    // Only b + c get patches (a locked, excluded from move).
    expect(patches.length).toBe(2)
    expect(findPatch(patches, 'a')).toBeUndefined()
    // Bounds left edge is 10 (was a's left edge — locked is in bounds).
    expect(findPatch(patches, 'b')!.patch.x).toBe(10)
    expect(findPatch(patches, 'c')!.patch.x).toBe(10)
  })

  test('A11: integer rounding — input x=30.7777 width=20.3333 → patch.x is an integer', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 30.7777, 40, 20.3333, 20)],
    })
    const patches = alignElements(slide, ['a'], 'center-h', 'canvas')
    // Pre-round: patch.x = 50 - 20.3333/2 = 39.83335 → Math.round → 40
    expect(patches[0].patch.x).toBe(40)
    expect(Number.isInteger(patches[0].patch.x as number)).toBe(true)
  })

  test('A12: N=2 with watermark + custom_image, target=selection — bounds includes watermark, patches exclude watermark', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('img', 50, 50, 20, 20)],
      watermark: makeWatermark('w_0', 'top-left'),
    })
    // watermark top-left placeholder rect: (0,0,18,5) — bounds left edge = 0
    const patches = alignElements(
      slide,
      ['w_0', 'img'],
      'left',
      'selection',
    )
    expect(patches.length).toBe(1)
    expect(findPatch(patches, 'w_0')).toBeUndefined()
    expect(findPatch(patches, 'img')!.patch.x).toBe(0)
  })

  test('A13: N=2 with hook (anchor=top) + custom_image, target=selection — patches exclude structural-anchor textbox', () => {
    const slide = makeSlide({
      text_boxes: [makeStructuralTextBox('hook1', 'top')],
      custom_images: [makeCustomImage('img', 50, 50, 20, 20)],
    })
    const patches = alignElements(
      slide,
      ['hook1', 'img'],
      'left',
      'selection',
    )
    expect(patches.length).toBe(1)
    expect(findPatch(patches, 'hook1')).toBeUndefined()
    expect(findPatch(patches, 'img')!.patch.x).toBe(50)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// alignElements — empty / null bounds / TextBox custom-anchor
// ─────────────────────────────────────────────────────────────────────────────

describe('alignElements — edge cases', () => {
  test('A14: empty ids → returns []', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('a', 10, 10, 20, 20)],
    })
    expect(alignElements(slide, [], 'left', 'canvas')).toEqual([])
  })

  test('A15: target=selection with N>=2 but bounds null (only structural-anchor textboxes) → returns []', () => {
    const slide = makeSlide({
      text_boxes: [
        makeStructuralTextBox('h', 'top'),
        makeStructuralTextBox('b', 'bottom'),
      ],
    })
    const patches = alignElements(slide, ['h', 'b'], 'left', 'selection')
    expect(patches).toEqual([])
  })

  test('A16: custom-anchor textbox aligns its position.x — patch carries x not y for horizontal axis', () => {
    const slide = makeSlide({
      text_boxes: [makeCustomTextBox('tb', 30, 40, 20)],
    })
    const patches = alignElements(slide, ['tb'], 'left', 'canvas')
    expect(patches.length).toBe(1)
    expect(patches[0].patch.x).toBe(0)
    expect(patches[0].patch.y).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// distributeElements — N<3 no-op, gap-based equal spacing, integer rounding
// ─────────────────────────────────────────────────────────────────────────────

describe('distributeElements — gap-based equal spacing', () => {
  test('D1: N<3 returns [] (ALIGN-06 conservative pure-fn enforcement)', () => {
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 0, 0, 10, 10),
        makeCustomImage('b', 50, 50, 10, 10),
      ],
    })
    expect(distributeElements(slide, ['a', 'b'], 'horizontal' as DistributeAxis)).toEqual([])
    expect(distributeElements(slide, [], 'horizontal')).toEqual([])
    expect(distributeElements(slide, ['a'], 'horizontal')).toEqual([])
  })

  test('D2: distribute horizontal N=3 with widths [10,10,10] x=[0,30,80] → middle.x = 35', () => {
    // total span = 80 + 10 - 0 = 90; sum widths = 30; total inner span = 60; gap = 30
    // first ends at 10; middle.x = 10 + 30 = 40? Wait — recompute carefully.
    // Plan spec: total_inner_span = (last.position + last.size) - first.position - sum(widths)
    //   = (80 + 10) - 0 - (10 + 10 + 10) = 60
    // gap = 60 / (3 - 1) = 30
    // middle.x = first.start + first.size + gap*1 = 0 + 10 + 30 = 40
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 0, 0, 10, 10),
        makeCustomImage('b', 30, 0, 10, 10),
        makeCustomImage('c', 80, 0, 10, 10),
      ],
    })
    const patches = distributeElements(slide, ['a', 'b', 'c'], 'horizontal')
    // Outermost two pinned (no patch entry); middle moves.
    expect(patches.length).toBe(1)
    expect(patches[0].id).toBe('b')
    expect(patches[0].patch.x).toBe(40)
  })

  test('D3: distribute vertical N=3 — same gap-equal math on y axis', () => {
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 0, 0, 10, 10),
        makeCustomImage('b', 0, 30, 10, 10),
        makeCustomImage('c', 0, 80, 10, 10),
      ],
    })
    const patches = distributeElements(slide, ['a', 'b', 'c'], 'vertical')
    expect(patches.length).toBe(1)
    expect(patches[0].id).toBe('b')
    expect(patches[0].patch.y).toBe(40)
  })

  test('D4: distribute horizontal N=4 — all 3 inner gaps equal within ±1 epsilon', () => {
    // widths [10,10,10,10], x=[0, 20, 60, 90]
    //   total_inner_span = (90 + 10) - 0 - 40 = 60
    //   gap = 60 / 3 = 20
    //   ids in order: a,b,c,d
    //   b.x = 0 + 10 + 20 = 30
    //   c.x = 0 + 20 + 40 = 60
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 0, 0, 10, 10),
        makeCustomImage('b', 20, 0, 10, 10),
        makeCustomImage('c', 60, 0, 10, 10),
        makeCustomImage('d', 90, 0, 10, 10),
      ],
    })
    const patches = distributeElements(slide, ['a', 'b', 'c', 'd'], 'horizontal')
    expect(patches.length).toBe(2)
    const b = findPatch(patches, 'b')!
    const c = findPatch(patches, 'c')!
    expect(b.patch.x).toBe(30)
    expect(c.patch.x).toBe(60)
    // Verify equal-gap invariant: gap_a-b == gap_b-c == gap_c-d
    const a_end = 0 + 10 // first pinned at 0, width 10
    const d_start = 90  // last pinned at 90
    const gap1 = (b.patch.x as number) - a_end
    const gap2 = (c.patch.x as number) - ((b.patch.x as number) + 10)
    const gap3 = d_start - ((c.patch.x as number) + 10)
    expect(Math.abs(gap1 - gap2)).toBeLessThanOrEqual(1)
    expect(Math.abs(gap2 - gap3)).toBeLessThanOrEqual(1)
  })

  test('D5: distribute integer rounding — non-integer gap math rounds to integers', () => {
    // widths sum = 31 (10 + 11 + 10), span = 100, inner_span = 100 - 31 = 69 → gap = 34.5
    // first ends at 10; middle.x = 10 + 34.5 = 44.5 → Math.round → 44 or 45
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 0, 0, 10, 10),
        makeCustomImage('m', 30, 0, 11, 10),
        makeCustomImage('z', 90, 0, 10, 10),
      ],
    })
    const patches = distributeElements(slide, ['a', 'm', 'z'], 'horizontal')
    expect(patches.length).toBe(1)
    expect(patches[0].id).toBe('m')
    expect(Number.isInteger(patches[0].patch.x as number)).toBe(true)
    // Banker's rounding aside, JS Math.round(44.5) → 45.
    expect(patches[0].patch.x).toBe(45)
  })

  test('D6: distribute with locked + watermark — both filtered out of candidates; only inner non-locked-non-watermark gets a patch', () => {
    // ids: [a, b (locked), c, d, w_0]
    // After filter (locked + watermark + structural-anchor excluded), candidates: [a, c, d]
    // widths [10,10,10], x=[0, 30, 90] (b at 30 ignored, c-pos used)
    //   inner_span = 100 - 30 = 70; gap = 35; c.x = 0 + 10 + 35 = 45
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 0, 0, 10, 10),
        makeCustomImage('b', 30, 0, 10, 10, { locked: true }),
        makeCustomImage('c', 50, 0, 10, 10),
        makeCustomImage('d', 90, 0, 10, 10),
      ],
      watermark: makeWatermark('w_0', 'bottom-right'),
    })
    const patches = distributeElements(
      slide,
      ['a', 'b', 'c', 'd', 'w_0'],
      'horizontal',
    )
    // Candidates after filter: [a, c, d]; outermost two (a, d) pinned; only c gets a patch.
    expect(patches.length).toBe(1)
    expect(patches[0].id).toBe('c')
    expect(patches[0].patch.x).toBe(45)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Purity invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('align module — purity invariant', () => {
  test('D7: source file imports no React, no DOM, no use-client', () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/lib/editor/transforms/align.ts',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    expect(src).not.toMatch(/from ['"]react['"]/)
    expect(src).not.toMatch(/['"]use client['"]/)
    expect(src).not.toMatch(/document\.|window\./)
  })

  test('D8: align.ts contains Math.round at each rounding site (>=4)', () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/lib/editor/transforms/align.ts',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    const matches = src.match(/Math\.round/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(4)
  })
})

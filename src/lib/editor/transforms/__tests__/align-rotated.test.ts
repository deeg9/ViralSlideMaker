import { describe, test, expect } from 'vitest'
import type {
  Slide,
  Decoration,
  IconDecoration,
  ShapeDecoration,
} from '@/lib/types/slide'
import {
  alignElements,
  distributeElements,
} from '@/lib/editor/transforms/align'

/**
 * Phase 72 Plan 01 (ROTATE-04, EDITOR-07): rotation-aware alignment math
 * tests. alignElements + distributeElements must consume the rotation-aware
 * AABB envelope when a decoration carries a rotation field — so a 45°-rotated
 * decoration's visible footprint snaps to the alignment edge, not the
 * un-rotated position.x / position.y.
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

describe('alignElements + distributeElements — rotation-aware decoration extension', () => {
  test('Test 17: alignElements left on a 45°-rotated decoration uses rotation-aware AABB.x', () => {
    // 10x10 square at (50, 50) rotated 45° → AABB x = 55 - sqrt(2)*5 ≈ 47.93
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 50, y: 50, width: 10, height: 10 }, { rotation: 45 }),
      ],
    })
    // target='canvas' → rect = (0, 0, 100, 100). 'left' patches x to rect.x = 0.
    const patches = alignElements(slide, ['d1'], 'left', 'canvas')
    expect(patches.length).toBe(1)
    expect(patches[0].patch.x).toBe(0)
  })

  test('Test 18: alignElements right on a 45°-rotated decoration uses rotated width for new x', () => {
    // 10x10 square rotated 45° → AABB width = sqrt(2)*10 ≈ 14.142.
    // canvas 'right' → new x = round(0 + 100 - sqrt(2)*10) = round(85.858) = 86
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 50, y: 50, width: 10, height: 10 }, { rotation: 45 }),
      ],
    })
    const patches = alignElements(slide, ['d1'], 'right', 'canvas')
    expect(patches.length).toBe(1)
    expect(patches[0].patch.x).toBe(Math.round(100 - Math.sqrt(2) * 10))
  })

  test('Test 19: alignElements center-h on a 45°-rotated decoration centers the ROTATED width', () => {
    // 10x10 square rotated 45° → AABB width = sqrt(2)*10. Canvas center-h:
    // new x = round(0 + 50 - sqrt(2)*10/2) = round(50 - sqrt(2)*5) = round(42.93) = 43
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d1', { x: 50, y: 50, width: 10, height: 10 }, { rotation: 45 }),
      ],
    })
    const patches = alignElements(slide, ['d1'], 'center-h', 'canvas')
    expect(patches.length).toBe(1)
    expect(patches[0].patch.x).toBe(Math.round(50 - (Math.sqrt(2) * 10) / 2))
  })

  test('Test 20: distributeElements horizontal across 3 decorations rotated 0/45/90 sorts by ROTATED-AABB x', () => {
    // d-A at x=0 (rot 0)        → AABB x = 0,   width = 10  → end = 10
    // d-B at x=50 (rot 45)      → AABB x ≈ 47.93, width ≈ 14.14 → end ≈ 62.07
    // d-C at x=80 (rot 90)      → AABB x = 80,  width = 10  → end = 90
    // sorted by AABB x: A, B, C. Outermost two pinned (A and C). Inner (B)
    // receives the gap-equal patch.
    const slide = makeSlideD({
      decorations: [
        makeIconDec('d-A', { x: 0, y: 0, width: 10, height: 10 }, { rotation: 0 }),
        makeIconDec('d-B', { x: 50, y: 0, width: 10, height: 10 }, { rotation: 45 }),
        makeIconDec('d-C', { x: 80, y: 0, width: 10, height: 10 }, { rotation: 90 }),
      ],
    })
    const patches = distributeElements(slide, ['d-A', 'd-B', 'd-C'], 'horizontal')
    // Only the inner candidate (d-B) receives a patch.
    expect(patches.length).toBe(1)
    expect(patches[0].id).toBe('d-B')
    // Gap math: total span = 90 - 0 = 90; sumSizes = 10 + sqrt(2)*10 + 10 = 20 + 14.142 = 34.142
    // gap = (90 - 34.142) / 2 = 27.929. inner cursor starts at 0 + 10 = 10.
    // newPos for d-B = round(10 + 27.929) = round(37.929) = 38.
    expect(patches[0].patch.x).toBe(Math.round(10 + (90 - (20 + Math.sqrt(2) * 10)) / 2))
  })

  test('Test 21: locked rotated decoration excluded from move (ALIGN-10) — no AlignPatch returned for the locked id', () => {
    const slide = makeSlideD({
      decorations: [
        makeIconDec(
          'd-locked',
          { x: 50, y: 50, width: 10, height: 10 },
          { rotation: 45, locked: true },
        ),
        makeShapeDec(
          'd-movable',
          { x: 60, y: 60, width: 10, height: 10 },
          { rotation: 0 },
        ),
      ],
    })
    const patches = alignElements(slide, ['d-locked', 'd-movable'], 'left', 'canvas')
    // Only d-movable receives a patch; d-locked is filtered out by ALIGN-10.
    expect(patches.length).toBe(1)
    expect(patches[0].id).toBe('d-movable')
  })
})

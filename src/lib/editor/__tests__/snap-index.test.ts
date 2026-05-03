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
  buildSnapIndex,
  findNearestSnap,
  snapWithHysteresis,
  SNAP_THRESHOLD_ENTER,
  SNAP_THRESHOLD_EXIT,
  type SnapIndex,
  type EdgeEntry,
} from '@/lib/editor/transforms/snap-index'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers (mirrors selection-bounds.test.ts conventions)
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
  extras: Partial<Watermark> = {},
): Watermark {
  return { id, enabled: true, position, ...extras }
}

function makeSlide(
  opts: {
    text_boxes?: TextBox[]
    custom_images?: CustomImage[]
    watermark?: Watermark
  } = {},
): Slide {
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

function positions(edges: EdgeEntry[]): number[] {
  return edges.map((e) => e.pos)
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

describe('snap-index — exported thresholds', () => {
  test('SNAP_THRESHOLD_ENTER is 5 (SNAP-01)', () => {
    expect(SNAP_THRESHOLD_ENTER).toBe(5)
  })
  test('SNAP_THRESHOLD_EXIT is 7 (SNAP-10 asymmetric hysteresis)', () => {
    expect(SNAP_THRESHOLD_EXIT).toBe(7)
  })
  test('exit threshold is greater than enter threshold (hysteresis invariant)', () => {
    expect(SNAP_THRESHOLD_EXIT).toBeGreaterThan(SNAP_THRESHOLD_ENTER)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildSnapIndex
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSnapIndex — empty slide (SI-1)', () => {
  test('SI-1: empty slide returns canvas-only edges', () => {
    const slide = makeSlide()
    const idx = buildSnapIndex(slide, new Set())
    expect(positions(idx.xEdges)).toEqual([0, 540, 1080])
    expect(positions(idx.yEdges)).toEqual([0, 960, 1920])
  })

  test('SI-1b: canvas edges have correct kind + sourceId metadata', () => {
    const slide = makeSlide()
    const idx = buildSnapIndex(slide, new Set())
    // 0 and 1080 are canvas-edge; 540 is canvas-center
    const xByPos = new Map(idx.xEdges.map((e) => [e.pos, e]))
    expect(xByPos.get(0)?.kind).toBe('canvas-edge')
    expect(xByPos.get(540)?.kind).toBe('canvas-center')
    expect(xByPos.get(1080)?.kind).toBe('canvas-edge')
    for (const e of idx.xEdges) {
      expect(e.sourceId).toBe('canvas')
    }
    const yByPos = new Map(idx.yEdges.map((e) => [e.pos, e]))
    expect(yByPos.get(0)?.kind).toBe('canvas-edge')
    expect(yByPos.get(960)?.kind).toBe('canvas-center')
    expect(yByPos.get(1920)?.kind).toBe('canvas-edge')
  })
})

describe('buildSnapIndex — single custom_image (SI-2)', () => {
  test('SI-2: x=10%, y=20%, w=30%, h=10% emits sorted edges + canvas', () => {
    // 10% of 1080 = 108; 20% of 1920 = 384; 30% of 1080 = 324; 10% of 1920 = 192
    // X edges: [0, 108, 270 (108+162), 432 (108+324), 540, 1080]
    // Y edges: [0, 384, 480 (384+96), 576 (384+192), 960, 1920]
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 10, 20, 30, 10)],
    })
    const idx = buildSnapIndex(slide, new Set())
    expect(positions(idx.xEdges)).toEqual([0, 108, 270, 432, 540, 1080])
    expect(positions(idx.yEdges)).toEqual([0, 384, 480, 576, 960, 1920])
  })
})

describe('buildSnapIndex — excludeIds drops dragging element (SI-3)', () => {
  test('SI-3: excludeIds={imgId} → only canvas edges', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 10, 20, 30, 10)],
    })
    const idx = buildSnapIndex(slide, new Set(['img1']))
    expect(positions(idx.xEdges)).toEqual([0, 540, 1080])
    expect(positions(idx.yEdges)).toEqual([0, 960, 1920])
  })
})

describe('buildSnapIndex — multiple custom-anchor text boxes (SI-4)', () => {
  test('SI-4: each contributes 3 X-edges + 3 Y-edges; arrays sorted', () => {
    // tb1: x=20, y=30, w=30 → REF px x=216, y=576, w=324; height defaults to 0
    //   X edges: 216, 378 (216+162), 540 (216+324)
    //   Y edges: 576 (3 copies — height=0 collapses)
    // tb2: x=50, y=60, w=20 → REF px x=540, y=1152, w=216; height 0
    //   X edges: 540, 648 (540+108), 756 (540+216)
    //   Y edges: 1152 (x3)
    const slide = makeSlide({
      text_boxes: [
        makeCustomTextBox('tb1', 20, 30, 30),
        makeCustomTextBox('tb2', 50, 60, 20),
      ],
    })
    const idx = buildSnapIndex(slide, new Set())
    // Expected X positions sorted (with canvas edges):
    // [0, 216, 378, 540, 540, 648, 756, 1080]
    expect(positions(idx.xEdges)).toEqual([
      0, 216, 378, 540, 540, 648, 756, 1080,
    ])
    // Expected Y positions sorted (576 x3 + 1152 x3 + canvas 0/960/1920)
    expect(positions(idx.yEdges)).toEqual([
      0, 576, 576, 576, 960, 1152, 1152, 1152, 1920,
    ])
    // Sorted invariant: non-decreasing
    for (let i = 1; i < idx.xEdges.length; i++) {
      expect(idx.xEdges[i].pos).toBeGreaterThanOrEqual(idx.xEdges[i - 1].pos)
    }
    for (let i = 1; i < idx.yEdges.length; i++) {
      expect(idx.yEdges[i].pos).toBeGreaterThanOrEqual(idx.yEdges[i - 1].pos)
    }
  })
})

describe('buildSnapIndex — structural-anchor TextBox (SI-5)', () => {
  test('SI-5: anchor !== "custom" SKIPPED — no x/y/width to extract (Phase 60 known gap)', () => {
    const slide = makeSlide({
      text_boxes: [makeStructuralTextBox('tb1', 'top')],
    })
    const idx = buildSnapIndex(slide, new Set())
    // No element edges added — only canvas edges
    expect(positions(idx.xEdges)).toEqual([0, 540, 1080])
    expect(positions(idx.yEdges)).toEqual([0, 960, 1920])
  })
})

describe('buildSnapIndex — watermark (SI-6)', () => {
  test('SI-6a: top-left watermark contributes edges based on enum mapping', () => {
    // top-left → x=0%, y=0%; size = 18% × 5% (placeholder, matches Plan 63-01)
    // X edges: 0 (left), 97.2 (center: 0+97.2), 194.4 (right: 0+194.4)
    // Y edges: 0 (top), 48 (center: 0+48), 96 (bottom: 0+96)
    const slide = makeSlide({ watermark: makeWatermark('w1', 'top-left') })
    const idx = buildSnapIndex(slide, new Set())
    const xPositions = positions(idx.xEdges)
    expect(xPositions).toContain(0)
    expect(xPositions).toContain(540)
    expect(xPositions).toContain(1080)
    // Should also contain element edges from the watermark
    expect(idx.xEdges.some((e) => e.sourceId === 'w1')).toBe(true)
    expect(idx.yEdges.some((e) => e.sourceId === 'w1')).toBe(true)
  })

  test('SI-6b: bottom-right watermark contributes edges with proper offsets', () => {
    // bottom-right → x=82%, y=95% origin (size 18%×5%)
    // x: 82% of 1080 = 885.6; y: 95% of 1920 = 1824
    // X edges: 885.6 (left), 982.8 (center: 885.6+97.2), 1080 (right: 885.6+194.4)
    // Y edges: 1824 (top), 1872 (center: 1824+48), 1920 (bottom: 1824+96)
    const slide = makeSlide({ watermark: makeWatermark('w1', 'bottom-right') })
    const idx = buildSnapIndex(slide, new Set())
    const wmXEdges = idx.xEdges.filter((e) => e.sourceId === 'w1')
    const wmYEdges = idx.yEdges.filter((e) => e.sourceId === 'w1')
    expect(wmXEdges.length).toBe(3)
    expect(wmYEdges.length).toBe(3)
  })

  test('SI-6c: bottom-left watermark mapped correctly', () => {
    const slide = makeSlide({ watermark: makeWatermark('w1', 'bottom-left') })
    const idx = buildSnapIndex(slide, new Set())
    const wmXEdges = idx.xEdges.filter((e) => e.sourceId === 'w1')
    const wmYEdges = idx.yEdges.filter((e) => e.sourceId === 'w1')
    // bottom-left: x=0%, y=95% — left edge should be at 0
    expect(wmXEdges.map((e) => e.pos)).toContain(0)
    // y=95% of 1920 = 1824 — top edge should be at 1824
    expect(wmYEdges.map((e) => e.pos)).toContain(1824)
  })

  test('SI-6d: watermark in excludeIds drops watermark edges', () => {
    const slide = makeSlide({ watermark: makeWatermark('w1', 'bottom-right') })
    const idx = buildSnapIndex(slide, new Set(['w1']))
    expect(idx.xEdges.every((e) => e.sourceId !== 'w1')).toBe(true)
    expect(idx.yEdges.every((e) => e.sourceId !== 'w1')).toBe(true)
  })
})

describe('buildSnapIndex — locked elements included (SI-7)', () => {
  test('SI-7: locked elements ARE valid snap targets (Figma rule)', () => {
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('img1', 10, 20, 30, 10, { locked: true }),
      ],
    })
    const idx = buildSnapIndex(slide, new Set())
    // Same expected positions as SI-2 — locked included
    expect(positions(idx.xEdges)).toEqual([0, 108, 270, 432, 540, 1080])
    expect(positions(idx.yEdges)).toEqual([0, 384, 480, 576, 960, 1920])
  })
})

describe('buildSnapIndex — sorted invariant (SI-8)', () => {
  test('SI-8: xEdges and yEdges are non-decreasing across many elements', () => {
    const slide = makeSlide({
      custom_images: Array.from({ length: 20 }, (_, i) =>
        makeCustomImage(`img-${i}`, (i * 7) % 90, (i * 11) % 90, 5, 5),
      ),
    })
    const idx = buildSnapIndex(slide, new Set())
    for (let i = 1; i < idx.xEdges.length; i++) {
      expect(idx.xEdges[i].pos).toBeGreaterThanOrEqual(idx.xEdges[i - 1].pos)
    }
    for (let i = 1; i < idx.yEdges.length; i++) {
      expect(idx.yEdges[i].pos).toBeGreaterThanOrEqual(idx.yEdges[i - 1].pos)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// findNearestSnap
// ─────────────────────────────────────────────────────────────────────────────

function makeEdges(positions: number[]): EdgeEntry[] {
  return positions.map((pos, i) => ({
    pos,
    kind: 'canvas-edge' as const,
    sourceId: `s-${i}`,
  }))
}

describe('findNearestSnap — basic queries', () => {
  test('SI-9: exact match → snappedTo=540, delta=0', () => {
    const r = findNearestSnap(540, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(540)
    expect(r.delta).toBe(0)
  })

  test('SI-10: within threshold below → snappedTo=540, delta=3', () => {
    // value=537, edge=540, delta = 540-537 = 3
    const r = findNearestSnap(537, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(540)
    expect(r.delta).toBe(3)
  })

  test('SI-11: within threshold above → snappedTo=540, delta=-3', () => {
    // value=543, edge=540, delta = 540-543 = -3
    const r = findNearestSnap(543, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(540)
    expect(r.delta).toBe(-3)
  })

  test('SI-12: outside threshold → no snap', () => {
    const r = findNearestSnap(550, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(null)
    expect(r.delta).toBe(0)
  })
})

describe('findNearestSnap — binary search correctness (SI-13)', () => {
  test('SI-13: large edge array, query 401 → snappedTo=400 (proves O(log N) search)', () => {
    const edges = makeEdges([
      0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1080, 1300,
    ])
    const r = findNearestSnap(401, edges, 5)
    expect(r.snappedTo).toBe(400)
    expect(r.delta).toBe(-1)
  })

  test('SI-13b: query 599 → snappedTo=600', () => {
    const edges = makeEdges([
      0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1080, 1300,
    ])
    const r = findNearestSnap(599, edges, 5)
    expect(r.snappedTo).toBe(600)
    expect(r.delta).toBe(1)
  })

  test('SI-13c: query exactly between two edges (505 between 500 and 600 with threshold 5) → 500 (lower neighbor wins by tie order)', () => {
    const edges = makeEdges([0, 500, 600, 1080])
    const r = findNearestSnap(505, edges, 5)
    // delta-from-500 = -5; delta-from-600 = 95. 500 is the only one within threshold.
    expect(r.snappedTo).toBe(500)
    expect(r.delta).toBe(-5)
  })
})

describe('findNearestSnap — empty edges (SI-14)', () => {
  test('SI-14: empty array → no snap', () => {
    const r = findNearestSnap(540, [], 5)
    expect(r.snappedTo).toBe(null)
    expect(r.delta).toBe(0)
  })
})

describe('findNearestSnap — duplicate edges (SI-15)', () => {
  test('SI-15: 3 elements aligned at 540 → snaps to 540', () => {
    const edges = makeEdges([0, 540, 540, 540, 1080])
    const r = findNearestSnap(542, edges, 5)
    expect(r.snappedTo).toBe(540)
    expect(r.delta).toBe(-2)
  })

  test('SI-15b: many duplicates at the boundary', () => {
    const edges = makeEdges([0, 200, 200, 200, 200, 200, 1080])
    const r = findNearestSnap(199, edges, 5)
    expect(r.snappedTo).toBe(200)
  })
})

describe('findNearestSnap — boundary search (SI-22, SI-23)', () => {
  test('SI-22: query near min edge', () => {
    const r = findNearestSnap(2, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(0)
    expect(r.delta).toBe(-2)
  })

  test('SI-23: query near max edge', () => {
    const r = findNearestSnap(1078, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(1080)
    expect(r.delta).toBe(2)
  })

  test('SI-22b: query below all edges', () => {
    const r = findNearestSnap(-100, makeEdges([0, 540, 1080]), 5)
    // Below 0 by 100 — way outside threshold
    expect(r.snappedTo).toBe(null)
  })

  test('SI-23b: query above all edges', () => {
    const r = findNearestSnap(2000, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(null)
  })

  test('SI-22c: query at exact lower bound (0)', () => {
    const r = findNearestSnap(0, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(0)
    expect(r.delta).toBe(0)
  })

  test('SI-23c: query at exact upper bound (1080)', () => {
    const r = findNearestSnap(1080, makeEdges([0, 540, 1080]), 5)
    expect(r.snappedTo).toBe(1080)
    expect(r.delta).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// snapWithHysteresis
// ─────────────────────────────────────────────────────────────────────────────

describe('snapWithHysteresis — state machine (SI-16..SI-19)', () => {
  test('SI-16: enter snap (prev=null, delta=3 ≤ 5)', () => {
    const r = snapWithHysteresis(543, makeEdges([540]), null)
    expect(r.snapped).toBe(true)
    expect(r.snappedTo).toBe(540)
    expect(r.delta).toBe(-3)
    expect(r.nextWasSnapped).toBe(540)
  })

  test('SI-16b: do not enter (prev=null, delta=6 > 5 enter threshold)', () => {
    const r = snapWithHysteresis(546, makeEdges([540]), null)
    expect(r.snapped).toBe(false)
    expect(r.snappedTo).toBe(null)
    expect(r.delta).toBe(0)
    expect(r.nextWasSnapped).toBe(null)
  })

  test('SI-17: hold zone (prev=540, delta=6 between 5 and 7 → stay snapped)', () => {
    const r = snapWithHysteresis(546, makeEdges([540]), 540)
    expect(r.snapped).toBe(true)
    expect(r.snappedTo).toBe(540)
    expect(r.delta).toBe(-6)
    expect(r.nextWasSnapped).toBe(540)
  })

  test('SI-17b: hold zone exact at exit threshold (delta=7)', () => {
    const r = snapWithHysteresis(547, makeEdges([540]), 540)
    expect(r.snapped).toBe(true)
    expect(r.snappedTo).toBe(540)
    expect(r.delta).toBe(-7)
    expect(r.nextWasSnapped).toBe(540)
  })

  test('SI-18: exit (prev=540, delta=8 > 7 → release)', () => {
    const r = snapWithHysteresis(548, makeEdges([540]), 540)
    expect(r.snapped).toBe(false)
    expect(r.snappedTo).toBe(null)
    expect(r.delta).toBe(0)
    expect(r.nextWasSnapped).toBe(null)
  })

  test('SI-19: re-enter different edge after exit', () => {
    // prev=540, query=1077: delta from 540 is 537 (way outside hold);
    // fresh search finds 1080 within threshold (delta = 3).
    const r = snapWithHysteresis(1077, makeEdges([540, 1080]), 540)
    expect(r.snapped).toBe(true)
    expect(r.snappedTo).toBe(1080)
    expect(r.delta).toBe(3)
    expect(r.nextWasSnapped).toBe(1080)
  })

  test('SI-19b: exit with no nearby new edge → fully released', () => {
    // prev=540, query=600: delta from 540 is 60, way outside hold;
    // fresh search at 600 with edges=[540, 1080] — neither within threshold.
    const r = snapWithHysteresis(600, makeEdges([540, 1080]), 540)
    expect(r.snapped).toBe(false)
    expect(r.snappedTo).toBe(null)
    expect(r.nextWasSnapped).toBe(null)
  })
})

describe('snapWithHysteresis — per-axis independence (SI-20)', () => {
  test('SI-20: helper takes scalar wasSnapped, returns scalar nextWasSnapped (per-axis)', () => {
    // The contract: wasSnappedX and wasSnappedY are tracked SEPARATELY by callers.
    // Each call to snapWithHysteresis touches one axis only.
    const rX = snapWithHysteresis(543, makeEdges([540]), null)
    const rY = snapWithHysteresis(963, makeEdges([960]), null)
    // Both axes can independently snap or not — the helper does not bundle them.
    expect(typeof rX.nextWasSnapped === 'number' || rX.nextWasSnapped === null).toBe(true)
    expect(typeof rY.nextWasSnapped === 'number' || rY.nextWasSnapped === null).toBe(true)
    expect(rX.nextWasSnapped).toBe(540)
    expect(rY.nextWasSnapped).toBe(960)
  })

  test('SI-20b: caller can hold X snap while Y exits', () => {
    // Simulate per-axis: X stays in hold zone (delta=6, prev=540)
    // Y has moved out of hold (delta=8, prev=960)
    const rX = snapWithHysteresis(546, makeEdges([540]), 540)
    const rY = snapWithHysteresis(968, makeEdges([960]), 960)
    expect(rX.snapped).toBe(true)
    expect(rY.snapped).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Multi-axis bbox query convention (SI-24)
// ─────────────────────────────────────────────────────────────────────────────

describe('findNearestSnap — multi-axis bbox query (SI-24)', () => {
  test('SI-24: caller queries left/center/right against xEdges independently', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('img1', 10, 20, 30, 10)],
    })
    const idx = buildSnapIndex(slide, new Set(['drag-id']))
    // bbox left=535, center=540, right=545 (drag-id is excluded; check vs 540 canvas-center)
    const left = findNearestSnap(535, idx.xEdges, 5)
    const center = findNearestSnap(540, idx.xEdges, 5)
    const right = findNearestSnap(545, idx.xEdges, 5)
    expect(left.snappedTo).toBe(540) // delta 5
    expect(center.snappedTo).toBe(540) // delta 0
    expect(right.snappedTo).toBe(540) // delta -5
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Group-aware exclude (SI-25)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSnapIndex — multi-id exclude (SI-25)', () => {
  test('SI-25: excludeIds with multiple ids drops all of them', () => {
    const slide = makeSlide({
      custom_images: [
        makeCustomImage('a', 10, 10, 10, 10),
        makeCustomImage('b', 30, 30, 10, 10),
        makeCustomImage('c', 50, 50, 10, 10),
      ],
    })
    const idx = buildSnapIndex(slide, new Set(['a', 'b']))
    // a + b excluded; only c contributes element edges
    const elementEdges = idx.xEdges.filter(
      (e) => e.sourceId !== 'canvas',
    )
    expect(elementEdges.every((e) => e.sourceId === 'c')).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// % to REF px conversion (SI-26)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSnapIndex — percentage to reference pixel conversion (SI-26)', () => {
  test('SI-26: TextBox at position.x=10 (%) becomes 108 (REF px)', () => {
    const slide = makeSlide({
      text_boxes: [makeCustomTextBox('tb1', 10, 0, 50)],
    })
    const idx = buildSnapIndex(slide, new Set())
    // The 10% should produce a left edge at exactly 108
    const elementEdges = idx.xEdges.filter((e) => e.sourceId === 'tb1')
    expect(elementEdges.map((e) => e.pos)).toContain(108)
  })

  test('SI-26b: custom canvas dims override the conversion factor', () => {
    const slide = makeSlide({
      custom_images: [makeCustomImage('i', 50, 50, 10, 10)],
    })
    const idx = buildSnapIndex(slide, new Set(), 2160, 3840)
    // 50% of 2160 = 1080; canvas right = 2160; canvas center-x = 1080
    expect(positions(idx.xEdges)).toContain(2160)
    expect(positions(idx.xEdges)).toContain(1080)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SI-21: Purity static check
// ─────────────────────────────────────────────────────────────────────────────

describe('snap-index — purity (SI-21)', () => {
  test('SI-21: source has no React, no DOM, no use-client directive', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../transforms/snap-index.ts'),
      'utf8',
    )
    // Strip line comments and block comments to avoid false positives in JSDoc
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n')
    expect(stripped).not.toMatch(/from\s+['"]react['"]/)
    expect(stripped).not.toMatch(/['"]use client['"]/)
    expect(stripped).not.toMatch(/\bdocument\./)
    expect(stripped).not.toMatch(/\bwindow\./)
  })
})

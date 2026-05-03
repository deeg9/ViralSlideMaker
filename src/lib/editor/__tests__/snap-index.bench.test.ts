/**
 * Phase 63 Plan 03 — Performance bench for snap-index (PERF-05 contract).
 *
 * Guards against future regressions in the snap query path. If a test here
 * fails, snap-index correctness or efficiency was likely lost — investigate
 * the algorithm; do NOT relax the threshold.
 *
 * Budgets:
 *   - PB1: build at N=30 < 0.5ms median
 *   - PB2: single findNearestSnap query < 0.05ms median (1000 iterations)
 *   - PB3: 6-query pointer-tick (3 X + 3 Y) at N=30 < 2ms median (60 ticks)
 *   - PB4: same as PB3 but through snapWithHysteresis < 2ms median
 *
 * Performance assertions use performance.now() deltas. Iterations amortize
 * V8 noise; median (sorted[Math.floor(n/2)]) — not max — is the assertion
 * statistic. If CI flakes, raise iteration count, NOT the budget.
 */

import { describe, test, expect } from 'vitest'
import type { Slide, CustomImage } from '@/lib/types/slide'
import {
  buildSnapIndex,
  findNearestSnap,
  snapWithHysteresis,
} from '@/lib/editor/transforms/snap-index'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture: 30 deterministic custom_images
// ─────────────────────────────────────────────────────────────────────────────

const benchSlide: Slide = {
  hook_text: '',
  body_text: '',
  image_query: '',
  is_cta: false,
  background_url: null,
  pexels_photo_id: null,
  custom_images: Array.from(
    { length: 30 },
    (_, i): CustomImage => ({
      id: `img-${i}`,
      url: '',
      x: (i * 7) % 90, // 0, 7, 14, ... 84, 7 ...
      y: (i * 11) % 90,
      width: 5,
      height: 5,
    }),
  ),
}

function median(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// ─────────────────────────────────────────────────────────────────────────────
// PB1 — buildSnapIndex cost (one-time per onDragStart)
// ─────────────────────────────────────────────────────────────────────────────

describe('snap-index perf — buildSnapIndex (PB1)', () => {
  test('PB1: build at N=30 < 0.5ms median', () => {
    const iterations = 100
    const times: number[] = []
    // Warm-up — let V8 JIT settle
    for (let i = 0; i < 20; i++) buildSnapIndex(benchSlide, new Set(['img-0']))
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now()
      buildSnapIndex(benchSlide, new Set(['img-0']))
      times.push(performance.now() - t0)
    }
    const m = median(times)
    expect(m).toBeLessThan(0.5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PB2 — single findNearestSnap query
// ─────────────────────────────────────────────────────────────────────────────

describe('snap-index perf — findNearestSnap single query (PB2)', () => {
  test('PB2: single query < 0.05ms median (1000 iterations)', () => {
    const idx = buildSnapIndex(benchSlide, new Set(['img-0']))
    // Warm-up
    for (let i = 0; i < 100; i++) findNearestSnap(540, idx.xEdges, 5)
    const iterations = 1000
    const times: number[] = []
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now()
      findNearestSnap(540 + (i % 100) - 50, idx.xEdges, 5)
      times.push(performance.now() - t0)
    }
    const m = median(times)
    expect(m).toBeLessThan(0.05)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PB3 — full pointer-tick (PERF-05 contract: 6 queries < 2ms)
// ─────────────────────────────────────────────────────────────────────────────

describe('snap-index perf — full pointer-tick (PB3, PERF-05)', () => {
  test('PB3: 6 findNearestSnap queries per tick < 2ms median over 60 ticks', () => {
    const idx = buildSnapIndex(benchSlide, new Set(['img-0']))
    const dragLeft = 200,
      dragCenterX = 230,
      dragRight = 260
    const dragTop = 400,
      dragCenterY = 430,
      dragBottom = 460
    // Warm-up
    for (let i = 0; i < 20; i++) {
      findNearestSnap(dragLeft, idx.xEdges, 5)
      findNearestSnap(dragCenterX, idx.xEdges, 5)
      findNearestSnap(dragRight, idx.xEdges, 5)
      findNearestSnap(dragTop, idx.yEdges, 5)
      findNearestSnap(dragCenterY, idx.yEdges, 5)
      findNearestSnap(dragBottom, idx.yEdges, 5)
    }
    const ticks = 60
    const times: number[] = []
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now()
      findNearestSnap(dragLeft + i, idx.xEdges, 5)
      findNearestSnap(dragCenterX + i, idx.xEdges, 5)
      findNearestSnap(dragRight + i, idx.xEdges, 5)
      findNearestSnap(dragTop + i, idx.yEdges, 5)
      findNearestSnap(dragCenterY + i, idx.yEdges, 5)
      findNearestSnap(dragBottom + i, idx.yEdges, 5)
      times.push(performance.now() - t0)
    }
    const m = median(times)
    expect(m).toBeLessThan(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PB4 — same tick budget but through snapWithHysteresis
// ─────────────────────────────────────────────────────────────────────────────

describe('snap-index perf — full pointer-tick via hysteresis (PB4)', () => {
  test('PB4: 6 snapWithHysteresis calls per tick < 2ms median over 60 ticks', () => {
    const idx = buildSnapIndex(benchSlide, new Set(['img-0']))
    const dragLeft = 200,
      dragCenterX = 230,
      dragRight = 260
    const dragTop = 400,
      dragCenterY = 430,
      dragBottom = 460
    // Warm-up
    for (let i = 0; i < 20; i++) {
      snapWithHysteresis(dragLeft, idx.xEdges, null)
      snapWithHysteresis(dragCenterX, idx.xEdges, null)
      snapWithHysteresis(dragRight, idx.xEdges, null)
      snapWithHysteresis(dragTop, idx.yEdges, null)
      snapWithHysteresis(dragCenterY, idx.yEdges, null)
      snapWithHysteresis(dragBottom, idx.yEdges, null)
    }
    const ticks = 60
    const times: number[] = []
    let prevX: number | null = null
    let prevY: number | null = null
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now()
      const r1 = snapWithHysteresis(dragLeft + i, idx.xEdges, prevX)
      snapWithHysteresis(dragCenterX + i, idx.xEdges, prevX)
      snapWithHysteresis(dragRight + i, idx.xEdges, prevX)
      const r4 = snapWithHysteresis(dragTop + i, idx.yEdges, prevY)
      snapWithHysteresis(dragCenterY + i, idx.yEdges, prevY)
      snapWithHysteresis(dragBottom + i, idx.yEdges, prevY)
      times.push(performance.now() - t0)
      prevX = r1.nextWasSnapped
      prevY = r4.nextWasSnapped
    }
    const m = median(times)
    expect(m).toBeLessThan(2)
  })
})

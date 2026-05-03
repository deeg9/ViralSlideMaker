/**
 * Phase 63 Plan 05 — End-to-end PERF-05 integration verification + legacy
 * deprecation gates (DEP1 + DEP2).
 *
 * Plan 63-03's bench (snap-index.bench.test.ts) is unit-level — it measures
 * findNearestSnap and snapWithHysteresis in isolation. THIS file mounts a
 * full integration tick that mirrors slide-preview.tsx's runSnapForDrag
 * closure (Plan 63-04 wiring): modifier check + 3 X-edges + 3 Y-edges +
 * detectEqualSpacing for both axes — the budget < 2ms median (PERF-05).
 *
 * Why two tests for PERF-05 (unit + integration)?
 *   - Unit (Plan 63-03 PB3/PB4): catches algorithmic regressions in the
 *     snap math itself.
 *   - Integration (PI1 here): catches when a future plan adds a heavier
 *     helper inside the onDrag pipeline (e.g., a non-O(1) DOM read, a sync
 *     fetch, an unmemoized object spread). The unit bench would still pass
 *     but the user-visible drag would judder at N=30.
 *
 * Budgets:
 *   - PI1: full integration tick at N=30 < 2ms median (PERF-05 contract)
 *   - PI2: Hold-Cmd path is sub-0.1ms (early-out is a single ref read)
 *   - PI3: tick-time consistency — max < 3× median (no allocation churn)
 *
 * DEP gates (legacy `use-alignment-guides.ts`):
 *   - DEP1: file carries an `@deprecated` JSDoc tag pointing to snap-index.ts
 *   - DEP2: zero production code (non-test, non-self) imports the legacy hook
 */

import { describe, test, expect } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import path from 'path'
import type { Slide, CustomImage } from '@/lib/types/slide'
import {
  buildSnapIndex,
  snapWithHysteresis,
} from '@/lib/editor/transforms/snap-index'
import { detectEqualSpacing } from '@/lib/editor/transforms/equal-spacing'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture: 30 deterministic custom_images mirroring snap-index.bench.test.ts
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
      x: (i * 7) % 90,
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

/**
 * Mirror of slide-preview.tsx's runSnapForDrag closure (Plan 63-04). Every
 * onDrag tick runs THIS pipeline:
 *   1. modifier check (caller-provided ref)
 *   2. 3 X-axis snapWithHysteresis queries (left, center-h, right edges)
 *   3. 3 Y-axis snapWithHysteresis queries (top, center-v, bottom edges)
 *   4. detectEqualSpacing on slide elements (X axis)
 *   5. detectEqualSpacing on slide elements (Y axis)
 *
 * Returns the snap result + new hysteresis state. Caller maintains the
 * wasSnapped scalars across ticks (matches Plan 63-04 behavior).
 */
interface IntegrationTickResult {
  snappedX: number
  snappedY: number
  nextWasSnappedX: number | null
  nextWasSnappedY: number | null
}

function integrationTick(
  cmdHeld: boolean,
  idx: ReturnType<typeof buildSnapIndex>,
  xLeft: number,
  yTop: number,
  width: number,
  height: number,
  prevWasSnappedX: number | null,
  prevWasSnappedY: number | null,
  slideElements: Array<{ id: string; x: number; y: number; width: number; height: number }>,
): IntegrationTickResult {
  // Step 1: Hold-Cmd disable (SNAP-05). Early-out matches Plan 63-04.
  if (cmdHeld) {
    return {
      snappedX: xLeft,
      snappedY: yTop,
      nextWasSnappedX: null,
      nextWasSnappedY: null,
    }
  }

  // Step 2: 3 X-axis candidate edges (left, center-h, right). Best-of-3.
  const xCenter = xLeft + width / 2
  const xRight = xLeft + width
  const rxL = snapWithHysteresis(xLeft, idx.xEdges, prevWasSnappedX)
  const rxC = snapWithHysteresis(xCenter, idx.xEdges, prevWasSnappedX)
  const rxR = snapWithHysteresis(xRight, idx.xEdges, prevWasSnappedX)
  let bestXDelta = 0
  let bestXSnapped: number | null = null
  for (const r of [rxL, rxC, rxR]) {
    if (r.snapped && (bestXSnapped === null || Math.abs(r.delta) < Math.abs(bestXDelta))) {
      bestXDelta = r.delta
      bestXSnapped = r.nextWasSnapped
    }
  }

  // Step 3: 3 Y-axis candidate edges (top, center-v, bottom). Best-of-3.
  const yCenter = yTop + height / 2
  const yBottom = yTop + height
  const ryT = snapWithHysteresis(yTop, idx.yEdges, prevWasSnappedY)
  const ryC = snapWithHysteresis(yCenter, idx.yEdges, prevWasSnappedY)
  const ryB = snapWithHysteresis(yBottom, idx.yEdges, prevWasSnappedY)
  let bestYDelta = 0
  let bestYSnapped: number | null = null
  for (const r of [ryT, ryC, ryB]) {
    if (r.snapped && (bestYSnapped === null || Math.abs(r.delta) < Math.abs(bestYDelta))) {
      bestYDelta = r.delta
      bestYSnapped = r.nextWasSnapped
    }
  }

  // Step 4 + 5: equal-spacing detection across both axes.
  detectEqualSpacing(
    slideElements.map((e) => ({ id: e.id, pos: e.x, size: e.width })),
  )
  detectEqualSpacing(
    slideElements.map((e) => ({ id: e.id, pos: e.y, size: e.height })),
  )

  return {
    snappedX: xLeft + bestXDelta,
    snappedY: yTop + bestYDelta,
    nextWasSnappedX: bestXSnapped,
    nextWasSnappedY: bestYSnapped,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PI1 — full integration tick budget at N=30 (PERF-05 integration contract)
// ─────────────────────────────────────────────────────────────────────────────

describe('PERF-05 integration — full onDrag tick at N=30 (PI1)', () => {
  test('PI1: 60 ticks each running modifier-check + 3 X-snaps + 3 Y-snaps + 2 detectEqualSpacing — median < 2ms', () => {
    const idx = buildSnapIndex(benchSlide, new Set(['img-0']))
    const elements = (benchSlide.custom_images ?? []).map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
    }))

    // Warm-up — let V8 JIT settle.
    let warmX: number | null = null
    let warmY: number | null = null
    for (let i = 0; i < 20; i++) {
      const r = integrationTick(false, idx, 200, 400, 5, 5, warmX, warmY, elements)
      warmX = r.nextWasSnappedX
      warmY = r.nextWasSnappedY
    }

    const ticks = 60
    const times: number[] = []
    let prevX: number | null = null
    let prevY: number | null = null
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now()
      const r = integrationTick(
        false,
        idx,
        200 + i,
        400 + i,
        5,
        5,
        prevX,
        prevY,
        elements,
      )
      times.push(performance.now() - t0)
      prevX = r.nextWasSnappedX
      prevY = r.nextWasSnappedY
    }
    const m = median(times)
    expect(m).toBeLessThan(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PI2 — Hold-Cmd path is the fastest (single ref read + early return)
// ─────────────────────────────────────────────────────────────────────────────

describe('PERF-05 integration — Hold-Cmd disable path (PI2)', () => {
  test('PI2: 60 ticks with Cmd held — median < 0.1ms (early-out is a single branch)', () => {
    const idx = buildSnapIndex(benchSlide, new Set(['img-0']))
    const elements = (benchSlide.custom_images ?? []).map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
    }))

    // Warm-up.
    for (let i = 0; i < 20; i++) {
      integrationTick(true, idx, 200, 400, 5, 5, null, null, elements)
    }

    const ticks = 60
    const times: number[] = []
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now()
      integrationTick(true, idx, 200 + i, 400 + i, 5, 5, null, null, elements)
      times.push(performance.now() - t0)
    }
    const m = median(times)
    expect(m).toBeLessThan(0.1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PI3 — tick-time consistency (no allocation churn / V8 hidden-class issues)
// ─────────────────────────────────────────────────────────────────────────────

describe('PERF-05 integration — tick-time consistency (PI3)', () => {
  test('PI3: max tick < 3× median (no allocation churn / V8 hidden-class transitions)', () => {
    const idx = buildSnapIndex(benchSlide, new Set(['img-0']))
    const elements = (benchSlide.custom_images ?? []).map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
    }))

    // Extended warm-up — settle V8 hidden classes first.
    let warmX: number | null = null
    let warmY: number | null = null
    for (let i = 0; i < 50; i++) {
      const r = integrationTick(false, idx, 200, 400, 5, 5, warmX, warmY, elements)
      warmX = r.nextWasSnappedX
      warmY = r.nextWasSnappedY
    }

    const ticks = 100
    const times: number[] = []
    let prevX: number | null = null
    let prevY: number | null = null
    for (let i = 0; i < ticks; i++) {
      const t0 = performance.now()
      const r = integrationTick(
        false,
        idx,
        200 + i,
        400 + i,
        5,
        5,
        prevX,
        prevY,
        elements,
      )
      times.push(performance.now() - t0)
      prevX = r.nextWasSnappedX
      prevY = r.nextWasSnappedY
    }
    const m = median(times)
    const max = Math.max(...times)
    // Consistency contract: max should not be wildly out of line with median.
    // A 3× ratio gives generous headroom for V8's stop-the-world GC pauses
    // while still catching genuine allocation churn (which would 5-10× the
    // tail in our experience). Use 0.05ms as a floor — performance.now()
    // resolution is itself ~10us so very-low medians can artifact this ratio.
    if (m > 0.05) {
      expect(max).toBeLessThan(m * 3)
    }
    // Always assert the absolute max is sane (well within PERF-05 budget).
    expect(max).toBeLessThan(5)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// DEP1 / DEP2 — Legacy `use-alignment-guides.ts` deprecation gates
// ─────────────────────────────────────────────────────────────────────────────

describe('Legacy deprecation gates (DEP1, DEP2)', () => {
  test('DEP1: src/hooks/use-alignment-guides.ts carries @deprecated marker pointing to snap-index.ts', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'src/hooks/use-alignment-guides.ts'),
      'utf-8',
    )
    expect(src).toMatch(/@deprecated/)
    // The migration pointer references the canonical replacement module.
    expect(src).toMatch(/snap-index\.ts/)
    // The Phase 66 deletion target is documented (so future readers know
    // who owns the cleanup).
    expect(src).toMatch(/Phase 66/i)
  })

  test('DEP2: zero production code (non-test, non-self) imports use-alignment-guides', () => {
    // Strategy: grep the entire src/ tree for the legacy module path. Filter
    // out the file itself + any __tests__ directory entries (which are the
    // legitimate "legacy contract regression" testbed). The result should
    // be EMPTY.
    let result = ''
    try {
      result = execSync(
        "grep -rn 'use-alignment-guides' src/ --include='*.ts' --include='*.tsx' | grep -v 'src/hooks/use-alignment-guides.ts' | grep -v '__tests__'",
        { encoding: 'utf-8' },
      )
    } catch {
      // grep returns non-zero exit when no matches found — that's the SUCCESS
      // case. The catch block leaves `result` as the empty string.
      result = ''
    }
    expect(result.trim()).toBe('')
  })
})

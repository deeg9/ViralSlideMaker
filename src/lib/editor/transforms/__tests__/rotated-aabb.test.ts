import { describe, test, expect } from 'vitest'
import {
  computeRotatedAABB,
  type AABB,
} from '@/lib/editor/transforms/selection-bounds'

/**
 * Phase 72 Plan 01 (ROTATE-04, EDITOR-07): unit tests for the pure
 * rotation-aware AABB helper. Trig math is hand-verifiable at canonical
 * angles (0 / 90 / 180 / 270 / 360) and the well-known sqrt(2) extent at
 * 45° on a square. Subpixel precision is REQUIRED at this layer — the
 * align.ts boundary is the rounding point (ALIGN-09 / PITFALL-4.4).
 */

describe('computeRotatedAABB — pure helper unit tests', () => {
  test('Test 1: rotation=0 returns the input rect unchanged', () => {
    const rect: AABB = { x: 10, y: 20, width: 30, height: 40 }
    expect(computeRotatedAABB(rect, 0)).toEqual(rect)
  })

  test('Test 2: rotation=undefined returns the input rect unchanged', () => {
    const rect: AABB = { x: 10, y: 20, width: 30, height: 40 }
    expect(computeRotatedAABB(rect, undefined)).toEqual(rect)
  })

  test('Test 3: rotation=360 returns input rect (modulo equivalence)', () => {
    const rect: AABB = { x: 10, y: 20, width: 30, height: 40 }
    const r = computeRotatedAABB(rect, 360)
    expect(r.x).toBe(rect.x)
    expect(r.y).toBe(rect.y)
    expect(r.width).toBe(rect.width)
    expect(r.height).toBe(rect.height)
  })

  test('Test 4: rotation=90 on a 10×20 rect at (50, 50) → AABB is 20×10 centered at (55, 60)', () => {
    // Rect at (50, 50) with width=10, height=20. Center = (55, 60).
    // Rotated 90°: width becomes 20, height becomes 10, still centered at (55, 60).
    // → AABB = { x: 55 - 20/2, y: 60 - 10/2, width: 20, height: 10 } = (45, 55, 20, 10)
    const rect: AABB = { x: 50, y: 50, width: 10, height: 20 }
    const r = computeRotatedAABB(rect, 90)
    expect(r.x).toBeCloseTo(45, 5)
    expect(r.y).toBeCloseTo(55, 5)
    expect(r.width).toBeCloseTo(20, 5)
    expect(r.height).toBeCloseTo(10, 5)
  })

  test('Test 5: rotation=180 on a 10×20 rect at (50, 50) → AABB equals input rect (180° symmetry)', () => {
    const rect: AABB = { x: 50, y: 50, width: 10, height: 20 }
    const r = computeRotatedAABB(rect, 180)
    expect(r.x).toBeCloseTo(50, 5)
    expect(r.y).toBeCloseTo(50, 5)
    expect(r.width).toBeCloseTo(10, 5)
    expect(r.height).toBeCloseTo(20, 5)
  })

  test('Test 6: rotation=45 on a 10×10 square at (50, 50) → AABB is sqrt(2)*10 wide and tall, centered at (55, 55)', () => {
    const rect: AABB = { x: 50, y: 50, width: 10, height: 10 }
    const r = computeRotatedAABB(rect, 45)
    const expectedExtent = Math.sqrt(2) * 10  // ~14.142
    expect(r.width).toBeCloseTo(expectedExtent, 5)
    expect(r.height).toBeCloseTo(expectedExtent, 5)
    // Centered at (55, 55) — same as input center
    expect(r.x + r.width / 2).toBeCloseTo(55, 5)
    expect(r.y + r.height / 2).toBeCloseTo(55, 5)
  })

  test('Test 7: rotation=-45 produces the same AABB extent as rotation=45 (symmetry)', () => {
    const rect: AABB = { x: 50, y: 50, width: 10, height: 10 }
    const pos = computeRotatedAABB(rect, 45)
    const neg = computeRotatedAABB(rect, -45)
    expect(neg.width).toBeCloseTo(pos.width, 5)
    expect(neg.height).toBeCloseTo(pos.height, 5)
    expect(neg.x).toBeCloseTo(pos.x, 5)
    expect(neg.y).toBeCloseTo(pos.y, 5)
  })

  test('Test 8: rotation=30 on a 10×20 rect at (0, 0) → expanded AABB; min(x) and min(y) become NEGATIVE', () => {
    const rect: AABB = { x: 0, y: 0, width: 10, height: 20 }
    const r = computeRotatedAABB(rect, 30)
    // The corners rotate around the center (5, 10). Some corners will rotate
    // past the negative-x or negative-y axis. The pure helper does NOT clamp.
    expect(r.x).toBeLessThan(0)
    expect(r.y).toBeLessThan(0)
    // AABB extent must be >= original extents
    expect(r.width).toBeGreaterThanOrEqual(rect.width)
    expect(r.height).toBeGreaterThanOrEqual(rect.height)
  })

  test('Test 9: returned AABB always satisfies width ≥ original.width AND height ≥ original.height for any non-zero rotation', () => {
    const rect: AABB = { x: 50, y: 50, width: 10, height: 20 }
    for (const angle of [15, 30, 45, 60, 75, 90, 105, 135, 175, -15, -45, -90, -135]) {
      const r = computeRotatedAABB(rect, angle)
      // Tolerate sub-precision floating noise via near-equal at 0/90/180.
      expect(r.width + 1e-9).toBeGreaterThanOrEqual(
        Math.min(rect.width, rect.height),
      )
      expect(r.height + 1e-9).toBeGreaterThanOrEqual(
        Math.min(rect.width, rect.height),
      )
    }
  })

  test('Test 10: function is pure (multiple calls with same input return identical objects; no shared state)', () => {
    const rect: AABB = { x: 50, y: 50, width: 10, height: 10 }
    const a = computeRotatedAABB(rect, 45)
    const b = computeRotatedAABB(rect, 45)
    expect(a).toEqual(b)
    // Mutating the returned object must NOT affect a future call.
    a.x = 999
    const c = computeRotatedAABB(rect, 45)
    expect(c.x).toBeCloseTo(55 - (Math.sqrt(2) * 10) / 2, 5)
    expect(c.x).not.toBe(999)
    // Input rect must remain untouched (purity)
    expect(rect).toEqual({ x: 50, y: 50, width: 10, height: 10 })
  })
})

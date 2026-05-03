import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  detectEqualSpacing,
  type EqualSpacingMatch,
} from '@/lib/editor/transforms/equal-spacing'

/**
 * Phase 63 Plan 04 Task 1 (SNAP-04 + DIFF-03): equal-spacing detector tests.
 *
 * Pure module — axis-agnostic; caller passes pre-extracted { id, pos, size }
 * tuples (X-axis or Y-axis, scalar). The returned EqualSpacingMatch describes
 * the visible "==" indicator coordinates between consecutive elements.
 */

describe('detectEqualSpacing (Phase 63 Plan 04 / SNAP-04 / DIFF-03)', () => {
  test('ES1: N<3 → returns null (need at least 3 elements for an "equal-gaps" claim)', () => {
    expect(detectEqualSpacing([])).toBeNull()
    expect(detectEqualSpacing([{ id: 'a', pos: 0, size: 10 }])).toBeNull()
    expect(
      detectEqualSpacing([
        { id: 'a', pos: 0, size: 10 },
        { id: 'b', pos: 50, size: 10 },
      ]),
    ).toBeNull()
  })

  test('ES2: N=3 with equal gaps → returns match with 2 segments', () => {
    const match = detectEqualSpacing([
      { id: 'a', pos: 0, size: 10 },
      { id: 'b', pos: 50, size: 10 },
      { id: 'c', pos: 100, size: 10 },
    ])
    expect(match).not.toBeNull()
    const m = match as EqualSpacingMatch
    expect(m.gapSize).toBe(40)
    expect(m.segments).toEqual([
      { from: 10, to: 50 },
      { from: 60, to: 100 },
    ])
    expect(m.elementIds).toEqual(['a', 'b', 'c'])
  })

  test('ES3: N=4 with equal gaps → 3 segments', () => {
    const match = detectEqualSpacing([
      { id: 'a', pos: 0, size: 10 },
      { id: 'b', pos: 30, size: 10 },
      { id: 'c', pos: 60, size: 10 },
      { id: 'd', pos: 90, size: 10 },
    ])
    expect(match).not.toBeNull()
    const m = match as EqualSpacingMatch
    expect(m.gapSize).toBe(20)
    expect(m.segments).toHaveLength(3)
    expect(m.segments).toEqual([
      { from: 10, to: 30 },
      { from: 40, to: 60 },
      { from: 70, to: 90 },
    ])
    expect(m.elementIds).toEqual(['a', 'b', 'c', 'd'])
  })

  test('ES4: N=3 with unequal gaps → null', () => {
    // gap1 = 50 - 10 = 40; gap2 = 110 - 60 = 50 → unequal → null.
    const match = detectEqualSpacing([
      { id: 'a', pos: 0, size: 10 },
      { id: 'b', pos: 50, size: 10 },
      { id: 'c', pos: 110, size: 10 },
    ])
    expect(match).toBeNull()
  })

  test('ES5: epsilon=1 tolerates tiny gap differences', () => {
    // gap1 = 50.4 - 10 = 40.4; gap2 = 100 - 60.4 = 39.6 → diff = 0.8 ≤ 1.
    const match = detectEqualSpacing(
      [
        { id: 'a', pos: 0, size: 10 },
        { id: 'b', pos: 50.4, size: 10 },
        { id: 'c', pos: 100, size: 10 },
      ],
      1,
    )
    expect(match).not.toBeNull()
    const m = match as EqualSpacingMatch
    expect(m.gapSize).toBeCloseTo(40.4, 5)
    expect(m.elementIds).toEqual(['a', 'b', 'c'])
  })

  test('ES6: epsilon=0.1 rejects the same input → null (strict)', () => {
    const match = detectEqualSpacing(
      [
        { id: 'a', pos: 0, size: 10 },
        { id: 'b', pos: 50.4, size: 10 },
        { id: 'c', pos: 100, size: 10 },
      ],
      0.1,
    )
    expect(match).toBeNull()
  })

  test('ES7: pre-sorts by pos before checking (unsorted input works)', () => {
    // Same as ES2 but shuffled.
    const match = detectEqualSpacing([
      { id: 'c', pos: 100, size: 10 },
      { id: 'a', pos: 0, size: 10 },
      { id: 'b', pos: 50, size: 10 },
    ])
    expect(match).not.toBeNull()
    const m = match as EqualSpacingMatch
    expect(m.gapSize).toBe(40)
    expect(m.elementIds).toEqual(['a', 'b', 'c']) // sorted output
  })

  test('ES8: purity static check — no React/DOM/window/document references', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../transforms/equal-spacing.ts'),
      'utf-8',
    )
    expect(src).not.toMatch(/from\s+['"]react['"]/)
    expect(src).not.toMatch(/'use client'/)
    expect(src).not.toMatch(/\bdocument\b/)
    expect(src).not.toMatch(/\bwindow\b/)
  })

  test('ES9: overlapping elements (negative gap) → null', () => {
    // a ends at 60 but b starts at 50 → negative gap → no spacing match.
    const match = detectEqualSpacing([
      { id: 'a', pos: 0, size: 60 },
      { id: 'b', pos: 50, size: 10 },
      { id: 'c', pos: 100, size: 10 },
    ])
    expect(match).toBeNull()
  })

  test('ES10: default epsilon=1 when omitted', () => {
    // Within 1 px without explicit epsilon argument.
    const match = detectEqualSpacing([
      { id: 'a', pos: 0, size: 10 },
      { id: 'b', pos: 50.5, size: 10 },
      { id: 'c', pos: 100, size: 10 },
    ])
    expect(match).not.toBeNull()
  })

  test('ES11: zero-size elements are valid (degenerate edges)', () => {
    // Phase 60 carry-forward: TextBox height defaults to 0. Zero-size elements
    // along an axis still contribute pos/pos as the visible footprint.
    const match = detectEqualSpacing([
      { id: 'a', pos: 0, size: 0 },
      { id: 'b', pos: 50, size: 0 },
      { id: 'c', pos: 100, size: 0 },
    ])
    expect(match).not.toBeNull()
    const m = match as EqualSpacingMatch
    expect(m.gapSize).toBe(50)
    expect(m.segments).toEqual([
      { from: 0, to: 50 },
      { from: 50, to: 100 },
    ])
  })
})

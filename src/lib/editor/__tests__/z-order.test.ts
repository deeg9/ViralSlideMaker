import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  applyZOrderToArray,
  type ZOrderOp,
} from '@/lib/editor/transforms/z-order'

// ─────────────────────────────────────────────────────────────────────────────
// Phase 64 Plan 03 (ZORDER-01..07) — pure z-order transform tests.
//
// Pure module — no React, no DOM. Mirrors selection-bounds.ts /
// element-rect-intersect.ts purity invariants (Test 8 / Test 14 patterns).
//
// Sort discipline (Figma multi-selection model — ZORDER-06):
//   - 'forward' / 'front' → sort selected indices DESC (move topmost first
//      so adjacent-selected windows don't clobber each other).
//   - 'backward' / 'back' → sort selected indices ASC.
//
// Adjacent-selected windows do NOT shift (PITFALL-6.3 — Figma "topmost group
// already at top is no-op"). The implementation guards each forward/backward
// swap with `!selectedIds.has(neighbor.id)`.
//
// ZORDER-05 invariant: the implementation NEVER touches CSS z-index — only
// array splice. The grep gate at the bottom of this file pins zero "z-index"
// references in the source.
// ─────────────────────────────────────────────────────────────────────────────

type El = { id: string }

function arr(...ids: string[]): El[] {
  return ids.map((id) => ({ id }))
}

function ids(els: El[]): string[] {
  return els.map((e) => e.id)
}

describe('applyZOrderToArray — Phase 64 Plan 03 (ZORDER-01..07)', () => {
  // ───── forward (single-selection) ───────────────────────────────────────
  test('ZA1: [a, b, c], select [a], forward → [b, a, c]', () => {
    const input = arr('a', 'b', 'c')
    const out = applyZOrderToArray(input, new Set(['a']), 'forward')
    expect(ids(out)).toEqual(['b', 'a', 'c'])
  })

  test('ZA2: [a, b, c], select [c], forward → [a, b, c] (already at end; ref-equal)', () => {
    const input = arr('a', 'b', 'c')
    const out = applyZOrderToArray(input, new Set(['c']), 'forward')
    expect(out).toBe(input) // ref-equal short-circuit
    expect(ids(out)).toEqual(['a', 'b', 'c'])
  })

  // ───── forward (multi-selection) ────────────────────────────────────────
  test('ZA3: [a, b, c, d], select [a, c], forward → [b, a, d, c]', () => {
    // DESC sort by original index: process c (idx 2) first, then a (idx 0).
    //   c at 2, neighbor at 3 is 'd' (unselected) → swap → [a, b, d, c]
    //   a at 0, neighbor at 1 is 'b' (unselected) → swap → [b, a, d, c]
    const input = arr('a', 'b', 'c', 'd')
    const out = applyZOrderToArray(input, new Set(['a', 'c']), 'forward')
    expect(ids(out)).toEqual(['b', 'a', 'd', 'c'])
  })

  test('ZA4: [a, b, c, d], select [c, d] (adjacent topmost), forward → [a, b, c, d] (no-op)', () => {
    // DESC sort: process d (idx 3) first → at end, can't move.
    //   c at 2, neighbor at 3 is 'd' which IS selected → guarded, no swap.
    // Result: ref-equal short-circuit.
    const input = arr('a', 'b', 'c', 'd')
    const out = applyZOrderToArray(input, new Set(['c', 'd']), 'forward')
    expect(out).toBe(input)
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd'])
  })

  // ───── backward (single-selection) ──────────────────────────────────────
  test('ZA5: [a, b, c], select [c], backward → [a, c, b]', () => {
    const input = arr('a', 'b', 'c')
    const out = applyZOrderToArray(input, new Set(['c']), 'backward')
    expect(ids(out)).toEqual(['a', 'c', 'b'])
  })

  test('ZA6: [a, b, c], select [a], backward → [a, b, c] (already at 0; ref-equal)', () => {
    const input = arr('a', 'b', 'c')
    const out = applyZOrderToArray(input, new Set(['a']), 'backward')
    expect(out).toBe(input)
    expect(ids(out)).toEqual(['a', 'b', 'c'])
  })

  // ───── backward (multi-selection) ───────────────────────────────────────
  test('ZA7: [a, b, c, d], select [b, d], backward → [b, a, d, c]', () => {
    // ASC sort: process b (idx 1) first, then d (idx 3).
    //   b at 1, neighbor at 0 is 'a' (unselected) → swap → [b, a, c, d]
    //   d at 3, neighbor at 2 is 'c' (unselected) → swap → [b, a, d, c]
    const input = arr('a', 'b', 'c', 'd')
    const out = applyZOrderToArray(input, new Set(['b', 'd']), 'backward')
    expect(ids(out)).toEqual(['b', 'a', 'd', 'c'])
  })

  test('ZA8: [a, b, c, d], select [a, b] (adjacent bottommost), backward → [a, b, c, d] (no-op)', () => {
    // ASC sort: process a (idx 0) first → at start, can't move.
    //   b at 1, neighbor at 0 is 'a' which IS selected → guarded, no swap.
    const input = arr('a', 'b', 'c', 'd')
    const out = applyZOrderToArray(input, new Set(['a', 'b']), 'backward')
    expect(out).toBe(input)
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd'])
  })

  // ───── front (move to end) ──────────────────────────────────────────────
  test('ZA9: [a, b, c, d], select [b], front → [a, c, d, b]', () => {
    const input = arr('a', 'b', 'c', 'd')
    const out = applyZOrderToArray(input, new Set(['b']), 'front')
    expect(ids(out)).toEqual(['a', 'c', 'd', 'b'])
  })

  test('ZA10: [a, b, c, d], select [b, d], front → [a, c, d, b]', () => {
    // DESC sort: process d (idx 3) first.
    //   d at 3 — splice & push to end → [a, b, c, d] (no change; was at end).
    //   b at 1 — splice & push to end → [a, c, d, b].
    const input = arr('a', 'b', 'c', 'd')
    const out = applyZOrderToArray(input, new Set(['b', 'd']), 'front')
    expect(ids(out)).toEqual(['a', 'c', 'd', 'b'])
  })

  // ───── back (move to index 0) ───────────────────────────────────────────
  test('ZA11: [a, b, c, d], select [c], back → [c, a, b, d]', () => {
    const input = arr('a', 'b', 'c', 'd')
    const out = applyZOrderToArray(input, new Set(['c']), 'back')
    expect(ids(out)).toEqual(['c', 'a', 'b', 'd'])
  })

  test('ZA12: [a, b, c, d], select [a, c], back → [c, a, b, d]', () => {
    // ASC sort: process a (idx 0) first.
    //   a at 0 — splice & unshift to 0 → [a, b, c, d] (no change; was at 0).
    //   c at 2 — splice & unshift to 0 → [c, a, b, d].
    const input = arr('a', 'b', 'c', 'd')
    const out = applyZOrderToArray(input, new Set(['a', 'c']), 'back')
    expect(ids(out)).toEqual(['c', 'a', 'b', 'd'])
  })

  // ───── edge cases ───────────────────────────────────────────────────────
  test('ZA13: empty array → empty array (ref-equal)', () => {
    const input: El[] = []
    const out = applyZOrderToArray(input, new Set(['a']), 'forward')
    expect(out).toBe(input)
  })

  test('ZA14: no selection → input unchanged (ref-equal)', () => {
    const input = arr('a', 'b', 'c')
    const out = applyZOrderToArray(input, new Set<string>(), 'forward')
    expect(out).toBe(input)
  })

  test('ZA15: all ids selected, forward → input unchanged (ref-equal — every neighbor is selected)', () => {
    const input = arr('a', 'b', 'c')
    const out = applyZOrderToArray(input, new Set(['a', 'b', 'c']), 'forward')
    expect(out).toBe(input)
  })

  // ───── purity invariant (mirrors selection-bounds Test 8 / element-rect Test 8) ─
  test('ZA16 (purity): source file imports no React, no DOM, no use-client; zero z-index references', () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/lib/editor/transforms/z-order.ts',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    // Pure module: no React, no use-client, no DOM globals.
    expect(src).not.toMatch(/from ['"]react['"]/)
    expect(src).not.toMatch(/['"]use client['"]/)
    expect(src).not.toMatch(/document\.|window\./)

    // ZORDER-05 (Satori parity invariant): NEVER CSS z-index. Strip
    // single-line comments before counting so a documentary mention is OK.
    const codeOnly = src
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      .join('\n')
    expect(codeOnly).not.toMatch(/z-index/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Type-level acceptance: `op: ZOrderOp` is the discriminated union — calling
// with an arbitrary string should be a TypeScript error. We can't test type-
// errors directly here, but we can pin the runtime values via a no-op probe.
// ─────────────────────────────────────────────────────────────────────────────
test('ZOrderOp values are the four expected operations', () => {
  const ops: ZOrderOp[] = ['forward', 'backward', 'front', 'back']
  expect(ops).toHaveLength(4)
})

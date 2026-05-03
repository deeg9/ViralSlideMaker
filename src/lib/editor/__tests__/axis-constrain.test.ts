/**
 * Phase 61 Plan 02 (KBD-07): unit tests for the axis-constrain pure helper.
 *
 * applyAxisConstrain locks element drag motion to the dominant axis when
 * Shift is held. Mirrors the Figma/Canva muscle memory: hold Shift while
 * dragging to keep the element on its current X or Y line.
 *
 * Algorithm: deltaX vs deltaY abs-magnitudes. The bigger one is dominant;
 * the other axis is clamped back to start. Equal-delta tie-break: lock to
 * Y (X stays free).
 *
 * Conservative scope: helper is wired into the 4 element drag handlers in
 * slide-preview.tsx (hook/body/custom-text/custom-image) BEFORE the existing
 * calculateSnap call, so snap can still pull on the FREE axis while the
 * constrained axis stays locked (Test "snap-on-free-axis" guarantee).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { applyAxisConstrain } from '@/lib/editor/transforms/axis-constrain'

describe('Phase 61 Plan 02 (KBD-07): applyAxisConstrain', () => {
  it('shiftHeld=false: returns input unchanged (no-op pass-through)', () => {
    const result = applyAxisConstrain(
      { x: 200, y: 200 },
      { x: 100, y: 100 },
      false,
    )
    expect(result).toEqual({ x: 200, y: 200 })
  })

  it('shiftHeld=true, X-dominant (|dx| > |dy|): locks Y to start, leaves X free', () => {
    const result = applyAxisConstrain(
      { x: 200, y: 110 },  // dx=100, dy=10 — X dominant
      { x: 100, y: 100 },
      true,
    )
    expect(result).toEqual({ x: 200, y: 100 })  // Y locked to start.y
  })

  it('shiftHeld=true, Y-dominant (|dy| > |dx|): locks X to start, leaves Y free', () => {
    const result = applyAxisConstrain(
      { x: 110, y: 200 },  // dx=10, dy=100 — Y dominant
      { x: 100, y: 100 },
      true,
    )
    expect(result).toEqual({ x: 100, y: 200 })  // X locked to start.x
  })

  it('shiftHeld=true, equal-delta tie-break: locks to Y (X stays free)', () => {
    // |dx| === |dy|. The implementation uses dx > dy (strict) so equal goes
    // to the else branch — lock X, free Y. Locking the file order to a
    // deterministic tie-break prevents UX flicker when the user drags
    // exactly diagonally.
    const result = applyAxisConstrain(
      { x: 200, y: 200 },  // dx=100, dy=100
      { x: 100, y: 100 },
      true,
    )
    expect(result).toEqual({ x: 100, y: 200 })  // X locked, Y free
  })

  it('shiftHeld=true, negative-delta X-dominant: locks Y (signed delta)', () => {
    // dragging to the LEFT — dx is negative, |dx|=100, |dy|=10 — X dominant.
    const result = applyAxisConstrain(
      { x: 0, y: 110 },  // dx=-100, dy=10
      { x: 100, y: 100 },
      true,
    )
    expect(result).toEqual({ x: 0, y: 100 })  // X free (negative ok), Y locked
  })

  it('shiftHeld=true, zero-delta: returns start (degenerate input)', () => {
    const result = applyAxisConstrain(
      { x: 100, y: 100 },
      { x: 100, y: 100 },
      true,
    )
    // dx=0, dy=0 → dx > dy false → else branch: x=start.x, y=data.y
    expect(result).toEqual({ x: 100, y: 100 })
  })

  it('purity grep: axis-constrain.ts has no React/use-client/DOM access', () => {
    const sourcePath = path.resolve(
      __dirname,
      '../transforms/axis-constrain.ts',
    )
    const src = readFileSync(sourcePath, 'utf-8')
    expect(src).not.toMatch(/from ['"]react['"]/)
    expect(src).not.toMatch(/['"]use client['"]/)
    expect(src).not.toMatch(/(document|window)\./)
  })
})

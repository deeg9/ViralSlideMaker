/**
 * Phase 72 Plan 02 (CARD-06): numeric rotation input in DecorationCard.
 *
 * Section structure mirrors the existing W/H/X/Y position input pattern:
 *   - Range -180..180, integer step
 *   - Commits on blur OR Enter (NEVER per-keystroke — KBD-09 carry-forward)
 *   - Out-of-range values clamp to [-180, 180] BEFORE dispatch
 *   - Re-syncs from prop on external change (round-trip with handle drag)
 *   - Empty input does NOT dispatch (revert to current value)
 *
 * Dispatch path: this input commits via the existing onUpdate({rotation}) →
 * UPDATE_DECORATION channel (single id update; single pushHistory). The drag
 * handle (Plan 72-02 Task 2) commits via BULK_ROTATE (multi-id capable).
 * Both produce single pushHistory entries per gesture.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { DecorationCard } from '../decoration-card'
import type { ShapeDecoration } from '@/lib/types/decoration'

const baseShape: ShapeDecoration = {
  id: 'd1',
  kind: 'shape',
  shapeKind: 'rect',
  fill: '#FF0000',
  position: { x: 10, y: 20, width: 30, height: 40 },
  rotation: 0,
}

describe('Phase 72 Plan 02 — DecorationCard rotation input (CARD-06)', () => {
  it('Test 1: renders rotation input with current value populated', () => {
    const withRotation: ShapeDecoration = { ...baseShape, rotation: 45 }
    const { getByTestId } = render(
      <DecorationCard decoration={withRotation} onUpdate={vi.fn()} />,
    )
    const input = getByTestId('decoration-input-rotation') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('45')
    // Range should be -180..180.
    expect(input.min).toBe('-180')
    expect(input.max).toBe('180')
  })

  it('Test 2: typing a value and pressing Enter dispatches onUpdate({rotation}) ONCE', () => {
    const onUpdate = vi.fn()
    const { getByTestId } = render(
      <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
    )
    const input = getByTestId('decoration-input-rotation') as HTMLInputElement
    fireEvent.change(input, { target: { value: '45' } })
    expect(onUpdate).not.toHaveBeenCalled() // per-keystroke does NOT dispatch
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({ rotation: 45 })
  })

  it('Test 3: typing and blurring dispatches onUpdate ONCE (KBD-09)', () => {
    const onUpdate = vi.fn()
    const { getByTestId } = render(
      <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
    )
    const input = getByTestId('decoration-input-rotation') as HTMLInputElement
    fireEvent.change(input, { target: { value: '90' } })
    fireEvent.change(input, { target: { value: '92' } })
    fireEvent.change(input, { target: { value: '95' } })
    expect(onUpdate).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({ rotation: 95 })
  })

  it('Test 4: out-of-range values clamp to [-180, 180] BEFORE dispatch', () => {
    const onUpdate = vi.fn()
    const { getByTestId } = render(
      <DecorationCard decoration={baseShape} onUpdate={onUpdate} />,
    )
    const input = getByTestId('decoration-input-rotation') as HTMLInputElement

    fireEvent.change(input, { target: { value: '200' } })
    fireEvent.blur(input)
    expect(onUpdate).toHaveBeenLastCalledWith({ rotation: 180 })

    fireEvent.change(input, { target: { value: '-200' } })
    fireEvent.blur(input)
    expect(onUpdate).toHaveBeenLastCalledWith({ rotation: -180 })

    expect(onUpdate).toHaveBeenCalledTimes(2)
  })

  it('Test 5: round-trip — when decoration.rotation prop changes, input value re-syncs', () => {
    const { rerender, getByTestId } = render(
      <DecorationCard decoration={baseShape} onUpdate={vi.fn()} />,
    )
    let input = getByTestId('decoration-input-rotation') as HTMLInputElement
    expect(input.value).toBe('0')

    // External update (e.g. drag handle commit lands a new rotation)
    const updated: ShapeDecoration = { ...baseShape, rotation: 75 }
    rerender(<DecorationCard decoration={updated} onUpdate={vi.fn()} />)
    input = getByTestId('decoration-input-rotation') as HTMLInputElement
    expect(input.value).toBe('75')
  })

  it('Test 6: empty string does NOT dispatch; reverts to last committed value', () => {
    const onUpdate = vi.fn()
    const withRotation: ShapeDecoration = { ...baseShape, rotation: 30 }
    const { getByTestId } = render(
      <DecorationCard decoration={withRotation} onUpdate={onUpdate} />,
    )
    const input = getByTestId('decoration-input-rotation') as HTMLInputElement
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onUpdate).not.toHaveBeenCalled()
    // Input reverts to current decoration.rotation (30)
    expect(input.value).toBe('30')
  })
})

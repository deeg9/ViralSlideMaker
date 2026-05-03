import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayerChip } from '../layer-chip'
import type { LayerChipProps, LayerChipRow } from '../types'

/**
 * Phase 65 Plan 02 (LAYERS-05/06/07): LayerChip toggle slots wired to
 * Plan 64 reducer actions.
 *
 * LT1..LT8 cover:
 *   - LT1/LT2: lock button → onLockToggle(ids, nextLocked) — calls with
 *     [row.id] + the toggle math (!row.locked).
 *   - LT3/LT4: visibility button → onVisibilityToggle(ids, nextHidden).
 *   - LT5/LT6: up / down z-order arrows → onReorder(row.id, op).
 *   - LT7: watermark chip's up-arrow STILL fires onReorder; reducer
 *     (Plan 64-03 D-03) silently absorbs single-slot scopes via
 *     no-scope-changed short-circuit. Chip is NOT responsible for
 *     hiding the buttons.
 *   - LT8: stopPropagation — clicking lock/vis/reorder does NOT bubble
 *     up to the chip's outer onClick (selection unchanged).
 *
 * Tests use vi.fn() for all callbacks; assert call args via
 * toHaveBeenCalledWith.
 */

function makeChipRow(overrides: Partial<LayerChipRow> = {}): LayerChipRow {
  return {
    kind: 'chip',
    id: 'tb-1',
    elementType: 'text',
    label: 'Hello',
    locked: false,
    hidden: false,
    ...overrides,
  }
}

function makeProps(overrides: Partial<LayerChipProps> = {}): LayerChipProps {
  return {
    row: makeChipRow(),
    selected: false,
    primary: false,
    isEditing: false,
    onSelect: vi.fn(),
    onStartRename: vi.fn(),
    onCommitRename: vi.fn(),
    onCancelRename: vi.fn(),
    onLockToggle: vi.fn(),
    onVisibilityToggle: vi.fn(),
    onReorder: vi.fn(),
    ...overrides,
  }
}

describe('Phase 65 Plan 02 (LAYERS-05..07): LayerChip toggle slots', () => {
  it('LT1: clicking lock button on unlocked chip → onLockToggle([id], true)', () => {
    const onLockToggle = vi.fn()
    const props = makeProps({
      row: makeChipRow({ id: 'tb-1', locked: false }),
      onLockToggle,
    })
    render(<LayerChip {...props} />)
    const btn = screen.getByTestId('chip-lock-button')
    fireEvent.click(btn)
    expect(onLockToggle).toHaveBeenCalledWith(['tb-1'], true)
    expect(onLockToggle).toHaveBeenCalledTimes(1)
  })

  it('LT2: clicking lock button on locked chip → onLockToggle([id], false); pressed visual state', () => {
    const onLockToggle = vi.fn()
    const props = makeProps({
      row: makeChipRow({ id: 'tb-2', locked: true }),
      onLockToggle,
    })
    render(<LayerChip {...props} />)
    const btn = screen.getByTestId('chip-lock-button')
    expect(btn.getAttribute('data-pressed')).toBe('true')
    fireEvent.click(btn)
    expect(onLockToggle).toHaveBeenCalledWith(['tb-2'], false)
  })

  it('LT3: clicking visibility button on visible chip → onVisibilityToggle([id], true)', () => {
    const onVisibilityToggle = vi.fn()
    const props = makeProps({
      row: makeChipRow({ id: 'tb-3', hidden: false }),
      onVisibilityToggle,
    })
    render(<LayerChip {...props} />)
    const btn = screen.getByTestId('chip-vis-button')
    fireEvent.click(btn)
    expect(onVisibilityToggle).toHaveBeenCalledWith(['tb-3'], true)
  })

  it('LT4: clicking visibility button on hidden chip → onVisibilityToggle([id], false); crossed-out visual state', () => {
    const onVisibilityToggle = vi.fn()
    const props = makeProps({
      row: makeChipRow({ id: 'tb-4', hidden: true }),
      onVisibilityToggle,
    })
    render(<LayerChip {...props} />)
    const btn = screen.getByTestId('chip-vis-button')
    expect(btn.getAttribute('data-pressed')).toBe('true')
    fireEvent.click(btn)
    expect(onVisibilityToggle).toHaveBeenCalledWith(['tb-4'], false)
  })

  it('LT5: clicking up-arrow → onReorder(id, "forward")', () => {
    const onReorder = vi.fn()
    const props = makeProps({
      row: makeChipRow({ id: 'tb-5' }),
      onReorder,
    })
    render(<LayerChip {...props} />)
    const btn = screen.getByTestId('chip-reorder-up')
    fireEvent.click(btn)
    expect(onReorder).toHaveBeenCalledWith('tb-5', 'forward')
  })

  it('LT6: clicking down-arrow → onReorder(id, "backward")', () => {
    const onReorder = vi.fn()
    const props = makeProps({
      row: makeChipRow({ id: 'tb-6' }),
      onReorder,
    })
    render(<LayerChip {...props} />)
    const btn = screen.getByTestId('chip-reorder-down')
    fireEvent.click(btn)
    expect(onReorder).toHaveBeenCalledWith('tb-6', 'backward')
  })

  it('LT7: watermark chip up-arrow STILL fires onReorder (reducer absorbs no-op per Plan 64-03 D-03)', () => {
    const onReorder = vi.fn()
    const props = makeProps({
      row: makeChipRow({
        id: 'wm-1',
        elementType: 'watermark',
        label: 'Watermark',
      }),
      onReorder,
    })
    render(<LayerChip {...props} />)
    const upBtn = screen.getByTestId('chip-reorder-up')
    expect(upBtn).toBeTruthy()
    fireEvent.click(upBtn)
    expect(onReorder).toHaveBeenCalledWith('wm-1', 'forward')
    // The chip is NOT responsible for hiding watermark z-order buttons —
    // the reducer (Plan 64-03 D-03) silently absorbs the no-op via the
    // no-scope-changed short-circuit. Chip wires the button anyway for
    // visual consistency.
  })

  it('LT8: lock/vis/reorder button clicks do NOT bubble to outer chip onClick (selection unchanged)', () => {
    const onSelect = vi.fn()
    const onLockToggle = vi.fn()
    const onVisibilityToggle = vi.fn()
    const onReorder = vi.fn()
    const parentSpy = vi.fn()
    const props = makeProps({
      onSelect,
      onLockToggle,
      onVisibilityToggle,
      onReorder,
    })
    render(
      <div onClick={parentSpy}>
        <LayerChip {...props} />
      </div>,
    )
    fireEvent.click(screen.getByTestId('chip-lock-button'))
    fireEvent.click(screen.getByTestId('chip-vis-button'))
    fireEvent.click(screen.getByTestId('chip-reorder-up'))
    fireEvent.click(screen.getByTestId('chip-reorder-down'))
    // None of the four button clicks should have bubbled to the outer
    // chip onClick handler (which would have called onSelect).
    expect(onSelect).not.toHaveBeenCalled()
    // And none should have bubbled to the wrapping <div onClick>.
    expect(parentSpy).not.toHaveBeenCalled()
    // But the toggle callbacks themselves DID fire.
    expect(onLockToggle).toHaveBeenCalledTimes(1)
    expect(onVisibilityToggle).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledTimes(2)
  })
})

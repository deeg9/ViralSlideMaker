import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GroupRow } from '../group-row'
import type { GroupRowProps, LayerGroupHeaderRow } from '../types'

/**
 * Phase 65 Plan 02 (LAYERS-05/06 group-scope): GroupRow toggle slots.
 *
 * GT1..GT4 cover:
 *   - GT1: group-lock button on allLocked=false → onGroupLockToggle(memberIds, true).
 *   - GT2: group-lock on allLocked=true → onGroupLockToggle(memberIds, false).
 *   - GT3: group-vis button toggles allHidden in both directions.
 *   - GT4: group lock/vis click does NOT propagate to onToggleExpanded
 *     (chevron's expand/collapse handler).
 *
 * Group-row z-order is intentionally OUT of scope (cross-array reorder
 * + multi-id splice deferred to v2.12+).
 */

function makeRow(overrides: Partial<LayerGroupHeaderRow> = {}): LayerGroupHeaderRow {
  return {
    kind: 'group-header',
    groupId: 'g_0_xyz',
    memberIds: ['tb-1', 'tb-2', 'ci-1'],
    allLocked: false,
    allHidden: false,
    ...overrides,
  }
}

function makeProps(overrides: Partial<GroupRowProps> = {}): GroupRowProps {
  return {
    row: makeRow(),
    expanded: false,
    onToggleExpanded: vi.fn(),
    onGroupLockToggle: vi.fn(),
    onGroupVisibilityToggle: vi.fn(),
    ...overrides,
  }
}

describe('Phase 65 Plan 02 (LAYERS-05/06 group-scope): GroupRow toggle slots', () => {
  it('GT1: clicking group-lock on allLocked=false → onGroupLockToggle(memberIds, true)', () => {
    const onGroupLockToggle = vi.fn()
    const memberIds = ['tb-1', 'tb-2', 'ci-1']
    const props = makeProps({
      row: makeRow({ memberIds, allLocked: false }),
      onGroupLockToggle,
    })
    render(<GroupRow {...props} />)
    const btn = screen.getByTestId('group-lock-button')
    fireEvent.click(btn)
    expect(onGroupLockToggle).toHaveBeenCalledWith(memberIds, true)
    expect(onGroupLockToggle).toHaveBeenCalledTimes(1)
  })

  it('GT2: clicking group-lock on allLocked=true → onGroupLockToggle(memberIds, false); pressed visual state', () => {
    const onGroupLockToggle = vi.fn()
    const memberIds = ['tb-9', 'tb-10']
    const props = makeProps({
      row: makeRow({ memberIds, allLocked: true }),
      onGroupLockToggle,
    })
    render(<GroupRow {...props} />)
    const btn = screen.getByTestId('group-lock-button')
    expect(btn.getAttribute('data-pressed')).toBe('true')
    fireEvent.click(btn)
    expect(onGroupLockToggle).toHaveBeenCalledWith(memberIds, false)
  })

  it('GT3: clicking group-vis toggles allHidden in both directions', () => {
    const onGroupVisibilityToggle = vi.fn()
    const memberIds = ['tb-7', 'ci-2']
    // First direction: allHidden=false → expect (memberIds, true)
    const { rerender } = render(
      <GroupRow
        {...makeProps({
          row: makeRow({ memberIds, allHidden: false }),
          onGroupVisibilityToggle,
        })}
      />,
    )
    fireEvent.click(screen.getByTestId('group-vis-button'))
    expect(onGroupVisibilityToggle).toHaveBeenLastCalledWith(memberIds, true)
    // Reverse direction: allHidden=true → expect (memberIds, false)
    rerender(
      <GroupRow
        {...makeProps({
          row: makeRow({ memberIds, allHidden: true }),
          onGroupVisibilityToggle,
        })}
      />,
    )
    fireEvent.click(screen.getByTestId('group-vis-button'))
    expect(onGroupVisibilityToggle).toHaveBeenLastCalledWith(memberIds, false)
    expect(onGroupVisibilityToggle).toHaveBeenCalledTimes(2)
  })

  it('GT4: group lock/vis button click does NOT propagate to onToggleExpanded', () => {
    const onToggleExpanded = vi.fn()
    const onGroupLockToggle = vi.fn()
    const onGroupVisibilityToggle = vi.fn()
    const props = makeProps({
      onToggleExpanded,
      onGroupLockToggle,
      onGroupVisibilityToggle,
    })
    render(<GroupRow {...props} />)
    fireEvent.click(screen.getByTestId('group-lock-button'))
    fireEvent.click(screen.getByTestId('group-vis-button'))
    // Lock + vis clicks should NOT have triggered the chevron's expand
    // handler (which is a separate sibling button).
    expect(onToggleExpanded).not.toHaveBeenCalled()
    // But the toggle callbacks DID fire.
    expect(onGroupLockToggle).toHaveBeenCalledTimes(1)
    expect(onGroupVisibilityToggle).toHaveBeenCalledTimes(1)
  })
})

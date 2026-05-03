import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { memo, useCallback, useState } from 'react'
import { LayerChipImpl, areEqual } from '../layer-chip'
import type { LayerChipProps, LayerChipRow } from '../types'

/**
 * Phase 65 Plan 01 (LAYERS-09 / PERF-04): React.memo render-count
 * isolation proof.
 *
 * Strategy (per Plan 65-01 action B "SIMPLER alternative"): wrap
 * LayerChipImpl via vi.fn() and re-memoize with areEqual. Reading
 * mockFn.mock.calls.length gives the exact render count for that chip
 * across the test's lifecycle. The parent fixture below maintains its
 * own state (selection ids + per-element locked/hidden flags) so we
 * can re-render with one prop change at a time and assert which chips
 * re-rendered.
 *
 * Critical wiring: the parent uses useCallback for chip prop callbacks
 * so areEqual's "function refs are stable" assumption holds. If the
 * parent passed inline `() => ...` lambdas, every parent render would
 * pass new function refs — but areEqual deliberately doesn't compare
 * function refs (see layer-chip.tsx). The render-count contract still
 * works because areEqual short-circuits on row.id / label / locked /
 * hidden / selected / primary equality — function-ref churn is
 * irrelevant.
 */

// ───── fixtures ─────────────────────────────────────────────────────

function makeChipRow(overrides: Partial<LayerChipRow> = {}): LayerChipRow {
  return {
    kind: 'chip',
    id: 'tb1',
    elementType: 'text',
    label: 'Hook',
    locked: false,
    hidden: false,
    ...overrides,
  }
}

// Build N chips + a parent that flips one slot at a time. We track
// per-chip render counts via vi.fn() wrappers around LayerChipImpl.
interface HarnessProps {
  rows: LayerChipRow[]
  selectedIds: string[]
  primary: string | null
  editingId: string | null
  // The mock impl is created OUTSIDE the parent so the test can read
  // mock.calls.length directly. Each chip indexes into this map by id.
  mocks: Record<string, ReturnType<typeof vi.fn>>
}

function Harness({ rows, selectedIds, primary, editingId, mocks }: HarnessProps) {
  // Stable callbacks via useCallback so chip-side areEqual gates on
  // row/selection/primary/isEditing fields only.
  const onSelect = useCallback((_mode: 'replace' | 'toggle') => {}, [])
  const onStartRename = useCallback(() => {}, [])
  const onCommitRename = useCallback((_v: string) => {}, [])
  const onCancelRename = useCallback(() => {}, [])

  const selectedSet = new Set(selectedIds)

  return (
    <div data-testid="harness">
      {rows.map((row) => {
        // Each chip gets its OWN memoized component (one per id) so
        // mocks.<id> tracks renders for exactly that chip.
        const Memo = mocks[row.id] as unknown as React.ComponentType<LayerChipProps>
        return (
          <Memo
            key={row.id}
            row={row}
            selected={selectedSet.has(row.id)}
            primary={primary === row.id}
            isEditing={editingId === row.id}
            onSelect={onSelect}
            onStartRename={onStartRename}
            onCommitRename={onCommitRename}
            onCancelRename={onCancelRename}
          />
        )
      })}
    </div>
  )
}

// Build a per-test mock-component map: vi.fn() wrapping LayerChipImpl,
// re-memoized with the production areEqual.
function buildMocks(ids: string[]) {
  const mocks: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const id of ids) {
    const fn = vi.fn(LayerChipImpl)
    // memo to apply areEqual — same path as production LayerChip
    const Memo = memo(fn, areEqual) as unknown as ReturnType<typeof vi.fn>
    // Stash the underlying mock fn so .mock.calls is reachable; the
    // memo-wrapped component is what we render. We dual-store via
    // Object.assign so the rendered component IS the memo wrapper but
    // .mock.calls reads the inner fn.
    mocks[id] = Object.assign(Memo, { __innerFn: fn }) as unknown as ReturnType<typeof vi.fn>
  }
  return mocks
}

function callCountFor(mocks: Record<string, ReturnType<typeof vi.fn>>, id: string): number {
  const M = mocks[id] as unknown as { __innerFn: ReturnType<typeof vi.fn> }
  return M.__innerFn.mock.calls.length
}

// Parent harness wrapping Harness + state for re-render simulation.
function StatefulHarness({
  initialRows,
  mocks,
  hookRef,
}: {
  initialRows: LayerChipRow[]
  mocks: Record<string, ReturnType<typeof vi.fn>>
  hookRef: { current: null | ((u: Partial<{ rows: LayerChipRow[]; selectedIds: string[]; primary: string | null; editingId: string | null }>) => void) }
}) {
  const [rows, setRows] = useState<LayerChipRow[]>(initialRows)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [primary, setPrimary] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  hookRef.current = (u) => {
    if (u.rows !== undefined) setRows(u.rows)
    if (u.selectedIds !== undefined) setSelectedIds(u.selectedIds)
    if (u.primary !== undefined) setPrimary(u.primary)
    if (u.editingId !== undefined) setEditingId(u.editingId)
  }

  return (
    <Harness
      rows={rows}
      selectedIds={selectedIds}
      primary={primary}
      editingId={editingId}
      mocks={mocks}
    />
  )
}

describe('Phase 65 Plan 01 (LAYERS-09 / PERF-04): LayerChip React.memo render-count proof', () => {
  it('LM1: selection-id flip → only the formerly/newly-primary chip re-renders, others stay put', () => {
    const ids = ['c0', 'c1', 'c2', 'c3', 'c4']
    const rows: LayerChipRow[] = ids.map((id, i) => makeChipRow({ id, label: `Label ${i}` }))
    const mocks = buildMocks(ids)
    const hookRef: Parameters<typeof StatefulHarness>[0]['hookRef'] = { current: null }

    render(<StatefulHarness initialRows={rows} mocks={mocks} hookRef={hookRef} />)

    // Baseline: each chip rendered exactly once.
    for (const id of ids) {
      expect(callCountFor(mocks, id)).toBe(1)
    }

    // Flip selection: select chip c0 (becomes primary). Only c0 should
    // re-render — c1..c4 areEqual returns true (no field changed).
    act(() => {
      hookRef.current!({ selectedIds: ['c0'], primary: 'c0' })
    })

    expect(callCountFor(mocks, 'c0')).toBe(2) // re-rendered: selected/primary flipped
    for (const id of ['c1', 'c2', 'c3', 'c4']) {
      expect(callCountFor(mocks, id)).toBe(1) // unchanged
    }

    // Flip selection: select chip c2 (becomes primary, c0 deselects).
    // c0 + c2 should re-render; c1, c3, c4 should NOT.
    act(() => {
      hookRef.current!({ selectedIds: ['c2'], primary: 'c2' })
    })
    expect(callCountFor(mocks, 'c0')).toBe(3) // selected: true→false
    expect(callCountFor(mocks, 'c2')).toBe(2) // selected: false→true
    for (const id of ['c1', 'c3', 'c4']) {
      expect(callCountFor(mocks, id)).toBe(1) // unchanged
    }
  })

  it('LM2: locked-flag flip on chip 0 only re-renders chip 0', () => {
    const ids = ['c0', 'c1', 'c2', 'c3', 'c4']
    const rows: LayerChipRow[] = ids.map((id, i) => makeChipRow({ id, label: `Label ${i}` }))
    const mocks = buildMocks(ids)
    const hookRef: Parameters<typeof StatefulHarness>[0]['hookRef'] = { current: null }

    render(<StatefulHarness initialRows={rows} mocks={mocks} hookRef={hookRef} />)

    // Baseline
    for (const id of ids) expect(callCountFor(mocks, id)).toBe(1)

    // Update rows so chip 0 has locked: true. The rows array reference
    // changes (new array), but areEqual on each chip's row gates by
    // .id / .label / .locked / .hidden — so only c0 re-renders.
    const next = rows.map((r) => (r.id === 'c0' ? { ...r, locked: true } : r))
    act(() => {
      hookRef.current!({ rows: next })
    })

    expect(callCountFor(mocks, 'c0')).toBe(2)
    for (const id of ['c1', 'c2', 'c3', 'c4']) {
      expect(callCountFor(mocks, id)).toBe(1)
    }
  })

  it('LM3: hidden-flag flip on chip 0 only re-renders chip 0', () => {
    const ids = ['c0', 'c1', 'c2', 'c3', 'c4']
    const rows: LayerChipRow[] = ids.map((id, i) => makeChipRow({ id, label: `Label ${i}` }))
    const mocks = buildMocks(ids)
    const hookRef: Parameters<typeof StatefulHarness>[0]['hookRef'] = { current: null }

    render(<StatefulHarness initialRows={rows} mocks={mocks} hookRef={hookRef} />)

    for (const id of ids) expect(callCountFor(mocks, id)).toBe(1)

    const next = rows.map((r) => (r.id === 'c0' ? { ...r, hidden: true } : r))
    act(() => {
      hookRef.current!({ rows: next })
    })

    expect(callCountFor(mocks, 'c0')).toBe(2)
    for (const id of ['c1', 'c2', 'c3', 'c4']) {
      expect(callCountFor(mocks, id)).toBe(1)
    }
  })

  it('LM-areEqual: explicit unit test pinning the equality contract', () => {
    const base: LayerChipProps = {
      row: makeChipRow({ id: 'x', label: 'L', locked: false, hidden: false }),
      selected: false,
      primary: false,
      isEditing: false,
      onSelect: () => {},
      onStartRename: () => {},
      onCommitRename: () => {},
      onCancelRename: () => {},
    }
    expect(areEqual(base, base)).toBe(true)

    // label change → false
    expect(
      areEqual(base, { ...base, row: { ...base.row, label: 'M' } }),
    ).toBe(false)
    // locked change → false
    expect(
      areEqual(base, { ...base, row: { ...base.row, locked: true } }),
    ).toBe(false)
    // hidden change → false
    expect(
      areEqual(base, { ...base, row: { ...base.row, hidden: true } }),
    ).toBe(false)
    // selected change → false
    expect(areEqual(base, { ...base, selected: true })).toBe(false)
    // primary change → false
    expect(areEqual(base, { ...base, primary: true })).toBe(false)
    // isEditing change → false
    expect(areEqual(base, { ...base, isEditing: true })).toBe(false)
    // function-ref change → TRUE (intentionally excluded from areEqual)
    expect(areEqual(base, { ...base, onSelect: () => {} })).toBe(true)
  })
})

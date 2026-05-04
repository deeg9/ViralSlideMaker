import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import LayersPanel from '../layers-panel'
import type { LayersPanelProps } from '../types'
import type { Slide } from '@/lib/types/slide'
import type { SelectionModel } from '@/lib/editor/use-selection-model'

/**
 * Phase 70 Plan 05 (PARITY-18 — LP-NEW1..3):
 * LayersPanel decoration walk integration tests.
 *
 * LP-NEW1 — solo decoration (no group): single chip, no group-header.
 * LP-NEW2 — decoration grouped with text_box: group-header + 2 chips, member order.
 * LP-NEW3 — multi-decoration group: group-header + 2 decoration chips with allLocked /
 *           allHidden roll-up.
 */

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: [],
    custom_images: [],
    decorations: [],
    ...overrides,
  } as Slide
}

function makeSelection(overrides: Partial<SelectionModel> = {}): SelectionModel {
  return {
    ids: [],
    primary: null,
    replaceWith: vi.fn(),
    addToSelection: vi.fn(),
    removeFromSelection: vi.fn(),
    toggleInSelection: vi.fn(),
    clear: vi.fn(),
    selectAll: vi.fn(),
    setSelection: vi.fn(),
    currentlyInsideGroup: null,
    enterGroup: vi.fn(),
    exitGroup: vi.fn(),
    ...overrides,
  }
}

function makeProps(overrides: Partial<LayersPanelProps> = {}): LayersPanelProps {
  return {
    slide: makeSlide(),
    selection: makeSelection(),
    onRename: vi.fn(),
    onLockToggle: vi.fn(),
    onVisibilityToggle: vi.fn(),
    onReorder: vi.fn(),
    ...overrides,
  }
}

// ─── LP-NEW1: solo decoration ───────────────────────────────────────

describe('LP-NEW1: solo decoration (no group) → 1 decoration chip; no group-header', () => {
  it('LP-NEW1.1: single icon decoration → 1 chip, 0 group-headers', () => {
    const slide = makeSlide({
      decorations: [
        {
          id: 'd-1',
          kind: 'icon',
          lucideName: 'Heart',
          color: '#FF0000',
          strokeWidth: 2,
          position: { x: 10, y: 10, width: 20, height: 20 },
        },
      ],
    })
    render(<LayersPanel {...makeProps({ slide })} />)
    const chips = screen.getAllByTestId('layer-chip')
    expect(chips).toHaveLength(1)
    expect(chips[0].getAttribute('data-element-type')).toBe('decoration')
    // No group-row testid present
    expect(screen.queryAllByTestId('group-row')).toHaveLength(0)
  })

  it('LP-NEW1.2: decoration chip data-element-type === "decoration"', () => {
    const slide = makeSlide({
      decorations: [
        {
          id: 'd-2',
          kind: 'shape',
          shapeKind: 'rect',
          fill: '#000000',
          position: { x: 0, y: 0, width: 50, height: 50 },
        },
      ],
    })
    render(<LayersPanel {...makeProps({ slide })} />)
    const chip = screen.getByTestId('layer-chip')
    expect(chip.getAttribute('data-element-type')).toBe('decoration')
    expect(chip.getAttribute('data-chip-id')).toBe('d-2')
  })

  it('LP-NEW1.3: chip label uses Phase 68 decorationLabel (lucideName for icon)', () => {
    const slide = makeSlide({
      decorations: [
        {
          id: 'd-3',
          kind: 'icon',
          lucideName: 'Star',
          color: '#000',
          strokeWidth: 2,
          position: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
    })
    render(<LayersPanel {...makeProps({ slide })} />)
    expect(screen.getByTestId('chip-label').textContent).toBe('Star')
  })

  it('LP-NEW1.4: clicking chip → selection.replaceWith([d.id])', () => {
    const replaceWith = vi.fn()
    const slide = makeSlide({
      decorations: [
        {
          id: 'd-4',
          kind: 'icon',
          lucideName: 'Bell',
          color: '#000',
          strokeWidth: 2,
          position: { x: 0, y: 0, width: 10, height: 10 },
        },
      ],
    })
    const selection = makeSelection({ replaceWith })
    render(<LayersPanel {...makeProps({ slide, selection })} />)
    const chip = screen.getByTestId('layer-chip')
    fireEvent.click(chip)
    expect(replaceWith).toHaveBeenCalledWith(['d-4'])
  })
})

// ─── LP-NEW2: decoration in group with text_box ─────────────────────

describe('LP-NEW2: decoration grouped with text_box → group-header + 2 chips', () => {
  function lpnew2Slide(opts?: { tbLocked?: boolean; dLocked?: boolean; tbHidden?: boolean; dHidden?: boolean }): Slide {
    return makeSlide({
      text_boxes: [
        {
          id: 'tb-1',
          role: 'hook',
          text: 'Hook',
          position: { anchor: 'top' },
          groupId: 'g_x',
          locked: opts?.tbLocked,
          hidden: opts?.tbHidden,
        } as never,
      ],
      decorations: [
        {
          id: 'd-1',
          kind: 'icon',
          lucideName: 'Heart',
          color: '#FF0000',
          strokeWidth: 2,
          position: { x: 10, y: 10, width: 20, height: 20 },
          groupId: 'g_x',
          locked: opts?.dLocked,
          hidden: opts?.dHidden,
        },
      ],
    })
  }

  it('LP-NEW2.1: 1 group-header + 2 chips (text + decoration) when expanded', () => {
    const slide = lpnew2Slide()
    render(<LayersPanel {...makeProps({ slide })} />)
    // Group-header row present
    const groupRows = screen.queryAllByTestId('group-row')
    expect(groupRows.length).toBeGreaterThanOrEqual(1)
    // Expand the group
    const expandBtn = screen.getByTestId('group-row-toggle')
    fireEvent.click(expandBtn)
    const chips = screen.getAllByTestId('layer-chip')
    expect(chips).toHaveLength(2)
    expect(chips[0].getAttribute('data-element-type')).toBe('text')
    expect(chips[1].getAttribute('data-element-type')).toBe('decoration')
  })

  it('LP-NEW2.2: collapsed group hides BOTH member chips', () => {
    const slide = lpnew2Slide()
    render(<LayersPanel {...makeProps({ slide })} />)
    // Default: collapsed → no chip rows visible
    const chips = screen.queryAllByTestId('layer-chip')
    expect(chips).toHaveLength(0)
  })

  it('LP-NEW2.3: group-header label shows member count of 2 (text_box + decoration)', () => {
    const slide = lpnew2Slide()
    render(<LayersPanel {...makeProps({ slide })} />)
    const groupRow = screen.getByTestId('group-row')
    // Member count surfaced by group-row.tsx as "Group (2)"
    expect(groupRow.textContent ?? '').toContain('Group (2)')
  })

  it('LP-NEW2.4: group lock toggle dispatches onLockToggle with BOTH ids in walk order', () => {
    const onLockToggle = vi.fn()
    const slide = lpnew2Slide()
    render(<LayersPanel {...makeProps({ slide, onLockToggle })} />)
    const lockBtn = screen.getByTestId('group-lock-button')
    fireEvent.click(lockBtn)
    expect(onLockToggle).toHaveBeenCalledTimes(1)
    const [ids, nextLocked] = onLockToggle.mock.calls[0]
    expect(ids).toEqual(['tb-1', 'd-1'])
    expect(nextLocked).toBe(true)
  })

  it('LP-NEW2.5: decoration chip in group has nested indent class (pl-6)', () => {
    const slide = lpnew2Slide()
    render(<LayersPanel {...makeProps({ slide })} />)
    fireEvent.click(screen.getByTestId('group-row-toggle'))
    const chips = screen.getAllByTestId('layer-chip')
    const decoChip = chips.find((c) => c.getAttribute('data-element-type') === 'decoration')
    expect(decoChip).toBeTruthy()
    expect(decoChip?.className).toContain('pl-6')
  })
})

// ─── LP-NEW3: multi-decoration group ─────────────────────────────────

describe('LP-NEW3: multi-decoration group → group-header + N decoration chips', () => {
  function lpnew3Slide(opts?: {
    d1Locked?: boolean
    d2Locked?: boolean
    d1Hidden?: boolean
    d2Hidden?: boolean
  }): Slide {
    return makeSlide({
      decorations: [
        {
          id: 'd-1',
          kind: 'icon',
          lucideName: 'Heart',
          color: '#FF0000',
          strokeWidth: 2,
          position: { x: 10, y: 10, width: 20, height: 20 },
          groupId: 'g_y',
          locked: opts?.d1Locked,
          hidden: opts?.d1Hidden,
        },
        {
          id: 'd-2',
          kind: 'shape',
          shapeKind: 'rect',
          fill: '#000000',
          position: { x: 30, y: 30, width: 20, height: 20 },
          groupId: 'g_y',
          locked: opts?.d2Locked,
          hidden: opts?.d2Hidden,
        },
      ],
    })
  }

  it('LP-NEW3.1: 1 group-header + 2 decoration chips when expanded', () => {
    const slide = lpnew3Slide()
    render(<LayersPanel {...makeProps({ slide })} />)
    expect(screen.getAllByTestId('group-row')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('group-row-toggle'))
    const chips = screen.getAllByTestId('layer-chip')
    expect(chips).toHaveLength(2)
    expect(chips.every((c) => c.getAttribute('data-element-type') === 'decoration')).toBe(true)
  })

  it('LP-NEW3.2: allLocked=true when both decorations locked; group lock button reflects state', () => {
    const slide = lpnew3Slide({ d1Locked: true, d2Locked: true })
    render(<LayersPanel {...makeProps({ slide })} />)
    const lockBtn = screen.getByTestId('group-lock-button')
    expect(lockBtn.getAttribute('data-pressed')).toBe('true')
  })

  it('LP-NEW3.3: allHidden=true when both decorations hidden; group vis button reflects state', () => {
    const slide = lpnew3Slide({ d1Hidden: true, d2Hidden: true })
    render(<LayersPanel {...makeProps({ slide })} />)
    const visBtn = screen.getByTestId('group-vis-button')
    expect(visBtn.getAttribute('data-pressed')).toBe('true')
  })

  it('LP-NEW3.4: allLocked=false when only ONE decoration locked', () => {
    const slide = lpnew3Slide({ d1Locked: true, d2Locked: false })
    render(<LayersPanel {...makeProps({ slide })} />)
    const lockBtn = screen.getByTestId('group-lock-button')
    expect(lockBtn.getAttribute('data-pressed')).toBe('false')
  })

  it('LP-NEW3.5: ungrouped decorations (no groupId) → 2 solo decoration chips, no group-header', () => {
    // Use a slide where decorations have no groupId → solo decorations.
    const slide = makeSlide({
      decorations: [
        {
          id: 'd-1',
          kind: 'icon',
          lucideName: 'Heart',
          color: '#FF0000',
          strokeWidth: 2,
          position: { x: 10, y: 10, width: 20, height: 20 },
        },
        {
          id: 'd-2',
          kind: 'shape',
          shapeKind: 'rect',
          fill: '#000000',
          position: { x: 30, y: 30, width: 20, height: 20 },
        },
      ],
    })
    render(<LayersPanel {...makeProps({ slide })} />)
    expect(screen.queryAllByTestId('group-row')).toHaveLength(0)
    const chips = screen.getAllByTestId('layer-chip')
    expect(chips).toHaveLength(2)
    expect(chips.every((c) => c.getAttribute('data-element-type') === 'decoration')).toBe(true)
  })
})

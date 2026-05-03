import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import LayersPanel from '../layers-panel'
import type { Slide } from '@/lib/types/slide'
import type { SelectionModel } from '@/lib/editor/use-selection-model'

/**
 * Phase 65 Plan 02 (LAYERS-05/06/07 INTEGRATION): full chain proof —
 *   chip-button-click → LayersPanel callback → parent dispatch →
 *   Plan 64-01/02/03 reducer action.
 *
 * The integration test renders LayersPanel with a stubbed `dispatch`
 * spy at the parent level (matching how slide-editor.tsx wires
 * handleLayerLockToggle / handleLayerVisibilityToggle / handleLayerReorder
 * via useCallback). We assert the dispatched action shape exactly —
 * proving the panel surfaces Plan 64 actions through the unified
 * `ids: string[]` contract.
 *
 * PI1: chip-level lock dispatch → SET_LOCKED with ids=[bodyId].
 * PI2: group-level visibility dispatch → SET_HIDDEN with ids=[memberIds...].
 * PI3: chip-level z-order dispatch → Z_ORDER 'forward' on a custom_image.
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
    ...overrides,
  }
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

/**
 * Mirror of the slide-editor.tsx wiring: a small wrapper that holds
 * `selectedIndex` and forwards toggle calls to `dispatch` with the
 * exact reducer-action shape Plan 65-02 ships.
 */
function PanelHarness({
  slide,
  selectedIndex,
  dispatch,
}: {
  slide: Slide
  selectedIndex: number
  dispatch: (action: unknown) => void
}) {
  const handleLockToggle = (ids: string[], nextLocked: boolean) => {
    dispatch({ type: 'SET_LOCKED', slideIndex: selectedIndex, ids, locked: nextLocked })
  }
  const handleVisibilityToggle = (ids: string[], nextHidden: boolean) => {
    dispatch({ type: 'SET_HIDDEN', slideIndex: selectedIndex, ids, hidden: nextHidden })
  }
  const handleReorder = (elementId: string, op: 'forward' | 'backward') => {
    dispatch({ type: 'Z_ORDER', slideIndex: selectedIndex, ids: [elementId], op })
  }

  return (
    <LayersPanel
      slide={slide}
      selection={makeSelection()}
      onRename={vi.fn()}
      onLockToggle={handleLockToggle}
      onVisibilityToggle={handleVisibilityToggle}
      onReorder={handleReorder}
    />
  )
}

describe('Phase 65 Plan 02 (LAYERS-05/06/07): LayersPanel ↔ Plan 64 reducer integration', () => {
  it('PI1: clicking lock on the body chip dispatches SET_LOCKED with ids=[bodyId]', () => {
    const slide = makeSlide({
      text_boxes: [
        { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
        { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
      ],
      custom_images: [
        { id: 'ci-1', url: 'http://x/y.png', x: 10, y: 10, width: 30, height: 30 },
      ],
    })
    const dispatch = vi.fn()
    render(<PanelHarness slide={slide} selectedIndex={0} dispatch={dispatch} />)
    // Find the chip whose data-chip-id matches tb-body
    const chips = screen.getAllByTestId('layer-chip')
    const bodyChip = chips.find((c) => c.getAttribute('data-chip-id') === 'tb-body')
    expect(bodyChip).toBeTruthy()
    const lockBtn = bodyChip!.querySelector('[data-testid="chip-lock-button"]') as HTMLButtonElement
    expect(lockBtn).toBeTruthy()
    fireEvent.click(lockBtn)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: ['tb-body'],
      locked: true,
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('PI2: clicking group-row visibility dispatches SET_HIDDEN with all member ids in a single dispatch', () => {
    const slide = makeSlide({
      text_boxes: [
        {
          id: 'tb-grp-a',
          role: 'hook',
          text: 'A',
          position: { anchor: 'top' },
          groupId: 'g_0_xyz',
        },
        {
          id: 'tb-grp-b',
          role: 'body',
          text: 'B',
          position: { anchor: 'bottom' },
          groupId: 'g_0_xyz',
        },
      ],
    })
    const dispatch = vi.fn()
    render(<PanelHarness slide={slide} selectedIndex={0} dispatch={dispatch} />)
    const visBtn = screen.getByTestId('group-vis-button')
    fireEvent.click(visBtn)
    // Expect ONE dispatch with both member ids
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_HIDDEN',
      slideIndex: 0,
      ids: ['tb-grp-a', 'tb-grp-b'],
      hidden: true,
    })
  })

  it('PI3: clicking up-arrow on the custom_image chip dispatches Z_ORDER forward', () => {
    const slide = makeSlide({
      text_boxes: [
        { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
      ],
      custom_images: [
        { id: 'ci-99', url: 'http://x/img.png', x: 10, y: 10, width: 50, height: 50 },
      ],
    })
    const dispatch = vi.fn()
    render(<PanelHarness slide={slide} selectedIndex={0} dispatch={dispatch} />)
    const chips = screen.getAllByTestId('layer-chip')
    const imgChip = chips.find((c) => c.getAttribute('data-chip-id') === 'ci-99')
    expect(imgChip).toBeTruthy()
    const upBtn = imgChip!.querySelector('[data-testid="chip-reorder-up"]') as HTMLButtonElement
    expect(upBtn).toBeTruthy()
    act(() => {
      fireEvent.click(upBtn)
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['ci-99'],
      op: 'forward',
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
})

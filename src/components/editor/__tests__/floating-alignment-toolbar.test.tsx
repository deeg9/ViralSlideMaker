import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  FloatingAlignmentToolbar,
  type ToolbarAction,
} from '../floating-alignment-toolbar'
import type { AABB } from '@/lib/editor/transforms/selection-bounds'

/**
 * Phase 63 Plan 02 (ALIGN-06, ALIGN-07): FloatingAlignmentToolbar component
 * tests. Pins:
 *
 * Render gate (FT1, FT2, FT3):
 *   - selectionCount === 0 / 1 → returns null (toolbar hidden at N<=1).
 *   - bounds === null → returns null (defensive — even at N>=2, no bounds = no toolbar).
 *   - selectionCount >= 2 + bounds → renders data-testid="floating-alignment-toolbar".
 *
 * Button surface (FT4):
 *   - 6 align buttons + 2 distribute buttons (data-testid="align-{axis}" + "distribute-{axis}").
 *
 * Distribute disable (FT5, FT6, FT7):
 *   - selectionCount === 2 → distribute buttons disabled; align buttons enabled.
 *   - selectionCount === 3 → distribute buttons enabled.
 *   - When disabled: title attribute contains "Select 3+ elements to distribute" (ALIGN-06).
 *
 * Click dispatch (FT8, FT9):
 *   - Click on align-left → onAction({ kind: 'align', axis: 'left' }).
 *   - Click on distribute-horizontal at N=3 → onAction({ kind: 'distribute', axis: 'horizontal' }).
 *
 * No key-object UX (FT10):
 *   - Rendered output never contains 'primary' or 'key object' substrings (PITFALL-12.3).
 *
 * Positioning (FT11, FT12):
 *   - Default position: left = bounds.x + bounds.width/2 - TOOLBAR_WIDTH_PCT/2; top = bounds.y - TOOLBAR_HEIGHT_PCT - 1.
 *   - When top < 0 (bounds.y too close to top edge): drop BELOW bounds (top = bounds.y + bounds.height + 1).
 */

const baseBounds: AABB = { x: 30, y: 40, width: 40, height: 20 }

describe('FloatingAlignmentToolbar — render gate', () => {
  it('FT1: returns null when selectionCount === 1', () => {
    const { container } = render(
      <FloatingAlignmentToolbar
        selectionCount={1}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('FT2: returns null when selectionCount === 0', () => {
    const { container } = render(
      <FloatingAlignmentToolbar
        selectionCount={0}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('FT2b: returns null when bounds === null even at N >= 2', () => {
    const { container } = render(
      <FloatingAlignmentToolbar
        selectionCount={3}
        bounds={null}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('FT3: renders toolbar when selectionCount === 2 and bounds present', () => {
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    expect(screen.getByTestId('floating-alignment-toolbar')).toBeTruthy()
  })
})

describe('FloatingAlignmentToolbar — button surface', () => {
  it('FT4: renders 6 align buttons + 2 distribute buttons with data-testid', () => {
    render(
      <FloatingAlignmentToolbar
        selectionCount={3}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    expect(screen.getByTestId('align-left')).toBeTruthy()
    expect(screen.getByTestId('align-center-h')).toBeTruthy()
    expect(screen.getByTestId('align-right')).toBeTruthy()
    expect(screen.getByTestId('align-top')).toBeTruthy()
    expect(screen.getByTestId('align-center-v')).toBeTruthy()
    expect(screen.getByTestId('align-bottom')).toBeTruthy()
    expect(screen.getByTestId('distribute-horizontal')).toBeTruthy()
    expect(screen.getByTestId('distribute-vertical')).toBeTruthy()
  })
})

describe('FloatingAlignmentToolbar — distribute disable (ALIGN-06)', () => {
  it('FT5: distribute buttons disabled at N=2; align buttons enabled', () => {
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const distH = screen.getByTestId('distribute-horizontal') as HTMLButtonElement
    const distV = screen.getByTestId('distribute-vertical') as HTMLButtonElement
    expect(distH.disabled).toBe(true)
    expect(distV.disabled).toBe(true)

    const alignL = screen.getByTestId('align-left') as HTMLButtonElement
    const alignR = screen.getByTestId('align-right') as HTMLButtonElement
    expect(alignL.disabled).toBe(false)
    expect(alignR.disabled).toBe(false)
  })

  it('FT6: distribute buttons enabled at N=3', () => {
    render(
      <FloatingAlignmentToolbar
        selectionCount={3}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const distH = screen.getByTestId('distribute-horizontal') as HTMLButtonElement
    const distV = screen.getByTestId('distribute-vertical') as HTMLButtonElement
    expect(distH.disabled).toBe(false)
    expect(distV.disabled).toBe(false)
  })

  it('FT7: distribute buttons carry tooltip "Select 3+ elements to distribute" when disabled', () => {
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const distH = screen.getByTestId('distribute-horizontal')
    const distV = screen.getByTestId('distribute-vertical')
    // Either title or aria-label must mention the requirement.
    const distHText =
      (distH.getAttribute('title') ?? '') + (distH.getAttribute('aria-label') ?? '')
    const distVText =
      (distV.getAttribute('title') ?? '') + (distV.getAttribute('aria-label') ?? '')
    expect(distHText).toMatch(/Select 3\+ elements to distribute/)
    expect(distVText).toMatch(/Select 3\+ elements to distribute/)
  })
})

describe('FloatingAlignmentToolbar — onAction dispatch', () => {
  it('FT8: clicking align-left fires onAction({ kind: "align", axis: "left" })', () => {
    const onAction = vi.fn<(a: ToolbarAction) => void>()
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={baseBounds}
        onAction={onAction}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    fireEvent.click(screen.getByTestId('align-left'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({ kind: 'align', axis: 'left' })
  })

  it('FT8b: clicking each of the 6 align buttons fires the matching axis', () => {
    const onAction = vi.fn<(a: ToolbarAction) => void>()
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={baseBounds}
        onAction={onAction}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const axes: Array<'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom'> = [
      'left', 'center-h', 'right', 'top', 'center-v', 'bottom',
    ]
    for (const ax of axes) {
      onAction.mockClear()
      fireEvent.click(screen.getByTestId(`align-${ax}`))
      expect(onAction).toHaveBeenCalledTimes(1)
      expect(onAction).toHaveBeenCalledWith({ kind: 'align', axis: ax })
    }
  })

  it('FT9: clicking distribute-horizontal at N=3 fires onAction({ kind: "distribute", axis: "horizontal" })', () => {
    const onAction = vi.fn<(a: ToolbarAction) => void>()
    render(
      <FloatingAlignmentToolbar
        selectionCount={3}
        bounds={baseBounds}
        onAction={onAction}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    fireEvent.click(screen.getByTestId('distribute-horizontal'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({ kind: 'distribute', axis: 'horizontal' })
  })

  it('FT9b: clicking distribute-vertical at N=3 fires distribute/vertical', () => {
    const onAction = vi.fn<(a: ToolbarAction) => void>()
    render(
      <FloatingAlignmentToolbar
        selectionCount={3}
        bounds={baseBounds}
        onAction={onAction}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    fireEvent.click(screen.getByTestId('distribute-vertical'))
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(onAction).toHaveBeenCalledWith({ kind: 'distribute', axis: 'vertical' })
  })

  it('FT9c: clicking disabled distribute button at N=2 does NOT fire onAction', () => {
    const onAction = vi.fn<(a: ToolbarAction) => void>()
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={baseBounds}
        onAction={onAction}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    fireEvent.click(screen.getByTestId('distribute-horizontal'))
    expect(onAction).not.toHaveBeenCalled()
  })
})

describe('FloatingAlignmentToolbar — no key-object UX (PITFALL-12.3)', () => {
  it('FT10: rendered output never contains "primary" or "key object" substrings', () => {
    const { container } = render(
      <FloatingAlignmentToolbar
        selectionCount={3}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const html = container.innerHTML.toLowerCase()
    expect(html).not.toContain('primary')
    expect(html).not.toContain('key object')
  })
})

describe('FloatingAlignmentToolbar — positioning', () => {
  it('FT11: default position above bounds — left + top reflect bounds geometry', () => {
    // bounds: x=30, y=40, width=40, height=20 → far enough from top edge.
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={baseBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const tb = screen.getByTestId('floating-alignment-toolbar') as HTMLElement
    // Style was set via inline style. Read width/left/top in % (string).
    // left = clamp(bounds.x + bounds.width/2 - TOOLBAR_WIDTH_PCT/2, 0, 100 - TOOLBAR_WIDTH_PCT)
    //      = clamp(30 + 20 - 15, 0, 70) = clamp(35, 0, 70) = 35
    expect(tb.style.left).toBe('35%')
    // top = bounds.y - TOOLBAR_HEIGHT_PCT - 1 = 40 - 4 - 1 = 35 (above bounds)
    expect(tb.style.top).toBe('35%')
    expect(tb.style.position).toBe('absolute')
  })

  it('FT12: clamps to drop BELOW bounds when there is no room above', () => {
    // bounds.y = 2 → no room above (TOOLBAR_HEIGHT_PCT + 1 = 5 > 2). Should drop below.
    const tightBounds: AABB = { x: 30, y: 2, width: 40, height: 20 }
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={tightBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const tb = screen.getByTestId('floating-alignment-toolbar') as HTMLElement
    // top = bounds.y + bounds.height + 1 = 2 + 20 + 1 = 23
    expect(tb.style.top).toBe('23%')
  })

  it('FT11b: clamps left to 0 when bounds is far left', () => {
    const leftBounds: AABB = { x: 0, y: 40, width: 4, height: 20 }
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={leftBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const tb = screen.getByTestId('floating-alignment-toolbar') as HTMLElement
    // left = clamp(0 + 2 - 15, 0, 70) = clamp(-13, 0, 70) = 0
    expect(tb.style.left).toBe('0%')
  })

  it('FT11c: clamps left to (canvasWidthPct - TOOLBAR_WIDTH_PCT) when bounds is far right', () => {
    const rightBounds: AABB = { x: 95, y: 40, width: 4, height: 20 }
    render(
      <FloatingAlignmentToolbar
        selectionCount={2}
        bounds={rightBounds}
        onAction={vi.fn()}
        canvasWidthPct={100}
        canvasHeightPct={100}
      />,
    )
    const tb = screen.getByTestId('floating-alignment-toolbar') as HTMLElement
    // left = clamp(95 + 2 - 15, 0, 70) = clamp(82, 0, 70) = 70
    expect(tb.style.left).toBe('70%')
  })
})

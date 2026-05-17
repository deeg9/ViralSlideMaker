/**
 * quick-260514-jn5: ElementsPanel two-mode contract.
 *
 *   1. Library mode (no activeDecoration): inserts UI for icons, shapes,
 *      lines & dividers.
 *   2. Selection mode (activeDecoration present): renders <DecorationCard>
 *      with edit + delete controls — this is where decoration editing now
 *      lives (moved out of the Text tab).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ElementsPanel } from '../elements-panel'
import type { Decoration, ShapeDecoration } from '@/lib/types/decoration'
import type { TextBox } from '@/lib/types/slide'

const DECO_SHAPE: ShapeDecoration = {
  id: 'd-shape',
  kind: 'shape',
  shapeKind: 'rect',
  fill: '#FF0000',
  position: { x: 0, y: 0, width: 10, height: 10 },
}

const TEXT_BOX: TextBox = {
  id: 'tb-1',
  role: 'hook',
  text: 'Hello',
  position: { anchor: 'top' },
  effects: {
    highlight: { enabled: true, color: '#3d000088', style: 'tight', padding: 8 },
  },
}

describe('ElementsPanel', () => {
  describe('library mode (no decoration selected)', () => {
    it('renders icon + shape picker buttons and divider tiles', () => {
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          onOpenIconPicker={vi.fn()}
          onOpenShapePicker={vi.fn()}
        />,
      )
      expect(container.querySelector('[data-testid="elements-panel-open-icons"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="elements-panel-open-shapes"]')).toBeTruthy()
      // DecorationCard NOT visible.
      expect(container.querySelector('[data-testid="decoration-card"]')).toBeNull()
    })

    it('clicking the icons button calls onOpenIconPicker', () => {
      const onOpenIconPicker = vi.fn()
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          onOpenIconPicker={onOpenIconPicker}
        />,
      )
      const btn = container.querySelector(
        '[data-testid="elements-panel-open-icons"]',
      ) as HTMLButtonElement
      btn.click()
      expect(onOpenIconPicker).toHaveBeenCalledTimes(1)
    })

    it('clicking the shapes button calls onOpenShapePicker', () => {
      const onOpenShapePicker = vi.fn()
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          onOpenShapePicker={onOpenShapePicker}
        />,
      )
      const btn = container.querySelector(
        '[data-testid="elements-panel-open-shapes"]',
      ) as HTMLButtonElement
      btn.click()
      expect(onOpenShapePicker).toHaveBeenCalledTimes(1)
    })
  })

  describe('selection mode (activeDecoration present)', () => {
    it('renders DecorationCard instead of the library', () => {
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          activeDecoration={DECO_SHAPE as Decoration}
          onDecorationUpdate={vi.fn()}
          onDecorationRemove={vi.fn()}
          onOpenIconPicker={vi.fn()}
          onOpenShapePicker={vi.fn()}
        />,
      )
      expect(container.querySelector('[data-testid="decoration-card"]')).toBeTruthy()
      // Library tiles NOT visible in selection mode.
      expect(container.querySelector('[data-testid="elements-panel-open-icons"]')).toBeNull()
    })

    it('clicking a stroke style button routes through onDecorationUpdate', () => {
      const onDecorationUpdate = vi.fn()
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          activeDecoration={DECO_SHAPE as Decoration}
          onDecorationUpdate={onDecorationUpdate}
          onDecorationRemove={vi.fn()}
        />,
      )
      const dashed = container.querySelector(
        '[data-testid="decoration-stroke-style-dashed"]',
      ) as HTMLElement
      dashed.click()
      expect(onDecorationUpdate).toHaveBeenCalledTimes(1)
      const arg = onDecorationUpdate.mock.calls[0][0]
      expect(arg.stroke).toBeDefined()
      expect(arg.stroke.style).toBe('dashed')
    })

    it('renders a delete button that calls onDecorationRemove', () => {
      const onDecorationRemove = vi.fn()
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          activeDecoration={DECO_SHAPE as Decoration}
          onDecorationUpdate={vi.fn()}
          onDecorationRemove={onDecorationRemove}
        />,
      )
      const del = container.querySelector(
        '[data-testid="decoration-card-delete"]',
      ) as HTMLButtonElement | null
      expect(del).toBeTruthy()
      fireEvent.click(del!)
      expect(onDecorationRemove).toHaveBeenCalledTimes(1)
    })
  })

  // quick-260517-fu9: the "Text Background" card surfaces the existing
  // text-background (highlight) color control under the Elements tab. It is
  // text-box-scoped — it appears only when an active text box is provided,
  // and it must not depend on the slide/template/onSlideUpdate guards that
  // gate the Caption Bar + Watermark cards.
  describe('Text Background card (quick-260517-fu9)', () => {
    it('renders the card when a text box is the active selection', () => {
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          activeTextBox={TEXT_BOX}
          onTextBoxHighlightUpdate={vi.fn()}
        />,
      )
      expect(
        container.querySelector('[data-testid="elements-text-background-card"]'),
      ).toBeTruthy()
      // It mounts the extracted TextBackgroundControls (testids preserved).
      expect(
        container.querySelector('[data-testid="highlight-color-row"]'),
      ).toBeTruthy()
    })

    it('does not render the card when no text box is selected', () => {
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          activeTextBox={null}
          onTextBoxHighlightUpdate={vi.fn()}
        />,
      )
      expect(
        container.querySelector('[data-testid="elements-text-background-card"]'),
      ).toBeNull()
    })

    it('appears even without slide/template/onSlideUpdate (own conditional)', () => {
      // The Caption Bar + Watermark cards are gated on slide && template &&
      // onSlideUpdate. The Text Background card must NOT inherit that guard.
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          activeTextBox={TEXT_BOX}
          onTextBoxHighlightUpdate={vi.fn()}
        />,
      )
      expect(
        container.querySelector('[data-testid="elements-text-background-card"]'),
      ).toBeTruthy()
    })

    it('changing the color routes a merged highlight through onTextBoxHighlightUpdate', () => {
      const onTextBoxHighlightUpdate = vi.fn()
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          activeTextBox={TEXT_BOX}
          onTextBoxHighlightUpdate={onTextBoxHighlightUpdate}
        />,
      )
      const firstSwatch = container.querySelector(
        '[data-testid="elements-text-background-card"] [data-testid="highlight-color-row"] button',
      ) as HTMLButtonElement
      fireEvent.click(firstSwatch)
      expect(onTextBoxHighlightUpdate).toHaveBeenCalledTimes(1)
      // first swatch '#ffffff' → '#ffffff88'; merged with existing fields.
      expect(onTextBoxHighlightUpdate).toHaveBeenCalledWith({
        enabled: true,
        color: '#ffffff88',
        style: 'tight',
        padding: 8,
      })
    })

    it('also renders in selection mode when a decoration is active', () => {
      const { container } = render(
        <ElementsPanel
          templateTextColor="#3d0000"
          onInsertDivider={vi.fn()}
          activeDecoration={DECO_SHAPE as Decoration}
          onDecorationUpdate={vi.fn()}
          onDecorationRemove={vi.fn()}
          activeTextBox={TEXT_BOX}
          onTextBoxHighlightUpdate={vi.fn()}
        />,
      )
      expect(
        container.querySelector('[data-testid="elements-text-background-card"]'),
      ).toBeTruthy()
    })
  })
})

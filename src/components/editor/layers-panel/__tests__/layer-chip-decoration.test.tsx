import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LayerChip } from '../layer-chip'
import type { LayerChipProps, LayerChipRow } from '../types'
import type { Decoration, IconDecoration, ShapeDecoration } from '@/lib/types/decoration'

/**
 * Phase 70 Plan 05 (PARITY-18 — LP-NEW1..3):
 * LayerChip decoration glyph rendering tests.
 *
 * Verifies that when row.elementType === 'decoration' AND a decoration prop
 * is populated, the chip renders a 16×16 miniature glyph via Phase 69
 * `renderDecoration` — single-source-of-truth (TPLREND-05). When the
 * decoration prop is null/undefined (stale id), the chip falls back to a
 * material-icon glyph (e.g. 'category').
 */

function makeChipRow(overrides: Partial<LayerChipRow> = {}): LayerChipRow {
  return {
    kind: 'chip',
    id: 'd-1',
    elementType: 'decoration',
    label: 'ArrowRight',
    locked: false,
    hidden: false,
    ...overrides,
  }
}

function makeIconDecoration(overrides: Partial<IconDecoration> = {}): IconDecoration {
  return {
    id: 'd-1',
    kind: 'icon',
    lucideName: 'ArrowRight',
    color: '#3D0000',
    strokeWidth: 2,
    position: { x: 10, y: 10, width: 20, height: 20 },
    ...overrides,
  }
}

function makeRectDecoration(overrides: Partial<ShapeDecoration> = {}): ShapeDecoration {
  return {
    id: 'd-2',
    kind: 'shape',
    shapeKind: 'rect',
    fill: '#FF0000',
    position: { x: 0, y: 0, width: 30, height: 30 },
    ...(overrides as Partial<ShapeDecoration>),
  } as ShapeDecoration
}

function makeTriangleDecoration(overrides: Partial<ShapeDecoration> = {}): ShapeDecoration {
  return {
    id: 'd-3',
    kind: 'shape',
    shapeKind: 'triangle',
    fill: '#00FF00',
    position: { x: 0, y: 0, width: 30, height: 30 },
    ...(overrides as Partial<ShapeDecoration>),
  } as ShapeDecoration
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
    decoration: null,
    ...overrides,
  }
}

describe('Phase 70 Plan 05 (PARITY-18): LayerChip decoration glyph', () => {
  it('LCD1: row.elementType=decoration + decoration prop populated → renders 16×16 glyph container', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-1' }),
      decoration: makeIconDecoration({ id: 'd-1' }),
    })
    render(<LayerChip {...props} />)
    const glyph = screen.getByTestId('chip-decoration-glyph-d-1')
    expect(glyph).toBeTruthy()
  })

  it('LCD2: glyph container houses the renderDecoration output with data-decoration-id matching d.id', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-1' }),
      decoration: makeIconDecoration({ id: 'd-1' }),
    })
    const { container } = render(<LayerChip {...props} />)
    const inner = container.querySelector('[data-decoration-id="d-1"]')
    expect(inner).toBeTruthy()
  })

  it('LCD3: row.elementType=decoration + decoration prop=null → falls back to material category icon (no glyph testid)', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-stale' }),
      decoration: null,
    })
    render(<LayerChip {...props} />)
    expect(screen.queryByTestId('chip-decoration-glyph-d-stale')).toBeNull()
    // Chip still renders normally (label visible)
    expect(screen.getByTestId('chip-label')).toBeTruthy()
  })

  it('LCD4: icon decoration → glyph contains an <img> with data:image/svg+xml URI', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-1', label: 'Heart' }),
      decoration: makeIconDecoration({ id: 'd-1', lucideName: 'Heart' }),
    })
    const { container } = render(<LayerChip {...props} />)
    const img = container.querySelector('[data-decoration-id="d-1"] img')
    expect(img).toBeTruthy()
    const src = img?.getAttribute('src') ?? ''
    expect(src.startsWith('data:image/svg+xml')).toBe(true)
  })

  it('LCD5: shape decoration (rect) → glyph IS a CSS-styled div (no <img>) with the fill color', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-2', label: 'Rectangle' }),
      decoration: makeRectDecoration({ id: 'd-2', fill: '#FF0000' }),
    })
    const { container } = render(<LayerChip {...props} />)
    const inner = container.querySelector('[data-decoration-id="d-2"]') as HTMLElement | null
    expect(inner).toBeTruthy()
    // No img child for CSS-div shape
    expect(inner?.querySelector('img')).toBeNull()
    // Background hex emitted on inline style
    const style = inner?.getAttribute('style') ?? ''
    expect(style.toLowerCase()).toContain('rgb(255, 0, 0)')
  })

  it('LCD6: shape decoration (triangle) → glyph IS an <img> with src ending in /shapes/triangle.svg', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-3', label: 'Triangle' }),
      decoration: makeTriangleDecoration({ id: 'd-3' }),
    })
    const { container } = render(<LayerChip {...props} />)
    const img = container.querySelector('[data-decoration-id="d-3"] img') as HTMLImageElement | null
    expect(img).toBeTruthy()
    const src = img?.getAttribute('src') ?? ''
    expect(src).toContain('/shapes/triangle.svg')
  })

  it('LCD7: locked decoration chip → glyph still renders + lock button shows locked visual state', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-1', locked: true }),
      decoration: makeIconDecoration({ id: 'd-1' }),
    })
    render(<LayerChip {...props} />)
    expect(screen.getByTestId('chip-decoration-glyph-d-1')).toBeTruthy()
    const lockBtn = screen.getByTestId('chip-lock-button')
    expect(lockBtn.getAttribute('data-pressed')).toBe('true')
  })

  it('LCD8: hidden decoration chip → glyph still renders (chip is editor-only; hidden affects canvas, not chip)', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-1', hidden: true }),
      decoration: makeIconDecoration({ id: 'd-1' }),
    })
    render(<LayerChip {...props} />)
    expect(screen.getByTestId('chip-decoration-glyph-d-1')).toBeTruthy()
    const visBtn = screen.getByTestId('chip-vis-button')
    expect(visBtn.getAttribute('data-pressed')).toBe('true')
  })

  it('LCD9: chip label = row.label (synthesizeRows already supplies decorationLabel)', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-1', label: 'My Star' }),
      decoration: makeIconDecoration({ id: 'd-1', lucideName: 'Star' }),
    })
    render(<LayerChip {...props} />)
    expect(screen.getByTestId('chip-label').textContent).toBe('My Star')
  })

  it('LCD10: data-element-type on outer chip === "decoration"', () => {
    const props = makeProps({
      row: makeChipRow({ id: 'd-1', elementType: 'decoration' }),
      decoration: makeIconDecoration({ id: 'd-1' }),
    })
    render(<LayerChip {...props} />)
    const chip = screen.getByTestId('layer-chip')
    expect(chip.getAttribute('data-element-type')).toBe('decoration')
  })
})

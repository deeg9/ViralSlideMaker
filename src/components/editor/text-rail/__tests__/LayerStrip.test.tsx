import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayerStrip } from '../LayerStrip'
import type { TextBox } from '@/lib/types/slide'

function makeBox(id: string, role: TextBox['role'], text: string): TextBox {
  return {
    id,
    role,
    text,
    position: { anchor: 'top' },
  }
}

/**
 * quick-260514-l1p: LayerStrip is now a dropdown. The closed state shows
 * the active text box on the trigger button; the open state lists every
 * text box plus an "+ Add Text Box" item. Tests open the dropdown first
 * before asserting on the items.
 */
describe('<LayerStrip>', () => {
  it('renders the trigger button with the active text box label (closed state)', () => {
    const boxes = [
      makeBox('a', 'hook', 'Hello world'),
      makeBox('b', 'body', 'A body line here'),
    ]
    render(
      <LayerStrip
        textBoxes={boxes}
        selectedTextBoxId="a"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    const trigger = screen.getByTestId('layer-strip-toggle')
    expect(trigger).toBeInTheDocument()
    expect(trigger.textContent).toContain('Hello world')
    // Menu items are not in the DOM when closed.
    expect(screen.queryByTestId('layer-chip-a')).toBeNull()
    expect(screen.queryByTestId('layer-strip-add')).toBeNull()
  })

  it('opening the dropdown renders one row per text box + the Add item', () => {
    const boxes = [
      makeBox('a', 'hook', 'Hello world'),
      makeBox('b', 'body', 'A body line here'),
    ]
    render(
      <LayerStrip
        textBoxes={boxes}
        selectedTextBoxId="a"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('layer-strip-toggle'))
    expect(screen.getByTestId('layer-chip-a')).toBeInTheDocument()
    expect(screen.getByTestId('layer-chip-b')).toBeInTheDocument()
    expect(screen.getByTestId('layer-strip-add')).toBeInTheDocument()
  })

  it('marks the active row via data-active and aria-selected', () => {
    const boxes = [makeBox('a', 'hook', 'A'), makeBox('b', 'body', 'B')]
    render(
      <LayerStrip
        textBoxes={boxes}
        selectedTextBoxId="b"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('layer-strip-toggle'))
    expect(screen.getByTestId('layer-chip-b')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('layer-chip-b')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('layer-chip-a')).toHaveAttribute('data-active', 'false')
  })

  it('truncates long trigger text with an ellipsis', () => {
    const boxes = [
      makeBox(
        'a',
        'hook',
        'This is a very long hook line that should be truncated',
      ),
    ]
    render(
      <LayerStrip
        textBoxes={boxes}
        selectedTextBoxId="a"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    const trigger = screen.getByTestId('layer-strip-toggle')
    expect(trigger.textContent).toMatch(/This is a very long hook[…]/)
  })

  it('renders "(empty)" placeholder for empty text on the trigger', () => {
    const boxes = [makeBox('a', 'custom', '   ')]
    render(
      <LayerStrip
        textBoxes={boxes}
        selectedTextBoxId="a"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    const trigger = screen.getByTestId('layer-strip-toggle')
    expect(trigger.textContent).toMatch(/\(empty\)/)
  })

  it('calls onSelect with row id when a menu row is clicked, then closes', () => {
    const onSelect = vi.fn()
    const boxes = [makeBox('a', 'hook', 'A'), makeBox('b', 'body', 'B')]
    render(
      <LayerStrip
        textBoxes={boxes}
        selectedTextBoxId="a"
        onSelect={onSelect}
        onAdd={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('layer-strip-toggle'))
    fireEvent.click(screen.getByTestId('layer-chip-b'))
    expect(onSelect).toHaveBeenCalledWith('b')
    // Menu closes after a selection.
    expect(screen.queryByTestId('layer-chip-a')).toBeNull()
  })

  it('calls onAdd when the Add item is clicked, then closes', () => {
    const onAdd = vi.fn()
    const boxes = [makeBox('a', 'hook', 'A')]
    render(
      <LayerStrip
        textBoxes={boxes}
        selectedTextBoxId="a"
        onSelect={vi.fn()}
        onAdd={onAdd}
      />,
    )
    fireEvent.click(screen.getByTestId('layer-strip-toggle'))
    fireEvent.click(screen.getByTestId('layer-strip-add'))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('layer-strip-add')).toBeNull()
  })

  it('handles empty textBoxes array — trigger shows placeholder; menu shows only Add', () => {
    render(
      <LayerStrip
        textBoxes={[]}
        selectedTextBoxId={null}
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    const trigger = screen.getByTestId('layer-strip-toggle')
    expect(trigger.textContent).toContain('No text box')
    fireEvent.click(trigger)
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.getByTestId('layer-strip-add')).toBeInTheDocument()
  })

  it('toggle aria-expanded reflects open state', () => {
    render(
      <LayerStrip
        textBoxes={[makeBox('a', 'hook', 'A')]}
        selectedTextBoxId="a"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    const trigger = screen.getByTestId('layer-strip-toggle')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})

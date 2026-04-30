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

describe('<LayerStrip>', () => {
  it('renders one chip per TextBox plus the Add chip', () => {
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
    expect(screen.getByTestId('layer-chip-a')).toBeInTheDocument()
    expect(screen.getByTestId('layer-chip-b')).toBeInTheDocument()
    expect(screen.getByTestId('layer-strip-add')).toBeInTheDocument()
  })

  it('marks the active chip via data-active and aria-selected', () => {
    const boxes = [makeBox('a', 'hook', 'A'), makeBox('b', 'body', 'B')]
    render(
      <LayerStrip
        textBoxes={boxes}
        selectedTextBoxId="b"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
      />,
    )
    expect(screen.getByTestId('layer-chip-b')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('layer-chip-b')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('layer-chip-a')).toHaveAttribute('data-active', 'false')
  })

  it('truncates long text to ~16 chars with an ellipsis', () => {
    const boxes = [makeBox('a', 'hook', 'This is a very long hook line that should be truncated')]
    render(
      <LayerStrip textBoxes={boxes} selectedTextBoxId={null} onSelect={vi.fn()} onAdd={vi.fn()} />,
    )
    const chip = screen.getByTestId('layer-chip-a')
    expect(chip.textContent).toMatch(/This is a very l[…]/)
  })

  it('renders "(empty)" placeholder for empty text', () => {
    const boxes = [makeBox('a', 'custom', '   ')]
    render(
      <LayerStrip textBoxes={boxes} selectedTextBoxId={null} onSelect={vi.fn()} onAdd={vi.fn()} />,
    )
    expect(screen.getByTestId('layer-chip-a').textContent).toMatch(/\(empty\)/)
  })

  it('calls onSelect with chip id when chip is clicked', () => {
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
    fireEvent.click(screen.getByTestId('layer-chip-b'))
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('calls onAdd when the Add chip is clicked', () => {
    const onAdd = vi.fn()
    render(
      <LayerStrip textBoxes={[]} selectedTextBoxId={null} onSelect={vi.fn()} onAdd={onAdd} />,
    )
    fireEvent.click(screen.getByTestId('layer-strip-add'))
    expect(onAdd).toHaveBeenCalledTimes(1)
  })

  it('handles empty textBoxes array — only Add chip rendered', () => {
    render(
      <LayerStrip textBoxes={[]} selectedTextBoxId={null} onSelect={vi.fn()} onAdd={vi.fn()} />,
    )
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByTestId('layer-strip-add')).toBeInTheDocument()
  })
})

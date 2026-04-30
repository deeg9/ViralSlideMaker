import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EffectRow } from '../EffectRow'

describe('<EffectRow>', () => {
  it('renders label and a switch', () => {
    render(<EffectRow label="Shadow" enabled={false} onToggle={vi.fn()} />)
    expect(screen.getByText('Shadow')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('does NOT render children when disabled', () => {
    render(
      <EffectRow label="Shadow" enabled={false} onToggle={vi.fn()}>
        <span data-testid="hidden-child">should not appear</span>
      </EffectRow>,
    )
    expect(screen.queryByTestId('hidden-child')).toBeNull()
    expect(screen.queryByTestId('effect-row-shadow-content')).toBeNull()
  })

  it('renders children when enabled', () => {
    render(
      <EffectRow label="Shadow" enabled={true} onToggle={vi.fn()}>
        <span data-testid="visible-child">visible</span>
      </EffectRow>,
    )
    expect(screen.getByTestId('visible-child')).toBeInTheDocument()
    expect(screen.getByTestId('effect-row-shadow-content')).toBeInTheDocument()
  })

  it('calls onToggle with !enabled when the switch is clicked', () => {
    const onToggle = vi.fn()
    render(<EffectRow label="Outline" enabled={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('calls onToggle(false) when toggling off', () => {
    const onToggle = vi.fn()
    render(<EffectRow label="Highlight" enabled={true} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it('exposes data-enabled attribute reflecting current state', () => {
    const { rerender } = render(
      <EffectRow label="Shadow" enabled={false} onToggle={vi.fn()} />,
    )
    expect(screen.getByTestId('effect-row-shadow')).toHaveAttribute('data-enabled', 'false')
    rerender(<EffectRow label="Shadow" enabled={true} onToggle={vi.fn()} />)
    expect(screen.getByTestId('effect-row-shadow')).toHaveAttribute('data-enabled', 'true')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccentWordsDisclosure } from '../AccentWordsDisclosure'
import type { TextSegment } from '@/lib/types/slide'

const SEGMENTS: TextSegment[] = [
  { text: 'Hello', accent: false },
  { text: 'World', accent: true },
  { text: 'Now', accent: false },
]

describe('<AccentWordsDisclosure>', () => {
  it('is collapsed by default — no chips rendered', () => {
    render(
      <AccentWordsDisclosure
        segments={SEGMENTS}
        onToggle={vi.fn()}
        accentColor="#C8FF00"
      />,
    )
    expect(screen.queryByTestId('accent-words-chips')).toBeNull()
    expect(screen.getByTestId('accent-words-disclosure')).toHaveAttribute(
      'data-state',
      'closed',
    )
  })

  it('expands when the trigger is clicked', () => {
    render(
      <AccentWordsDisclosure
        segments={SEGMENTS}
        onToggle={vi.fn()}
        accentColor="#C8FF00"
      />,
    )
    fireEvent.click(screen.getByTestId('accent-words-trigger'))
    expect(screen.getByTestId('accent-words-chips')).toBeInTheDocument()
    expect(screen.getByTestId('accent-words-disclosure')).toHaveAttribute(
      'data-state',
      'open',
    )
  })

  it('shows a count badge when ≥ 1 segment is accented', () => {
    render(
      <AccentWordsDisclosure
        segments={SEGMENTS}
        onToggle={vi.fn()}
        accentColor="#C8FF00"
      />,
    )
    const badge = screen.getByTestId('accent-words-count-badge')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toMatch(/1 highlighted/)
  })

  it('hides the count badge when 0 segments are accented', () => {
    const allOff: TextSegment[] = SEGMENTS.map((s) => ({ ...s, accent: false }))
    render(
      <AccentWordsDisclosure
        segments={allOff}
        onToggle={vi.fn()}
        accentColor="#C8FF00"
      />,
    )
    expect(screen.queryByTestId('accent-words-count-badge')).toBeNull()
  })

  it('calls onToggle(index) when a chip is clicked', () => {
    const onToggle = vi.fn()
    render(
      <AccentWordsDisclosure
        segments={SEGMENTS}
        onToggle={onToggle}
        accentColor="#C8FF00"
      />,
    )
    fireEvent.click(screen.getByTestId('accent-words-trigger'))
    fireEvent.click(screen.getByTestId('accent-word-chip-2'))
    expect(onToggle).toHaveBeenCalledWith(2)
  })

  it('marks accented chips via data-active', () => {
    render(
      <AccentWordsDisclosure
        segments={SEGMENTS}
        onToggle={vi.fn()}
        accentColor="#C8FF00"
      />,
    )
    fireEvent.click(screen.getByTestId('accent-words-trigger'))
    expect(screen.getByTestId('accent-word-chip-0')).toHaveAttribute('data-active', 'false')
    expect(screen.getByTestId('accent-word-chip-1')).toHaveAttribute('data-active', 'true')
    expect(screen.getByTestId('accent-word-chip-2')).toHaveAttribute('data-active', 'false')
  })
})

// Phase 76 Plan 02 (PREVIEW-06):
// PerAspectToggles 4-checkbox group tests.
//
// 6 tests: 4 checkboxes labeled, defaults reflect state, click dispatches
// TOGGLE_ASPECT, htmlFor/id pairs (a11y), fieldset aria-label, and the
// PREVIEW-06 enforcement-parity hint when zero are checked.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PerAspectToggles } from '../per-aspect-toggles'
import type { SpecPreviewAspects } from '../state-machine'

const ALL_ON: SpecPreviewAspects = { palette: true, typography: true, layout: true, decorations: true }
const ALL_OFF: SpecPreviewAspects = { palette: false, typography: false, layout: false, decorations: false }

describe('Phase 76 Plan 02: PerAspectToggles (PREVIEW-06)', () => {
  it('Test 1: renders 4 checkboxes labeled Palette / Typography / Layout / Decorations', () => {
    render(<PerAspectToggles aspects={ALL_ON} dispatch={vi.fn()} />)
    expect(screen.getByLabelText('Palette')).toBeTruthy()
    expect(screen.getByLabelText('Typography')).toBeTruthy()
    expect(screen.getByLabelText('Layout')).toBeTruthy()
    expect(screen.getByLabelText('Decorations')).toBeTruthy()
    const inputs = screen.getAllByRole('checkbox')
    expect(inputs).toHaveLength(4)
  })

  it('Test 2: defaults from state.aspects render checkboxes correctly', () => {
    const partial: SpecPreviewAspects = { palette: false, typography: true, layout: true, decorations: false }
    render(<PerAspectToggles aspects={partial} dispatch={vi.fn()} />)
    expect((screen.getByLabelText('Palette') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('Typography') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Layout') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Decorations') as HTMLInputElement).checked).toBe(false)
  })

  it('Test 3: clicking a checkbox dispatches TOGGLE_ASPECT exactly once with the correct aspect key', () => {
    const dispatch = vi.fn()
    render(<PerAspectToggles aspects={ALL_ON} dispatch={dispatch} />)
    fireEvent.click(screen.getByLabelText('Palette'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ASPECT', aspect: 'palette' })

    dispatch.mockClear()
    fireEvent.click(screen.getByLabelText('Decorations'))
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_ASPECT', aspect: 'decorations' })
  })

  it('Test 4: each checkbox has htmlFor/id pair so getByLabelText returns the input', () => {
    render(<PerAspectToggles aspects={ALL_ON} dispatch={vi.fn()} />)
    const palette = screen.getByLabelText('Palette') as HTMLInputElement
    expect(palette.tagName.toLowerCase()).toBe('input')
    expect(palette.type).toBe('checkbox')
    expect(palette.id.length).toBeGreaterThan(0)
  })

  it('Test 5: fieldset has aria-label "Choose which extracted aspects to apply"', () => {
    const { container } = render(<PerAspectToggles aspects={ALL_ON} dispatch={vi.fn()} />)
    const fieldset = container.querySelector('fieldset')
    expect(fieldset).toBeTruthy()
    expect(fieldset?.getAttribute('aria-label')).toBe('Choose which extracted aspects to apply')
  })

  it('Test 6: PREVIEW-06 enforcement parity — zero checked renders a hint near the group', () => {
    const { rerender, container } = render(
      <PerAspectToggles aspects={ALL_ON} dispatch={vi.fn()} />,
    )
    // Hint absent when at least one checked
    expect(container.querySelector('[data-testid="aspect-empty-hint"]')).toBeNull()

    rerender(<PerAspectToggles aspects={ALL_OFF} dispatch={vi.fn()} />)
    const hint = screen.getByTestId('aspect-empty-hint')
    expect(hint).toBeTruthy()
    expect(hint.textContent).toMatch(/select at least one aspect to generate/i)
  })
})

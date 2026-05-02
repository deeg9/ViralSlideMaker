import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideCanvas } from '../slide-canvas'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 57 (EDITOR-03, D-20..D-23): IG grid chip + safe-zone overlay.
 *
 * - Chip toggles overlay visibility (component-local React state)
 * - Overlay is CSS-only: outline (not border) + bottom inset 28.125% +
 *   pointer-events: none + aria-hidden
 */

const TMPL = getTemplate('editorial-serif')

function makeSlide(): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: 'https://example.com/img.png',
    pexels_photo_id: null,
  }
}

describe('SlideCanvas IG grid (EDITOR-03)', () => {
  it('chip is OFF by default; overlay is not rendered', () => {
    const { container } = render(
      <SlideCanvas
        slides={[makeSlide()]}
        template={TMPL}
        selectedIndex={0}
        onSelectIndex={vi.fn()}
      />,
    )
    expect(container.querySelector('[data-testid="ig-grid-overlay"]')).toBeNull()
    const chip = screen.getByTestId('ig-grid-chip')
    expect(chip.getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking chip toggles overlay visibility', () => {
    const { container } = render(
      <SlideCanvas
        slides={[makeSlide()]}
        template={TMPL}
        selectedIndex={0}
        onSelectIndex={vi.fn()}
      />,
    )
    const chip = screen.getByTestId('ig-grid-chip')
    fireEvent.click(chip)
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[data-testid="ig-grid-overlay"]')).toBeTruthy()
    fireEvent.click(chip)
    expect(container.querySelector('[data-testid="ig-grid-overlay"]')).toBeNull()
  })

  it('overlay has outline (not border) + correct bottom inset + pointer-events:none + aria-hidden', () => {
    const { container } = render(
      <SlideCanvas
        slides={[makeSlide()]}
        template={TMPL}
        selectedIndex={0}
        onSelectIndex={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('ig-grid-chip'))
    const overlay = container.querySelector('[data-testid="ig-grid-overlay"]') as HTMLElement
    expect(overlay).toBeTruthy()
    expect(overlay.getAttribute('aria-hidden')).toBe('true')

    const style = overlay.style
    // outline check (D-20 — NOT a border)
    expect(style.outline).toMatch(/2px dashed/)
    // bottom inset = 28.125% (D-23)
    expect(style.bottom).toBe('28.125%')
    // pointer-events: none (so click-through works)
    expect(style.pointerEvents).toBe('none')
    // border MUST NOT be set (would shift layout)
    expect(style.border).toBe('')
  })

  it('chip aria-label describes the toggle', () => {
    render(
      <SlideCanvas
        slides={[makeSlide()]}
        template={TMPL}
        selectedIndex={0}
        onSelectIndex={vi.fn()}
      />,
    )
    expect(screen.getByLabelText(/Instagram feed crop preview/i)).toBeTruthy()
  })
})

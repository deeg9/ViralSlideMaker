import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideBackgroundControls } from '../slide-background-controls'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * quick-260517-h8z — unit coverage for the Slide Background control card.
 *
 * The card recolors the slide background panel (the user's "yellow panel"
 * behind a constrained news-carousel photo). UNLIKE CaptionBarControls it is
 * NOT gated on backgroundMode — every selected slide has a background color, so
 * the card is ALWAYS visible. It emits merged `style_overrides` patches with a
 * single `background_color` hex string; a discrete pick = one undo entry.
 */

const TMPL = getTemplate('highlight-bar') // backgroundColor: '#ffffff'

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

describe('SlideBackgroundControls', () => {
  it('renders the card for any selected slide (no backgroundMode gate)', () => {
    render(
      <SlideBackgroundControls
        slide={makeSlide()}
        template={TMPL}
        onSlideUpdate={vi.fn()}
      />,
    )
    expect(screen.getByTestId('slide-background-controls')).toBeTruthy()
  })

  it('shows the uppercase "Slide Background" title and helper text', () => {
    render(
      <SlideBackgroundControls
        slide={makeSlide()}
        template={TMPL}
        onSlideUpdate={vi.fn()}
      />,
    )
    expect(screen.getByText(/^slide background$/i)).toBeTruthy()
    expect(
      screen.getByText(/color the slide background behind the photo/i),
    ).toBeTruthy()
  })

  it('clicking a preset swatch commits the merged style_overrides.background_color', () => {
    const onSlideUpdate = vi.fn()
    render(
      <SlideBackgroundControls
        slide={makeSlide({ style_overrides: { layout: 'cover' } })}
        template={TMPL}
        onSlideUpdate={onSlideUpdate}
      />,
    )
    fireEvent.click(screen.getByTestId('slide-background-color-swatch-#3d0000'))
    expect(onSlideUpdate).toHaveBeenCalledTimes(1)
    expect(onSlideUpdate).toHaveBeenCalledWith({
      style_overrides: expect.objectContaining({
        layout: 'cover', // pre-existing override preserved (merged patch)
        background_color: '#3d0000',
      }),
    })
  })

  it('the palette input emits an explicit hex string (PCL12)', () => {
    const onSlideUpdate = vi.fn()
    render(
      <SlideBackgroundControls
        slide={makeSlide()}
        template={TMPL}
        onSlideUpdate={onSlideUpdate}
      />,
    )
    const colorInput = screen.getByTestId('slide-background-color')
    fireEvent.change(colorInput, { target: { value: '#3d6be5' } })
    expect(onSlideUpdate).toHaveBeenCalledTimes(1)
    const patch = onSlideUpdate.mock.calls[0][0]
    expect(patch.style_overrides.background_color).toBe('#3d6be5')
    expect(patch.style_overrides.background_color.startsWith('#')).toBe(true)
  })

  it('the palette-icon button is present', () => {
    render(
      <SlideBackgroundControls
        slide={makeSlide()}
        template={TMPL}
        onSlideUpdate={vi.fn()}
      />,
    )
    expect(screen.getByTestId('slide-background-color-palette')).toBeTruthy()
  })

  it('falls back to template.backgroundColor for the active swatch when unset', () => {
    // highlight-bar.backgroundColor is '#ffffff' → that swatch is active.
    render(
      <SlideBackgroundControls
        slide={makeSlide()}
        template={TMPL}
        onSlideUpdate={vi.fn()}
      />,
    )
    expect(
      screen
        .getByTestId('slide-background-color-swatch-#ffffff')
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen
        .getByTestId('slide-background-color-swatch-#3d0000')
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })

  it('marks the swatch matching the resolved background_color override as active', () => {
    render(
      <SlideBackgroundControls
        slide={makeSlide({ style_overrides: { background_color: '#3d0000' } })}
        template={TMPL}
        onSlideUpdate={vi.fn()}
      />,
    )
    expect(
      screen
        .getByTestId('slide-background-color-swatch-#3d0000')
        .getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      screen
        .getByTestId('slide-background-color-swatch-#ffffff')
        .getAttribute('aria-pressed'),
    ).toBe('false')
  })
})

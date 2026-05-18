import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideBackgroundControls } from '../slide-background-controls'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * quick-260517-k2n — unit coverage for the reworked Caption Card control card.
 *
 * The caption card is now an independent draggable/resizable colored rectangle
 * overlay — it NO LONGER constrains the photo. This panel therefore exposes:
 *   - an on/off Switch driving `style_overrides.caption_bar_enabled`
 *   - color swatches driving `style_overrides.caption_bar_color`
 *   - an opacity slider driving `style_overrides.caption_bar_opacity` (0..1)
 *   - Top/Bottom snap buttons rewriting `style_overrides.caption_bar_y`
 *
 * It NEVER writes `layout` / `news_image_height` / `background_color` anymore.
 * The card is NOT backgroundMode-gated — every selected slide can enable it.
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

  it('shows the uppercase "Caption Card" title', () => {
    const { container } = render(
      <SlideBackgroundControls
        slide={makeSlide()}
        template={TMPL}
        onSlideUpdate={vi.fn()}
      />,
    )
    // The card title is the uppercase-styled span directly inside the shell.
    const title = container
      .querySelector('[data-testid="slide-background-controls"]')!
      .querySelector('span.uppercase')
    expect(title?.textContent).toMatch(/^caption card$/i)
  })

  describe('on/off toggle', () => {
    it('renders the Switch UNCHECKED when caption_bar_enabled is unset', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide()}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(
        screen.getByTestId('caption-card-toggle').getAttribute('aria-checked'),
      ).toBe('false')
    })

    it('renders the Switch CHECKED when caption_bar_enabled is true', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(
        screen.getByTestId('caption-card-toggle').getAttribute('aria-checked'),
      ).toBe('true')
    })

    it('clicking the Switch while OFF turns the card ON (caption_bar_enabled:true)', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide()}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('caption-card-toggle'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(onSlideUpdate).toHaveBeenCalledWith({
        style_overrides: expect.objectContaining({ caption_bar_enabled: true }),
      })
    })

    it('clicking the Switch while ON writes explicit caption_bar_enabled:false', () => {
      // quick-260518-8o0: OFF now writes explicit `false` (one uniform code
      // path) — so the news-layout resolver default cannot silently re-enable
      // the card. At render time this is still byte-identical for non-news
      // slides because the resolver gate is `===true || (==null && news)`.
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({
            style_overrides: {
              caption_bar_enabled: true,
              caption_bar_color: '#3d0000',
            },
          })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('caption-card-toggle'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      const patch = onSlideUpdate.mock.calls[0][0]
      // Explicit false — NOT a deleted key.
      expect(patch.style_overrides.caption_bar_enabled).toBe(false)
      // Sibling overrides are preserved.
      expect(patch.style_overrides.caption_bar_color).toBe('#3d0000')
    })

    it('hides color/opacity/position controls while the card is OFF', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide()}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(screen.queryByTestId('caption-card-opacity')).toBeNull()
      expect(screen.queryByTestId('caption-card-color')).toBeNull()
      expect(screen.queryByTestId('caption-card-position-cover')).toBeNull()
      expect(screen.queryByTestId('caption-card-position-body')).toBeNull()
    })
  })

  describe('quick-260518-8o0 — news-layout caption-card awareness', () => {
    it('Test 1: news-layout slide with no caption_bar_* overrides → toggle reads ON', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { layout: 'cover' } })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(
        screen.getByTestId('caption-card-toggle').getAttribute('aria-checked'),
      ).toBe('true')
    })

    it('Test 2: non-news slide with no overrides → toggle reads OFF', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide()}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(
        screen.getByTestId('caption-card-toggle').getAttribute('aria-checked'),
      ).toBe('false')
    })

    it('Test 3: toggling OFF on a news-layout slide emits explicit caption_bar_enabled:false', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { layout: 'cover' } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      // The toggle reads ON (resolver default) — clicking it turns it OFF.
      fireEvent.click(screen.getByTestId('caption-card-toggle'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      const patch = onSlideUpdate.mock.calls[0][0]
      // Explicit false — so the resolver default cannot re-enable the card.
      expect(patch.style_overrides.caption_bar_enabled).toBe(false)
      // The news `layout` override is preserved untouched.
      expect(patch.style_overrides.layout).toBe('cover')
    })

    it('Test 4: toggling OFF on a non-news slide also writes explicit false (uniform path)', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('caption-card-toggle'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(
        onSlideUpdate.mock.calls[0][0].style_overrides.caption_bar_enabled,
      ).toBe(false)
    })

    it('Test 5: toggling ON still emits caption_bar_enabled:true', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide()}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      // Non-news slide → toggle starts OFF; clicking turns it ON.
      fireEvent.click(screen.getByTestId('caption-card-toggle'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(
        onSlideUpdate.mock.calls[0][0].style_overrides.caption_bar_enabled,
      ).toBe(true)
    })

    it('explicit caption_bar_enabled:false on a news slide keeps the toggle OFF', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({
            style_overrides: { layout: 'cover', caption_bar_enabled: false },
          })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(
        screen.getByTestId('caption-card-toggle').getAttribute('aria-checked'),
      ).toBe('false')
    })
  })

  describe('color swatches', () => {
    it('clicking a preset swatch commits style_overrides.caption_bar_color', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(
        screen.getByTestId('caption-card-color-swatch-#3d0000'),
      )
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(onSlideUpdate).toHaveBeenCalledWith({
        style_overrides: expect.objectContaining({
          caption_bar_enabled: true,
          caption_bar_color: '#3d0000',
        }),
      })
    })

    it('the palette input emits an explicit caption_bar_color hex (PCL12)', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.change(screen.getByTestId('caption-card-color'), {
        target: { value: '#3d6be5' },
      })
      const patch = onSlideUpdate.mock.calls[0][0]
      expect(patch.style_overrides.caption_bar_color).toBe('#3d6be5')
      expect(patch.style_overrides.caption_bar_color.startsWith('#')).toBe(true)
    })

    it('marks the swatch matching the resolved caption_bar_color as active', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({
            style_overrides: {
              caption_bar_enabled: true,
              caption_bar_color: '#3d0000',
            },
          })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(
        screen
          .getByTestId('caption-card-color-swatch-#3d0000')
          .getAttribute('aria-pressed'),
      ).toBe('true')
    })
  })

  describe('opacity slider', () => {
    it('renders the caption-card-opacity slider while the card is ON', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
          onSlidePreview={vi.fn()}
        />,
      )
      expect(screen.getByTestId('caption-card-opacity')).toBeTruthy()
    })

    it('seeds the slider from caption_bar_opacity (default 85%)', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
          onSlidePreview={vi.fn()}
        />,
      )
      const slider = screen.getByTestId(
        'caption-card-opacity',
      ) as HTMLInputElement
      expect(slider.value).toBe('85')
    })

    it('seeds the slider from a stored caption_bar_opacity override', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({
            style_overrides: {
              caption_bar_enabled: true,
              caption_bar_opacity: 0.5,
            },
          })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
          onSlidePreview={vi.fn()}
        />,
      )
      const slider = screen.getByTestId(
        'caption-card-opacity',
      ) as HTMLInputElement
      expect(slider.value).toBe('50')
    })

    it('drag preview routes through onSlidePreview as a 0..1 fraction (noHistory)', () => {
      const onSlidePreview = vi.fn()
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
          onSlidePreview={onSlidePreview}
        />,
      )
      fireEvent.change(screen.getByTestId('caption-card-opacity'), {
        target: { value: '60' },
      })
      expect(onSlidePreview).toHaveBeenCalledTimes(1)
      expect(onSlidePreview).toHaveBeenCalledWith({
        style_overrides: expect.objectContaining({ caption_bar_opacity: 0.6 }),
      })
      expect(onSlideUpdate).not.toHaveBeenCalled()
    })

    it('release commits caption_bar_opacity once through onSlideUpdate (KBD-09)', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
          onSlidePreview={vi.fn()}
        />,
      )
      const slider = screen.getByTestId('caption-card-opacity')
      fireEvent.change(slider, { target: { value: '40' } })
      fireEvent.pointerUp(slider, { target: { value: '40' } })
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(onSlideUpdate).toHaveBeenCalledWith({
        style_overrides: expect.objectContaining({ caption_bar_opacity: 0.4 }),
      })
    })
  })

  describe('Top/Bottom snap presets', () => {
    it('clicking Top snaps caption_bar_position:top and caption_bar_y:0', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('caption-card-position-body'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      const patch = onSlideUpdate.mock.calls[0][0]
      expect(patch.style_overrides.caption_bar_position).toBe('top')
      expect(patch.style_overrides.caption_bar_y).toBe(0)
    })

    it('clicking Bottom snaps caption_bar_position:bottom and caption_bar_y:100-height', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({
            style_overrides: {
              caption_bar_enabled: true,
              caption_bar_height_pct: 40,
            },
          })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('caption-card-position-cover'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      const patch = onSlideUpdate.mock.calls[0][0]
      expect(patch.style_overrides.caption_bar_position).toBe('bottom')
      expect(patch.style_overrides.caption_bar_y).toBe(60) // 100 - 40
    })

    it('Bottom snap uses the default height (38) when none is stored', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('caption-card-position-cover'))
      expect(onSlideUpdate.mock.calls[0][0].style_overrides.caption_bar_y).toBe(
        62,
      )
    })
  })

  describe('does not touch the retired photo-constraining fields', () => {
    it('has NO Photo-height (caption-card-height) slider', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
          onSlidePreview={vi.fn()}
        />,
      )
      expect(screen.queryByTestId('caption-card-height')).toBeNull()
    })

    it('never emits layout / news_image_height / background_color', () => {
      const onSlideUpdate = vi.fn()
      const onSlidePreview = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
          onSlidePreview={onSlidePreview}
        />,
      )
      // Exercise every control.
      fireEvent.click(screen.getByTestId('caption-card-color-swatch-#3d0000'))
      fireEvent.change(screen.getByTestId('caption-card-opacity'), {
        target: { value: '70' },
      })
      fireEvent.pointerUp(screen.getByTestId('caption-card-opacity'), {
        target: { value: '70' },
      })
      fireEvent.click(screen.getByTestId('caption-card-position-body'))
      fireEvent.click(screen.getByTestId('caption-card-toggle'))

      const allPatches = [
        ...onSlideUpdate.mock.calls,
        ...onSlidePreview.mock.calls,
      ].map((c) => c[0].style_overrides)
      for (const p of allPatches) {
        expect('layout' in p).toBe(false)
        expect('news_image_height' in p).toBe(false)
        expect('background_color' in p).toBe(false)
      }
    })
  })
})

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
// quick-260519-k14: a few photo-overlay tests need a template whose default
// overlayOpacity is > 0 (so the panel auto-opens and the slider renders). The
// `highlight-bar` template ships with overlayOpacity: 0 — we use `news-oracle`
// (overlayOpacity: 0.45, overlayColor: '#0a0a0a') for those cases. Reading the
// values via `TMPL_OVERLAY.overlayOpacity / .overlayColor` keeps the
// assertions robust to template tuning.
const TMPL_OVERLAY = getTemplate('news-oracle')

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
    // quick-260518-ch8: the `caption-card-height` testid was previously asserted
    // ABSENT (the retired Photo-height slider that resized the *photo zone*).
    // ch8 reintroduces a `caption-card-height` slider — but it is a CARD-height
    // control: it writes `caption_bar_height_pct`, NEVER `news_image_height`.
    // The "no photo-constraining field" intent is fully covered by the sibling
    // "never emits layout / news_image_height / background_color" test below.
    it('Height slider writes caption_bar_height_pct, never news_image_height', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { caption_bar_enabled: true } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
          onSlidePreview={vi.fn()}
        />,
      )
      const heightSlider = screen.getByTestId('caption-card-height')
      expect(heightSlider).not.toBeNull()
      fireEvent.pointerUp(heightSlider, { target: { value: '55' } })
      const patch = onSlideUpdate.mock.calls[0][0].style_overrides
      expect(patch.caption_bar_height_pct).toBe(55)
      expect(patch).not.toHaveProperty('news_image_height')
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

  /**
   * quick-260519-k14: Photo-overlay panel — sibling block to the Caption-Card
   * panel. Drives `style_overrides.overlay_opacity` (0..100 INT — NOT the 0..1
   * fraction that templates use) and `style_overrides.overlay_color` (hex with
   * leading '#'). The render contract (render-slide-satori.tsx:263–271) was
   * already wired; this panel exposes it in the editor.
   */
  describe('Photo overlay panel', () => {
    it("renders a 'Photo overlay' section title inside slide-background-controls", () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide()}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      // The title appears at least once (the uppercase section header). The
      // Switch row label uses the same text — getAllByText handles both nodes.
      const matches = screen.getAllByText('Photo overlay')
      expect(matches.length).toBeGreaterThanOrEqual(1)
    })

    it('Switch reads CHECKED when no overrides are set and template.overlayOpacity > 0', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide()}
          template={TMPL_OVERLAY}
          onSlideUpdate={vi.fn()}
        />,
      )
      // Branched assertion — the test stays correct if the template's default
      // ever shifts to 0 (in which case the Switch reads UNCHECKED).
      const expected = TMPL_OVERLAY.overlayOpacity > 0 ? 'true' : 'false'
      expect(
        screen.getByTestId('photo-overlay-toggle').getAttribute('aria-checked'),
      ).toBe(expected)
    })

    it('Switch reads UNCHECKED when overrides.overlay_opacity === 0', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 0 } })}
          template={TMPL_OVERLAY}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(
        screen.getByTestId('photo-overlay-toggle').getAttribute('aria-checked'),
      ).toBe('false')
    })

    it('Slider seeds from Math.round(template.overlayOpacity * 100) when no override', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide()}
          template={TMPL_OVERLAY}
          onSlideUpdate={vi.fn()}
          onSlidePreview={vi.fn()}
        />,
      )
      // The slider only renders when the Switch is ON; assert non-zero default
      // before reading the slider value (skip the rest if the template ships
      // with overlayOpacity: 0, since the slider would not be in the DOM).
      if (TMPL_OVERLAY.overlayOpacity > 0) {
        const slider = screen.getByTestId(
          'photo-overlay-opacity',
        ) as HTMLInputElement
        expect(slider.value).toBe(
          String(Math.round(TMPL_OVERLAY.overlayOpacity * 100)),
        )
      } else {
        // Template default is 0 → slider not rendered. Document the branch.
        expect(screen.queryByTestId('photo-overlay-opacity')).toBeNull()
      }
    })

    it('Slider seeds from overrides.overlay_opacity when set (INT, no division)', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 30 } })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
          onSlidePreview={vi.fn()}
        />,
      )
      const slider = screen.getByTestId(
        'photo-overlay-opacity',
      ) as HTMLInputElement
      expect(slider.value).toBe('30')
    })

    it('Slider drag preview routes through onSlidePreview with INT overlay_opacity (noHistory)', () => {
      const onSlideUpdate = vi.fn()
      const onSlidePreview = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 50 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
          onSlidePreview={onSlidePreview}
        />,
      )
      fireEvent.change(screen.getByTestId('photo-overlay-opacity'), {
        target: { value: '70' },
      })
      expect(onSlidePreview).toHaveBeenCalledTimes(1)
      expect(onSlidePreview).toHaveBeenCalledWith({
        style_overrides: expect.objectContaining({ overlay_opacity: 70 }),
      })
      expect(onSlideUpdate).not.toHaveBeenCalled()
    })

    it('Slider release commits INT overlay_opacity through onSlideUpdate (KBD-09)', () => {
      const onSlideUpdate = vi.fn()
      const onSlidePreview = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 50 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
          onSlidePreview={onSlidePreview}
        />,
      )
      const slider = screen.getByTestId('photo-overlay-opacity')
      fireEvent.change(slider, { target: { value: '40' } })
      fireEvent.pointerUp(slider, { target: { value: '40' } })
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(onSlideUpdate).toHaveBeenCalledWith({
        style_overrides: expect.objectContaining({ overlay_opacity: 40 }),
      })
    })

    it('Clicking the Switch while ON writes explicit overlay_opacity:0 (NOT a deleted key)', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({
            style_overrides: {
              overlay_opacity: 60,
              overlay_color: '#3d0000',
            },
          })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('photo-overlay-toggle'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      const patch = onSlideUpdate.mock.calls[0][0]
      // Explicit zero — NOT a deleted key (matches caption-card precedent so a
      // future template default cannot silently re-enable the overlay).
      expect(patch.style_overrides.overlay_opacity).toBe(0)
      // Sibling override is preserved.
      expect(patch.style_overrides.overlay_color).toBe('#3d0000')
    })

    it('Clicking the Switch while OFF restores the last-known non-zero overlay_opacity', () => {
      const onSlideUpdate = vi.fn()
      const { rerender } = render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 70 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      // Re-render with overlay_opacity: 0 → Switch reads OFF, but the ref still
      // holds the last-known non-zero value (70).
      rerender(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 0 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('photo-overlay-toggle'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(onSlideUpdate.mock.calls[0][0].style_overrides.overlay_opacity).toBe(
        70,
      )
    })

    it('Clicking the Switch while OFF with no prior non-zero falls back to round(template.overlayOpacity*100) (floored at 1)', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 0 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('photo-overlay-toggle'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      // Robust to overlayOpacity=0 templates: the ref's seed is
      // Math.max(1, round(template.overlayOpacity * 100)).
      const expected = Math.max(
        1,
        Math.round(TMPL.overlayOpacity * 100),
      )
      expect(onSlideUpdate.mock.calls[0][0].style_overrides.overlay_opacity).toBe(
        expected,
      )
    })

    it("Clicking the #3d0000 swatch writes overlay_color: '#3d0000'", () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 50 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('photo-overlay-color-swatch-#3d0000'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(onSlideUpdate.mock.calls[0][0].style_overrides.overlay_color).toBe(
        '#3d0000',
      )
    })

    it('Clicking the template-default swatch writes overlay_color: template.overlayColor', () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({
            style_overrides: {
              overlay_opacity: 50,
              overlay_color: '#3d0000',
            },
          })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.click(screen.getByTestId('photo-overlay-color-swatch-template'))
      expect(onSlideUpdate).toHaveBeenCalledTimes(1)
      expect(onSlideUpdate.mock.calls[0][0].style_overrides.overlay_color).toBe(
        TMPL.overlayColor,
      )
    })

    it("Custom hex input writes overlay_color with a leading '#'", () => {
      const onSlideUpdate = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 50 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      fireEvent.change(screen.getByTestId('photo-overlay-color'), {
        target: { value: '#1a2b3c' },
      })
      const patch = onSlideUpdate.mock.calls[0][0]
      expect(patch.style_overrides.overlay_color).toBe('#1a2b3c')
      expect(patch.style_overrides.overlay_color.startsWith('#')).toBe(true)
    })

    it('Active swatch matches the resolved overlay color', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({
            style_overrides: {
              overlay_opacity: 50,
              overlay_color: '#3d0000',
            },
          })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      expect(
        screen
          .getByTestId('photo-overlay-color-swatch-#3d0000')
          .getAttribute('aria-pressed'),
      ).toBe('true')
    })

    it('Panel never emits layout / news_image_height / background_color / caption_bar_*', () => {
      const onSlideUpdate = vi.fn()
      const onSlidePreview = vi.fn()
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 50 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
          onSlidePreview={onSlidePreview}
        />,
      )
      // Exercise every overlay control: template swatch, hex change, slider
      // change + pointerUp, Switch click.
      fireEvent.click(screen.getByTestId('photo-overlay-color-swatch-template'))
      fireEvent.change(screen.getByTestId('photo-overlay-color'), {
        target: { value: '#1a2b3c' },
      })
      fireEvent.change(screen.getByTestId('photo-overlay-opacity'), {
        target: { value: '70' },
      })
      fireEvent.pointerUp(screen.getByTestId('photo-overlay-opacity'), {
        target: { value: '70' },
      })
      fireEvent.click(screen.getByTestId('photo-overlay-toggle'))

      const allPatches = [
        ...onSlideUpdate.mock.calls,
        ...onSlidePreview.mock.calls,
      ].map((c) => c[0].style_overrides)
      expect(allPatches.length).toBeGreaterThan(0)
      for (const p of allPatches) {
        expect('layout' in p).toBe(false)
        expect('news_image_height' in p).toBe(false)
        expect('background_color' in p).toBe(false)
        for (const k of Object.keys(p)) {
          expect(k.startsWith('caption_bar_')).toBe(false)
        }
      }
    })

    it('aria-labels are present on the Switch, slider, swatches, and palette input', () => {
      render(
        <SlideBackgroundControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 50 } })}
          template={TMPL}
          onSlideUpdate={vi.fn()}
        />,
      )
      // Switch — there's a text node with the same string, so use role lookup.
      expect(
        screen.getByRole('switch', { name: 'Photo overlay' }),
      ).toBeTruthy()
      // Slider
      expect(screen.getByLabelText('Photo overlay opacity')).toBeTruthy()
      // Hidden palette <input type="color">
      expect(
        screen.getByLabelText('Set custom photo overlay color'),
      ).toBeTruthy()
      // Every rendered swatch button advertises 'Set photo overlay color' in
      // its aria-label.
      const swatchButtons = screen
        .getAllByRole('button')
        .filter((btn) =>
          (btn.getAttribute('data-testid') ?? '').startsWith(
            'photo-overlay-color-swatch-',
          ),
        )
      expect(swatchButtons.length).toBeGreaterThan(0)
      for (const btn of swatchButtons) {
        expect(btn.getAttribute('aria-label')).toMatch(
          /^Set photo overlay color/,
        )
      }
    })
  })
})

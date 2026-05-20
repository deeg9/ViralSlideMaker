import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlidePhotoOverlayControls } from '../slide-photo-overlay-controls'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

/**
 * quick-260519-o55 — unit coverage for SlidePhotoOverlayControls. Extracted from
 * slide-background-controls.test.tsx. Drives style_overrides.overlay_opacity
 * (0..100 INT — NOT the 0..1 fraction templates use) and
 * style_overrides.overlay_color (hex with leading '#'). Render contract is
 * unchanged (render-slide-satori.tsx:263–271).
 */

const TMPL = getTemplate('highlight-bar') // overlayOpacity 0 → Switch defaults OFF
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

describe('SlidePhotoOverlayControls', () => {
  describe('Photo overlay panel', () => {
    it("renders a 'Photo overlay' section title inside slide-background-controls", () => {
      render(
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
          slide={makeSlide({ style_overrides: { overlay_opacity: 70 } })}
          template={TMPL}
          onSlideUpdate={onSlideUpdate}
        />,
      )
      // Re-render with overlay_opacity: 0 → Switch reads OFF, but the ref still
      // holds the last-known non-zero value (70).
      rerender(
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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
        <SlidePhotoOverlayControls
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

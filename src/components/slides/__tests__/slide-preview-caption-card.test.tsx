import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

/**
 * quick-260517-k2n — caption-card render regression suite.
 *
 * The reworked caption card is an independent draggable/resizable colored
 * rectangle rendered ABOVE the photo+tint (zIndex 2) and BELOW the text
 * (zIndex 10). It is NO LONGER backgroundMode-gated — it renders on ANY
 * template iff `style_overrides.caption_bar_enabled === true`.
 *
 * Byte-identity (TPLREND-05): a slide WITHOUT caption_bar_enabled renders no
 * `caption-card` element at all — identical to a pre-change slide.
 */

function makeSlide(overrides?: SlideStyleOverrides): Slide {
  const slide: Slide = {
    hook_text: 'HOOK',
    body_text: 'Body copy',
    image_query: 'q',
    is_cta: false,
    background_url: 'https://example.com/photo.jpg',
    pexels_photo_id: null,
    style_overrides: overrides,
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return slide
}

describe('SlidePreview — caption card (non-editable branch)', () => {
  it('renders no caption-card element when caption_bar_enabled is unset', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide()}
        template={getTemplate('magazine-bold')}
        index={0}
        editable={false}
      />,
    )
    expect(container.querySelector('[data-testid="caption-card"]')).toBeNull()
  })

  it('renders a caption-card div when caption_bar_enabled is true', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide({ caption_bar_enabled: true })}
        template={getTemplate('magazine-bold')}
        index={0}
        editable={false}
      />,
    )
    const card = container.querySelector(
      '[data-testid="caption-card"]',
    ) as HTMLElement | null
    expect(card).not.toBeNull()
    // Default geometry: x:0, y:62, width:100, height:38, zIndex 2.
    expect(card!.style.left).toBe('0%')
    expect(card!.style.top).toBe('62%')
    expect(card!.style.width).toBe('100%')
    expect(card!.style.height).toBe('38%')
    expect(card!.style.zIndex).toBe('2')
  })

  it('renders the caption card on a legacy (non-backgroundMode) template too', () => {
    // The card is no longer backgroundMode-gated — it must appear even on a
    // template that has no `image-with-bottom-card` backgroundMode.
    const { container } = render(
      <SlidePreview
        slide={makeSlide({ caption_bar_enabled: true })}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
      />,
    )
    expect(
      container.querySelector('[data-testid="caption-card"]'),
    ).not.toBeNull()
  })

  it('positions the card at the resolved x/y/width/height percents', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide({
          caption_bar_enabled: true,
          caption_bar_x: 10,
          caption_bar_y: 20,
          caption_bar_width: 80,
          caption_bar_height_pct: 50,
        })}
        template={getTemplate('magazine-bold')}
        index={0}
        editable={false}
      />,
    )
    const card = container.querySelector(
      '[data-testid="caption-card"]',
    ) as HTMLElement
    expect(card.style.left).toBe('10%')
    expect(card.style.top).toBe('20%')
    expect(card.style.width).toBe('80%')
    expect(card.style.height).toBe('50%')
  })

  it('keeps the full-bleed background photo rendered (card never touches it)', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide({ caption_bar_enabled: true })}
        template={getTemplate('magazine-bold')}
        index={0}
        editable={false}
      />,
    )
    expect(container.querySelector('[data-testid="bg-bleed"]')).not.toBeNull()
  })
})

describe('SlidePreview — caption card (editable branch / <Rnd>)', () => {
  it('renders no caption-card element when caption_bar_enabled is unset', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide()}
        template={getTemplate('magazine-bold')}
        index={0}
        editable
      />,
    )
    expect(container.querySelector('[data-testid="caption-card"]')).toBeNull()
  })

  it('renders the enabled caption card in the editable branch', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide({ caption_bar_enabled: true })}
        template={getTemplate('magazine-bold')}
        index={0}
        editable
      />,
    )
    expect(
      container.querySelector('[data-testid="caption-card"]'),
    ).not.toBeNull()
  })

  it('clicking the card body selects it and reveals resize handles', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide({ caption_bar_enabled: true })}
        template={getTemplate('magazine-bold')}
        index={0}
        editable
      />,
    )
    const card = container.querySelector(
      '[data-testid="caption-card"]',
    ) as HTMLElement
    // Pre-click: no resize-handle squares (8x8 white) rendered.
    expect(card.querySelectorAll('div[style*="width: 8px"]').length).toBe(0)
    fireEvent.mouseDown(card)
    // Post-click: react-rnd renders the 8 resize handles.
    expect(
      card.querySelectorAll('div[style*="width: 8px"]').length,
    ).toBeGreaterThan(0)
  })

  it('clicking another element (empty canvas) deselects the card', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide({ caption_bar_enabled: true })}
        template={getTemplate('magazine-bold')}
        index={0}
        editable
      />,
    )
    const card = container.querySelector(
      '[data-testid="caption-card"]',
    ) as HTMLElement
    fireEvent.mouseDown(card)
    expect(
      card.querySelectorAll('div[style*="width: 8px"]').length,
    ).toBeGreaterThan(0)
    // The editable canvas inner container owns the capture-phase deselect.
    const canvasInner = container.querySelector(
      '[data-testid="slide-preview"]',
    )!.firstElementChild as HTMLElement
    fireEvent.pointerDown(canvasInner)
    expect(card.querySelectorAll('div[style*="width: 8px"]').length).toBe(0)
  })
})

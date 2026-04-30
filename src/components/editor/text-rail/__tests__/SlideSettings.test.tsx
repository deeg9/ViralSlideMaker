import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideSettings } from '../SlideSettings'
import { templates, getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'
import type { BrandKit } from '@/lib/types/brand-kit'

function makeSlide(partial: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...partial,
  }
}

const NON_NEWS_TEMPLATE = templates.find((t) => !t.accentColor) ?? templates[0]
const NEWS_TEMPLATE = templates.find((t) => !!t.accentColor) ?? getTemplate('news-drop')

describe('<SlideSettings>', () => {
  it('renders the Overlay slider always', () => {
    render(
      <SlideSettings
        slide={makeSlide()}
        template={NON_NEWS_TEMPLATE}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.getByTestId('slide-settings-overlay-slider')).toBeInTheDocument()
  })

  it('does NOT render News Layout for non-news templates', () => {
    render(
      <SlideSettings
        slide={makeSlide()}
        template={NON_NEWS_TEMPLATE}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('slide-settings-news-layout')).toBeNull()
  })

  it('renders News Layout for news templates (with accentColor)', () => {
    render(
      <SlideSettings
        slide={makeSlide()}
        template={NEWS_TEMPLATE}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.getByTestId('slide-settings-news-layout')).toBeInTheDocument()
    expect(screen.getByTestId('slide-settings-news-layout-cover')).toBeInTheDocument()
    expect(screen.getByTestId('slide-settings-news-layout-body')).toBeInTheDocument()
  })

  it('Overlay slider change calls onUpdate({ style_overrides: { overlay_opacity } })', () => {
    const onUpdate = vi.fn()
    render(
      <SlideSettings
        slide={makeSlide()}
        template={NON_NEWS_TEMPLATE}
        onUpdate={onUpdate}
      />,
    )
    const slider = screen.getByTestId('slide-settings-overlay-slider') as HTMLInputElement
    // React listens to the synthetic 'change' event via its event system, so use
    // fireEvent.change which propagates through the React event delegation.
    fireEvent.change(slider, { target: { value: '40' } })
    expect(onUpdate).toHaveBeenCalled()
    const call = onUpdate.mock.calls[0][0]
    expect(call.style_overrides).toBeDefined()
    expect(typeof call.style_overrides.overlay_opacity).toBe('number')
  })

  it('clicking news layout option calls onUpdate with layout set', () => {
    const onUpdate = vi.fn()
    render(
      <SlideSettings
        slide={makeSlide()}
        template={NEWS_TEMPLATE}
        onUpdate={onUpdate}
      />,
    )
    fireEvent.click(screen.getByTestId('slide-settings-news-layout-cover'))
    expect(onUpdate).toHaveBeenCalled()
    const call = onUpdate.mock.calls[0][0]
    expect(call.style_overrides.layout).toBe('cover')
  })

  it('does NOT render watermark toggle without an active brand kit watermark', () => {
    render(
      <SlideSettings
        slide={makeSlide()}
        template={NON_NEWS_TEMPLATE}
        onUpdate={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('slide-settings-watermark')).toBeNull()
  })

  it('renders watermark toggle when brand kit has logo_url + logo_position', () => {
    const bk = {
      logo_url: 'https://example.com/logo.png',
      logo_position: 'bottom-right',
    } as unknown as BrandKit
    render(
      <SlideSettings
        slide={makeSlide()}
        template={NON_NEWS_TEMPLATE}
        onUpdate={vi.fn()}
        brandKit={bk}
      />,
    )
    expect(screen.getByTestId('slide-settings-watermark-toggle')).toBeInTheDocument()
  })

  it('toggling watermark hide adds hide_watermark=true to style_overrides', () => {
    const onUpdate = vi.fn()
    const bk = {
      logo_url: 'https://example.com/logo.png',
      logo_position: 'bottom-right',
    } as unknown as BrandKit
    render(
      <SlideSettings
        slide={makeSlide()}
        template={NON_NEWS_TEMPLATE}
        onUpdate={onUpdate}
        brandKit={bk}
      />,
    )
    fireEvent.click(screen.getByTestId('slide-settings-watermark-toggle'))
    expect(onUpdate).toHaveBeenCalled()
    expect(onUpdate.mock.calls[0][0].style_overrides.hide_watermark).toBe(true)
  })
})

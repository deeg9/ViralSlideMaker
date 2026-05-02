import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

const mockSlide: Slide = {
  hook_text: 'Morning Routine Tips',
  body_text: 'Start your day with intention and purpose.',
  image_query: 'morning',
  is_cta: false,
  background_url: 'https://example.com/photo.jpg',
  pexels_photo_id: 123,
}

describe('SlidePreview', () => {
  it('renders hook_text and body_text content', () => {
    const template = getTemplate('highlight-bar')
    render(<SlidePreview slide={mockSlide} template={template} index={0} />)

    expect(screen.getByText('Morning Routine Tips')).toBeInTheDocument()
    expect(screen.getByText('Start your day with intention and purpose.')).toBeInTheDocument()
  })

  it('applies template textColor and fontFamily as inline styles', () => {
    const template = getTemplate('highlight-bar')
    render(<SlidePreview slide={mockSlide} template={template} index={0} />)

    const hookEl = screen.getByText('Morning Routine Tips')
    const container = hookEl.closest('[data-testid="slide-preview"]')
    expect(container).toBeTruthy()

    const style = container?.getAttribute('style') || ''
    // jsdom converts hex colors to rgb and normalizes quotes
    expect(style).toMatch(/color:\s*rgb\(/)
    expect(style).toContain('Inter')
  })

  it('paper-essay (backgroundMode: color) ignores persisted slide.background_url', () => {
    const template = getTemplate('paper-essay')
    // Slide carries a stale Pexels URL from a previous template — paper-essay
    // must NOT render it as a backgroundImage. The bedroom-photo bug from the
    // user-reported issue (260502): switching template_id alone left photos
    // visible until this kill-switch landed in slide-preview.
    const { container } = render(<SlidePreview slide={mockSlide} template={template} index={0} />)
    const inner = container.querySelector('[data-testid="slide-preview"]')?.firstElementChild as HTMLElement | null
    expect(inner).toBeTruthy()
    const inlineStyle = inner?.getAttribute('style') || ''
    expect(inlineStyle).not.toContain('example.com/photo.jpg')
    expect(inlineStyle).not.toContain('background-image')
    // No <img data-testid="bg-bleed"> either.
    expect(container.querySelector('[data-testid="bg-bleed"]')).toBeNull()
  })

  it('legacy templates with a slide.background_url still paint the photo', () => {
    // Sanity check: kill-switch is paper-essay-specific, doesn't regress
    // existing behavior on the default template.
    const template = getTemplate('highlight-bar')
    const { container } = render(<SlidePreview slide={mockSlide} template={template} index={0} />)
    const inner = container.querySelector('[data-testid="slide-preview"]')?.firstElementChild as HTMLElement | null
    const inlineStyle = inner?.getAttribute('style') || ''
    expect(inlineStyle).toContain('example.com/photo.jpg')
  })
})

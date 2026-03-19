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
    const template = getTemplate('bold-minimal')
    render(<SlidePreview slide={mockSlide} template={template} index={0} />)

    expect(screen.getByText('Morning Routine Tips')).toBeInTheDocument()
    expect(screen.getByText('Start your day with intention and purpose.')).toBeInTheDocument()
  })

  it('applies template textColor and fontFamily as inline styles', () => {
    const template = getTemplate('bold-minimal')
    render(<SlidePreview slide={mockSlide} template={template} index={0} />)

    const hookEl = screen.getByText('Morning Routine Tips')
    const container = hookEl.closest('[data-testid="slide-preview"]')
    expect(container).toBeTruthy()

    const style = container?.getAttribute('style') || ''
    // jsdom converts hex colors to rgb and normalizes quotes
    expect(style).toMatch(/color:\s*rgb\(/)
    expect(style).toContain('Inter')
  })
})

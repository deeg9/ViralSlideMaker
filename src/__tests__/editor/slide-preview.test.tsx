import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlideCanvas } from '@/components/editor/slide-canvas'
import type { Slide } from '@/lib/types/slide'
import type { SlideTemplate } from '@/lib/render/templates/index'

// Mock SlidePreview to simplify
vi.mock('@/components/slides/slide-preview', () => ({
  SlidePreview: ({ slide, index }: { slide: Slide; index: number }) => (
    <div data-testid="slide-preview">
      <span data-testid="hook-text">{slide.hook_text}</span>
      <span data-testid="body-text">{slide.body_text}</span>
      <span data-testid="slide-number">{index + 1}</span>
    </div>
  ),
}))

const mockTemplate: SlideTemplate = {
  id: 'test-template',
  name: 'Test Template',
  thumbnail: '',
  fontFamily: 'sans-serif',
  hookFontSize: '24px',
  bodyFontSize: '16px',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  overlayColor: '#000000',
  overlayOpacity: 0.4,
  textAlign: 'center',
  textPosition: 'center',
  hookStyle: 'uppercase',
}

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Test Hook',
    body_text: 'Test Body',
    image_query: 'test',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

describe('SlideCanvas', () => {
  const slides = [
    makeSlide({ hook_text: 'Slide 1 Hook', body_text: 'Slide 1 Body' }),
    makeSlide({ hook_text: 'Slide 2 Hook', body_text: 'Slide 2 Body' }),
    makeSlide({ hook_text: 'Slide 3 Hook', body_text: 'Slide 3 Body' }),
  ]

  it('renders current slide content (hook_text, body_text visible)', () => {
    render(
      <SlideCanvas
        slides={slides}
        template={mockTemplate}
        selectedIndex={0}
        onSelectIndex={vi.fn()}
      />
    )

    expect(screen.getByTestId('hook-text')).toHaveTextContent('Slide 1 Hook')
    expect(screen.getByTestId('body-text')).toHaveTextContent('Slide 1 Body')
  })

  it('shows "Slide X of Y" indicator', () => {
    render(
      <SlideCanvas
        slides={slides}
        template={mockTemplate}
        selectedIndex={1}
        onSelectIndex={vi.fn()}
      />
    )

    expect(screen.getByText('Slide 2 of 3')).toBeInTheDocument()
  })

  it('navigation arrows are disabled at boundaries', () => {
    const { rerender } = render(
      <SlideCanvas
        slides={slides}
        template={mockTemplate}
        selectedIndex={0}
        onSelectIndex={vi.fn()}
      />
    )

    // At first slide: prev should be disabled
    const prevButton = screen.getByLabelText('Previous slide')
    const nextButton = screen.getByLabelText('Next slide')
    expect(prevButton).toBeDisabled()
    expect(nextButton).not.toBeDisabled()

    // At last slide: next should be disabled
    rerender(
      <SlideCanvas
        slides={slides}
        template={mockTemplate}
        selectedIndex={2}
        onSelectIndex={vi.fn()}
      />
    )

    const prevButton2 = screen.getByLabelText('Previous slide')
    const nextButton2 = screen.getByLabelText('Next slide')
    expect(prevButton2).not.toBeDisabled()
    expect(nextButton2).toBeDisabled()
  })

  it('clicking next/prev arrow calls onSelectIndex with correct index', () => {
    const onSelectIndex = vi.fn()
    render(
      <SlideCanvas
        slides={slides}
        template={mockTemplate}
        selectedIndex={1}
        onSelectIndex={onSelectIndex}
      />
    )

    fireEvent.click(screen.getByLabelText('Previous slide'))
    expect(onSelectIndex).toHaveBeenCalledWith(0)

    fireEvent.click(screen.getByLabelText('Next slide'))
    expect(onSelectIndex).toHaveBeenCalledWith(2)
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 52 (T-02) — selection ring regression suite.
 *
 * Covers:
 *   1. Active hook in editable mode → outline-dashed class on hook wrapper
 *   2. Non-editable mode (Satori export path) → NEVER renders the dashed ring,
 *      regardless of selectedTextBoxId. Critical: PNG exports must remain
 *      byte-identical, and even though Satori ignores `outline`, we gate
 *      handlers/rings to editable={true} as a defense-in-depth measure.
 */

function makeSlide(): Slide {
  const slide: Slide = {
    hook_text: 'Morning Routine Tips',
    body_text: 'Start your day with intention and purpose.',
    image_query: 'morning',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return slide
}

describe('SlidePreview — Phase 52 selection ring', () => {
  it('renders the dashed selection ring on the active hook in editable mode', () => {
    const slide = makeSlide()
    const hookId = slide.text_boxes!.find((tb) => tb.role === 'hook')!.id
    const template = getTemplate('highlight-bar')

    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        editable
        selectedTextBoxId={hookId}
      />,
    )

    const hookWrapper = screen.getByTestId('hook-text-wrapper')
    // The Rnd outer wrapper carries the outline ring class. Walk up.
    const rndWrapper = hookWrapper.parentElement
    expect(rndWrapper?.className ?? '').toContain('outline-dashed')
    expect(rndWrapper?.className ?? '').toContain('outline-[#3d0000]')
  })

  it('does NOT render the dashed ring in non-editable mode (Satori export path)', () => {
    const slide = makeSlide()
    const hookId = slide.text_boxes!.find((tb) => tb.role === 'hook')!.id
    const template = getTemplate('highlight-bar')

    // editable={false} is the Satori PNG export path; even with a matching
    // selectedTextBoxId the ring must not render. The non-editable branch
    // doesn't carry hook-text-wrapper testid (no Rnd) — confirm via slide
    // container that no descendant has outline-dashed.
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        editable={false}
        selectedTextBoxId={hookId}
      />,
    )

    const dashed = container.querySelector('.outline-dashed')
    expect(dashed).toBeNull()
    // hook-text-wrapper testid only exists in editable branch
    expect(screen.queryByTestId('hook-text-wrapper')).toBeNull()
  })

  it('does NOT render the ring on hook when a different text box is selected', () => {
    const slide = makeSlide()
    const bodyId = slide.text_boxes!.find((tb) => tb.role === 'body')!.id
    const template = getTemplate('highlight-bar')

    render(
      <SlidePreview
        slide={slide}
        template={template}
        index={0}
        editable
        selectedTextBoxId={bodyId}
      />,
    )

    const hookWrapper = screen.getByTestId('hook-text-wrapper')
    const rndWrapper = hookWrapper.parentElement
    expect(rndWrapper?.className ?? '').not.toContain('outline-dashed')

    // Body should have it instead.
    const bodyWrapper = screen.getByTestId('body-text-wrapper')
    const bodyRnd = bodyWrapper.parentElement
    expect(bodyRnd?.className ?? '').toContain('outline-dashed')
  })
})

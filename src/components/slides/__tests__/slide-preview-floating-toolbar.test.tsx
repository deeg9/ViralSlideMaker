import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

/**
 * Phase 63 Plan 02 (ALIGN-07, PARITY-01): SlidePreview ↔ FloatingAlignmentToolbar
 * mount-point regression suite.
 *
 * Covers:
 *   - ST1: editable=true + N>=2 + bounds + onAlign → testid present.
 *   - ST2: editable=true + N=1 → testid absent.
 *   - ST3: editable=true + N=0 → testid absent.
 *   - ST4: editable=false + N>=2 → testid absent (TPLREND-05 / PARITY-01).
 *   - ST5: clicking align-left fires onAlign({ kind: 'align', axis: 'left' });
 *          onSelectionChange is NOT called (toolbar action does not mutate selection).
 */

function makeSlideWithImages(): Slide {
  const slide: Slide = {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_images: [
      { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
      { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25 },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return slide
}

describe('SlidePreview ↔ FloatingAlignmentToolbar mount', () => {
  it('ST1: mounts the toolbar when editable=true + selection.ids.length=2 + onAlign provided', () => {
    const slide = makeSlideWithImages()
    render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-b' }}
        onAlign={vi.fn()}
      />,
    )
    expect(screen.getByTestId('floating-alignment-toolbar')).toBeTruthy()
  })

  it('ST2: toolbar absent when editable=true but selection.ids.length=1', () => {
    const slide = makeSlideWithImages()
    render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: ['img-a'], primary: 'img-a' }}
        onAlign={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('floating-alignment-toolbar')).toBeNull()
  })

  it('ST3: toolbar absent when editable=true and no selection', () => {
    const slide = makeSlideWithImages()
    render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: [], primary: null }}
        onAlign={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('floating-alignment-toolbar')).toBeNull()
  })

  it('ST3b: toolbar absent when editable=true + N>=2 but onAlign is undefined (no parent wiring)', () => {
    const slide = makeSlideWithImages()
    render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-b' }}
      />,
    )
    expect(screen.queryByTestId('floating-alignment-toolbar')).toBeNull()
  })

  it('ST4: TPLREND-05 — toolbar STRUCTURALLY absent when editable=false (even with N>=2 + onAlign)', () => {
    const slide = makeSlideWithImages()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-b' }}
        onAlign={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('floating-alignment-toolbar')).toBeNull()
    expect(container.innerHTML).not.toMatch(
      /data-testid="[^"]*floating-alignment-toolbar[^"]*"/,
    )
  })

  it('ST5: clicking align-left fires onAlign({ kind, axis }); onSelectionChange NOT called', () => {
    const slide = makeSlideWithImages()
    const onAlign = vi.fn()
    const onSelectionChange = vi.fn()
    render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-b' }}
        onAlign={onAlign}
        onSelectionChange={onSelectionChange}
      />,
    )
    fireEvent.click(screen.getByTestId('align-left'))
    expect(onAlign).toHaveBeenCalledTimes(1)
    expect(onAlign).toHaveBeenCalledWith({ kind: 'align', axis: 'left' })
    expect(onSelectionChange).not.toHaveBeenCalled()
  })
})

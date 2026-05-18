import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'
import type { ShapeDecoration } from '@/lib/types/decoration'

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

/**
 * quick-260518-htt (HTT-01) — resize chrome gated on selection.
 *
 * BUG: resize-handle dots rendered on EVERY editable-canvas element at once,
 * regardless of selection. The fix gates each of the 5 editable-branch <Rnd>
 * wrappers' `enableResizing` on per-element membership in `selection.ids`.
 *
 * Detection of react-rnd resize handles (confirmed via DOM probe against the
 * real react-rnd output):
 *   - hook/body <Rnd>: side handles render with inline `cursor: col-resize`;
 *     corner hit-zones render with inline `width: 24px`.
 *   - custom-image/decoration <Rnd>: 8 handles render as inline `width: 8px`
 *     squares (same detection as the existing caption-card test).
 * When `enableResizing` is `false`, react-rnd renders ZERO handle DOM nodes.
 */
function makeSlideWithDecoration(): Slide {
  const deco: ShapeDecoration = {
    id: 'deco-htt-1',
    kind: 'shape',
    shapeKind: 'rect',
    fill: '#A8E0B0',
    position: { x: 30, y: 30, width: 15, height: 15 },
  }
  const slide: Slide = {
    hook_text: 'Morning Routine Tips',
    body_text: 'Start your day with intention and purpose.',
    image_query: 'morning',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    decorations: [deco],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return slide
}

function makeSlideWithCustomImage(): Slide {
  const slide: Slide = {
    hook_text: 'Morning Routine Tips',
    body_text: 'Start your day with intention and purpose.',
    image_query: 'morning',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_images: [
      { id: 'img-htt-1', url: 'data:,', x: 20, y: 20, width: 25, height: 25 },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return slide
}

/** Resize-handle nodes inside a hook/body <Rnd>: side bars (col-resize) +
 *  corner hit-zones (24px). Empty when `enableResizing={false}`. */
function textRndHandles(rnd: HTMLElement | null | undefined): number {
  if (!rnd) return 0
  return rnd.querySelectorAll(
    '[style*="cursor: col-resize"], [style*="cursor: nwse-resize"], [style*="cursor: nesw-resize"], div[style*="width: 24px"]',
  ).length
}

/** 8px-square resize-handle nodes inside a custom-image / decoration <Rnd>. */
function squareHandles(rnd: HTMLElement | null | undefined): number {
  if (!rnd) return 0
  return rnd.querySelectorAll('div[style*="width: 8px"]').length
}

describe('SlidePreview — resize chrome gated on selection (quick-260518-htt)', () => {
  it('Test 1: hook <Rnd> shows NO resize handles when selection is empty', () => {
    const slide = makeSlide()
    render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: [], primary: null }}
      />,
    )
    const hookRnd = screen.getByTestId('hook-text-wrapper').parentElement
    expect(textRndHandles(hookRnd)).toBe(0)
  })

  it('Test 2: hook <Rnd> DOES show resize handles when the hook is selected', () => {
    const slide = makeSlide()
    const hookId = slide.text_boxes!.find((tb) => tb.role === 'hook')!.id
    render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: [hookId], primary: hookId }}
      />,
    )
    const hookRnd = screen.getByTestId('hook-text-wrapper').parentElement
    expect(textRndHandles(hookRnd)).toBeGreaterThan(0)
    // The body is NOT selected — it must stay chrome-free.
    const bodyRnd = screen.getByTestId('body-text-wrapper').parentElement
    expect(textRndHandles(bodyRnd)).toBe(0)
  })

  it('Test 3: decoration <Rnd> hides handles when unselected, shows them when selected', () => {
    const slide = makeSlideWithDecoration()
    const decoId = slide.decorations![0].id

    const { container: cUnsel } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: [], primary: null }}
      />,
    )
    const decoUnsel = cUnsel.querySelector(
      `[data-testid="decoration-click-target-${decoId}"]`,
    ) as HTMLElement | null
    expect(decoUnsel).not.toBeNull()
    expect(squareHandles(decoUnsel)).toBe(0)

    const { container: cSel } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: [decoId], primary: decoId }}
      />,
    )
    const decoSel = cSel.querySelector(
      `[data-testid="decoration-click-target-${decoId}"]`,
    ) as HTMLElement | null
    expect(decoSel).not.toBeNull()
    expect(squareHandles(decoSel)).toBeGreaterThan(0)
  })

  it('Test 4: custom-image <Rnd> shows NO resize handles when selection is empty', () => {
    const slide = makeSlideWithCustomImage()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable
        selection={{ ids: [], primary: null }}
      />,
    )
    // No 8px-square handles anywhere on the canvas while nothing is selected.
    expect(container.querySelectorAll('div[style*="width: 8px"]').length).toBe(0)
  })
})

/**
 * Phase 70 Plan 04 (EDITOR-14) + quick-260514-kct: select-on-mousedown for
 * rendered decoration in the editable path of slide-preview.tsx.
 *
 * Post-kct: the click target is now the `<Rnd>` wrapper (so the decoration
 * is draggable). Selection fires from `onMouseDown` — same UX as click — but
 * tests must use `fireEvent.mouseDown` because `onClick` is intercepted by
 * Rnd's drag binding. The data-testid `decoration-click-target-${d.id}` is
 * preserved for back-compat. Rotation transform now lives on an inner
 * `decoration-visual-wrap-${d.id}` div (Rnd's outer style is reserved for
 * react-draggable's translate-based positioning).
 *
 * Editable={true} invariant carries (PCL11 chrome-leak — Satori path must
 * NOT render selection chrome).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'
import type { Decoration } from '@/lib/types/decoration'

const TMPL = getTemplate('editorial-serif')

const SHAPE_DECO: Decoration = {
  id: 'd-shape',
  kind: 'shape',
  shapeKind: 'rect',
  fill: '#FF0000',
  position: { x: 10, y: 20, width: 30, height: 40 },
}

const ICON_DECO: Decoration = {
  id: 'd-icon',
  kind: 'icon',
  lucideName: 'Heart',
  color: '#3D0000',
  strokeWidth: 2,
  position: { x: 50, y: 60, width: 10, height: 10 },
}

function makeSlide(decorations: Decoration[]): Slide {
  return {
    hook_text: 'Hello',
    body_text: 'Body',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    decorations,
  }
}

describe('Phase 70 Plan 04 — Click-to-select on rendered decoration (EDITOR-14)', () => {
  it('renders click-target overlay per non-hidden decoration in editable path', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide([SHAPE_DECO, ICON_DECO])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
      />,
    )
    expect(
      container.querySelector(`[data-testid="decoration-click-target-${SHAPE_DECO.id}"]`),
    ).toBeTruthy()
    expect(
      container.querySelector(`[data-testid="decoration-click-target-${ICON_DECO.id}"]`),
    ).toBeTruthy()
  })

  it('clicking the click-target dispatches selection.replaceWith([d.id])', () => {
    const onSelectionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={makeSlide([SHAPE_DECO])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
        selection={{ ids: [], primary: null }}
        onSelectionChange={onSelectionChange}
      />,
    )
    const target = container.querySelector(
      `[data-testid="decoration-click-target-${SHAPE_DECO.id}"]`,
    ) as HTMLElement
    fireEvent.mouseDown(target)
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    expect(onSelectionChange).toHaveBeenCalledWith({
      ids: [SHAPE_DECO.id],
      primary: SHAPE_DECO.id,
    })
  })

  it('editable={false} → NO click-target overlay rendered (PCL11 invariant)', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide([SHAPE_DECO])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={false}
      />,
    )
    expect(
      container.querySelector(`[data-testid="decoration-click-target-${SHAPE_DECO.id}"]`),
    ).toBeNull()
  })

  it('hidden decoration → no click-target rendered', () => {
    const hidden: Decoration = { ...SHAPE_DECO, hidden: true }
    const { container } = render(
      <SlidePreview
        slide={makeSlide([hidden])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
      />,
    )
    expect(
      container.querySelector(`[data-testid="decoration-click-target-${hidden.id}"]`),
    ).toBeNull()
  })

  it('locked decoration → click-target IS rendered; click still dispatches', () => {
    const onSelectionChange = vi.fn()
    const locked: Decoration = { ...SHAPE_DECO, locked: true }
    const { container } = render(
      <SlidePreview
        slide={makeSlide([locked])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
        selection={{ ids: [], primary: null }}
        onSelectionChange={onSelectionChange}
      />,
    )
    const target = container.querySelector(
      `[data-testid="decoration-click-target-${locked.id}"]`,
    ) as HTMLElement | null
    expect(target).toBeTruthy()
    fireEvent.mouseDown(target!)
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
  })

  it('rotated decoration applies rotation transform on the inner visual wrap', () => {
    const rotated: Decoration = { ...SHAPE_DECO, rotation: 45 }
    const { container } = render(
      <SlidePreview
        slide={makeSlide([rotated])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
      />,
    )
    // quick-260514-kct: rotation now lives on the inner visual-wrap div,
    // not the Rnd outer (Rnd reserves outer `transform: translate(x,y)` for
    // react-draggable positioning).
    const visualWrap = container.querySelector(
      `[data-testid="decoration-visual-wrap-${rotated.id}"]`,
    ) as HTMLElement
    expect(visualWrap).toBeTruthy()
    expect(visualWrap.style.transform).toContain('rotate(45deg)')
  })

  it('Shift-click adds to selection instead of replacing', () => {
    const existingId = 'tb-existing'
    const onSelectionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={makeSlide([SHAPE_DECO])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
        selection={{ ids: [existingId], primary: existingId }}
        onSelectionChange={onSelectionChange}
      />,
    )
    const target = container.querySelector(
      `[data-testid="decoration-click-target-${SHAPE_DECO.id}"]`,
    ) as HTMLElement
    fireEvent.mouseDown(target, { shiftKey: true })
    expect(onSelectionChange).toHaveBeenCalledTimes(1)
    // Functional updater — call it with the previous selection and assert
    // the result includes both ids.
    const arg = onSelectionChange.mock.calls[0][0]
    if (typeof arg === 'function') {
      const next = arg({ ids: [existingId], primary: existingId })
      expect(next.ids).toContain(SHAPE_DECO.id)
      expect(next.ids).toContain(existingId)
      expect(next.primary).toBe(SHAPE_DECO.id)
    } else {
      // Direct value path also acceptable.
      expect(arg.ids).toContain(SHAPE_DECO.id)
      expect(arg.ids).toContain(existingId)
    }
  })
})

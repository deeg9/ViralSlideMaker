/**
 * Phase 72 Plan 02 (ROTATE-02, ROTATE-03): rotation handle mount in
 * slide-preview.tsx editable={true} branch.
 *
 * The handle is gated to:
 *   - editable={true} (TPLREND-05 / PCL11 chrome-leak invariant — Satori path
 *     and non-editable preview path must NOT render this chrome)
 *   - selection.primary === decoration.id (one handle per selected decoration)
 *   - !decoration.locked (LOCK-04 carry-forward — locked decorations cannot rotate)
 *   - !decoration.hidden (LOCK-07 carry-forward — hidden decorations have nothing to anchor to)
 *
 * Drag gesture (pointerDown → moves → pointerUp) emits ONE onDecorationRotate
 * callback with the final rotation (single BULK_ROTATE dispatch upstream).
 * Per-tick onPreview updates a local CSS transform — no reducer dispatch.
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
  position: { x: 30, y: 30, width: 40, height: 40 },
  rotation: 0,
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

describe('Phase 72 Plan 02 — Rotation handle mount in slide-preview.tsx', () => {
  it('Test 1: renders rotation handle when editable=true AND a decoration is selected', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide([SHAPE_DECO])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
        selection={{ ids: [SHAPE_DECO.id], primary: SHAPE_DECO.id }}
        onDecorationRotate={vi.fn()}
      />,
    )
    expect(
      container.querySelector('[data-testid="decoration-rotation-handle"]'),
    ).toBeTruthy()
  })

  it('Test 2: editable=false → NO rotation handle (PCL11 / chrome-gate)', () => {
    const { container } = render(
      <SlidePreview
        slide={makeSlide([SHAPE_DECO])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={false}
        selection={{ ids: [SHAPE_DECO.id], primary: SHAPE_DECO.id }}
      />,
    )
    expect(
      container.querySelector('[data-testid="decoration-rotation-handle"]'),
    ).toBeNull()
  })

  it('Test 3: locked decoration → NO rotation handle (LOCK-04 carry-forward)', () => {
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
        selection={{ ids: [locked.id], primary: locked.id }}
      />,
    )
    expect(
      container.querySelector('[data-testid="decoration-rotation-handle"]'),
    ).toBeNull()
  })

  it('Test 4: hidden decoration → NO rotation handle (LOCK-07 carry-forward)', () => {
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
        selection={{ ids: [hidden.id], primary: hidden.id }}
      />,
    )
    expect(
      container.querySelector('[data-testid="decoration-rotation-handle"]'),
    ).toBeNull()
  })

  it('Test 5: drag-rotate sequence dispatches onDecorationRotate EXACTLY ONCE on pointerUp', () => {
    const onDecorationRotate = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={makeSlide([SHAPE_DECO])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
        selection={{ ids: [SHAPE_DECO.id], primary: SHAPE_DECO.id }}
        onDecorationRotate={onDecorationRotate}
      />,
    )
    const handle = container.querySelector(
      '[data-testid="decoration-rotation-handle"]',
    ) as HTMLElement
    expect(handle).toBeTruthy()

    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      clientX: 600,
      clientY: 500,
    })
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 500,
      clientY: 600,
    })
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 400,
      clientY: 500,
    })
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: 400,
      clientY: 500,
    })

    expect(onDecorationRotate).toHaveBeenCalledTimes(1)
    const payload = onDecorationRotate.mock.calls[0][0]
    expect(payload.slideIndex).toBe(0)
    expect(payload.ids).toEqual([SHAPE_DECO.id])
    expect(typeof payload.rotation).toBe('number')
  })

  it('Test 6: per-tick onPreview applies a local CSS transform; never dispatches', () => {
    const onDecorationRotate = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={makeSlide([SHAPE_DECO])}
        template={TMPL}
        index={0}
        slideIndex={0}
        totalSlides={1}
        topic=""
        editable={true}
        selection={{ ids: [SHAPE_DECO.id], primary: SHAPE_DECO.id }}
        onDecorationRotate={onDecorationRotate}
      />,
    )
    const handle = container.querySelector(
      '[data-testid="decoration-rotation-handle"]',
    ) as HTMLElement

    // Drag started but not released.
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      clientX: 700,
      clientY: 500,
    })
    fireEvent.pointerMove(handle, {
      pointerId: 1,
      clientX: 500,
      clientY: 700,
    })

    // No dispatch yet.
    expect(onDecorationRotate).not.toHaveBeenCalled()

    // The click-target overlay reflects the previewed rotation via inline
    // transform (verified by checking the click-target's style.transform
    // contains 'rotate'). At rotation === 0 there's no transform, but the
    // pointerMove should set a non-zero preview value.
    const clickTarget = container.querySelector(
      `[data-testid="decoration-click-target-${SHAPE_DECO.id}"]`,
    ) as HTMLElement
    expect(clickTarget).toBeTruthy()
    expect(clickTarget.style.transform).toContain('rotate')

    // Now release — dispatch fires once.
    fireEvent.pointerUp(handle, {
      pointerId: 1,
      clientX: 500,
      clientY: 700,
    })
    expect(onDecorationRotate).toHaveBeenCalledTimes(1)
  })
})

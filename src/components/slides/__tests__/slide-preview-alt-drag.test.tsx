/**
 * Phase 66 Plan 02 (DIFF-01, KBD-09): tests for the Alt+drag duplicate
 * onDragStop fan-out.
 *
 * When a drag starts with Alt held (modifiers.get().alt === true at
 * onDragStart), react-rnd's onDragStop must dispatch a SINGLE
 * DUPLICATE_ELEMENTS_AT-equivalent payload via the onAltDuplicate prop with
 * deltaX/deltaY in % of the canvas — INSTEAD of the per-element
 * onCustomImagePositionChange / onCustomTextPositionChange OR the existing
 * onGroupDrag fan-out. Single user gesture → single history entry (KBD-09).
 *
 * react-rnd is mocked here to surface every Rnd as a <div data-rnd-key={...}>;
 * tests directly invoke the recorded onDragStart / onDragStop handlers with
 * synthetic { x, y } values. Same scaffold as slide-preview-group-drag.test.tsx
 * (Plan 62 Plan 03 — GROUP-09 carry-forward).
 *
 * Tests:
 *   AD1: Alt-held single custom_image drag → onAltDuplicate fires with
 *        ids=[ciId], delta in %; per-element + group-drag callbacks NOT fired.
 *   AD2: Alt-NOT-held — existing per-element callback fires; onAltDuplicate
 *        NOT called (no behavior regression for the non-Alt path).
 *   AD3: Alt-held + multi-select [textBox, customImage] → onAltDuplicate fires
 *        ONCE with ids=[textBoxId, imageId]; newGroupId undefined when the
 *        original elements span flat (no shared groupId).
 *   AD4: Alt held at drag-START but RELEASED mid-drag (modifiers.get().alt
 *        === false at drag-stop) → STILL fires onAltDuplicate (per-element
 *        altStartRef captured the gesture-start state — v2.11 simplification).
 *   AD5: Alt-held + selection sharing one groupId → newGroupId is a fresh
 *        `g_${slideIndex}_${time}` string; copies form a NEW group.
 *   AD6: Alt-held + selection NOT sharing groupId → newGroupId undefined.
 *   AD-NO-CHROME: render-tree walk in editable=false branch → no
 *        "alt-drag" / "duplicate-ghost" testids exist (TPLREND-05 / PARITY-01).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { decideAltDuplicate } from '@/components/slides/drag-stop-decider'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

// Per-test-controlled alt-state. Mock returns the current value via closure;
// tests mutate this between renders.
const altState = { value: false }

vi.mock('@/lib/editor/use-modifier-state', () => ({
  useModifierState: () => ({
    get: () => ({ shift: false, cmd: false, alt: altState.value }),
  }),
}))

// Mock react-rnd: surface as <div data-rnd-key={...}> with onDragStart/Stop
// handlers stashed on a window registry. Same pattern as the GROUP-09 tests.
type RndProps = {
  position: { x: number; y: number }
  size?: { width: number; height: number }
  scale?: number
  onDragStop?: (e: unknown, data: { x: number; y: number; node: HTMLElement }) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMouseDown?: (e: any) => void
  onDragStart?: (e: unknown, data: { x: number; y: number }) => void
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

interface RndRegistryEntry {
  position: { x: number; y: number }
  onDragStop?: RndProps['onDragStop']
  onDragStart?: RndProps['onDragStart']
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rndRegistry: { current: Record<string, RndRegistryEntry> } = (globalThis as any).__rndRegistryAltDrag =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((globalThis as any).__rndRegistryAltDrag as { current: Record<string, RndRegistryEntry> }) ?? { current: {} }

vi.mock('react-rnd', () => {
  let counter = 0
  const Rnd = (props: RndProps) => {
    const key = String(counter++)
    rndRegistry.current[key] = {
      position: props.position,
      onDragStop: props.onDragStop,
      onDragStart: props.onDragStart,
    }
    return React.createElement(
      'div',
      {
        'data-rnd-key': key,
        'data-rnd-x': String(props.position.x),
        'data-rnd-y': String(props.position.y),
        className: props.className,
        style: props.style,
        onMouseDown: props.onMouseDown,
      },
      props.children,
    )
  }
  return { Rnd }
})

const REF_WIDTH = 1080
const REF_HEIGHT = 1920

// Fixture: slide with 1 ungrouped custom_image at (10%, 10%).
function makeSingleImageSlide(): { slide: Slide; ciId: string } {
  const ciId = 'ci-solo'
  const slide: Slide = {
    hook_text: 'H',
    body_text: 'B',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_images: [
      { id: ciId, url: 'data:,', x: 10, y: 10, width: 20, height: 20 },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return { slide, ciId }
}

// Fixture: slide with 1 custom_text + 1 custom_image, both flat (no groupId).
function makeFlatTextAndImageSlide(): {
  slide: Slide
  ctId: string
  ciId: string
} {
  const ctId = 'ct-flat'
  const ciId = 'ci-flat'
  const slide: Slide = {
    hook_text: 'H',
    body_text: 'B',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_texts: [
      { id: ctId, text: 'A', x: 10, y: 10, width: 30, font_size: 32 },
    ],
    custom_images: [
      { id: ciId, url: 'data:,', x: 50, y: 50, width: 20, height: 20 },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return { slide, ctId, ciId }
}

// Fixture: 1 custom_image with shared groupId 'g_xy'.
function makeGroupedImageSlide(): {
  slide: Slide
  ciAId: string
  ciBId: string
} {
  const ciAId = 'ci-a'
  const ciBId = 'ci-b'
  const slide: Slide = {
    hook_text: 'H',
    body_text: 'B',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_images: [
      { id: ciAId, url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_xy' },
      { id: ciBId, url: 'data:,', x: 50, y: 50, width: 25, height: 25, groupId: 'g_xy' },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return { slide, ciAId, ciBId }
}

function getRndKeyForCustomImage(
  container: HTMLElement,
  imageSrcMatch: string,
): string {
  const img = container.querySelector(`img[src="${imageSrcMatch}"]`)
  if (!img) throw new Error('image not found')
  const rndDiv = img.closest('[data-rnd-key]')
  if (!rndDiv) throw new Error('rnd wrapper not found')
  const key = rndDiv.getAttribute('data-rnd-key')
  if (!key) throw new Error('data-rnd-key missing')
  return key
}

beforeEach(() => {
  rndRegistry.current = {}
  altState.value = false
})

describe('Phase 66 Plan 02 (DIFF-01): Alt+drag duplicate fan-out', () => {
  it('AD1: Alt-held single custom_image drag → onAltDuplicate fires with ids=[ciId], delta %; per-element + group-drag NOT called', () => {
    const { slide, ciId } = makeSingleImageSlide()
    const onAltDuplicate = vi.fn()
    const onGroupDrag = vi.fn()
    const onCustomImagePositionChange = vi.fn()
    altState.value = true // Alt held at drag-start

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [ciId], primary: ciId }}
        currentlyInsideGroup={null}
        onAltDuplicate={onAltDuplicate}
        onGroupDrag={onGroupDrag}
        onCustomImagePositionChange={onCustomImagePositionChange}
      />,
    )

    const key = getRndKeyForCustomImage(container, 'data:,')
    const entry = rndRegistry.current[key]
    expect(entry).toBeDefined()
    const startX = entry.position.x
    const startY = entry.position.y
    entry.onDragStart?.({}, { x: startX, y: startY })
    const newX = startX + 50
    const newY = startY + 30
    entry.onDragStop!({}, {
      x: newX,
      y: newY,
      node: document.createElement('div'),
    })

    expect(onAltDuplicate).toHaveBeenCalledTimes(1)
    const payload = onAltDuplicate.mock.calls[0][0]
    expect(payload.slideIndex).toBe(0)
    expect(payload.ids).toEqual([ciId])
    expect(payload.deltaX).toBeCloseTo((50 / REF_WIDTH) * 100, 5)
    expect(payload.deltaY).toBeCloseTo((30 / REF_HEIGHT) * 100, 5)
    // Single-element flat selection — no shared groupId; newGroupId undefined.
    expect(payload.newGroupId).toBeUndefined()

    // Per-element + group-drag callbacks NOT called.
    expect(onCustomImagePositionChange).not.toHaveBeenCalled()
    expect(onGroupDrag).not.toHaveBeenCalled()
  })

  it('AD2: Alt-NOT-held → existing per-element callback fires; onAltDuplicate NOT called', () => {
    const { slide, ciId } = makeSingleImageSlide()
    const onAltDuplicate = vi.fn()
    const onCustomImagePositionChange = vi.fn()
    altState.value = false // Alt NOT held

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [ciId], primary: ciId }}
        currentlyInsideGroup={null}
        onAltDuplicate={onAltDuplicate}
        onCustomImagePositionChange={onCustomImagePositionChange}
      />,
    )

    const key = getRndKeyForCustomImage(container, 'data:,')
    const entry = rndRegistry.current[key]
    entry.onDragStart?.({}, { x: entry.position.x, y: entry.position.y })
    entry.onDragStop!({}, {
      x: entry.position.x + 100,
      y: entry.position.y + 100,
      node: document.createElement('div'),
    })

    expect(onAltDuplicate).not.toHaveBeenCalled()
    expect(onCustomImagePositionChange).toHaveBeenCalledTimes(1)
  })

  it('AD4: Alt held at drag-START but released mid-drag → STILL fires onAltDuplicate (gesture-start snapshot wins)', () => {
    const { slide, ciId } = makeSingleImageSlide()
    const onAltDuplicate = vi.fn()
    const onCustomImagePositionChange = vi.fn()
    altState.value = true // Alt held at drag-start

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [ciId], primary: ciId }}
        currentlyInsideGroup={null}
        onAltDuplicate={onAltDuplicate}
        onCustomImagePositionChange={onCustomImagePositionChange}
      />,
    )

    const key = getRndKeyForCustomImage(container, 'data:,')
    const entry = rndRegistry.current[key]
    entry.onDragStart?.({}, { x: entry.position.x, y: entry.position.y })

    // User releases Alt mid-drag. Per-element altStartRef captured `true` at
    // onDragStart; mid-drag state changes don't matter (v2.11 simplification).
    altState.value = false

    entry.onDragStop!({}, {
      x: entry.position.x + 30,
      y: entry.position.y + 30,
      node: document.createElement('div'),
    })

    expect(onAltDuplicate).toHaveBeenCalledTimes(1)
    expect(onCustomImagePositionChange).not.toHaveBeenCalled()
  })

  it('AD5: Alt-held + grouped selection → newGroupId is a fresh g_${index}_${time} string', () => {
    const { slide, ciAId, ciBId } = makeGroupedImageSlide()
    const onAltDuplicate = vi.fn()
    altState.value = true

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={2}
        editable={true}
        selection={{ ids: [ciAId, ciBId], primary: ciAId }}
        currentlyInsideGroup={null}
        onAltDuplicate={onAltDuplicate}
      />,
    )

    const key = getRndKeyForCustomImage(container, 'data:,')
    const entry = rndRegistry.current[key]
    entry.onDragStart?.({}, { x: entry.position.x, y: entry.position.y })
    entry.onDragStop!({}, {
      x: entry.position.x + 50,
      y: entry.position.y + 50,
      node: document.createElement('div'),
    })

    expect(onAltDuplicate).toHaveBeenCalledTimes(1)
    const payload = onAltDuplicate.mock.calls[0][0]
    expect(new Set(payload.ids)).toEqual(new Set([ciAId, ciBId]))
    expect(typeof payload.newGroupId).toBe('string')
    expect(payload.newGroupId).toMatch(/^g_2_[0-9a-z]+$/)
  })

  it('AD-NO-CHROME (TPLREND-05 / PARITY-01): editable=false render tree has zero alt-drag / duplicate testids', () => {
    const { slide } = makeSingleImageSlide()
    const onAltDuplicate = vi.fn()
    altState.value = true

    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={false}
        onAltDuplicate={onAltDuplicate}
      />,
    )

    // Walk the rendered DOM for any "alt"/"duplicate"/"ghost"-named testids.
    const alt = container.querySelectorAll(
      '[data-testid*="alt"], [data-testid*="duplicate"], [data-testid*="ghost"]',
    )
    expect(alt.length).toBe(0)
  })
})

// AD3 + AD6 are exercised against the pure decider directly — easier than
// driving multi-select Rnd through the mock registry, and the wiring at the
// onDragStop site is a thin pass-through to decideAltDuplicate (covered by
// AD1/AD5 against the real component).
describe('Phase 66 Plan 02 (DIFF-01): decideAltDuplicate pure-helper contract', () => {
  it('AD3: Alt-held + multi-select [textBox, customImage] → ids=[textBoxId, imageId], newGroupId undefined when flat', () => {
    const { slide, ctId, ciId } = makeFlatTextAndImageSlide()
    // Find the canonical text_box id for the custom_text fixture.
    const ctTextBoxId = slide.text_boxes!.find((tb) => tb.role === 'custom')!.id
    expect(ctTextBoxId).toBe(ctId)
    const decision = decideAltDuplicate(
      true,
      ctTextBoxId,
      slide,
      { ids: [ctTextBoxId, ciId], primary: ctTextBoxId },
      0,
    )
    expect(decision.kind).toBe('alt-duplicate')
    if (decision.kind !== 'alt-duplicate') return
    expect(new Set(decision.ids)).toEqual(new Set([ctTextBoxId, ciId]))
    expect(decision.newGroupId).toBeUndefined()
  })

  it('AD6: Alt-held + selection sharing one groupId → newGroupId fresh `g_${slideIndex}_…`', () => {
    const { slide, ciAId, ciBId } = makeGroupedImageSlide()
    const decision = decideAltDuplicate(
      true,
      ciAId,
      slide,
      { ids: [ciAId, ciBId], primary: ciAId },
      7,
    )
    expect(decision.kind).toBe('alt-duplicate')
    if (decision.kind !== 'alt-duplicate') return
    expect(typeof decision.newGroupId).toBe('string')
    expect(decision.newGroupId).toMatch(/^g_7_[0-9a-z]+$/)
  })

  it('AD-EMPTY-SELECTION: dragged element not in selection → ids=[draggedId] (single-element fall-through)', () => {
    const { slide, ciId } = makeSingleImageSlide()
    const decision = decideAltDuplicate(
      true,
      ciId,
      slide,
      { ids: [], primary: null },
      0,
    )
    expect(decision.kind).toBe('alt-duplicate')
    if (decision.kind !== 'alt-duplicate') return
    expect(decision.ids).toEqual([ciId])
  })

  it('AD-ALT-FALSE: altAtStart=false → no-op', () => {
    const { slide, ciId } = makeSingleImageSlide()
    const decision = decideAltDuplicate(
      false,
      ciId,
      slide,
      { ids: [ciId], primary: ciId },
      0,
    )
    expect(decision.kind).toBe('no-op')
  })
})

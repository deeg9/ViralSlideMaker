/**
 * Phase 62 Plan 03 (GROUP-09, KBD-09): tests for group-drag onDragStop fan-out.
 *
 * When a drag starts on any member of a group AND the selection equals the
 * group's full member set AND currentlyInsideGroup === null, react-rnd's
 * onDragStop must dispatch a SINGLE BULK_TRANSLATE-equivalent payload via
 * the onGroupDrag prop (with deltaX/deltaY in % of the canvas) and skip
 * the per-element onCustomImagePositionChange / onCustomTextPositionChange
 * callback. Single user gesture → single history entry (KBD-09).
 *
 * react-rnd is mocked here so we can fire onDragStop synthetically with
 * known x/y. The mock surfaces every Rnd as a <div data-rnd-id={...}> with
 * helper methods stashed on a window slot — tests then call them directly.
 *
 * Tests:
 *   GD1: 2 grouped custom_images, both selected, drag stops on first → onGroupDrag fires
 *        once with the 2 ids + computed delta; onCustomImagePositionChange NOT called
 *   GD2: 2 grouped custom_texts, both selected, drag stops on first → same shape via
 *        custom_text wrapper; onCustomTextPositionChange NOT called
 *   GD3: 1 selected ungrouped custom_image, drag stops → falls through to per-element
 *        onCustomImagePositionChange; onGroupDrag NOT called
 *   GD4: currentlyInsideGroup === group.id (entered) → leaf drag fall-through; onGroupDrag NOT called
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

// Mock react-rnd so onDragStop is callable synthetically.
//
// The real Rnd renders a positioned div + drag/resize logic; our mock just
// renders a plain <div> and stashes the onDragStop / onMouseDown handlers
// on a window registry keyed by `data-rnd-key` so tests can fire them
// directly with controlled x/y values.
//
// We intentionally do NOT call the actual react-rnd implementation — none
// of these tests assert visual behavior; only the dispatch wiring from
// onDragStop → onGroupDrag vs onCustomImagePositionChange.
type RndProps = {
  position: { x: number; y: number }
  size?: { width: number; height: number }
  scale?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDragStop?: (e: unknown, data: { x: number; y: number; node: HTMLElement }) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onMouseDown?: (e: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDragStart?: (e: unknown, data: { x: number; y: number }) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
const rndRegistry: { current: Record<string, RndRegistryEntry> } = (globalThis as any).__rndRegistry =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((globalThis as any).__rndRegistry as { current: Record<string, RndRegistryEntry> }) ?? { current: {} }

vi.mock('react-rnd', () => {
  let counter = 0
  const Rnd = (props: RndProps) => {
    // Generate a per-render key that's stable enough for sequential lookups.
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

// Fixture: slide with 2 grouped custom_images at known positions.
function makeSlideWithImageGroup(): {
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
      { id: ciAId, url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_x' },
      { id: ciBId, url: 'data:,', x: 50, y: 50, width: 25, height: 25, groupId: 'g_x' },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return { slide, ciAId, ciBId }
}

// Fixture: slide with 2 grouped custom_texts.
function makeSlideWithTextGroup(): {
  slide: Slide
  ctAId: string
  ctBId: string
} {
  const ctAId = 'ct-a'
  const ctBId = 'ct-b'
  const slide: Slide = {
    hook_text: 'H',
    body_text: 'B',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_texts: [
      { id: ctAId, text: 'A', x: 10, y: 10, width: 30, font_size: 32 },
      { id: ctBId, text: 'B', x: 50, y: 50, width: 30, font_size: 32 },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  // Tag both customs with the same groupId on the canonical text_boxes mirror.
  slide.text_boxes = slide.text_boxes!.map((tb) =>
    tb.role === 'custom' ? { ...tb, groupId: 'g_x' } : tb,
  )
  return { slide, ctAId, ctBId }
}

// Fixture: 1 ungrouped custom_image (single-element drag fall-through).
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

// Locate the Rnd registry entry for a given element by walking the DOM.
// Works on the rendered output of our react-rnd mock: each Rnd is a <div
// data-rnd-key={...}>; the order matches the JSX render order in
// slide-preview.tsx (hook → body → custom_text[*] → custom_image[*]).
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

function getRndKeyForCustomText(
  container: HTMLElement,
  textContent: string,
): string {
  // Custom-text wrappers have an inner div containing the text content.
  const allDivs = Array.from(container.querySelectorAll('div'))
  const match = allDivs.find((d) => d.textContent === textContent)
  if (!match) throw new Error(`custom-text with content "${textContent}" not found`)
  const rndDiv = match.closest('[data-rnd-key]')
  if (!rndDiv) throw new Error('rnd wrapper not found for custom-text')
  const key = rndDiv.getAttribute('data-rnd-key')
  if (!key) throw new Error('data-rnd-key missing')
  return key
}

beforeEach(() => {
  rndRegistry.current = {}
})

describe('Phase 62 Plan 03 (GROUP-09): group drag dispatches BULK_TRANSLATE in a single call', () => {
  it('Test GD1: drag-stop on a grouped custom_image fires onGroupDrag with all member ids; per-element callback NOT called', () => {
    const { slide, ciAId, ciBId } = makeSlideWithImageGroup()
    const onGroupDrag = vi.fn()
    const onCustomImagePositionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [ciAId, ciBId], primary: ciAId }}
        currentlyInsideGroup={null}
        onGroupDrag={onGroupDrag}
        onCustomImagePositionChange={onCustomImagePositionChange}
      />,
    )

    const key = getRndKeyForCustomImage(container, 'data:,') // first matched img
    const entry = rndRegistry.current[key]
    expect(entry).toBeDefined()
    expect(entry.onDragStop).toBeDefined()

    // Simulate drag from current position +50px x, +30px y.
    // Fire onDragStart so the slide-preview's drag-start ref is populated;
    // the GROUP-09 delta computation reads { newX - startRef.x } / REF_WIDTH.
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

    // onGroupDrag fired exactly once.
    expect(onGroupDrag).toHaveBeenCalledTimes(1)
    const payload = onGroupDrag.mock.calls[0][0]
    expect(payload.slideIndex).toBe(0)
    expect(new Set(payload.ids)).toEqual(new Set([ciAId, ciBId]))
    // Delta is in % of canvas. startX/startY were in px (% × REF_WIDTH/HEIGHT).
    const expectedDeltaX = (50 / REF_WIDTH) * 100
    const expectedDeltaY = (30 / REF_HEIGHT) * 100
    expect(payload.deltaX).toBeCloseTo(expectedDeltaX, 5)
    expect(payload.deltaY).toBeCloseTo(expectedDeltaY, 5)

    // Per-element callback NOT called — single dispatch invariant (KBD-09).
    expect(onCustomImagePositionChange).not.toHaveBeenCalled()
  })

  it('Test GD2: drag-stop on a grouped custom_text fires onGroupDrag; per-element callback NOT called', () => {
    const { slide, ctAId, ctBId } = makeSlideWithTextGroup()
    const onGroupDrag = vi.fn()
    const onCustomTextPositionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [ctAId, ctBId], primary: ctAId }}
        currentlyInsideGroup={null}
        onGroupDrag={onGroupDrag}
        onCustomTextPositionChange={onCustomTextPositionChange}
      />,
    )

    const key = getRndKeyForCustomText(container, 'A')
    const entry = rndRegistry.current[key]
    expect(entry).toBeDefined()
    expect(entry.onDragStop).toBeDefined()
    // Drag from (10%,10%) to (15%,15%) — delta = +5%/+5% relative.
    const startX = entry.position.x
    const startY = entry.position.y
    entry.onDragStart?.({}, { x: startX, y: startY })
    const newX = startX + (5 / 100) * REF_WIDTH
    const newY = startY + (5 / 100) * REF_HEIGHT
    entry.onDragStop!({}, {
      x: newX,
      y: newY,
      node: document.createElement('div'),
    })

    expect(onGroupDrag).toHaveBeenCalledTimes(1)
    const payload = onGroupDrag.mock.calls[0][0]
    expect(new Set(payload.ids)).toEqual(new Set([ctAId, ctBId]))
    expect(payload.deltaX).toBeCloseTo(5, 5)
    expect(payload.deltaY).toBeCloseTo(5, 5)
    expect(onCustomTextPositionChange).not.toHaveBeenCalled()
  })

  it('Test GD3: ungrouped single-element drag falls through to per-element callback; onGroupDrag NOT called', () => {
    const { slide, ciId } = makeSingleImageSlide()
    const onGroupDrag = vi.fn()
    const onCustomImagePositionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [ciId], primary: ciId }}
        currentlyInsideGroup={null}
        onGroupDrag={onGroupDrag}
        onCustomImagePositionChange={onCustomImagePositionChange}
      />,
    )

    const key = getRndKeyForCustomImage(container, 'data:,')
    const entry = rndRegistry.current[key]
    const startX = entry.position.x
    const startY = entry.position.y
    entry.onDragStop!({}, {
      x: startX + 100,
      y: startY + 100,
      node: document.createElement('div'),
    })

    expect(onGroupDrag).not.toHaveBeenCalled()
    expect(onCustomImagePositionChange).toHaveBeenCalledTimes(1)
  })

  it('Test GD4: currentlyInsideGroup === group.id → leaf drag fall-through; onGroupDrag NOT called', () => {
    const { slide, ciAId, ciBId } = makeSlideWithImageGroup()
    const onGroupDrag = vi.fn()
    const onCustomImagePositionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [ciAId, ciBId], primary: ciAId }}
        // User has entered the group → drag is a leaf drag.
        currentlyInsideGroup="g_x"
        onGroupDrag={onGroupDrag}
        onCustomImagePositionChange={onCustomImagePositionChange}
      />,
    )

    const key = getRndKeyForCustomImage(container, 'data:,')
    const entry = rndRegistry.current[key]
    entry.onDragStop!({}, {
      x: entry.position.x + 50,
      y: entry.position.y + 50,
      node: document.createElement('div'),
    })

    expect(onGroupDrag).not.toHaveBeenCalled()
    // Per-element callback fires for the leaf-drag fall-through.
    expect(onCustomImagePositionChange).toHaveBeenCalledTimes(1)
  })
})

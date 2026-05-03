/**
 * Phase 62 Plan 02 (GROUP-06): tests for the group bounding-box ring.
 *
 * Tests R1-R6 cover:
 *   - GROUP-06 happy path: ring renders when 2+ members of a group are selected
 *     and currentlyInsideGroup === null
 *   - Empty selection → ring absent
 *   - Single member of a multi-member group selected → ring still renders
 *     (locked decision in PLAN: ring shows when ANY group member selected;
 *      Plan 62-03's Cmd+G expands selection to the full set)
 *   - Entered state (currentlyInsideGroup === group.id) → ring renders with
 *     a DIFFERENT outline-style (solid vs dotted) — visually distinct from the
 *     "selected but not entered" state
 *   - Selection has elements but NONE carry a groupId → ring absent (the
 *     existing multi-selection-ring may render, but the GROUP ring is
 *     group-specific)
 *
 * The PARITY-01 (TPLREND-05) editable=false case is covered in
 * src/lib/render/__tests__/parity.test.tsx alongside the existing
 * multi-selection-ring + marquee-overlay parity tests.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

// Build a slide with two grouped custom_images. Coords are %.
// img-a: (10..30, 10..30), img-b: (50..75, 50..75). Both carry groupId='g_x'.
function makeGroupedSlide(): Slide {
  const slide: Slide = {
    hook_text: 'H',
    body_text: 'B',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_images: [
      { id: 'img-a', url: 'data:,', x: 10, y: 10, width: 20, height: 20, groupId: 'g_x' },
      { id: 'img-b', url: 'data:,', x: 50, y: 50, width: 25, height: 25, groupId: 'g_x' },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  return slide
}

// Slide with two ungrouped custom_images.
function makeUngroupedSlide(): Slide {
  const slide: Slide = {
    hook_text: 'H',
    body_text: 'B',
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

describe('Phase 62 Plan 02 (GROUP-06): group-bounding-ring rendering', () => {
  it('Test R1 (GROUP-06 happy path): renders the ring when 2+ group members are selected and currentlyInsideGroup=null', () => {
    const slide = makeGroupedSlide()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-a' }}
        currentlyInsideGroup={null}
      />,
    )

    const ring = container.querySelector('[data-testid="group-bounding-ring"]')
    expect(ring).not.toBeNull()
    // data-group-id surfaces the active group for debugging / Phase 65 layers panel.
    expect(ring?.getAttribute('data-group-id')).toBe('g_x')
    // data-entered = 'false' when currentlyInsideGroup !== group.id.
    expect(ring?.getAttribute('data-entered')).toBe('false')
    // Style derived from computeSelectionBounds — must include positioning.
    const style = ring?.getAttribute('style') ?? ''
    expect(style).toMatch(/position:\s*absolute/)
    expect(style).toMatch(/left:\s*10/)
    expect(style).toMatch(/top:\s*10/)
  })

  it('Test R2 (GROUP-06 not selected): ring absent when selection.ids is empty', () => {
    const slide = makeGroupedSlide()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        currentlyInsideGroup={null}
      />,
    )

    expect(
      container.querySelector('[data-testid="group-bounding-ring"]'),
    ).toBeNull()
  })

  it('Test R3 (GROUP-06 single member of group selected): ring still renders (Figma-model partial)', () => {
    const slide = makeGroupedSlide()
    // Only img-a is selected, but img-a carries groupId='g_x' which has 2 members.
    // PLAN decision: ring renders when ANY member of the group is in the
    // selection AND currentlyInsideGroup === null. Communicates "you have hit
    // a grouped element."
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: ['img-a'], primary: 'img-a' }}
        currentlyInsideGroup={null}
      />,
    )

    const ring = container.querySelector('[data-testid="group-bounding-ring"]')
    expect(ring).not.toBeNull()
    expect(ring?.getAttribute('data-group-id')).toBe('g_x')
  })

  it('Test R4 (GROUP-06 entered state): ring renders with solid outline when currentlyInsideGroup === group.id', () => {
    const slide = makeGroupedSlide()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-a' }}
        currentlyInsideGroup="g_x"
      />,
    )

    const ring = container.querySelector('[data-testid="group-bounding-ring"]')
    expect(ring).not.toBeNull()
    expect(ring?.getAttribute('data-entered')).toBe('true')
    // Visual distinction: entered = solid; not-entered = dotted (Test R1 pins
    // the not-entered state implicitly via data-entered='false').
    const style = ring?.getAttribute('style') ?? ''
    expect(style).toMatch(/solid/)
    expect(style).not.toMatch(/dotted/)
  })

  it('Test R4b (positive control): not-entered state uses dotted outline', () => {
    // Pins the visual distinction: not-entered MUST be dotted (or any non-solid
    // style). Together with R4 this test pins the outline-style toggle.
    const slide = makeGroupedSlide()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-a' }}
        currentlyInsideGroup={null}
      />,
    )
    const ring = container.querySelector('[data-testid="group-bounding-ring"]')
    expect(ring).not.toBeNull()
    const style = ring?.getAttribute('style') ?? ''
    expect(style).toMatch(/dotted/)
  })

  it('Test R6: ring absent when selection has elements but NONE have a groupId', () => {
    // Multi-selection-ring may render via the existing N>=2 path, but the
    // group-bounding-ring is GROUP-specific and must NOT render here.
    const slide = makeUngroupedSlide()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: ['img-a', 'img-b'], primary: 'img-a' }}
        currentlyInsideGroup={null}
      />,
    )

    expect(
      container.querySelector('[data-testid="group-bounding-ring"]'),
    ).toBeNull()
    // Sanity check: the multi-selection-ring (Plan 60-05) DOES render —
    // confirms the test setup is otherwise valid.
    expect(
      container.querySelector('[data-testid="multi-selection-ring"]'),
    ).not.toBeNull()
  })
})

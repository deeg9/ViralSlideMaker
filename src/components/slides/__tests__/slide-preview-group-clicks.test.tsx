/**
 * Phase 62 Plan 02 (GROUP-07, GROUP-08, GROUP-10): tests for group-aware
 * click + double-click handlers + canvas-empty exitGroup-then-clear branch.
 *
 * Tests C1-C8 cover the per-element wrappers (hook / body / custom_text /
 * custom_image):
 *   - GROUP-10 (Figma model): single-click on a member of a group selects
 *     ALL group members
 *   - Inside-group exception: when currentlyInsideGroup === target.groupId,
 *     single-click selects the LEAF (not the whole group)
 *   - Shift-click toggle (SEL-02/03) sits BEFORE the group branch — Test C5
 *     pins the ordering
 *   - Orphan groupId fallback: getGroupMembers returns 1 → single-select
 *   - Ungrouped element: existing SEL-01 behavior preserved
 *   - GROUP-07 double-click invokes onEnterGroup(id, slide)
 *   - Double-click on element WITHOUT groupId is a no-op (no enterGroup)
 *
 * Tests X1-X3 (Task 3, appended later) cover the canvas-empty
 * exitGroup-then-clear branch.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { SlidePreview } from '@/components/slides/slide-preview'
import { getTemplate } from '@/lib/render/templates/index'
import { legacyToTextBoxes } from '@/lib/editor/text-box-adapter'
import type { Slide } from '@/lib/types/slide'

// Task 3 will use these helpers; declared here so the file is structured
// for the Task-3 X-test append without a follow-up shape change. Unused
// during the Task 2 RED→GREEN cycle.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const REF_WIDTH = 1080
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const REF_HEIGHT = 1920

// Helpers — mirror slide-preview-marquee.test.tsx conventions.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getCanvasRoot(container: HTMLElement): HTMLElement {
  const slidePreview = container.querySelector('[data-testid="slide-preview"]')
  if (!slidePreview) throw new Error('slide-preview testid missing')
  const inner = slidePreview.firstElementChild as HTMLElement | null
  if (!inner) throw new Error('canvas inner wrapper missing')
  return inner
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pctToPx(pctX: number, pctY: number): { x: number; y: number } {
  return { x: (pctX / 100) * REF_WIDTH, y: (pctY / 100) * REF_HEIGHT }
}

// Build a slide where the hook + a custom_text share groupId='g_x'.
// Hook id is determined by legacyToTextBoxes (Phase 49 adapter); we pull
// it back out for assertions.
function makeSlideWithHookGroup(): { slide: Slide; hookId: string; ctId: string } {
  const ctId = 'ct1'
  const slide: Slide = {
    hook_text: 'STOP SCROLLING',
    body_text: 'Body text',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_texts: [
      { id: ctId, text: 'Custom', x: 30, y: 60, width: 40, font_size: 32 },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  const hookBox = slide.text_boxes!.find((tb) => tb.role === 'hook')!
  // Tag both the hook AND the custom-text mirror with the group.
  hookBox.groupId = 'g_x'
  const ctMirror = slide.text_boxes!.find((tb) => tb.id === ctId)
  if (ctMirror) ctMirror.groupId = 'g_x'
  return { slide, hookId: hookBox.id, ctId }
}

// Build a slide with a body box + a custom_image sharing groupId='g_y'.
function makeSlideWithImageGroup(): { slide: Slide; bodyId: string; ciId: string } {
  const ciId = 'ci1'
  const slide: Slide = {
    hook_text: 'H',
    body_text: 'BODY HEADLINE',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    custom_images: [
      { id: ciId, url: 'data:,', x: 20, y: 50, width: 30, height: 30, groupId: 'g_y' },
    ],
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  const bodyBox = slide.text_boxes!.find((tb) => tb.role === 'body')!
  bodyBox.groupId = 'g_y'
  return { slide, bodyId: bodyBox.id, ciId }
}

// Build a slide with an UNGROUPED hook (no groupId on any element).
function makeUngroupedSlide(): { slide: Slide; hookId: string } {
  const slide: Slide = {
    hook_text: 'STOP SCROLLING',
    body_text: 'B',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  const hookBox = slide.text_boxes!.find((tb) => tb.role === 'hook')!
  return { slide, hookId: hookBox.id }
}

// Build a slide where the hook has an ORPHAN groupId — no other element shares it.
function makeOrphanGroupSlide(): { slide: Slide; hookId: string } {
  const slide: Slide = {
    hook_text: 'H',
    body_text: 'B',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  }
  slide.text_boxes = legacyToTextBoxes(slide)
  const hookBox = slide.text_boxes!.find((tb) => tb.role === 'hook')!
  hookBox.groupId = 'g_orphan'
  return { slide, hookId: hookBox.id }
}

describe('Phase 62 Plan 02 (GROUP-10): group-aware single-click on hook wrapper', () => {
  it('Test C1 (GROUP-10 hook member): click on hook with groupId selects ALL group members', () => {
    const { slide, hookId, ctId } = makeSlideWithHookGroup()
    const onSelectionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        onSelectionChange={onSelectionChange}
        currentlyInsideGroup={null}
      />,
    )

    const hookWrapper = container.querySelector(
      '[data-testid="hook-text-wrapper"]',
    )
    expect(hookWrapper).not.toBeNull()
    // The Rnd outer wrapper is the parent that owns onMouseDown.
    const rnd = hookWrapper!.parentElement as HTMLElement
    fireEvent.mouseDown(rnd)

    expect(onSelectionChange).toHaveBeenCalled()
    const lastCall = onSelectionChange.mock.calls.at(-1)![0]
    // Order from getGroupMembers: text_boxes first (hook), then custom_texts
    // mirror appears as text_boxes too via legacyToTextBoxes — both ids are
    // members. Use Set equality for robustness.
    expect(typeof lastCall).toBe('object')
    expect(new Set(lastCall.ids)).toEqual(new Set([hookId, ctId]))
    expect(lastCall.primary).toBe(hookId)
  })
})

describe('Phase 62 Plan 02 (GROUP-10): group-aware single-click on custom_image wrapper', () => {
  it('Test C2 (GROUP-10 custom_image member): click on grouped custom_image selects all group members', () => {
    const { slide, bodyId, ciId } = makeSlideWithImageGroup()
    const onSelectionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        onSelectionChange={onSelectionChange}
        currentlyInsideGroup={null}
      />,
    )

    // Find the custom_image wrapper. The custom_image renders as an <img>
    // inside the Rnd; find by src match.
    const ciImg = container.querySelector('img[src="data:,"]') as HTMLElement
    expect(ciImg).not.toBeNull()
    const rnd = ciImg.parentElement as HTMLElement
    fireEvent.mouseDown(rnd)

    expect(onSelectionChange).toHaveBeenCalled()
    const lastCall = onSelectionChange.mock.calls.at(-1)![0]
    expect(typeof lastCall).toBe('object')
    expect(new Set(lastCall.ids)).toEqual(new Set([bodyId, ciId]))
    expect(lastCall.primary).toBe(ciId)
  })
})

describe('Phase 62 Plan 02 (GROUP-10): single-click on UNGROUPED element preserves SEL-01', () => {
  it('Test C3 (ungrouped element): click on hook without groupId → single-element select', () => {
    const { slide, hookId } = makeUngroupedSlide()
    const onSelectionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        onSelectionChange={onSelectionChange}
        currentlyInsideGroup={null}
      />,
    )

    const hookWrapper = container.querySelector(
      '[data-testid="hook-text-wrapper"]',
    )
    const rnd = hookWrapper!.parentElement as HTMLElement
    fireEvent.mouseDown(rnd)

    expect(onSelectionChange).toHaveBeenCalled()
    const lastCall = onSelectionChange.mock.calls.at(-1)![0]
    expect(lastCall).toEqual({ ids: [hookId], primary: hookId })
  })
})

describe('Phase 62 Plan 02 (GROUP-10): inside-group click selects LEAF', () => {
  it('Test C4 (inside group → leaf select): currentlyInsideGroup === g_x, click on hook selects only hook', () => {
    const { slide, hookId } = makeSlideWithHookGroup()
    const onSelectionChange = vi.fn()
    const onTextBoxSelect = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        onSelectionChange={onSelectionChange}
        onTextBoxSelect={onTextBoxSelect}
        currentlyInsideGroup="g_x"
      />,
    )

    const hookWrapper = container.querySelector(
      '[data-testid="hook-text-wrapper"]',
    )
    const rnd = hookWrapper!.parentElement as HTMLElement
    fireEvent.mouseDown(rnd)

    expect(onSelectionChange).toHaveBeenCalled()
    const lastCall = onSelectionChange.mock.calls.at(-1)![0]
    // LEAF select — hookId only, not the whole group.
    expect(lastCall).toEqual({ ids: [hookId], primary: hookId })
    // Legacy single-id slot fires (right rail mirrors leaf properties).
    expect(onTextBoxSelect).toHaveBeenCalledWith(hookId)
  })
})

describe('Phase 62 Plan 02 (GROUP-10): Shift branch precedes group branch', () => {
  it('Test C5 (Shift-click on grouped hook): SEL-02 toggle fires, NOT group expansion', () => {
    const { slide, hookId } = makeSlideWithHookGroup()
    const onSelectionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: ['existing'], primary: 'existing' }}
        onSelectionChange={onSelectionChange}
        currentlyInsideGroup={null}
      />,
    )

    const hookWrapper = container.querySelector(
      '[data-testid="hook-text-wrapper"]',
    )
    const rnd = hookWrapper!.parentElement as HTMLElement
    fireEvent.mouseDown(rnd, { shiftKey: true })

    expect(onSelectionChange).toHaveBeenCalled()
    // Shift-click uses functional-updater shape (Plan 60-05 contract).
    const lastCallArg = onSelectionChange.mock.calls.at(-1)![0]
    expect(typeof lastCallArg).toBe('function')
    // Apply the updater to the prior state to prove it's a TOGGLE shape
    // (existing PRESERVED + hookId APPENDED), not a whole-group replace.
    const next = lastCallArg({ ids: ['existing'], primary: 'existing' })
    expect(next.ids).toContain('existing')
    expect(next.ids).toContain(hookId)
    expect(next.primary).toBe(hookId)
    // Critical: must NOT carry the second group member (ct1) — that would
    // mean the group-expansion branch fired before the Shift toggle.
    expect(next.ids).not.toContain('ct1')
  })
})

describe('Phase 62 Plan 02 (GROUP-10): orphan groupId falls back to single-select', () => {
  it('Test C6 (orphan groupId): hook has groupId but no other member → single-select', () => {
    const { slide, hookId } = makeOrphanGroupSlide()
    const onSelectionChange = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        onSelectionChange={onSelectionChange}
        currentlyInsideGroup={null}
      />,
    )

    const hookWrapper = container.querySelector(
      '[data-testid="hook-text-wrapper"]',
    )
    const rnd = hookWrapper!.parentElement as HTMLElement
    fireEvent.mouseDown(rnd)

    expect(onSelectionChange).toHaveBeenCalled()
    const lastCall = onSelectionChange.mock.calls.at(-1)![0]
    // Falls through to SEL-01 single-select. memberIds.length === 1
    // (orphan) so the group branch returns early.
    expect(lastCall).toEqual({ ids: [hookId], primary: hookId })
  })
})

describe('Phase 62 Plan 02 (GROUP-07): double-click enters group', () => {
  it('Test C7 (double-click on grouped hook): onEnterGroup invoked with (hookId, slide)', () => {
    const { slide, hookId } = makeSlideWithHookGroup()
    const onEnterGroup = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        currentlyInsideGroup={null}
        onEnterGroup={onEnterGroup}
      />,
    )

    const hookWrapper = container.querySelector(
      '[data-testid="hook-text-wrapper"]',
    )
    const rnd = hookWrapper!.parentElement as HTMLElement
    fireEvent.doubleClick(rnd)

    expect(onEnterGroup).toHaveBeenCalledTimes(1)
    expect(onEnterGroup).toHaveBeenCalledWith(hookId, slide)
  })

  it('Test C8 (double-click on UNGROUPED element): onEnterGroup NOT called', () => {
    const { slide } = makeUngroupedSlide()
    const onEnterGroup = vi.fn()
    const { container } = render(
      <SlidePreview
        slide={slide}
        template={getTemplate('highlight-bar')}
        index={0}
        editable={true}
        selection={{ ids: [], primary: null }}
        currentlyInsideGroup={null}
        onEnterGroup={onEnterGroup}
      />,
    )

    const hookWrapper = container.querySelector(
      '[data-testid="hook-text-wrapper"]',
    )
    const rnd = hookWrapper!.parentElement as HTMLElement
    fireEvent.doubleClick(rnd)

    expect(onEnterGroup).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Task 3 (Plan 62-02): canvas-empty exitGroup-then-clear branch — appended in Task 3
// ============================================================================

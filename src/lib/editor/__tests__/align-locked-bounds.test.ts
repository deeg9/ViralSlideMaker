/**
 * Phase 63 Plan 05 (ALIGN-10) end-to-end integration pin.
 *
 * The pure align.ts module (Plan 63-01) and the editor-reducer.ts ALIGN /
 * DISTRIBUTE cases (Plan 63-01 wiring) each pin the locked-include-bounds-
 * not-move rule at their layer. THIS file exercises the full dispatch path
 * (pure-fn → reducer → state.present mutation) to confirm no regression
 * was introduced by Plan 63-02 toolbar wiring or Plan 63-04 smart-guide
 * drag handlers.
 *
 * Contract:
 *   - Locked elements PARTICIPATE in selection bounds (computeSelectionBounds
 *     does NOT skip locked — Plan 60-05 + Plan 63-01 closed this gap).
 *   - Locked elements DO NOT MOVE on dispatch (align.ts buildMoveCandidates
 *     filters `locked === true` out; reducer's applyAlignPatches is defense-
 *     in-depth — Phase 63 D-08).
 *   - Watermark contributes to bounds (Phase 63 D-01) but doesn't move
 *     (enum-only position; freeform watermark deferred to Phase 64+).
 *   - Single pushHistory per dispatch (ALIGN-08 = PERF-01).
 */

import { describe, test, expect } from 'vitest'
import type { Slide } from '@/lib/types/slide'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

function makeState(slides: Slide[]): EditorHistory {
  return { past: [], present: slides, future: [] }
}

describe('Phase 63 Plan 05 (ALIGN-10): locked-include-bounds-not-move end-to-end pin', () => {
  test('AL1: 3 custom_images with middle locked — ALIGN axis=left → locked stays put, others snap to leftmost (which IS the locked element)', () => {
    // Layout:
    //   img-0 at x=10 (un-locked, leftmost)
    //   img-1 at x=50 (locked)
    //   img-2 at x=90 (un-locked, rightmost)
    // bounds.x = min(10, 50, 90) = 10 (locked included via Plan 63-01)
    // axis=left → all movable elements snap to x=10
    //   - img-0 stays at 10 (already there)
    //   - img-1 stays at 50 (locked → not moved)
    //   - img-2 moves from 90 → 10
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'img-0', url: 'u', x: 10, y: 10, width: 10, height: 10 },
          { id: 'img-1', url: 'u', x: 50, y: 10, width: 10, height: 10, locked: true },
          { id: 'img-2', url: 'u', x: 90, y: 10, width: 10, height: 10 },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['img-0', 'img-1', 'img-2'],
      axis: 'left',
      target: 'selection',
    })
    const imgs = next.present[0].custom_images!
    expect(imgs.find((i) => i.id === 'img-0')!.x).toBe(10) // un-locked, leftmost
    expect(imgs.find((i) => i.id === 'img-1')!.x).toBe(50) // LOCKED — must not move
    expect(imgs.find((i) => i.id === 'img-2')!.x).toBe(10) // un-locked, snapped to bounds.x
    // y untouched on horizontal axis
    expect(imgs.find((i) => i.id === 'img-0')!.y).toBe(10)
    expect(imgs.find((i) => i.id === 'img-1')!.y).toBe(10)
    expect(imgs.find((i) => i.id === 'img-2')!.y).toBe(10)
  })

  test('AL2: same layout — ALIGN axis=right → locked stays put, others snap to rightmost.right (bounds.x + bounds.width)', () => {
    // bounds.right = 90 + 10 = 100. axis=right → element.x = bounds.right - element.width
    //   - img-0 (width=10) moves from 10 → 90 (becomes rightmost)
    //   - img-1 (locked) stays at 50
    //   - img-2 stays at 90 (already at bounds.right - width)
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'img-0', url: 'u', x: 10, y: 10, width: 10, height: 10 },
          { id: 'img-1', url: 'u', x: 50, y: 10, width: 10, height: 10, locked: true },
          { id: 'img-2', url: 'u', x: 90, y: 10, width: 10, height: 10 },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['img-0', 'img-1', 'img-2'],
      axis: 'right',
      target: 'selection',
    })
    const imgs = next.present[0].custom_images!
    expect(imgs.find((i) => i.id === 'img-0')!.x).toBe(90) // un-locked, snapped to bounds.right - width
    expect(imgs.find((i) => i.id === 'img-1')!.x).toBe(50) // LOCKED — must not move
    expect(imgs.find((i) => i.id === 'img-2')!.x).toBe(90) // un-locked, already there
  })

  test('AL3: watermark + 2 custom_images — ALIGN axis=left → watermark contributes to bounds but its enum position stays unchanged; both custom_images snap', () => {
    // watermark at top-left → placeholder rect (0, 0, 18, 5) per Plan 63-01
    //   selection-bounds extension. bounds.x = min(0, 30, 60) = 0.
    //   Both custom_images move to x=0; watermark.position enum stays.
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'img-a', url: 'u', x: 30, y: 30, width: 20, height: 20 },
          { id: 'img-b', url: 'u', x: 60, y: 60, width: 20, height: 20 },
        ],
        watermark: { id: 'w_0', enabled: true, position: 'top-left' },
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['w_0', 'img-a', 'img-b'],
      axis: 'left',
      target: 'selection',
    })
    const imgs = next.present[0].custom_images!
    expect(imgs.find((i) => i.id === 'img-a')!.x).toBe(0)
    expect(imgs.find((i) => i.id === 'img-b')!.x).toBe(0)
    // watermark.position enum unchanged — freeform translation requires
    // Phase 64+ schema extension (currently enum-only).
    expect(next.present[0].watermark).toEqual({
      id: 'w_0',
      enabled: true,
      position: 'top-left',
    })
  })

  test('AL4: DISTRIBUTE horizontal with 4 custom_images, one locked — locked stays even if spatially in the middle of the sorted axis order', () => {
    // Sorted by x: img-0(0), img-1(20, locked), img-2(50), img-3(90).
    // distributeElements pre-filters locked OUT of buildMoveCandidates BEFORE
    // sorting (align.ts line 99-100), so the distribute math operates on:
    //   candidates = [img-0, img-2, img-3] (sorted by x → 0, 50, 90)
    //   N=3 (>= 3 ✓ — passes the gate)
    //   first.x=0, last.x+width=100, sum sizes=30, totalSpan=100, gap=35
    //   img-2 (inner, i=1) → 0 + 10 + 35 = 45 (not 50)
    // img-1 (locked) stays at x=20. img-0 + img-3 are pinned (outermost).
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'img-0', url: 'u', x: 0, y: 0, width: 10, height: 10 },
          { id: 'img-1', url: 'u', x: 20, y: 0, width: 10, height: 10, locked: true },
          { id: 'img-2', url: 'u', x: 50, y: 0, width: 10, height: 10 },
          { id: 'img-3', url: 'u', x: 90, y: 0, width: 10, height: 10 },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DISTRIBUTE',
      slideIndex: 0,
      ids: ['img-0', 'img-1', 'img-2', 'img-3'],
      axis: 'horizontal',
    })
    const imgs = next.present[0].custom_images!
    // Outermost two un-locked candidates pinned:
    expect(imgs.find((i) => i.id === 'img-0')!.x).toBe(0)
    expect(imgs.find((i) => i.id === 'img-3')!.x).toBe(90)
    // Inner un-locked candidate redistributed (gap=35, position 0+10+35 = 45):
    expect(imgs.find((i) => i.id === 'img-2')!.x).toBe(45)
    // Locked element — still at original x=20, despite spatially "middle":
    expect(imgs.find((i) => i.id === 'img-1')!.x).toBe(20)
  })

  test('AL5: single pushHistory invariant pin — one ALIGN dispatch grows past.length by exactly 1 (ALIGN-08 / PERF-01)', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'img-a', url: 'u', x: 10, y: 10, width: 20, height: 20 },
          { id: 'img-b', url: 'u', x: 50, y: 50, width: 20, height: 20, locked: true },
          { id: 'img-c', url: 'u', x: 90, y: 90, width: 20, height: 20 },
        ],
      }),
    ])
    expect(initial.past.length).toBe(0)
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['img-a', 'img-b', 'img-c'],
      axis: 'left',
      target: 'selection',
    })
    // Exactly one history entry recorded (Plan 63-01 single-pushHistory contract).
    expect(next.past.length).toBe(1)
    expect(next.future.length).toBe(0)
    // The recorded past entry is the original slides array.
    expect(next.past[0]).toBe(initial.present)
    // And state did mutate (else the ref-equal short-circuit would skip pushHistory).
    expect(next.present).not.toBe(initial.present)
  })
})

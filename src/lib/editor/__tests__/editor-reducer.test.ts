import { describe, test, expect } from 'vitest'
import type { Slide, Decoration, IconDecoration, ShapeDecoration } from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'
import {
  type AddressableScope,
  assertExhaustiveScope,
} from '@/lib/editor/addressable-scope'

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

describe('editorReducer — text-box actions', () => {
  test('ADD_TEXT_BOX appends to text_boxes array', () => {
    const initial = makeState([makeSlide({ text_boxes: [] })])
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
    })
    expect(next.present[0].text_boxes).toBeDefined()
    expect(next.present[0].text_boxes!.length).toBe(1)
    expect(next.present[0].text_boxes![0].role).toBe('custom')
    expect(next.present[0].text_boxes![0].text).toBe('New Text')
  })

  test('ADD_TEXT_BOX with role="hook" defaults position.anchor="top"', () => {
    const initial = makeState([makeSlide()])
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'hook',
    })
    const box = next.present[0].text_boxes![0]
    expect(box.role).toBe('hook')
    expect(box.position.anchor).toBe('top')
  })

  test('ADD_TEXT_BOX with role="body" defaults position.anchor="bottom"', () => {
    const initial = makeState([makeSlide()])
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'body',
    })
    const box = next.present[0].text_boxes![0]
    expect(box.role).toBe('body')
    expect(box.position.anchor).toBe('bottom')
  })

  test('ADD_TEXT_BOX with role="custom" defaults to anchored free-position', () => {
    const initial = makeState([makeSlide()])
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
    })
    const box = next.present[0].text_boxes![0]
    expect(box.position.anchor).toBe('custom')
    expect(box.position.x).toBe(20)
    expect(box.position.y).toBe(50)
    expect(box.position.width).toBe(60)
  })

  test('ADD_TEXT_BOX defaults can be overridden via action.defaults', () => {
    const initial = makeState([makeSlide()])
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
      defaults: { text: 'Custom default text', color: '#ff0000', font_size: 64 },
    })
    const box = next.present[0].text_boxes![0]
    expect(box.text).toBe('Custom default text')
    expect(box.color).toBe('#ff0000')
    expect(box.font_size).toBe(64)
  })

  test('ADD_TEXT_BOX assigns a unique id (crypto.randomUUID)', () => {
    const initial = makeState([makeSlide()])
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
    })
    const next2 = editorReducer(next, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
    })
    const ids = next2.present[0].text_boxes!.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
  })

  test('ADD_TEXT_BOX honors defaults.id when caller pre-generates it (Phase 50 MR-01)', () => {
    const initial = makeState([makeSlide({ text_boxes: [] })])
    const presetId = '11111111-2222-3333-4444-555555555555'
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
      defaults: { id: presetId, text: 'Selected on add' },
    })
    expect(next.present[0].text_boxes![0].id).toBe(presetId)
    expect(next.present[0].text_boxes![0].text).toBe('Selected on add')
  })

  test('ADD_TEXT_BOX pushes history (undoable)', () => {
    const initial = makeState([makeSlide({ text_boxes: [] })])
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
    })
    expect(next.past.length).toBe(1)
    expect(next.future.length).toBe(0)
  })

  test('UPDATE_TEXT_BOX patches matching id only', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'a', role: 'hook', text: 'A', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'B', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'a',
      updates: { text: 'A patched', color: '#0000ff' },
    })
    const boxes = next.present[0].text_boxes!
    expect(boxes[0].text).toBe('A patched')
    expect(boxes[0].color).toBe('#0000ff')
    expect(boxes[1].text).toBe('B') // unchanged
    expect(boxes[1].color).toBeUndefined()
  })

  test('UPDATE_TEXT_BOX is no-op when textBoxId not found', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'a', role: 'hook', text: 'A', position: { anchor: 'top' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'does-not-exist',
      updates: { text: 'should-not-apply' },
    })
    expect(next.present[0].text_boxes![0].text).toBe('A')
  })

  test('UPDATE_TEXT_BOX pushes history (undoable)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'a', role: 'hook', text: 'A', position: { anchor: 'top' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'a',
      updates: { text: 'patched' },
    })
    expect(next.past.length).toBe(1)
  })

  test('REMOVE_TEXT_BOX filters out matching id', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'a', role: 'hook', text: 'A', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'B', position: { anchor: 'bottom' } },
          {
            id: 'c',
            role: 'custom',
            text: 'C',
            position: { anchor: 'custom', x: 0, y: 0, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'REMOVE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'b',
    })
    const boxes = next.present[0].text_boxes!
    expect(boxes.length).toBe(2)
    expect(boxes.map((b) => b.id)).toEqual(['a', 'c'])
  })

  test('REMOVE_TEXT_BOX pushes history (undoable)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'a', role: 'hook', text: 'A', position: { anchor: 'top' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'REMOVE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'a',
    })
    expect(next.past.length).toBe(1)
  })

  test('UNDO after ADD_TEXT_BOX restores prior state', () => {
    const initial = makeState([makeSlide({ text_boxes: [] })])
    const afterAdd = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
    })
    const afterUndo = editorReducer(afterAdd, { type: 'UNDO' })
    expect(afterUndo.present[0].text_boxes).toEqual([])
    expect(afterUndo.future.length).toBe(1)
  })

  test('REDO after UNDO restores the added text_box', () => {
    const initial = makeState([makeSlide({ text_boxes: [] })])
    const afterAdd = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
      defaults: { text: 'Bonus' },
    })
    const afterUndo = editorReducer(afterAdd, { type: 'UNDO' })
    const afterRedo = editorReducer(afterUndo, { type: 'REDO' } as EditorAction)
    expect(afterRedo.present[0].text_boxes!.length).toBe(1)
    expect(afterRedo.present[0].text_boxes![0].text).toBe('Bonus')
  })
})

describe('editorReducer — text-box write-through (Phase 50 BL-01)', () => {
  // SlidePreview reads from slide.hook_text / body_text / hook_segments /
  // body_segments / style_overrides.{hook,body}_*; the new ActiveTextBoxCard
  // writes to slide.text_boxes[*]. The reducer must keep BOTH shapes in sync
  // synchronously so the live canvas reflects every edit before save runs.

  test('UPDATE_TEXT_BOX: hook text edit propagates to slide.hook_text', () => {
    const initial = makeState([
      makeSlide({
        hook_text: 'Old',
        body_text: 'Body',
        text_boxes: [
          { id: 'h', role: 'hook', text: 'Old', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'h',
      updates: { text: 'Brand new headline' },
    })
    expect(next.present[0].text_boxes![0].text).toBe('Brand new headline')
    expect(next.present[0].hook_text).toBe('Brand new headline')
    // body untouched
    expect(next.present[0].body_text).toBe('Body')
  })

  test('UPDATE_TEXT_BOX: hook color edit propagates to slide.style_overrides.hook_text_color', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'h', role: 'hook', text: 'H', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'B', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'h',
      updates: { color: '#ff00aa' },
    })
    expect(next.present[0].text_boxes![0].color).toBe('#ff00aa')
    expect(next.present[0].style_overrides?.hook_text_color).toBe('#ff00aa')
  })

  test('UPDATE_TEXT_BOX: body effect toggle propagates to slide.style_overrides.body_text_effects', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'h', role: 'hook', text: 'H', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'B', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'b',
      updates: {
        effects: { shadow: { enabled: true, color: '#000000', size: 'md' } },
      },
    })
    expect(next.present[0].text_boxes![1].effects?.shadow?.enabled).toBe(true)
    expect(next.present[0].style_overrides?.body_text_effects?.shadow?.enabled).toBe(true)
  })

  test('UPDATE_TEXT_BOX: hook segments edit propagates to slide.hook_segments', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'h', role: 'hook', text: 'one two three', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'B', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const segments = [
      { text: 'one', accent: false },
      { text: ' ', accent: false },
      { text: 'two', accent: true },
      { text: ' ', accent: false },
      { text: 'three', accent: false },
    ]
    const next = editorReducer(initial, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'h',
      updates: { segments },
    })
    expect(next.present[0].text_boxes![0].segments).toEqual(segments)
    expect(next.present[0].hook_segments).toEqual(segments)
  })

  test('ADD_TEXT_BOX: role=custom propagates to slide.custom_texts', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'h', role: 'hook', text: 'H', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'B', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ADD_TEXT_BOX',
      slideIndex: 0,
      role: 'custom',
      defaults: { text: 'Custom one' },
    })
    expect(next.present[0].text_boxes!.length).toBe(3)
    expect(next.present[0].custom_texts?.length).toBe(1)
    expect(next.present[0].custom_texts?.[0].text).toBe('Custom one')
  })

  test('REMOVE_TEXT_BOX: removing role=custom box removes from slide.custom_texts', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'h', role: 'hook', text: 'H', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'B', position: { anchor: 'bottom' } },
          {
            id: 'c1',
            role: 'custom',
            text: 'Keep me',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'c2',
            role: 'custom',
            text: 'Delete me',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'REMOVE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'c2',
    })
    expect(next.present[0].text_boxes!.length).toBe(3)
    expect(next.present[0].custom_texts?.length).toBe(1)
    expect(next.present[0].custom_texts?.[0].text).toBe('Keep me')
  })

  test('UPDATE_TEXT_BOX: hook font_weight edit propagates to slide.style_overrides.hook_font_weight', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'h', role: 'hook', text: 'H', position: { anchor: 'top' } },
          { id: 'b', role: 'body', text: 'B', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'h',
      updates: { font_weight: 700 },
    })
    expect(next.present[0].style_overrides?.hook_font_weight).toBe(700)
  })
})

describe('editorReducer — DUPLICATE_SLIDE', () => {
  test('regenerates text_boxes / custom_texts / custom_images IDs on the clone', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'H', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'B', position: { anchor: 'bottom' } },
          {
            id: 'tb-custom',
            role: 'custom',
            text: 'C',
            position: { anchor: 'custom', x: 10, y: 20, width: 50 },
          },
        ],
        custom_texts: [
          { id: 'ct-1', text: 'Existing', x: 0, y: 0, width: 60 },
        ],
        custom_images: [
          { id: 'ci-1', url: 'https://example/img.png', x: 0, y: 0, width: 30, height: 30 },
        ],
      }),
    ])

    const next = editorReducer(initial, { type: 'DUPLICATE_SLIDE', index: 0 })
    expect(next.present.length).toBe(2)

    const original = next.present[0]
    const clone = next.present[1]

    // text_boxes: every clone id is a new UUID, none match the originals
    const originalTbIds = original.text_boxes!.map((tb) => tb.id)
    const cloneTbIds = clone.text_boxes!.map((tb) => tb.id)
    expect(cloneTbIds.length).toBe(originalTbIds.length)
    for (const id of cloneTbIds) {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
      expect(originalTbIds).not.toContain(id)
    }
    // text_boxes: non-id fields preserved (text, role, position)
    expect(clone.text_boxes![0].text).toBe('H')
    expect(clone.text_boxes![1].text).toBe('B')
    expect(clone.text_boxes![2].position.x).toBe(10)

    // custom_texts: id regenerated, content preserved
    expect(clone.custom_texts![0].id).not.toBe('ct-1')
    expect(clone.custom_texts![0].text).toBe('Existing')

    // custom_images: id regenerated, url preserved
    expect(clone.custom_images![0].id).not.toBe('ci-1')
    expect(clone.custom_images![0].url).toBe('https://example/img.png')
  })

  test('clones a slide without text_boxes/custom_texts/custom_images without throwing', () => {
    const initial = makeState([makeSlide()])
    const next = editorReducer(initial, { type: 'DUPLICATE_SLIDE', index: 0 })
    expect(next.present.length).toBe(2)
    expect(next.present[1].text_boxes).toBeUndefined()
    expect(next.present[1].custom_texts).toBeUndefined()
    expect(next.present[1].custom_images).toBeUndefined()
  })
})

// phase-59-c3 (UNDO-01): A single corner-drag gesture must produce exactly ONE
// undo entry, regardless of how many onResize ticks fired during the drag.
// The production code achieves this by NOT dispatching on onResize at all —
// only on onResizeStop. This test pins that invariant: 60 hypothetical onResize
// "ticks" don't go through the reducer (we don't dispatch them); only the final
// onResizeStop dispatches. Result: history.past.length increases by 1.
describe('editorReducer — UNDO-01: single history entry per resize gesture', () => {
  test('60 hypothetical onResize ticks + 1 onResizeStop → history.past.length === 1', () => {
    const initialSlide = makeSlide({
      hook_text: 'STOP SCROLLING',
      text_boxes: [{
        id: 'hook-test-id',
        role: 'hook',
        text: 'STOP SCROLLING',
        font_size: 48,
        position: { anchor: 'top', width: 80 },
      }],
    })
    let state = makeState([initialSlide])
    expect(state.past.length).toBe(0)

    // Simulate 60 onResize ticks. Production code does NOT dispatch on these —
    // they only mutate react-rnd's internal visual state. We model that by NOT
    // calling the reducer for these 60 ticks. (If a future regression added an
    // onResize dispatch, this test would still pass at the reducer layer; the
    // grep gate in slide-preview.tsx (no `onResize=` prop) is the structural
    // backstop. This test confirms the reducer behavior given the contract.)
    for (let i = 0; i < 60; i++) {
      // No-op: onResize does NOT touch the reducer in production.
    }
    expect(state.past.length).toBe(0)  // still 0 mid-drag

    // The onResizeStop dispatch — exactly as handleSizeChange in slide-editor.tsx
    // sends it (UPDATE_SLIDE with both style_overrides and text_boxes).
    state = editorReducer(state, {
      type: 'UPDATE_SLIDE',
      index: 0,
      updates: {
        style_overrides: { hook_width: 100, hook_font_size: 60 },
        text_boxes: [{
          id: 'hook-test-id',
          role: 'hook',
          text: 'STOP SCROLLING',
          font_size: 60,
          position: { anchor: 'top', width: 100 },
        }],
      },
    })

    expect(state.past.length).toBe(1)   // exactly one entry, NOT 60
    expect(state.present[0].text_boxes![0].font_size).toBe(60)
    expect(state.present[0].text_boxes![0].position.width).toBe(100)
  })

  test('Custom-text corner-drag dispatch (UPDATE_TEXT_BOX) also produces exactly 1 entry', () => {
    const initialSlide = makeSlide({
      text_boxes: [{
        id: 'ct-test-id',
        role: 'custom',
        text: 'Custom',
        font_size: 24,
        position: { anchor: 'custom', x: 20, y: 50, width: 60 },
      }],
    })
    let state = makeState([initialSlide])
    expect(state.past.length).toBe(0)

    state = editorReducer(state, {
      type: 'UPDATE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'ct-test-id',
      updates: {
        font_size: 30,
        position: { anchor: 'custom', x: 20, y: 50, width: 75 },
      },
    })

    expect(state.past.length).toBe(1)
    expect(state.present[0].text_boxes![0].font_size).toBe(30)
    expect(state.present[0].text_boxes![0].position.width).toBe(75)
  })
})

// Phase 60 (PERF-01): BULK_TRANSLATE single-dispatch contract.
// onDragStop emits exactly ONE BULK_TRANSLATE per gesture (the action will be
// triggered from group drag handlers in Phase 62). The reducer MUST call
// `pushHistory` exactly once per dispatch — never per-tick — and route
// text_boxes through `applyDualWrite` (BL-01). The reducer ALSO honors:
//   - locked=true → element silently skipped (Phase 64 will set this)
//   - text_box.position.anchor !== 'custom' → silently skipped (RESEARCH Q7
//     conservative choice — structural anchors don't carry x/y to translate)
//   - watermark id → silently skipped (RESEARCH Q7 lines 1249-1254: enum-only
//     position; freeform translation requires schema extension. Phase 62/63
//     will revisit.)
describe('editorReducer — Phase 60 (PERF-01): BULK_TRANSLATE single-dispatch contract', () => {
  test('Test 1 (PERF-01): one BULK_TRANSLATE → past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    expect(initial.past.length).toBe(0)
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['tb1'],
      deltaX: 5,
      deltaY: 3,
    })
    expect(next.past.length).toBe(1)   // exactly one pushHistory call
    expect(next.future.length).toBe(0)
  })

  test('Test 2: translates multiple custom-anchor text_boxes by deltaX/deltaY', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            position: { anchor: 'custom', x: 20, y: 30, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['tb1', 'tb2'],
      deltaX: 10,
      deltaY: 5,
    })
    const tb1 = next.present[0].text_boxes!.find((tb) => tb.id === 'tb1')!
    const tb2 = next.present[0].text_boxes!.find((tb) => tb.id === 'tb2')!
    expect(tb1.position.x).toBe(20) // 10 + 10
    expect(tb1.position.y).toBe(15) // 10 + 5
    expect(tb2.position.x).toBe(30) // 20 + 10
    expect(tb2.position.y).toBe(35) // 30 + 5
  })

  test('Test 3 (Phase 64 honor): locked=true text_box is NOT translated', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb-locked',
            role: 'custom',
            text: 'Locked',
            locked: true,
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['tb-locked'],
      deltaX: 99,
      deltaY: 99,
    })
    const tb = next.present[0].text_boxes![0]
    expect(tb.position.x).toBe(10) // unchanged
    expect(tb.position.y).toBe(10) // unchanged
  })

  test('Test 4 (RESEARCH Q7): structural-anchor text_box (anchor!==custom) is NOT translated', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'H', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'B', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['tb-hook', 'tb-body'],
      deltaX: 50,
      deltaY: 50,
    })
    const hook = next.present[0].text_boxes![0]
    const body = next.present[0].text_boxes![1]
    // Structural anchors carry no x/y to translate; positions must be unchanged.
    expect(hook.position.anchor).toBe('top')
    expect(hook.position.x).toBeUndefined()
    expect(hook.position.y).toBeUndefined()
    expect(body.position.anchor).toBe('bottom')
    expect(body.position.x).toBeUndefined()
    expect(body.position.y).toBeUndefined()
  })

  test('Test 5: custom_image is translated by deltaX/deltaY', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          {
            id: 'ci1',
            url: 'https://example.com/x.png',
            x: 10,
            y: 20,
            width: 30,
            height: 30,
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['ci1'],
      deltaX: 7,
      deltaY: 4,
    })
    const ci = next.present[0].custom_images![0]
    expect(ci.x).toBe(17) // 10 + 7
    expect(ci.y).toBe(24) // 20 + 4
  })

  test('Test 6: watermark id is SKIPPED (enum-only position; gap documented)', () => {
    const initial = makeState([
      makeSlide({
        watermark: {
          id: 'w0',
          enabled: true,
          position: 'bottom-right',
        },
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['w0'],
      deltaX: 10,
      deltaY: 10,
    })
    // Watermark is unchanged: enum-only position never receives freeform delta.
    expect(next.present[0].watermark).toEqual({
      id: 'w0',
      enabled: true,
      position: 'bottom-right',
    })
  })

  test('Test 7: unknown id is silently skipped (no error)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    expect(() =>
      editorReducer(initial, {
        type: 'BULK_TRANSLATE',
        slideIndex: 0,
        ids: ['does-not-exist'],
        deltaX: 5,
        deltaY: 5,
      }),
    ).not.toThrow()
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['does-not-exist'],
      deltaX: 5,
      deltaY: 5,
    })
    // No-op for unknown id; tb1 untouched
    expect(next.present[0].text_boxes![0].position.x).toBe(10)
  })

  test('Test 8 (BL-01 dual-write): text_box mutation mirrors back to legacy slide fields', () => {
    // Fixture includes hook + body text_boxes so dual-write can faithfully
    // mirror back to slide.hook_text / slide.body_text — applyDualWrite
    // recomputes legacy fields FROM text_boxes, so the legacy fields would
    // be wiped to '' if no hook/body text_boxes were present.
    const initial = makeState([
      makeSlide({
        hook_text: 'Hook',
        body_text: 'Body',
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
          {
            id: 'tb-custom',
            role: 'custom',
            text: 'CustomText',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['tb-custom'],
      deltaX: 5,
      deltaY: 5,
    })
    // dual-write keeps hook_text / body_text in sync (proves applyDualWrite ran).
    expect(next.present[0].hook_text).toBe('Hook')
    expect(next.present[0].body_text).toBe('Body')
    // custom_texts mirror is regenerated from the post-translate text_boxes
    // array; the +5 delta is reflected in the legacy custom_texts shape too.
    expect(next.present[0].custom_texts).toBeDefined()
    expect(next.present[0].custom_texts!.length).toBe(1)
    expect(next.present[0].custom_texts![0].text).toBe('CustomText')
    expect(next.present[0].custom_texts![0].x).toBe(15) // 10 + 5
    expect(next.present[0].custom_texts![0].y).toBe(15) // 10 + 5
  })

  test('Test 9: BULK_TRANSLATE on non-matching slideIndex leaves other slides untouched', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb-a',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
      makeSlide({
        text_boxes: [
          {
            id: 'tb-b',
            role: 'custom',
            text: 'B',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 99,             // out-of-range slide index
      ids: ['tb-a', 'tb-b'],
      deltaX: 100,
      deltaY: 100,
    })
    // Slides 0 and 1 unchanged
    expect(next.present[0].text_boxes![0].position.x).toBe(10)
    expect(next.present[0].text_boxes![0].position.y).toBe(10)
    expect(next.present[1].text_boxes![0].position.x).toBe(20)
    expect(next.present[1].text_boxes![0].position.y).toBe(20)
  })
})

// Phase 62 (GROUP-02..05, KBD-09): GROUP + UNGROUP single-dispatch contract.
// GROUP assigns a shared groupId to all listed ids in one pushHistory; N<=1
// is a silent no-op; subset-of-existing-group dissolves the prior group
// entirely (flat schema only — PITFALL-3.3). UNGROUP clears groupId on listed
// ids in one pushHistory; idempotent on already-ungrouped ids; lossless
// across unlimited cycles (Test U3). Both route text_boxes mutations through
// applyDualWrite (BL-01).
describe('editorReducer — Phase 62 (GROUP-02..05, KBD-09): GROUP', () => {
  test('Test G1 (KBD-09 / GROUP-02): GROUP with 3 ids → all 3 carry the new groupId; past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
        custom_images: [
          {
            id: 'ci1',
            url: 'https://example.com/x.png',
            x: 30,
            y: 30,
            width: 20,
            height: 20,
          },
        ],
      }),
    ])
    expect(initial.past.length).toBe(0)
    const next = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['tb1', 'tb2', 'ci1'],
      groupId: 'g_new',
    })
    expect(next.past.length).toBe(1)   // exactly one pushHistory
    expect(next.future.length).toBe(0)
    expect(next.present[0].text_boxes![0].groupId).toBe('g_new')
    expect(next.present[0].text_boxes![1].groupId).toBe('g_new')
    expect(next.present[0].custom_images![0].groupId).toBe('g_new')
  })

  test('Test G2 (GROUP-04): GROUP with ids=[] → state ref unchanged; past.length unchanged (silent no-op)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: [],
      groupId: 'g_new',
    })
    expect(next).toBe(initial) // same reference — no pushHistory
    expect(next.past.length).toBe(0)
  })

  test('Test G3 (GROUP-04 / PITFALL-3.4): GROUP with ids=[singleId] → state ref unchanged; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['tb1'],
      groupId: 'g_new',
    })
    expect(next).toBe(initial) // N<=1 → no-op; same ref
    expect(next.past.length).toBe(0)
  })

  test('Test G4 (GROUP-05 / PITFALL-3.3): subset of existing group dissolves prior group entirely', () => {
    // Slide has 3 text_boxes already sharing groupId='g_old' + 1 unrelated.
    // GROUP with ids=[2 of the 3 'g_old' members + the unrelated]:
    //   - the 2 selected 'g_old' members AND the unrelated all get 'g_new'
    //   - the 1 NON-selected 'g_old' member gets groupId cleared (NOT 'g_old')
    //   - past.length grows by 1.
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            groupId: 'g_old',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            groupId: 'g_old',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
          {
            id: 'tb3',
            role: 'custom',
            text: 'C',
            groupId: 'g_old',
            position: { anchor: 'custom', x: 30, y: 30, width: 50 },
          },
          {
            id: 'tb4',
            role: 'custom',
            text: 'D',
            // no groupId
            position: { anchor: 'custom', x: 40, y: 40, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['tb1', 'tb2', 'tb4'], // pick 2 of 3 old + the unrelated
      groupId: 'g_new',
    })
    expect(next.past.length).toBe(1)
    const tbs = next.present[0].text_boxes!
    const byId = (id: string) => tbs.find((t) => t.id === id)!
    // Selected: all carry 'g_new'
    expect(byId('tb1').groupId).toBe('g_new')
    expect(byId('tb2').groupId).toBe('g_new')
    expect(byId('tb4').groupId).toBe('g_new')
    // Unselected old-group member: groupId cleared (old group dissolved)
    expect(byId('tb3').groupId).toBeUndefined()
  })

  test('Test G5 (mixed types): GROUP across 1 text_box + 1 custom_image + 1 watermark — all 3 get the new groupId; positions unchanged', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
        custom_images: [
          {
            id: 'ci1',
            url: 'https://example.com/x.png',
            x: 30,
            y: 30,
            width: 20,
            height: 20,
          },
        ],
        watermark: {
          id: 'w0',
          enabled: true,
          position: 'bottom-right',
        },
      }),
    ])
    const next = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['tb1', 'ci1', 'w0'],
      groupId: 'g_mixed',
    })
    expect(next.present[0].text_boxes![0].groupId).toBe('g_mixed')
    expect(next.present[0].custom_images![0].groupId).toBe('g_mixed')
    expect(next.present[0].watermark!.groupId).toBe('g_mixed')
    // Positions unchanged
    expect(next.present[0].text_boxes![0].position.x).toBe(10)
    expect(next.present[0].text_boxes![0].position.y).toBe(10)
    expect(next.present[0].custom_images![0].x).toBe(30)
    expect(next.present[0].custom_images![0].y).toBe(30)
    expect(next.present[0].watermark!.position).toBe('bottom-right')
  })

  test('Test G6 (BL-01): GROUP that mutates a custom-role text_box fires applyDualWrite — legacy custom_texts mirror reflects the now-grouped box', () => {
    const initial = makeState([
      makeSlide({
        hook_text: 'Hook',
        body_text: 'Body',
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
          {
            id: 'tb-c1',
            role: 'custom',
            text: 'CT1',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb-c2',
            role: 'custom',
            text: 'CT2',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['tb-c1', 'tb-c2'],
      groupId: 'g_custom',
    })
    // hook_text / body_text untouched (proves dual-write ran end-to-end)
    expect(next.present[0].hook_text).toBe('Hook')
    expect(next.present[0].body_text).toBe('Body')
    // custom_texts mirror is regenerated; groupId is not part of the legacy
    // projection so the dual-write slice for the two custom rows still has
    // their text + position intact.
    expect(next.present[0].custom_texts).toBeDefined()
    expect(next.present[0].custom_texts!.length).toBe(2)
    expect(next.present[0].custom_texts!.map((c) => c.text).sort()).toEqual([
      'CT1',
      'CT2',
    ])
  })

  test('Test G7 (slide isolation): GROUP on slideIndex=1 leaves slideIndex=0 + slideIndex=2 byte-identical references', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'tb-a', role: 'custom', text: 'A', position: { anchor: 'custom', x: 0, y: 0, width: 50 } },
        ],
      }),
      makeSlide({
        text_boxes: [
          { id: 'tb-b1', role: 'custom', text: 'B1', position: { anchor: 'custom', x: 10, y: 10, width: 50 } },
          { id: 'tb-b2', role: 'custom', text: 'B2', position: { anchor: 'custom', x: 20, y: 20, width: 50 } },
        ],
      }),
      makeSlide({
        text_boxes: [
          { id: 'tb-c', role: 'custom', text: 'C', position: { anchor: 'custom', x: 0, y: 0, width: 50 } },
        ],
      }),
    ])
    const before0 = initial.present[0]
    const before2 = initial.present[2]
    const next = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 1,
      ids: ['tb-b1', 'tb-b2'],
      groupId: 'g_b',
    })
    expect(next.present[0]).toBe(before0) // ref-equal
    expect(next.present[2]).toBe(before2) // ref-equal
    expect(next.present[1].text_boxes![0].groupId).toBe('g_b')
    expect(next.present[1].text_boxes![1].groupId).toBe('g_b')
  })
})

describe('editorReducer — Phase 62 (GROUP-03, KBD-09): UNGROUP', () => {
  test('Test U1 (KBD-09 / GROUP-03): UNGROUP with 3 ids sharing groupId → all 3 cleared; past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            groupId: 'g_x',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            groupId: 'g_x',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
        custom_images: [
          {
            id: 'ci1',
            url: 'https://example.com/x.png',
            x: 30,
            y: 30,
            width: 20,
            height: 20,
            groupId: 'g_x',
          },
        ],
      }),
    ])
    expect(initial.past.length).toBe(0)
    const next = editorReducer(initial, {
      type: 'UNGROUP',
      slideIndex: 0,
      ids: ['tb1', 'tb2', 'ci1'],
    })
    expect(next.past.length).toBe(1) // exactly one pushHistory
    expect(next.present[0].text_boxes![0].groupId).toBeUndefined()
    expect(next.present[0].text_boxes![1].groupId).toBeUndefined()
    expect(next.present[0].custom_images![0].groupId).toBeUndefined()
  })

  test('Test U2 (subset shrink): UNGROUP with subset → unlisted members keep groupId; past.length grows by 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            groupId: 'g_x',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            groupId: 'g_x',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
          {
            id: 'tb3',
            role: 'custom',
            text: 'C',
            groupId: 'g_x',
            position: { anchor: 'custom', x: 30, y: 30, width: 50 },
          },
          {
            id: 'tb4',
            role: 'custom',
            text: 'D',
            groupId: 'g_x',
            position: { anchor: 'custom', x: 40, y: 40, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UNGROUP',
      slideIndex: 0,
      ids: ['tb1', 'tb2'], // remove only 2 of 4
    })
    expect(next.past.length).toBe(1)
    const tbs = next.present[0].text_boxes!
    const byId = (id: string) => tbs.find((t) => t.id === id)!
    expect(byId('tb1').groupId).toBeUndefined()
    expect(byId('tb2').groupId).toBeUndefined()
    expect(byId('tb3').groupId).toBe('g_x') // group "shrinks" but doesn't dissolve
    expect(byId('tb4').groupId).toBe('g_x')
  })

  test('Test U3 (lossless round-trip 3 cycles): positions byte-identical across group/ungroup/group/ungroup/group/ungroup', () => {
    const start = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 15, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            position: { anchor: 'custom', x: 25, y: 35, width: 50 },
          },
          {
            id: 'tb3',
            role: 'custom',
            text: 'C',
            position: { anchor: 'custom', x: 40, y: 55, width: 50 },
          },
        ],
      }),
    ])
    const ids = ['tb1', 'tb2', 'tb3']
    const startPositions = start.present[0].text_boxes!.map((tb) => ({ ...tb.position }))

    let s: EditorHistory = start
    for (let cycle = 0; cycle < 3; cycle++) {
      s = editorReducer(s, {
        type: 'GROUP',
        slideIndex: 0,
        ids,
        groupId: `g_cycle_${cycle}`,
      })
      // Verify all carry the new groupId mid-cycle
      for (const tb of s.present[0].text_boxes!) {
        expect(tb.groupId).toBe(`g_cycle_${cycle}`)
      }
      s = editorReducer(s, {
        type: 'UNGROUP',
        slideIndex: 0,
        ids,
      })
      // Verify all cleared mid-cycle
      for (const tb of s.present[0].text_boxes!) {
        expect(tb.groupId).toBeUndefined()
      }
    }

    // Positions byte-identical to start
    const endPositions = s.present[0].text_boxes!.map((tb) => ({ ...tb.position }))
    expect(endPositions).toEqual(startPositions)
  })

  test('Test U4 (idempotent on already-ungrouped): UNGROUP with ids that have no groupId → state ref unchanged; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            // no groupId
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            // no groupId
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UNGROUP',
      slideIndex: 0,
      ids: ['tb1', 'tb2'],
    })
    expect(next).toBe(initial) // ref-equal — no pushHistory
    expect(next.past.length).toBe(0)
  })

  test('Test U5 (BL-01): UNGROUP that touches a custom-role text_box fires applyDualWrite — legacy custom_texts mirror still well-formed', () => {
    const initial = makeState([
      makeSlide({
        hook_text: 'Hook',
        body_text: 'Body',
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
          {
            id: 'tb-c1',
            role: 'custom',
            text: 'CT1',
            groupId: 'g_x',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb-c2',
            role: 'custom',
            text: 'CT2',
            groupId: 'g_x',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UNGROUP',
      slideIndex: 0,
      ids: ['tb-c1', 'tb-c2'],
    })
    expect(next.past.length).toBe(1)
    // hook_text / body_text untouched (dual-write ran end-to-end)
    expect(next.present[0].hook_text).toBe('Hook')
    expect(next.present[0].body_text).toBe('Body')
    // custom_texts mirror still well-formed; groupId is not in the legacy
    // projection so output equals pre-group state for the dual-write slice.
    expect(next.present[0].custom_texts).toBeDefined()
    expect(next.present[0].custom_texts!.length).toBe(2)
    expect(next.present[0].custom_texts!.map((c) => c.text).sort()).toEqual([
      'CT1',
      'CT2',
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 62 (Plan 62-03): GROUP → BULK_TRANSLATE → UNGROUP round-trip pin.
//
// PG1 verifies that the full Phase 62 user gesture chain (form group → drag
// the group → ungroup) is lossless against the legacy custom_texts mirror
// (BL-01 / applyDualWrite invariant). The reducer is correct by Plan 62-01 +
// Plan 60-03 contracts; this test pins the cross-action interaction so a
// future regression in either applyDualWrite or BULK_TRANSLATE skip rules
// is caught at the integration boundary.
// ─────────────────────────────────────────────────────────────────────────────

describe('editorReducer — Phase 62 Plan 03: GROUP → BULK_TRANSLATE → UNGROUP round-trip', () => {
  test('Test PG1: cycle preserves custom_texts mirror byte-correctness; positions reflect translate', () => {
    const initial = makeState([
      makeSlide({
        hook_text: 'Hook',
        body_text: 'Body',
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
          {
            id: 'tb-c1',
            role: 'custom',
            text: 'CT1',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb-c2',
            role: 'custom',
            text: 'CT2',
            position: { anchor: 'custom', x: 30, y: 30, width: 50 },
          },
        ],
      }),
    ])

    // Step 1: GROUP the 2 customs.
    const afterGroup = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['tb-c1', 'tb-c2'],
      groupId: 'g_pg1',
    })
    expect(afterGroup.past.length).toBe(1)
    const groupedC1 = afterGroup.present[0].text_boxes!.find((tb) => tb.id === 'tb-c1')!
    const groupedC2 = afterGroup.present[0].text_boxes!.find((tb) => tb.id === 'tb-c2')!
    expect(groupedC1.groupId).toBe('g_pg1')
    expect(groupedC2.groupId).toBe('g_pg1')

    // Step 2: BULK_TRANSLATE both members by +5%/+5%.
    const afterTranslate = editorReducer(afterGroup, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['tb-c1', 'tb-c2'],
      deltaX: 5,
      deltaY: 5,
    })
    expect(afterTranslate.past.length).toBe(2) // GROUP + BULK_TRANSLATE
    const translatedC1 = afterTranslate.present[0].text_boxes!.find((tb) => tb.id === 'tb-c1')!
    const translatedC2 = afterTranslate.present[0].text_boxes!.find((tb) => tb.id === 'tb-c2')!
    expect(translatedC1.position.x).toBe(15)
    expect(translatedC1.position.y).toBe(15)
    expect(translatedC2.position.x).toBe(35)
    expect(translatedC2.position.y).toBe(35)
    // groupId preserved across translate.
    expect(translatedC1.groupId).toBe('g_pg1')
    expect(translatedC2.groupId).toBe('g_pg1')

    // Step 3: UNGROUP — clears groupId; positions stay at the translated
    // values. Legacy custom_texts mirror reflects new positions + no groupId.
    const afterUngroup = editorReducer(afterTranslate, {
      type: 'UNGROUP',
      slideIndex: 0,
      ids: ['tb-c1', 'tb-c2'],
    })
    expect(afterUngroup.past.length).toBe(3)
    const finalC1 = afterUngroup.present[0].text_boxes!.find((tb) => tb.id === 'tb-c1')!
    const finalC2 = afterUngroup.present[0].text_boxes!.find((tb) => tb.id === 'tb-c2')!
    expect(finalC1.groupId).toBeUndefined()
    expect(finalC2.groupId).toBeUndefined()
    expect(finalC1.position.x).toBe(15)
    expect(finalC1.position.y).toBe(15)
    expect(finalC2.position.x).toBe(35)
    expect(finalC2.position.y).toBe(35)
    // Legacy custom_texts mirror reflects translated positions; no groupId
    // leaks into the legacy field projection.
    expect(afterUngroup.present[0].custom_texts).toBeDefined()
    expect(afterUngroup.present[0].custom_texts!.length).toBe(2)
    const legacyC1 = afterUngroup.present[0].custom_texts!.find((c) => c.id === 'tb-c1')!
    const legacyC2 = afterUngroup.present[0].custom_texts!.find((c) => c.id === 'tb-c2')!
    expect(legacyC1.x).toBe(15)
    expect(legacyC1.y).toBe(15)
    expect(legacyC2.x).toBe(35)
    expect(legacyC2.y).toBe(35)
    // PITFALL-3.6: groupId is editor-only — it MUST NOT appear on the legacy
    // custom_texts projection (CustomText type doesn't declare it; verify by
    // shape).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((legacyC1 as any).groupId).toBeUndefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((legacyC2 as any).groupId).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 63 (ALIGN-03..05, ALIGN-08, ALIGN-09, ALIGN-10): ALIGN + DISTRIBUTE
// reducer single-dispatch contract. Both actions:
//   - call pushHistory exactly once per dispatch (ALIGN-08 = PERF-01)
//   - apply patches from the pure align.ts layer (locked + watermark +
//     structural-anchor pre-filtered there — defense-in-depth at reducer)
//   - route text_boxes through applyDualWrite (BL-01)
//   - integer-rounded inputs (Math.round at the pure-fn boundary; reducer
//     does NOT re-round — would double-round)
// ─────────────────────────────────────────────────────────────────────────────

describe('editorReducer — Phase 63 (ALIGN-08): ALIGN single-dispatch contract', () => {
  test('Test AR1 (ALIGN-08 / PERF-01): one ALIGN → past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'ci1', url: 'u', x: 10, y: 20, width: 30, height: 40 },
        ],
      }),
    ])
    expect(initial.past.length).toBe(0)
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['ci1'],
      axis: 'left',
      target: 'canvas',
    })
    expect(next.past.length).toBe(1)
    expect(next.future.length).toBe(0)
  })

  test('Test AR2 (ALIGN-03): N=3 selection axis=left → all 3 elements get bounds.x', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 10, y: 10, width: 20, height: 20 },
          { id: 'b', url: 'u', x: 30, y: 30, width: 20, height: 20 },
          { id: 'c', url: 'u', x: 50, y: 50, width: 20, height: 20 },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['a', 'b', 'c'],
      axis: 'left',
      target: 'selection',
    })
    const imgs = next.present[0].custom_images!
    // bounds.x = leftmost = 10; all 3 patched to x=10
    expect(imgs.find((i) => i.id === 'a')!.x).toBe(10)
    expect(imgs.find((i) => i.id === 'b')!.x).toBe(10)
    expect(imgs.find((i) => i.id === 'c')!.x).toBe(10)
    // y untouched on horizontal axis
    expect(imgs.find((i) => i.id === 'a')!.y).toBe(10)
    expect(imgs.find((i) => i.id === 'b')!.y).toBe(30)
    expect(imgs.find((i) => i.id === 'c')!.y).toBe(50)
  })

  test('Test AR3 (ALIGN-10): N=3 with one locked → bounds includes locked, locked element x unchanged', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 10, y: 10, width: 20, height: 20, locked: true },
          { id: 'b', url: 'u', x: 30, y: 30, width: 20, height: 20 },
          { id: 'c', url: 'u', x: 50, y: 50, width: 20, height: 20 },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['a', 'b', 'c'],
      axis: 'left',
      target: 'selection',
    })
    const imgs = next.present[0].custom_images!
    // locked 'a' unchanged
    expect(imgs.find((i) => i.id === 'a')!.x).toBe(10)
    // bounds.x = 10 (from locked 'a') → b + c moved to 10
    expect(imgs.find((i) => i.id === 'b')!.x).toBe(10)
    expect(imgs.find((i) => i.id === 'c')!.x).toBe(10)
  })

  test('Test AR4 (ALIGN-10): watermark in selection → bounds includes watermark, watermark.position enum unchanged', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'img', url: 'u', x: 50, y: 50, width: 20, height: 20 },
        ],
        watermark: { id: 'w_0', enabled: true, position: 'top-left' },
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['w_0', 'img'],
      axis: 'left',
      target: 'selection',
    })
    // watermark placeholder rect: top-left → (0,0,18,5) → bounds.x = 0
    // img patched to x=0; watermark.position enum unchanged
    expect(next.present[0].custom_images![0].x).toBe(0)
    expect(next.present[0].watermark).toEqual({
      id: 'w_0',
      enabled: true,
      position: 'top-left',
    })
  })

  test('Test AR5 (ALIGN-09): every post-dispatch x/y is an integer', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 30.7777, y: 40.1234, width: 20.3333, height: 20 },
        ],
        text_boxes: [
          {
            id: 'tb',
            role: 'custom',
            text: 'X',
            position: { anchor: 'custom', x: 10.5, y: 20.5, width: 60 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['a', 'tb'],
      axis: 'center-h',
      target: 'canvas',
    })
    const ci = next.present[0].custom_images![0]
    const tb = next.present[0].text_boxes![0]
    expect(Number.isInteger(ci.x)).toBe(true)
    expect(Number.isInteger(tb.position.x as number)).toBe(true)
  })

  test('Test AR6 (BL-01): ALIGN moving custom-anchor text_box dual-writes to legacy custom_texts', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb',
            role: 'custom',
            text: 'X',
            position: { anchor: 'custom', x: 30, y: 40, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['tb'],
      axis: 'left',
      target: 'canvas',
    })
    const tb = next.present[0].text_boxes![0]
    expect(tb.position.x).toBe(0)
    // Legacy custom_texts mirror reflects the move.
    expect(next.present[0].custom_texts).toBeDefined()
    const legacy = next.present[0].custom_texts!.find((c) => c.id === 'tb')!
    expect(legacy.x).toBe(0)
    expect(legacy.y).toBe(40) // y untouched
  })

  test('Test AR7: ALIGN with empty ids → state ref unchanged; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [{ id: 'a', url: 'u', x: 10, y: 10, width: 20, height: 20 }],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: [],
      axis: 'left',
      target: 'canvas',
    })
    expect(next).toBe(initial) // ref equality
    expect(next.past.length).toBe(0)
  })

  test('Test AR7b: ALIGN where every id is locked → state ref unchanged; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 10, y: 10, width: 20, height: 20, locked: true },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'ALIGN',
      slideIndex: 0,
      ids: ['a'],
      axis: 'left',
      target: 'canvas',
    })
    // No movable candidates → no patches → ref-equal short-circuit → no pushHistory
    expect(next).toBe(initial)
    expect(next.past.length).toBe(0)
  })
})

describe('editorReducer — Phase 63 (ALIGN-08): DISTRIBUTE single-dispatch contract', () => {
  test('Test AR8 (ALIGN-08): one DISTRIBUTE → past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 0, y: 0, width: 10, height: 10 },
          { id: 'b', url: 'u', x: 30, y: 0, width: 10, height: 10 },
          { id: 'c', url: 'u', x: 80, y: 0, width: 10, height: 10 },
        ],
      }),
    ])
    expect(initial.past.length).toBe(0)
    const next = editorReducer(initial, {
      type: 'DISTRIBUTE',
      slideIndex: 0,
      ids: ['a', 'b', 'c'],
      axis: 'horizontal',
    })
    expect(next.past.length).toBe(1)
  })

  test('Test AR9: DISTRIBUTE with N<3 → state ref unchanged; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 0, y: 0, width: 10, height: 10 },
          { id: 'b', url: 'u', x: 90, y: 0, width: 10, height: 10 },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DISTRIBUTE',
      slideIndex: 0,
      ids: ['a', 'b'],
      axis: 'horizontal',
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(0)
  })

  test('Test AR10 (ALIGN-04, ALIGN-05): DISTRIBUTE horizontal N=3 — inner element gets equal-gap x', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 0, y: 0, width: 10, height: 10 },
          { id: 'b', url: 'u', x: 30, y: 0, width: 10, height: 10 },
          { id: 'c', url: 'u', x: 80, y: 0, width: 10, height: 10 },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DISTRIBUTE',
      slideIndex: 0,
      ids: ['a', 'b', 'c'],
      axis: 'horizontal',
    })
    const imgs = next.present[0].custom_images!
    // Outermost two pinned; middle.x = 0 + 10 + 30 = 40
    expect(imgs.find((i) => i.id === 'a')!.x).toBe(0)
    expect(imgs.find((i) => i.id === 'b')!.x).toBe(40)
    expect(imgs.find((i) => i.id === 'c')!.x).toBe(80)
  })

  test('Test AR11: DISTRIBUTE vertical N=3 — inner element gets equal-gap y', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 0, y: 0, width: 10, height: 10 },
          { id: 'b', url: 'u', x: 0, y: 30, width: 10, height: 10 },
          { id: 'c', url: 'u', x: 0, y: 80, width: 10, height: 10 },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DISTRIBUTE',
      slideIndex: 0,
      ids: ['a', 'b', 'c'],
      axis: 'vertical',
    })
    const imgs = next.present[0].custom_images!
    expect(imgs.find((i) => i.id === 'a')!.y).toBe(0)
    expect(imgs.find((i) => i.id === 'b')!.y).toBe(40)
    expect(imgs.find((i) => i.id === 'c')!.y).toBe(80)
  })

  test('Test AR12 (ALIGN-10): DISTRIBUTE with locked + watermark — both unchanged', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'a', url: 'u', x: 0, y: 0, width: 10, height: 10 },
          { id: 'b', url: 'u', x: 30, y: 0, width: 10, height: 10, locked: true },
          { id: 'c', url: 'u', x: 50, y: 0, width: 10, height: 10 },
          { id: 'd', url: 'u', x: 90, y: 0, width: 10, height: 10 },
        ],
        watermark: { id: 'w_0', enabled: true, position: 'bottom-right' },
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DISTRIBUTE',
      slideIndex: 0,
      ids: ['a', 'b', 'c', 'd', 'w_0'],
      axis: 'horizontal',
    })
    const imgs = next.present[0].custom_images!
    // 'b' is locked → unchanged at x=30; 'w_0' watermark filtered out.
    // After filter, candidates are [a, c, d] → outermost a + d pinned;
    //   inner_span = 100 - 30 = 70; gap = 35; c.x = 0 + 10 + 35 = 45
    expect(imgs.find((i) => i.id === 'a')!.x).toBe(0)
    expect(imgs.find((i) => i.id === 'b')!.x).toBe(30) // locked unchanged
    expect(imgs.find((i) => i.id === 'c')!.x).toBe(45)
    expect(imgs.find((i) => i.id === 'd')!.x).toBe(90)
    // Watermark.position enum unchanged
    expect(next.present[0].watermark!.position).toBe('bottom-right')
  })

  test('Test AR13 (BL-01): DISTRIBUTE moving text_boxes dual-writes to legacy custom_texts', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'a',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 0, y: 0, width: 10 },
          },
          {
            id: 'b',
            role: 'custom',
            text: 'B',
            position: { anchor: 'custom', x: 30, y: 0, width: 10 },
          },
          {
            id: 'c',
            role: 'custom',
            text: 'C',
            position: { anchor: 'custom', x: 80, y: 0, width: 10 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DISTRIBUTE',
      slideIndex: 0,
      ids: ['a', 'b', 'c'],
      axis: 'horizontal',
    })
    const tb = next.present[0].text_boxes!.find((t) => t.id === 'b')!
    // gap math: total inner span = (80+10) - 0 - (10+10+10) = 60; gap = 30
    //   middle.x = 0 + 10 + 30 = 40
    expect(tb.position.x).toBe(40)
    // Legacy custom_texts mirror reflects the move.
    expect(next.present[0].custom_texts).toBeDefined()
    const legacyB = next.present[0].custom_texts!.find((c) => c.id === 'b')!
    expect(legacyB.x).toBe(40)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 64 Plan 01 (LOCK-03, LOCK-04): SET_LOCKED single-dispatch contract +
// REMOVE_TEXT_BOX / REMOVE_CUSTOM_IMAGE / BULK_DELETE locked-skip guards.
//
// SET_LOCKED toggles `locked` on every listed id across text_boxes ∪
// custom_images ∪ watermark in a single dispatch + single pushHistory. Empty
// ids OR all-no-op (every listed element already at the target locked state)
// returns the prior state ref unchanged (matches UNGROUP idempotency from
// Plan 62). Routes text_boxes mutations through applyDualWrite (BL-01).
//
// REMOVE_TEXT_BOX / REMOVE_CUSTOM_IMAGE / BULK_DELETE silently skip elements
// where locked === true (LOCK-04 delete-prevention). Mirrors BULK_TRANSLATE's
// existing skip-locked pattern; reducers must stay pure (no console.warn).
// ─────────────────────────────────────────────────────────────────────────────
describe('editorReducer — Phase 64 Plan 01 (LOCK-03): SET_LOCKED single-dispatch contract', () => {
  test('Test SL1: SET_LOCKED with [tb1, ci1] → both elements have locked: true; past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
        custom_images: [
          { id: 'ci1', url: 'https://example.com/x.png', x: 30, y: 30, width: 20, height: 20 },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: ['tb1', 'ci1'],
      locked: true,
    })
    expect(next.present[0].text_boxes![0].locked).toBe(true)
    expect(next.present[0].custom_images![0].locked).toBe(true)
    expect(next.past.length).toBe(before + 1)
  })

  test('Test SL2: SET_LOCKED { ids: [tb1], locked: false } when tb1.locked is undefined → ref-equal short-circuit; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: ['tb1'],
      locked: false,
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })

  test('Test SL3: SET_LOCKED { ids: [tb1], locked: false } when tb1.locked === true → tb1.locked becomes false; past.length grows by 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
            locked: true,
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: ['tb1'],
      locked: false,
    })
    expect(next.present[0].text_boxes![0].locked).toBe(false)
    expect(next.past.length).toBe(before + 1)
  })

  test('Test SL4: SET_LOCKED on watermark id → watermark.locked toggled; past.length grows by 1', () => {
    const initial = makeState([
      makeSlide({
        watermark: { id: 'w0', enabled: true, position: 'bottom-right' },
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: ['w0'],
      locked: true,
    })
    expect(next.present[0].watermark!.locked).toBe(true)
    expect(next.past.length).toBe(before + 1)
  })

  test('Test SL5 (BL-01): SET_LOCKED routes text_boxes through applyDualWrite — legacy hook_text + custom_texts mirror unchanged', () => {
    const initial = makeState([
      makeSlide({
        hook_text: 'Hook',
        body_text: 'Body',
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
          {
            id: 'tb-c1',
            role: 'custom',
            text: 'CT1',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: ['tb-c1'],
      locked: true,
    })
    // hook_text / body_text untouched (proves dual-write ran end-to-end)
    expect(next.present[0].hook_text).toBe('Hook')
    expect(next.present[0].body_text).toBe('Body')
    // custom_texts mirror exists for the locked custom row.
    expect(next.present[0].custom_texts).toBeDefined()
    expect(next.present[0].custom_texts!.length).toBe(1)
    expect(next.present[0].custom_texts![0].text).toBe('CT1')
    // The locked field landed on the canonical text_boxes mirror.
    expect(next.present[0].text_boxes!.find((t) => t.id === 'tb-c1')!.locked).toBe(true)
  })

  test('Test SL6: SET_LOCKED with empty ids → ref-equal short-circuit; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: [],
      locked: true,
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })

  test('Test SL7 (LOCK-04): REMOVE_TEXT_BOX on locked text_box → state unchanged (no past growth, no mutation)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb-locked',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
            locked: true,
          },
          {
            id: 'tb-free',
            role: 'custom',
            text: 'B',
            position: { anchor: 'custom', x: 30, y: 30, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'REMOVE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'tb-locked',
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
    // Verify the free box is still present (locked guard didn't break the case)
    const next2 = editorReducer(initial, {
      type: 'REMOVE_TEXT_BOX',
      slideIndex: 0,
      textBoxId: 'tb-free',
    })
    expect(next2.present[0].text_boxes!.length).toBe(1)
    expect(next2.present[0].text_boxes![0].id).toBe('tb-locked')
  })

  test('Test SL7b (LOCK-04): REMOVE_CUSTOM_IMAGE on locked image → state unchanged', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'ci-locked', url: 'https://example.com/a.png', x: 10, y: 10, width: 20, height: 20, locked: true },
          { id: 'ci-free', url: 'https://example.com/b.png', x: 50, y: 50, width: 20, height: 20 },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'REMOVE_CUSTOM_IMAGE',
      slideIndex: 0,
      imageId: 'ci-locked',
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })

  test('Test SL8 (LOCK-04): BULK_DELETE { ids: [lockedTb, freeCi] } → only freeCi removed; lockedTb retained; past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb-locked',
            role: 'custom',
            text: 'L',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
            locked: true,
          },
        ],
        custom_images: [
          { id: 'ci-free', url: 'https://example.com/x.png', x: 30, y: 30, width: 20, height: 20 },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'BULK_DELETE',
      slideIndex: 0,
      ids: ['tb-locked', 'ci-free'],
    })
    // Locked text_box retained
    expect(next.present[0].text_boxes!.length).toBe(1)
    expect(next.present[0].text_boxes![0].id).toBe('tb-locked')
    // Free custom_image deleted
    expect(next.present[0].custom_images!.length).toBe(0)
    expect(next.past.length).toBe(before + 1)
  })

  test('Test SL8b (LOCK-04): BULK_DELETE where ALL ids are locked → empty patch list → ref-equal short-circuit', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb-locked',
            role: 'custom',
            text: 'L',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
            locked: true,
          },
        ],
        custom_images: [
          { id: 'ci-locked', url: 'https://example.com/x.png', x: 30, y: 30, width: 20, height: 20, locked: true },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'BULK_DELETE',
      slideIndex: 0,
      ids: ['tb-locked', 'ci-locked'],
    })
    // BULK_DELETE still calls pushHistory unconditionally (mirrors existing
    // behavior — the all-locked case can short-circuit at the slide-walk
    // level if neither array length changed). Spec asks for "empty patch
    // list → ref-equal short-circuit". Implementation: when the per-slide
    // map produces no changes AND the post-map slides every-ref-equal the
    // pre-map slides, return state unchanged.
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })

  test('Test SL9: SET_LOCKED with unknown ids is silently ignored (matches BULK_TRANSLATE robustness)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: ['unknown-id'],
      locked: true,
    })
    // No element matched → no change → state ref unchanged.
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 64 Plan 02 (LOCK-07, KBD-09): SET_HIDDEN single-dispatch contract.
//
// SET_HIDDEN toggles `hidden` on every listed id across text_boxes ∪
// custom_images ∪ watermark in a single dispatch + single pushHistory.
// Behavior IDENTICAL to SET_LOCKED (locked → hidden field swap). Empty ids
// OR all-no-op returns the prior state ref unchanged. Routes text_boxes
// mutations through applyDualWrite (BL-01).
// ─────────────────────────────────────────────────────────────────────────────
describe('editorReducer — Phase 64 Plan 02 (LOCK-07): SET_HIDDEN single-dispatch contract', () => {
  test('Test SH1: SET_HIDDEN with [tb1, ci1] → both elements have hidden: true; past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
        custom_images: [
          { id: 'ci1', url: 'https://example.com/x.png', x: 30, y: 30, width: 20, height: 20 },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_HIDDEN',
      slideIndex: 0,
      ids: ['tb1', 'ci1'],
      hidden: true,
    })
    expect(next.present[0].text_boxes![0].hidden).toBe(true)
    expect(next.present[0].custom_images![0].hidden).toBe(true)
    expect(next.past.length).toBe(before + 1)
  })

  test('Test SH2: SET_HIDDEN { ids: [tb1], hidden: false } when tb1.hidden is undefined → ref-equal short-circuit; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_HIDDEN',
      slideIndex: 0,
      ids: ['tb1'],
      hidden: false,
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })

  test('Test SH3: SET_HIDDEN on watermark id → watermark.hidden toggled; past.length grows by 1', () => {
    const initial = makeState([
      makeSlide({
        watermark: { id: 'w0', enabled: true, position: 'bottom-right' },
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_HIDDEN',
      slideIndex: 0,
      ids: ['w0'],
      hidden: true,
    })
    expect(next.present[0].watermark!.hidden).toBe(true)
    expect(next.past.length).toBe(before + 1)
  })

  test('Test SH4 (BL-01): SET_HIDDEN routes text_boxes through applyDualWrite — legacy hook_text + custom_texts mirror unchanged', () => {
    const initial = makeState([
      makeSlide({
        hook_text: 'Hook',
        body_text: 'Body',
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
          {
            id: 'tb-c1',
            role: 'custom',
            text: 'CT1',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'SET_HIDDEN',
      slideIndex: 0,
      ids: ['tb-c1'],
      hidden: true,
    })
    // hook_text / body_text untouched (proves dual-write ran end-to-end)
    expect(next.present[0].hook_text).toBe('Hook')
    expect(next.present[0].body_text).toBe('Body')
    // custom_texts mirror exists for the hidden custom row.
    expect(next.present[0].custom_texts).toBeDefined()
    expect(next.present[0].custom_texts!.length).toBe(1)
    expect(next.present[0].custom_texts![0].text).toBe('CT1')
    // The hidden field landed on the canonical text_boxes mirror.
    expect(next.present[0].text_boxes!.find((t) => t.id === 'tb-c1')!.hidden).toBe(true)
  })

  test('Test SH5: SET_HIDDEN with empty ids → ref-equal short-circuit; past.length unchanged', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'SET_HIDDEN',
      slideIndex: 0,
      ids: [],
      hidden: true,
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 64 Plan 03 (ZORDER-01..07, KBD-09): Z_ORDER single-dispatch contract.
//
// Single Z_ORDER action routes per-scope internally (text_boxes /
// custom_images / watermark). Cross-scope multi-selection produces ONE
// pushHistory entry — a 5-element multi-select Cmd+] is one undo step, not
// three (text_boxes + custom_images + watermark).
//
// ZORDER-05 (Satori parity invariant) is enforced in the pure transform
// `applyZOrderToArray` — array splice ONLY, never CSS layering. ZORDER-07
// constrains operation to within one element-type array (cross-array
// reorder deferred to v3.0+).
//
// Sort discipline (ZORDER-06): forward/front DESC, backward/back ASC.
// Adjacent-selected windows do NOT shift (Figma model — PITFALL-6.3).
// ─────────────────────────────────────────────────────────────────────────────
describe('editorReducer — Phase 64 Plan 03 (ZORDER-01..07): Z_ORDER single-dispatch contract', () => {
  test('Test ZR1: Z_ORDER { ids: [tb1], op: forward } moves tb1 forward in text_boxes; past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['tb1'],
      op: 'forward',
    })
    expect(next.present[0].text_boxes!.map((t) => t.id)).toEqual(['tb2', 'tb1'])
    expect(next.past.length).toBe(before + 1)
  })

  test('Test ZR2: Z_ORDER { ids: [ci2], op: back } moves ci2 to index 0 of custom_images', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          { id: 'ci1', url: 'https://example.com/1.png', x: 10, y: 10, width: 20, height: 20 },
          { id: 'ci2', url: 'https://example.com/2.png', x: 30, y: 30, width: 20, height: 20 },
          { id: 'ci3', url: 'https://example.com/3.png', x: 50, y: 50, width: 20, height: 20 },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['ci2'],
      op: 'back',
    })
    expect(next.present[0].custom_images!.map((c) => c.id)).toEqual(['ci2', 'ci1', 'ci3'])
    expect(next.past.length).toBe(before + 1)
  })

  test('Test ZR3 (cross-scope single dispatch): Z_ORDER { ids: [tb1, ci1], op: forward } mutates BOTH arrays; past.length grows by EXACTLY 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb2',
            role: 'custom',
            text: 'B',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
        custom_images: [
          { id: 'ci1', url: 'https://example.com/1.png', x: 10, y: 10, width: 20, height: 20 },
          { id: 'ci2', url: 'https://example.com/2.png', x: 30, y: 30, width: 20, height: 20 },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['tb1', 'ci1'],
      op: 'forward',
    })
    // Both arrays mutated: tb1 swapped with tb2; ci1 swapped with ci2.
    expect(next.present[0].text_boxes!.map((t) => t.id)).toEqual(['tb2', 'tb1'])
    expect(next.present[0].custom_images!.map((c) => c.id)).toEqual(['ci2', 'ci1'])
    // KBD-09: single pushHistory per gesture even when scope spans multiple types.
    expect(next.past.length).toBe(before + 1)
  })

  test('Test ZR4 (multi-selection sort discipline): Z_ORDER { ids: [tb_a, tb_c], op: forward } on [a, b, c, d] → [b, a, d, c]', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'tb_a', role: 'custom', text: 'A', position: { anchor: 'custom', x: 10, y: 10, width: 50 } },
          { id: 'tb_b', role: 'custom', text: 'B', position: { anchor: 'custom', x: 20, y: 20, width: 50 } },
          { id: 'tb_c', role: 'custom', text: 'C', position: { anchor: 'custom', x: 30, y: 30, width: 50 } },
          { id: 'tb_d', role: 'custom', text: 'D', position: { anchor: 'custom', x: 40, y: 40, width: 50 } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['tb_a', 'tb_c'],
      op: 'forward',
    })
    // Mirrors ZA3 from the pure transform tests — DESC sort: c moves first
    // ([a,b,c,d] → [a,b,d,c]); then a ([a,b,d,c] → [b,a,d,c]).
    expect(next.present[0].text_boxes!.map((t) => t.id)).toEqual(['tb_b', 'tb_a', 'tb_d', 'tb_c'])
  })

  test('Test ZR5 (BL-01 dual-write): Z_ORDER on text_boxes routes through applyDualWrite — legacy custom_texts mirror order matches text_boxes order', () => {
    const initial = makeState([
      makeSlide({
        hook_text: 'Hook',
        body_text: 'Body',
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
          {
            id: 'tb-c1',
            role: 'custom',
            text: 'C1',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
          {
            id: 'tb-c2',
            role: 'custom',
            text: 'C2',
            position: { anchor: 'custom', x: 20, y: 20, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['tb-c1'],
      op: 'forward',
    })
    // tb-c1 swapped with tb-c2 (the only valid forward neighbor — hook/body
    // are also in the array but the swap is index-local: c1 was at idx 2,
    // c2 at idx 3 → after swap [hook, body, c2, c1]).
    expect(next.present[0].text_boxes!.map((t) => t.id)).toEqual([
      'tb-hook',
      'tb-body',
      'tb-c2',
      'tb-c1',
    ])
    // hook_text / body_text untouched (proves dual-write ran end-to-end).
    expect(next.present[0].hook_text).toBe('Hook')
    expect(next.present[0].body_text).toBe('Body')
    // custom_texts mirror reflects the new text_boxes order: c2 BEFORE c1.
    expect(next.present[0].custom_texts).toBeDefined()
    expect(next.present[0].custom_texts!.length).toBe(2)
    expect(next.present[0].custom_texts!.map((c) => c.text)).toEqual(['C2', 'C1'])
  })

  test('Test ZR6: Z_ORDER with empty ids → ref-equal short-circuit (no pushHistory)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: [],
      op: 'forward',
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })

  test('Test ZR7: Z_ORDER on watermark id (length-1 implicit array) → ref-equal no-op', () => {
    const initial = makeState([
      makeSlide({
        watermark: { id: 'w0', enabled: true, position: 'bottom-right' },
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['w0'],
      op: 'forward',
    })
    // Watermark is a single slot; "z-order on watermark" cannot move within
    // a length-1 scope. Ref-equal no-op (no pushHistory).
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })

  test('Test ZR8: Z_ORDER with id not present in any scope → ref-equal no-op', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const before = initial.past.length
    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['ghost-id-not-anywhere'],
      op: 'forward',
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(before)
  })
})

// Phase 66 Plan 02 (DIFF-01, KBD-09, PERF-01): DUPLICATE_ELEMENTS_AT — Alt+drag
// duplicate. Holding Alt during a drag produces COPIES at the drag-end position
// while leaving the originals at their start positions (Figma model — RESEARCH
// F39). Single pushHistory per dispatch; routes text_boxes through
// applyDualWrite; honors the same skip-set as BULK_TRANSLATE (locked / structural
// / watermark).
describe('editorReducer — Phase 66 Plan 02 (DIFF-01): DUPLICATE_ELEMENTS_AT', () => {
  test('DE1: text_box duplicate — copy gets new id + delta-applied position; original unchanged', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 20, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['tb1'],
      deltaX: 5,
      deltaY: 3,
    })
    const tbs = next.present[0].text_boxes!
    expect(tbs.length).toBe(2) // original + copy
    const original = tbs.find((tb) => tb.id === 'tb1')!
    const copy = tbs.find((tb) => tb.id !== 'tb1')!
    // Original unchanged
    expect(original.position.x).toBe(10)
    expect(original.position.y).toBe(20)
    expect(original.text).toBe('A')
    // Copy has different id + delta-shifted position
    expect(copy.id).not.toBe('tb1')
    expect(typeof copy.id).toBe('string')
    expect(copy.id.length).toBeGreaterThan(0)
    expect(copy.position.x).toBe(15)
    expect(copy.position.y).toBe(23)
    expect(copy.text).toBe('A') // deep-copy preserves all schema fields
    expect(copy.role).toBe('custom')
  })

  test('DE2: custom_image duplicate — copy gets new id + delta-applied position; original unchanged', () => {
    const initial = makeState([
      makeSlide({
        custom_images: [
          {
            id: 'ci1',
            url: 'https://example.com/x.png',
            x: 30,
            y: 40,
            width: 30,
            height: 30,
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['ci1'],
      deltaX: 2,
      deltaY: 1,
    })
    const cis = next.present[0].custom_images!
    expect(cis.length).toBe(2)
    const original = cis.find((ci) => ci.id === 'ci1')!
    const copy = cis.find((ci) => ci.id !== 'ci1')!
    expect(original.x).toBe(30)
    expect(original.y).toBe(40)
    expect(copy.id).not.toBe('ci1')
    expect(copy.x).toBe(32)
    expect(copy.y).toBe(41)
    expect(copy.url).toBe('https://example.com/x.png')
    expect(copy.width).toBe(30)
    expect(copy.height).toBe(30)
  })

  test('DE3: locked text_box is silently skipped — no copy created', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb-locked',
            role: 'custom',
            text: 'Locked',
            locked: true,
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['tb-locked'],
      deltaX: 5,
      deltaY: 5,
    })
    expect(next.present[0].text_boxes!.length).toBe(1) // unchanged
    expect(next).toBe(initial) // ref-equal short-circuit (no pushHistory)
  })

  test('DE4: structural-anchor / non-custom-role text_box is silently skipped', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'H', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'B', position: { anchor: 'bottom' } },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['tb-hook', 'tb-body'],
      deltaX: 5,
      deltaY: 5,
    })
    expect(next.present[0].text_boxes!.length).toBe(2) // unchanged
    expect(next).toBe(initial)
  })

  test('DE5: watermark id is silently skipped (lives on slide.watermark, not iterated)', () => {
    const initial = makeState([
      makeSlide({
        watermark: { id: 'w0', enabled: true, position: 'bottom-right' },
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['w0'],
      deltaX: 10,
      deltaY: 10,
    })
    expect(next.present[0].watermark).toEqual({
      id: 'w0',
      enabled: true,
      position: 'bottom-right',
    })
    expect(next).toBe(initial) // no copy, no pushHistory
  })

  test('DE6: newGroupId — both copies receive groupId; originals unchanged; applyDualWrite invoked', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
            // no groupId initially
          },
        ],
        custom_images: [
          {
            id: 'ci1',
            url: 'https://example.com/x.png',
            x: 20,
            y: 20,
            width: 30,
            height: 30,
            // no groupId initially
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['tb1', 'ci1'],
      deltaX: 3,
      deltaY: 4,
      newGroupId: 'g_test_xyz',
    })
    const slide = next.present[0]
    // Find copies
    const tbCopy = slide.text_boxes!.find((tb) => tb.id !== 'tb1')!
    const ciCopy = slide.custom_images!.find((ci) => ci.id !== 'ci1')!
    expect(tbCopy.groupId).toBe('g_test_xyz')
    expect(ciCopy.groupId).toBe('g_test_xyz')
    // Originals' groupIds unchanged (still undefined)
    const tbOriginal = slide.text_boxes!.find((tb) => tb.id === 'tb1')!
    const ciOriginal = slide.custom_images!.find((ci) => ci.id === 'ci1')!
    expect(tbOriginal.groupId).toBeUndefined()
    expect(ciOriginal.groupId).toBeUndefined()
    // applyDualWrite invoked: custom_texts mirror grew by 1 (the copied custom text_box)
    expect(slide.custom_texts!.length).toBe(2)
  })

  test('DE7 (PERF-01): single pushHistory per dispatch — past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
        custom_images: [
          {
            id: 'ci1',
            url: 'https://example.com/x.png',
            x: 20,
            y: 20,
            width: 30,
            height: 30,
          },
        ],
      }),
    ])
    expect(initial.past.length).toBe(0)
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['tb1', 'ci1'],
      deltaX: 5,
      deltaY: 5,
    })
    expect(next.past.length).toBe(1) // exactly one pushHistory call
    expect(next.future.length).toBe(0)
  })

  test('DE-EMPTY: ids = [] → silent no-op (no pushHistory)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: [],
      deltaX: 5,
      deltaY: 5,
    })
    expect(next).toBe(initial) // ref-equal — no pushHistory
  })

  test('DE-STALE: ids = ["nonexistent"] → silent no-op (no pushHistory)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['does-not-exist'],
      deltaX: 5,
      deltaY: 5,
    })
    expect(next).toBe(initial) // ref-equal — no pushHistory
  })

  test('DE-DUALWRITE: duplicating a custom-role text_box mirrors to legacy custom_texts; hook/body unchanged', () => {
    const initial = makeState([
      makeSlide({
        hook_text: 'Hook',
        body_text: 'Body',
        text_boxes: [
          { id: 'tb-hook', role: 'hook', text: 'Hook', position: { anchor: 'top' } },
          { id: 'tb-body', role: 'body', text: 'Body', position: { anchor: 'bottom' } },
          {
            id: 'tb-custom',
            role: 'custom',
            text: 'CustomText',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    // The fixture didn't run through dual-write yet (custom_texts undefined).
    // Count the custom-role text_boxes in the initial state instead, which is
    // what applyDualWrite will use to regenerate custom_texts.
    const customRoleCountBefore = (initial.present[0].text_boxes ?? []).filter(
      (tb) => tb.role === 'custom',
    ).length
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['tb-custom'],
      deltaX: 5,
      deltaY: 5,
    })
    const slide = next.present[0]
    // dual-write: hook_text / body_text remain bytewise identical
    expect(slide.hook_text).toBe('Hook')
    expect(slide.body_text).toBe('Body')
    // custom_texts mirror reflects the post-duplicate text_boxes (original + copy)
    expect(slide.custom_texts!.length).toBe(customRoleCountBefore + 1)
  })

  test('DE-NON-MATCHING-SLIDE: dispatch on slideIndex 99 leaves all slides ref-equal (no pushHistory)', () => {
    const initial = makeState([
      makeSlide({
        text_boxes: [
          {
            id: 'tb1',
            role: 'custom',
            text: 'A',
            position: { anchor: 'custom', x: 10, y: 10, width: 50 },
          },
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 99,
      ids: ['tb1'],
      deltaX: 5,
      deltaY: 5,
    })
    expect(next).toBe(initial)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 68 Plan 01 (EDITOR-02 partial — 3 NEW actions only):
//   ADD_DECORATION / UPDATE_DECORATION / REMOVE_DECORATION reducer tests.
//
// Mirrors v2.11 Phase 64 LOCK / Z_ORDER / SET_HIDDEN action shapes:
//   - single pushHistory per non-no-op dispatch (KBD-09 / PERF-01),
//   - locked-honor short-circuit on UPDATE/REMOVE (mirror REMOVE_TEXT_BOX
//     line 366-372 / REMOVE_CUSTOM_IMAGE line 311-319 gates),
//   - ref-equal short-circuit on no-op paths (no history pollution),
//   - cross-scope isolation: text_boxes / custom_images / watermark refs
//     unchanged when only decorations mutate (PRS9 isolation precursor for
//     Plan 68-03).
// ─────────────────────────────────────────────────────────────────────────────

function makeIconDecoration(id: string, overrides: Partial<IconDecoration> = {}): IconDecoration {
  return {
    kind: 'icon',
    id,
    position: { x: 10, y: 20, width: 15, height: 15 },
    lucideName: 'Heart',
    color: '#FF0000',
    strokeWidth: 2,
    ...overrides,
  }
}

function makeShapeDecoration(id: string, overrides: Partial<ShapeDecoration> = {}): ShapeDecoration {
  return {
    kind: 'shape',
    id,
    position: { x: 30, y: 30, width: 20, height: 20 },
    shapeKind: 'rect',
    fill: '#00FF00',
    cornerRadius: 8,
    ...overrides,
  }
}

describe('Phase 68 Plan 01: ADD/UPDATE/REMOVE_DECORATION', () => {
  // ─── ADD_DECORATION ─────────────────────────────────────────────────────────

  test('Test ADD-1: ADD_DECORATION on slide with decorations === undefined → decorations = [payload]; one pushHistory', () => {
    const initial = makeState([makeSlide()])
    expect(initial.present[0].decorations).toBeUndefined()
    const dec: Decoration = makeIconDecoration('d1')
    const next = editorReducer(initial, {
      type: 'ADD_DECORATION',
      slideIndex: 0,
      decoration: dec,
    })
    expect(next.present[0].decorations).toBeDefined()
    expect(next.present[0].decorations!.length).toBe(1)
    expect(next.present[0].decorations![0]).toEqual(dec)
    expect(next.past.length).toBe(initial.past.length + 1)
  })

  test('Test ADD-2: ADD_DECORATION on slide with existing decorations → array length grows by 1; new item is at the END', () => {
    const d0 = makeIconDecoration('d0')
    const initial = makeState([makeSlide({ decorations: [d0] })])
    const d1 = makeShapeDecoration('d1')
    const next = editorReducer(initial, {
      type: 'ADD_DECORATION',
      slideIndex: 0,
      decoration: d1,
    })
    expect(next.present[0].decorations!.length).toBe(2)
    expect(next.present[0].decorations![0].id).toBe('d0') // unchanged at front
    expect(next.present[0].decorations![1].id).toBe('d1') // new at end (mirror ADD_CUSTOM_IMAGE precedent)
  })

  test('Test ADD-3: ADD_DECORATION preserves text_boxes / custom_images / watermark reference-equal pre/post', () => {
    const tbs = [{ id: 'tb1', role: 'custom' as const, text: 'X', position: { anchor: 'custom' as const, x: 0, y: 0, width: 50 } }]
    const cis = [{ id: 'ci1', url: 'u', x: 0, y: 0, width: 10, height: 10 }]
    const wm = { id: 'w0', enabled: true, position: 'bottom-right' as const }
    const initial = makeState([
      makeSlide({ text_boxes: tbs, custom_images: cis, watermark: wm }),
    ])
    const next = editorReducer(initial, {
      type: 'ADD_DECORATION',
      slideIndex: 0,
      decoration: makeIconDecoration('d1'),
    })
    // Cross-scope isolation: other scope arrays/refs untouched (PRS9 precursor).
    expect(next.present[0].text_boxes).toBe(initial.present[0].text_boxes)
    expect(next.present[0].custom_images).toBe(initial.present[0].custom_images)
    expect(next.present[0].watermark).toBe(initial.present[0].watermark)
  })

  test('Test ADD-4: ADD_DECORATION emits exactly ONE pushHistory entry; future cleared', () => {
    const initial: EditorHistory = {
      past: [],
      present: [makeSlide()],
      future: [[makeSlide({ hook_text: 'stale-future' })]], // pre-existing future to be cleared
    }
    const next = editorReducer(initial, {
      type: 'ADD_DECORATION',
      slideIndex: 0,
      decoration: makeIconDecoration('d1'),
    })
    expect(next.past.length).toBe(1)
    expect(next.future).toEqual([]) // pushHistory clears future
  })

  test('Test ADD-5: ADD_DECORATION preserves caller-supplied id (reducer does NOT regenerate)', () => {
    const initial = makeState([makeSlide()])
    const explicit = makeIconDecoration('decoration-with-explicit-id-12345')
    const next = editorReducer(initial, {
      type: 'ADD_DECORATION',
      slideIndex: 0,
      decoration: explicit,
    })
    expect(next.present[0].decorations![0].id).toBe('decoration-with-explicit-id-12345')
  })

  // ─── UPDATE_DECORATION ──────────────────────────────────────────────────────

  test('Test UPD-1: UPDATE_DECORATION merges shallow into the matching decoration; non-matching unchanged', () => {
    const initial = makeState([
      makeSlide({
        decorations: [
          makeIconDecoration('d1'),
          makeIconDecoration('d2', { color: '#0000FF' }),
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'd1',
      updates: { color: '#00FF00', strokeWidth: 4 },
    })
    const d1 = next.present[0].decorations![0] as IconDecoration
    const d2 = next.present[0].decorations![1] as IconDecoration
    expect(d1.color).toBe('#00FF00')
    expect(d1.strokeWidth).toBe(4)
    expect(d1.lucideName).toBe('Heart') // preserved
    // Non-matching id ref-equal pre/post.
    expect(d2).toBe(initial.present[0].decorations![1])
  })

  test('Test UPD-2: UPDATE_DECORATION on locked decoration short-circuits — state ref-equal', () => {
    const initial = makeState([
      makeSlide({
        decorations: [makeIconDecoration('d1', { locked: true, color: '#FF0000' })],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'd1',
      updates: { color: '#000000' },
    })
    expect(next).toBe(initial) // ref-equal: locked-honor + no pushHistory pollution
  })

  test('Test UPD-3: UPDATE_DECORATION with unknown id → silent no-op, state ref-equal', () => {
    const initial = makeState([
      makeSlide({ decorations: [makeIconDecoration('d1')] }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'does-not-exist',
      updates: { color: '#000000' },
    })
    expect(next).toBe(initial)
  })

  test('Test UPD-4: UPDATE_DECORATION { updates: { locked: false } } on previously-locked → does NOT toggle (lock-gate guards CONTENT only)', () => {
    // Per plan: "the lock gate guards CONTENT updates only, not the lock-flag
    // itself". UPDATE_DECORATION on a locked decoration short-circuits even if
    // the payload would clear the lock — toggling locked is the dedicated
    // SET_LOCKED action's job (Plan 68-02).
    const initial = makeState([
      makeSlide({ decorations: [makeIconDecoration('d1', { locked: true })] }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'd1',
      updates: { locked: false },
    })
    expect(next).toBe(initial)
    expect(next.present[0].decorations![0].locked).toBe(true)
  })

  test('Test UPD-5: UPDATE_DECORATION on slide with decorations === undefined → no-op (no array materialization)', () => {
    const initial = makeState([makeSlide()])
    expect(initial.present[0].decorations).toBeUndefined()
    const next = editorReducer(initial, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'd1',
      updates: { /* anything */ },
    })
    expect(next).toBe(initial)
    expect(next.present[0].decorations).toBeUndefined()
  })

  // ─── REMOVE_DECORATION ──────────────────────────────────────────────────────

  test('Test REM-1: REMOVE_DECORATION filters the matching id from slide.decorations', () => {
    const initial = makeState([
      makeSlide({
        decorations: [
          makeIconDecoration('d1'),
          makeIconDecoration('d2'),
          makeIconDecoration('d3'),
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'REMOVE_DECORATION',
      slideIndex: 0,
      id: 'd2',
    })
    expect(next.present[0].decorations!.length).toBe(2)
    expect(next.present[0].decorations!.map((d) => d.id)).toEqual(['d1', 'd3'])
    expect(next.past.length).toBe(initial.past.length + 1)
  })

  test('Test REM-2: REMOVE_DECORATION on locked decoration → no-op, state ref-equal', () => {
    const initial = makeState([
      makeSlide({ decorations: [makeIconDecoration('d1', { locked: true })] }),
    ])
    const next = editorReducer(initial, {
      type: 'REMOVE_DECORATION',
      slideIndex: 0,
      id: 'd1',
    })
    expect(next).toBe(initial)
    expect(next.present[0].decorations!.length).toBe(1) // still there
  })

  test('Test REM-3: REMOVE_DECORATION with unknown id → silent no-op', () => {
    const initial = makeState([
      makeSlide({ decorations: [makeIconDecoration('d1')] }),
    ])
    const next = editorReducer(initial, {
      type: 'REMOVE_DECORATION',
      slideIndex: 0,
      id: 'does-not-exist',
    })
    expect(next).toBe(initial)
  })

  test('Test REM-4: REMOVE_DECORATION on slide with decorations === undefined → no-op', () => {
    const initial = makeState([makeSlide()])
    const next = editorReducer(initial, {
      type: 'REMOVE_DECORATION',
      slideIndex: 0,
      id: 'd1',
    })
    expect(next).toBe(initial)
    expect(next.present[0].decorations).toBeUndefined()
  })

  test('Test REM-5: REMOVE_DECORATION clears array entirely when last element removed (slide.decorations becomes [])', () => {
    const initial = makeState([
      makeSlide({ decorations: [makeIconDecoration('d1')] }),
    ])
    const next = editorReducer(initial, {
      type: 'REMOVE_DECORATION',
      slideIndex: 0,
      id: 'd1',
    })
    // The field remains defined as an empty array — Phase 67 baseline preserved
    // (PTF16 idempotent absence is for `decorations === undefined`; a
    // realized-then-emptied array is a distinct state).
    expect(next.present[0].decorations).toBeDefined()
    expect(next.present[0].decorations!.length).toBe(0)
  })

  // ─── ISOLATION (PRS9 precursor) ─────────────────────────────────────────────

  test('Test ISO-1: ADD_DECORATION leaves text_boxes / custom_images / watermark ref-equal pre/post', () => {
    const tbs = [{ id: 'tb1', role: 'custom' as const, text: 'X', position: { anchor: 'custom' as const, x: 0, y: 0, width: 50 } }]
    const cis = [{ id: 'ci1', url: 'u', x: 0, y: 0, width: 10, height: 10 }]
    const wm = { id: 'w0', enabled: true, position: 'bottom-right' as const }
    const initial = makeState([
      makeSlide({ text_boxes: tbs, custom_images: cis, watermark: wm }),
    ])
    const next = editorReducer(initial, {
      type: 'ADD_DECORATION',
      slideIndex: 0,
      decoration: makeShapeDecoration('d1'),
    })
    expect(next.present[0].text_boxes).toBe(initial.present[0].text_boxes)
    expect(next.present[0].custom_images).toBe(initial.present[0].custom_images)
    expect(next.present[0].watermark).toBe(initial.present[0].watermark)
  })

  test('Test ISO-2: UPDATE_DECORATION leaves the OTHER scopes ref-equal pre/post', () => {
    const tbs = [{ id: 'tb1', role: 'custom' as const, text: 'X', position: { anchor: 'custom' as const, x: 0, y: 0, width: 50 } }]
    const cis = [{ id: 'ci1', url: 'u', x: 0, y: 0, width: 10, height: 10 }]
    const wm = { id: 'w0', enabled: true, position: 'bottom-right' as const }
    const initial = makeState([
      makeSlide({
        text_boxes: tbs,
        custom_images: cis,
        watermark: wm,
        decorations: [makeIconDecoration('d1')],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'd1',
      updates: { color: '#123456' },
    })
    expect(next.present[0].text_boxes).toBe(initial.present[0].text_boxes)
    expect(next.present[0].custom_images).toBe(initial.present[0].custom_images)
    expect(next.present[0].watermark).toBe(initial.present[0].watermark)
  })

  test('Test ISO-3: REMOVE_DECORATION leaves the OTHER scopes ref-equal pre/post', () => {
    const tbs = [{ id: 'tb1', role: 'custom' as const, text: 'X', position: { anchor: 'custom' as const, x: 0, y: 0, width: 50 } }]
    const cis = [{ id: 'ci1', url: 'u', x: 0, y: 0, width: 10, height: 10 }]
    const wm = { id: 'w0', enabled: true, position: 'bottom-right' as const }
    const initial = makeState([
      makeSlide({
        text_boxes: tbs,
        custom_images: cis,
        watermark: wm,
        decorations: [makeIconDecoration('d1')],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'REMOVE_DECORATION',
      slideIndex: 0,
      id: 'd1',
    })
    expect(next.present[0].text_boxes).toBe(initial.present[0].text_boxes)
    expect(next.present[0].custom_images).toBe(initial.present[0].custom_images)
    expect(next.present[0].watermark).toBe(initial.present[0].watermark)
  })

  // ─── EXHAUSTIVENESS GATE ────────────────────────────────────────────────────

  test('Test EXH-1: a switch on AddressableScope handling all 4 cases compiles and dispatches correctly', () => {
    // Mirror the helper Plan 68-02 will export from the canonical walker
    // module: switch on AddressableScope, return scope-specific count.
    function countByScope(scope: AddressableScope, slide: Slide): number {
      switch (scope) {
        case 'text_boxes':
          return (slide.text_boxes ?? []).length
        case 'custom_images':
          return (slide.custom_images ?? []).length
        case 'watermark':
          return slide.watermark ? 1 : 0
        case 'decorations':
          return (slide.decorations ?? []).length
        default:
          return assertExhaustiveScope(scope)
      }
    }
    const slide = makeSlide({
      text_boxes: [{ id: 'tb1', role: 'custom', text: 'X', position: { anchor: 'custom', x: 0, y: 0, width: 50 } }],
      custom_images: [{ id: 'ci1', url: 'u', x: 0, y: 0, width: 10, height: 10 }],
      watermark: { id: 'w0', enabled: true, position: 'bottom-right' },
      decorations: [makeIconDecoration('d1'), makeIconDecoration('d2')],
    })
    expect(countByScope('text_boxes', slide)).toBe(1)
    expect(countByScope('custom_images', slide)).toBe(1)
    expect(countByScope('watermark', slide)).toBe(1)
    expect(countByScope('decorations', slide)).toBe(2)
  })

  test('Test EXH-2: switch missing "decorations" case fails compile-time gate (negative test)', () => {
    // Same negative-case pattern as addressable-scope.test.ts Test 5: a
    // switch that omits 'decorations' narrows `scope` to 'decorations' in the
    // default arm, which is not assignable to `never`. The `// @ts-expect-error`
    // succeeds only when this line WOULD fail compilation — proving the
    // compile-time gate works for reducer-side helpers too.
    function brokenSwitch(scope: AddressableScope): number {
      switch (scope) {
        case 'text_boxes':
          return 0
        case 'custom_images':
          return 1
        case 'watermark':
          return 2
        // 'decorations' DELIBERATELY MISSING
        default:
          // @ts-expect-error - 'decorations' is not assignable to type 'never'
          return assertExhaustiveScope(scope)
      }
    }
    expect(() => brokenSwitch('decorations')).toThrow(/non-exhaustive/)
  })

  // ─── pushHistory invariant pinning ──────────────────────────────────────────

  test('pushHistory: ADD/UPDATE/REMOVE_DECORATION emit exactly ONE history entry per non-no-op dispatch (KBD-09 invariant)', () => {
    const initial = makeState([makeSlide()])
    const afterAdd = editorReducer(initial, {
      type: 'ADD_DECORATION',
      slideIndex: 0,
      decoration: makeIconDecoration('d1'),
    })
    expect(afterAdd.past.length).toBe(initial.past.length + 1)

    const afterUpdate = editorReducer(afterAdd, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'd1',
      updates: { color: '#000' },
    })
    expect(afterUpdate.past.length).toBe(afterAdd.past.length + 1)

    const afterRemove = editorReducer(afterUpdate, {
      type: 'REMOVE_DECORATION',
      slideIndex: 0,
      id: 'd1',
    })
    expect(afterRemove.past.length).toBe(afterUpdate.past.length + 1)
  })
})

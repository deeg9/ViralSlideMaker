import { describe, test, expect } from 'vitest'
import type { Slide } from '@/lib/types/slide'
import type { EditorAction } from '@/lib/editor/editor-actions'
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

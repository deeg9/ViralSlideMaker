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

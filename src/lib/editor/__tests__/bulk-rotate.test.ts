import { describe, test, expect } from 'vitest'
import type { Slide, IconDecoration, ShapeDecoration, TextBox, CustomImage, Watermark } from '@/lib/types/slide'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'

/**
 * Phase 72 Plan 01 (ROTATE-03, EDITOR-07): BULK_ROTATE reducer single-dispatch
 * contract. Mirrors BULK_TRANSLATE shape (Phase 60 PERF-01) — exactly one
 * pushHistory per dispatch; locked decorations skipped (LOCK-04 honor); cross-
 * scope ref-equality preserved for non-decoration scopes (v2.12 routes only
 * decorations participation).
 */

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

function makeIconDec(
  id: string,
  pos: { x: number; y: number; width: number; height: number },
  overrides: Partial<IconDecoration> = {},
): IconDecoration {
  return {
    kind: 'icon',
    id,
    position: pos,
    lucideName: 'Heart',
    color: '#FF0000',
    strokeWidth: 2,
    ...overrides,
  }
}

function makeShapeDec(
  id: string,
  pos: { x: number; y: number; width: number; height: number },
  overrides: Partial<ShapeDecoration> = {},
): ShapeDecoration {
  return {
    kind: 'shape',
    id,
    position: pos,
    shapeKind: 'rect',
    fill: '#00FF00',
    ...overrides,
  }
}

describe('editorReducer — Phase 72 Plan 01: BULK_ROTATE single-dispatch contract', () => {
  test('Test 1: BULK_ROTATE on a single decoration sets rotation field to dispatched value', () => {
    const initial = makeState([
      makeSlide({
        decorations: [makeIconDec('d1', { x: 10, y: 10, width: 20, height: 20 })],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      ids: ['d1'],
      rotation: 45,
    })
    expect(next.present[0].decorations![0].rotation).toBe(45)
  })

  test('Test 2 (LOCK-04 honor): locked decoration is NOT rotated', () => {
    const initial = makeState([
      makeSlide({
        decorations: [
          makeIconDec(
            'd-locked',
            { x: 10, y: 10, width: 20, height: 20 },
            { locked: true, rotation: 0 },
          ),
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      ids: ['d-locked'],
      rotation: 90,
    })
    // rotation field unchanged
    expect(next.present[0].decorations![0].rotation).toBe(0)
  })

  test('Test 3 (PERF-01): one BULK_ROTATE → past.length grows by exactly 1', () => {
    const initial = makeState([
      makeSlide({
        decorations: [makeIconDec('d1', { x: 10, y: 10, width: 20, height: 20 })],
      }),
    ])
    expect(initial.past.length).toBe(0)
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      ids: ['d1'],
      rotation: 30,
    })
    expect(next.past.length).toBe(1)
    expect(next.future.length).toBe(0)
  })

  test('Test 4: rotation=0 still updates field (clear-rotation case)', () => {
    const initial = makeState([
      makeSlide({
        decorations: [
          makeIconDec(
            'd1',
            { x: 10, y: 10, width: 20, height: 20 },
            { rotation: 45 },
          ),
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      ids: ['d1'],
      rotation: 0,
    })
    expect(next.present[0].decorations![0].rotation).toBe(0)
  })

  test('Test 5: BULK_ROTATE with various canonical angles round-trip through state', () => {
    const angles = [-180, 180, 45, -45, 90, 30]
    for (const angle of angles) {
      const initial = makeState([
        makeSlide({
          decorations: [makeIconDec('d1', { x: 10, y: 10, width: 20, height: 20 })],
        }),
      ])
      const next = editorReducer(initial, {
        type: 'BULK_ROTATE',
        slideIndex: 0,
        ids: ['d1'],
        rotation: angle,
      })
      expect(next.present[0].decorations![0].rotation).toBe(angle)
    }
  })

  test('Test 6: empty ids → no state change AND no pushHistory entry', () => {
    const initial = makeState([
      makeSlide({
        decorations: [makeIconDec('d1', { x: 10, y: 10, width: 20, height: 20 })],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      ids: [],
      rotation: 45,
    })
    expect(next).toBe(initial) // ref-equal — no change
    expect(next.past.length).toBe(0)
  })

  test('Test 7: non-existent id is a no-op (no throw, no state change)', () => {
    const initial = makeState([
      makeSlide({
        decorations: [makeIconDec('d1', { x: 10, y: 10, width: 20, height: 20 })],
      }),
    ])
    expect(() =>
      editorReducer(initial, {
        type: 'BULK_ROTATE',
        slideIndex: 0,
        ids: ['does-not-exist'],
        rotation: 45,
      }),
    ).not.toThrow()
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      ids: ['does-not-exist'],
      rotation: 45,
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(0)
  })

  test('Test 8: BULK_ROTATE on multi-decoration ids updates all listed decorations to the same rotation', () => {
    const initial = makeState([
      makeSlide({
        decorations: [
          makeIconDec('d1', { x: 10, y: 10, width: 20, height: 20 }),
          makeShapeDec('d2', { x: 30, y: 30, width: 20, height: 20 }),
          makeIconDec('d3', { x: 50, y: 50, width: 20, height: 20 }),
        ],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      ids: ['d1', 'd2', 'd3'],
      rotation: 75,
    })
    expect(next.present[0].decorations![0].rotation).toBe(75)
    expect(next.present[0].decorations![1].rotation).toBe(75)
    expect(next.present[0].decorations![2].rotation).toBe(75)
  })

  test('Test 9: BULK_ROTATE on slide with no decorations is a no-op', () => {
    const initial = makeState([makeSlide({})])
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      ids: ['anything'],
      rotation: 45,
    })
    expect(next).toBe(initial)
    expect(next.past.length).toBe(0)
  })

  test('Test 10 (cross-scope isolation): text_boxes / custom_images / watermark are NOT mutated by BULK_ROTATE', () => {
    const tb: TextBox = {
      id: 'tb1',
      role: 'custom',
      text: 'A',
      position: { anchor: 'custom', x: 10, y: 10, width: 50 },
    }
    const ci: CustomImage = {
      id: 'ci1',
      url: 'https://example.com/x.png',
      x: 10,
      y: 20,
      width: 30,
      height: 30,
    }
    const wm: Watermark = {
      id: 'w0',
      enabled: true,
      position: 'bottom-right',
    }
    const initial = makeState([
      makeSlide({
        text_boxes: [tb],
        custom_images: [ci],
        watermark: wm,
        decorations: [makeIconDec('d1', { x: 10, y: 10, width: 20, height: 20 })],
      }),
    ])
    const next = editorReducer(initial, {
      type: 'BULK_ROTATE',
      slideIndex: 0,
      // Even if non-decoration ids are passed, they MUST not be touched.
      ids: ['tb1', 'ci1', 'w0', 'd1'],
      rotation: 45,
    })
    // Non-decoration scopes preserved by reference (cross-scope isolation).
    expect(next.present[0].text_boxes![0]).toBe(tb)
    expect(next.present[0].custom_images![0]).toBe(ci)
    expect(next.present[0].watermark).toBe(wm)
    // Decoration rotated as expected.
    expect(next.present[0].decorations![0].rotation).toBe(45)
  })
})

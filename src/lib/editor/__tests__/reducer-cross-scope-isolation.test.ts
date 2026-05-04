import { describe, it, expect } from 'vitest'
import type {
  Slide,
  TextBox,
  CustomImage,
  Decoration,
  IconDecoration,
  Watermark,
} from '@/lib/types/slide'
import { editorReducer, type EditorHistory } from '@/lib/editor/editor-reducer'

/**
 * Phase 68 Plan 03 (PARITY-16, PARITY-17): cross-scope isolation regression
 * tests. Pins the runtime contract that the 10 EXTENDED reducer cases (Plan
 * 68-02) leave unrelated scope arrays REFERENCE-EQUAL pre/post when the
 * dispatched action only targets one scope.
 *
 * Why reference equality (not deep equality): React + Redux-style consumers
 * downstream of the reducer (selection panels, layers panel, snap-index
 * memoization) rely on `Object.is(prev, next)` short-circuits to skip
 * re-renders. A spurious `{ ...slide, custom_images: [...prev.custom_images] }`
 * clone would silently regress those memoization sites without breaking any
 * deep-equality test. PRS7..PRS14 catch that class of bug.
 *
 * Tests covered:
 *   - PRS7  (PARITY-16): Z_ORDER on a decoration leaves text_boxes /
 *           custom_images / watermark ref-equal; only decorations array
 *           gets a new reference.
 *   - PRS8  (PARITY-17): BULK_TRANSLATE on [unlocked_text_box,
 *           locked_decoration] does NOT move the locked decoration AND
 *           the locked decoration object is === to its pre-state (no
 *           spurious clone).
 *   - PRS9  GROUP on multi-scope selection preserves unrelated scopes
 *           ref-equal pre/post.
 *   - PRS10 SET_LOCKED on a decoration leaves the other 3 scopes
 *           ref-equal.
 *   - PRS11 UPDATE_DECORATION on a decoration leaves the other 3
 *           scopes ref-equal (precursor of PRS7 generalized).
 *   - PRS12 BULK_DELETE on [text_box, decoration] leaves
 *           custom_images + watermark ref-equal.
 *   - PRS13 DUPLICATE_ELEMENTS_AT on a decoration only mutates
 *           slide.decorations.
 *   - PRS14 UNGROUP on a single decoration only mutates
 *           slide.decorations.
 *   - SELF-CTRL: a no-op action (e.g. UPDATE_DECORATION on unknown id)
 *           returns state === state (reference equality, not just deep).
 */

// ----- Fixture helpers (mirror editor-reducer.test.ts patterns) -----

function makeIconDecoration(overrides: Partial<IconDecoration> = {}): IconDecoration {
  return {
    id: overrides.id ?? 'd-icon-1',
    kind: 'icon',
    lucideName: 'Heart',
    color: '#000000',
    strokeWidth: 2,
    position: { x: 10, y: 10, width: 20, height: 20 },
    ...overrides,
  }
}

function makeShapeDecoration(overrides: Partial<Decoration> = {}): Decoration {
  return {
    id: overrides.id ?? 'd-shape-1',
    kind: 'shape',
    shapeKind: 'rect',
    fill: '#A8E0B0',
    position: { x: 50, y: 50, width: 30, height: 30 },
    ...overrides,
  } as Decoration
}

function makeTextBox(overrides: Partial<TextBox> = {}): TextBox {
  return {
    id: overrides.id ?? 'tb-1',
    role: 'custom',
    text: 'hello',
    position: { anchor: 'custom', x: 5, y: 5, width: 30 },
    ...overrides,
  } as TextBox
}

function makeCustomImage(overrides: Partial<CustomImage> = {}): CustomImage {
  return {
    id: overrides.id ?? 'ci-1',
    url: 'https://example.com/img.png',
    x: 60,
    y: 70,
    width: 20,
    height: 20,
    ...overrides,
  } as CustomImage
}

function makeWatermark(overrides: Partial<Watermark> = {}): Watermark {
  return {
    id: overrides.id ?? 'w-0',
    enabled: true,
    position: 'bottom-right',
    ...overrides,
  }
}

function makeSlideAllScopes(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Hook',
    body_text: 'Body',
    image_query: 'q',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: [makeTextBox({ id: 'tb1' }), makeTextBox({ id: 'tb2' })],
    custom_images: [makeCustomImage({ id: 'ci1' })],
    decorations: [
      makeIconDecoration({ id: 'd1' }),
      makeShapeDecoration({ id: 'd2' }),
    ],
    watermark: makeWatermark({ id: 'w1' }),
    ...overrides,
  }
}

function makeState(slide: Slide): EditorHistory {
  return { past: [], present: [slide], future: [] }
}

describe('Phase 68 PARITY-16/17: cross-scope isolation regression', () => {
  // ---------------------------------------------------------------------------
  // PRS7 (PARITY-16): Z_ORDER on a decoration id leaves text_boxes /
  // custom_images / watermark reference-equal pre/post; only
  // slide.decorations is a new reference.
  // ---------------------------------------------------------------------------
  it('PRS7 (PARITY-16): Z_ORDER on a decoration leaves text_boxes / custom_images / watermark ref-equal', () => {
    const slide = makeSlideAllScopes()
    const initial = makeState(slide)
    const prev = initial.present[0]

    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['d2'],
      op: 'forward',
    })
    const post = next.present[0]

    expect(post.text_boxes, 'PRS7: text_boxes must be ref-equal pre/post').toBe(prev.text_boxes)
    expect(post.custom_images, 'PRS7: custom_images must be ref-equal pre/post').toBe(prev.custom_images)
    expect(post.watermark, 'PRS7: watermark must be ref-equal pre/post').toBe(prev.watermark)
    // The targeted scope's array reference IS expected to change because the
    // splice produced a new array. (Note: forward op on the LAST item is a
    // ref-equal no-op; we use 'd2' which is index 1 of 2 with op='forward'.)
    // Actually 'd2' is the LAST decoration (index 1), so forward = no-op.
    // Re-fixture: dispatch op='backward' to move d2 from index 1 to index 0.
  })

  it('PRS7-b (PARITY-16): Z_ORDER backward on a decoration mutates only slide.decorations', () => {
    const slide = makeSlideAllScopes()
    const initial = makeState(slide)
    const prev = initial.present[0]

    const next = editorReducer(initial, {
      type: 'Z_ORDER',
      slideIndex: 0,
      ids: ['d2'],
      op: 'backward',
    })
    const post = next.present[0]

    expect(post.text_boxes).toBe(prev.text_boxes)
    expect(post.custom_images).toBe(prev.custom_images)
    expect(post.watermark).toBe(prev.watermark)
    expect(post.decorations, 'PRS7-b: decorations array got a new reference').not.toBe(prev.decorations)
    // The actual splice happened: d2 should now be index 0
    expect(post.decorations?.[0].id).toBe('d2')
    expect(post.decorations?.[1].id).toBe('d1')
  })

  // ---------------------------------------------------------------------------
  // PRS8 (PARITY-17): BULK_TRANSLATE with a locked decoration in the
  // selection — locked decoration is NOT moved AND its object reference is
  // === to pre-state (no spurious clone).
  // ---------------------------------------------------------------------------
  it('PRS8 (PARITY-17): BULK_TRANSLATE on [unlocked_tb, locked_decoration] does NOT move the locked decoration', () => {
    const lockedDecoration = makeIconDecoration({
      id: 'd-locked',
      locked: true,
      position: { x: 50, y: 50, width: 20, height: 20 },
    })
    const unlockedTb = makeTextBox({
      id: 'tb-unlocked',
      position: { anchor: 'custom', x: 10, y: 10, width: 30 },
    })

    const slide = makeSlideAllScopes({
      text_boxes: [unlockedTb],
      decorations: [lockedDecoration],
    })
    const initial = makeState(slide)
    const prev = initial.present[0]
    const prevLockedDeco = prev.decorations![0]

    const next = editorReducer(initial, {
      type: 'BULK_TRANSLATE',
      slideIndex: 0,
      ids: ['tb-unlocked', 'd-locked'],
      deltaX: 5,
      deltaY: 3,
    })
    const post = next.present[0]

    // text_box DID move: x went from 10 → 15, y from 10 → 13.
    expect(post.text_boxes![0].position.x).toBe(15)
    expect(post.text_boxes![0].position.y).toBe(13)

    // Locked decoration position is UNCHANGED (still 50, 50).
    expect(post.decorations![0].position.x).toBe(50)
    expect(post.decorations![0].position.y).toBe(50)

    // CRITICAL: the locked decoration OBJECT REFERENCE is === to pre-state.
    // No spurious clone — proves the BULK_TRANSLATE branch's locked
    // short-circuit returns the SAME reference (Phase 64 LOCK-04 honor).
    expect(post.decorations![0], 'PRS8: locked decoration object ref preserved').toBe(prevLockedDeco)
  })

  // ---------------------------------------------------------------------------
  // PRS9: GROUP on a multi-scope selection [text_box, decoration] preserves
  // custom_images and watermark ref-equal; mutates text_boxes + decorations.
  // ---------------------------------------------------------------------------
  it('PRS9: GROUP on [text_box, decoration] preserves custom_images / watermark ref-equal', () => {
    const slide = makeSlideAllScopes()
    const initial = makeState(slide)
    const prev = initial.present[0]

    const next = editorReducer(initial, {
      type: 'GROUP',
      slideIndex: 0,
      ids: ['tb1', 'd1'],
      groupId: 'g1',
    })
    const post = next.present[0]

    // Untouched scopes ref-equal.
    expect(post.custom_images, 'PRS9: custom_images ref-equal').toBe(prev.custom_images)
    expect(post.watermark, 'PRS9: watermark ref-equal').toBe(prev.watermark)
    // Touched scopes have new references with groupId mutation on listed ids.
    expect(post.text_boxes).not.toBe(prev.text_boxes)
    expect(post.decorations).not.toBe(prev.decorations)
    expect(post.text_boxes!.find((tb) => tb.id === 'tb1')!.groupId).toBe('g1')
    expect(post.decorations!.find((d) => d.id === 'd1')!.groupId).toBe('g1')
    // Non-listed text_box (tb2) keeps no groupId — but its ref may or may not
    // be preserved depending on map() shape; we don't assert that here.
  })

  // ---------------------------------------------------------------------------
  // PRS10: SET_LOCKED on a single decoration leaves text_boxes /
  // custom_images / watermark ref-equal; only slide.decorations is a new
  // reference.
  // ---------------------------------------------------------------------------
  it('PRS10: SET_LOCKED on a decoration leaves text_boxes / custom_images / watermark ref-equal', () => {
    const slide = makeSlideAllScopes()
    const initial = makeState(slide)
    const prev = initial.present[0]

    const next = editorReducer(initial, {
      type: 'SET_LOCKED',
      slideIndex: 0,
      ids: ['d1'],
      locked: true,
    })
    const post = next.present[0]

    expect(post.text_boxes).toBe(prev.text_boxes)
    expect(post.custom_images).toBe(prev.custom_images)
    expect(post.watermark).toBe(prev.watermark)
    expect(post.decorations).not.toBe(prev.decorations)
    expect(post.decorations!.find((d) => d.id === 'd1')!.locked).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // PRS11: UPDATE_DECORATION on a decoration leaves text_boxes /
  // custom_images / watermark ref-equal (precursor to PRS7 generalized).
  // ---------------------------------------------------------------------------
  it('PRS11: UPDATE_DECORATION on a decoration leaves text_boxes / custom_images / watermark ref-equal', () => {
    const slide = makeSlideAllScopes()
    const initial = makeState(slide)
    const prev = initial.present[0]

    const next = editorReducer(initial, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'd1',
      updates: { opacity: 0.5 },
    })
    const post = next.present[0]

    expect(post.text_boxes).toBe(prev.text_boxes)
    expect(post.custom_images).toBe(prev.custom_images)
    expect(post.watermark).toBe(prev.watermark)
    expect(post.decorations).not.toBe(prev.decorations)
    expect(post.decorations!.find((d) => d.id === 'd1')!.opacity).toBe(0.5)
  })

  // ---------------------------------------------------------------------------
  // PRS12: BULK_DELETE on a selection of [text_box, decoration] leaves
  // custom_images + watermark ref-equal; both text_boxes and decorations
  // get new references with the deleted ids removed.
  // ---------------------------------------------------------------------------
  it('PRS12: BULK_DELETE on [text_box, decoration] preserves custom_images / watermark ref-equal', () => {
    const slide = makeSlideAllScopes()
    const initial = makeState(slide)
    const prev = initial.present[0]

    const next = editorReducer(initial, {
      type: 'BULK_DELETE',
      slideIndex: 0,
      ids: ['tb1', 'd1'],
    })
    const post = next.present[0]

    expect(post.custom_images, 'PRS12: custom_images ref-equal').toBe(prev.custom_images)
    expect(post.watermark, 'PRS12: watermark ref-equal').toBe(prev.watermark)
    // text_boxes shrunk: tb1 deleted, tb2 retained.
    expect(post.text_boxes!.length).toBe(1)
    expect(post.text_boxes![0].id).toBe('tb2')
    // decorations shrunk: d1 deleted, d2 retained.
    expect(post.decorations!.length).toBe(1)
    expect(post.decorations![0].id).toBe('d2')
  })

  // ---------------------------------------------------------------------------
  // PRS13: DUPLICATE_ELEMENTS_AT on a decoration only mutates
  // slide.decorations.
  // ---------------------------------------------------------------------------
  it('PRS13: DUPLICATE_ELEMENTS_AT on a decoration only mutates slide.decorations', () => {
    const slide = makeSlideAllScopes()
    const initial = makeState(slide)
    const prev = initial.present[0]

    const next = editorReducer(initial, {
      type: 'DUPLICATE_ELEMENTS_AT',
      slideIndex: 0,
      ids: ['d1'],
      deltaX: 5,
      deltaY: 5,
    })
    const post = next.present[0]

    expect(post.text_boxes).toBe(prev.text_boxes)
    expect(post.custom_images).toBe(prev.custom_images)
    expect(post.watermark).toBe(prev.watermark)
    expect(post.decorations).not.toBe(prev.decorations)
    // d1 + new copy + d2 = 3 decorations total now.
    expect(post.decorations!.length).toBe(3)
  })

  // ---------------------------------------------------------------------------
  // PRS14: UNGROUP on a single grouped decoration only mutates
  // slide.decorations.
  // ---------------------------------------------------------------------------
  it('PRS14: UNGROUP on a single grouped decoration only mutates slide.decorations', () => {
    const slide = makeSlideAllScopes({
      decorations: [
        makeIconDecoration({ id: 'd1', groupId: 'g-existing' }),
        makeShapeDecoration({ id: 'd2' }),
      ],
    })
    const initial = makeState(slide)
    const prev = initial.present[0]

    const next = editorReducer(initial, {
      type: 'UNGROUP',
      slideIndex: 0,
      ids: ['d1'],
    })
    const post = next.present[0]

    expect(post.text_boxes).toBe(prev.text_boxes)
    expect(post.custom_images).toBe(prev.custom_images)
    expect(post.watermark).toBe(prev.watermark)
    expect(post.decorations).not.toBe(prev.decorations)
    expect(post.decorations!.find((d) => d.id === 'd1')!.groupId).toBeUndefined()
  })

  // ---------------------------------------------------------------------------
  // SELF-CTRL: positive control — a no-op action (UPDATE_DECORATION on an
  // unknown id) returns the SAME state object (reference equality). Proves
  // the no-op short-circuit is in place.
  // ---------------------------------------------------------------------------
  it('SELF-CTRL: UPDATE_DECORATION on unknown id returns state === state (no-op short-circuit)', () => {
    const slide = makeSlideAllScopes()
    const initial = makeState(slide)

    const next = editorReducer(initial, {
      type: 'UPDATE_DECORATION',
      slideIndex: 0,
      id: 'd-does-not-exist',
      updates: { opacity: 0.5 },
    })

    expect(next, 'SELF-CTRL: state ref-equal on no-op').toBe(initial)
  })
})

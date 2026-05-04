import { describe, test, expect } from 'vitest'
import type {
  Slide,
  TextBox,
  CustomImage,
  Watermark,
  Decoration,
  IconDecoration,
  ShapeDecoration,
} from '@/lib/types/slide'
import {
  walkAddressableElements,
  synthesizeRows,
  computeAllLocked,
  computeAllHidden,
  getGroupMembers,
  decorationLabel,
} from '@/lib/editor/addressable-element-walkers'

// Phase 68 Plan 02 (EDITOR-10): canonical walker module tests. Mirrors the
// purity + 4-scope coverage discipline of group-membership.test.ts and
// selection-bounds.test.ts.

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeTextBox(
  id: string,
  overrides: Partial<TextBox> = {},
): TextBox {
  return {
    id,
    role: 'custom',
    text: '',
    position: { anchor: 'custom', x: 0, y: 0, width: 50 },
    ...overrides,
  }
}

function makeCustomImage(
  id: string,
  overrides: Partial<CustomImage> = {},
): CustomImage {
  return {
    id,
    url: 'https://example.com/x.png',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    ...overrides,
  }
}

function makeWatermark(
  id: string,
  overrides: Partial<Watermark> = {},
): Watermark {
  return {
    id,
    enabled: true,
    position: 'bottom-right',
    ...overrides,
  }
}

function makeIconDecoration(
  id: string,
  overrides: Partial<IconDecoration> = {},
): IconDecoration {
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

function makeShapeDecoration(
  id: string,
  overrides: Partial<ShapeDecoration> = {},
): ShapeDecoration {
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

function makeSlide(
  opts: {
    text_boxes?: TextBox[]
    custom_images?: CustomImage[]
    decorations?: Decoration[]
    watermark?: Watermark
  } = {},
): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: opts.text_boxes,
    custom_images: opts.custom_images,
    decorations: opts.decorations,
    watermark: opts.watermark,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// walkAddressableElements
// ─────────────────────────────────────────────────────────────────────────────

describe('walkAddressableElements — canonical 4-scope walk order', () => {
  test('W1: yields elements in canonical order text_boxes → custom_images → decorations → watermark', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1'), makeTextBox('tb2')],
      custom_images: [makeCustomImage('ci1')],
      decorations: [makeIconDecoration('d1'), makeShapeDecoration('d2')],
      watermark: makeWatermark('w0'),
    })
    const out = walkAddressableElements(slide)
    expect(out.map((e) => e.id)).toEqual(['tb1', 'tb2', 'ci1', 'd1', 'd2', 'w0'])
    expect(out.map((e) => e.scope)).toEqual([
      'text_boxes',
      'text_boxes',
      'custom_images',
      'decorations',
      'decorations',
      'watermark',
    ])
  })

  test('W2: each element carries {id, groupId, locked, hidden, type, label, scope} with scope literal correct', () => {
    const slide = makeSlide({
      text_boxes: [
        makeTextBox('tb1', { text: 'Hello', groupId: 'g1', locked: true }),
      ],
      custom_images: [
        makeCustomImage('ci1', { hidden: true, groupId: 'g2' }),
      ],
      decorations: [makeIconDecoration('d1', { locked: true, groupId: 'g3' })],
      watermark: makeWatermark('w0', { groupId: 'g4', hidden: true }),
    })
    const out = walkAddressableElements(slide)
    expect(out[0]).toMatchObject({
      id: 'tb1',
      groupId: 'g1',
      locked: true,
      hidden: false,
      type: 'text',
      scope: 'text_boxes',
    })
    expect(out[1]).toMatchObject({
      id: 'ci1',
      groupId: 'g2',
      locked: false,
      hidden: true,
      type: 'image',
      scope: 'custom_images',
    })
    expect(out[2]).toMatchObject({
      id: 'd1',
      groupId: 'g3',
      locked: true,
      hidden: false,
      type: 'decoration',
      scope: 'decorations',
    })
    expect(out[3]).toMatchObject({
      id: 'w0',
      groupId: 'g4',
      locked: false,
      hidden: true,
      type: 'watermark',
      scope: 'watermark',
    })
  })

  test('W4-edge: walkAddressableElements on slide with decorations === undefined yields zero decoration entries (legacy compat)', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1')],
      custom_images: [makeCustomImage('ci1')],
      watermark: makeWatermark('w0'),
    })
    const out = walkAddressableElements(slide)
    expect(out.find((e) => e.scope === 'decorations')).toBeUndefined()
    expect(out.length).toBe(3)
  })

  test('W11: empty slide returns []', () => {
    const slide = makeSlide({})
    expect(walkAddressableElements(slide)).toEqual([])
  })

  test('W12: only-decorations slide returns just the decoration entries', () => {
    const slide = makeSlide({
      decorations: [makeIconDecoration('d1'), makeShapeDecoration('d2')],
    })
    const out = walkAddressableElements(slide)
    expect(out.length).toBe(2)
    expect(out.every((e) => e.scope === 'decorations')).toBe(true)
  })

  test('W18: watermark-only slide yields one element with scope=watermark', () => {
    const slide = makeSlide({ watermark: makeWatermark('w0') })
    const out = walkAddressableElements(slide)
    expect(out.length).toBe(1)
    expect(out[0]).toMatchObject({ id: 'w0', scope: 'watermark' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// synthesizeRows
// ─────────────────────────────────────────────────────────────────────────────

describe('synthesizeRows — group-header emission + chip emission', () => {
  test('W3: [tb1+tb2 in g1, ci1, d1+d2 in g1, watermark] emits group-header for g1 with memberIds=[tb1,tb2,d1,d2] THEN ungrouped chips', () => {
    const slide = makeSlide({
      text_boxes: [
        makeTextBox('tb1', { groupId: 'g1' }),
        makeTextBox('tb2', { groupId: 'g1' }),
      ],
      custom_images: [makeCustomImage('ci1')],
      decorations: [
        makeIconDecoration('d1', { groupId: 'g1' }),
        makeShapeDecoration('d2', { groupId: 'g1' }),
      ],
      watermark: makeWatermark('w0'),
    })
    const rows = synthesizeRows(slide)
    expect(rows[0].kind).toBe('group-header')
    if (rows[0].kind === 'group-header') {
      expect(rows[0].groupId).toBe('g1')
      // memberIds in canonical 4-scope walk order
      expect(rows[0].memberIds).toEqual(['tb1', 'tb2', 'd1', 'd2'])
    }
  })

  test('W4: synthesizeRows on slide with decorations === undefined produces zero decoration chips', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1')],
      custom_images: [makeCustomImage('ci1')],
      watermark: makeWatermark('w0'),
    })
    const rows = synthesizeRows(slide)
    expect(rows.find((r) => r.kind === 'chip' && r.elementType === 'decoration')).toBeUndefined()
    expect(rows.length).toBe(3)
  })

  test('W22: chip order matches walkAddressableElements order (across non-grouped slide)', () => {
    const slide = makoSlideOrdered()
    const elements = walkAddressableElements(slide)
    const rows = synthesizeRows(slide)
    const chipIds = rows.filter((r) => r.kind === 'chip').map((r) => r.kind === 'chip' ? r.id : '')
    expect(chipIds).toEqual(elements.map((e) => e.id))
  })

  test('W25: group emitted exactly once when members split across non-consecutive scopes', () => {
    // tb1 and d1 share g1; ci1 (no group) sits between them in walk order.
    // Walker visits tb1 first (g1 emitted); ci1 (no header); d1 (g1 already
    // emitted — must NOT re-emit).
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', { groupId: 'g1' })],
      custom_images: [makeCustomImage('ci1')],
      decorations: [makeIconDecoration('d1', { groupId: 'g1' })],
    })
    const rows = synthesizeRows(slide)
    const headers = rows.filter((r) => r.kind === 'group-header')
    expect(headers.length).toBe(1)
    expect(headers[0].kind === 'group-header' && headers[0].groupId).toBe('g1')
  })
})

// helper for W22
function makoSlideOrdered(): Slide {
  return makeSlide({
    text_boxes: [makeTextBox('tb1'), makeTextBox('tb2')],
    custom_images: [makeCustomImage('ci1')],
    decorations: [makeIconDecoration('d1')],
    watermark: makeWatermark('w0'),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// computeAllLocked / computeAllHidden — 4-scope roll-up
// ─────────────────────────────────────────────────────────────────────────────

describe('computeAllLocked — 4-scope roll-up', () => {
  test('W5: returns true only when EVERY id has locked === true', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', { locked: true })],
      custom_images: [makeCustomImage('ci1', { locked: true })],
      decorations: [makeIconDecoration('d1', { locked: true })],
      watermark: makeWatermark('w0', { locked: true }),
    })
    expect(computeAllLocked(slide, ['tb1', 'ci1', 'd1', 'w0'])).toBe(true)
  })

  test('W23: returns false on mixed lock state (one unlocked decoration)', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', { locked: true })],
      decorations: [makeIconDecoration('d1', { locked: false })],
    })
    expect(computeAllLocked(slide, ['tb1', 'd1'])).toBe(false)
  })

  test('W14: locked decoration alone returns true', () => {
    const slide = makeSlide({
      decorations: [makeIconDecoration('d1', { locked: true })],
    })
    expect(computeAllLocked(slide, ['d1'])).toBe(true)
  })

  test('returns false on empty ids array (degenerate guard)', () => {
    const slide = makeSlide({
      decorations: [makeIconDecoration('d1', { locked: true })],
    })
    expect(computeAllLocked(slide, [])).toBe(false)
  })
})

describe('computeAllHidden — 4-scope roll-up', () => {
  test('W6: returns true only when EVERY id has hidden === true', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', { hidden: true })],
      decorations: [makeIconDecoration('d1', { hidden: true })],
    })
    expect(computeAllHidden(slide, ['tb1', 'd1'])).toBe(true)
  })

  test('W24: returns false on mixed hidden state (one visible decoration)', () => {
    const slide = makeSlide({
      decorations: [
        makeIconDecoration('d1', { hidden: true }),
        makeShapeDecoration('d2', { hidden: false }),
      ],
    })
    expect(computeAllHidden(slide, ['d1', 'd2'])).toBe(false)
  })

  test('W13: hidden decoration alone returns true', () => {
    const slide = makeSlide({
      decorations: [makeIconDecoration('d1', { hidden: true })],
    })
    expect(computeAllHidden(slide, ['d1'])).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getGroupMembers — 4-scope walk
// ─────────────────────────────────────────────────────────────────────────────

describe('getGroupMembers — canonical 4-scope walk', () => {
  test('W7: walks all 4 scopes including decorations; returns flat array of ids matching groupId', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', { groupId: 'gx' })],
      custom_images: [makeCustomImage('ci1', { groupId: 'gx' })],
      decorations: [makeIconDecoration('d1', { groupId: 'gx' })],
      watermark: makeWatermark('w0', { groupId: 'gx' }),
    })
    expect(getGroupMembers(slide, 'gx')).toEqual(['tb1', 'ci1', 'd1', 'w0'])
  })

  test('W8: cross-scope group with [tb_id, decoration_id] returns ids in canonical scope order (text_boxes before decorations)', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', { groupId: 'gx' })],
      decorations: [makeIconDecoration('d1', { groupId: 'gx' })],
    })
    expect(getGroupMembers(slide, 'gx')).toEqual(['tb1', 'd1'])
  })

  test("W9: empty groupId ('') short-circuits to []", () => {
    const slide = makeSlide({
      decorations: [makeIconDecoration('d1', { groupId: 'gx' })],
    })
    expect(getGroupMembers(slide, '')).toEqual([])
  })

  test('W17: getGroupMembers on slide with no decorations still works for legacy fixtures', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', { groupId: 'gx' })],
      custom_images: [makeCustomImage('ci1', { groupId: 'gx' })],
      watermark: makeWatermark('w0', { groupId: 'gx' }),
    })
    expect(getGroupMembers(slide, 'gx')).toEqual(['tb1', 'ci1', 'w0'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// decorationLabel
// ─────────────────────────────────────────────────────────────────────────────

describe('decorationLabel — discriminator-aware label generation', () => {
  test('W10a: icon → lucideName ("Heart")', () => {
    const d = makeIconDecoration('d1', { lucideName: 'Heart' })
    expect(decorationLabel(d)).toBe('Heart')
  })

  test('W10b: shape rect → "Rectangle"', () => {
    const d = makeShapeDecoration('d1', { shapeKind: 'rect' })
    expect(decorationLabel(d)).toBe('Rectangle')
  })

  test('W10c: shape star → "Star"', () => {
    const d = makeShapeDecoration('d1', { shapeKind: 'star' })
    expect(decorationLabel(d)).toBe('Star')
  })

  test('W19: shape decoration with name set takes precedence over shapeKind', () => {
    const d = makeShapeDecoration('d1', {
      shapeKind: 'rect',
      name: 'My Custom Rect',
    })
    expect(decorationLabel(d)).toBe('My Custom Rect')
  })

  test('W20 (defensive): falls back to "Decoration" if discriminator narrowing fails', () => {
    // Construct a degenerate Decoration-like object to exercise the
    // defensive default branch. In normal flow tsc + the ingest validator
    // prevent this; this test pins the fallback for when defensive runtime
    // narrowing matters.
    const degenerate = { kind: 'unknown', id: 'd1' } as unknown as Decoration
    expect(decorationLabel(degenerate)).toBe('Decoration')
  })
})

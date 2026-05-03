import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { Slide, TextBox, CustomImage, Watermark } from '@/lib/types/slide'
import { getGroupMembers, shouldGroupDrag } from '@/lib/editor/transforms/group-membership'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers (mirrors use-selection-model.test.ts patterns)
// ─────────────────────────────────────────────────────────────────────────────

function makeTextBox(id: string, groupId?: string): TextBox {
  return {
    id,
    role: 'custom',
    text: '',
    position: { anchor: 'custom', x: 0, y: 0, width: 50 },
    ...(groupId !== undefined ? { groupId } : {}),
  }
}

function makeCustomImage(id: string, groupId?: string): CustomImage {
  return {
    id,
    url: 'https://example.com/x.png',
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    ...(groupId !== undefined ? { groupId } : {}),
  }
}

function makeWatermark(id: string, groupId?: string): Watermark {
  return {
    id,
    enabled: true,
    position: 'bottom-right',
    ...(groupId !== undefined ? { groupId } : {}),
  }
}

function makeSlide(opts: {
  text_boxes?: TextBox[]
  custom_images?: CustomImage[]
  watermark?: Watermark
} = {}): Slide {
  return {
    hook_text: '',
    body_text: '',
    image_query: '',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    text_boxes: opts.text_boxes,
    custom_images: opts.custom_images,
    watermark: opts.watermark,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests — Phase 62 Plan 01 (GROUP-02..05)
// ─────────────────────────────────────────────────────────────────────────────

describe('getGroupMembers — empty / no-match', () => {
  test('Test 1: empty slide (no text_boxes / custom_images / watermark) returns []', () => {
    const slide = makeSlide({})
    expect(getGroupMembers(slide, 'g_x')).toEqual([])
  })

  test('Test 2: slide with no element matching the requested groupId returns []', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', 'g_other'), makeTextBox('tb2')],
      custom_images: [makeCustomImage('ci1', 'g_other')],
      watermark: makeWatermark('w0'),
    })
    expect(getGroupMembers(slide, 'g_missing')).toEqual([])
  })
})

describe('getGroupMembers — single-type membership', () => {
  test('Test 3: 2 text_boxes share groupId; 1 unrelated → returns the 2 ids in text_boxes order', () => {
    const slide = makeSlide({
      text_boxes: [
        makeTextBox('tb1', 'g_abc'),
        makeTextBox('tb2'), // no group
        makeTextBox('tb3', 'g_abc'),
      ],
    })
    expect(getGroupMembers(slide, 'g_abc')).toEqual(['tb1', 'tb3'])
  })
})

describe('getGroupMembers — cross-type union', () => {
  test('Test 4: 1 text_box + 1 custom_image + 1 watermark sharing groupId → 3 ids in [text_boxes..., custom_images..., watermark] order', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', 'g_x'), makeTextBox('tb-other')],
      custom_images: [
        makeCustomImage('ci-other'),
        makeCustomImage('ci1', 'g_x'),
      ],
      watermark: makeWatermark('w0', 'g_x'),
    })
    expect(getGroupMembers(slide, 'g_x')).toEqual(['tb1', 'ci1', 'w0'])
  })
})

describe('getGroupMembers — undefined-field guards', () => {
  test('Test 5: undefined groupId on every element → returns [] (empty / "undefined" / "" must NOT match undefined)', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1'), makeTextBox('tb2')],
      custom_images: [makeCustomImage('ci1')],
      watermark: makeWatermark('w0'),
    })
    // groupId='' → empty string is the no-op short-circuit
    expect(getGroupMembers(slide, '')).toEqual([])
    // groupId='undefined' (literal string) must NOT match undefined fields
    expect(getGroupMembers(slide, 'undefined')).toEqual([])
    // any genuine groupId returns []
    expect(getGroupMembers(slide, 'g_anything')).toEqual([])
  })
})

describe('getGroupMembers — purity invariant', () => {
  // Mirrors selection-bounds.test.ts — pure module: no React, no DOM, no client directives.
  test('Test 6: source file has no react / use client / document / window references', () => {
    const filePath = path.resolve(
      __dirname,
      '../transforms/group-membership.ts',
    )
    const source = fs.readFileSync(filePath, 'utf-8')
    // Strip line comments + block comments (allow JSDoc to mention DOM concepts safely)
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(stripped).not.toMatch(/from\s+['"]react['"]/)
    expect(stripped).not.toMatch(/'use client'/)
    expect(stripped).not.toMatch(/\bdocument\b/)
    expect(stripped).not.toMatch(/\bwindow\b/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 62 (Plan 62-03, GROUP-09): shouldGroupDrag pure helper.
//
// Returns the group member ids to BULK_TRANSLATE on a drag, or null if the
// drag is a single-element drag (the per-element callback path). Tests
// SGD1-SGD6 pin the locked decisions:
//   - inside-group → leaf drag (return null) — currentlyInsideGroup gates this
//   - selection.ids must be the FULL group set (no partial-group fan-out:
//     a subset selection is the user's explicit signal that they want only
//     those elements moved)
//   - dragged element must carry a groupId (otherwise the drag is on an
//     ungrouped element — single-element drag)
//   - selection.ids.length < 2 → null (single-element drag)
//
// Pure helper — no React, no DOM, no I/O. Lives alongside getGroupMembers
// in src/lib/editor/transforms/group-membership.ts.
// ─────────────────────────────────────────────────────────────────────────────

describe('shouldGroupDrag — Phase 62 Plan 62-03 (GROUP-09)', () => {
  type Selection = { ids: string[]; primary: string | null }

  test('Test SGD1: 3 grouped text_boxes, all 3 selected, not inside group → returns the 3 ids', () => {
    const slide = makeSlide({
      text_boxes: [
        makeTextBox('id_1', 'g_x'),
        makeTextBox('id_2', 'g_x'),
        makeTextBox('id_3', 'g_x'),
      ],
    })
    const selection: Selection = {
      ids: ['id_1', 'id_2', 'id_3'],
      primary: 'id_1',
    }
    const result = shouldGroupDrag(slide, selection, null, 'id_1')
    expect(result).not.toBeNull()
    expect(new Set(result!)).toEqual(new Set(['id_1', 'id_2', 'id_3']))
  })

  test('Test SGD2: inside group (currentlyInsideGroup=g_x) → null (leaf drag)', () => {
    const slide = makeSlide({
      text_boxes: [
        makeTextBox('id_1', 'g_x'),
        makeTextBox('id_2', 'g_x'),
        makeTextBox('id_3', 'g_x'),
      ],
    })
    const selection: Selection = {
      ids: ['id_1', 'id_2', 'id_3'],
      primary: 'id_1',
    }
    expect(shouldGroupDrag(slide, selection, 'g_x', 'id_1')).toBeNull()
  })

  test('Test SGD3: selection has only 2 of 3 group members → null (partial-group selection)', () => {
    const slide = makeSlide({
      text_boxes: [
        makeTextBox('id_1', 'g_x'),
        makeTextBox('id_2', 'g_x'),
        makeTextBox('id_3', 'g_x'),
      ],
    })
    const selection: Selection = {
      ids: ['id_1', 'id_2'], // only 2 of 3
      primary: 'id_1',
    }
    expect(shouldGroupDrag(slide, selection, null, 'id_1')).toBeNull()
  })

  test('Test SGD4: selection includes a non-group element alongside group members → null', () => {
    const slide = makeSlide({
      text_boxes: [
        makeTextBox('id_1', 'g_x'),
        makeTextBox('id_2', 'g_x'),
        makeTextBox('unrelated'),
      ],
    })
    const selection: Selection = {
      ids: ['id_1', 'id_2', 'unrelated'],
      primary: 'id_1',
    }
    expect(shouldGroupDrag(slide, selection, null, 'id_1')).toBeNull()
  })

  test('Test SGD5: dragged element has no groupId → null', () => {
    const slide = makeSlide({
      text_boxes: [
        makeTextBox('id_1'), // no groupId
        makeTextBox('id_2', 'g_x'),
      ],
    })
    const selection: Selection = {
      ids: ['id_1', 'id_2'],
      primary: 'id_1',
    }
    expect(shouldGroupDrag(slide, selection, null, 'id_1')).toBeNull()
  })

  test('Test SGD6: selection.ids.length < 2 → null (single-element drag)', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('id_1', 'g_x'), makeTextBox('id_2', 'g_x')],
    })
    const selection: Selection = {
      ids: ['id_1'],
      primary: 'id_1',
    }
    expect(shouldGroupDrag(slide, selection, null, 'id_1')).toBeNull()
  })

  test('Test SGD7 (cross-type): grouped text_box + custom_image + watermark, all 3 selected, dragged is the image → returns all 3 ids', () => {
    const slide = makeSlide({
      text_boxes: [makeTextBox('tb1', 'g_x')],
      custom_images: [makeCustomImage('ci1', 'g_x')],
      watermark: makeWatermark('w0', 'g_x'),
    })
    const selection: Selection = {
      ids: ['tb1', 'ci1', 'w0'],
      primary: 'ci1',
    }
    const result = shouldGroupDrag(slide, selection, null, 'ci1')
    expect(result).not.toBeNull()
    expect(new Set(result!)).toEqual(new Set(['tb1', 'ci1', 'w0']))
  })
})

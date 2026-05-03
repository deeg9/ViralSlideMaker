import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import type { Slide, TextBox, CustomImage, Watermark } from '@/lib/types/slide'
import { getGroupMembers } from '@/lib/editor/transforms/group-membership'

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

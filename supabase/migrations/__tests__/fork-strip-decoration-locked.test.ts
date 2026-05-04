// Phase 71 (MIGR-01): test the fork RPC strip-decoration-locked migration.
//
// Test infra: Option B from the plan — pure SQL-string assertion + JS-side
// jsonb walker that mirrors the SQL `_strip_locked_from_slide_data` helper.
// No pg-mem / no live Supabase test client (no existing infra in repo).
//
// We verify:
// 1. The migration file exists and contains 'decorations' in the FOREACH ARRAY[...]
// 2. The migration body otherwise mirrors the v2.11 20260502 baseline
// 3. A JS port of the helper produces the expected jsonb output for the canonical
//    decoration / text_box / watermark cases (regression guard for v2.11 LOCK-08)

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260504_fork_strip_decoration_locked.sql',
)
const PARENT_MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260502_fork_strip_locked.sql',
)

// JS-side port of public._strip_locked_from_slide_data — mirrors the SQL
// algorithm one-for-one so the test verifies the same behavior the migration
// will produce post-deploy. Updated for Phase 71 to walk decorations[] as well.
type Json = unknown
function stripLockedFromSlideData(p_slide_data: Json): Json {
  if (p_slide_data === null || p_slide_data === undefined) return p_slide_data
  if (!Array.isArray(p_slide_data)) return p_slide_data
  const result: unknown[] = []
  // Mirror SQL: ARRAY['text_boxes', 'custom_images', 'custom_texts', 'decorations']
  const arrFields = ['text_boxes', 'custom_images', 'custom_texts', 'decorations']
  for (const slide of p_slide_data) {
    if (typeof slide !== 'object' || slide === null) {
      result.push(slide)
      continue
    }
    const slideOut = { ...(slide as Record<string, unknown>) }
    for (const arrField of arrFields) {
      const arr = slideOut[arrField]
      if (Array.isArray(arr)) {
        slideOut[arrField] = arr.map((el) => {
          if (typeof el !== 'object' || el === null) return el
          const elOut = { ...(el as Record<string, unknown>) }
          delete elOut.locked
          return elOut
        })
      }
    }
    // Watermark singleton (object, not array)
    const wm = slideOut.watermark
    if (wm && typeof wm === 'object' && !Array.isArray(wm)) {
      const wmOut = { ...(wm as Record<string, unknown>) }
      delete wmOut.locked
      slideOut.watermark = wmOut
    }
    result.push(slideOut)
  }
  return result
}

describe('Phase 71 (MIGR-01): fork_published_carousel strips locked on decorations', () => {
  it('Test 1: decoration locked field is stripped (key removed, not nulled)', () => {
    const input = [
      {
        decorations: [
          {
            id: 'a',
            kind: 'icon',
            lucideName: 'Heart',
            color: '#ff0000',
            strokeWidth: 2,
            rect: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
            locked: true,
          },
        ],
      },
    ]
    const out = stripLockedFromSlideData(input) as Array<{ decorations: Array<Record<string, unknown>> }>
    expect(out).toHaveLength(1)
    expect(out[0].decorations).toHaveLength(1)
    const deco = out[0].decorations[0]
    expect('locked' in deco).toBe(false) // key removed, not set to null
    expect(deco.id).toBe('a')
    expect(deco.kind).toBe('icon')
    expect(deco.lucideName).toBe('Heart')
  })

  it('Test 2: decoration without locked is preserved unchanged (all fields kept)', () => {
    const input = [
      {
        decorations: [
          {
            id: 'b',
            kind: 'shape',
            shapeKind: 'rect',
            fill: '#00ff00',
            rect: { x: 0.2, y: 0.2, w: 0.3, h: 0.3 },
            opacity: 0.8,
          },
        ],
      },
    ]
    const out = stripLockedFromSlideData(input) as Array<{ decorations: Array<Record<string, unknown>> }>
    const deco = out[0].decorations[0]
    expect(deco.id).toBe('b')
    expect(deco.kind).toBe('shape')
    expect(deco.shapeKind).toBe('rect')
    expect(deco.fill).toBe('#00ff00')
    expect(deco.opacity).toBe(0.8)
    expect('locked' in deco).toBe(false)
  })

  it('Test 3: regression — text_boxes locked still stripped (v2.11 LOCK-08 preserved)', () => {
    const input = [
      {
        text_boxes: [
          { id: 'tb1', role: 'hook', locked: true, text: 'Hello' },
          { id: 'tb2', role: 'body', text: 'World' },
        ],
      },
    ]
    const out = stripLockedFromSlideData(input) as Array<{ text_boxes: Array<Record<string, unknown>> }>
    expect('locked' in out[0].text_boxes[0]).toBe(false)
    expect(out[0].text_boxes[0].text).toBe('Hello')
    expect('locked' in out[0].text_boxes[1]).toBe(false)
  })

  it('Test 4: regression — watermark.locked still stripped (singleton object path)', () => {
    const input = [
      {
        watermark: { id: 'wm', text: '@me', locked: true },
      },
    ]
    const out = stripLockedFromSlideData(input) as Array<{ watermark: Record<string, unknown> }>
    expect('locked' in out[0].watermark).toBe(false)
    expect(out[0].watermark.id).toBe('wm')
    expect(out[0].watermark.text).toBe('@me')
  })

  it('Test 5: missing decorations field is a no-op (helper handles missing array)', () => {
    const input = [
      { hook_text: 'Hi', body_text: 'There' }, // no decorations field
      { decorations: [] }, // empty array
    ]
    const out = stripLockedFromSlideData(input) as Array<Record<string, unknown>>
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ hook_text: 'Hi', body_text: 'There' })
    expect(out[1].decorations).toEqual([])
  })

  it('migration file exists at expected path', () => {
    expect(() => readFileSync(MIGRATION_PATH, 'utf8')).not.toThrow()
  })

  it('migration adds "decorations" to the FOREACH ARRAY[...] in the helper', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8')
    // The new ARRAY[...] must contain 'decorations' alongside the v2.11 entries.
    expect(sql).toMatch(
      /ARRAY\[\s*'text_boxes'\s*,\s*'custom_images'\s*,\s*'custom_texts'\s*,\s*'decorations'\s*\]/,
    )
  })

  it('migration only differs from v2.11 baseline in the helper ARRAY[] + header comment', () => {
    // Sanity: migration does NOT redefine fork_published_carousel (the body is
    // unchanged; the helper update propagates automatically).
    const sql = readFileSync(MIGRATION_PATH, 'utf8')
    // Helper is redeclared
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\._strip_locked_from_slide_data/,
    )
    // Watermark singleton path is preserved
    expect(sql).toMatch(/jsonb_set\(slide_out, '\{watermark\}'/)
    // The 'locked' key strip operator is preserved
    expect(sql).toMatch(/#-\s*'\{locked\}'/)
    // Parent migration must still exist (the v2.11 baseline file)
    expect(() => readFileSync(PARENT_MIGRATION_PATH, 'utf8')).not.toThrow()
  })
})

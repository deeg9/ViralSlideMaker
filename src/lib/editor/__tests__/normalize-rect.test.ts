import { describe, test, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { normalizeRect } from '@/lib/editor/transforms/normalize-rect'

/**
 * Phase 61 (SEL-14): normalizeRect pure-helper tests.
 *
 * All four drag directions must collapse to the same canonical
 * {x, y, w, h} with non-negative w and h. PITFALLS Cat-2.3:
 * negative-dimension rects silently break AABB intersection math
 * downstream — centralizing the normalization here is the fix.
 */

describe('normalizeRect — 4 drag directions', () => {
  test('Test 1: top-left → bottom-right drag', () => {
    expect(normalizeRect(10, 20, 110, 220)).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 200,
    })
  })

  test('Test 2: bottom-right → top-left drag', () => {
    expect(normalizeRect(110, 220, 10, 20)).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 200,
    })
  })

  test('Test 3: top-right → bottom-left drag', () => {
    expect(normalizeRect(110, 20, 10, 220)).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 200,
    })
  })

  test('Test 4: bottom-left → top-right drag', () => {
    expect(normalizeRect(10, 220, 110, 20)).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 200,
    })
  })
})

describe('normalizeRect — degenerate cases', () => {
  test('Test 5: zero-area rect (point)', () => {
    expect(normalizeRect(50, 50, 50, 50)).toEqual({ x: 50, y: 50, w: 0, h: 0 })
  })

  test('Test 6: zero-width, non-zero height', () => {
    expect(normalizeRect(50, 10, 50, 100)).toEqual({
      x: 50,
      y: 10,
      w: 0,
      h: 90,
    })
  })

  test('Test 7: negative coords (drag exits canvas bounds)', () => {
    expect(normalizeRect(-10, -20, 50, 60)).toEqual({
      x: -10,
      y: -20,
      w: 60,
      h: 80,
    })
  })
})

describe('normalizeRect — purity invariant', () => {
  test('Test 8: source file imports no React, no DOM, no use-client', () => {
    const filePath = path.resolve(
      process.cwd(),
      'src/lib/editor/transforms/normalize-rect.ts',
    )
    const src = fs.readFileSync(filePath, 'utf8')
    expect(src).not.toMatch(/from ['"]react['"]/)
    expect(src).not.toMatch(/['"]use client['"]/)
    expect(src).not.toMatch(/document\.|window\./)
  })
})

/**
 * PICKER-03 (Phase 70 Plan 02 Task 1): lucide-picker-corpus tests.
 *
 * Pre-built corpus from LUCIDE_DECORATION_ALLOWLIST + ufuzzy index. Pure
 * module — no React, no DOM, no debounce (the 250ms user-facing debounce
 * lives in lucide-picker.tsx).
 */
import { describe, it, expect } from 'vitest'
import {
  LUCIDE_PICKER_CORPUS,
  filterIcons,
  createUfuzzy,
} from '../lucide-picker-corpus'
import { LUCIDE_DECORATION_ALLOWLIST } from '@/lib/render/decorations/registry'

describe('PICKER-03 LUCIDE_PICKER_CORPUS', () => {
  it('Test 1: corpus length === LUCIDE_DECORATION_ALLOWLIST length (118)', () => {
    expect(LUCIDE_PICKER_CORPUS.length).toBe(LUCIDE_DECORATION_ALLOWLIST.length)
    expect(LUCIDE_PICKER_CORPUS.length).toBe(118)
  })

  it('Test 1b: every entry has { lucideName, displayName, searchTokens } and lucideName ∈ allowlist', () => {
    const allow = new Set<string>(LUCIDE_DECORATION_ALLOWLIST as readonly string[])
    for (const entry of LUCIDE_PICKER_CORPUS) {
      expect(typeof entry.lucideName).toBe('string')
      expect(typeof entry.displayName).toBe('string')
      expect(typeof entry.searchTokens).toBe('string')
      expect(allow.has(entry.lucideName)).toBe(true)
    }
  })

  it('Test 2: searchTokens is lowercase and includes both PascalCase + space-separated forms', () => {
    const arrowRight = LUCIDE_PICKER_CORPUS.find((e) => e.lucideName === 'ArrowRight')
    expect(arrowRight).toBeTruthy()
    // tokens are lowercase
    expect(arrowRight!.searchTokens).toBe(arrowRight!.searchTokens.toLowerCase())
    // tokens contain at minimum the icon name in two casings:
    // - "arrowright" (lowercased PascalCase)
    // - "arrow right" (space-separated, lowercased)
    expect(arrowRight!.searchTokens).toContain('arrowright')
    expect(arrowRight!.searchTokens).toContain('arrow right')
  })

  it('Test 2b: displayName is the PascalCase split into space-separated words', () => {
    const arrowRight = LUCIDE_PICKER_CORPUS.find((e) => e.lucideName === 'ArrowRight')
    expect(arrowRight!.displayName).toBe('Arrow Right')
    const heart = LUCIDE_PICKER_CORPUS.find((e) => e.lucideName === 'Heart')
    expect(heart!.displayName).toBe('Heart')
  })

  it('Test 3: filterIcons("heart") returns "Heart" within 50ms', () => {
    const t0 = performance.now()
    const result = filterIcons('heart')
    const elapsed = performance.now() - t0
    expect(result.some((e) => e.lucideName === 'Heart')).toBe(true)
    expect(elapsed).toBeLessThan(50)
  })

  it('Test 4: filterIcons("arrow") returns ALL Arrow* names (multi-match)', () => {
    const result = filterIcons('arrow')
    const names = result.map((e) => e.lucideName)
    // Allowlist contains: ArrowRight, ArrowUp, ArrowDown, ArrowLeft, ArrowUpRight
    const expectedArrowNames = LUCIDE_DECORATION_ALLOWLIST.filter((n) =>
      n.toLowerCase().includes('arrow'),
    )
    for (const expected of expectedArrowNames) {
      expect(names, `expected "${expected}" in result`).toContain(expected)
    }
    // sanity: at least 5 matches (ArrowUp, ArrowDown, ArrowLeft, ArrowUpRight, ArrowRight)
    expect(names.length).toBeGreaterThanOrEqual(5)
  })

  it('Test 5: filterIcons("") returns the FULL corpus (no-op)', () => {
    const result = filterIcons('')
    expect(result.length).toBe(LUCIDE_PICKER_CORPUS.length)
  })

  it('Test 5b: filterIcons("   ") (whitespace only) returns the FULL corpus', () => {
    const result = filterIcons('   ')
    expect(result.length).toBe(LUCIDE_PICKER_CORPUS.length)
  })

  it('Test 6: filterIcons("xyznotreal") returns empty array (no false positives)', () => {
    const result = filterIcons('xyznotreal')
    expect(result.length).toBe(0)
  })

  it('Test 7: filterIcons("hart") fuzzy-matches "Heart" (1 deletion typo tolerance)', () => {
    const result = filterIcons('hart')
    const names = result.map((e) => e.lucideName)
    expect(names).toContain('Heart')
  })

  it('Test 8: corpus build is module-level — re-importing returns the SAME array reference', async () => {
    const { LUCIDE_PICKER_CORPUS: secondImport } = await import('../lucide-picker-corpus')
    expect(secondImport).toBe(LUCIDE_PICKER_CORPUS)
  })

  it('Test 8b: createUfuzzy returns a uFuzzy instance that exposes .search()', () => {
    const fuzzy = createUfuzzy()
    expect(typeof fuzzy.search).toBe('function')
  })
})

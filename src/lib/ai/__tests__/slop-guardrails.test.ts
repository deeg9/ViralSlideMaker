// Phase 54-02 (SLOP-01, SLOP-02, SLOP-04): tests for slop-guardrails.
// These tests intentionally hard-code the locked verbatim substrings from
// CONTEXT.md (D-10, D-12). If the assertions break, do NOT silently update
// the test — bring the change through a new CONTEXT decision first.

import { describe, it, expect } from 'vitest'
import {
  IMAGEN_ADDENDUM,
  AI_HOOK_VARIETY_ADDENDUM,
  PEXELS_NEGATIVE_ALT_TERMS,
  pexelsQueryWithGuardrails,
  filterPexelsResultsByAlt,
} from '../slop-guardrails'

describe('IMAGEN_ADDENDUM (D-10 verbatim)', () => {
  it('contains "Do not generate gradient backgrounds"', () => {
    expect(IMAGEN_ADDENDUM).toContain('Do not generate gradient backgrounds')
  })

  it('contains "documentary-style photographs with naturalistic lighting"', () => {
    expect(IMAGEN_ADDENDUM).toContain(
      'documentary-style photographs with naturalistic lighting',
    )
  })

  it('mentions the three banned gradient color combos', () => {
    expect(IMAGEN_ADDENDUM).toContain('purple-to-blue')
    expect(IMAGEN_ADDENDUM).toContain('sunset orange-to-pink')
    expect(IMAGEN_ADDENDUM).toContain('teal-to-navy')
  })
})

describe('AI_HOOK_VARIETY_ADDENDUM (D-12 verbatim)', () => {
  it('forbids opening clichés', () => {
    expect(AI_HOOK_VARIETY_ADDENDUM).toContain('In a world where')
    expect(AI_HOOK_VARIETY_ADDENDUM).toContain('Did you know')
    expect(AI_HOOK_VARIETY_ADDENDUM).toContain('Imagine if')
  })

  it('mandates hook variety across slides', () => {
    expect(AI_HOOK_VARIETY_ADDENDUM).toContain('Vary hook openings')
  })
})

describe('PEXELS_NEGATIVE_ALT_TERMS', () => {
  it('contains exactly the 7 locked negative terms', () => {
    expect(PEXELS_NEGATIVE_ALT_TERMS.length).toBe(7)
    expect(PEXELS_NEGATIVE_ALT_TERMS).toEqual([
      'meeting',
      'office',
      'team',
      'smiling',
      'diverse group',
      'business meeting',
      'group of people',
    ])
  })
})

describe('pexelsQueryWithGuardrails', () => {
  it('appends positive terms exactly', () => {
    expect(pexelsQueryWithGuardrails('beach sunset')).toBe(
      'beach sunset natural lighting, candid, editorial, portrait',
    )
  })

  it('preserves the user query verbatim before the positive terms', () => {
    const result = pexelsQueryWithGuardrails('moody portrait')
    expect(result.startsWith('moody portrait ')).toBe(true)
  })
})

describe('filterPexelsResultsByAlt', () => {
  it('drops photos with negative alt text', () => {
    const result = filterPexelsResultsByAlt([
      { alt: 'a smiling team' },
      { alt: 'a quiet beach' },
    ])
    expect(result).toEqual([{ alt: 'a quiet beach' }])
  })

  it('falls back to original when filtering would empty the set (D-11)', () => {
    const input = [
      { alt: 'a smiling team' },
      { alt: 'an office meeting' },
    ]
    const result = filterPexelsResultsByAlt(input)
    expect(result).toBe(input)
    expect(result).toHaveLength(2)
  })

  it('matches case-insensitively', () => {
    const input = [{ alt: 'TEAM photo' }]
    const result = filterPexelsResultsByAlt(input)
    // All dropped → fallback returns original (D-11)
    expect(result).toBe(input)
  })

  it('treats null/undefined/missing alt as non-matching', () => {
    const result = filterPexelsResultsByAlt<{ alt?: string | null }>([
      { alt: null },
      { alt: undefined },
      {},
    ])
    expect(result).toHaveLength(3)
  })
})

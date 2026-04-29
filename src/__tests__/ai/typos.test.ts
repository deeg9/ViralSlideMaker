import { describe, it, expect } from 'vitest'
import { KNOWN_TYPOS } from '@/lib/ai/typos'

describe('KNOWN_TYPOS', () => {
  it('is a Set<string> instance', () => {
    expect(KNOWN_TYPOS).toBeInstanceOf(Set)
  })

  // WR-01: NEEDLES and CALENDER removed (real English words → false positives).
  // Count is now 28 entries.
  it('has at least 28 entries', () => {
    expect(KNOWN_TYPOS.size).toBeGreaterThanOrEqual(28)
  })

  it('contains all required uppercase typo entries from CONTEXT.md Area 2 (excl. NEEDLES/CALENDER per WR-01)', () => {
    const required = [
      'MUSICAN',
      'CARROUSEL',
      'ENTREPRENUER',
      'RECIEVE',
      'SEPERATE',
      'OCCURENCE',
      'BUSSINESS',
      'ACCOMODATE',
      // CALENDER removed (WR-01): real word — cloth/paper pressing machine
      'DEFINATELY',
      'EXISTANCE',
      'MAINTENENCE',
      'OCCASIONALY',
      'PRIVILEDGE',
      'RHYTM',
      'SUPRISE',
      'TOMMOROW',
      'UNTILL',
      'WIERD',
      'AGGRESIVE',
      'CONSCIOUSE',
      'DISSAPPOINT',
      'EMBARASS',
      'GAURDIAN',
      'HARRASS',
      'INDEPENDANCE',
      'MILLENIUM',
      'PERSUE',
      'RELEVENT',
      // NEEDLES removed (WR-01): real word — sewing/acupuncture needles
    ]
    for (const entry of required) {
      expect(KNOWN_TYPOS.has(entry)).toBe(true)
    }
  })

  it('does NOT contain NEEDLES or CALENDER (removed per WR-01 false-positive fix)', () => {
    expect(KNOWN_TYPOS.has('NEEDLES')).toBe(false)
    expect(KNOWN_TYPOS.has('CALENDER')).toBe(false)
  })

  it('every entry is an all-uppercase string (callers normalize input via toUpperCase before lookup)', () => {
    for (const entry of KNOWN_TYPOS) {
      expect(typeof entry).toBe('string')
      expect(entry).toBe(entry.toUpperCase())
    }
  })
})

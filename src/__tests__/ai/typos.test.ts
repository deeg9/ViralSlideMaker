import { describe, it, expect } from 'vitest'
import { KNOWN_TYPOS } from '@/lib/ai/typos'

describe('KNOWN_TYPOS', () => {
  it('is a Set<string> instance', () => {
    expect(KNOWN_TYPOS).toBeInstanceOf(Set)
  })

  it('has at least 30 entries', () => {
    expect(KNOWN_TYPOS.size).toBeGreaterThanOrEqual(30)
  })

  it('contains all required uppercase typo entries from CONTEXT.md Area 2', () => {
    const required = [
      'MUSICAN',
      'CARROUSEL',
      'ENTREPRENUER',
      'RECIEVE',
      'SEPERATE',
      'OCCURENCE',
      'BUSSINESS',
      'ACCOMODATE',
      'CALENDER',
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
      'NEEDLES',
    ]
    for (const entry of required) {
      expect(KNOWN_TYPOS.has(entry)).toBe(true)
    }
  })

  it('every entry is an all-uppercase string (callers normalize input via toUpperCase before lookup)', () => {
    for (const entry of KNOWN_TYPOS) {
      expect(typeof entry).toBe('string')
      expect(entry).toBe(entry.toUpperCase())
    }
  })
})

// Phase 58 (AIROLE-01, D-05): test deterministic role distribution.

import { describe, it, expect } from 'vitest'
import { assignSlideRoles, SLIDE_ROLES, type SlideRole } from '../role-distribution'

describe('Phase 58 (AIROLE-01, D-05): assignSlideRoles', () => {
  it('SLIDE_ROLES contains exactly 5 closed-enum values', () => {
    expect(SLIDE_ROLES).toEqual([
      'cover',
      'reframe',
      'support',
      'pivot',
      'close',
    ])
    expect(SLIDE_ROLES).toHaveLength(5)
  })

  it('n=3: [cover, support, close]', () => {
    expect(assignSlideRoles(3)).toEqual(['cover', 'support', 'close'])
  })

  it('n=4: [cover, reframe, support, close]', () => {
    expect(assignSlideRoles(4)).toEqual(['cover', 'reframe', 'support', 'close'])
  })

  it('n=5: [cover, reframe, support, pivot, close]', () => {
    expect(assignSlideRoles(5)).toEqual([
      'cover',
      'reframe',
      'support',
      'pivot',
      'close',
    ])
  })

  it('n=6: [cover, reframe, support, support, pivot, close]', () => {
    expect(assignSlideRoles(6)).toEqual([
      'cover',
      'reframe',
      'support',
      'support',
      'pivot',
      'close',
    ])
  })

  it('n=7: [cover, reframe, support, support, pivot, support, close]', () => {
    expect(assignSlideRoles(7)).toEqual([
      'cover',
      'reframe',
      'support',
      'support',
      'pivot',
      'support',
      'close',
    ])
  })

  it('n=8: 8 roles with cover/close anchors', () => {
    const roles = assignSlideRoles(8)
    expect(roles).toHaveLength(8)
    expect(roles[0]).toBe('cover')
    expect(roles[7]).toBe('close')
  })

  it('n=9: 9 roles with cover/close anchors', () => {
    const roles = assignSlideRoles(9)
    expect(roles).toHaveLength(9)
    expect(roles[0]).toBe('cover')
    expect(roles[8]).toBe('close')
  })

  it('n=10: 10 roles with cover/close anchors', () => {
    const roles = assignSlideRoles(10)
    expect(roles).toHaveLength(10)
    expect(roles[0]).toBe('cover')
    expect(roles[9]).toBe('close')
  })

  it('every length n in [3, 10] starts with cover and ends with close', () => {
    for (let n = 3; n <= 10; n++) {
      const roles = assignSlideRoles(n)
      expect(roles).toHaveLength(n)
      expect(roles[0]).toBe('cover')
      expect(roles[n - 1]).toBe('close')
      // Every value is in the closed enum.
      roles.forEach((r) => {
        expect(SLIDE_ROLES).toContain(r as SlideRole)
      })
    }
  })

  it('defensive: n=1 returns [cover]', () => {
    expect(assignSlideRoles(1)).toEqual(['cover'])
  })

  it('defensive: n=2 returns [cover, close]', () => {
    expect(assignSlideRoles(2)).toEqual(['cover', 'close'])
  })

  it('defensive: n=0 returns []', () => {
    expect(assignSlideRoles(0)).toEqual([])
  })

  it('defensive: n=12 falls back to cover + supports + close', () => {
    const roles = assignSlideRoles(12)
    expect(roles).toHaveLength(12)
    expect(roles[0]).toBe('cover')
    expect(roles[11]).toBe('close')
    // Middle 10 are all 'support'
    for (let i = 1; i < 11; i++) {
      expect(roles[i]).toBe('support')
    }
  })

  it('returned arrays are independent (mutation does not poison the table)', () => {
    const a = assignSlideRoles(5)
    const b = assignSlideRoles(5)
    a[0] = 'close' // mutate
    expect(b[0]).toBe('cover') // unchanged
  })
})

import { describe, it, expect } from 'vitest'
import { templateSlug, withSuffix } from '@/lib/templates/slug'

/**
 * Phase 86 (ADMIN-01) — template-id slug derivation.
 */

describe('templateSlug', () => {
  it('maps a plain name to a dashed lowercase slug', () => {
    expect(templateSlug('Bold News Headline')).toBe('bold-news-headline')
  })

  it('collapses punctuation runs and strips edge dashes', () => {
    const slug = templateSlug('Facts & Figures!! v2')
    expect(slug).toBe('facts-figures-v2')
    expect(slug.startsWith('-')).toBe(false)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug).not.toContain('--')
  })

  it('falls back to "template" for all-symbol or empty input', () => {
    expect(templateSlug('$$$')).toBe('template')
    expect(templateSlug('')).toBe('template')
  })

  it('caps the slug at 60 characters', () => {
    const longName = 'a'.repeat(200)
    expect(templateSlug(longName).length).toBeLessThanOrEqual(60)
  })

  it('is deterministic — same input yields same output', () => {
    expect(templateSlug('My Template')).toBe(templateSlug('My Template'))
  })
})

describe('withSuffix', () => {
  it('appends a 6-char alphanumeric suffix', () => {
    expect(withSuffix('bold-news')).toMatch(/^bold-news-[a-z0-9]{6}$/)
  })

  it('produces a different suffix on each call', () => {
    const a = withSuffix('news')
    const b = withSuffix('news')
    expect(a).not.toBe(b)
  })
})

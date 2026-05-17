// Phase 82 (R1, R2, R3) — category registry structural tests.
// Pure module tests — no network, no live Gemini.

import { describe, it, expect } from 'vitest'
import {
  CATEGORIES,
  CONTENT_CATEGORIES,
  DEFAULT_CATEGORY,
  getCategory,
} from '@/lib/ai/categories'
import { newsCategory } from '@/lib/ai/categories/news'
import { factsCategory } from '@/lib/ai/categories/facts'

describe('Phase 82 R1 — category registry', () => {
  it('CATEGORIES contains exactly the News and Facts modules, both ready', () => {
    expect(CATEGORIES).toHaveLength(2)
    const ids = CATEGORIES.map((c) => c.id).sort()
    expect(ids).toEqual(['facts', 'news'])
    expect(CATEGORIES.every((c) => c.ready === true)).toBe(true)
  })

  it('getCategory resolves news and facts by id', () => {
    expect(getCategory('news')).toBe(newsCategory)
    expect(getCategory('facts')).toBe(factsCategory)
  })

  it('getCategory returns undefined for an unknown id (no silent fallback)', () => {
    expect(getCategory('nonexistent-category')).toBeUndefined()
  })

  it('every module declares a non-empty templateIds list with a string default', () => {
    for (const cat of CATEGORIES) {
      expect(cat.templateIds.length).toBeGreaterThan(0)
      expect(typeof cat.templateIds[0]).toBe('string')
      expect(cat.templateIds[0].length).toBeGreaterThan(0)
    }
  })

  it('CONTENT_CATEGORIES is [news, facts] and DEFAULT_CATEGORY is news', () => {
    expect([...CONTENT_CATEGORIES]).toEqual(['news', 'facts'])
    expect(DEFAULT_CATEGORY).toBe('news')
  })
})

describe('Phase 82 R2 — News prompt module', () => {
  it('buildPrompt returns a non-empty headline-first prompt that omits body text', () => {
    const prompt = newsCategory.buildPrompt()
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt.toLowerCase()).toContain('headline')
    expect(prompt.toLowerCase()).toContain('omit body text')
  })
})

describe('Phase 82 R3 — Facts prompt module', () => {
  it('buildPrompt returns a non-empty prompt mentioning fact and headline', () => {
    const prompt = factsCategory.buildPrompt()
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt.toLowerCase()).toContain('fact')
    expect(prompt.toLowerCase()).toContain('headline')
  })
})

// Phase 82 (R1) — category-routing tests.
// Proves the copy module is category-driven, not template-driven, and that
// the legacy template-based prompt path still works for category-absent callers.
// Pure prompt-assembly tests — no network, no live Gemini.

import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '@/lib/ai/prompts'

describe('Phase 82 R1 — buildSystemPrompt is category-driven', () => {
  it('category="news" with a non-news template still yields the News copy module', () => {
    // paper-essay is NOT a news template — the News prompt must appear anyway.
    const prompt = buildSystemPrompt('paper-essay', 'news')
    expect(prompt).toContain('CONTENT CATEGORY: NEWS')
    expect(prompt.toLowerCase()).toContain('omit body text')
  })

  it('category="facts" with the same non-news template yields the Facts copy module', () => {
    const prompt = buildSystemPrompt('paper-essay', 'facts')
    expect(prompt).toContain('CONTENT CATEGORY: FACTS & INFO')
  })

  it('the News-category and Facts-category prompts differ for the same template', () => {
    const news = buildSystemPrompt('paper-essay', 'news')
    const facts = buildSystemPrompt('paper-essay', 'facts')
    expect(news).not.toEqual(facts)
  })

  it('no category → legacy template-based prompt is still produced (non-empty)', () => {
    const prompt = buildSystemPrompt('news-cyan')
    expect(prompt.length).toBeGreaterThan(0)
    // The category block is absent when no category is supplied.
    expect(prompt).not.toContain('CONTENT CATEGORY:')
  })

  it('an unknown category falls back to the legacy prompt without throwing', () => {
    expect(() => buildSystemPrompt('news-cyan', 'invalid-category')).not.toThrow()
    const prompt = buildSystemPrompt('news-cyan', 'invalid-category')
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).not.toContain('CONTENT CATEGORY:')
  })
})

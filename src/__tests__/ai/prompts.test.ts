import { describe, it, expect } from 'vitest'

describe('prompts', () => {
  it('buildSystemPrompt returns string containing all 6 hook patterns', async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')

    const prompt = buildSystemPrompt()

    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(100)

    // All 6 hook patterns must be present
    const hookPatterns = [
      'curiosity gap',
      'pattern interrupt',
      'POV hook',
      'hot take',
      'lists with stakes',
      'before/after',
    ]

    for (const pattern of hookPatterns) {
      expect(prompt.toLowerCase()).toContain(pattern.toLowerCase())
    }
  })
})

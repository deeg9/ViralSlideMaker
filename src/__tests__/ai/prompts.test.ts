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

describe('buildSystemPrompt — legacy backward-compat (Phase 47)', () => {
  it("buildSystemPrompt('news-drop') still contains 'NEWS DROP TEMPLATE (active):'", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('news-drop')
    expect(prompt).toContain('NEWS DROP TEMPLATE (active):')
  })

  it("buildSystemPrompt('news-drop') does NOT contain 'TEMPLATE VOICE NOTE:'", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('news-drop')
    expect(prompt).not.toContain('TEMPLATE VOICE NOTE:')
  })

  it("buildSystemPrompt('news-drop') does NOT contain 'PREMIUM TEMPLATE TIER'", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('news-drop')
    expect(prompt).not.toContain('PREMIUM TEMPLATE TIER')
  })

  it("buildSystemPrompt('news-cyan') still contains 'NEWS DROP TEMPLATE'", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('news-cyan')
    expect(prompt).toContain('NEWS DROP TEMPLATE')
  })
})

describe('buildSystemPrompt — premium tier (Phase 47)', () => {
  it("buildSystemPrompt('magazine-bold') contains 'TEMPLATE VOICE NOTE:' header", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    expect(prompt).toContain('TEMPLATE VOICE NOTE:')
  })

  it("buildSystemPrompt('magazine-bold') contains the verbatim magazine-bold voice note", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    expect(prompt).toContain('Write in punchy news-style: tabloid-pitched headlines')
  })

  it("buildSystemPrompt('magazine-bold') contains 'PREMIUM TEMPLATE TIER' header", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    expect(prompt).toContain('PREMIUM TEMPLATE TIER')
  })

  it("buildSystemPrompt('magazine-bold') contains '12 words' (hook cap) and '35 words' (body cap)", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    expect(prompt).toContain('12 words')
    expect(prompt).toContain('35 words')
  })

  it("buildSystemPrompt('magazine-bold') contains the literal hex '#A8E0B0' from getTemplate('magazine-bold').accentColor", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    expect(prompt).toContain('#A8E0B0')
  })

  it("buildSystemPrompt('magazine-bold') contains 'highlightColor' AND 'highlightStyle'", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    expect(prompt).toContain('highlightColor')
    expect(prompt).toContain('highlightStyle')
  })

  it("buildSystemPrompt('magazine-bold') contains \"'pill'\" (the only allowed highlightStyle value)", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    expect(prompt).toContain("'pill'")
  })

  it("buildSystemPrompt('magazine-bold') mentions 2-pills-per-hook cap (substring '2' near 'highlight' or 'pill')", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    // The premium addendum says "1-2 segments per hook" — this is the 2-pills cap
    expect(prompt).toMatch(/1-2 segments per hook|2 segments per hook|2 pills/i)
  })

  it("buildSystemPrompt('tr3nding-news') contains the verbatim tr3nding-news voice note", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('tr3nding-news')
    expect(prompt).toContain('Write in viral-news pitch: shocking specifics')
  })

  it("buildSystemPrompt('tr3nding-news') contains '#A8E0B0' (same accent as magazine-bold)", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('tr3nding-news')
    expect(prompt).toContain('#A8E0B0')
  })

  it("buildSystemPrompt('documentary') contains the verbatim documentary voice note", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('documentary')
    expect(prompt).toContain('Write in story-led documentary tone: subject-driven')
  })

  it("buildSystemPrompt('documentary') contains explicit 'do NOT populate' instruction near 'highlightColor'", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('documentary')
    expect(prompt).toContain('do NOT populate')
    expect(prompt).toContain('highlightColor')
  })

  it("buildSystemPrompt('documentary') does NOT contain '#A8E0B0' (documentary accent is white)", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('documentary')
    expect(prompt).not.toContain('#A8E0B0')
  })

  it("buildSystemPrompt('magazine-bold') does NOT contain 'NEWS DROP TEMPLATE' (premium templates skip news-drop addendum)", async () => {
    const { buildSystemPrompt } = await import('@/lib/ai/prompts')
    const prompt = buildSystemPrompt('magazine-bold')
    expect(prompt).not.toContain('NEWS DROP TEMPLATE')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Google GenAI SDK with per-test control via mockGenerateContent.
const mockGenerateContent = vi.fn()

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = { generateContent: mockGenerateContent }
    constructor() {}
  }

  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
      ARRAY: 'ARRAY',
      OBJECT: 'OBJECT',
    },
  }
})

// Mock pexels (existing tests rely on this)
vi.mock('pexels', () => {
  const mockSearch = vi.fn().mockResolvedValue({
    photos: [
      {
        id: 12345,
        src: { portrait: 'https://example.com/photo.jpg' },
      },
    ],
    total_results: 1,
  })

  return {
    createClient: vi.fn().mockReturnValue({
      photos: {
        search: mockSearch,
      },
    }),
    __mockSearch: mockSearch,
  }
})

function geminiResponse(payload: unknown) {
  return { text: JSON.stringify(payload) }
}

// Minimal valid carousel for premium-tier (magazine-bold) — clean, no warnings.
const cleanPremiumCarousel = {
  title: 'AI Startup',
  slides: [
    {
      hook_text: 'STARTUP RAISES BIG ROUND',
      body_text: 'Seed deal closes after a brisk run of investor calls and quiet diligence cycles.',
      image_query: 'startup office portrait',
      is_cta: false,
    },
    {
      hook_text: 'INVESTORS PILE IN',
      body_text: 'Limited partners agreed terms within hours of receiving the first deck and demo.',
      image_query: 'venture capital portrait',
      is_cta: false,
    },
    {
      hook_text: 'FOLLOW FOR MORE',
      body_text: 'Tap follow if you want the next breakdown the moment it ships from our desk.',
      image_query: 'social media portrait',
      is_cta: true,
    },
  ],
}

// Carousel that overflows the magazine-bold hook cap (13 words) to trigger retry.
const overflowingCarousel = {
  title: 'AI Startup',
  slides: [
    {
      hook_text:
        'one two three four five six seven eight nine ten eleven twelve thirteen',
      body_text: 'Short body that does not overlap with the hook content here at all.',
      image_query: 'startup office portrait',
      is_cta: false,
    },
    {
      hook_text: 'INVESTORS PILE IN',
      body_text: 'Limited partners agreed terms within hours of receiving the first deck and demo.',
      image_query: 'venture capital portrait',
      is_cta: false,
    },
    {
      hook_text: 'FOLLOW FOR MORE',
      body_text: 'Tap follow if you want the next breakdown the moment it ships from our desk.',
      image_query: 'social media portrait',
      is_cta: true,
    },
  ],
}

// Carousel with a typo in body_text.
const typoCarousel = {
  title: 'Folk Singer',
  slides: [
    {
      hook_text: 'FOLK SINGER FIGHTS BACK',
      body_text: 'A talented MUSICAN sues over an AI clone of her singing voice and likeness.',
      image_query: 'folk singer portrait',
      is_cta: false,
    },
    {
      hook_text: 'COURT BATTLE LOOMS',
      body_text: 'Lawyers file a sweeping copyright complaint demanding fast injunctive relief.',
      image_query: 'courthouse portrait',
      is_cta: false,
    },
    {
      hook_text: 'FOLLOW FOR MORE',
      body_text: 'Tap follow for the verdict the second the judge hands down a ruling.',
      image_query: 'gavel portrait',
      is_cta: true,
    },
  ],
}

// Legacy (news-drop) carousel with a 20-word hook — premium-tier rules do not apply.
const legacyLongHookCarousel = {
  title: 'Test Topic',
  slides: [
    {
      hook_text:
        'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty',
      body_text: 'Short body that does not overlap with the hook content here at all.',
      image_query: 'news event portrait',
      is_cta: false,
    },
    {
      hook_text: 'KEY DEVELOPMENT',
      body_text: 'Reporters describe a new turn in the unfolding investigation overnight today.',
      image_query: 'breaking news portrait',
      is_cta: false,
    },
    {
      hook_text: 'FOLLOW FOR MORE',
      body_text: 'Tap follow to track every update as the story develops over the coming weeks.',
      image_query: 'social media portrait',
      is_cta: true,
    },
  ],
}

// Documentary carousel with highlightColor on a segment — should be silently
// stripped by validateAndRepair, NOT trigger a retry.
const documentaryWithHighlightCarousel = {
  title: 'Murano',
  slides: [
    {
      hook_text: 'The Last Glassblower of Murano',
      body_text:
        'How four centuries of craft survive in a digital age dominated by automation.',
      image_query: 'glassblower portrait',
      is_cta: false,
      hook_segments: [
        { text: 'The Last', accent: false },
        {
          text: 'Glassblower',
          accent: true,
          highlightColor: '#A8E0B0',
          highlightStyle: 'pill',
        },
        { text: 'of Murano', accent: false },
      ],
    },
    {
      hook_text: 'A Quiet Workshop',
      body_text: 'Inside the studio where embers still glow and tradition outlasts the trend cycle.',
      image_query: 'workshop portrait',
      is_cta: false,
    },
    {
      hook_text: 'Watch the Full Story',
      body_text: 'Tap follow for the documentary cut in full when it premieres next month.',
      image_query: 'documentary portrait',
      is_cta: true,
    },
  ],
}

describe('generateSlideContent — Phase 47 retry-once flow', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
    vi.resetModules()
  })

  it('clean premium-template response → Gemini called exactly ONCE', async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiResponse(cleanPremiumCarousel))

    const { generateSlideContent } = await import('@/lib/ai/generate-slides')
    const result = await generateSlideContent('AI startup', 3, undefined, 'magazine-bold')

    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(result.title).toBe('AI Startup')
  })

  it('magazine-bold response with 13-word hook → Gemini called TWICE; second response used', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(geminiResponse(overflowingCarousel))
      .mockResolvedValueOnce(geminiResponse(cleanPremiumCarousel))

    const { generateSlideContent } = await import('@/lib/ai/generate-slides')
    const result = await generateSlideContent('AI startup', 3, undefined, 'magazine-bold')

    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    // Second response is the clean one
    expect(result.slides[0].hook_text).toBe('STARTUP RAISES BIG ROUND')
  })

  it("response containing 'MUSICAN' typo → Gemini called TWICE; second response used", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(geminiResponse(typoCarousel))
      .mockResolvedValueOnce(geminiResponse(cleanPremiumCarousel))

    const { generateSlideContent } = await import('@/lib/ai/generate-slides')
    // Use legacy template — typo gate applies to ALL templates per D-02
    const result = await generateSlideContent('folk singer', 3, undefined, 'highlight-bar')

    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    expect(result.slides[0].hook_text).toBe('STARTUP RAISES BIG ROUND')
  })

  it('BOTH calls return overflow → Gemini called TWICE only (cap); console.warn fires; result still persisted', async () => {
    mockGenerateContent
      .mockResolvedValueOnce(geminiResponse(overflowingCarousel))
      .mockResolvedValueOnce(geminiResponse(overflowingCarousel))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { generateSlideContent } = await import('@/lib/ai/generate-slides')
    const result = await generateSlideContent('AI startup', 3, undefined, 'magazine-bold')

    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenCalled()
    // Result still parses (CarouselSchema accepts long hook strings — caps are validator-only)
    expect(result.title).toBe('AI Startup')

    warnSpy.mockRestore()
  })

  it('legacy template (news-drop) with a 20-word hook → Gemini called ONCE (no retry)', async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiResponse(legacyLongHookCarousel))

    const { generateSlideContent } = await import('@/lib/ai/generate-slides')
    const result = await generateSlideContent('news topic', 3, undefined, 'news-drop')

    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    expect(result.slides).toHaveLength(3)
  })

  it('documentary with highlightColor on a segment → strip is silent, no retry triggered', async () => {
    mockGenerateContent.mockResolvedValueOnce(geminiResponse(documentaryWithHighlightCarousel))

    const { generateSlideContent } = await import('@/lib/ai/generate-slides')
    const result = await generateSlideContent('murano', 3, undefined, 'documentary')

    // Strip is silent (no warning), so no retry — exactly 1 call
    expect(mockGenerateContent).toHaveBeenCalledTimes(1)
    // The highlightColor field has been stripped
    expect(result.slides[0].hook_segments?.[1].highlightColor).toBeUndefined()
    expect(result.slides[0].hook_segments?.[1].highlightStyle).toBeUndefined()
  })

  it("retry call's contents includes a diagnostic about the prior failure", async () => {
    mockGenerateContent
      .mockResolvedValueOnce(geminiResponse(overflowingCarousel))
      .mockResolvedValueOnce(geminiResponse(cleanPremiumCarousel))

    const { generateSlideContent } = await import('@/lib/ai/generate-slides')
    await generateSlideContent('AI startup', 3, undefined, 'magazine-bold')

    expect(mockGenerateContent).toHaveBeenCalledTimes(2)

    const secondCallArgs = mockGenerateContent.mock.calls[1][0]
    const secondContents: string = secondCallArgs.contents
    // The retry should reference the prior failure
    expect(secondContents).toMatch(/previous response|overflow|13 words|cap|spelling/i)
  })
})

// Preserve existing baseline tests in this file (kept passing).
describe('generateSlideContent — baseline', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset()
    process.env.GEMINI_API_KEY = 'test-key'
    vi.resetModules()
  })

  it('generateSlideContent calls Gemini API with correct model and JSON schema', async () => {
    mockGenerateContent.mockResolvedValueOnce(
      geminiResponse({
        title: 'Test Carousel',
        slides: [
          { hook_text: 'Hook 1', body_text: 'Body 1', image_query: 'nature portrait', is_cta: false },
          { hook_text: 'Hook 2', body_text: 'Body 2', image_query: 'city portrait', is_cta: false },
          { hook_text: 'Hook 3', body_text: 'Body 3', image_query: 'sunset portrait', is_cta: true },
        ],
      })
    )

    const { generateSlideContent } = await import('@/lib/ai/generate-slides')

    const result = await generateSlideContent('test topic')

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash',
        contents: expect.stringContaining('test topic'),
        config: expect.objectContaining({
          systemInstruction: expect.any(String),
          responseMimeType: 'application/json',
          responseSchema: expect.anything(),
        }),
      })
    )

    expect(result).toEqual(
      expect.objectContaining({
        title: 'Test Carousel',
        slides: expect.arrayContaining([
          expect.objectContaining({ hook_text: 'Hook 1' }),
        ]),
      })
    )
  })
})

describe('searchPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PEXELS_API_KEY = 'test-pexels-key'
  })

  it('calls Pexels with orientation=portrait', async () => {
    const pexels = await import('pexels')
    const { searchPhotos } = await import('@/lib/pexels/search-photos')

    await searchPhotos('nature', { orientation: 'portrait', per_page: 1 })

    const client = (pexels.createClient as unknown as ReturnType<typeof vi.fn>).mock.results[0].value
    expect(client.photos.search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'nature',
        orientation: 'portrait',
      })
    )
  })
})

describe('schemas', () => {
  it('CarouselSchema validates correct slide structure', async () => {
    const { CarouselSchema } = await import('@/lib/ai/schemas')

    const validData = {
      title: 'Test',
      slides: [
        { hook_text: 'H1', body_text: 'B1', image_query: 'q1', is_cta: false },
        { hook_text: 'H2', body_text: 'B2', image_query: 'q2', is_cta: false },
        { hook_text: 'H3', body_text: 'B3', image_query: 'q3', is_cta: true },
      ],
    }

    const result = CarouselSchema.parse(validData)
    expect(result.title).toBe('Test')
    expect(result.slides).toHaveLength(3)
    expect(result.slides[0].hook_text).toBe('H1')
    expect(result.slides[0].body_text).toBe('B1')
    expect(result.slides[0].image_query).toBe('q1')
    expect(result.slides[0].is_cta).toBe(false)
  })

  it('CarouselSchema rejects slides array with fewer than 3 items', async () => {
    const { CarouselSchema } = await import('@/lib/ai/schemas')

    const invalidData = {
      title: 'Test',
      slides: [
        { hook_text: 'H1', body_text: 'B1', image_query: 'q1', is_cta: false },
        { hook_text: 'H2', body_text: 'B2', image_query: 'q2', is_cta: true },
      ],
    }

    expect(() => CarouselSchema.parse(invalidData)).toThrow()
  })
})

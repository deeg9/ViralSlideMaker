import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Google GenAI SDK
const mockGenerateContent = vi.fn().mockResolvedValue({
  text: JSON.stringify({
    title: 'Test Carousel',
    slides: [
      { hook_text: 'Hook 1', body_text: 'Body 1', image_query: 'nature portrait', is_cta: false },
      { hook_text: 'Hook 2', body_text: 'Body 2', image_query: 'city portrait', is_cta: false },
      { hook_text: 'Hook 3', body_text: 'Body 3', image_query: 'sunset portrait', is_cta: true },
    ],
  }),
})

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


describe('generate-slides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.GEMINI_API_KEY = 'test-key'
  })

  it('generateSlideContent calls Gemini API with correct model and JSON schema', async () => {
    const { generateSlideContent } = await import('@/lib/ai/generate-slides')

    const result = await generateSlideContent('test topic')

    // Verify generateContent was called with correct parameters
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

    // Verify result is the parsed output
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

// Mock pexels
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

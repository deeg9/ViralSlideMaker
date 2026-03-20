import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Slide } from '@/lib/types/slide'

// Mock GoogleGenAI -- must use class-like mock for constructor
vi.mock('@google/genai', () => {
  const generateContent = vi.fn()
  class MockGoogleGenAI {
    models = { generateContent }
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      ARRAY: 'ARRAY',
      BOOLEAN: 'BOOLEAN',
    },
    __mocks: { generateContent },
  }
})

// Mock searchPhotos
vi.mock('@/lib/pexels/search-photos', () => ({
  searchPhotos: vi.fn(),
}))

// Mock supabase (needed because editor-actions.ts imports it)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    storage: { from: vi.fn() },
  }),
}))

import {
  regenerateSlideText,
  regenerateSlideImageQuery,
} from '@/app/(dashboard)/project/[id]/editor-actions'
import { searchPhotos } from '@/lib/pexels/search-photos'

const mockSearchPhotos = vi.mocked(searchPhotos)

// Access the internal mock
const genaiModule = (await import('@google/genai')) as unknown as {
  __mocks: { generateContent: ReturnType<typeof vi.fn> }
}
const mockGenerateContent = genaiModule.__mocks.generateContent

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    hook_text: 'Test Hook',
    body_text: 'Test Body',
    image_query: 'test query',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
    ...overrides,
  }
}

describe('regenerateSlideText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { hook_text: string, body_text: string }', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        hook_text: 'New hook text',
        body_text: 'New body text',
      }),
    })

    const slide = makeSlide()
    const result = await regenerateSlideText('proj-1', 0, 'fitness tips', slide)

    expect(result).toEqual({
      hook_text: 'New hook text',
      body_text: 'New body text',
    })
    expect(typeof result.hook_text).toBe('string')
    expect(typeof result.body_text).toBe('string')
  })
})

describe('regenerateSlideImageQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { image_query: string, background_url: string, pexels_photo_id: number | null }', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        image_query: 'sunset mountain landscape',
      }),
    })

    mockSearchPhotos.mockResolvedValue([
      {
        id: 999,
        src: {
          original: 'https://pexels.com/photo/999/original.jpg',
        },
        photographer: 'Test',
      } as never,
    ])

    const slide = makeSlide()
    const result = await regenerateSlideImageQuery('wellness', slide)

    expect(result).toHaveProperty('image_query')
    expect(result).toHaveProperty('background_url')
    expect(result).toHaveProperty('pexels_photo_id')
    expect(typeof result.image_query).toBe('string')
    expect(typeof result.background_url).toBe('string')
    expect(result.pexels_photo_id).toBe(999)
  })

  it('returns null pexels_photo_id when no photos found', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        image_query: 'abstract concept visualization',
      }),
    })

    mockSearchPhotos.mockResolvedValue([])

    const slide = makeSlide()
    const result = await regenerateSlideImageQuery('philosophy', slide)

    expect(result.image_query).toBe('abstract concept visualization')
    expect(result.background_url).toBeNull()
    expect(result.pexels_photo_id).toBeNull()
  })
})

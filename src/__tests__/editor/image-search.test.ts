import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the pexels search module
vi.mock('@/lib/pexels/search-photos', () => ({
  searchPhotos: vi.fn(),
}))

// Mock GoogleGenAI (needed because editor-actions.ts imports it)
vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = { generateContent: vi.fn() }
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
  }
})

// Mock supabase (needed because editor-actions.ts imports it)
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    storage: { from: vi.fn() },
  }),
}))

import { searchBackgroundPhotos } from '@/app/(dashboard)/project/[id]/editor-actions'
import { searchPhotos } from '@/lib/pexels/search-photos'

const mockSearchPhotos = vi.mocked(searchPhotos)

describe('searchBackgroundPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns array of { id, url, thumbnail, photographer } from Pexels results', async () => {
    mockSearchPhotos.mockResolvedValue([
      {
        id: 123,
        src: {
          original: 'https://pexels.com/photo/123/original.jpg',
          medium: 'https://pexels.com/photo/123/medium.jpg',
        },
        photographer: 'John Doe',
      } as never,
    ])

    const result = await searchBackgroundPhotos('nature')

    expect(mockSearchPhotos).toHaveBeenCalledWith('nature', {
      orientation: 'portrait',
      per_page: 12,
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 123,
      url: 'https://pexels.com/photo/123/original.jpg',
      thumbnail: 'https://pexels.com/photo/123/medium.jpg',
      photographer: 'John Doe',
    })
  })

  it('returns empty array when query is empty', async () => {
    const result = await searchBackgroundPhotos('')
    expect(result).toEqual([])
    expect(mockSearchPhotos).not.toHaveBeenCalled()
  })

  it('returned photos have correct shape', async () => {
    mockSearchPhotos.mockResolvedValue([
      {
        id: 456,
        src: {
          original: 'https://pexels.com/photo/456/original.jpg',
          medium: 'https://pexels.com/photo/456/medium.jpg',
        },
        photographer: 'Jane Smith',
      } as never,
      {
        id: 789,
        src: {
          original: 'https://pexels.com/photo/789/original.jpg',
          medium: 'https://pexels.com/photo/789/medium.jpg',
        },
        photographer: 'Bob Lee',
      } as never,
    ])

    const result = await searchBackgroundPhotos('mountains')

    for (const photo of result) {
      expect(typeof photo.id).toBe('number')
      expect(typeof photo.url).toBe('string')
      expect(typeof photo.thumbnail).toBe('string')
      expect(typeof photo.photographer).toBe('string')
    }
  })
})

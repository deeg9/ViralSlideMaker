import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @google/genai
vi.mock('@google/genai', () => {
  const mockGenerateContent = vi.fn()
  return {
    GoogleGenAI: class {
      models = { generateContent: mockGenerateContent }
    },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
    },
    __mockGenerateContent: mockGenerateContent,
  }
})

import * as genaiModule from '@google/genai'
import { generateCaptions } from '@/lib/captions/generate-captions'
import type { Slide } from '@/lib/types/slide'

const mockGenerateContent = (genaiModule as Record<string, unknown>).__mockGenerateContent as ReturnType<typeof vi.fn>

const mockSlides: Slide[] = [
  {
    hook_text: 'Did you know this?',
    body_text: 'Most people get it wrong',
    image_query: 'surprised person',
    is_cta: false,
    background_url: null,
    pexels_photo_id: null,
  },
  {
    hook_text: 'Follow for more!',
    body_text: 'Link in bio',
    image_query: 'call to action',
    is_cta: true,
    background_url: null,
    pexels_photo_id: null,
  },
]

describe('generateCaptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns object with tiktok, instagram, linkedin string fields', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        tiktok: 'Check this out! #trending #viral',
        instagram: 'Amazing carousel about health tips.\n\n#health #wellness #tips',
        linkedin: 'I recently explored health tips and found some surprising insights.',
      }),
    })

    const result = await generateCaptions(mockSlides, 'health tips')

    expect(result).toHaveProperty('tiktok')
    expect(result).toHaveProperty('instagram')
    expect(result).toHaveProperty('linkedin')
    expect(typeof (result as { tiktok: string }).tiktok).toBe('string')
    expect(typeof (result as { instagram: string }).instagram).toBe('string')
    expect(typeof (result as { linkedin: string }).linkedin).toBe('string')
  })

  it('prompt includes actual slide hook_text and body_text', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        tiktok: 'caption',
        instagram: 'caption',
        linkedin: 'caption',
      }),
    })

    await generateCaptions(mockSlides, 'health tips')

    const calledContents = mockGenerateContent.mock.calls[0][0].contents as string
    expect(calledContents).toContain('Did you know this?')
    expect(calledContents).toContain('Most people get it wrong')
    expect(calledContents).toContain('Follow for more!')
    expect(calledContents).toContain('Link in bio')
  })

  it('handles 0 slides gracefully', async () => {
    const result = await generateCaptions([], 'empty topic')

    expect(result).toHaveProperty('error')
  })

  it('handles parse error gracefully', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'broken json {{{{',
    })

    const result = await generateCaptions(mockSlides, 'health tips')

    expect(result).toHaveProperty('error')
  })
})

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
import { generateImagePrompt } from '@/lib/imagen/generate-prompt'

const mockGenerateContent = (genaiModule as Record<string, unknown>).__mockGenerateContent as ReturnType<typeof vi.fn>

describe('generateImagePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a prompt string from slide content', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ prompt: 'Warm sunset over mountains with golden light' }),
    })

    const result = await generateImagePrompt('healthy eating', 'Did you know?', 'Eat more greens', false)

    expect(result).toBe('Warm sunset over mountains with golden light')
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3-flash-preview',
      })
    )
  })

  it('includes CTA context when slide is_cta is true', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ prompt: 'Bold call to action background' }),
    })

    await generateImagePrompt('fitness', 'Start today!', 'Click the link', true)

    const calledContents = mockGenerateContent.mock.calls[0][0].contents as string
    expect(calledContents).toContain('CTA')
  })

  it('returns fallback on parse error', async () => {
    mockGenerateContent.mockResolvedValue({
      text: 'not valid json at all',
    })

    const result = await generateImagePrompt('travel tips', 'Hook', 'Body', false)

    expect(result).toBe('Professional aesthetic background for travel tips')
  })
})

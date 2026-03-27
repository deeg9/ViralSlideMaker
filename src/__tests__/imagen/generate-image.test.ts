import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @google/genai
vi.mock('@google/genai', () => {
  const mockGenerateImages = vi.fn()
  return {
    GoogleGenAI: class {
      models = { generateImages: mockGenerateImages }
    },
    __mockGenerateImages: mockGenerateImages,
  }
})

// Mock deductCredit
vi.mock('@/lib/credits/check-credits', () => {
  const mockDeductCredit = vi.fn()
  return {
    deductCredit: mockDeductCredit,
    __mockDeductCredit: mockDeductCredit,
  }
})

// Mock createAdminClient
vi.mock('@/lib/supabase/admin', () => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })
  const mockUpload = vi.fn().mockResolvedValue({ error: null })
  const mockGetPublicUrl = vi.fn().mockReturnValue({
    data: { publicUrl: 'https://storage.example.com/test-image.png' },
  })
  return {
    createAdminClient: vi.fn().mockReturnValue({
      from: mockFrom,
      storage: {
        from: vi.fn().mockReturnValue({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
        }),
      },
    }),
    __mockFrom: mockFrom,
    __mockInsert: mockInsert,
    __mockUpload: mockUpload,
  }
})

// Import the mocks via the module namespace
import * as genaiModule from '@google/genai'
import * as creditsModule from '@/lib/credits/check-credits'
import * as adminModule from '@/lib/supabase/admin'
import { generateImagenBackground } from '@/lib/imagen/generate-image'

const mockGenerateImages = (genaiModule as Record<string, unknown>).__mockGenerateImages as ReturnType<typeof vi.fn>
const mockDeductCredit = (creditsModule as Record<string, unknown>).__mockDeductCredit as ReturnType<typeof vi.fn>
const mockFrom = (adminModule as Record<string, unknown>).__mockFrom as ReturnType<typeof vi.fn>
const mockInsert = (adminModule as Record<string, unknown>).__mockInsert as ReturnType<typeof vi.fn>

describe('generateImagenBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default mock behavior after clearAllMocks
    mockInsert.mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: mockInsert })
  })

  it('returns URL on successful generation', async () => {
    mockDeductCredit.mockResolvedValue(true)
    mockGenerateImages.mockResolvedValue({
      generatedImages: [
        {
          image: { imageBytes: Buffer.from('fake-png-data').toString('base64') },
          raiFilteredReason: null,
        },
      ],
    })

    const result = await generateImagenBackground('user-1', 'sunset background', 'proj-1', 0)

    expect(result).toEqual({ url: 'https://storage.example.com/test-image.png' })
    expect(mockDeductCredit).toHaveBeenCalledWith(
      'user-1',
      'imagen_generation',
      expect.stringContaining('sunset background'),
      'proj-1',
      3
    )
    expect(mockGenerateImages).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'imagen-4.0-fast-generate-001',
        config: expect.objectContaining({
          aspectRatio: '9:16',
          includeRaiReason: true,
        }),
      })
    )
  })

  it('returns error when insufficient credits', async () => {
    mockDeductCredit.mockResolvedValue(false)

    const result = await generateImagenBackground('user-1', 'sunset', 'proj-1', 0)

    expect(result).toEqual({ error: 'Insufficient credits (AI images cost 3 credits)' })
    expect(mockGenerateImages).not.toHaveBeenCalled()
  })

  it('refunds credit and returns error on safety filter', async () => {
    mockDeductCredit.mockResolvedValue(true)
    mockGenerateImages.mockResolvedValue({
      generatedImages: [
        {
          image: { imageBytes: null },
          raiFilteredReason: 'Blocked by safety filter',
        },
      ],
    })

    const result = await generateImagenBackground('user-1', 'test prompt', 'proj-1', 0)

    expect(result).toEqual({ error: 'Blocked by safety filter', refunded: true })
    expect(mockFrom).toHaveBeenCalledWith('credit_transactions')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'refund',
        amount: 3,
      })
    )
  })

  it('refunds credit and returns error on API error', async () => {
    mockDeductCredit.mockResolvedValue(true)
    mockGenerateImages.mockRejectedValue(new Error('API timeout'))

    const result = await generateImagenBackground('user-1', 'test', 'proj-1', 0)

    expect(result).toEqual({
      error: 'Image generation failed. Credit refunded.',
      refunded: true,
    })
    expect(mockFrom).toHaveBeenCalledWith('credit_transactions')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'refund',
        amount: 3,
      })
    )
  })

  it('truncates prompts over 350 words', async () => {
    mockDeductCredit.mockResolvedValue(true)
    const longPrompt = Array(400).fill('word').join(' ')
    mockGenerateImages.mockResolvedValue({
      generatedImages: [
        {
          image: { imageBytes: Buffer.from('data').toString('base64') },
          raiFilteredReason: null,
        },
      ],
    })

    await generateImagenBackground('user-1', longPrompt, 'proj-1', 0)

    const calledPrompt = mockGenerateImages.mock.calls[0][0].prompt as string
    const wordCount = calledPrompt.split(/\s+/).length
    expect(wordCount).toBeLessThanOrEqual(350)
  })
})

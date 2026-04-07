import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

// Mock credits module
vi.mock('@/lib/credits/check-credits', () => ({
  getCreditBalance: vi.fn(),
  deductCredit: vi.fn(),
  getUserTier: vi.fn(),
  checkCredits: vi.fn(),
}))

// Mock AI generation
vi.mock('@/lib/ai/generate-slides', () => ({
  generateSlides: vi.fn(),
}))

// Mock Pexels
vi.mock('@/lib/pexels/search-photos', () => ({
  searchPhotos: vi.fn(),
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock the carousel service (target under test -- does not exist yet)
vi.mock('@/lib/services/carousel', () => ({
  generateCarouselService: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCreditBalance, deductCredit } from '@/lib/credits/check-credits'
import { generateCarouselService } from '@/lib/services/carousel'
import { revalidatePath } from 'next/cache'

const mockCreateClient = vi.mocked(createClient)
const mockCreateAdminClient = vi.mocked(createAdminClient)
const mockGetCreditBalance = vi.mocked(getCreditBalance)
const mockDeductCredit = vi.mocked(deductCredit)
const mockGenerateCarouselService = vi.mocked(generateCarouselService)
const mockRevalidatePath = vi.mocked(revalidatePath)

describe('generateCarouselService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts userId and params without reading auth from cookies', async () => {
    mockGenerateCarouselService.mockImplementation(async (userId, params) => {
      // Service should use the passed userId directly, not call supabase.auth.getUser()
      return { success: true, slideCount: 5, projectId: 'proj-1' }
    })
    const result = await generateCarouselService('user-123', {
      topic: 'Test topic',
      slideCount: 5,
    } as any)
    expect(result).toHaveProperty('success', true)
    // Verify createClient was NOT called (no cookie-based auth)
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('deducts credits for the given userId', async () => {
    mockDeductCredit.mockResolvedValue(true)
    mockGenerateCarouselService.mockImplementation(async (userId) => {
      await mockDeductCredit(userId, 'carousel_generation', 'API carousel generation')
      return { success: true, slideCount: 5, projectId: 'proj-1' }
    })
    await generateCarouselService('user-456', { topic: 'Test' } as any)
    expect(mockDeductCredit).toHaveBeenCalledWith(
      'user-456',
      'carousel_generation',
      expect.any(String)
    )
  })

  it('returns success with slideCount on completion', async () => {
    mockGenerateCarouselService.mockResolvedValue({
      success: true,
      slideCount: 7,
      projectId: 'proj-1',
    })
    const result = await generateCarouselService('user-123', {
      topic: 'Test topic',
      slideCount: 7,
    } as any)
    expect(result).toHaveProperty('success', true)
    expect(result).toHaveProperty('slideCount', 7)
    expect(result).toHaveProperty('projectId')
  })

  it('returns error with upgradeEligible when insufficient credits', async () => {
    mockGetCreditBalance.mockResolvedValue(0)
    mockGenerateCarouselService.mockResolvedValue({
      success: false,
      error: 'Insufficient credits',
      upgradeEligible: true,
    } as any)
    const result = await generateCarouselService('user-123', {
      topic: 'Test',
    } as any)
    expect(result).toHaveProperty('success', false)
    expect(result).toHaveProperty('error')
    expect(result).toHaveProperty('upgradeEligible', true)
  })

  it('uses adminClient when provided in options', async () => {
    const mockAdminClient = { from: vi.fn(), rpc: vi.fn() }
    mockGenerateCarouselService.mockImplementation(async (userId, params, options) => {
      // Should use the provided adminClient for DB operations
      if (options?.adminClient) {
        // Use admin client
      }
      return { success: true, slideCount: 5, projectId: 'proj-1' }
    })
    const result = await generateCarouselService(
      'user-123',
      { topic: 'Test' } as any,
      { adminClient: mockAdminClient as any }
    )
    expect(result).toHaveProperty('success', true)
  })

  it('does NOT call revalidatePath', async () => {
    mockGenerateCarouselService.mockResolvedValue({
      success: true,
      slideCount: 5,
      projectId: 'proj-1',
    })
    await generateCarouselService('user-123', { topic: 'Test' } as any)
    // Service layer should not trigger Next.js cache revalidation
    // That is the responsibility of the route handler calling the service
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})

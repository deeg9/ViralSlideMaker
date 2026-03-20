import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import {
  getCreditLimit,
  isValidTier,
  checkCredits,
  type SubscriptionTier,
} from '@/lib/credits/check-credits'

const mockCreateClient = vi.mocked(createClient)

function mockSupabase(tier: string | undefined, projectCount: number) {
  const mockSelect = vi.fn().mockReturnValue({
    neq: vi.fn().mockReturnValue({
      gte: vi.fn().mockResolvedValue({ count: projectCount }),
    }),
  })

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            user_metadata: { subscription_tier: tier },
          },
        },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: mockSelect,
    }),
  } as any)
}

describe('getCreditLimit', () => {
  it('returns 5 for free tier', () => {
    expect(getCreditLimit('free')).toBe(5)
  })

  it('returns 12 for plus tier', () => {
    expect(getCreditLimit('plus')).toBe(12)
  })

  it('returns 30 for pro tier', () => {
    expect(getCreditLimit('pro')).toBe(30)
  })
})

describe('isValidTier', () => {
  it('accepts valid tier names', () => {
    expect(isValidTier('free')).toBe(true)
    expect(isValidTier('plus')).toBe(true)
    expect(isValidTier('pro')).toBe(true)
  })

  it('rejects invalid tier names', () => {
    expect(isValidTier('premium')).toBe(false)
    expect(isValidTier('')).toBe(false)
    expect(isValidTier('business')).toBe(false)
  })
})

describe('checkCredits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows generation when free user has credits remaining', async () => {
    mockSupabase('free', 3)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: true,
      tier: 'free',
      used: 3,
      limit: 5,
      remaining: 2,
    })
  })

  it('blocks generation when free user hits 5 credit limit', async () => {
    mockSupabase('free', 5)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: false,
      tier: 'free',
      used: 5,
      limit: 5,
      remaining: 0,
    })
  })

  it('blocks generation when free user exceeds limit', async () => {
    mockSupabase('free', 7)
    const result = await checkCredits()

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('allows generation when plus user has credits remaining', async () => {
    mockSupabase('plus', 10)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: true,
      tier: 'plus',
      used: 10,
      limit: 12,
      remaining: 2,
    })
  })

  it('blocks generation when plus user hits 12 credit limit', async () => {
    mockSupabase('plus', 12)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: false,
      tier: 'plus',
      used: 12,
      limit: 12,
      remaining: 0,
    })
  })

  it('allows generation when pro user has credits remaining', async () => {
    mockSupabase('pro', 25)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: true,
      tier: 'pro',
      used: 25,
      limit: 30,
      remaining: 5,
    })
  })

  it('blocks generation when pro user hits 30 credit limit', async () => {
    mockSupabase('pro', 30)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: false,
      tier: 'pro',
      used: 30,
      limit: 30,
      remaining: 0,
    })
  })

  it('defaults to free tier when user has no subscription metadata', async () => {
    mockSupabase(undefined, 0)
    const result = await checkCredits()

    expect(result.tier).toBe('free')
    expect(result.limit).toBe(5)
  })

  it('defaults to free tier when subscription_tier is invalid', async () => {
    mockSupabase('enterprise', 0)
    const result = await checkCredits()

    expect(result.tier).toBe('free')
    expect(result.limit).toBe(5)
  })

  it('allows first generation for a brand new user', async () => {
    mockSupabase(undefined, 0)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: true,
      tier: 'free',
      used: 0,
      limit: 5,
      remaining: 5,
    })
  })

  // Edge case: tier upgrade mid-month should grant more credits
  it('grants more credits after upgrading from free to plus mid-month', async () => {
    // User upgraded to plus but already used 5 (was at free limit)
    mockSupabase('plus', 5)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: true,
      tier: 'plus',
      used: 5,
      limit: 12,
      remaining: 7,
    })
  })

  it('grants more credits after upgrading from plus to pro mid-month', async () => {
    // User upgraded to pro but already used 12 (was at plus limit)
    mockSupabase('pro', 12)
    const result = await checkCredits()

    expect(result).toEqual({
      allowed: true,
      tier: 'pro',
      used: 12,
      limit: 30,
      remaining: 18,
    })
  })
})

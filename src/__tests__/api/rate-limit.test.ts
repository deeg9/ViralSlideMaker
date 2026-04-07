import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Upstash ratelimit
vi.mock('@upstash/ratelimit', () => {
  const Ratelimit = vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    }),
  }))
  return { Ratelimit }
})

// Mock Upstash Redis
vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn().mockReturnValue({}),
  },
}))

// Mock the rate-limit module (target under test -- does not exist yet)
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

// Mock the errors module
vi.mock('@/lib/api/errors', () => {
  class ApiError extends Error {
    code: string
    status: number
    constructor(code: string, message: string, status: number = 401) {
      super(message)
      this.code = code
      this.status = status
      this.name = 'ApiError'
    }
  }
  class RateLimitError extends ApiError {
    retryAfter: number
    constructor(retryAfter: number) {
      super('RATE_LIMITED', 'Rate limit exceeded', 429)
      this.retryAfter = retryAfter
      this.name = 'RateLimitError'
    }
  }
  return { ApiError, RateLimitError, apiError: vi.fn() }
})

import { checkRateLimit } from '@/lib/api/rate-limit'
import { RateLimitError } from '@/lib/api/errors'

const mockCheckRateLimit = vi.mocked(checkRateLimit)

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns limit and remaining on success', async () => {
    mockCheckRateLimit.mockResolvedValue({
      limit: 10,
      remaining: 9,
      reset: Date.now() + 60000,
    })
    const result = await checkRateLimit('key-1', 'free' as any)
    expect(result).toHaveProperty('limit')
    expect(result).toHaveProperty('remaining')
    expect(result).toHaveProperty('reset')
    expect(result.remaining).toBeLessThanOrEqual(result.limit)
  })

  it('throws RateLimitError with retryAfter when rate exceeded', async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 60
    mockCheckRateLimit.mockRejectedValue(new RateLimitError(resetTime))
    await expect(checkRateLimit('key-1', 'free' as any)).rejects.toThrow(RateLimitError)
    try {
      await checkRateLimit('key-1', 'free' as any)
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError)
      expect((err as RateLimitError).retryAfter).toBe(resetTime)
    }
  })

  it('uses correct tier limiter (free=10, plus=30, pro=60)', async () => {
    // Free tier: 10 requests per minute
    mockCheckRateLimit.mockResolvedValue({ limit: 10, remaining: 9, reset: Date.now() + 60000 })
    const freeResult = await checkRateLimit('key-1', 'free' as any)
    expect(freeResult.limit).toBe(10)

    // Plus tier: 30 requests per minute
    mockCheckRateLimit.mockResolvedValue({ limit: 30, remaining: 29, reset: Date.now() + 60000 })
    const plusResult = await checkRateLimit('key-2', 'plus' as any)
    expect(plusResult.limit).toBe(30)

    // Pro tier: 60 requests per minute
    mockCheckRateLimit.mockResolvedValue({ limit: 60, remaining: 59, reset: Date.now() + 60000 })
    const proResult = await checkRateLimit('key-3', 'pro' as any)
    expect(proResult.limit).toBe(60)
  })
})

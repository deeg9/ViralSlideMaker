import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @upstash/redis
vi.mock('@upstash/redis', () => {
  class MockRedis {}
  ;(MockRedis as unknown as Record<string, unknown>).fromEnv = vi.fn(() => new MockRedis())
  return { Redis: MockRedis }
})

// Mock @upstash/ratelimit
const mockLimit = vi.fn()
vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = mockLimit
    constructor() {}
  }
  ;(MockRatelimit as unknown as Record<string, unknown>).slidingWindow = vi.fn(() => 'sliding-window-config')
  return { Ratelimit: MockRatelimit }
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns { success, limit, remaining, reset } shape', async () => {
    const mockResult = {
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    }
    mockLimit.mockResolvedValueOnce(mockResult)

    const { checkRateLimit } = await import('@/lib/api/rate-limit')
    const result = await checkRateLimit('key-123')

    expect(result).toEqual(mockResult)
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('limit')
    expect(result).toHaveProperty('remaining')
    expect(result).toHaveProperty('reset')
  })

  it('calls Ratelimit.limit() with the provided keyId', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 58,
      reset: Date.now() + 60000,
    })

    const { checkRateLimit } = await import('@/lib/api/rate-limit')
    await checkRateLimit('my-key-id')

    expect(mockLimit).toHaveBeenCalledWith('my-key-id')
  })

  it('uses lazy initialization (does not throw at import time without env vars)', async () => {
    const mod = await import('@/lib/api/rate-limit')
    expect(mod.checkRateLimit).toBeDefined()
    expect(typeof mod.checkRateLimit).toBe('function')
  })
})

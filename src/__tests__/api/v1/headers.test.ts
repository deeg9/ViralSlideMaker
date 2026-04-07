import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

// Mock credits module
vi.mock('@/lib/credits/check-credits', () => ({
  getCreditBalance: vi.fn().mockResolvedValue(42),
}))

import { buildResponseHeaders, corsOptions } from '@/lib/api/headers'
import { getCreditBalance } from '@/lib/credits/check-credits'

const mockGetCreditBalance = vi.mocked(getCreditBalance)

describe('buildResponseHeaders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCreditBalance.mockResolvedValue(42)
  })

  it('includes x-credits-remaining header with current balance', async () => {
    const headers = await buildResponseHeaders({ userId: 'user-123' })
    expect(headers.get('x-credits-remaining')).toBe('42')
  })

  it('includes x-credits-used header defaulting to 0', async () => {
    const headers = await buildResponseHeaders({ userId: 'user-123' })
    expect(headers.get('x-credits-used')).toBe('0')
  })

  it('includes x-credits-used with provided value', async () => {
    const headers = await buildResponseHeaders({ userId: 'user-123', creditsUsed: 1 })
    expect(headers.get('x-credits-used')).toBe('1')
  })

  it('includes rate limit headers when rateLimit provided', async () => {
    const headers = await buildResponseHeaders({
      userId: 'user-123',
      rateLimit: { limit: 10, remaining: 9, reset: Date.now() + 60000 },
    })
    expect(headers.get('X-RateLimit-Limit')).toBe('10')
    expect(headers.get('X-RateLimit-Remaining')).toBe('9')
  })

  it('includes CORS headers', async () => {
    const headers = await buildResponseHeaders({ userId: 'user-123' })
    expect(headers.get('Access-Control-Allow-Origin')).toBeTruthy()
  })
})

describe('corsOptions', () => {
  it('returns 204 with CORS headers', () => {
    const response = corsOptions()
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

// Mock auth module
vi.mock('@/lib/api/auth', () => ({
  authenticateApiKey: vi.fn(),
}))

// Mock rate limit module
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ limit: 10, remaining: 9, reset: Date.now() + 60000 }),
}))

// Mock credits module
vi.mock('@/lib/credits/check-credits', () => ({
  getCreditBalance: vi.fn().mockResolvedValue(42),
}))

// Mock errors module
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
  return { ApiError, apiError: vi.fn() }
})

import { GET } from '@/app/api/v1/templates/route'
import { authenticateApiKey } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'

const mockAuthenticateApiKey = vi.mocked(authenticateApiKey)

function mockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/templates', {
    headers: { Authorization: 'Bearer vsl_testkey123' },
  })
}

describe('GET /api/v1/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticateApiKey.mockResolvedValue({
      userId: 'user-123',
      keyId: 'key-1',
      tier: 'free',
    })
  })

  it('returns template list with id, name, thumbnail', async () => {
    const req = mockRequest()
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toBeInstanceOf(Array)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data[0]).toHaveProperty('id')
    expect(body.data[0]).toHaveProperty('name')
    expect(body.data[0]).toHaveProperty('thumbnail')
  })

  it('returns 401 without valid auth', async () => {
    mockAuthenticateApiKey.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Missing Authorization header', 401)
    )
    const req = mockRequest()
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('includes credit headers in response', async () => {
    const req = mockRequest()
    const res = await GET(req)
    expect(res.headers.get('x-credits-remaining')).toBeTruthy()
  })
})

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
  deductCredit: vi.fn().mockResolvedValue(true),
}))

// Mock carousel service
vi.mock('@/lib/services/carousel', () => ({
  generateCarouselService: vi.fn().mockResolvedValue({
    slides: [
      {
        hook_text: 'Test hook',
        body_text: 'Test body',
        image_query: 'test',
        is_cta: false,
        background_url: 'https://example.com/img.jpg',
        pexels_photo_id: 123,
      },
    ],
    projectId: 'proj-123',
  }),
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
  return {
    ApiError,
    apiError: vi.fn().mockImplementation((err: unknown) => {
      if (err instanceof ApiError) {
        return new Response(JSON.stringify({ error: { code: err.code, message: err.message } }), {
          status: err.status,
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      }
      return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }), { status: 500 })
    }),
  }
})

import { POST } from '@/app/api/v1/carousel/route'
import { authenticateApiKey } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'
import { generateCarouselService } from '@/lib/services/carousel'

const mockAuthenticateApiKey = vi.mocked(authenticateApiKey)
const mockGenerateCarouselService = vi.mocked(generateCarouselService)

function mockRequest(body: Record<string, unknown> = { topic: 'test carousel' }): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/carousel', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer vsl_testkey123',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/carousel credit headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticateApiKey.mockResolvedValue({
      userId: 'user-123',
      keyId: 'key-1',
      tier: 'free',
    })
  })

  it('includes x-credits-used: 1 on successful generation', async () => {
    const req = mockRequest()
    const res = await POST(req)
    expect(res.headers.get('x-credits-used')).toBe('1')
  })

  it('includes x-credits-remaining on successful generation', async () => {
    const req = mockRequest()
    const res = await POST(req)
    expect(res.headers.get('x-credits-remaining')).toBeTruthy()
  })

  it('includes CORS headers on error responses', async () => {
    mockAuthenticateApiKey.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Invalid API key', 401)
    )
    const req = mockRequest()
    const res = await POST(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy()
  })
})

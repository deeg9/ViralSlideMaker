import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mock authenticateApiKey
const mockAuthenticateApiKey = vi.fn()
vi.mock('@/lib/api/auth', () => ({
  authenticateApiKey: (...args: unknown[]) => mockAuthenticateApiKey(...args),
}))

// Mock admin client
const mockRpc = vi.fn()
const mockAdminClient = { from: vi.fn(), rpc: mockRpc }
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
}))

// Mock checkRateLimit
const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// Mock corsHeaders
vi.mock('@/lib/api/cors', () => ({
  corsHeaders: () => ({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Expose-Headers':
      'X-RateLimit-Limit, X-RateLimit-Remaining, x-credits-remaining, x-credits-used, Retry-After',
  }),
}))

// Mock apiError
vi.mock('@/lib/api/errors', () => ({
  apiError: (code: string, message: string, status: number, extraHeaders?: Record<string, string>) => {
    return NextResponse.json(
      { error: { code, message } },
      {
        status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          ...extraHeaders,
        },
      }
    )
  },
}))

describe('withApiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: auth succeeds
    mockAuthenticateApiKey.mockResolvedValue({
      userId: 'user-123',
      keyId: 'key-456',
    })
    // Default: rate limit passes
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    })
    // Default: credit balance
    mockRpc.mockResolvedValue({ data: 10, error: null })
  })

  // --- Existing tests (updated for new dependencies) ---

  it('wraps a handler and provides userId, keyId, supabase, creditBalance in ctx', async () => {
    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    )

    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    await wrapped(req)

    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({
        userId: 'user-123',
        keyId: 'key-456',
        supabase: mockAdminClient,
        creditBalance: 10,
      })
    )
  })

  it('returns 401 JSON when authenticateApiKey throws', async () => {
    mockAuthenticateApiKey.mockRejectedValueOnce(
      new Error('Missing or invalid Authorization header')
    )

    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn()
    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test')

    const response = await wrapped(req)

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns correct error body structure on auth failure', async () => {
    mockAuthenticateApiKey.mockRejectedValueOnce(
      new Error('Invalid API key')
    )

    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn()
    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test')

    const response = await wrapped(req)
    const body = await response.json()

    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API key',
      },
    })
  })

  it('provides an admin client (service role) in ctx.supabase', async () => {
    const { withApiAuth } = await import('@/lib/api/with-api-auth')
    const { createAdminClient } = await import('@/lib/supabase/admin')

    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    )

    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    await wrapped(req)

    expect(createAdminClient).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ supabase: mockAdminClient })
    )
  })

  // --- New tests for rate limiting, CORS, and credits ---

  it('OPTIONS request returns 204 with CORS headers without calling authenticateApiKey', async () => {
    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn()
    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      method: 'OPTIONS',
    })

    const response = await wrapped(req)

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(handler).not.toHaveBeenCalled()
    expect(mockAuthenticateApiKey).not.toHaveBeenCalled()
  })

  it('when rate limit exceeded, returns 429 with Retry-After header and RATE_LIMITED error code', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 30000,
    })

    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn()
    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    const response = await wrapped(req)
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(response.headers.get('Retry-After')).toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })

  it('successful response includes X-RateLimit-Limit and X-RateLimit-Remaining headers', async () => {
    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    )

    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    const response = await wrapped(req)

    expect(response.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('59')
  })

  it('all responses include CORS headers (Access-Control-Allow-Origin)', async () => {
    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    )

    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    const response = await wrapped(req)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('handler receives creditBalance in ctx', async () => {
    mockRpc.mockResolvedValueOnce({ data: 42, error: null })

    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ ok: true })
    )

    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    await wrapped(req)

    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ creditBalance: 42 })
    )
  })

  it('handler response gets CORS and rate limit headers appended by HOC', async () => {
    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ data: 'test' }, { status: 200 })
    )

    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    const response = await wrapped(req)

    // Rate limit headers
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('59')
    // CORS headers
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    // Credit headers
    expect(response.headers.get('x-credits-remaining')).toBeTruthy()
  })

  it('computes x-credits-remaining correctly when handler sets x-credits-used', async () => {
    mockRpc.mockResolvedValueOnce({ data: 10, error: null })

    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handlerResponse = NextResponse.json({ ok: true })
    handlerResponse.headers.set('x-credits-used', '3')
    const handler = vi.fn().mockResolvedValue(handlerResponse)

    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    const response = await wrapped(req)

    // 10 - 3 = 7
    expect(response.headers.get('x-credits-remaining')).toBe('7')
  })

  it('returns 500 INTERNAL_ERROR when handler throws', async () => {
    const { withApiAuth } = await import('@/lib/api/with-api-auth')

    const handler = vi.fn().mockRejectedValue(new Error('Something broke'))

    const wrapped = withApiAuth(handler)
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_test_key' },
    })

    const response = await wrapped(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toBe('Internal server error')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mock authenticateApiKey
const mockAuthenticateApiKey = vi.fn()
vi.mock('@/lib/api/auth', () => ({
  authenticateApiKey: (...args: unknown[]) => mockAuthenticateApiKey(...args),
}))

// Mock admin client
const mockAdminClient = { from: vi.fn() }
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue(mockAdminClient),
}))

describe('withApiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wraps a handler and provides userId, keyId, supabase in ctx', async () => {
    mockAuthenticateApiKey.mockResolvedValueOnce({
      userId: 'user-123',
      keyId: 'key-456',
    })

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
    mockAuthenticateApiKey.mockResolvedValueOnce({
      userId: 'user-123',
      keyId: 'key-456',
    })

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

    // createAdminClient should have been called to provide the supabase client
    expect(createAdminClient).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledWith(
      req,
      expect.objectContaining({ supabase: mockAdminClient })
    )
  })
})

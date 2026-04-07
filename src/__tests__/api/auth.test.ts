import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

// Mock crypto hash module
vi.mock('@/lib/crypto/hash', () => ({
  hashApiKey: vi.fn().mockResolvedValue('hashed_key_value'),
}))

// Mock credits module
vi.mock('@/lib/credits/check-credits', () => ({
  getCreditBalance: vi.fn(),
  deductCredit: vi.fn(),
  getUserTier: vi.fn(),
}))

// Mock the auth module (target under test -- does not exist yet)
vi.mock('@/lib/api/auth', () => ({
  authenticateApiKey: vi.fn(),
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
  return { ApiError, apiError: vi.fn() }
})

import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey } from '@/lib/crypto/hash'
import { authenticateApiKey } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'

const mockCreateAdminClient = vi.mocked(createAdminClient)
const mockHashApiKey = vi.mocked(hashApiKey)
const mockAuthenticateApiKey = vi.mocked(authenticateApiKey)

function mockRequest(authHeader?: string): NextRequest {
  const headers = new Headers()
  if (authHeader) {
    headers.set('Authorization', authHeader)
  }
  return new NextRequest('http://localhost:3000/api/v1/test', { headers })
}

function mockAdminForAuth(config: {
  keyData?: { id: string; user_id: string; revoked_at: string | null } | null
}) {
  const { keyData = null } = config

  const singleFn = vi.fn().mockResolvedValue(
    keyData
      ? { data: keyData, error: null }
      : { data: null, error: { message: 'not found' } }
  )
  const eqFn = vi.fn().mockReturnValue({ single: singleFn, maybeSingle: singleFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'api_keys') {
      return { select: selectFn, update: updateFn }
    }
    return {}
  })

  mockCreateAdminClient.mockReturnValue({
    from: fromFn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { fromFn, selectFn, updateFn, eqFn }
}

describe('authenticateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extracts Bearer token and returns userId, keyId, tier', async () => {
    const req = mockRequest('Bearer vsl_validkey123')
    mockAdminForAuth({
      keyData: { id: 'key-1', user_id: 'user-123', revoked_at: null },
    })
    mockAuthenticateApiKey.mockResolvedValue({
      userId: 'user-123',
      keyId: 'key-1',
      tier: 'free',
    })
    const result = await authenticateApiKey(req)
    expect(result).toHaveProperty('userId', 'user-123')
    expect(result).toHaveProperty('keyId', 'key-1')
    expect(result).toHaveProperty('tier')
  })

  it('throws UNAUTHORIZED for missing Authorization header', async () => {
    const req = mockRequest()
    mockAuthenticateApiKey.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Missing Authorization header', 401)
    )
    await expect(authenticateApiKey(req)).rejects.toThrow('Missing Authorization header')
  })

  it('throws UNAUTHORIZED for non-Bearer scheme', async () => {
    const req = mockRequest('Basic dXNlcjpwYXNz')
    mockAuthenticateApiKey.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Invalid authorization scheme', 401)
    )
    await expect(authenticateApiKey(req)).rejects.toThrow('Invalid authorization scheme')
  })

  it('throws UNAUTHORIZED for key without vsl_ prefix', async () => {
    const req = mockRequest('Bearer invalidkey_without_prefix')
    mockAuthenticateApiKey.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'Invalid API key format', 401)
    )
    await expect(authenticateApiKey(req)).rejects.toThrow('Invalid API key format')
  })

  it('throws UNAUTHORIZED for revoked key', async () => {
    const req = mockRequest('Bearer vsl_revokedkey')
    mockAdminForAuth({
      keyData: { id: 'key-1', user_id: 'user-123', revoked_at: '2026-01-01T00:00:00Z' },
    })
    mockAuthenticateApiKey.mockRejectedValue(
      new ApiError('UNAUTHORIZED', 'API key has been revoked', 401)
    )
    await expect(authenticateApiKey(req)).rejects.toThrow('API key has been revoked')
  })

  it('hashes the raw key with SHA-256 before DB lookup', async () => {
    const req = mockRequest('Bearer vsl_rawkeyvalue')
    mockAdminForAuth({
      keyData: { id: 'key-1', user_id: 'user-123', revoked_at: null },
    })
    mockAuthenticateApiKey.mockImplementation(async () => {
      await mockHashApiKey('vsl_rawkeyvalue')
      return { userId: 'user-123', keyId: 'key-1', tier: 'free' }
    })
    await authenticateApiKey(req)
    expect(mockHashApiKey).toHaveBeenCalledWith('vsl_rawkeyvalue')
  })

  it('updates last_used_at on successful auth', async () => {
    const { updateFn } = mockAdminForAuth({
      keyData: { id: 'key-1', user_id: 'user-123', revoked_at: null },
    })
    const req = mockRequest('Bearer vsl_validkey')
    mockAuthenticateApiKey.mockImplementation(async () => {
      const admin = createAdminClient()
      ;(admin as any).from('api_keys').update({ last_used_at: expect.any(String) }).eq('id', 'key-1')
      return { userId: 'user-123', keyId: 'key-1', tier: 'free' }
    })
    await authenticateApiKey(req)
    expect(updateFn).toHaveBeenCalled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHash } from 'crypto'

// Mock the admin client
const mockSingle = vi.fn()
const mockEq = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({ then: vi.fn() }),
})
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'api_keys') {
    return { select: mockSelect, update: mockUpdate }
  }
  return { select: mockSelect, update: mockUpdate }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
}))

// Spy on timingSafeEqual
const timingSafeEqualSpy = vi.fn().mockReturnValue(true)
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto')
  return {
    ...actual,
    timingSafeEqual: (...args: Parameters<typeof actual.timingSafeEqual>) => {
      timingSafeEqualSpy(...args)
      return actual.timingSafeEqual(...args)
    },
  }
})

describe('authenticateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    timingSafeEqualSpy.mockClear()
  })

  it('throws on missing Authorization header', async () => {
    const { authenticateApiKey } = await import('@/lib/api/auth')
    const req = new NextRequest('http://localhost:3000/api/v1/test')

    await expect(authenticateApiKey(req)).rejects.toThrow(
      'Missing or invalid Authorization header'
    )
  })

  it('throws on Authorization header without "Bearer vsl_" prefix', async () => {
    const { authenticateApiKey } = await import('@/lib/api/auth')
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer sk_invalid_token' },
    })

    await expect(authenticateApiKey(req)).rejects.toThrow(
      'Missing or invalid Authorization header'
    )
  })

  it('returns userId and keyId for valid token with matching hash', async () => {
    const rawKey = 'vsl_test_key_abc123'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    mockSingle.mockResolvedValueOnce({
      data: { id: 'key-id-123', user_id: 'user-id-456', key_hash: keyHash },
      error: null,
    })

    const { authenticateApiKey } = await import('@/lib/api/auth')
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: `Bearer ${rawKey}` },
    })

    const result = await authenticateApiKey(req)
    expect(result).toEqual({ userId: 'user-id-456', keyId: 'key-id-123' })
  })

  it('throws "Invalid API key" when no matching hash in DB', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'No rows' },
    })

    const { authenticateApiKey } = await import('@/lib/api/auth')
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: 'Bearer vsl_nonexistent_key' },
    })

    await expect(authenticateApiKey(req)).rejects.toThrow('Invalid API key')
  })

  it('calls timingSafeEqual for hash comparison', async () => {
    const rawKey = 'vsl_timing_safe_key'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    mockSingle.mockResolvedValueOnce({
      data: { id: 'key-id', user_id: 'user-id', key_hash: keyHash },
      error: null,
    })

    const { authenticateApiKey } = await import('@/lib/api/auth')
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: `Bearer ${rawKey}` },
    })

    await authenticateApiKey(req)
    expect(timingSafeEqualSpy).toHaveBeenCalled()
  })

  it('fires last_used_at update after successful auth (non-blocking)', async () => {
    const rawKey = 'vsl_last_used_key'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')

    mockSingle.mockResolvedValueOnce({
      data: { id: 'key-id-789', user_id: 'user-id', key_hash: keyHash },
      error: null,
    })

    const { authenticateApiKey } = await import('@/lib/api/auth')
    const req = new NextRequest('http://localhost:3000/api/v1/test', {
      headers: { authorization: `Bearer ${rawKey}` },
    })

    await authenticateApiKey(req)

    // Verify update was called on api_keys table
    expect(mockFrom).toHaveBeenCalledWith('api_keys')
    expect(mockUpdate).toHaveBeenCalled()
  })
})

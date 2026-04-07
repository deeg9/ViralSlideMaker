import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase admin client
const mockMaybeSingle = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ then: vi.fn() })) }))
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn((table: string) => {
  if (table === 'api_keys') {
    return { select: mockSelect, update: mockUpdate }
  }
  return { select: mockSelect }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))

vi.mock('@/lib/crypto/hash', () => ({
  hashApiKey: vi.fn(async (key: string) => `hashed_${key}`),
}))

import { verifyMcpToken } from '@/lib/mcp/auth'

describe('verifyMcpToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns undefined when no bearer token provided', async () => {
    const req = new Request('http://localhost/api/mcp')
    const result = await verifyMcpToken(req, undefined)
    expect(result).toBeUndefined()
  })

  it('returns undefined for non-vsl_ prefixed tokens', async () => {
    const req = new Request('http://localhost/api/mcp')
    const result = await verifyMcpToken(req, 'sk_test_abc123')
    expect(result).toBeUndefined()
  })

  it('returns undefined when key not found in DB', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const req = new Request('http://localhost/api/mcp')
    const result = await verifyMcpToken(req, 'vsl_test_abc123')
    expect(result).toBeUndefined()
  })

  it('returns undefined when key is revoked', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'key-1', user_id: 'user-1', revoked_at: '2025-01-01' },
      error: null,
    })
    const req = new Request('http://localhost/api/mcp')
    const result = await verifyMcpToken(req, 'vsl_test_abc123')
    expect(result).toBeUndefined()
  })

  it('returns AuthInfo for valid non-revoked key', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'key-1', user_id: 'user-1', revoked_at: null },
      error: null,
    })
    const req = new Request('http://localhost/api/mcp')
    const result = await verifyMcpToken(req, 'vsl_test_abc123')
    expect(result).toBeDefined()
    expect(result!.token).toBe('vsl_test_abc123')
    expect(result!.clientId).toBe('user-1')
    expect(result!.extra).toEqual({ userId: 'user-1', keyId: 'key-1' })
  })
})

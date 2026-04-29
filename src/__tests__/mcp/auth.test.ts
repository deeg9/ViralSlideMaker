import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockVerifyApiKeyHash = vi.fn()
class MockInvalidApiKeyError extends Error {
  constructor() {
    super('Invalid API key')
    this.name = 'InvalidApiKeyError'
  }
}
vi.mock('@/lib/api/auth-core', () => ({
  verifyApiKeyHash: mockVerifyApiKeyHash,
  InvalidApiKeyError: MockInvalidApiKeyError,
}))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: mockCheckRateLimit,
}))

describe('MCP verifyToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns undefined when bearerToken is missing', async () => {
    const { verifyToken } = await import('@/lib/mcp/auth')
    const req = new Request('http://localhost/api/mcp')
    expect(await verifyToken(req, undefined)).toBeUndefined()
  })

  it('returns undefined when bearerToken lacks vsl_ prefix', async () => {
    const { verifyToken } = await import('@/lib/mcp/auth')
    const req = new Request('http://localhost/api/mcp')
    expect(await verifyToken(req, 'sk_other')).toBeUndefined()
  })

  it('returns undefined when verifyApiKeyHash throws InvalidApiKeyError', async () => {
    mockVerifyApiKeyHash.mockRejectedValueOnce(new MockInvalidApiKeyError())
    const { verifyToken } = await import('@/lib/mcp/auth')
    const req = new Request('http://localhost/api/mcp')
    expect(await verifyToken(req, 'vsl_bad_key')).toBeUndefined()
  })

  it('returns AuthInfo with extra.userId/keyId on valid key + rate-limit pass', async () => {
    mockVerifyApiKeyHash.mockResolvedValueOnce({ userId: 'u1', keyId: 'k1' })
    mockCheckRateLimit.mockResolvedValueOnce({ success: true, limit: 60, remaining: 59, reset: Date.now() + 60000 })
    const { verifyToken } = await import('@/lib/mcp/auth')
    const req = new Request('http://localhost/api/mcp')
    const result = await verifyToken(req, 'vsl_good_key')
    expect(result).toMatchObject({
      token: 'vsl_good_key',
      clientId: 'k1',
      scopes: [],
      extra: { userId: 'u1', keyId: 'k1' },
    })
  })
})

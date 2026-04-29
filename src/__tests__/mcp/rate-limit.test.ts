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

describe('MCP rate-limit integration via verifyToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws TemporarilyUnavailableError when checkRateLimit returns success:false', async () => {
    mockVerifyApiKeyHash.mockResolvedValueOnce({ userId: 'u1', keyId: 'k1' })
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, limit: 60, remaining: 0, reset: Date.now() + 60000 })

    const { verifyToken } = await import('@/lib/mcp/auth')
    const { TemporarilyUnavailableError } = await import('@modelcontextprotocol/sdk/server/auth/errors.js')

    const req = new Request('http://localhost/api/mcp')
    await expect(verifyToken(req, 'vsl_exhausted_key')).rejects.toBeInstanceOf(TemporarilyUnavailableError)
  })

  it('passes through verification when checkRateLimit returns success:true', async () => {
    mockVerifyApiKeyHash.mockResolvedValueOnce({ userId: 'u1', keyId: 'k1' })
    mockCheckRateLimit.mockResolvedValueOnce({ success: true, limit: 60, remaining: 30, reset: Date.now() + 60000 })

    const { verifyToken } = await import('@/lib/mcp/auth')
    const req = new Request('http://localhost/api/mcp')
    const result = await verifyToken(req, 'vsl_ok_key')
    expect(result).toBeDefined()
    expect(mockCheckRateLimit).toHaveBeenCalledWith('k1')
  })
})

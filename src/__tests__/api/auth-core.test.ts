import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

const mockSingle = vi.fn()
const mockEqSelect = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockEqSelect })
const mockEqUpdate = vi.fn().mockReturnValue({ then: vi.fn((cb) => cb?.()) })
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpdate })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, update: mockUpdate })

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
}))

describe('verifyApiKeyHash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEqSelect.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEqSelect })
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate })
  })

  it('throws InvalidApiKeyError when rawKey lacks vsl_ prefix', async () => {
    const { verifyApiKeyHash, InvalidApiKeyError } = await import('@/lib/api/auth-core')
    await expect(verifyApiKeyHash('sk_other_xyz')).rejects.toBeInstanceOf(InvalidApiKeyError)
  })

  it('throws InvalidApiKeyError when no api_keys row matches', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'no row' } })
    const { verifyApiKeyHash, InvalidApiKeyError } = await import('@/lib/api/auth-core')
    await expect(verifyApiKeyHash('vsl_nope_abc')).rejects.toBeInstanceOf(InvalidApiKeyError)
  })

  it('returns { userId, keyId } and fires last_used_at update on valid key', async () => {
    const rawKey = 'vsl_test_abc'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    mockSingle.mockResolvedValueOnce({
      data: { id: 'k1', user_id: 'u1', key_hash: keyHash },
      error: null,
    })
    const { verifyApiKeyHash } = await import('@/lib/api/auth-core')
    const result = await verifyApiKeyHash(rawKey)
    expect(result).toEqual({ userId: 'u1', keyId: 'k1' })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_used_at: expect.any(String) })
    )
  })
})

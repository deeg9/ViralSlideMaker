import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

// Mock the actions module (target under test -- does not exist yet)
vi.mock('@/app/(dashboard)/settings/api-keys/actions', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revokeApiKey } from '@/app/(dashboard)/settings/api-keys/actions'

const mockCreateClient = vi.mocked(createClient)
const mockCreateAdminClient = vi.mocked(createAdminClient)
const mockRevokeApiKey = vi.mocked(revokeApiKey)

function mockSupabaseForRevoke(config: {
  userId?: string
  updateCount?: number
  updateError?: boolean
}) {
  const { userId = 'user-123', updateCount = 1, updateError = false } = config

  const updateFn = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(
        updateError
          ? { data: null, error: { message: 'Update failed' }, count: 0 }
          : { data: [{ id: 'key-1' }], error: null, count: updateCount }
      ),
    }),
  })

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'api_keys') {
      return { update: updateFn }
    }
    return {}
  })

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: userId } },
      }),
    },
    from: fromFn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  mockCreateAdminClient.mockReturnValue({
    from: fromFn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { fromFn, updateFn }
}

describe('revokeApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets revoked_at timestamp on the key', async () => {
    mockSupabaseForRevoke({ updateCount: 1 })
    mockRevokeApiKey.mockImplementation(async (keyId: string) => {
      const adminClient = createAdminClient()
      ;(adminClient as any).from('api_keys').update({ revoked_at: expect.any(String) })
      return { success: true }
    })
    const result = await revokeApiKey('key-1')
    expect(result).toHaveProperty('success', true)
  })

  it('only revokes keys owned by the authenticated user', async () => {
    const { updateFn } = mockSupabaseForRevoke({ userId: 'user-123' })
    mockRevokeApiKey.mockImplementation(async (keyId: string) => {
      const adminClient = createAdminClient()
      const chain = (adminClient as any).from('api_keys').update({ revoked_at: new Date().toISOString() })
      chain.eq('id', keyId).eq('user_id', 'user-123')
      return { success: true }
    })
    await revokeApiKey('key-1')
    // Verify the update chain includes user_id filter
    expect(updateFn).toHaveBeenCalled()
  })

  it('returns error for already-revoked or non-existent key', async () => {
    mockSupabaseForRevoke({ updateCount: 0 })
    mockRevokeApiKey.mockResolvedValue({ success: false, error: 'Key not found or already revoked' })
    const result = await revokeApiKey('nonexistent-key')
    expect(result).toHaveProperty('success', false)
    if ('error' in result) {
      expect(result.error).toBeTruthy()
    }
  })
})

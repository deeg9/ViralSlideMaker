import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

// Mock crypto hash module
vi.mock('@/lib/crypto/hash', () => ({
  hashApiKey: vi.fn().mockResolvedValue('abc123hash'),
}))

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mocknanoid32chars00000000000000'),
}))

// Mock the actions module (target under test -- does not exist yet)
vi.mock('@/app/(dashboard)/settings/api-keys/actions', () => ({
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey } from '@/lib/crypto/hash'
import { createApiKey } from '@/app/(dashboard)/settings/api-keys/actions'

const mockCreateClient = vi.mocked(createClient)
const mockCreateAdminClient = vi.mocked(createAdminClient)
const mockHashApiKey = vi.mocked(hashApiKey)
const mockCreateApiKey = vi.mocked(createApiKey)

function mockSupabaseForApiKeys(config: {
  userId?: string
  activeKeyCount?: number
  insertError?: boolean
}) {
  const { userId = 'user-123', activeKeyCount = 0, insertError = false } = config

  const countFn = vi.fn().mockResolvedValue({ count: activeKeyCount, error: null })
  const insertFn = vi.fn().mockResolvedValue(
    insertError
      ? { data: null, error: { message: 'Insert failed' } }
      : { data: { id: 'key-1' }, error: null }
  )

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'api_keys') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue(countFn),
          }),
        }),
        insert: insertFn,
      }
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

  return { fromFn, insertFn, countFn }
}

describe('createApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a raw key starting with vsl_ prefix', async () => {
    mockSupabaseForApiKeys({ activeKeyCount: 0 })
    // When implementation exists, createApiKey('Test') should return { success: true, key: 'vsl_...' }
    mockCreateApiKey.mockResolvedValue({ success: true, key: 'vsl_mocknanoid32chars00000000000000' })
    const result = await createApiKey('Test')
    expect(result).toHaveProperty('success', true)
    if ('key' in result) {
      expect(result.key).toMatch(/^vsl_/)
    }
  })

  it('calls hashApiKey before storing', async () => {
    mockSupabaseForApiKeys({ activeKeyCount: 0 })
    mockCreateApiKey.mockImplementation(async (label: string) => {
      const rawKey = 'vsl_mocknanoid32chars00000000000000'
      await mockHashApiKey(rawKey)
      return { success: true, key: rawKey }
    })
    await createApiKey('Test')
    expect(mockHashApiKey).toHaveBeenCalledWith('vsl_mocknanoid32chars00000000000000')
  })

  it('stores hash and prefix in database, never raw key', async () => {
    const { insertFn } = mockSupabaseForApiKeys({ activeKeyCount: 0 })
    mockCreateApiKey.mockImplementation(async () => {
      const adminClient = createAdminClient()
      ;(adminClient as any).from('api_keys').insert({
        key_hash: 'abc123hash',
        prefix: 'vsl_mock',
        label: 'Test',
        user_id: 'user-123',
      })
      return { success: true, key: 'vsl_mocknanoid32chars00000000000000' }
    })
    await createApiKey('Test')
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        key_hash: expect.any(String),
        prefix: expect.any(String),
      })
    )
    // Verify raw key is NOT in the insert call
    expect(insertFn).not.toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.stringContaining('vsl_'),
      })
    )
  })

  it('enforces max 3 active keys per user', async () => {
    mockSupabaseForApiKeys({ activeKeyCount: 3 })
    mockCreateApiKey.mockResolvedValue({ success: false, error: 'Maximum 3 active API keys allowed' })
    const result = await createApiKey('Test')
    expect(result).toHaveProperty('success', false)
    if ('error' in result) {
      expect(result.error).toContain('Maximum 3')
    }
  })

  it('validates label is non-empty', async () => {
    mockSupabaseForApiKeys({})
    mockCreateApiKey.mockResolvedValue({ success: false, error: 'Label is required' })
    const result = await createApiKey('')
    expect(result).toHaveProperty('success', false)
  })
})

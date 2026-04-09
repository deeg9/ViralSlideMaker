import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

// Mock supabase/server
const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockOrder = vi.fn()
const mockEqChain = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Fake user
const fakeUser = { id: 'user-123', email: 'test@example.com' }

describe('createApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } })
  })

  it('returns rawKey starting with "vsl_" and 36+ chars total', async () => {
    // Mock count check (0 existing keys)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'api_keys') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0 }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      return {}
    })

    const { createApiKey } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    const result = await createApiKey('Test Key')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.rawKey).toMatch(/^vsl_/)
      expect(result.rawKey.length).toBeGreaterThanOrEqual(36)
    }
  })

  it('returned rawKey hashes to the key_hash stored in DB (SHA-256)', async () => {
    let insertedRow: Record<string, unknown> | null = null

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0 }),
      }),
      insert: vi.fn().mockImplementation((row: Record<string, unknown>) => {
        insertedRow = row
        return Promise.resolve({ error: null })
      }),
    }))

    const { createApiKey } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    const result = await createApiKey('Hash Test')

    expect(result.success).toBe(true)
    if (result.success) {
      const expectedHash = createHash('sha256')
        .update(result.rawKey)
        .digest('hex')
      expect(insertedRow).not.toBeNull()
      expect((insertedRow as Record<string, unknown>).key_hash).toBe(
        expectedHash
      )
    }
  })

  it('rejects empty name with error message', async () => {
    const { createApiKey } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    const result = await createApiKey('')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('1-64 characters')
    }
  })

  it('rejects name longer than 64 chars with error message', async () => {
    const { createApiKey } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    const result = await createApiKey('a'.repeat(65))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('1-64 characters')
    }
  })

  it('rejects when user already has 10 keys (max limit)', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 10 }),
      }),
    }))

    const { createApiKey } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    const result = await createApiKey('Eleventh Key')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Maximum of 10')
    }
  })
})

describe('listApiKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } })
  })

  it('returns array with id, name, prefix, created_at, last_used_at (no key_hash)', async () => {
    const testKeys = [
      {
        id: 'key-1',
        name: 'Test Key',
        prefix: 'abc12345',
        created_at: '2026-04-08T00:00:00Z',
        last_used_at: null,
      },
    ]

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: testKeys }),
        }),
      }),
    }))

    const { listApiKeys } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    const result = await listApiKeys()

    expect(result).toEqual(testKeys)
    expect(result[0]).not.toHaveProperty('key_hash')
  })

  it('prefix is 8 chars (masked display data)', async () => {
    const testKeys = [
      {
        id: 'key-1',
        name: 'Test',
        prefix: 'abcd1234',
        created_at: '2026-04-08',
        last_used_at: null,
      },
    ]

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: testKeys }),
        }),
      }),
    }))

    const { listApiKeys } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    const result = await listApiKeys()

    expect(result[0].prefix.length).toBe(8)
  })
})

describe('revokeApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockGetUser.mockResolvedValue({ data: { user: fakeUser } })
  })

  it('calls delete with both keyId and user_id filters', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockDeleteFn = vi.fn().mockReturnValue({ eq: mockEq1 })

    mockFrom.mockImplementation(() => ({
      delete: mockDeleteFn,
    }))

    const { revokeApiKey } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    await revokeApiKey('key-to-revoke')

    expect(mockFrom).toHaveBeenCalledWith('api_keys')
    expect(mockDeleteFn).toHaveBeenCalled()
    expect(mockEq1).toHaveBeenCalledWith('id', 'key-to-revoke')
    expect(mockEq2).toHaveBeenCalledWith('user_id', fakeUser.id)
  })

  it('returns { success: true } on successful deletion', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })

    mockFrom.mockImplementation(() => ({
      delete: vi.fn().mockReturnValue({ eq: mockEq1 }),
    }))

    const { revokeApiKey } = await import(
      '@/app/(dashboard)/settings/api-keys/actions'
    )
    const result = await revokeApiKey('key-123')

    expect(result).toEqual({ success: true })
  })
})

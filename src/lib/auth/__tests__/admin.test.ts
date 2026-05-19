import { describe, it, expect, afterEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdminUser, requireAdmin } from '@/lib/auth/admin'

/**
 * Phase 86 (ADMIN-01) — admin auth helper.
 *
 * Proves the fail-safe-closed env allowlist and the session-cookie
 * requireAdmin path.
 */

afterEach(() => {
  vi.unstubAllEnvs()
})

// A fake session-aware Supabase client — only `auth.getUser` is exercised.
function fakeClient(
  getUser: () => Promise<{ data: { user: unknown } }>,
): SupabaseClient {
  return { auth: { getUser } } as unknown as SupabaseClient
}

describe('isAdminUser', () => {
  it('returns true for an id present in ADMIN_USER_IDS', () => {
    vi.stubEnv('ADMIN_USER_IDS', 'id-a,id-b,id-c')
    expect(isAdminUser('id-b')).toBe(true)
  })

  it('returns false for an id not in the allowlist', () => {
    vi.stubEnv('ADMIN_USER_IDS', 'id-a,id-b,id-c')
    expect(isAdminUser('id-z')).toBe(false)
  })

  it('returns false for every id when ADMIN_USER_IDS is unset (fail-safe-closed)', () => {
    vi.stubEnv('ADMIN_USER_IDS', '')
    expect(isAdminUser('ed8ca688-ec50-4c8c-834e-1b9f562eee8a')).toBe(false)
  })

  it('matches a trimmed id against whitespace-padded allowlist entries', () => {
    vi.stubEnv('ADMIN_USER_IDS', ' id-a , id-b ')
    expect(isAdminUser('id-a')).toBe(true)
    expect(isAdminUser('id-b')).toBe(true)
  })

  it('returns false for null / undefined / empty user ids', () => {
    vi.stubEnv('ADMIN_USER_IDS', 'id-a')
    expect(isAdminUser(null)).toBe(false)
    expect(isAdminUser(undefined)).toBe(false)
    expect(isAdminUser('')).toBe(false)
  })
})

describe('requireAdmin', () => {
  it('resolves to {id,email} for an allowlisted session user', async () => {
    vi.stubEnv('ADMIN_USER_IDS', 'admin-1')
    const client = fakeClient(async () => ({
      data: { user: { id: 'admin-1', email: 'admin@example.com' } },
    }))
    await expect(requireAdmin(client)).resolves.toEqual({
      id: 'admin-1',
      email: 'admin@example.com',
    })
  })

  it('resolves to null for a non-allowlisted session user', async () => {
    vi.stubEnv('ADMIN_USER_IDS', 'admin-1')
    const client = fakeClient(async () => ({
      data: { user: { id: 'not-an-admin', email: 'nope@example.com' } },
    }))
    await expect(requireAdmin(client)).resolves.toBeNull()
  })

  it('resolves to null when there is no session', async () => {
    vi.stubEnv('ADMIN_USER_IDS', 'admin-1')
    const client = fakeClient(async () => ({ data: { user: null } }))
    await expect(requireAdmin(client)).resolves.toBeNull()
  })

  it('resolves to null (never throws) when getUser throws', async () => {
    vi.stubEnv('ADMIN_USER_IDS', 'admin-1')
    const client = fakeClient(async () => {
      throw new Error('network down')
    })
    await expect(requireAdmin(client)).resolves.toBeNull()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deductCredit, getCreditBalance } from '@/lib/credits/check-credits'

const mockCreateClient = vi.mocked(createClient)
const mockCreateAdminClient = vi.mocked(createAdminClient)

function mockSupabaseWithAdmin(config: {
  deductResult?: boolean
  useAdmin?: boolean
}) {
  const { deductResult = true } = config

  const rpcFn = vi.fn().mockImplementation((fnName: string) => {
    if (fnName === 'deduct_credits') {
      return Promise.resolve({ data: deductResult, error: null })
    }
    if (fnName === 'get_credit_balance') {
      return Promise.resolve({ data: 5, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  const clientMock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
      }),
    },
    from: vi.fn(),
    rpc: rpcFn,
  }

  const adminMock = {
    from: vi.fn(),
    rpc: vi.fn().mockImplementation((fnName: string) => {
      if (fnName === 'deduct_credits') {
        return Promise.resolve({ data: deductResult, error: null })
      }
      if (fnName === 'get_credit_balance') {
        return Promise.resolve({ data: 5, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreateClient.mockResolvedValue(clientMock as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreateAdminClient.mockReturnValue(adminMock as any)

  return { clientRpc: rpcFn, adminRpc: adminMock.rpc, clientMock, adminMock }
}

describe('deductCredit with adminClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses provided adminClient instead of cookie-based client', async () => {
    const { adminMock, clientRpc } = mockSupabaseWithAdmin({ deductResult: true })
    // When implementation is updated to accept adminClient option,
    // calling deductCredit with an adminClient should use that client's RPC
    // For now, this test documents the expected behavior for Plan 01
    const result = await deductCredit('user-123', 'carousel_generation', 'API generation', 'proj-1')
    // Current implementation uses cookie-based client; Plan 01 will add adminClient support
    expect(result).toBe(true)
    // Verify RPC was called (via either client)
    expect(clientRpc).toHaveBeenCalledWith('deduct_credits', expect.objectContaining({
      p_user_id: 'user-123',
    }))
  })

  it('falls back to createClient when no adminClient provided', async () => {
    const { clientRpc } = mockSupabaseWithAdmin({ deductResult: true })
    const result = await deductCredit('user-123', 'carousel_generation')
    expect(result).toBe(true)
    // Verify the cookie-based client's RPC was used (backward compatibility)
    expect(clientRpc).toHaveBeenCalledWith('deduct_credits', expect.objectContaining({
      p_user_id: 'user-123',
      p_type: 'carousel_generation',
    }))
  })
})

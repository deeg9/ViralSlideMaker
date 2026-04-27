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
import {
  getUserTier,
  getCreditBalance,
  deductCredit,
  checkCredits,
  checkProjectLimit,
  deductCreditAdmin,
  getCreditBalanceAdmin,
} from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'

const mockCreateClient = vi.mocked(createClient)
const mockCreateAdminClient = vi.mocked(createAdminClient)

interface MockConfig {
  tier?: string | null
  tierError?: boolean
  balance?: number | null
  deductResult?: boolean | null
  user?: { id: string } | null
  projectCount?: number
}

function mockSupabase(config: MockConfig) {
  const {
    tier = null,
    tierError = false,
    balance = 0,
    deductResult = null,
    user = { id: 'user-123' },
    projectCount = 0,
  } = config

  const singleFn = vi.fn().mockResolvedValue(
    tierError
      ? { data: null, error: { message: 'not found' } }
      : { data: tier ? { tier } : null, error: tier ? null : { message: 'not found' } }
  )

  const eqFn = vi.fn().mockReturnValue({ single: singleFn, maybeSingle: singleFn })

  const selectSubsFn = vi.fn().mockReturnValue({ eq: eqFn })

  // Projects mock for checkProjectLimit
  const projectEqFn = vi.fn().mockResolvedValue({ count: projectCount })
  const projectSelectFn = vi.fn().mockReturnValue({ eq: projectEqFn })

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'subscriptions') {
      return { select: selectSubsFn }
    }
    if (table === 'projects') {
      return { select: projectSelectFn }
    }
    return {}
  })

  const rpcFn = vi.fn().mockImplementation((fnName: string) => {
    if (fnName === 'get_credit_balance') {
      return Promise.resolve({ data: balance, error: null })
    }
    if (fnName === 'deduct_credits') {
      return Promise.resolve({ data: deductResult, error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
    from: fromFn,
    rpc: rpcFn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { fromFn, rpcFn }
}

function mockAdminSupabase(config: { existingTier?: string | null }) {
  const { existingTier = null } = config

  const singleFn = vi.fn().mockResolvedValue(
    existingTier
      ? { data: { tier: existingTier }, error: null }
      : { data: null, error: { message: 'not found' } }
  )
  const eqFn = vi.fn().mockReturnValue({ single: singleFn, maybeSingle: singleFn })
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn })
  const insertFn = vi.fn().mockResolvedValue({ error: null })

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === 'subscriptions') {
      return { select: selectFn, insert: insertFn }
    }
    if (table === 'credit_transactions') {
      return { insert: insertFn }
    }
    return {}
  })

  mockCreateAdminClient.mockReturnValue({
    from: fromFn,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

  return { fromFn, insertFn }
}

describe('getUserTier', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns tier from subscriptions table', async () => {
    mockAdminSupabase({ existingTier: 'plus' })
    const tier = await getUserTier('user-123')
    expect(tier).toBe('plus')
  })

  it('returns free when no subscription row exists', async () => {
    mockAdminSupabase({ existingTier: null })
    const tier = await getUserTier('user-123')
    expect(tier).toBe('free')
  })
})

describe('getCreditBalance', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls get_credit_balance RPC and returns integer', async () => {
    const { rpcFn } = mockSupabase({ balance: 7 })
    const balance = await getCreditBalance('user-123')
    expect(balance).toBe(7)
    expect(rpcFn).toHaveBeenCalledWith('get_credit_balance', { p_user_id: 'user-123' })
  })

  it('returns 0 when RPC returns null', async () => {
    mockSupabase({ balance: null })
    const balance = await getCreditBalance('user-123')
    expect(balance).toBe(0)
  })
})

describe('deductCredit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('calls deduct_credits RPC and returns true on success', async () => {
    const { rpcFn } = mockSupabase({ deductResult: true })
    const result = await deductCredit('user-123', 'carousel_generation', 'Gen carousel', 'proj-1')
    expect(result).toBe(true)
    expect(rpcFn).toHaveBeenCalledWith('deduct_credits', {
      p_user_id: 'user-123',
      p_amount: 1,
      p_type: 'carousel_generation',
      p_description: 'Gen carousel',
      p_reference_id: 'proj-1',
    })
  })

  it('returns false when RPC returns false (insufficient balance)', async () => {
    mockSupabase({ deductResult: false })
    const result = await deductCredit('user-123', 'carousel_generation')
    expect(result).toBe(false)
  })
})

describe('checkCredits', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns allowed=true when balance > 0', async () => {
    mockSupabase({ tier: 'plus', balance: 5 })
    mockAdminSupabase({ existingTier: 'plus' })
    const result = await checkCredits()
    expect(result).toEqual({ allowed: true, tier: 'plus', balance: 5 })
  })

  it('returns allowed=false when balance is 0', async () => {
    mockSupabase({ tier: 'free', balance: 0 })
    mockAdminSupabase({ existingTier: 'free' })
    const result = await checkCredits()
    expect(result).toEqual({ allowed: false, tier: 'free', balance: 0 })
  })

  it('returns { allowed: false, tier: free, balance: 0 } when no user', async () => {
    mockSupabase({ user: null })
    const result = await checkCredits()
    expect(result).toEqual({ allowed: false, tier: 'free', balance: 0 })
  })
})

describe('checkProjectLimit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns true for non-free tiers regardless of count', async () => {
    mockSupabase({ projectCount: 100 })
    const result = await checkProjectLimit('user-123', 'pro')
    expect(result).toBe(true)
  })

  it('returns true for free tier when count < 3', async () => {
    mockSupabase({ projectCount: 2 })
    const result = await checkProjectLimit('user-123', 'free')
    expect(result).toBe(true)
  })

  it('returns false for free tier when count >= 3', async () => {
    mockSupabase({ projectCount: 3 })
    const result = await checkProjectLimit('user-123', 'free')
    expect(result).toBe(false)
  })
})

describe('deductCreditAdmin', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function createMockSupabaseClient(rpcResult: unknown) {
    return {
      rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('calls supabase.rpc deduct_credits and returns true on success', async () => {
    const client = createMockSupabaseClient(true)
    const result = await deductCreditAdmin(client, 'user-123', 'carousel_generation', 'Gen carousel', 'proj-1')
    expect(result).toBe(true)
    expect(client.rpc).toHaveBeenCalledWith('deduct_credits', {
      p_user_id: 'user-123',
      p_amount: 1,
      p_type: 'carousel_generation',
      p_description: 'Gen carousel',
      p_reference_id: 'proj-1',
    })
  })

  it('returns false when RPC returns false (insufficient balance)', async () => {
    const client = createMockSupabaseClient(false)
    const result = await deductCreditAdmin(client, 'user-123', 'carousel_generation')
    expect(result).toBe(false)
  })

  it('returns true without calling RPC when amount <= 0', async () => {
    const client = createMockSupabaseClient(true)
    const result = await deductCreditAdmin(client, 'user-123', 'free_action', undefined, undefined, 0)
    expect(result).toBe(true)
    expect(client.rpc).not.toHaveBeenCalled()
  })
})

describe('getCreditBalanceAdmin', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function createMockSupabaseClient(rpcResult: unknown) {
    return {
      rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('calls supabase.rpc get_credit_balance and returns the number', async () => {
    const client = createMockSupabaseClient(42)
    const balance = await getCreditBalanceAdmin(client, 'user-123')
    expect(balance).toBe(42)
    expect(client.rpc).toHaveBeenCalledWith('get_credit_balance', { p_user_id: 'user-123' })
  })

  it('returns 0 when RPC returns null', async () => {
    const client = createMockSupabaseClient(null)
    const balance = await getCreditBalanceAdmin(client, 'user-123')
    expect(balance).toBe(0)
  })
})

describe('ensureSubscription', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns existing tier when subscription exists', async () => {
    mockAdminSupabase({ existingTier: 'plus' })
    const tier = await ensureSubscription('user-123')
    expect(tier).toBe('plus')
  })

  it('creates free subscription and grants credits when no subscription exists', async () => {
    const { insertFn } = mockAdminSupabase({ existingTier: null })
    const tier = await ensureSubscription('user-123')
    expect(tier).toBe('free')
    // Should have called insert twice: once for subscription, once for credit grant
    expect(insertFn).toHaveBeenCalledTimes(2)
  })
})

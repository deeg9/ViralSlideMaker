// Phase 73 (COST-04): tests for the rolling-24h extraction rate cap.
// Mocks Supabase admin client. Asserts free-tier 5 calls/24h × 3 images/call,
// premium tier uncapped, fail-closed on DB error, and env var override.

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

interface FakeChainResult {
  count: number | null
  error: Error | null
}

interface FakeAdmin {
  from: Mock
  _result: FakeChainResult
  _setResult: (r: FakeChainResult) => void
  _calls: { eq: Array<[string, unknown]>; gte: Array<[string, unknown]> }
}

function makeFakeAdmin(initial: FakeChainResult = { count: 0, error: null }): FakeAdmin {
  const state: FakeChainResult = { ...initial }
  const calls = { eq: [] as Array<[string, unknown]>, gte: [] as Array<[string, unknown]> }
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn(function (this: unknown, col: string, val: unknown) {
      calls.eq.push([col, val])
      return this
    }),
    gte: vi.fn(function (this: unknown, col: string, val: unknown) {
      calls.gte.push([col, val])
      // The chain resolves at this terminal point per the helper's await.
      return Promise.resolve({ count: state.count, error: state.error })
    }),
  }
  const from = vi.fn(() => chain)
  return {
    from: from as Mock,
    _result: state,
    _setResult: (r) => {
      state.count = r.count
      state.error = r.error
    },
    _calls: calls,
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Phase 73 (COST-04): checkExtractionRateCap', () => {
  it('free tier, 0 calls in 24h, requesting 1 image → allowed: true, callsRemaining: 5', async () => {
    const { checkExtractionRateCap, FREE_DAILY_CALL_CAP } = await import('../style-extraction-rate-cap')
    const admin = makeFakeAdmin({ count: 0, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'free', 1)
    expect(r.allowed).toBe(true)
    expect(r.callsToday).toBe(0)
    expect(r.callsRemaining).toBe(FREE_DAILY_CALL_CAP)
    expect(r.imagesPerCallCap).toBe(3)
  })

  it('free tier, 4 calls in 24h, requesting 1 image → allowed: true, callsRemaining: 1', async () => {
    const { checkExtractionRateCap } = await import('../style-extraction-rate-cap')
    const admin = makeFakeAdmin({ count: 4, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'free', 1)
    expect(r.allowed).toBe(true)
    expect(r.callsToday).toBe(4)
    expect(r.callsRemaining).toBe(1)
  })

  it('free tier, 5 calls in 24h, requesting 1 image → allowed: false, daily_cap_reached', async () => {
    const { checkExtractionRateCap } = await import('../style-extraction-rate-cap')
    const admin = makeFakeAdmin({ count: 5, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'free', 1)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('daily_cap_reached')
    expect(r.callsToday).toBe(5)
    expect(r.callsRemaining).toBe(0)
  })

  it('free tier, 0 calls in 24h, requesting 4 images → allowed: false, too_many_images_per_call', async () => {
    const { checkExtractionRateCap } = await import('../style-extraction-rate-cap')
    const admin = makeFakeAdmin({ count: 0, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'free', 4)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('too_many_images_per_call')
    // Should short-circuit before any DB call.
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('free tier, 0 calls in 24h, requesting 3 images → allowed: true (boundary)', async () => {
    const { checkExtractionRateCap } = await import('../style-extraction-rate-cap')
    const admin = makeFakeAdmin({ count: 0, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'free', 3)
    expect(r.allowed).toBe(true)
  })

  it('free tier, 0 calls in 24h, requesting 0 images → allowed: false, no_images_provided', async () => {
    const { checkExtractionRateCap } = await import('../style-extraction-rate-cap')
    const admin = makeFakeAdmin({ count: 0, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'free', 0)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('no_images_provided')
    // Should short-circuit before any DB call.
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('plus tier, 100 calls in 24h, requesting 8 images → allowed: true (premium uncapped)', async () => {
    const { checkExtractionRateCap } = await import('../style-extraction-rate-cap')
    const admin = makeFakeAdmin({ count: 100, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'plus', 8)
    expect(r.allowed).toBe(true)
    expect(r.callsRemaining).toBe(Infinity)
    expect(r.imagesPerCallCap).toBe(Infinity)
    // Premium short-circuits before DB call.
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('pro tier, 1000 calls in 24h, requesting 8 images → allowed: true', async () => {
    const { checkExtractionRateCap } = await import('../style-extraction-rate-cap')
    const admin = makeFakeAdmin({ count: 1000, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'pro', 8)
    expect(r.allowed).toBe(true)
  })

  it('DB error → allowed: false, rate_check_failed (fail-closed)', async () => {
    const { checkExtractionRateCap } = await import('../style-extraction-rate-cap')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const admin = makeFakeAdmin({ count: null, error: new Error('connection refused') })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'free', 1)
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('rate_check_failed')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('env override: STYLE_EXTRACTION_FREE_DAILY_CALL_CAP=10, free tier with 9 calls → allowed: true', async () => {
    vi.stubEnv('STYLE_EXTRACTION_FREE_DAILY_CALL_CAP', '10')
    // Re-import after env stub so module-load constant picks up the new value.
    const { checkExtractionRateCap, FREE_DAILY_CALL_CAP } = await import('../style-extraction-rate-cap')
    expect(FREE_DAILY_CALL_CAP).toBe(10)
    const admin = makeFakeAdmin({ count: 9, error: null })
    const r = await checkExtractionRateCap(admin as unknown as SupabaseClient, 'u1', 'free', 1)
    expect(r.allowed).toBe(true)
    expect(r.callsRemaining).toBe(1)
  })
})

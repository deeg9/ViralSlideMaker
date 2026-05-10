// Phase 73 (COST-05): tests for the daily bill-alarm Vercel cron route.
// Asserts auth gate (401 without/with-wrong CRON_SECRET), correct net-cost
// computation (charges - refunds × PER_CALL_COST_USD), ceiling-breach warn,
// and DB-error 500 path.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoisted mock for createAdminClient so tests can swap the underlying chain.
const { mockChain } = vi.hoisted(() => {
  type ChainResult = { count: number | null; error: Error | null }
  const state = {
    chargesResult: { count: 0, error: null } as ChainResult,
    refundsResult: { count: 0, error: null } as ChainResult,
    fromCalls: [] as string[],
    eqCalls: [] as Array<[string, unknown]>,
  }
  function makeChain(table: string) {
    state.fromCalls.push(table)
    let resolved: ChainResult | null = null
    const proxy: Record<string, unknown> = {}
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        state.eqCalls.push([col, val])
        // Track type=… to decide which result this chain represents.
        if (col === 'type') {
          if (val === 'gemini_vision_extract_style') resolved = state.chargesResult
          else if (val === 'refund') resolved = state.refundsResult
        }
        return chain
      },
      like: () => chain,
      gte: () => Promise.resolve(resolved ?? { count: 0, error: null }),
    }
    Object.assign(proxy, chain)
    return chain
  }
  const adminClient = { from: (t: string) => makeChain(t) }
  return {
    mockChain: {
      adminClient,
      state,
      reset() {
        state.chargesResult = { count: 0, error: null }
        state.refundsResult = { count: 0, error: null }
        state.fromCalls = []
        state.eqCalls = []
      },
    },
  }
})

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mockChain.adminClient,
}))

// Spies on console for breach-warn assertion. Re-set per test.
let warnSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mockChain.reset()
  vi.resetModules()
  vi.unstubAllEnvs()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
  errorSpy.mockRestore()
  logSpy.mockRestore()
  vi.unstubAllEnvs()
})

function makeRequest(opts: { authHeader?: string } = {}): Request {
  const headers = new Headers()
  if (opts.authHeader !== undefined) headers.set('authorization', opts.authHeader)
  return new Request('http://localhost/api/cron/style-extraction-bill-alarm', {
    method: 'GET',
    headers,
  })
}

describe('Phase 73 (COST-05): bill-alarm cron auth gate', () => {
  it('GET without Authorization header → 401', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    const { GET } = await import('../route')
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('unauthorized')
  })

  it('GET with wrong CRON_SECRET → 401', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    const { GET } = await import('../route')
    const res = await GET(makeRequest({ authHeader: 'Bearer wrong-secret' }))
    expect(res.status).toBe(401)
  })

  it('When CRON_SECRET env is empty/unset → ALL requests return 401 (fail-closed)', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const { GET } = await import('../route')
    // Even with a "Bearer " header, empty secret means no request can match.
    const res1 = await GET(makeRequest({ authHeader: 'Bearer ' }))
    expect(res1.status).toBe(401)
    const res2 = await GET(makeRequest({ authHeader: 'Bearer anything' }))
    expect(res2.status).toBe(401)
  })
})

describe('Phase 73 (COST-05): bill-alarm cron computation', () => {
  it('correct secret + 0 charges → breach false, todayCostUsd 0', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('STYLE_EXTRACTION_DAILY_COST_CEILING_USD', '5')
    vi.stubEnv('STYLE_EXTRACTION_PER_CALL_COST_USD', '0.003')
    const { GET } = await import('../route')
    mockChain.state.chargesResult = { count: 0, error: null }
    mockChain.state.refundsResult = { count: 0, error: null }
    const res = await GET(makeRequest({ authHeader: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      ok: true,
      breach: false,
      todayCostUsd: 0,
      netCalls: 0,
    })
  })

  it('correct secret + 1000 net charges at $0.003/call → todayCostUsd 3.0, ceiling 5.0 → breach false', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('STYLE_EXTRACTION_DAILY_COST_CEILING_USD', '5')
    vi.stubEnv('STYLE_EXTRACTION_PER_CALL_COST_USD', '0.003')
    const { GET } = await import('../route')
    mockChain.state.chargesResult = { count: 1000, error: null }
    mockChain.state.refundsResult = { count: 0, error: null }
    const res = await GET(makeRequest({ authHeader: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.netCalls).toBe(1000)
    expect(body.todayCostUsd).toBe(3)
    expect(body.breach).toBe(false)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('correct secret + 2000 net charges at $0.003/call → todayCostUsd 6.0, ceiling 5.0 → breach true; warn fired', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('STYLE_EXTRACTION_DAILY_COST_CEILING_USD', '5')
    vi.stubEnv('STYLE_EXTRACTION_PER_CALL_COST_USD', '0.003')
    const { GET } = await import('../route')
    mockChain.state.chargesResult = { count: 2000, error: null }
    mockChain.state.refundsResult = { count: 0, error: null }
    const res = await GET(makeRequest({ authHeader: 'Bearer test-secret' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.netCalls).toBe(2000)
    expect(body.todayCostUsd).toBe(6)
    expect(body.breach).toBe(true)
    expect(warnSpy).toHaveBeenCalled()
    const warnArgs = warnSpy.mock.calls[0]
    expect(String(warnArgs[0])).toContain('[bill-alarm] CEILING BREACHED')
  })

  it('correct secret + DB error → 500 with error: "db_error"', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    const { GET } = await import('../route')
    mockChain.state.chargesResult = { count: null, error: new Error('connection refused') }
    mockChain.state.refundsResult = { count: 0, error: null }
    const res = await GET(makeRequest({ authHeader: 'Bearer test-secret' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('db_error')
    expect(errorSpy).toHaveBeenCalled()
  })

  it('refunds offset charges in net calculation', async () => {
    vi.stubEnv('CRON_SECRET', 'test-secret')
    vi.stubEnv('STYLE_EXTRACTION_DAILY_COST_CEILING_USD', '5')
    vi.stubEnv('STYLE_EXTRACTION_PER_CALL_COST_USD', '0.003')
    const { GET } = await import('../route')
    mockChain.state.chargesResult = { count: 1000, error: null }
    mockChain.state.refundsResult = { count: 200, error: null }
    const res = await GET(makeRequest({ authHeader: 'Bearer test-secret' }))
    const body = await res.json()
    expect(body.netCalls).toBe(800)
    expect(body.chargesToday).toBe(1000)
    expect(body.refundsToday).toBe(200)
    // 800 × 0.003 = 2.4
    expect(body.todayCostUsd).toBe(2.4)
  })
})

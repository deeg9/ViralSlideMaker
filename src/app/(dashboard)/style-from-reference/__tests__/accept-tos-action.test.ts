// Phase 79 Plan 02 Task 1 (LEGAL-01):
// Server-action contract tests for `acceptStyleFromReferenceTosAction` —
// the symbol the clickwrap modal dispatches when the user clicks Accept.
//
// What this pins:
//   T1: No authenticated user → returns { ok: false, error: 'unauthenticated' }
//       and NEVER calls recordStyleFromReferenceTosAcceptance
//   T2: Happy path — authenticated user → calls
//       recordStyleFromReferenceTosAcceptance(admin, { userId, sha256s: [],
//       tosVersion }) exactly once and returns { ok: true }
//   T3: An unexpected version literal still flows through to the recorder
//       (the action does not silently rewrite the input — the modal owns
//       version selection so the audit row reflects what the user saw)
//   T4: When the recorder returns { ok: false, error } the action returns
//       { ok: false, error: 'record_failed' } — the error tag the client
//       routes on; original error is included as `detail` for forensics
//   T5: The action does NOT throw when the recorder rejects — surfaces a
//       structured failure result instead (defense-in-depth: the modal's
//       error UI relies on getting an object back, not an exception)

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Hoisted mocks ----
const { mockGetUser, mockRecord } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRecord: vi.fn(),
}))

// Mock-out the heavy import chain (Pexels client touches PEXELS_API_KEY at
// module-load time when not stubbed; mirror existing actions.test.ts pattern).
vi.mock('@/lib/services/carousel', () => ({
  generateCarouselFromReferences: vi.fn(),
}))
vi.mock('@/lib/services/projects', () => ({
  createProjectService: vi.fn(),
}))
vi.mock('@/lib/ai/extract-style-spec', () => ({
  extractStyleSpec: vi.fn(),
}))
vi.mock('@/lib/credits/check-credits', () => ({
  getUserTier: vi.fn().mockResolvedValue('free'),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({ __admin__: true }),
}))

vi.mock('@/lib/legal/audit-log', () => ({
  recordStyleFromReferenceTosAcceptance: mockRecord,
}))

// Import AFTER mocks
import { acceptStyleFromReferenceTosAction } from '../actions'
import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockReset()
  mockRecord.mockReset()
})

describe('Phase 79 Plan 02 Task 1: acceptStyleFromReferenceTosAction (LEGAL-01)', () => {
  it('Test 1: unauthenticated user → { ok: false, error: "unauthenticated" }, no recorder call', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const result = await acceptStyleFromReferenceTosAction(STYLE_FROM_REFERENCE_TOS_VERSION)

    expect(result).toEqual({ ok: false, error: 'unauthenticated' })
    expect(mockRecord).not.toHaveBeenCalled()
  })

  it('Test 2: happy path — authenticated user → records acceptance with empty sha256s + version, returns ok:true', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user_123' } } })
    mockRecord.mockResolvedValueOnce({ ok: true })

    const result = await acceptStyleFromReferenceTosAction(STYLE_FROM_REFERENCE_TOS_VERSION)

    expect(result).toEqual({ ok: true })
    expect(mockRecord).toHaveBeenCalledTimes(1)
    const [adminArg, argsArg] = mockRecord.mock.calls[0]
    // Admin client is the service-role client object
    expect(adminArg).toEqual({ __admin__: true })
    expect(argsArg).toEqual({
      userId: 'user_123',
      sha256s: [],
      tosVersion: STYLE_FROM_REFERENCE_TOS_VERSION,
    })
  })

  it('Test 3: action passes the version literal through unchanged (no silent rewrite)', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user_123' } } })
    mockRecord.mockResolvedValueOnce({ ok: true })

    // Even if the caller hands a non-current literal, the action must NOT
    // overwrite it — the audit row should reflect what the user saw on screen.
    const handed = '2099-12-31-v9'
    const result = await acceptStyleFromReferenceTosAction(handed)

    expect(result).toEqual({ ok: true })
    expect(mockRecord.mock.calls[0][1]).toMatchObject({ tosVersion: handed })
  })

  it('Test 4: recorder returns { ok: false, error } → action returns { ok: false, error: "record_failed", detail }', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user_123' } } })
    const recorderErr = { message: 'unique violation' }
    mockRecord.mockResolvedValueOnce({ ok: false, error: recorderErr })

    const result = await acceptStyleFromReferenceTosAction(STYLE_FROM_REFERENCE_TOS_VERSION)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error).toBe('record_failed')
      // Detail is allowed to be a string OR pass the error through unchanged —
      // we only assert it is non-empty so forensics are not lost.
      expect(result.detail).toBeDefined()
    }
  })

  it('Test 5: action does NOT throw when the recorder rejects — surfaces a structured result', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user_123' } } })
    mockRecord.mockRejectedValueOnce(new Error('boom'))

    // Per the audit-log helper contract, the recorder NEVER actually rejects
    // (it always returns { ok: false }). Defense-in-depth: even if a future
    // helper change starts throwing, the action still returns a structured
    // result so the modal's error UI keeps working.
    let result: Awaited<ReturnType<typeof acceptStyleFromReferenceTosAction>> | undefined
    let threw = false
    try {
      result = await acceptStyleFromReferenceTosAction(STYLE_FROM_REFERENCE_TOS_VERSION)
    } catch {
      threw = true
    }
    expect(threw).toBe(false)
    expect(result?.ok).toBe(false)
    if (result && result.ok === false) {
      expect(result.error).toBe('record_failed')
    }
  })
})

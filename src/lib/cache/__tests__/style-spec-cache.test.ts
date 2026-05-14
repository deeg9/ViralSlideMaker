// Phase 73 (COST-03, Plan 02): contract tests for style-spec-cache helpers.
// Mirrors v2.6 match-photos-to-slides cache-failure stance: NEVER block the
// caller — log + resolve on any cache I/O failure. These tests pin that
// contract so Phase 75 can call lookupStyleSpec/persistStyleSpec without
// wrapping them in try/catch.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupStyleSpec, persistStyleSpec } from '@/lib/cache/style-spec-cache'

type MockedAdmin = {
  admin: SupabaseClient
  fromMock: ReturnType<typeof vi.fn>
  selectMock: ReturnType<typeof vi.fn>
  selectEqMock: ReturnType<typeof vi.fn>
  maybeSingleMock: ReturnType<typeof vi.fn>
  updateMock: ReturnType<typeof vi.fn>
  updateEqMock: ReturnType<typeof vi.fn>
  upsertMock: ReturnType<typeof vi.fn>
}

function buildAdmin(opts?: {
  selectResult?: { data: unknown; error: unknown }
  selectThrows?: boolean
  updateResult?: { error: unknown }
  upsertResult?: { error: unknown }
  upsertThrows?: boolean
}): MockedAdmin {
  const selectResult = opts?.selectResult ?? { data: null, error: null }
  const updateResult = opts?.updateResult ?? { error: null }
  const upsertResult = opts?.upsertResult ?? { error: null }

  const maybeSingleMock = vi.fn(() =>
    opts?.selectThrows
      ? Promise.reject(new Error('boom'))
      : Promise.resolve(selectResult),
  )
  const selectEqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
  const selectMock = vi.fn(() => ({ eq: selectEqMock }))

  // .update().eq() returns a thenable so the helper can attach .then() in fire-and-forget mode
  const updateEqMock = vi.fn(() => Promise.resolve(updateResult))
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))

  const upsertMock = vi.fn(() =>
    opts?.upsertThrows
      ? Promise.reject(new Error('boom'))
      : Promise.resolve(upsertResult),
  )

  const fromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
    upsert: upsertMock,
  }))

  const admin = { from: fromMock } as unknown as SupabaseClient
  return {
    admin,
    fromMock,
    selectMock,
    selectEqMock,
    maybeSingleMock,
    updateMock,
    updateEqMock,
    upsertMock,
  }
}

describe('style-spec-cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('lookupStyleSpec', () => {
    it('returns null on cache miss and does NOT call update (no phantom row)', async () => {
      const m = buildAdmin({ selectResult: { data: null, error: null } })
      const result = await lookupStyleSpec(m.admin, 'a'.repeat(64))
      expect(result).toBeNull()
      expect(m.fromMock).toHaveBeenCalledWith('style_spec_cache')
      expect(m.selectMock).toHaveBeenCalledWith('style_spec')
      expect(m.selectEqMock).toHaveBeenCalledWith('sha256', 'a'.repeat(64))
      expect(m.maybeSingleMock).toHaveBeenCalledTimes(1)
      // No phantom-row write on miss
      expect(m.updateMock).not.toHaveBeenCalled()
    })

    it('returns the spec object directly on cache hit (NOT wrapped in { style_spec })', async () => {
      // Phase 80 R5: spec must carry schema_version=2 to pass the defensive filter.
      const spec = {
        schema_version: 2,
        palette: ['#fff', '#000'],
        typography: { primary: 'Inter' },
      }
      const m = buildAdmin({
        selectResult: { data: { style_spec: spec }, error: null },
      })
      const result = await lookupStyleSpec(m.admin, 'b'.repeat(64))
      expect(result).toEqual(spec)
    })

    it('triggers fire-and-forget last_hit_at update on cache hit', async () => {
      const spec = { schema_version: 2, palette: ['#abc'] }
      const sha = 'c'.repeat(64)
      const m = buildAdmin({
        selectResult: { data: { style_spec: spec }, error: null },
      })
      await lookupStyleSpec(m.admin, sha)
      // Allow the fire-and-forget microtask to settle
      await new Promise((r) => setImmediate(r))
      expect(m.updateMock).toHaveBeenCalledTimes(1)
      const updatePayload = m.updateMock.mock.calls[0][0] as Record<string, unknown>
      expect(updatePayload).toHaveProperty('last_hit_at')
      expect(typeof updatePayload.last_hit_at).toBe('string')
      expect(m.updateEqMock).toHaveBeenCalledWith('sha256', sha)
    })

    it('does NOT throw if last_hit_at update fails (best-effort warn)', async () => {
      const spec = { schema_version: 2, palette: ['#abc'] }
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const m = buildAdmin({
        selectResult: { data: { style_spec: spec }, error: null },
        updateResult: { error: { message: 'update boom' } },
      })
      const result = await lookupStyleSpec(m.admin, 'd'.repeat(64))
      // Caller still gets the spec — the bump is fire-and-forget
      expect(result).toEqual(spec)
      // Allow the fire-and-forget microtask to settle so the warn fires
      await new Promise((r) => setImmediate(r))
      expect(warnSpy).toHaveBeenCalled()
    })

    // Phase 80 R5: defensive schema_version filter — schema-mismatched rows
    // must be treated as a cache miss; they must NOT be returned to the
    // caller (parseStyleSpecSafe in Plan 80-02 rejects v1), and they must
    // NOT trigger a phantom last_hit_at bump (a wrong-version row is dead
    // weight; bumping it would extend its life under any future LRU policy).
    describe('defensive schema_version=2 filter (Phase 80 R5)', () => {
      it('returns null when cached row has schema_version=1 (stale v1 entry)', async () => {
        const v1Spec = { schema_version: 1, palette: ['#ccc'] }
        const m = buildAdmin({
          selectResult: { data: { style_spec: v1Spec }, error: null },
        })
        const result = await lookupStyleSpec(m.admin, 'k'.repeat(64))
        expect(result).toBeNull()
        // Allow any stray microtask to settle before asserting no bump.
        await new Promise((r) => setImmediate(r))
        expect(m.updateMock).not.toHaveBeenCalled()
      })

      it('returns null when cached row is missing schema_version entirely', async () => {
        const malformedSpec = { palette: ['#ddd'] } // no schema_version
        const m = buildAdmin({
          selectResult: { data: { style_spec: malformedSpec }, error: null },
        })
        const result = await lookupStyleSpec(m.admin, 'l'.repeat(64))
        expect(result).toBeNull()
        await new Promise((r) => setImmediate(r))
        expect(m.updateMock).not.toHaveBeenCalled()
      })

      it('returns null when cached row holds a non-object style_spec (e.g. null or array)', async () => {
        const m = buildAdmin({
          selectResult: { data: { style_spec: null }, error: null },
        })
        const result = await lookupStyleSpec(m.admin, 'm'.repeat(64))
        expect(result).toBeNull()
        await new Promise((r) => setImmediate(r))
        expect(m.updateMock).not.toHaveBeenCalled()
      })

      it('returns null when schema_version is a string "2" (strict ===, no coercion)', async () => {
        const stringVerSpec = { schema_version: '2', palette: ['#eee'] }
        const m = buildAdmin({
          selectResult: { data: { style_spec: stringVerSpec }, error: null },
        })
        const result = await lookupStyleSpec(m.admin, 'n'.repeat(64))
        expect(result).toBeNull()
        await new Promise((r) => setImmediate(r))
        expect(m.updateMock).not.toHaveBeenCalled()
      })
    })

    it('returns null and warns when select rejects (throw-resilience)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const m = buildAdmin({ selectThrows: true })
      const result = await lookupStyleSpec(m.admin, 'e'.repeat(64))
      expect(result).toBeNull()
      expect(warnSpy).toHaveBeenCalled()
    })

    it('returns null when select returns an error payload', async () => {
      const m = buildAdmin({
        selectResult: { data: null, error: { message: 'pg down' } },
      })
      const result = await lookupStyleSpec(m.admin, 'f'.repeat(64))
      expect(result).toBeNull()
      // No phantom update on error
      expect(m.updateMock).not.toHaveBeenCalled()
    })
  })

  describe('persistStyleSpec', () => {
    it('upserts with sha256 + style_spec + model and onConflict sha256', async () => {
      const m = buildAdmin()
      const spec = { palette: ['#aaa'] }
      const sha = 'g'.repeat(64)
      await persistStyleSpec(m.admin, sha, spec, 'gemini-2.5-pro')
      expect(m.fromMock).toHaveBeenCalledWith('style_spec_cache')
      expect(m.upsertMock).toHaveBeenCalledTimes(1)
      const [payload, options] = m.upsertMock.mock.calls[0]
      expect(payload).toEqual({
        sha256: sha,
        style_spec: spec,
        model: 'gemini-2.5-pro',
      })
      expect(options).toEqual({ onConflict: 'sha256' })
    })

    it('defaults model to "gemini-2.5-flash" when omitted', async () => {
      const m = buildAdmin()
      const spec = { palette: ['#bbb'] }
      const sha = 'h'.repeat(64)
      await persistStyleSpec(m.admin, sha, spec)
      const [payload] = m.upsertMock.mock.calls[0]
      expect(payload).toEqual({
        sha256: sha,
        style_spec: spec,
        model: 'gemini-2.5-flash',
      })
    })

    it('does NOT throw when upsert returns an error payload (logs warn)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const m = buildAdmin({ upsertResult: { error: { message: 'unique violation' } } })
      await expect(
        persistStyleSpec(m.admin, 'i'.repeat(64), { palette: [] }),
      ).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalled()
    })

    it('does NOT throw when upsert rejects (logs warn)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const m = buildAdmin({ upsertThrows: true })
      await expect(
        persistStyleSpec(m.admin, 'j'.repeat(64), { palette: [] }),
      ).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalled()
    })
  })
})

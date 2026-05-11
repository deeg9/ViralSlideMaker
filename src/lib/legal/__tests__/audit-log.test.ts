// Phase 79 (LEGAL-02, Plan 01): contract tests for audit-log helpers.
//
// These two helpers are the only sanctioned way for server code to interact
// with the `style_reference_uploads` audit table. Plan 79-02's clickwrap
// modal + server action import them directly. The contract pinned here
// mirrors the Phase 73 style-spec-cache stance: NEVER throw — log + return
// `{ ok: false, error }` on insert failure (recordStyleFromReferenceTosAcceptance)
// or `false` on lookup failure (hasUserAcceptedCurrentTos). Failure should
// surface as "user has to re-accept" (false) — never as a 500 that blocks
// the upload pipeline.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  recordStyleFromReferenceTosAcceptance,
  hasUserAcceptedCurrentTos,
} from '@/lib/legal/audit-log'

type MockedAdmin = {
  admin: SupabaseClient
  fromMock: ReturnType<typeof vi.fn>
  insertMock: ReturnType<typeof vi.fn>
  selectMock: ReturnType<typeof vi.fn>
  selectEqUserMock: ReturnType<typeof vi.fn>
  selectEqVersionMock: ReturnType<typeof vi.fn>
  limitMock: ReturnType<typeof vi.fn>
}

function buildAdmin(opts?: {
  insertResult?: { error: unknown }
  insertThrows?: boolean
  selectResult?: { data: unknown[] | null; error: unknown }
  selectThrows?: boolean
}): MockedAdmin {
  const insertResult = opts?.insertResult ?? { error: null }
  const selectResult = opts?.selectResult ?? { data: [], error: null }

  const insertMock = vi.fn(() =>
    opts?.insertThrows
      ? Promise.reject(new Error('insert boom'))
      : Promise.resolve(insertResult),
  )

  const limitMock = vi.fn(() =>
    opts?.selectThrows
      ? Promise.reject(new Error('select boom'))
      : Promise.resolve(selectResult),
  )
  const selectEqVersionMock = vi.fn(() => ({ limit: limitMock }))
  const selectEqUserMock = vi.fn(() => ({ eq: selectEqVersionMock }))
  const selectMock = vi.fn(() => ({ eq: selectEqUserMock }))

  const fromMock = vi.fn(() => ({
    insert: insertMock,
    select: selectMock,
  }))

  const admin = { from: fromMock } as unknown as SupabaseClient
  return {
    admin,
    fromMock,
    insertMock,
    selectMock,
    selectEqUserMock,
    selectEqVersionMock,
    limitMock,
  }
}

describe('audit-log', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('recordStyleFromReferenceTosAcceptance', () => {
    it('inserts one row per sha256 against style_reference_uploads', async () => {
      const m = buildAdmin()
      const userId = '00000000-0000-0000-0000-000000000001'
      const sha256s = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]
      const tosVersion = '2026-05-10-v1'

      const result = await recordStyleFromReferenceTosAcceptance(m.admin, {
        userId,
        sha256s,
        tosVersion,
      })

      expect(result).toEqual({ ok: true })
      expect(m.fromMock).toHaveBeenCalledWith('style_reference_uploads')
      expect(m.insertMock).toHaveBeenCalledTimes(1)
      const payload = m.insertMock.mock.calls[0][0] as Array<Record<string, unknown>>
      expect(Array.isArray(payload)).toBe(true)
      expect(payload).toHaveLength(3)
      payload.forEach((row, i) => {
        expect(row).toEqual({
          user_id: userId,
          sha256: sha256s[i],
          tos_version: tosVersion,
        })
      })
    })

    it('returns { ok: true } on empty sha256s without calling insert (no-op)', async () => {
      const m = buildAdmin()
      const result = await recordStyleFromReferenceTosAcceptance(m.admin, {
        userId: '00000000-0000-0000-0000-000000000001',
        sha256s: [],
        tosVersion: '2026-05-10-v1',
      })
      expect(result).toEqual({ ok: true })
      expect(m.insertMock).not.toHaveBeenCalled()
    })

    it('returns { ok: false, error } when insert returns an error payload (does NOT throw)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const err = { message: 'unique violation' }
      const m = buildAdmin({ insertResult: { error: err } })
      const result = await recordStyleFromReferenceTosAcceptance(m.admin, {
        userId: '00000000-0000-0000-0000-000000000001',
        sha256s: ['a'.repeat(64)],
        tosVersion: '2026-05-10-v1',
      })
      expect(result.ok).toBe(false)
      expect(result.error).toBe(err)
      expect(warnSpy).toHaveBeenCalled()
    })

    it('returns { ok: false, error } when insert rejects (does NOT throw)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const m = buildAdmin({ insertThrows: true })
      const result = await recordStyleFromReferenceTosAcceptance(m.admin, {
        userId: '00000000-0000-0000-0000-000000000001',
        sha256s: ['a'.repeat(64)],
        tosVersion: '2026-05-10-v1',
      })
      expect(result.ok).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('hasUserAcceptedCurrentTos', () => {
    it('returns true when at least one row matches (user_id, tos_version)', async () => {
      const m = buildAdmin({
        selectResult: { data: [{ id: 'whatever' }], error: null },
      })
      const result = await hasUserAcceptedCurrentTos(
        m.admin,
        '00000000-0000-0000-0000-000000000001',
        '2026-05-10-v1',
      )
      expect(result).toBe(true)
      expect(m.fromMock).toHaveBeenCalledWith('style_reference_uploads')
      expect(m.selectMock).toHaveBeenCalledWith('id')
      expect(m.selectEqUserMock).toHaveBeenCalledWith(
        'user_id',
        '00000000-0000-0000-0000-000000000001',
      )
      expect(m.selectEqVersionMock).toHaveBeenCalledWith('tos_version', '2026-05-10-v1')
      expect(m.limitMock).toHaveBeenCalledWith(1)
    })

    it('returns false when zero rows match', async () => {
      const m = buildAdmin({ selectResult: { data: [], error: null } })
      const result = await hasUserAcceptedCurrentTos(
        m.admin,
        '00000000-0000-0000-0000-000000000001',
        '2026-05-10-v1',
      )
      expect(result).toBe(false)
    })

    it('returns false on select error payload (graceful — forces re-acceptance)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const m = buildAdmin({
        selectResult: { data: null, error: { message: 'pg down' } },
      })
      const result = await hasUserAcceptedCurrentTos(
        m.admin,
        '00000000-0000-0000-0000-000000000001',
        '2026-05-10-v1',
      )
      expect(result).toBe(false)
      expect(warnSpy).toHaveBeenCalled()
    })

    it('returns false when select rejects (does NOT throw — safe-default to re-accept)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const m = buildAdmin({ selectThrows: true })
      const result = await hasUserAcceptedCurrentTos(
        m.admin,
        '00000000-0000-0000-0000-000000000001',
        '2026-05-10-v1',
      )
      expect(result).toBe(false)
      expect(warnSpy).toHaveBeenCalled()
    })
  })
})

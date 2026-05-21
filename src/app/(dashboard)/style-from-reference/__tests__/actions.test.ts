// Phase 76 Plan 01 (PREVIEW-01):
// Server-Action wrapper tests. Mocks Phase 75's extractStyleSpec entirely —
// NEVER calls the real Gemini surface. Asserts:
//   - auth gate fires before any Storage / Gemini work
//   - Storage path → Buffer fetch is the wrapper's responsibility
//   - tier mapping (`free` | `plus` | `pro`) → Phase 75's narrow `'free' | 'paid'`
//   - the discriminated-union ExtractResult is returned UNCHANGED so the
//     client can route per error tag (PREVIEW-12 recovery surface depends
//     on this pass-through contract)
//   - regenerateAction returns the documented Phase 77 placeholder
//   - the firewall is preserved: actions.ts does NOT import @google/genai

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ---- Hoisted mocks ----
const {
  mockGetUser,
  mockStorageDownload,
  mockGetUserTier,
  mockExtractStyleSpec,
  mockGenerateCarouselFromReferences,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockStorageDownload: vi.fn(),
  mockGetUserTier: vi.fn(),
  mockExtractStyleSpec: vi.fn(),
  mockGenerateCarouselFromReferences: vi.fn(),
}))

vi.mock('@/lib/services/carousel', () => ({
  generateCarouselFromReferences: mockGenerateCarouselFromReferences,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({ download: mockStorageDownload }),
    },
  }),
}))

vi.mock('@/lib/credits/check-credits', () => ({
  getUserTier: mockGetUserTier,
}))

vi.mock('@/lib/ai/extract-style-spec', () => ({
  extractStyleSpec: mockExtractStyleSpec,
}))

// Import AFTER mocks
import {
  extractStyleSpecAction,
  regenerateAction,
} from '../actions'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

function makeRow(name = 'a.png'): ReferenceAssetRow {
  return {
    url: `user_x/${name}`,
    sha256: '',
    uploaded_at: '2026-05-10T00:00:00.000Z',
    mime_type: 'image/png',
    size_bytes: 1024,
    original_filename: name,
  }
}

function makeBlobFromBytes(bytes: Buffer) {
  return {
    arrayBuffer: vi.fn().mockResolvedValue(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
  }
}

beforeEach(() => {
  // Reset only the per-call queues — clearAllMocks preserves mockReturnValue
  // (createClient + createAdminClient) but does NOT clear queued
  // .mockResolvedValueOnce; we drain those individually so prior tests can't
  // bleed unconsumed queued returns into the next test (Test 5 regression).
  vi.clearAllMocks()
  mockGetUser.mockReset()
  mockStorageDownload.mockReset()
  mockGetUserTier.mockReset()
  mockExtractStyleSpec.mockReset()
  mockGenerateCarouselFromReferences.mockReset()
})

describe('Phase 76 Plan 01: extractStyleSpecAction — auth + storage + tier mapping', () => {
  it('Test 1: no authenticated user → extraction_failed:unauthenticated, no extractStyleSpec call', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const result = await extractStyleSpecAction({
      projectId: 'proj-1',
      references: [makeRow()],
    })

    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'extraction_failed') {
      expect(result.detail).toBe('unauthenticated')
    } else {
      throw new Error('Expected extraction_failed:unauthenticated')
    }
    expect(mockExtractStyleSpec).not.toHaveBeenCalled()
    expect(mockStorageDownload).not.toHaveBeenCalled()
  })

  it('Test 2: empty references[] → extraction_failed:no-references, no Storage / Gemini call', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })

    const result = await extractStyleSpecAction({
      projectId: 'proj-1',
      references: [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'extraction_failed') {
      expect(result.detail).toBe('no-references')
    } else {
      throw new Error('Expected extraction_failed:no-references')
    }
    expect(mockStorageDownload).not.toHaveBeenCalled()
    expect(mockExtractStyleSpec).not.toHaveBeenCalled()
  })

  it('Test 3: Storage download throws → extraction_failed:storage-fetch-failed:<msg>, no Gemini call', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload.mockRejectedValueOnce(new Error('boom'))

    const result = await extractStyleSpecAction({
      projectId: 'proj-1',
      references: [makeRow()],
    })

    expect(result.ok).toBe(false)
    if (!result.ok && result.error === 'extraction_failed') {
      expect(result.detail).toContain('storage-fetch-failed')
      expect(result.detail).toContain('boom')
    } else {
      throw new Error('Expected extraction_failed:storage-fetch-failed:*')
    }
    expect(mockExtractStyleSpec).not.toHaveBeenCalled()
  })

  it('Test 4: happy path — pass-through ExtractSuccess unchanged', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload
      .mockResolvedValueOnce({ data: makeBlobFromBytes(Buffer.from('img-1')), error: null })
      .mockResolvedValueOnce({ data: makeBlobFromBytes(Buffer.from('img-2')), error: null })

    const successResult = {
      ok: true as const,
      spec: {
        schema_version: 2,
        slideArchetype: 'full-bleed-text-overlay',
        palette: { mode: 'solid', primary: '#A8E0B0' },
        typography: {},
        layout: {},
        imagery: {},
        decorations: {},
        rhythm: {},
      },
      cached: false,
      telemetry: {
        vision_calls_count: 1,
        tokens_in: 100,
        tokens_out: 50,
        cache_hit: false,
        duration_ms: 1234,
      },
    }
    mockExtractStyleSpec.mockResolvedValueOnce(successResult)

    const result = await extractStyleSpecAction({
      projectId: 'proj-1',
      references: [makeRow('a.png'), makeRow('b.png')],
    })

    // Pass-through: returned object IS the ExtractResult Phase 75 produced.
    expect(result).toEqual(successResult)
    expect(mockExtractStyleSpec).toHaveBeenCalledTimes(1)
    const callArg = mockExtractStyleSpec.mock.calls[0][0] as {
      projectId: string
      userId: string
      tier: string
      referenceBytes: Buffer[]
      admin: unknown
    }
    expect(callArg.projectId).toBe('proj-1')
    expect(callArg.userId).toBe('u1')
    expect(callArg.referenceBytes).toHaveLength(2)
    expect(Buffer.isBuffer(callArg.referenceBytes[0])).toBe(true)
    expect(callArg.referenceBytes[0].toString()).toBe('img-1')
    expect(callArg.referenceBytes[1].toString()).toBe('img-2')
    expect(callArg.admin).toBeDefined()
  })

  it('Test 5: tier mapping — free→free, plus→paid, pro→paid', async () => {
    const successResult = {
      ok: true as const,
      spec: {} as never,
      cached: false,
      telemetry: { vision_calls_count: 0, tokens_in: 0, tokens_out: 0, cache_hit: false, duration_ms: 1 },
    }

    // free
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload.mockResolvedValueOnce({ data: makeBlobFromBytes(Buffer.from('a')), error: null })
    mockExtractStyleSpec.mockResolvedValueOnce(successResult)
    await extractStyleSpecAction({ projectId: 'p', references: [makeRow()] })
    expect((mockExtractStyleSpec.mock.calls[0][0] as { tier: string }).tier).toBe('free')

    // plus
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u2' } } })
    mockGetUserTier.mockResolvedValueOnce('plus')
    mockStorageDownload.mockResolvedValueOnce({ data: makeBlobFromBytes(Buffer.from('a')), error: null })
    mockExtractStyleSpec.mockResolvedValueOnce(successResult)
    await extractStyleSpecAction({ projectId: 'p', references: [makeRow()] })
    expect((mockExtractStyleSpec.mock.calls[1][0] as { tier: string }).tier).toBe('paid')

    // pro
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u3' } } })
    mockGetUserTier.mockResolvedValueOnce('pro')
    mockStorageDownload.mockResolvedValueOnce({ data: makeBlobFromBytes(Buffer.from('a')), error: null })
    mockExtractStyleSpec.mockResolvedValueOnce(successResult)
    await extractStyleSpecAction({ projectId: 'p', references: [makeRow()] })
    expect((mockExtractStyleSpec.mock.calls[2][0] as { tier: string }).tier).toBe('paid')
  })

  it('Test 6: error pass-through — safety_blocked propagates UNCHANGED', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload.mockResolvedValueOnce({ data: makeBlobFromBytes(Buffer.from('a')), error: null })

    const blocked = {
      ok: false as const,
      error: 'safety_blocked' as const,
      detail: { whatever: 1 },
      reason: 'IMAGE_SAFETY',
      recovery_suggestion: 'Try cropping high-skin areas, try a different image, or describe the style in text instead.',
      telemetry: { vision_calls_count: 1, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1 },
    }
    mockExtractStyleSpec.mockResolvedValueOnce(blocked)

    const result = await extractStyleSpecAction({
      projectId: 'p',
      references: [makeRow()],
    })

    expect(result).toEqual(blocked)
  })

  it("Test 8: 'use server' directive is the first non-empty, non-comment line of actions.ts", () => {
    const filePath = path.resolve(__dirname, '../actions.ts')
    const src = fs.readFileSync(filePath, 'utf-8')
    const lines = src.split('\n')
    let firstCode = ''
    let inBlockComment = false
    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue
      if (inBlockComment) {
        if (line.endsWith('*/')) inBlockComment = false
        continue
      }
      if (line.startsWith('/*')) {
        if (!line.endsWith('*/')) inBlockComment = true
        continue
      }
      if (line.startsWith('//')) continue
      firstCode = line
      break
    }
    // Strip trailing semicolon for stable matching
    expect(firstCode.replace(/;$/, '')).toBe("'use server'")

    // Firewall: actions.ts MUST NOT import @google/genai. Phase 75 owns the
    // Gemini surface; this Server Action only composes it.
    const hits = (src.match(/@google\/genai/g) ?? []).length
    expect(hits).toBe(0)
  })
})

describe('Phase 77 Plan 02 Task 4: regenerateAction (EMIT-02 + EDITOR-01)', () => {
  function makeSpec(): import('@/lib/types/style-spec').StyleSpec {
    return {
      schema_version: 2,
      slideArchetype: 'full-bleed-text-overlay',
      palette: { mode: 'solid', primary: '#A8E0B0' },
      typography: {},
      layout: {},
      imagery: {},
      decorations: {},
      rhythm: {},
    }
  }

  function makeInput(overrides?: Partial<Parameters<typeof regenerateAction>[0]>): Parameters<typeof regenerateAction>[0] {
    return {
      projectId: 'project-1',
      spec: makeSpec(),
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      content: { mode: 'ai-copy', topic: 'urban gardening' },
      ...overrides,
    }
  }

  it('Test 1 (R): no authenticated user → unauthenticated error', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await regenerateAction(makeInput())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('unauthenticated')
    expect(mockGenerateCarouselFromReferences).not.toHaveBeenCalled()
  })

  it('Test 2 (R): null spec → no_spec error, no orchestrator call', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    const input = makeInput()
    // Force null spec — bypass type via cast for this validation test
    ;(input as unknown as { spec: null }).spec = null
    const result = await regenerateAction(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('no_spec')
    expect(mockGenerateCarouselFromReferences).not.toHaveBeenCalled()
  })

  it('Test 3 (R): ai-copy mode without topic → invalid_input', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    const input = makeInput({ content: { mode: 'ai-copy', topic: '' } })
    const result = await regenerateAction(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_input')
  })

  it('Test 4 (R): user-copy mode with empty lines[] → invalid_input', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    const input = makeInput({ content: { mode: 'user-copy', lines: [] } })
    const result = await regenerateAction(input)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_input')
  })

  it('Test 5 (R): happy path returns { ok: true, projectId, slideCount }', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockGenerateCarouselFromReferences.mockResolvedValueOnce({
      projectId: 'project-1',
      slideCount: 5,
    })
    const result = await regenerateAction(makeInput())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.projectId).toBe('project-1')
      expect(result.slideCount).toBe(5)
    }
    expect(mockGenerateCarouselFromReferences).toHaveBeenCalledTimes(1)
  })

  it('Test 6 (R): orchestrator throw → gemini_error with detail', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockGenerateCarouselFromReferences.mockRejectedValueOnce(new Error('emit.carousel-shape-failed'))
    const result = await regenerateAction(makeInput())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('gemini_error')
      expect(result.detail).toContain('carousel-shape-failed')
    }
  })

  it('Test 7 (R): orchestrator called with userId from auth + full input passthrough', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-xyz' } } })
    mockGenerateCarouselFromReferences.mockResolvedValueOnce({
      projectId: 'project-1',
      slideCount: 3,
    })
    const input = makeInput()
    await regenerateAction(input)
    const [client, userId, orchestratorInput] = mockGenerateCarouselFromReferences.mock.calls[0]
    expect(userId).toBe('user-xyz')
    expect(client).toBeDefined()
    expect((orchestratorInput as { projectId: string }).projectId).toBe('project-1')
  })

  it('Test 8 (R): result is discriminated union — no Gemini SDK objects leak', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockGenerateCarouselFromReferences.mockResolvedValueOnce({
      projectId: 'p',
      slideCount: 1,
    })
    const result = await regenerateAction(makeInput())
    // Result has ONLY ok/projectId/slideCount keys (no leaked SDK fields)
    if (result.ok) {
      const keys = Object.keys(result).sort()
      expect(keys).toEqual(['ok', 'projectId', 'slideCount'])
    }
  })

  it('Test 9 (R): EDITOR-01 BY-CONSTRUCTION — actions.ts comment cites EDITOR-01 + routing', () => {
    const filePath = path.resolve(__dirname, '../actions.ts')
    const src = fs.readFileSync(filePath, 'utf-8')
    expect(src).toMatch(/EDITOR-01/)
    // Should reference /project/{id} or similar routing comment
    expect(src).toMatch(/project\/.*\$\{|project\/\{id\}|project\/.*id/i)
  })
})

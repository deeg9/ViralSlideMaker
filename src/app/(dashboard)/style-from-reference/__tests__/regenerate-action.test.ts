// Phase 78 Plan 02 Task 1 (REMIX-05):
// regenerateFromReferencesAction — composes Phase 75 extractStyleSpec +
// Phase 77 generateCarouselFromReferences against an existing project's
// inherited references and persists the result as a NEW (sibling) project.
//
// Locked invariants:
//   - Auth gate fires before any Storage / Gemini / orchestrator work
//   - Source project's reference_assets MUST be non-null AND non-empty
//   - Action NEVER mutates the source project (sibling-create invariant)
//   - Returns { ok: true, projectId } on success — client navigates to the
//     new project via existing router.push pattern
//   - Error paths: { error: 'unauthenticated' | 'source_not_found' |
//     'no_references' | 'extract_failed' | 'emit_failed' }
//   - extractStyleSpec + generateCarouselFromReferences are MOCKED here —
//     this test never touches Gemini

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Hoisted mocks ----
const {
  mockGetUser,
  mockFromProjects,
  mockProjectsSelect,
  mockProjectsInsert,
  mockProjectsUpdate,
  mockProjectsEq,
  mockProjectsSingle,
  mockProjectsInsertSelect,
  mockProjectsInsertSingle,
  mockProjectsUpdateEq1,
  mockProjectsUpdateEq2,
  mockStorageDownload,
  mockGetUserTier,
  mockExtractStyleSpec,
  mockGenerateCarouselFromReferences,
  mockCreateProjectService,
} = vi.hoisted(() => {
  const projectsSingle = vi.fn()
  const projectsInsertSingle = vi.fn()
  const projectsInsertSelect = vi.fn().mockImplementation(() => ({ single: projectsInsertSingle }))
  const projectsInsert = vi.fn().mockImplementation(() => ({ select: projectsInsertSelect }))
  const projectsUpdateEq2 = vi.fn().mockResolvedValue({ data: null, error: null })
  const projectsUpdateEq1 = vi.fn().mockImplementation(() => ({ eq: projectsUpdateEq2 }))
  const projectsUpdate = vi.fn().mockImplementation(() => ({ eq: projectsUpdateEq1 }))
  const projectsEq = vi.fn().mockImplementation(() => ({ single: projectsSingle, maybeSingle: projectsSingle }))
  const projectsSelect = vi.fn().mockImplementation(() => ({ eq: projectsEq }))
  const fromProjects = vi.fn().mockImplementation(() => ({
    select: projectsSelect,
    insert: projectsInsert,
    update: projectsUpdate,
  }))
  return {
    mockGetUser: vi.fn(),
    mockFromProjects: fromProjects,
    mockProjectsSelect: projectsSelect,
    mockProjectsInsert: projectsInsert,
    mockProjectsUpdate: projectsUpdate,
    mockProjectsEq: projectsEq,
    mockProjectsSingle: projectsSingle,
    mockProjectsInsertSelect: projectsInsertSelect,
    mockProjectsInsertSingle: projectsInsertSingle,
    mockProjectsUpdateEq1: projectsUpdateEq1,
    mockProjectsUpdateEq2: projectsUpdateEq2,
    mockStorageDownload: vi.fn(),
    mockGetUserTier: vi.fn(),
    mockExtractStyleSpec: vi.fn(),
    mockGenerateCarouselFromReferences: vi.fn(),
    mockCreateProjectService: vi.fn(),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
    from: mockFromProjects,
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({ download: mockStorageDownload }),
    },
    from: mockFromProjects,
  }),
}))

vi.mock('@/lib/credits/check-credits', () => ({
  getUserTier: mockGetUserTier,
}))

vi.mock('@/lib/ai/extract-style-spec', () => ({
  extractStyleSpec: mockExtractStyleSpec,
}))

vi.mock('@/lib/services/carousel', () => ({
  generateCarouselFromReferences: mockGenerateCarouselFromReferences,
}))

vi.mock('@/lib/services/projects', () => ({
  createProjectService: mockCreateProjectService,
}))

// Import AFTER mocks
import { regenerateFromReferencesAction } from '../actions'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'
import type { StyleSpec } from '@/lib/types/style-spec'

function makeReferenceRow(name = 'a.png'): ReferenceAssetRow {
  return {
    url: `user_x/${name}`,
    sha256: `sha-${name}`,
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

function makeSpec(): StyleSpec {
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#A8E0B0' },
    typography: {},
    layout: {},
    imagery: {},
    decorations: {},
    rhythm: {},
  } as StyleSpec
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetUser.mockReset()
  mockProjectsSingle.mockReset()
  mockProjectsInsertSingle.mockReset()
  mockStorageDownload.mockReset()
  mockGetUserTier.mockReset()
  mockExtractStyleSpec.mockReset()
  mockGenerateCarouselFromReferences.mockReset()
  mockCreateProjectService.mockReset()
})

describe('Phase 78 Plan 02 Task 1: regenerateFromReferencesAction (REMIX-05)', () => {
  it('Test 1: no authenticated user → unauthenticated error; no Storage / orchestrator call', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const result = await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('unauthenticated')
    expect(mockStorageDownload).not.toHaveBeenCalled()
    expect(mockExtractStyleSpec).not.toHaveBeenCalled()
    expect(mockGenerateCarouselFromReferences).not.toHaveBeenCalled()
    expect(mockCreateProjectService).not.toHaveBeenCalled()
  })

  it('Test 2: source project not found → source_not_found error', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    // Source project lookup returns no row.
    mockProjectsSingle.mockResolvedValueOnce({ data: null, error: null })

    const result = await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('source_not_found')
    expect(mockStorageDownload).not.toHaveBeenCalled()
    expect(mockExtractStyleSpec).not.toHaveBeenCalled()
    expect(mockGenerateCarouselFromReferences).not.toHaveBeenCalled()
  })

  it('Test 3: source project has null reference_assets → no_references error', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: {
        id: 'src-1',
        user_id: 'u1',
        reference_assets: null,
        topic: 'whatever',
        title: 'Whatever',
      },
      error: null,
    })

    const result = await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('no_references')
    expect(mockStorageDownload).not.toHaveBeenCalled()
    expect(mockExtractStyleSpec).not.toHaveBeenCalled()
    expect(mockGenerateCarouselFromReferences).not.toHaveBeenCalled()
  })

  it('Test 4: source project has empty reference_assets [] → no_references error', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: {
        id: 'src-1',
        user_id: 'u1',
        reference_assets: [],
        topic: 'whatever',
        title: 'Whatever',
      },
      error: null,
    })

    const result = await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('no_references')
    expect(mockStorageDownload).not.toHaveBeenCalled()
  })

  it('Test 5: happy path — creates NEW project, calls extract, calls emit, returns new projectId', async () => {
    const refs = [makeReferenceRow('a.png'), makeReferenceRow('b.png')]
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: {
        id: 'src-1',
        user_id: 'u1',
        reference_assets: refs,
        topic: 'urban gardening',
        title: 'Urban Gardening',
      },
      error: null,
    })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload
      .mockResolvedValueOnce({ data: makeBlobFromBytes(Buffer.from('img-1')), error: null })
      .mockResolvedValueOnce({ data: makeBlobFromBytes(Buffer.from('img-2')), error: null })

    // createProjectService creates the NEW (sibling) project row
    mockCreateProjectService.mockResolvedValueOnce({ id: 'new-proj-1' })

    // extractStyleSpec returns ok with a spec
    mockExtractStyleSpec.mockResolvedValueOnce({
      ok: true,
      spec: makeSpec(),
      cached: false,
      telemetry: { vision_calls_count: 2, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1234 },
    })

    // generateCarouselFromReferences returns the same projectId we passed in
    mockGenerateCarouselFromReferences.mockResolvedValueOnce({
      projectId: 'new-proj-1',
      slideCount: 5,
    })

    const result = await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.projectId).toBe('new-proj-1')
    // Sibling-create invariant: createProjectService called exactly once
    expect(mockCreateProjectService).toHaveBeenCalledTimes(1)
    // extract + emit each called exactly once
    expect(mockExtractStyleSpec).toHaveBeenCalledTimes(1)
    expect(mockGenerateCarouselFromReferences).toHaveBeenCalledTimes(1)
  })

  it('Test 6: extract failure → extract_failed error; emit NOT called', async () => {
    const refs = [makeReferenceRow('a.png')]
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: { id: 'src-1', user_id: 'u1', reference_assets: refs, topic: 't', title: 'T' },
      error: null,
    })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload.mockResolvedValueOnce({
      data: makeBlobFromBytes(Buffer.from('img-1')),
      error: null,
    })
    mockCreateProjectService.mockResolvedValueOnce({ id: 'new-proj-1' })
    mockExtractStyleSpec.mockResolvedValueOnce({
      ok: false,
      error: 'extraction_failed',
      detail: 'gemini_5xx',
      telemetry: { vision_calls_count: 0, tokens_in: 0, tokens_out: 0, cache_hit: false, duration_ms: 1 },
    })

    const result = await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('extract_failed')
    expect(mockGenerateCarouselFromReferences).not.toHaveBeenCalled()
  })

  it('Test 7: emit failure → emit_failed error', async () => {
    const refs = [makeReferenceRow('a.png')]
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: { id: 'src-1', user_id: 'u1', reference_assets: refs, topic: 't', title: 'T' },
      error: null,
    })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload.mockResolvedValueOnce({
      data: makeBlobFromBytes(Buffer.from('img-1')),
      error: null,
    })
    mockCreateProjectService.mockResolvedValueOnce({ id: 'new-proj-1' })
    mockExtractStyleSpec.mockResolvedValueOnce({
      ok: true,
      spec: makeSpec(),
      cached: false,
      telemetry: { vision_calls_count: 2, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1 },
    })
    mockGenerateCarouselFromReferences.mockRejectedValueOnce(new Error('emit blew up'))

    const result = await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('emit_failed')
      expect(result.detail).toContain('emit blew up')
    }
  })

  it('Test 8: sibling-create invariant — source project never receives an UPDATE call', async () => {
    const refs = [makeReferenceRow('a.png')]
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: { id: 'src-1', user_id: 'u1', reference_assets: refs, topic: 't', title: 'T' },
      error: null,
    })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload.mockResolvedValueOnce({
      data: makeBlobFromBytes(Buffer.from('img-1')),
      error: null,
    })
    mockCreateProjectService.mockResolvedValueOnce({ id: 'new-proj-1' })
    mockExtractStyleSpec.mockResolvedValueOnce({
      ok: true,
      spec: makeSpec(),
      cached: false,
      telemetry: { vision_calls_count: 2, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1 },
    })
    mockGenerateCarouselFromReferences.mockResolvedValueOnce({
      projectId: 'new-proj-1',
      slideCount: 3,
    })

    await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    // Inspect every call to createProjectService — second positional arg is
    // userId; third is { title, topic, ... }. The action MUST pass a NEW
    // project (no projectId === 'src-1' anywhere in createProjectService args).
    for (const call of mockCreateProjectService.mock.calls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = call[2] as Record<string, any>
      expect(input).not.toHaveProperty('id', 'src-1')
    }

    // generateCarouselFromReferences is called with the NEW projectId, not src-1.
    const orchestratorCall = mockGenerateCarouselFromReferences.mock.calls[0]
    const orchestratorInput = orchestratorCall[2] as { projectId: string }
    expect(orchestratorInput.projectId).toBe('new-proj-1')
    expect(orchestratorInput.projectId).not.toBe('src-1')
  })

  it('Test 9: orchestrator receives NEW userId from auth + spec from extract', async () => {
    const refs = [makeReferenceRow('a.png')]
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-xyz' } } })
    mockProjectsSingle.mockResolvedValueOnce({
      data: { id: 'src-1', user_id: 'orig-owner', reference_assets: refs, topic: 'gardening', title: 'Gardening' },
      error: null,
    })
    mockGetUserTier.mockResolvedValueOnce('free')
    mockStorageDownload.mockResolvedValueOnce({
      data: makeBlobFromBytes(Buffer.from('img-1')),
      error: null,
    })
    mockCreateProjectService.mockResolvedValueOnce({ id: 'new-proj-2' })
    const spec = makeSpec()
    mockExtractStyleSpec.mockResolvedValueOnce({
      ok: true,
      spec,
      cached: false,
      telemetry: { vision_calls_count: 2, tokens_in: 100, tokens_out: 50, cache_hit: false, duration_ms: 1 },
    })
    mockGenerateCarouselFromReferences.mockResolvedValueOnce({
      projectId: 'new-proj-2',
      slideCount: 4,
    })

    await regenerateFromReferencesAction({ sourceProjectId: 'src-1' })

    const [, userId, orchInput] = mockGenerateCarouselFromReferences.mock.calls[0]
    expect(userId).toBe('user-xyz') // CALLER, not original owner
    expect((orchInput as { spec: StyleSpec }).spec).toBe(spec)
  })
})

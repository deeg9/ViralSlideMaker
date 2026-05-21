// Phase 77 Plan 02 Task 4 (EMIT-02): generateCarouselFromReferences
// orchestrator tests. Mocks generateFromStyleSpec + Plan 01 helpers
// entirely — never hits the real Gemini surface or Supabase remote.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pexels client crashes at module load if PEXELS_API_KEY is missing —
// generateCarousel (sibling) imports searchPhotos transitively. Mock
// the module BEFORE the import. Phase 77 generateCarouselFromReferences
// itself never calls searchPhotos, but the carousel.ts module load chain
// needs to succeed.
vi.mock('pexels', () => ({
  createClient: () => ({
    photos: { search: vi.fn().mockResolvedValue({ photos: [] }) },
  }),
}))

const {
  mockGenerateFromStyleSpec,
  mockApplyAspectFilter,
  mockAutoPublishOnGenerate,
} = vi.hoisted(() => ({
  mockGenerateFromStyleSpec: vi.fn(),
  mockApplyAspectFilter: vi.fn(),
  mockAutoPublishOnGenerate: vi.fn(),
}))

vi.mock('@/lib/ai/generate-from-style-spec', () => ({
  generateFromStyleSpec: mockGenerateFromStyleSpec,
}))

vi.mock('@/lib/ai/style-spec-aspect-filter', () => ({
  applyAspectFilter: mockApplyAspectFilter,
}))

// quick-260515-dwu: spy on the public-by-default helper so the regression
// test can assert one-call-per-generation. The real helper would otherwise
// try to talk to Supabase (failure tolerated via console.warn) — mocking
// also keeps the test surface clean.
vi.mock('@/lib/services/auto-publish-on-generate', () => ({
  autoPublishOnGenerate: mockAutoPublishOnGenerate,
}))

// Import AFTER mocks
import { generateCarouselFromReferences } from '../carousel'
import * as carouselModule from '../carousel'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { ContentSource } from '@/lib/ai/generate-from-style-spec.types'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

function makeSpec(overrides?: Partial<StyleSpec>): StyleSpec {
  // Cast: Partial<StyleSpec> over a discriminated union (StyleSpec is intersected
  // with ArchetypeSlots in Phase 80) cannot be spread back into the union without
  // collapsing the discriminator. Spec contract is concrete here:
  // slideArchetype='full-bleed-text-overlay' (EmptySlots variant).
  return {
    schema_version: 2,
    slideArchetype: 'full-bleed-text-overlay',
    palette: { mode: 'solid', primary: '#A8E0B0' },
    typography: {},
    layout: {},
    imagery: {},
    decorations: {},
    rhythm: {},
    ...overrides,
  } as StyleSpec
}

function makeSupabase(updateError: { message: string } | null = null) {
  const updateMock = vi.fn().mockReturnThis()
  const eqMock = vi.fn()
  // For chained .eq() calls, return resolved promise on the LAST .eq().
  // We chain: .update().eq('id').eq('user_id') — so the eq mock needs to
  // return { eq: () => Promise<{error}> } on first call, { error } on second.
  eqMock
    .mockReturnValueOnce({ eq: vi.fn().mockResolvedValueOnce({ error: updateError }) })
  const fromMock = vi.fn().mockReturnValue({
    update: updateMock.mockReturnValue({ eq: eqMock }),
  })
  return {
    client: { from: fromMock } as unknown as Parameters<typeof generateCarouselFromReferences>[0],
    fromMock,
    updateMock,
    eqMock,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateFromStyleSpec.mockReset()
  mockApplyAspectFilter.mockReset()
  mockAutoPublishOnGenerate.mockReset()
  // Default: the helper resolves cleanly. Individual tests can override.
  mockAutoPublishOnGenerate.mockResolvedValue(undefined)
})

function makeRefRow(overrides: Partial<ReferenceAssetRow> = {}): ReferenceAssetRow {
  return {
    url: 'user-1/ref-a.png',
    sha256: 'abc123',
    uploaded_at: '2026-05-15T00:00:00.000Z',
    mime_type: 'image/png',
    size_bytes: 1024,
    original_filename: 'ref-a.png',
    ...overrides,
  }
}

describe('Phase 77 Plan 02 Task 4: generateCarouselFromReferences orchestrator', () => {
  it('Test 1: call order — applyAspectFilter THEN generateFromStyleSpec, with the filtered spec', async () => {
    const spec = makeSpec({ palette: { mode: 'solid', primary: '#111111' } })
    const filtered = makeSpec({ palette: { mode: 'solid', primary: '#222222' } })

    mockApplyAspectFilter.mockReturnValueOnce(filtered)
    mockGenerateFromStyleSpec.mockResolvedValueOnce({
      title: 'T',
      slides: [{ hook_text: 'H', body_text: 'B', image_query: 'q', is_cta: false, role: 'cover', text_boxes: [] }],
    })

    const sb = makeSupabase()
    const content: ContentSource = { mode: 'ai-copy', topic: 'X' }
    await generateCarouselFromReferences(sb.client, 'user-1', {
      projectId: 'p-1',
      spec,
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      content,
    })

    // applyAspectFilter called first with the input spec
    expect(mockApplyAspectFilter).toHaveBeenCalledTimes(1)
    expect(mockApplyAspectFilter.mock.calls[0][0]).toBe(spec)
    // generateFromStyleSpec called with the filtered spec (no brand-kit merge step)
    expect(mockGenerateFromStyleSpec).toHaveBeenCalledTimes(1)
    expect(mockGenerateFromStyleSpec.mock.calls[0][0]).toBe(filtered)

    // Order check via invocation order
    const aspectOrder = mockApplyAspectFilter.mock.invocationCallOrder[0]
    const emitOrder = mockGenerateFromStyleSpec.mock.invocationCallOrder[0]
    expect(aspectOrder).toBeLessThan(emitOrder)
  })

  it('Test 2: persists slides via UPDATE on existing project row (NOT INSERT)', async () => {
    mockApplyAspectFilter.mockImplementation((s: StyleSpec) => s)
    mockGenerateFromStyleSpec.mockResolvedValueOnce({
      title: 'My Carousel',
      slides: [
        { hook_text: 'H1', body_text: 'B1', image_query: 'q', is_cta: false, role: 'cover', text_boxes: [] },
        { hook_text: 'H2', body_text: 'B2', image_query: 'q', is_cta: true, role: 'close', text_boxes: [] },
      ],
    })

    const sb = makeSupabase()
    await generateCarouselFromReferences(sb.client, 'user-1', {
      projectId: 'project-abc',
      spec: makeSpec(),
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      content: { mode: 'ai-copy', topic: 'X' },
    })

    expect(sb.fromMock).toHaveBeenCalledWith('projects')
    // .update() called with slide_data + generation_status complete + title
    expect(sb.updateMock).toHaveBeenCalledTimes(1)
    const updateArg = sb.updateMock.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.slide_data).toBeDefined()
    expect(Array.isArray(updateArg.slide_data)).toBe(true)
    expect((updateArg.slide_data as unknown[]).length).toBe(2)
    expect(updateArg.generation_status).toBe('complete')
    expect(updateArg.title).toBe('My Carousel')
    // Ownership check belt-and-braces: .eq('id', projectId).eq('user_id', userId)
    expect(sb.eqMock).toHaveBeenCalledWith('id', 'project-abc')
  })

  it('Test 3: existing generateCarousel function NOT modified (regression guard via export presence)', () => {
    // Source-grep regression: generateCarousel still exists with same signature.
    expect(typeof carouselModule.generateCarousel).toBe('function')
    expect(typeof carouselModule.generateCarouselFromReferences).toBe('function')
  })

  // Test 4 (former remix-merge bypass test) deleted — Phase 89 (BKSHELVE-08):
  // the merge step is removed entirely; there is no merge call to assert
  // against.

  it('Test 5: persist UPDATE error → throws with descriptive message', async () => {
    mockApplyAspectFilter.mockImplementation((s: StyleSpec) => s)
    mockGenerateFromStyleSpec.mockResolvedValueOnce({
      title: 'T',
      slides: [
        { hook_text: 'H', body_text: 'B', image_query: 'q', is_cta: false, role: 'cover', text_boxes: [] },
      ],
    })

    const sb = makeSupabase({ message: 'rls denied' })
    await expect(
      generateCarouselFromReferences(sb.client, 'user-1', {
        projectId: 'p',
        spec: makeSpec(),
        aspects: { palette: true, typography: true, layout: true, decorations: true },
        content: { mode: 'ai-copy', topic: 'X' },
      }),
    ).rejects.toThrow(/rls denied|persist failed/i)
  })

  // ─── quick-260515-dwu — persist style_spec + reference_assets ──────────
  // The bug-report DB evidence shows projects landing with style_spec=NULL,
  // reference_assets=NULL even after a successful Copy Style generation,
  // because the UPDATE here never wrote those columns. These three tests
  // pin the corrected payload, plus the public-by-default invariant.

  it('Test 6 (quick-260515-dwu): persists style_spec + reference_assets on the project row when references are provided', async () => {
    const inputSpec = makeSpec({ palette: { mode: 'solid', primary: '#ABCDEF' } })
    mockApplyAspectFilter.mockImplementation((s: StyleSpec) => s)
    mockGenerateFromStyleSpec.mockResolvedValueOnce({
      title: 'test-title',
      slides: [
        { hook_text: 'H', body_text: 'B', image_query: 'q', is_cta: false, role: 'cover', text_boxes: [] },
      ],
    })

    const refs: ReferenceAssetRow[] = [
      makeRefRow({ url: 'user-1/a.png', sha256: 'aaa', original_filename: 'a.png' }),
      makeRefRow({ url: 'user-1/b.png', sha256: 'bbb', original_filename: 'b.png' }),
    ]

    const sb = makeSupabase()
    await generateCarouselFromReferences(sb.client, 'user-1', {
      projectId: 'proj-dwu',
      spec: inputSpec,
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      content: { mode: 'ai-copy', topic: 'Topic' },
      imageSource: 'none', // avoid Pexels search path
      references: refs,
    })

    expect(sb.updateMock).toHaveBeenCalledTimes(1)
    const updateArg = sb.updateMock.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg).toEqual(
      expect.objectContaining({
        slide_data: expect.any(Array),
        generation_status: 'complete',
        title: 'test-title',
        style_spec: inputSpec,
        reference_assets: refs,
      }),
    )
  })

  it('Test 7 (quick-260515-dwu): omits reference_assets when input has no references array', async () => {
    const inputSpec = makeSpec()
    mockApplyAspectFilter.mockImplementation((s: StyleSpec) => s)
    mockGenerateFromStyleSpec.mockResolvedValueOnce({
      title: 'no-refs',
      slides: [
        { hook_text: 'H', body_text: 'B', image_query: 'q', is_cta: false, role: 'cover', text_boxes: [] },
      ],
    })

    const sb = makeSupabase()
    await generateCarouselFromReferences(sb.client, 'user-1', {
      projectId: 'proj-no-refs',
      spec: inputSpec,
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      content: { mode: 'ai-copy', topic: 'T' },
      imageSource: 'none',
      // no `references` field
    })

    expect(sb.updateMock).toHaveBeenCalledTimes(1)
    const updateArg = sb.updateMock.mock.calls[0][0] as Record<string, unknown>
    // style_spec MUST always be written
    expect(updateArg.style_spec).toBe(inputSpec)
    // reference_assets MUST be absent — not just `undefined`, structurally absent
    expect(Object.prototype.hasOwnProperty.call(updateArg, 'reference_assets')).toBe(false)
  })

  it('Test 8 (quick-260515-dwu): calls autoPublishOnGenerate exactly once after persistence', async () => {
    mockApplyAspectFilter.mockImplementation((s: StyleSpec) => s)
    mockGenerateFromStyleSpec.mockResolvedValueOnce({
      title: 'pub-test',
      slides: [
        { hook_text: 'H', body_text: 'B', image_query: 'q', is_cta: false, role: 'cover', text_boxes: [] },
      ],
    })

    const sb = makeSupabase()
    await generateCarouselFromReferences(sb.client, 'user-1', {
      projectId: 'proj-pub',
      spec: makeSpec(),
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      content: { mode: 'ai-copy', topic: 'T' },
      imageSource: 'none',
      references: [makeRefRow()],
    })

    // Public-by-default invariant: helper invoked exactly once per generation
    // with (supabase, userId, projectId, title) signature.
    expect(mockAutoPublishOnGenerate).toHaveBeenCalledTimes(1)
    expect(mockAutoPublishOnGenerate).toHaveBeenCalledWith(
      sb.client,
      'user-1',
      'proj-pub',
      'pub-test',
    )
  })
})

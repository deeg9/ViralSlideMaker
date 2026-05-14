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
  mockApplyBrandKitRemix,
} = vi.hoisted(() => ({
  mockGenerateFromStyleSpec: vi.fn(),
  mockApplyAspectFilter: vi.fn(),
  mockApplyBrandKitRemix: vi.fn(),
}))

vi.mock('@/lib/ai/generate-from-style-spec', () => ({
  generateFromStyleSpec: mockGenerateFromStyleSpec,
}))

vi.mock('@/lib/ai/style-spec-aspect-filter', () => ({
  applyAspectFilter: mockApplyAspectFilter,
}))

vi.mock('@/lib/ai/style-spec-brand-kit-merge', () => ({
  applyBrandKitRemix: mockApplyBrandKitRemix,
}))

// Import AFTER mocks
import { generateCarouselFromReferences } from '../carousel'
import * as carouselModule from '../carousel'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { ContentSource } from '@/lib/ai/generate-from-style-spec.types'

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
  mockApplyBrandKitRemix.mockReset()
})

describe('Phase 77 Plan 02 Task 4: generateCarouselFromReferences orchestrator', () => {
  it('Test 1: call order — applyAspectFilter THEN applyBrandKitRemix THEN generateFromStyleSpec', async () => {
    const spec = makeSpec({ palette: { mode: 'solid', primary: '#111111' } })
    const filtered = makeSpec({ palette: { mode: 'solid', primary: '#222222' } })
    const merged = makeSpec({ palette: { mode: 'solid', primary: '#333333' } })

    mockApplyAspectFilter.mockReturnValueOnce(filtered)
    mockApplyBrandKitRemix.mockReturnValueOnce(merged)
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
      brandKit: null,
      useBrandKitRemix: true,
      content,
    })

    // applyAspectFilter called first with the input spec
    expect(mockApplyAspectFilter).toHaveBeenCalledTimes(1)
    expect(mockApplyAspectFilter.mock.calls[0][0]).toBe(spec)
    // applyBrandKitRemix called with the filtered spec
    expect(mockApplyBrandKitRemix).toHaveBeenCalledTimes(1)
    expect(mockApplyBrandKitRemix.mock.calls[0][0]).toBe(filtered)
    // generateFromStyleSpec called with the merged spec
    expect(mockGenerateFromStyleSpec).toHaveBeenCalledTimes(1)
    expect(mockGenerateFromStyleSpec.mock.calls[0][0]).toBe(merged)

    // Order check via invocation order
    const aspectOrder = mockApplyAspectFilter.mock.invocationCallOrder[0]
    const brandOrder = mockApplyBrandKitRemix.mock.invocationCallOrder[0]
    const emitOrder = mockGenerateFromStyleSpec.mock.invocationCallOrder[0]
    expect(aspectOrder).toBeLessThan(brandOrder)
    expect(brandOrder).toBeLessThan(emitOrder)
  })

  it('Test 2: persists slides via UPDATE on existing project row (NOT INSERT)', async () => {
    mockApplyAspectFilter.mockImplementation((s: StyleSpec) => s)
    mockApplyBrandKitRemix.mockImplementation((s: StyleSpec) => s)
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
      brandKit: null,
      useBrandKitRemix: false,
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

  it('Test 4: useBrandKitRemix=false → applyBrandKitRemix NOT called', async () => {
    mockApplyAspectFilter.mockImplementation((s: StyleSpec) => s)
    mockApplyBrandKitRemix.mockImplementation((s: StyleSpec) => s)
    mockGenerateFromStyleSpec.mockResolvedValueOnce({
      title: 'T',
      slides: [
        { hook_text: 'H', body_text: 'B', image_query: 'q', is_cta: false, role: 'cover', text_boxes: [] },
      ],
    })

    const sb = makeSupabase()
    await generateCarouselFromReferences(sb.client, 'user-1', {
      projectId: 'p',
      spec: makeSpec(),
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      brandKit: null,
      useBrandKitRemix: false, // OFF
      content: { mode: 'ai-copy', topic: 'X' },
    })

    // applyBrandKitRemix is bypassed when toggle is OFF
    expect(mockApplyBrandKitRemix).not.toHaveBeenCalled()
  })

  it('Test 5: persist UPDATE error → throws with descriptive message', async () => {
    mockApplyAspectFilter.mockImplementation((s: StyleSpec) => s)
    mockApplyBrandKitRemix.mockImplementation((s: StyleSpec) => s)
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
        brandKit: null,
        useBrandKitRemix: false,
        content: { mode: 'ai-copy', topic: 'X' },
      }),
    ).rejects.toThrow(/rls denied|persist failed/i)
  })
})

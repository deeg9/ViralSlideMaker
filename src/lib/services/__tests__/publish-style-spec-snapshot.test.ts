// Phase 78 Plan 01 Task 3 (REMIX-02): publish flow snapshots style_spec +
// reference_assets from the source projects row into the published_carousels
// row at publish time. Snapshot is point-in-time — subsequent edits to
// projects.style_spec do not retro-mutate the published row.
//
// All four tests target publishProjectAdmin (the API-key path). The user
// session path (publishProjectToExplore in app/(dashboard)/.../publish-actions
// .ts) routes through the publish_carousel RPC and is NOT in scope for this
// plan — REMIX-02 ships in the admin/service path; the RPC path stays on its
// existing surface (no DB-side change in Plan 78-01 — the RPC continues to
// snapshot only slide_data).
//
// We mock the rendering pipeline (next/og + font loading) so the test stays
// in JSDOM. The Supabase client is hand-rolled to capture the INSERT payload.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Slide } from '@/lib/types/slide'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

// Hoisted mocks — must be declared before the dynamic imports below so vi
// mocks resolve to the stubs.
const {
  mockBuildSlideElement,
  mockGetTemplate,
  mockGetUserTier,
  mockLoadFontBuffers,
  mockImageResponse,
} = vi.hoisted(() => ({
  mockBuildSlideElement: vi.fn(() => ({ type: 'div', props: {} })),
  mockGetTemplate: vi.fn(() => ({ id: 'highlight-bar' })),
  mockGetUserTier: vi.fn().mockResolvedValue('free'),
  mockLoadFontBuffers: vi.fn().mockResolvedValue([]),
  // ImageResponse is invoked via `new` in publish.ts. vi.fn lets the function
  // act as a constructor — we just need it to return an object with an
  // arrayBuffer() method that resolves to a Uint8Array-friendly ArrayBuffer.
  mockImageResponse: vi.fn(function () {
    return {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
  }),
}))

vi.mock('next/og', () => ({
  ImageResponse: mockImageResponse,
}))

vi.mock('@/lib/render/templates/index', () => ({
  getTemplate: mockGetTemplate,
}))

vi.mock('@/lib/render/render-slide-satori', () => ({
  buildSlideElement: mockBuildSlideElement,
}))

vi.mock('@/lib/render/load-font', () => ({
  loadFontBuffersForSlide: mockLoadFontBuffers,
}))

vi.mock('@/lib/credits/check-credits', () => ({
  getUserTier: mockGetUserTier,
}))

// Import AFTER mocks
import { publishProjectAdmin } from '../publish'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeSlide(): Slide {
  return {
    title_text: 'T',
    body_text: 'B',
    background_url: null,
    is_cta: false,
    role: 'cover',
    text_boxes: [],
  } as unknown as Slide
}

function makeStyleSpec(overrides?: Partial<StyleSpec>): StyleSpec {
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

function makeRefAssets(): ReferenceAssetRow[] {
  return [
    {
      url: 'https://example.com/storage/v1/object/sign/slide-references/u/a.png?token=t',
      sha256: 'a'.repeat(64),
      uploaded_at: '2026-05-10T12:00:00Z',
      mime_type: 'image/png',
      size_bytes: 1024,
      original_filename: 'a.png',
    },
  ]
}

interface CapturedInsert {
  payload: Record<string, unknown> | null
}

function makeFakeAdmin(opts: {
  projectRow: Record<string, unknown> | null
  insertReturn?: { id: string; slug: string } | null
  insertError?: { code?: string; message: string } | null
}) {
  const captured: CapturedInsert = { payload: null }

  // Per-table builder. publishProjectAdmin reads from 'projects', then
  // inserts into 'published_carousels'. The chain shapes are:
  //   projects:           .from().select().eq().eq().maybeSingle()
  //   published_carousels:.from().insert().select().maybeSingle()
  const fromMock = vi.fn((table: string) => {
    if (table === 'projects') {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: opts.projectRow, error: null }),
      }
      return builder as unknown as ReturnType<SupabaseClient['from']>
    }
    if (table === 'published_carousels') {
      const builder = {
        insert: vi.fn((payload: Record<string, unknown>) => {
          captured.payload = payload
          return {
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: opts.insertReturn ?? { id: 'pub-1', slug: 'test-slug-abc123' },
              error: opts.insertError ?? null,
            }),
          }
        }),
      }
      return builder as unknown as ReturnType<SupabaseClient['from']>
    }
    throw new Error(`unexpected from(): ${table}`)
  })

  const storage = {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://hero/u/x.png' } }),
      remove: vi.fn().mockResolvedValue({ error: null }),
    })),
  }

  const client = { from: fromMock, storage } as unknown as SupabaseClient
  return { client, captured }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Re-prime ImageResponse — vi.clearAllMocks resets implementations on
  // .mockImplementation() but vi.fn(() => ...) stays. The arrayBuffer mock
  // is the inner one, also reset by clearAllMocks; re-arm here.
  mockImageResponse.mockImplementation(function () {
    return {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
  })
  mockGetUserTier.mockResolvedValue('free')
  mockLoadFontBuffers.mockResolvedValue([])
  mockBuildSlideElement.mockReturnValue({ type: 'div', props: {} })
  mockGetTemplate.mockReturnValue({ id: 'highlight-bar' })
})

describe('Phase 78 Plan 01 Task 3 (REMIX-02): publish snapshots style_spec + reference_assets', () => {
  it('Test 1: project with style_spec !== null → INSERT payload carries style_spec', async () => {
    const spec = makeStyleSpec({ palette: { mode: 'solid', primary: '#FF00AA' } })
    const projectRow = {
      id: 'proj-1',
      user_id: 'user-1',
      title: 'My Project',
      description: null,
      slide_data: [makeSlide()],
      template_id: 'highlight-bar',
      topic: null,
      style_spec: spec,
      reference_assets: null,
    }

    const fake = makeFakeAdmin({ projectRow })
    const result = await publishProjectAdmin(fake.client, 'user-1', 'proj-1', {
      title: 'My Carousel',
    })

    expect(result.success).toBe(true)
    expect(fake.captured.payload).not.toBeNull()
    expect(fake.captured.payload?.style_spec).toEqual(spec)
  })

  it('Test 2: project with reference_assets !== null → INSERT payload carries reference_assets', async () => {
    const refs = makeRefAssets()
    const projectRow = {
      id: 'proj-2',
      user_id: 'user-1',
      title: 'My Project',
      description: null,
      slide_data: [makeSlide()],
      template_id: 'highlight-bar',
      topic: null,
      style_spec: null,
      reference_assets: refs,
    }

    const fake = makeFakeAdmin({ projectRow })
    const result = await publishProjectAdmin(fake.client, 'user-1', 'proj-2', {
      title: 'My Carousel',
    })

    expect(result.success).toBe(true)
    expect(fake.captured.payload).not.toBeNull()
    expect(fake.captured.payload?.reference_assets).toEqual(refs)
  })

  it('Test 3: legacy project with both null → INSERT payload carries both as null (back-compat invariant)', async () => {
    const projectRow = {
      id: 'proj-3',
      user_id: 'user-1',
      title: 'Legacy Project',
      description: null,
      slide_data: [makeSlide()],
      template_id: 'highlight-bar',
      topic: null,
      // Legacy v2.4 row — neither column ever populated; arrives as null
      style_spec: null,
      reference_assets: null,
    }

    const fake = makeFakeAdmin({ projectRow })
    const result = await publishProjectAdmin(fake.client, 'user-1', 'proj-3', {
      title: 'Legacy Carousel',
    })

    expect(result.success).toBe(true)
    expect(fake.captured.payload).not.toBeNull()
    expect(fake.captured.payload?.style_spec).toBeNull()
    expect(fake.captured.payload?.reference_assets).toBeNull()
  })

  it('Test 4: snapshot is point-in-time — INSERT payload deep-copies, source mutation does NOT retro-update', async () => {
    const spec = makeStyleSpec({ palette: { mode: 'solid', primary: '#001122' } })
    const refs = makeRefAssets()

    const projectRow: Record<string, unknown> = {
      id: 'proj-4',
      user_id: 'user-1',
      title: 'Snapshot Project',
      description: null,
      slide_data: [makeSlide()],
      template_id: 'highlight-bar',
      topic: null,
      style_spec: spec,
      reference_assets: refs,
    }

    const fake = makeFakeAdmin({ projectRow })
    await publishProjectAdmin(fake.client, 'user-1', 'proj-4', {
      title: 'Snapshot Carousel',
    })

    // Capture what the INSERT received BEFORE mutation
    const capturedSpec = fake.captured.payload?.style_spec as StyleSpec
    const capturedRefs = fake.captured.payload?.reference_assets as ReferenceAssetRow[]
    expect(capturedSpec.palette).toEqual({ mode: 'solid', primary: '#001122' })
    expect(capturedRefs[0].sha256).toBe('a'.repeat(64))

    // Now mutate the SOURCE objects. A point-in-time snapshot must be a
    // deep copy, so the captured INSERT payload must NOT see this mutation.
    spec.palette = { mode: 'solid', primary: '#FFFFFF' } as StyleSpec['palette']
    refs[0].sha256 = 'b'.repeat(64)

    expect((capturedSpec.palette as { primary: string }).primary).toBe('#001122')
    expect(capturedRefs[0].sha256).toBe('a'.repeat(64))
  })
})

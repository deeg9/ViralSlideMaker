// quick-260511-uk1: publish flow snapshots template_id from the source
// projects row into the published_carousels row at publish time.
//
// Closes the Phase 78 REMIX-01 gap (the original snapshot migration shipped
// style_spec + reference_assets but omitted template_id). This test pins the
// publish-side contract: publishProjectAdmin must include
//   template_id: project.template_id ?? null
// in the INSERT payload, alongside style_spec + reference_assets.
//
// Mirrors src/lib/services/__tests__/publish-style-spec-snapshot.test.ts
// (same hoisted mocks, same hand-rolled SupabaseClient that captures the
// INSERT payload). The rendering pipeline (next/og + brand-kit + font
// loading) is mocked so the test stays in JSDOM.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Slide } from '@/lib/types/slide'

// Hoisted mocks — must be declared before the dynamic imports below so vi
// mocks resolve to the stubs.
const {
  mockBuildSlideElement,
  mockMergeWithBrandKit,
  mockGetTemplate,
  mockGetUserTier,
  mockLoadFontBuffers,
  mockImageResponse,
} = vi.hoisted(() => ({
  mockBuildSlideElement: vi.fn(() => ({ type: 'div', props: {} })),
  mockMergeWithBrandKit: vi.fn((t: unknown) => t),
  mockGetTemplate: vi.fn(() => ({ id: 'highlight-bar' })),
  mockGetUserTier: vi.fn().mockResolvedValue('free'),
  mockLoadFontBuffers: vi.fn().mockResolvedValue([]),
  // ImageResponse is invoked via `new` in publish.ts. vi.fn lets the function
  // act as a constructor.
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

vi.mock('@/lib/brand-kit/get-effective-template', () => ({
  mergeWithBrandKit: mockMergeWithBrandKit,
  synthesizeBrandKitTemplate: vi.fn(() => ({ id: 'brand-kit' })),
  BRAND_KIT_TEMPLATE_ID: 'brand-kit',
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

interface CapturedInsert {
  payload: Record<string, unknown> | null
}

function makeFakeAdmin(opts: {
  projectRow: Record<string, unknown> | null
  brandKitRow?: Record<string, unknown> | null
  insertReturn?: { id: string; slug: string } | null
  insertError?: { code?: string; message: string } | null
}) {
  const captured: CapturedInsert = { payload: null }

  const fromMock = vi.fn((table: string) => {
    if (table === 'projects') {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: opts.projectRow, error: null }),
      }
      return builder as unknown as ReturnType<SupabaseClient['from']>
    }
    if (table === 'brand_kits') {
      const builder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: opts.brandKitRow ?? null, error: null }),
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
  mockImageResponse.mockImplementation(function () {
    return {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    }
  })
  mockGetUserTier.mockResolvedValue('free')
  mockLoadFontBuffers.mockResolvedValue([])
  mockBuildSlideElement.mockReturnValue({ type: 'div', props: {} })
  mockMergeWithBrandKit.mockImplementation((t: unknown) => t)
  mockGetTemplate.mockReturnValue({ id: 'highlight-bar' })
})

describe('quick-260511-uk1: publish snapshots template_id alongside style_spec + reference_assets', () => {
  it('snapshots template_id from project on new publish (non-null id flows through)', async () => {
    const projectRow = {
      id: 'proj-1',
      user_id: 'user-1',
      title: 'My Project',
      description: null,
      slide_data: [makeSlide()],
      template_id: 'news-cyan',
      topic: null,
      style_spec: null,
      reference_assets: null,
    }

    const fake = makeFakeAdmin({ projectRow })
    const result = await publishProjectAdmin(fake.client, 'user-1', 'proj-1', {
      title: 'My Carousel',
    })

    expect(result.success).toBe(true)
    expect(fake.captured.payload).not.toBeNull()
    expect(fake.captured.payload?.template_id).toBe('news-cyan')
  })

  it('snapshots template_id=null when project has no template_id (legacy projects with no template chosen)', async () => {
    const projectRow = {
      id: 'proj-2',
      user_id: 'user-1',
      title: 'Legacy Project',
      description: null,
      slide_data: [makeSlide()],
      // Legacy v2.4 row — template_id never set; arrives as null
      template_id: null,
      topic: null,
      style_spec: null,
      reference_assets: null,
    }

    const fake = makeFakeAdmin({ projectRow })
    const result = await publishProjectAdmin(fake.client, 'user-1', 'proj-2', {
      title: 'Legacy Carousel',
    })

    expect(result.success).toBe(true)
    expect(fake.captured.payload).not.toBeNull()
    expect(fake.captured.payload?.template_id).toBeNull()
  })

  it('stores template_id as a plain string (not JSON-stringified) — text column, not jsonb', async () => {
    // template_id is a text column (not jsonb). A copy-paste regression that
    // wrapped the snapshot in JSON.parse(JSON.stringify(...)) would still
    // return the same string for primitives but is wasteful AND signals the
    // dev mis-modeled the column shape. Pin the type + value contract here.
    const projectRow = {
      id: 'proj-3',
      user_id: 'user-1',
      title: 'Bold Yellow Project',
      description: null,
      slide_data: [makeSlide()],
      template_id: 'bold-yellow',
      topic: null,
      style_spec: null,
      reference_assets: null,
    }

    const fake = makeFakeAdmin({ projectRow })
    const result = await publishProjectAdmin(fake.client, 'user-1', 'proj-3', {
      title: 'Bold Carousel',
    })

    expect(result.success).toBe(true)
    expect(fake.captured.payload).not.toBeNull()
    expect(typeof fake.captured.payload?.template_id).toBe('string')
    expect(fake.captured.payload?.template_id).toBe('bold-yellow')
    // Specifically NOT the JSON-stringified form '"bold-yellow"' (would
    // indicate the snapshot accidentally went through JSON.stringify).
    expect(fake.captured.payload?.template_id).not.toBe('"bold-yellow"')
  })
})

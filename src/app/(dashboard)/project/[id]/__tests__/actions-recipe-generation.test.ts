// Phase 85 Plan 03 Task 2 (RECGEN-01):
// Verification tests for the DASHBOARD server-action generateCarousel
// (src/app/(dashboard)/project/[id]/actions.ts) under Phase 85 recipe-driven
// generation.
//
//   SC4 — the server-action path routes through autoPublishOnGenerate
//         (public-by-default — the helper has regressed 6x; this is the
//         per-path regression guard).
//   Recipe wiring — applyLayoutRecipe runs (recipe-shaped slides persisted)
//         when a recipe is present, and is a no-op when absent.
//
// Gemini is mocked at the generateSlideContent boundary; resolveLayoutRecipe
// is mocked deterministically. Auth / credits / rate-limit / Supabase are
// all mocked — no live services.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('pexels', () => ({
  createClient: () => ({
    photos: { search: vi.fn().mockResolvedValue({ photos: [] }) },
  }),
}))

const {
  mockGenerateSlideContent,
  mockSearchPhotos,
  mockAutoPublishOnGenerate,
  mockResolveLayoutRecipe,
  mockCreateClient,
  mockCreateAdminClient,
  mockCheckCredits,
  mockDeductCredit,
  mockGetCreditBalance,
  mockEnsureSubscription,
  mockRateLimit,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGenerateSlideContent: vi.fn(),
  mockSearchPhotos: vi.fn(),
  mockAutoPublishOnGenerate: vi.fn(),
  mockResolveLayoutRecipe: vi.fn(),
  mockCreateClient: vi.fn(),
  mockCreateAdminClient: vi.fn(),
  mockCheckCredits: vi.fn(),
  mockDeductCredit: vi.fn(),
  mockGetCreditBalance: vi.fn(),
  mockEnsureSubscription: vi.fn(),
  mockRateLimit: vi.fn(),
  mockRevalidatePath: vi.fn(),
}))

vi.mock('@/lib/ai/generate-slides', () => ({
  generateSlideContent: mockGenerateSlideContent,
}))
vi.mock('@/lib/pexels/search-photos', () => ({
  searchPhotos: mockSearchPhotos,
}))
vi.mock('@/lib/services/auto-publish-on-generate', () => ({
  autoPublishOnGenerate: mockAutoPublishOnGenerate,
}))
vi.mock('@/lib/ai/layout-recipe-resolve', () => ({
  resolveLayoutRecipe: mockResolveLayoutRecipe,
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}))
vi.mock('@/lib/credits/check-credits', () => ({
  checkCredits: mockCheckCredits,
  deductCredit: mockDeductCredit,
  getCreditBalance: mockGetCreditBalance,
}))
vi.mock('@/lib/credits/ensure-subscription', () => ({
  ensureSubscription: mockEnsureSubscription,
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}))
vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}))

// Import AFTER mocks.
import { generateCarousel } from '../actions'
import type { LayoutRecipe } from '@/lib/types/layout-recipe'

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeCarousel() {
  return {
    title: 'Breaking News Carousel',
    slides: [
      { hook_text: 'COVER HEADLINE', body_text: 'Cover copy', image_query: 'newsroom', is_cta: false },
      { hook_text: 'BODY ONE', body_text: 'Body copy', image_query: 'market', is_cta: false },
      { hook_text: 'FOLLOW FOR MORE', body_text: 'CTA copy', image_query: 'follow', is_cta: true },
    ],
  }
}

function makeRecipe(): LayoutRecipe {
  return {
    schema_version: 1,
    accent_cadence: 'frequent',
    roles: {
      cover: {
        layout_mode: 'full-bleed-text-overlay',
        caption_card: {
          enabled: true,
          x: 11,
          y: 62,
          width: 78,
          height_pct: 38,
          blend_pct: 14,
          opacity: 0.85,
          position: 'bottom',
        },
        hook: { position_band: 'center', font_size_band: 'xl', text_align: 'center' },
      },
    },
  }
}

/** Server Supabase client mock: auth.getUser + projects update capture. */
function makeServerClient() {
  const captured: { slideData?: unknown } = {}
  const projectsUpdate = vi.fn((payload: Record<string, unknown>) => {
    if ('slide_data' in payload) captured.slideData = payload.slide_data
    return { eq: vi.fn().mockResolvedValue({ error: null }) }
  })
  const fromMock = vi.fn((table: string) => {
    if (table === 'projects') return { update: projectsUpdate }
    return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
  })
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: fromMock,
    },
    captured,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateSlideContent.mockReset().mockResolvedValue(makeCarousel())
  mockSearchPhotos
    .mockReset()
    .mockResolvedValue([{ src: { portrait: 'https://example.com/photo.jpg' }, id: 42 }])
  mockAutoPublishOnGenerate.mockReset().mockResolvedValue(undefined)
  mockResolveLayoutRecipe.mockReset().mockResolvedValue(null)
  mockCreateAdminClient.mockReset().mockReturnValue({ __admin: true })
  mockCheckCredits.mockReset().mockResolvedValue({ allowed: true, tier: 'free' })
  mockDeductCredit.mockReset().mockResolvedValue(true)
  mockGetCreditBalance.mockReset().mockResolvedValue(10)
  mockEnsureSubscription.mockReset().mockResolvedValue(undefined)
  mockRateLimit.mockReset().mockReturnValue({ ok: true })
  mockRevalidatePath.mockReset()
})

describe('Phase 85 (RECGEN-01): generateCarousel — dashboard server action', () => {
  describe('SC4 — public-by-default (autoPublishOnGenerate)', () => {
    it('calls autoPublishOnGenerate exactly once after a successful generation', async () => {
      const { client } = makeServerClient()
      mockCreateClient.mockResolvedValue(client)

      const result = await generateCarousel(
        'project-1',
        'Breaking news',
        'news-oracle',
        'stock',
        3,
        undefined,
        'news',
      )

      expect(result).toEqual({ success: true, slideCount: 3 })
      expect(mockAutoPublishOnGenerate).toHaveBeenCalledTimes(1)
      // Called with the ADMIN client, the user id, the project id, the title.
      expect(mockAutoPublishOnGenerate).toHaveBeenCalledWith(
        { __admin: true },
        'user-1',
        'project-1',
        'Breaking News Carousel',
      )
    })

    it('calls autoPublishOnGenerate once even on a recipe-carrying generation', async () => {
      const { client } = makeServerClient()
      mockCreateClient.mockResolvedValue(client)
      mockResolveLayoutRecipe.mockResolvedValue(makeRecipe())

      await generateCarousel('project-1', 'Breaking news', 'news-oracle', 'stock', 3, undefined, 'news')
      expect(mockAutoPublishOnGenerate).toHaveBeenCalledTimes(1)
    })
  })

  describe('recipe wiring on the server-action path', () => {
    it('persists recipe-shaped slide_data when a recipe is present', async () => {
      const { client, captured } = makeServerClient()
      mockCreateClient.mockResolvedValue(client)
      mockResolveLayoutRecipe.mockResolvedValue(makeRecipe())

      await generateCarousel('project-1', 'Breaking news', 'news-oracle', 'stock', 3, undefined, 'news')

      const slides = captured.slideData as Array<Record<string, unknown>>
      const coverSO = slides[0].style_overrides as Record<string, unknown>
      // Recipe geometry landed on the cover slide before the save.
      expect(coverSO.caption_bar_enabled).toBe(true)
      expect(coverSO.caption_bar_blend_pct).toBe(14)
      expect(coverSO.hook_font_size).toBe(176)
      expect(coverSO.text_align).toBe('center')
    })

    it('persists unmodified slide_data when no recipe is present (no-op)', async () => {
      const { client, captured } = makeServerClient()
      mockCreateClient.mockResolvedValue(client)
      // resolveLayoutRecipe default-mocked to null.

      await generateCarousel('project-1', 'Breaking news', 'news-oracle', 'stock', 3, undefined, 'news')

      const slides = captured.slideData as Array<Record<string, unknown>>
      const coverSO = (slides[0].style_overrides ?? {}) as Record<string, unknown>
      // No recipe -> applyLayoutRecipe no-op -> no recipe-injected geometry.
      expect(coverSO.caption_bar_blend_pct).toBeUndefined()
      expect(coverSO.hook_font_size).not.toBe(176)
    })
  })
})

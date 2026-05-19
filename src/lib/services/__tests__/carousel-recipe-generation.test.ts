// Phase 85 Plan 03 Task 1 (RECGEN-01):
// Verification tests for the API-service generateCarousel (src/lib/services/
// carousel.ts) under Phase 85 recipe-driven generation.
//
//   SC2 — a recipe-carrying generation comes out Oracle-shaped (full-bleed
//         photo, cover caption card edge-blend, big centered headline, pill
//         highlights, "Trending" accessory label).
//   SC3 — a no-recipe generation's slide_data is BYTE-IDENTICAL to the
//         pre-Phase-85 baseline (hard gate).
//   SC4 — generateCarousel routes through autoPublishOnGenerate
//         (public-by-default — this helper has regressed 6x).
//
// Gemini is mocked at the generateSlideContent boundary; resolveLayoutRecipe
// is mocked so the recipe input is deterministic (no live DB). All Supabase /
// Pexels / project-service surfaces are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pexels client crashes at module load without PEXELS_API_KEY — carousel.ts
// imports searchPhotos transitively. Mock the raw module before import.
vi.mock('pexels', () => ({
  createClient: () => ({
    photos: { search: vi.fn().mockResolvedValue({ photos: [] }) },
  }),
}))

const {
  mockGenerateSlideContent,
  mockSearchPhotos,
  mockCreateProjectService,
  mockUpdateProjectService,
  mockAutoPublishOnGenerate,
  mockResolveLayoutRecipe,
} = vi.hoisted(() => ({
  mockGenerateSlideContent: vi.fn(),
  mockSearchPhotos: vi.fn(),
  mockCreateProjectService: vi.fn(),
  mockUpdateProjectService: vi.fn(),
  mockAutoPublishOnGenerate: vi.fn(),
  mockResolveLayoutRecipe: vi.fn(),
}))

vi.mock('@/lib/ai/generate-slides', () => ({
  generateSlideContent: mockGenerateSlideContent,
}))
vi.mock('@/lib/pexels/search-photos', () => ({
  searchPhotos: mockSearchPhotos,
}))
vi.mock('@/lib/services/projects', () => ({
  createProjectService: mockCreateProjectService,
  updateProjectService: mockUpdateProjectService,
}))
vi.mock('@/lib/services/auto-publish-on-generate', () => ({
  autoPublishOnGenerate: mockAutoPublishOnGenerate,
}))
// Phase 85: mock recipe resolution so the recipe input is deterministic
// (the real helper would hit Supabase). applyLayoutRecipe itself runs REAL
// — these tests exercise the genuine projection + wiring.
vi.mock('@/lib/ai/layout-recipe-resolve', () => ({
  resolveLayoutRecipe: mockResolveLayoutRecipe,
}))

// Import AFTER mocks.
import { generateCarousel } from '../carousel'
import type { LayoutRecipe } from '@/lib/types/layout-recipe'

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A deterministic Gemini-emitted carousel (mocks generateSlideContent). */
function makeCarousel() {
  return {
    title: 'Breaking News Carousel',
    slides: [
      {
        hook_text: 'THE NEWS ORACLE SPEAKS',
        body_text: 'Cover supporting copy',
        image_query: 'newsroom',
        is_cta: false,
        accessory_label: 'Trending',
        hook_segments: [
          { text: 'THE NEWS', accent: false },
          { text: 'ORACLE', accent: true, highlightColor: '#00E5FF', highlightStyle: 'pill' },
        ],
      },
      {
        hook_text: 'MARKETS REACT',
        body_text: 'Body one copy',
        image_query: 'stock market',
        is_cta: false,
      },
      {
        hook_text: 'WHAT HAPPENS NEXT',
        body_text: 'Body two copy',
        image_query: 'analysts',
        is_cta: false,
      },
      {
        hook_text: 'FOLLOW FOR MORE',
        body_text: 'CTA copy',
        image_query: 'follow',
        is_cta: true,
      },
    ],
  }
}

/** A News-Oracle-shaped LayoutRecipe. */
function makeOracleRecipe(): LayoutRecipe {
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
          blend_pct: 14, // edge-blend > 0
          opacity: 0.85,
          position: 'bottom',
        },
        hook: { position_band: 'center', font_size_band: 'xl', text_align: 'center' },
        accessory_label: { enabled: true, position_band: 'top' },
      },
      body: {
        layout_mode: 'full-bleed-text-overlay',
        hook: { position_band: 'upper', font_size_band: 'md', text_align: 'left' },
      },
      cta: {
        layout_mode: 'full-bleed-text-overlay',
        caption_card: {
          enabled: true,
          x: 11,
          y: 58,
          width: 78,
          height_pct: 40,
          blend_pct: 10,
          opacity: 0.85,
          position: 'bottom',
        },
        hook: { position_band: 'bottom', font_size_band: 'lg', text_align: 'center' },
      },
    },
  }
}

/**
 * Supabase mock supporting both surfaces generateCarousel touches:
 *   .from('projects').update({...}).eq('id', ...)
 * resolveLayoutRecipe is mocked separately, so the templates select is not
 * exercised here. Captures the slide_data written to `projects`.
 */
function makeSupabase() {
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
    client: { from: fromMock } as unknown as Parameters<typeof generateCarousel>[0],
    captured,
    projectsUpdate,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGenerateSlideContent.mockReset().mockResolvedValue(makeCarousel())
  mockSearchPhotos
    .mockReset()
    .mockResolvedValue([{ src: { portrait: 'https://example.com/photo.jpg' }, id: 42 }])
  mockCreateProjectService.mockReset().mockResolvedValue({ id: 'project-1' })
  mockUpdateProjectService.mockReset().mockResolvedValue(undefined)
  mockAutoPublishOnGenerate.mockReset().mockResolvedValue(undefined)
  mockResolveLayoutRecipe.mockReset().mockResolvedValue(null)
})

describe('Phase 85 (RECGEN-01): generateCarousel — API service path', () => {
  describe('SC2 — recipe-carrying generation comes out Oracle-shaped', () => {
    it('shapes the cover slide with an edge-blended caption card, big centered headline, full-bleed photo, and preserves pill highlights + Trending label', async () => {
      mockResolveLayoutRecipe.mockResolvedValue(makeOracleRecipe())
      const { client, captured } = makeSupabase()

      await generateCarousel(client, 'user-1', {
        topic: 'Breaking news',
        templateId: 'news-oracle',
        slideCount: 4,
        category: 'news',
      })

      const slides = captured.slideData as Array<Record<string, unknown>>
      expect(slides).toHaveLength(4)
      const cover = slides[0]
      const coverSO = cover.style_overrides as Record<string, unknown>

      // Cover caption card WITH edge-blend.
      expect(coverSO.caption_bar_enabled).toBe(true)
      expect(coverSO.caption_bar_blend_pct).toBe(14)
      expect(coverSO.caption_bar_position).toBe('bottom')

      // Big centered condensed headline (xl band -> 176px, centered).
      expect(coverSO.hook_font_size).toBe(176)
      expect(coverSO.text_align).toBe('center')

      // Full-bleed photo — background fetched, not null.
      expect(cover.background_url).toBe('https://example.com/photo.jpg')

      // Cyan pill highlights preserved through recipe application.
      const segs = cover.hook_segments as Array<Record<string, unknown>>
      expect(segs.some((s) => s.highlightStyle === 'pill')).toBe(true)

      // "Trending" accessory label (Gemini-authored) survives unchanged.
      expect(cover.accessory_label).toBe('Trending')
    })

    it('routes the is_cta slide to the cta role geometry', async () => {
      mockResolveLayoutRecipe.mockResolvedValue(makeOracleRecipe())
      const { client, captured } = makeSupabase()

      await generateCarousel(client, 'user-1', {
        topic: 'Breaking news',
        templateId: 'news-oracle',
        slideCount: 4,
        category: 'news',
      })

      const slides = captured.slideData as Array<Record<string, unknown>>
      const ctaSO = slides[3].style_overrides as Record<string, unknown>
      // cta role: caption_bar_y 58, hook bottom band -> 84, lg -> 140.
      expect(ctaSO.caption_bar_y).toBe(58)
      expect(ctaSO.hook_font_size).toBe(140)
    })
  })

  describe('SC3 — no-recipe generation is byte-identical to baseline (HARD GATE)', () => {
    it('persists slide_data byte-identical between two no-recipe runs', async () => {
      // resolveLayoutRecipe default-mocked to null (no recipe).
      const runA = makeSupabase()
      await generateCarousel(runA.client, 'user-1', {
        topic: 'Breaking news',
        templateId: 'news-oracle',
        slideCount: 4,
        category: 'news',
      })
      const runB = makeSupabase()
      await generateCarousel(runB.client, 'user-1', {
        topic: 'Breaking news',
        templateId: 'news-oracle',
        slideCount: 4,
        category: 'news',
      })
      expect(JSON.stringify(runA.captured.slideData)).toBe(
        JSON.stringify(runB.captured.slideData),
      )
    })

    it('a no-recipe run produces slide_data with NO recipe-injected caption_bar geometry on the cover', async () => {
      const { client, captured } = makeSupabase()
      await generateCarousel(client, 'user-1', {
        topic: 'Breaking news',
        templateId: 'news-oracle',
        slideCount: 4,
        category: 'news',
      })
      const slides = captured.slideData as Array<Record<string, unknown>>
      const coverSO = (slides[0].style_overrides ?? {}) as Record<string, unknown>
      // With no recipe, applyLayoutRecipe is a no-op — the recipe never
      // wrote caption_bar_blend_pct or the xl hook_font_size.
      expect(coverSO.caption_bar_blend_pct).toBeUndefined()
      expect(coverSO.hook_font_size).not.toBe(176)
    })
  })

  describe('SC4 — public-by-default (autoPublishOnGenerate)', () => {
    it('calls autoPublishOnGenerate exactly once on a recipe-carrying generation', async () => {
      mockResolveLayoutRecipe.mockResolvedValue(makeOracleRecipe())
      const { client } = makeSupabase()
      await generateCarousel(client, 'user-1', {
        topic: 'Breaking news',
        templateId: 'news-oracle',
        slideCount: 4,
        category: 'news',
      })
      expect(mockAutoPublishOnGenerate).toHaveBeenCalledTimes(1)
      expect(mockAutoPublishOnGenerate).toHaveBeenCalledWith(
        client,
        'user-1',
        'project-1',
        'Breaking News Carousel',
      )
    })

    it('calls autoPublishOnGenerate exactly once on a no-recipe generation', async () => {
      const { client } = makeSupabase()
      await generateCarousel(client, 'user-1', {
        topic: 'Breaking news',
        templateId: 'news-oracle',
        slideCount: 4,
        category: 'news',
      })
      expect(mockAutoPublishOnGenerate).toHaveBeenCalledTimes(1)
    })
  })

  describe('recipe application precedes the slide_data save', () => {
    it('persists the recipe-shaped slides (not the pre-recipe slides)', async () => {
      mockResolveLayoutRecipe.mockResolvedValue(makeOracleRecipe())
      const { client, captured } = makeSupabase()
      await generateCarousel(client, 'user-1', {
        topic: 'Breaking news',
        templateId: 'news-oracle',
        slideCount: 4,
        category: 'news',
      })
      // The persisted slide_data already carries recipe geometry — proof
      // applyLayoutRecipe ran before the .from('projects').update.
      const slides = captured.slideData as Array<Record<string, unknown>>
      expect((slides[0].style_overrides as Record<string, unknown>).caption_bar_x).toBe(11)
    })
  })
})

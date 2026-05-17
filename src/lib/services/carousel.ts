import type { SupabaseClient } from '@supabase/supabase-js'
import { generateSlideContent } from '@/lib/ai/generate-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { generateImagePrompt, generateCarouselStyle } from '@/lib/imagen/generate-prompt'
import { generateImagenBackground } from '@/lib/imagen/generate-image'
import { createProjectService, updateProjectService } from '@/lib/services/projects'
import { autoPublishOnGenerate } from '@/lib/services/auto-publish-on-generate'
import { getTemplate } from '@/lib/render/templates/index'
import { getCategory, DEFAULT_CATEGORY } from '@/lib/ai/categories'
import type { Slide } from '@/lib/types/slide'
// Phase 77 Plan 02 Task 4 (EMIT-02): sibling orchestrator that consumes
// the persisted-spec + Plan 01 helpers + generateFromStyleSpec.
import { applyAspectFilter } from '@/lib/ai/style-spec-aspect-filter'
import { applyBrandKitRemix } from '@/lib/ai/style-spec-brand-kit-merge'
import { generateFromStyleSpec } from '@/lib/ai/generate-from-style-spec'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { SpecPreviewAspects } from '@/components/style-from-reference/state-machine'
import type { ContentSource } from '@/lib/ai/generate-from-style-spec.types'
import type { ReferenceAssetRow } from '@/lib/types/projects-storage-constants'

// Templates that share the news-carousel skip-default-effects behavior.
// Keep this list in sync with src/lib/ai/prompts.ts and the actions.ts copy.
const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan'])

interface CarouselInput {
  topic: string
  templateId: string
  slideCount?: number
  imageSource?: 'stock' | 'ai' | 'none'
  advancedOptions?: { font?: string; fontColor?: string; imagePrompt?: string }
  /** Phase 82 (R1): content category that drives Gemini's copy. */
  category?: string
}

/**
 * Generate a complete carousel: create project, generate AI content, fetch images, save to DB.
 *
 * Uses the provided admin supabase client (no session cookies).
 * Does NOT call ensureSubscription/checkCredits -- the caller must handle credit gating.
 * Does NOT call revalidatePath -- API routes do not use Next.js cache.
 */
export async function generateCarousel(
  supabase: SupabaseClient,
  userId: string,
  input: CarouselInput
): Promise<{ projectId: string; slideCount: number }> {
  const {
    topic,
    templateId,
    slideCount = 7,
    imageSource = 'stock',
    advancedOptions,
    category,
  } = input

  // Phase 82 (R1, R7): resolve the effective category (unknown/absent →
  // default 'news') and an effective category-curated template. If the
  // requested templateId is empty or not in the category's templateIds list,
  // snap to the category default (templateIds[0]) — no silent highlight-bar
  // fallback path remains.
  const resolvedCategory = category && getCategory(category) ? category : DEFAULT_CATEGORY
  const categoryModule = getCategory(resolvedCategory)!
  const effectiveTemplateId =
    templateId && categoryModule.templateIds.includes(templateId)
      ? templateId
      : categoryModule.templateIds[0]

  // Create project first
  const { id: projectId } = await createProjectService(supabase, userId, {
    title: topic,
    topic,
    template_id: effectiveTemplateId,
  })

  try {
    // Update status to generating
    await supabase
      .from('projects')
      .update({ generation_status: 'generating' })
      .eq('id', projectId)

    // 1. Generate content with Gemini. Phase 82 (R1): the resolved category
    //    drives the copy module; the effective template is category-curated.
    const clampedCount = Math.max(3, Math.min(20, slideCount))
    const carousel = await generateSlideContent(
      topic,
      clampedCount,
      advancedOptions?.imagePrompt,
      effectiveTemplateId,
      resolvedCategory,
    )

    // 2. Fetch background images
    let slides: Slide[]

    // Lift AI-emitted `layout` from the slide root into style_overrides.layout to match the Slide model.
    // Phase 82 Gap C: MERGE into any existing style_overrides — promoteNewsHeadline
    // writes style_overrides.hook_font_size before this map runs, and a bare
    // `{ layout }` replacement would silently discard it (the headline would
    // fall back to the small template default).
    const aiSlides = carousel.slides.map((s) => {
      const { layout, ...rest } = s
      return layout
        ? { ...rest, style_overrides: { ...(rest.style_overrides ?? {}), layout } }
        : rest
    })

    // backgroundMode: 'color' templates (paper-essay, brutalist-grid) are
    // pure-typography by design — skip the Pexels/Imagen fetch entirely so the
    // slide is never tagged with a background_url that the renderer would have
    // to suppress later. The same "no photos" outcome can also be opted into
    // explicitly via imageSource === 'none' on any template — the user picks
    // text-only output regardless of template's photoMode design.
    const isColorOnlyTemplate =
      getTemplate(effectiveTemplateId).backgroundMode === 'color'
    const wantsNoPhotos = imageSource === 'none' || isColorOnlyTemplate

    if (wantsNoPhotos) {
      slides = aiSlides.map((slide) => ({
        ...slide,
        background_url: null,
        pexels_photo_id: null,
      })) as Slide[]
    } else if (imageSource === 'ai') {
      // Generate a master visual style first so all slides look cohesive
      const masterStyle = await generateCarouselStyle(topic)

      slides = [...aiSlides] as Slide[]
      const batchSize = 2

      for (let i = 0; i < slides.length; i += batchSize) {
        const batch = slides.slice(i, i + batchSize)
        const results = await Promise.all(
          batch.map(async (slide, batchIdx) => {
            const slideIdx = i + batchIdx
            try {
              const prompt = await generateImagePrompt(
                topic,
                slide.hook_text,
                slide.body_text ?? '',
                slide.is_cta,
                masterStyle,
                advancedOptions?.imagePrompt
              )
              const result = await generateImagenBackground(userId, prompt, projectId, slideIdx)
              if ('url' in result) {
                return { ...slide, background_url: result.url, pexels_photo_id: null }
              }
            } catch {
              /* fall through to stock fallback */
            }
            // Fallback to stock if AI fails
            const photos = await searchPhotos(slide.image_query, { orientation: 'portrait', per_page: 1 })
            return {
              ...slide,
              background_url: photos[0]?.src.portrait ?? null,
              pexels_photo_id: photos[0]?.id ?? null,
            }
          })
        )
        for (let j = 0; j < results.length; j++) {
          slides[i + j] = results[j]
        }
      }
    } else {
      // Stock photos from Pexels (fast, parallel)
      slides = await Promise.all(
        aiSlides.map(async (slide) => {
          const photos = await searchPhotos(slide.image_query, {
            orientation: 'portrait',
            per_page: 1,
          })
          return {
            ...slide,
            background_url: photos[0]?.src.portrait ?? null,
            pexels_photo_id: photos[0]?.id ?? null,
          }
        })
      )
    }

    // 2b. Apply advanced font/color overrides
    if (advancedOptions?.font || advancedOptions?.fontColor) {
      slides = slides.map((slide) => ({
        ...slide,
        style_overrides: {
          ...slide.style_overrides,
          ...(advancedOptions.font
            ? { hook_font_family: advancedOptions.font, body_font_family: advancedOptions.font }
            : {}),
          ...(advancedOptions.fontColor
            ? { hook_text_color: advancedOptions.fontColor, body_text_color: advancedOptions.fontColor }
            : {}),
        },
      }))
    }

    // 2c. Apply default text effects for readability (shadow + overlay).
    // News Drop / News Cyan run on a solid dark canvas with constrained images
    // — defaults would dirty the image zone, so skip them.
    // No-photos paths (color-only template OR imageSource === 'none') are pure
    // typography on a styled background — black drop shadows + 45% darkening
    // overlay would muddy the canvas, so skip them too.
    if (!NEWS_TEMPLATES.has(effectiveTemplateId) && !wantsNoPhotos) {
      slides = slides.map((slide) => ({
        ...slide,
        style_overrides: {
          ...slide.style_overrides,
          overlay_opacity: slide.style_overrides?.overlay_opacity ?? 45,
          hook_text_effects: slide.style_overrides?.hook_text_effects ?? {
            shadow: { enabled: true, color: '#000000aa', size: 'lg' },
          },
          body_text_effects: slide.style_overrides?.body_text_effects ?? {
            shadow: { enabled: true, color: '#000000aa', size: 'md' },
          },
        },
      }))
    }

    // 3. Save to database
    await supabase
      .from('projects')
      .update({
        slide_data: slides,
        template_id: effectiveTemplateId,
        // Phase 82 (R1): persist the category so Regenerate / Remix reuse it.
        category: resolvedCategory,
        title: carousel.title,
        topic,
        generation_status: 'complete',
      })
      .eq('id', projectId)

    // quick-260514-k3j: newly-generated carousels MUST default to Public.
    // Single ritual every generation path uses — see helper docstring for
    // the history of why this keeps regressing across new entry points.
    await autoPublishOnGenerate(supabase, userId, projectId, carousel.title)

    return { projectId, slideCount: slides.length }
  } catch (err) {
    // Update status to error
    await supabase
      .from('projects')
      .update({ generation_status: 'error' })
      .eq('id', projectId)

    throw err
  }
}

// ============================================================================
// Phase 77 Plan 02 Task 4 (EMIT-02 + EDITOR-01):
// generateCarouselFromReferences — sibling orchestrator for the
// style-from-reference path.
// ============================================================================
//
// Composition order (locked per Plan 01 SUMMARY):
//   1. applyAspectFilter — neutralizes unchecked spec sections (Phase 76 toggle)
//   2. applyBrandKitRemix — merges brand-kit colors + font categories (when on)
//   3. generateFromStyleSpec — Gemini text emit with projector-fused overrides
//   4. UPDATE projects.slide_data + generation_status:'complete' (existing
//      project — Phase 75 already created the row with extracted spec)
//
// Differences from generateCarousel (existing — UNTOUCHED):
//   - UPDATE not INSERT (project already exists)
//   - No Pexels / Imagen background fetch (style-from-reference is text-emit
//     only at this milestone; backgrounds are a v2.14 enhancement)
//   - No advancedOptions overrides (the spec is the design template)
//
// EDITOR-01 BY-CONSTRUCTION:
//   This function persists slide_data. The Server Action returns projectId.
//   The client navigates to /project/{projectId} via existing router.push
//   pattern (same as today's emit flow). SlideEditor mounts with persisted
//   slides → useSlideEditor(initialSlides) → past=[], present=slides. One
//   Cmd+Z restores empty initial state — EMIT-10 single-pushHistory satisfied
//   by construction with NO new editor wiring.

export interface CarouselFromReferencesInput {
  projectId: string
  spec: StyleSpec
  aspects: SpecPreviewAspects
  brandKit: BrandKit | null
  useBrandKitRemix: boolean
  content: ContentSource
  slideCount?: number
  /** quick-260514-images: optional background-source for the references
   *  path. Originally the emit was text-only (line 231 comment); the
   *  user reported the result "didn't even pull any of the images" so
   *  we now honor stock / none. 'ai' is accepted but currently degrades
   *  to 'stock' to keep this scope tight — AI image generation requires
   *  per-slide prompt fan-out that lives in the template path's
   *  generateCarousel orchestrator. */
  imageSource?: 'stock' | 'ai' | 'none'
  /** quick-260515-dwu: reference rows from the spec-preview reducer.
   *  When present, persisted to projects.reference_assets so legacy /
   *  topic-flow regenerations can't silently overwrite the Copy Style
   *  state (the bug-report root cause: projects landed with both
   *  style_spec=NULL AND reference_assets=NULL after a successful Copy
   *  Style generation). Optional to preserve existing callers
   *  (regenerateFromReferencesAction composes its own references and
   *  doesn't forward them through this input shape — it inherits via
   *  the fork RPC populating the column directly). */
  references?: ReferenceAssetRow[]
}

export async function generateCarouselFromReferences(
  supabase: SupabaseClient,
  userId: string,
  input: CarouselFromReferencesInput,
): Promise<{ projectId: string; slideCount: number }> {
  // Step 1: aspect filter (per CONTEXT.md per-aspect zeroing)
  const filtered = applyAspectFilter(input.spec, input.aspects)
  // Step 2: brand-kit merge (per CONTEXT.md PREVIEW-08 + Plan 01); skip
  // entirely when toggle is OFF — Object.is short-circuit elsewhere is
  // already a fast path, but bypass keeps spy assertions clean.
  const merged = input.useBrandKitRemix
    ? applyBrandKitRemix(filtered, input.brandKit)
    : filtered
  // Step 3: text-only Gemini emit through projector + closed-enum responseSchema
  const carousel = await generateFromStyleSpec(merged, input.content, {
    slideCount: input.slideCount,
  })

  // Step 3b (quick-260514-images): populate background_url per slide so
  // the editor actually shows photo backgrounds. The original references
  // emit was text-only by design (line 231 comment block) — user feedback
  // is that the all-white output looks broken, so we add stock-photo
  // fetch by default. 'none' keeps text-only; 'ai' falls back to stock
  // for now (AI fan-out lives in generateCarousel — porting that here
  // is a follow-up). Skipped entirely on color-only templates: those
  // are pure-typography surfaces and a photo would clash.
  const slides = (carousel.slides ?? []) as Slide[]
  const imageSource = input.imageSource ?? 'stock'
  let withBackgrounds: Slide[]
  if (imageSource === 'none') {
    withBackgrounds = slides.map((s) => ({
      ...s,
      background_url: null,
      pexels_photo_id: null,
    }))
  } else {
    // 'stock' (and 'ai' temporarily). Per-slide Pexels search using the
    // emit-supplied image_query — same shape generateCarousel uses on
    // line 141.
    withBackgrounds = await Promise.all(
      slides.map(async (slide) => {
        const photos = await searchPhotos(slide.image_query, {
          orientation: 'portrait',
          per_page: 1,
        })
        return {
          ...slide,
          background_url: photos[0]?.src.portrait ?? null,
          pexels_photo_id: photos[0]?.id ?? null,
        }
      }),
    )
  }

  // Step 4: persist via UPDATE on the existing project row. Belt-and-braces
  // ownership check via .eq('user_id', userId) on top of RLS — defense-in-depth
  // against T-77-06 (project_id tampering).
  //
  // quick-260515-dwu: persist the spec used for this generation so the
  // project row stops looking like a topic-flow result (style_spec=NULL +
  // reference_assets=NULL). style_spec writes unconditionally — this
  // function is only reachable through the Copy Style routing branch, so
  // we always have a spec. reference_assets writes only when callers
  // forward the array; legacy callers that don't (none in-tree today, but
  // the type is optional) leave the column untouched rather than
  // overwriting with `undefined`.
  const updatePayload: Record<string, unknown> = {
    slide_data: withBackgrounds,
    generation_status: 'complete',
    title: carousel.title,
    style_spec: input.spec,
  }
  if (input.references && input.references.length > 0) {
    updatePayload.reference_assets = input.references
  }
  const { error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', input.projectId)
    .eq('user_id', userId)
  if (error) {
    throw new Error(`carousel-from-refs persist failed: ${error.message}`)
  }

  // quick-260514-k3j: newly-generated carousels MUST default to Public.
  // See generateCarousel above for context — same ritual, same reason.
  await autoPublishOnGenerate(supabase, userId, input.projectId, carousel.title)

  return { projectId: input.projectId, slideCount: withBackgrounds.length }
}

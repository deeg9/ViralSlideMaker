import type { SupabaseClient } from '@supabase/supabase-js'
import { generateSlideContent } from '@/lib/ai/generate-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { generateImagePrompt, generateCarouselStyle } from '@/lib/imagen/generate-prompt'
import { generateImagenBackground } from '@/lib/imagen/generate-image'
import { createProjectService, updateProjectService } from '@/lib/services/projects'
import { getTemplate } from '@/lib/render/templates/index'
import type { Slide } from '@/lib/types/slide'

// Templates that share the news-carousel skip-default-effects behavior.
// Keep this list in sync with src/lib/ai/prompts.ts and the actions.ts copy.
const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan'])

interface CarouselInput {
  topic: string
  templateId: string
  slideCount?: number
  imageSource?: 'stock' | 'ai' | 'none'
  advancedOptions?: { font?: string; fontColor?: string; imagePrompt?: string }
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
  } = input

  // Create project first
  const { id: projectId } = await createProjectService(supabase, userId, {
    title: topic,
    topic,
    template_id: templateId,
  })

  try {
    // Update status to generating
    await supabase
      .from('projects')
      .update({ generation_status: 'generating' })
      .eq('id', projectId)

    // 1. Generate content with Gemini (templateId steers the prompt for templates like News Drop)
    const clampedCount = Math.max(3, Math.min(20, slideCount))
    const carousel = await generateSlideContent(topic, clampedCount, advancedOptions?.imagePrompt, templateId)

    // 2. Fetch background images
    let slides: Slide[]

    // Lift AI-emitted `layout` from the slide root into style_overrides.layout to match the Slide model.
    const aiSlides = carousel.slides.map((s) => {
      const { layout, ...rest } = s
      return layout
        ? { ...rest, style_overrides: { layout } }
        : rest
    })

    // backgroundMode: 'color' templates (paper-essay, brutalist-grid) are
    // pure-typography by design — skip the Pexels/Imagen fetch entirely so the
    // slide is never tagged with a background_url that the renderer would have
    // to suppress later. The same "no photos" outcome can also be opted into
    // explicitly via imageSource === 'none' on any template — the user picks
    // text-only output regardless of template's photoMode design.
    const isColorOnlyTemplate =
      getTemplate(templateId).backgroundMode === 'color'
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
                slide.body_text,
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
    if (!NEWS_TEMPLATES.has(templateId) && !wantsNoPhotos) {
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
        template_id: templateId,
        title: carousel.title,
        topic,
        generation_status: 'complete',
      })
      .eq('id', projectId)

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

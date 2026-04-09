import type { SupabaseClient } from '@supabase/supabase-js'
import { generateSlideContent } from '@/lib/ai/generate-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { generateImagePrompt, generateCarouselStyle } from '@/lib/imagen/generate-prompt'
import { generateImagenBackground } from '@/lib/imagen/generate-image'
import { createProjectService, updateProjectService } from '@/lib/services/projects'
import type { Slide } from '@/lib/types/slide'

interface CarouselInput {
  topic: string
  templateId: string
  slideCount?: number
  imageSource?: 'stock' | 'ai'
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

    // 1. Generate content with Gemini
    const clampedCount = Math.max(3, Math.min(20, slideCount))
    const carousel = await generateSlideContent(topic, clampedCount, advancedOptions?.imagePrompt)

    // 2. Fetch background images
    let slides: Slide[]

    if (imageSource === 'ai') {
      // Generate a master visual style first so all slides look cohesive
      const masterStyle = await generateCarouselStyle(topic)

      slides = [...carousel.slides] as Slide[]
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
        carousel.slides.map(async (slide) => {
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

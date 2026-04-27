'use server'

import { generateSlideContent } from '@/lib/ai/generate-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { generateImagePrompt, generateCarouselStyle } from '@/lib/imagen/generate-prompt'
import { generateImagenBackground } from '@/lib/imagen/generate-image'
import { createClient } from '@/lib/supabase/server'
import { checkCredits, deductCredit, getCreditBalance } from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'
import type { Slide } from '@/lib/types/slide'

// Templates that share the news-carousel skip-default-effects behavior.
// Keep this list in sync with src/lib/ai/prompts.ts and src/lib/services/carousel.ts.
const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan'])

export async function generateCarousel(
  projectId: string,
  topic: string,
  templateId: string,
  imageSource: 'stock' | 'ai' = 'stock',
  slideCount: number = 7,
  advancedOptions?: { font?: string; fontColor?: string; imagePrompt?: string }
): Promise<{ success: true; slideCount: number } | { success: false; error: string; upgradeEligible?: boolean }> {
  const supabase = await createClient()

  try {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Rate limit: 5-second cooldown between carousel generations
    const { ok } = rateLimit(`carousel:${user.id}`, 5)
    if (!ok) return { success: false, error: 'Too many requests. Please wait a moment.' }

    // Ensure subscription exists and check credits
    await ensureSubscription(user.id)
    const credits = await checkCredits()
    if (!credits.allowed) {
      return {
        success: false,
        error: `No credits remaining on the ${credits.tier} plan. Upgrade for more.`,
        upgradeEligible: credits.tier === 'free',
      }
    }

    // For AI images, check if user has enough credits upfront (1 for carousel + ~6 for images)
    if (imageSource === 'ai') {
      const balance = await getCreditBalance(user.id)
      // Need 1 for carousel + estimated 6 for images = 7 minimum
      if (balance < 3) {
        return {
          success: false,
          error: `AI images need more credits. You have ${balance}, need at least 3. Upgrade or buy credits.`,
          upgradeEligible: true,
        }
      }
    }

    // Update status to generating
    await supabase
      .from('projects')
      .update({ generation_status: 'generating' })
      .eq('id', projectId)

    // Atomically deduct 1 credit before AI call
    const deducted = await deductCredit(user.id, 'carousel_generation', `Carousel: ${topic}`, projectId)
    if (!deducted) {
      return { success: false, error: 'Insufficient credits. Please try again.', upgradeEligible: true }
    }

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

    if (imageSource === 'ai') {
      // Generate a master visual style first so all slides look cohesive
      const masterStyle = await generateCarouselStyle(topic)

      // AI images: generate in batches of 2 to stay under Vercel timeout
      slides = [...aiSlides] as Slide[]
      const batchSize = 2

      for (let i = 0; i < slides.length; i += batchSize) {
        const batch = slides.slice(i, i + batchSize)
        const results = await Promise.all(
          batch.map(async (slide, batchIdx) => {
            const slideIdx = i + batchIdx
            try {
              const prompt = await generateImagePrompt(topic, slide.hook_text, slide.body_text, slide.is_cta, masterStyle, advancedOptions?.imagePrompt)
              const result = await generateImagenBackground(user.id, prompt, projectId, slideIdx)
              if ('url' in result) {
                return { ...slide, background_url: result.url, pexels_photo_id: null }
              }
            } catch { /* fall through to stock fallback */ }
            // Fallback to stock if AI fails (insufficient credits, safety filter, etc.)
            const photos = await searchPhotos(slide.image_query, { orientation: 'portrait', per_page: 1 })
            return {
              ...slide,
              background_url: photos[0]?.src.portrait ?? null,
              pexels_photo_id: photos[0]?.id ?? null,
            }
          })
        )
        // Replace slides in array
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
      slides = slides.map(slide => ({
        ...slide,
        style_overrides: {
          ...slide.style_overrides,
          ...(advancedOptions.font ? { hook_font_family: advancedOptions.font, body_font_family: advancedOptions.font } : {}),
          ...(advancedOptions.fontColor ? { hook_text_color: advancedOptions.fontColor, body_text_color: advancedOptions.fontColor } : {}),
        },
      }))
    }

    // 2c. Apply default text effects for readability (shadow + overlay).
    // News Drop / News Cyan run on a solid dark canvas with constrained images
    // — the readability shadows and overlay would just dirty the image zone, so skip them.
    if (!NEWS_TEMPLATES.has(templateId)) {
      slides = slides.map(slide => ({
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

    revalidatePath(`/project/${projectId}`)
    revalidatePath('/dashboard')
    return { success: true, slideCount: slides.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during generation'

    // Update status to error
    await supabase
      .from('projects')
      .update({ generation_status: 'error' })
      .eq('id', projectId)

    return { success: false, error: message }
  }
}

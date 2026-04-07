import { generateSlideContent } from '@/lib/ai/generate-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { generateImagePrompt, generateCarouselStyle } from '@/lib/imagen/generate-prompt'
import { generateImagenBackground } from '@/lib/imagen/generate-image'
import { deductCredit, getCreditBalance } from '@/lib/credits/check-credits'
import { checkCredits } from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Slide } from '@/lib/types/slide'

export interface CarouselServiceParams {
  projectId: string
  topic: string
  templateId: string
  imageSource: 'stock' | 'ai'
  slideCount: number
  advancedOptions?: { font?: string; fontColor?: string; imagePrompt?: string }
}

export type CarouselResult =
  | { success: true; slideCount: number }
  | { success: false; error: string; upgradeEligible?: boolean }

export async function generateCarouselService(
  userId: string,
  params: CarouselServiceParams,
  options?: { adminClient?: SupabaseClient }
): Promise<CarouselResult> {
  const supabase = options?.adminClient ?? await createClient()

  try {
    // Ensure subscription exists and check credits
    await ensureSubscription(userId)

    // Check credits -- use admin client path if available, otherwise cookie-based
    if (options?.adminClient) {
      const balance = await getCreditBalance(userId, options.adminClient)
      if (balance <= 0) {
        const { getUserTier } = await import('@/lib/credits/check-credits')
        const tier = await getUserTier(userId)
        return {
          success: false,
          error: `No credits remaining on the ${tier} plan. Upgrade for more.`,
          upgradeEligible: tier === 'free',
        }
      }
    } else {
      const credits = await checkCredits()
      if (!credits.allowed) {
        return {
          success: false,
          error: `No credits remaining on the ${credits.tier} plan. Upgrade for more.`,
          upgradeEligible: credits.tier === 'free',
        }
      }
    }

    // For AI images, check if user has enough credits upfront
    if (params.imageSource === 'ai') {
      const balance = await getCreditBalance(userId, options?.adminClient)
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
      .eq('id', params.projectId)

    // Atomically deduct 1 credit before AI call
    const deducted = await deductCredit(
      userId,
      'carousel_generation',
      `Carousel: ${params.topic}`,
      params.projectId,
      1,
      options?.adminClient
    )
    if (!deducted) {
      return { success: false, error: 'Insufficient credits. Please try again.', upgradeEligible: true }
    }

    // 1. Generate content with Gemini
    const clampedCount = Math.max(3, Math.min(20, params.slideCount))
    const carousel = await generateSlideContent(params.topic, clampedCount, params.advancedOptions?.imagePrompt)

    // 2. Fetch background images
    let slides: Slide[]

    if (params.imageSource === 'ai') {
      // Generate a master visual style first so all slides look cohesive
      const masterStyle = await generateCarouselStyle(params.topic)

      // AI images: generate in batches of 2 to stay under Vercel timeout
      slides = [...carousel.slides] as Slide[]
      const batchSize = 2

      for (let i = 0; i < slides.length; i += batchSize) {
        const batch = slides.slice(i, i + batchSize)
        const results = await Promise.all(
          batch.map(async (slide, batchIdx) => {
            const slideIdx = i + batchIdx
            try {
              const prompt = await generateImagePrompt(
                params.topic,
                slide.hook_text,
                slide.body_text,
                slide.is_cta,
                masterStyle,
                params.advancedOptions?.imagePrompt
              )
              const result = await generateImagenBackground(userId, prompt, params.projectId, slideIdx)
              if ('url' in result) {
                return { ...slide, background_url: result.url, pexels_photo_id: null }
              }
            } catch { /* fall through to stock fallback */ }
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
    if (params.advancedOptions?.font || params.advancedOptions?.fontColor) {
      slides = slides.map(slide => ({
        ...slide,
        style_overrides: {
          ...slide.style_overrides,
          ...(params.advancedOptions!.font ? { hook_font_family: params.advancedOptions!.font, body_font_family: params.advancedOptions!.font } : {}),
          ...(params.advancedOptions!.fontColor ? { hook_text_color: params.advancedOptions!.fontColor, body_text_color: params.advancedOptions!.fontColor } : {}),
        },
      }))
    }

    // 3. Save to database
    await supabase
      .from('projects')
      .update({
        slide_data: slides,
        template_id: params.templateId,
        title: carousel.title,
        topic: params.topic,
        generation_status: 'complete',
      })
      .eq('id', params.projectId)

    return { success: true, slideCount: slides.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during generation'

    // Update status to error
    await supabase
      .from('projects')
      .update({ generation_status: 'error' })
      .eq('id', params.projectId)

    return { success: false, error: message }
  }
}

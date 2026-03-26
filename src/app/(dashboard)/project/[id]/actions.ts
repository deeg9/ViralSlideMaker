'use server'

import { generateSlideContent } from '@/lib/ai/generate-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { generateImagePrompt } from '@/lib/imagen/generate-prompt'
import { generateImagenBackground } from '@/lib/imagen/generate-image'
import { createClient } from '@/lib/supabase/server'
import { checkCredits, deductCredit } from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'
import type { Slide } from '@/lib/types/slide'

export async function generateCarousel(
  projectId: string,
  topic: string,
  templateId: string,
  imageSource: 'stock' | 'ai' = 'stock'
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

    // 1. Generate content with Claude
    const carousel = await generateSlideContent(topic)

    // 2. Fetch background images for each slide
    let slides: Slide[]

    if (imageSource === 'ai') {
      // AI-generated images: generate prompt then image for each slide
      slides = await Promise.all(
        carousel.slides.map(async (slide, index) => {
          try {
            const prompt = await generateImagePrompt(topic, slide.hook_text, slide.body_text, slide.is_cta)
            const result = await generateImagenBackground(user.id, prompt, projectId, index)
            if ('url' in result) {
              return { ...slide, background_url: result.url, pexels_photo_id: null }
            }
          } catch { /* fall through to stock fallback */ }
          // Fallback to stock photo if AI generation fails
          const photos = await searchPhotos(slide.image_query, { orientation: 'portrait', per_page: 1 })
          return { ...slide, background_url: photos[0]?.src.portrait ?? null, pexels_photo_id: photos[0]?.id ?? null }
        })
      )
    } else {
      // Stock photos from Pexels
      slides = await Promise.all(
        carousel.slides.map(async (slide) => {
          const photos = await searchPhotos(slide.image_query, { orientation: 'portrait', per_page: 1 })
          return { ...slide, background_url: photos[0]?.src.portrait ?? null, pexels_photo_id: photos[0]?.id ?? null }
        })
      )
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

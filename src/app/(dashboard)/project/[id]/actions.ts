'use server'

import { generateSlideContent } from '@/lib/ai/generate-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { createClient } from '@/lib/supabase/server'
import { checkCredits, deductCredit } from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { revalidatePath } from 'next/cache'
import type { Slide } from '@/lib/types/slide'

export async function generateCarousel(
  projectId: string,
  topic: string,
  templateId: string
): Promise<{ success: true; slideCount: number } | { success: false; error: string }> {
  const supabase = await createClient()

  try {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Ensure subscription exists and check credits
    await ensureSubscription(user.id)
    const credits = await checkCredits()
    if (!credits.allowed) {
      return {
        success: false,
        error: `No credits remaining on the ${credits.tier} plan. Upgrade for more.`,
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
      return { success: false, error: 'Insufficient credits. Please try again.' }
    }

    // 1. Generate content with Claude
    const carousel = await generateSlideContent(topic)

    // 2. Fetch background images from Pexels for each slide
    const slides: Slide[] = await Promise.all(
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

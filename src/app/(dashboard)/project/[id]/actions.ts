'use server'

import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { generateCarouselService } from '@/lib/services/carousel'
import { revalidatePath } from 'next/cache'

export async function generateCarousel(
  projectId: string,
  topic: string,
  templateId: string,
  imageSource: 'stock' | 'ai' = 'stock',
  slideCount: number = 7,
  advancedOptions?: { font?: string; fontColor?: string; imagePrompt?: string }
): Promise<{ success: true; slideCount: number } | { success: false; error: string; upgradeEligible?: boolean }> {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Rate limit: 5-second cooldown between carousel generations
  const { ok } = rateLimit(`carousel:${user.id}`, 5)
  if (!ok) return { success: false, error: 'Too many requests. Please wait a moment.' }

  const result = await generateCarouselService(user.id, {
    projectId,
    topic,
    templateId,
    imageSource,
    slideCount,
    advancedOptions,
  })

  if (result.success) {
    revalidatePath(`/project/${projectId}`)
    revalidatePath('/dashboard')
  }

  return result
}

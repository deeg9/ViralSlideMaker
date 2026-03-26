'use server'

import { createClient } from '@/lib/supabase/server'
import { generateImagenBackground } from '@/lib/imagen/generate-image'
import { generateImagePrompt } from '@/lib/imagen/generate-prompt'
import { rateLimit } from '@/lib/rate-limit'
import type { ImagenResult } from '@/lib/imagen/generate-image'

export async function generateAIImageAction(
  projectId: string,
  slideIndex: number,
  prompt: string,
): Promise<ImagenResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Rate limit: 10 image generations per minute per user
  const { ok } = rateLimit(`imagen:${user.id}`, 10)
  if (!ok) return { error: 'Too many requests. Please wait a moment.' }

  return generateImagenBackground(user.id, prompt, projectId, slideIndex)
}

export async function generateImagePromptAction(
  topic: string,
  hookText: string,
  bodyText: string,
  isCta: boolean,
): Promise<string> {
  return generateImagePrompt(topic, hookText, bodyText, isCta)
}

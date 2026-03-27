import { GoogleGenAI } from '@google/genai'
import { deductCredit } from '@/lib/credits/check-credits'
import { createAdminClient } from '@/lib/supabase/admin'
import { CREDIT_COSTS } from '@/lib/credits/types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export type ImagenResult = { url: string } | { error: string; refunded?: boolean }

export async function generateImagenBackground(
  userId: string,
  prompt: string,
  projectId: string,
  slideIndex: number,
): Promise<ImagenResult> {
  // 1. Pre-deduct credits atomically (AI images cost 3 credits)
  const deducted = await deductCredit(
    userId,
    'imagen_generation',
    'AI background: ' + prompt.slice(0, 50),
    projectId,
    CREDIT_COSTS.imagen_generation,
  )
  if (!deducted) return { error: 'Insufficient credits (AI images cost 3 credits)' }

  try {
    // 2. Truncate prompt to 350 words max (Imagen has 480-token limit)
    const words = prompt.split(/\s+/)
    const truncatedPrompt = words.length > 350 ? words.slice(0, 350).join(' ') : prompt

    // 3. Call Imagen API
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt: truncatedPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '9:16',
        includeRaiReason: true,
      },
    })

    // 4. Check for safety filter
    const generated = response.generatedImages?.[0]
    if (!generated?.image?.imageBytes) {
      const reason = generated?.raiFilteredReason ?? 'Content filtered by safety policy'
      await refundCredit(userId, projectId)
      return { error: reason, refunded: true }
    }

    // 5. Upload to Supabase Storage
    const buffer = Buffer.from(generated.image.imageBytes, 'base64')
    const path = `${userId}/${projectId}/ai-${slideIndex}-${Date.now()}.png`
    const supabase = createAdminClient()
    await supabase.storage.from('slide-backgrounds').upload(path, buffer, {
      contentType: 'image/png',
    })
    const { data: publicData } = supabase.storage.from('slide-backgrounds').getPublicUrl(path)

    // 6. Return public URL
    return { url: publicData.publicUrl }
  } catch {
    // 7. API error -- refund the credit
    await refundCredit(userId, projectId)
    return { error: 'Image generation failed. Credit refunded.', refunded: true }
  }
}

async function refundCredit(userId: string, projectId: string) {
  const supabase = createAdminClient()
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: CREDIT_COSTS.imagen_generation,
    description: 'Imagen generation failed or filtered',
    reference_id: projectId,
  })
}

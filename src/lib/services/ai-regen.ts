import { GoogleGenAI, Type } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CREDIT_COSTS } from '@/lib/credits/types'
import type { Slide } from '@/lib/types/slide'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export async function regenerateSlideText(
  slide: Slide,
  topic: string,
  slideIndex: number,
  customPrompt?: string,
): Promise<{ hook_text: string; body_text: string }> {
  const userInstruction = customPrompt ? `\nUser instruction: "${customPrompt}"` : ''
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a fresh alternative hook_text and body_text for slide ${slideIndex + 1} of a TikTok carousel about "${topic}".
Current hook: "${slide.hook_text}"
Current body: "${slide.body_text}"
${slide.is_cta ? 'This is the closing CTA slide.' : ''}
Provide completely different text that is equally engaging.${userInstruction}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hook_text: { type: Type.STRING, description: 'New attention-grabbing hook text' },
          body_text: { type: Type.STRING, description: 'New supporting body text' },
        },
        required: ['hook_text', 'body_text'],
      },
    },
  })
  return JSON.parse(response.text!) as { hook_text: string; body_text: string }
}

export type ImagenAdminResult = { url: string } | { error: string; refunded?: boolean; status: number }

/**
 * Admin-client variant of generateImagenBackground from src/lib/imagen/generate-image.ts.
 * Used by the API-key code path where there is no auth.uid() context.
 */
export async function generateImagenBackgroundAdmin(
  admin: SupabaseClient,
  userId: string,
  prompt: string,
  projectId: string,
  slideIndex: number,
): Promise<ImagenAdminResult> {
  // 1. Pre-deduct credits
  const { data: deducted } = await admin.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: CREDIT_COSTS.imagen_generation,
    p_type: 'imagen_generation',
    p_description: `AI background: ${prompt.slice(0, 50)}`,
    p_reference_id: projectId,
  })
  if (deducted !== true) {
    return { error: `Insufficient credits (AI images cost ${CREDIT_COSTS.imagen_generation} credit)`, status: 402 }
  }

  try {
    const words = prompt.split(/\s+/)
    const truncatedPrompt = words.length > 350 ? words.slice(0, 350).join(' ') : prompt

    const response = await ai.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt: truncatedPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '9:16',
        includeRaiReason: true,
      },
    })

    const generated = response.generatedImages?.[0]
    if (!generated?.image?.imageBytes) {
      const reason = generated?.raiFilteredReason ?? 'Content filtered by safety policy'
      await refundCredit(admin, userId, projectId)
      return { error: reason, refunded: true, status: 400 }
    }

    const buffer = Buffer.from(generated.image.imageBytes, 'base64')
    const path = `${userId}/${projectId}/ai-${slideIndex}-${Date.now()}.png`
    await admin.storage.from('slide-backgrounds').upload(path, buffer, {
      contentType: 'image/png',
    })
    const { data: pub } = admin.storage.from('slide-backgrounds').getPublicUrl(path)
    return { url: pub.publicUrl }
  } catch {
    await refundCredit(admin, userId, projectId)
    return { error: 'Image generation failed. Credit refunded.', refunded: true, status: 500 }
  }
}

async function refundCredit(admin: SupabaseClient, userId: string, projectId: string) {
  await admin.from('credit_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: CREDIT_COSTS.imagen_generation,
    description: 'Imagen generation failed or filtered',
    reference_id: projectId,
  })
}

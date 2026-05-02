import { GoogleGenAI, Modality } from '@google/genai'
import { deductCredit } from '@/lib/credits/check-credits'
import { createAdminClient } from '@/lib/supabase/admin'
import { CREDIT_COSTS } from '@/lib/credits/types'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export type StylizeResult = { url: string } | { error: string; refunded?: boolean }

async function fetchAsBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    return { mimeType, data: buf.toString('base64') }
  } catch {
    return null
  }
}

export async function stylizeBackgroundFromPhoto(
  userId: string,
  photoUrl: string,
  stylePrompt: string,
  projectId: string,
  slideIndex: number,
): Promise<StylizeResult> {
  // 1. Pre-deduct a credit (same cost as a fresh AI generation).
  const deducted = await deductCredit(
    userId,
    'imagen_generation',
    'AI stylize: ' + stylePrompt.slice(0, 50),
    projectId,
    CREDIT_COSTS.imagen_generation,
  )
  if (!deducted) {
    return { error: `Insufficient credits (AI images cost ${CREDIT_COSTS.imagen_generation} credit)` }
  }

  try {
    // 2. Fetch the user's uploaded photo as inline data.
    const photo = await fetchAsBase64(photoUrl)
    if (!photo) {
      await refundCredit(userId, projectId)
      return { error: 'Could not load the uploaded photo. Credit refunded.', refunded: true }
    }

    // 3. Call Gemini's image-preview model with the photo as a reference.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Restyle the attached photo to match this visual direction: ${stylePrompt}\n\nKeep the photo's subject, composition, and recognizable content. Output a single 9:16 portrait image suitable for a TikTok slide background.`,
            },
            { inlineData: photo },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE],
      },
    })

    // 4. Extract the generated image bytes from the response parts.
    const parts = response.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p.inlineData?.data)
    if (!imagePart?.inlineData?.data) {
      await refundCredit(userId, projectId)
      return { error: 'No image returned by stylize model. Credit refunded.', refunded: true }
    }

    // 5. Upload to Supabase Storage.
    const buffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const path = `${userId}/${projectId}/stylize-${slideIndex}-${Date.now()}.png`
    const supabase = createAdminClient()
    await supabase.storage.from('slide-backgrounds').upload(path, buffer, {
      contentType: imagePart.inlineData.mimeType ?? 'image/png',
    })
    const { data: publicData } = supabase.storage.from('slide-backgrounds').getPublicUrl(path)

    return { url: publicData.publicUrl }
  } catch {
    await refundCredit(userId, projectId)
    return { error: 'Stylize failed. Credit refunded.', refunded: true }
  }
}

async function refundCredit(userId: string, projectId: string) {
  const supabase = createAdminClient()
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: CREDIT_COSTS.imagen_generation,
    description: 'Stylize generation failed or filtered',
    reference_id: projectId,
  })
}

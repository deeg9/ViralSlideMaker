'use server'

import { revalidatePath } from 'next/cache'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { searchPhotos } from '@/lib/pexels/search-photos'
import type { Slide } from '@/lib/types/slide'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// --- Save ---

export async function saveSlideData(
  projectId: string,
  slides: Slide[]
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('projects')
      .update({ slide_data: slides as unknown as Record<string, unknown>[] })
      .eq('id', projectId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath(`/project/${projectId}`)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// --- Pexels Search ---

export async function searchBackgroundPhotos(
  query: string
): Promise<{ id: number; url: string; thumbnail: string; photographer: string }[]> {
  if (!query.trim()) return []

  const photos = await searchPhotos(query, {
    orientation: 'portrait',
    per_page: 12,
  })

  return photos.map((photo) => ({
    id: photo.id,
    url: photo.src.original,
    thumbnail: photo.src.medium,
    photographer: photo.photographer,
  }))
}

// --- AI Regeneration: Text ---

export async function regenerateSlideText(
  projectId: string,
  slideIndex: number,
  topic: string,
  currentSlide: Slide
): Promise<{ hook_text: string; body_text: string }> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a fresh alternative hook_text and body_text for slide ${slideIndex + 1} of a TikTok carousel about "${topic}".
Current hook: "${currentSlide.hook_text}"
Current body: "${currentSlide.body_text}"
${currentSlide.is_cta ? 'This is the closing CTA slide.' : ''}
Provide completely different text that is equally engaging.`,
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

  return JSON.parse(response.text!)
}

// --- AI Regeneration: Image Query ---

export async function regenerateSlideImageQuery(
  topic: string,
  currentSlide: Slide
): Promise<{ image_query: string; background_url: string | null; pexels_photo_id: number | null }> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a new Pexels image search query for a TikTok carousel slide about "${topic}".
Current image query: "${currentSlide.image_query}"
Current hook: "${currentSlide.hook_text}"
Provide a different, specific search query that would find a great background photo.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          image_query: { type: Type.STRING, description: 'New Pexels search query' },
        },
        required: ['image_query'],
      },
    },
  })

  const { image_query } = JSON.parse(response.text!)

  // Search for the first matching photo
  const photos = await searchPhotos(image_query, {
    orientation: 'portrait',
    per_page: 1,
  })

  if (photos.length > 0) {
    return {
      image_query,
      background_url: photos[0].src.original,
      pexels_photo_id: photos[0].id,
    }
  }

  return {
    image_query,
    background_url: null,
    pexels_photo_id: null,
  }
}

// --- Upload ---

export async function createUploadUrl(
  projectId: string,
  fileName: string
): Promise<{ signedUrl: string; path: string; publicUrl: string }> {
  const supabase = await createClient()
  const path = `${projectId}/${Date.now()}-${fileName}`

  const { data, error } = await supabase.storage
    .from('slide-backgrounds')
    .createSignedUploadUrl(path)

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create upload URL')
  }

  const { data: publicData } = supabase.storage
    .from('slide-backgrounds')
    .getPublicUrl(path)

  return {
    signedUrl: data.signedUrl,
    path,
    publicUrl: publicData.publicUrl,
  }
}

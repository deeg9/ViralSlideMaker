'use server'

import { revalidatePath } from 'next/cache'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { generateCarouselStyle } from '@/lib/imagen/generate-prompt'
import { stylizeBackgroundFromPhoto, type StylizeResult } from '@/lib/imagen/stylize-image'
import { rateLimit } from '@/lib/rate-limit'
import { getUserTier } from '@/lib/credits/check-credits'
import type { Slide, SlideStyleOverrides } from '@/lib/types/slide'

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
  currentSlide: Slide,
  customPrompt?: string
): Promise<{ hook_text: string; body_text: string }> {
  const userInstruction = customPrompt ? `\nUser instruction: "${customPrompt}"` : ''
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a fresh alternative hook_text and body_text for slide ${slideIndex + 1} of a TikTok carousel about "${topic}".
Current hook: "${currentSlide.hook_text}"
Current body: "${currentSlide.body_text}"
${currentSlide.is_cta ? 'This is the closing CTA slide.' : ''}
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

  return JSON.parse(response.text!)
}

// --- AI Regeneration: Image Query ---

export async function regenerateSlideImageQuery(
  topic: string,
  currentSlide: Slide,
  customPrompt?: string
): Promise<{ image_query: string; background_url: string | null; pexels_photo_id: number | null }> {
  const userInstruction = customPrompt ? `\nUser instruction for the image: "${customPrompt}"` : ''
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a new Pexels image search query for a TikTok carousel slide about "${topic}".
Current image query: "${currentSlide.image_query}"
Current hook: "${currentSlide.hook_text}"
Provide a different, specific search query that would find a great background photo.${userInstruction}`,
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

// --- Template ---

export async function saveTemplateId(projectId: string, templateId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('projects')
    .update({ template_id: templateId })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  revalidatePath(`/project/${projectId}`)
}

// --- Upload ---

export async function createUploadUrl(
  projectId: string,
  fileName: string
): Promise<{ signedUrl: string; path: string; publicUrl: string }> {
  const { validateFileName } = await import('@/lib/upload-validation')
  const validationError = validateFileName(fileName)
  if (validationError) throw new Error(validationError)

  const supabase = await createClient()
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${projectId}/${Date.now()}-${safeName}`

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

// --- AI Stylize: turn an uploaded photo into a styled slide background ---

export async function stylizeSlidePhoto(
  projectId: string,
  slideIndex: number,
  photoUrl: string,
): Promise<StylizeResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Match the cooldown used by per-slide AI generation.
  const { ok } = rateLimit(`stylize:${user.id}`, 3)
  if (!ok) return { error: 'Too many requests. Please wait a moment.' }

  // Pull the project's topic to seed the master visual style.
  const { data: project, error } = await supabase
    .from('projects')
    .select('topic')
    .eq('id', projectId)
    .single()
  if (error || !project?.topic) {
    return { error: 'Could not load project context.' }
  }

  const stylePrompt = await generateCarouselStyle(project.topic)
  return stylizeBackgroundFromPhoto(user.id, photoUrl, stylePrompt, projectId, slideIndex)
}

// --- Phase 57 (EDITOR-01..02, D-01..D-03, D-27): per-slide treatment override ---

import { treatPhoto, type TreatmentPreset } from '@/lib/photo-treatment/treat'
import { extractPalette } from '@/lib/photo-treatment/palette'

export type TreatmentSpec = {
  kind: 'bw' | 'duotone-cream' | 'duotone-cobalt' | 'none'
  grain?: 'subtle' | 'medium' | 'heavy' | 'off'
}

/**
 * Phase 57 (D-01..D-03): apply per-slide photo treatment override.
 *
 * Treatment ALWAYS re-treats from `slide.original_source_url` — never
 * compounds on already-treated output (D-27). When `original_source_url`
 * is null on a legacy slide (pre-Phase 55), it is back-filled from
 * `background_url` BEFORE invoking treatPhoto.
 *
 * Algorithm (D-03):
 *   1. Back-fill original_source_url if null
 *   2. If kind === 'none': reset background_url to original; clear
 *      treatment_applied + derived_palette
 *   3. Otherwise: call treatPhoto + extractPalette; persist
 *   4. Always write spec.grain into style_overrides.grain_intensity
 *      (renderer-side override per D-09)
 */
export async function updateSlideTreatment(
  projectId: string,
  slideIndex: number,
  spec: TreatmentSpec,
): Promise<{ success: true; slide: Slide } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'unauthorized' }

    const { data: project, error: loadError } = await supabase
      .from('projects')
      .select('slide_data, user_id')
      .eq('id', projectId)
      .single()
    if (loadError || !project) {
      return { success: false, error: 'project not found' }
    }
    if (project.user_id !== user.id) {
      return { success: false, error: 'forbidden' }
    }

    const slides = ((project.slide_data ?? []) as unknown) as Slide[]
    const slide = slides[slideIndex]
    if (!slide) return { success: false, error: 'slide index out of range' }

    // STEP 1 (D-27): back-fill original_source_url if null
    if (!slide.original_source_url && slide.background_url) {
      slide.original_source_url = slide.background_url
    }

    // STEP 2: 'none' branch — reset to original, clear treatment fields
    if (spec.kind === 'none') {
      if (slide.original_source_url) {
        slide.background_url = slide.original_source_url
      }
      slide.style_overrides = {
        ...(slide.style_overrides ?? {}),
        treatment_applied: undefined,
        derived_palette: undefined,
      }
    } else {
      // STEP 3: treat + extract palette
      if (!slide.original_source_url) {
        return { success: false, error: 'no source photo to treat' }
      }
      const presetMap: Record<
        Exclude<TreatmentSpec['kind'], 'none'>,
        TreatmentPreset
      > = {
        'bw': { kind: 'bw' },
        'duotone-cream': { kind: 'duotone-cream' },
        'duotone-cobalt': { kind: 'duotone-cobalt' },
      }
      const preset = presetMap[spec.kind]
      const treated = await treatPhoto(slide.original_source_url, preset, user.id)
      slide.background_url = treated.url

      // Best-effort palette extraction (D-19): always re-extract on editor override
      let derived: string[] | undefined
      try {
        const named = await extractPalette(treated.url)
        derived = [
          named.Vibrant,
          named.DarkVibrant,
          named.LightVibrant,
          named.Muted,
          named.DarkMuted,
          named.LightMuted,
        ]
      } catch (e) {
        console.warn(
          '[updateSlideTreatment] extractPalette failed:',
          (e as Error).message,
        )
      }

      slide.style_overrides = {
        ...(slide.style_overrides ?? {}),
        treatment_applied: spec.kind,
        derived_palette: derived,
      }
    }

    // STEP 4 (D-09): grain intensity (renderer-side override)
    slide.style_overrides = {
      ...(slide.style_overrides ?? {}),
      grain_intensity: spec.grain,
    }

    slides[slideIndex] = slide

    const { error: saveError } = await supabase
      .from('projects')
      .update({ slide_data: slides as unknown as Record<string, unknown>[] })
      .eq('id', projectId)
    if (saveError) return { success: false, error: saveError.message }

    revalidatePath(`/project/${projectId}`)
    return { success: true, slide }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// --- quick-260502-er5: per-slide watermark ---

export type WatermarkSpec = NonNullable<SlideStyleOverrides['watermark']>

/**
 * Apply a watermark spec patch to a single slide.
 * Server-side tier enforcement (defense in depth — UI gates first):
 *   - free tier: rejected when attempting to set `enabled: false` or
 *     `customLogoUrl`. Position changes also rejected.
 *   - paid tier: all fields honored, customLogoUrl validated as a URL we
 *     trust (Supabase Storage public URL).
 */
export async function updateSlideWatermark(
  projectId: string,
  slideIndex: number,
  patch: WatermarkSpec,
): Promise<{ success: true; slide: Slide } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'unauthorized' }

    const tier = await getUserTier(user.id)
    const isPaid = tier === 'plus' || tier === 'pro'
    if (!isPaid) {
      // Free tier cannot toggle off, set custom logo, or change position.
      // The UI prevents these, but defense in depth ensures the API can't be
      // bypassed by a crafted client request.
      return { success: false, error: 'paid tier required to customize watermark' }
    }

    const { data: project, error: loadError } = await supabase
      .from('projects')
      .select('slide_data, user_id')
      .eq('id', projectId)
      .single()
    if (loadError || !project) {
      return { success: false, error: 'project not found' }
    }
    if (project.user_id !== user.id) {
      return { success: false, error: 'forbidden' }
    }

    const slides = ((project.slide_data ?? []) as unknown) as Slide[]
    const slide = slides[slideIndex]
    if (!slide) return { success: false, error: 'slide index out of range' }

    const existing = slide.style_overrides?.watermark ?? {}
    slide.style_overrides = {
      ...(slide.style_overrides ?? {}),
      watermark: { ...existing, ...patch },
    }
    slides[slideIndex] = slide

    const { error: saveError } = await supabase
      .from('projects')
      .update({ slide_data: slides as unknown as Record<string, unknown>[] })
      .eq('id', projectId)
    if (saveError) return { success: false, error: saveError.message }

    revalidatePath(`/project/${projectId}`)
    return { success: true, slide }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

'use server'

import { generateSlideContent } from '@/lib/ai/generate-slides'
import { matchPhotosToSlides } from '@/lib/ai/match-photos-to-slides'
import { searchPhotos } from '@/lib/pexels/search-photos'
import { generateImagePrompt, generateCarouselStyle } from '@/lib/imagen/generate-prompt'
import { generateImagenBackground } from '@/lib/imagen/generate-image'
import { createClient } from '@/lib/supabase/server'
import { checkCredits, deductCredit, getCreditBalance, getUserTier } from '@/lib/credits/check-credits'
import { ensureSubscription } from '@/lib/credits/ensure-subscription'
import { rateLimit } from '@/lib/rate-limit'
import { revalidatePath } from 'next/cache'
import type { Slide } from '@/lib/types/slide'
import { getTemplate } from '@/lib/render/templates'
import { treatPhoto, type TreatmentPreset } from '@/lib/photo-treatment/treat'
import { extractPalette } from '@/lib/photo-treatment/palette'

// Templates that share the news-carousel skip-default-effects behavior.
// Keep this list in sync with src/lib/ai/prompts.ts and src/lib/services/carousel.ts.
const NEWS_TEMPLATES = new Set(['news-drop', 'news-cyan'])

export async function generateCarousel(
  projectId: string,
  topic: string,
  templateId: string,
  imageSource: 'stock' | 'ai' = 'stock',
  slideCount: number = 7,
  advancedOptions?: { font?: string; fontColor?: string; imagePrompt?: string; uploadedImageUrls?: string[] }
): Promise<{ success: true; slideCount: number } | { success: false; error: string; upgradeEligible?: boolean }> {
  const supabase = await createClient()

  try {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // Mirror the client-side MAX_UPLOADS cap on the server.
    if ((advancedOptions?.uploadedImageUrls?.length ?? 0) > 20) {
      return { success: false, error: 'You can attach at most 20 photos.' }
    }

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

    // Free-tier slide-count cap (matches client-side gate in generation-form.tsx)
    const tier = await getUserTier(user.id)
    const FREE_TIER_MAX_SLIDES = 3
    if (tier === 'free' && slideCount > FREE_TIER_MAX_SLIDES) {
      return {
        success: false,
        error: `Free plan is limited to ${FREE_TIER_MAX_SLIDES} slides. Upgrade for up to 10.`,
        upgradeEligible: true,
      }
    }

    // For AI images, ensure they can afford at least 1 carousel + 1 AI image = 2 credits.
    // Mid-generation, individual AI images that exhaust the balance fall back to stock automatically.
    if (imageSource === 'ai') {
      const balance = await getCreditBalance(user.id)
      if (balance < 2) {
        return {
          success: false,
          error: `AI images need more credits. You have ${balance}, need at least 2. Upgrade or buy credits.`,
          upgradeEligible: true,
        }
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

    // 1. Generate content with Gemini (templateId steers the prompt for templates like News Drop)
    const clampedCount = Math.max(3, Math.min(10, slideCount))
    const carousel = await generateSlideContent(topic, clampedCount, advancedOptions?.imagePrompt, templateId)

    // 2. Fetch background images
    let slides: Slide[]

    // Lift AI-emitted `layout` from the slide root into style_overrides.layout to match the Slide model.
    const aiSlides = carousel.slides.map((s) => {
      const { layout, ...rest } = s
      return layout
        ? { ...rest, style_overrides: { layout } }
        : rest
    })

    if (imageSource === 'ai') {
      // Generate a master visual style first so all slides look cohesive
      const masterStyle = await generateCarouselStyle(topic)

      // AI images: generate in batches of 2 to stay under Vercel timeout
      slides = [...aiSlides] as Slide[]
      const batchSize = 2

      for (let i = 0; i < slides.length; i += batchSize) {
        const batch = slides.slice(i, i + batchSize)
        const results = await Promise.all(
          batch.map(async (slide, batchIdx) => {
            const slideIdx = i + batchIdx
            try {
              const prompt = await generateImagePrompt(topic, slide.hook_text, slide.body_text, slide.is_cta, masterStyle, advancedOptions?.imagePrompt)
              const result = await generateImagenBackground(user.id, prompt, projectId, slideIdx)
              if ('url' in result) {
                return { ...slide, background_url: result.url, pexels_photo_id: null }
              }
            } catch { /* fall through to stock fallback */ }
            // Fallback to stock if AI fails (insufficient credits, safety filter, etc.)
            const photos = await searchPhotos(slide.image_query, { orientation: 'portrait', per_page: 1 })
            return {
              ...slide,
              background_url: photos[0]?.src.portrait ?? null,
              pexels_photo_id: photos[0]?.id ?? null,
            }
          })
        )
        // Replace slides in array
        for (let j = 0; j < results.length; j++) {
          slides[i + j] = results[j]
        }
      }
    } else {
      // Stock photos from Pexels (fast, parallel)
      slides = await Promise.all(
        aiSlides.map(async (slide) => {
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

    // 2a-bis. User-uploaded photos override slide backgrounds. Gemini matches each
    // photo to the slide whose copy it best fits; on any error the matcher falls
    // back to index order so behavior never gets worse than today.
    const uploaded = advancedOptions?.uploadedImageUrls?.filter((u): u is string => typeof u === 'string' && u.length > 0) ?? []
    const usable = uploaded.slice(0, clampedCount)
    if (usable.length > 0) {
      const assignments = await matchPhotosToSlides(slides, usable)
      slides = slides.map((slide, idx) =>
        assignments[idx]
          ? { ...slide, background_url: assignments[idx]!, pexels_photo_id: null }
          : slide
      )
    }

    // 2a-ter. Phase 56 (TPL-01, D-27): server-side photo treatment when the
    // selected template declares photoTreatment. Best-effort — never blocks
    // generation on failure (falls through to original URL). Writes:
    //   slide.background_url     → treated URL
    //   slide.original_source_url → original (untreated) URL — preserved so
    //                              re-treatment in editor never compounds
    //   slide.style_overrides.treatment_applied → preset descriptor
    {
      const template = getTemplate(templateId)
      if (template.photoTreatment) {
        const presetKind = template.photoTreatment
        const spec: TreatmentPreset =
          presetKind === 'bw'
            ? { kind: 'bw' }
            : presetKind === 'duotone-cream'
              ? { kind: 'duotone-cream' }
              : presetKind === 'duotone-cobalt'
                ? { kind: 'duotone-cobalt' }
                : { kind: 'contrast-bump' }
        slides = await Promise.all(
          slides.map(async (slide) => {
            const originalUrl = slide.background_url
            if (!originalUrl) return slide
            try {
              const result = await treatPhoto(originalUrl, spec, user.id)

              // Phase 57 (PALETTE-02, D-17, D-18): for palette-dominant templates,
              // use @vibrant/node named-role palette instead of the sharp-stats
              // dominant/clusters (which work for the 3 fixed-mode premium templates
              // but lack semantic role labels Vibrant/DarkMuted needed for accent
              // resolution in editorial-serif + notes-app-chic).
              let derivedPalette: string[] = [
                result.palette.dominant.hex,
                result.palette.cluster1.hex,
                result.palette.cluster2.hex,
                result.palette.cluster3.hex,
              ]
              if (template.paletteMode === 'palette-dominant') {
                try {
                  const named = await extractPalette(result.url)
                  derivedPalette = [
                    named.Vibrant,
                    named.DarkVibrant,
                    named.LightVibrant,
                    named.Muted,
                    named.DarkMuted,
                    named.LightMuted,
                  ]
                } catch (paletteErr) {
                  console.warn(
                    '[gen] extractPalette failed; falling back to sharp clusters',
                    paletteErr,
                  )
                  // best-effort: derivedPalette stays as the 4-entry sharp-cluster array
                }
              }

              return {
                ...slide,
                background_url: result.url,
                original_source_url: originalUrl,
                style_overrides: {
                  ...(slide.style_overrides ?? {}),
                  treatment_applied: presetKind,
                  derived_palette: derivedPalette,
                },
              }
            } catch (err) {
              console.error('[gen] treatPhoto failed; falling back to original url', err)
              // Treatment is best-effort — preserve original_source_url for editor re-treat path
              return { ...slide, original_source_url: originalUrl }
            }
          }),
        )
      }
    }

    // 2b. Apply advanced font/color overrides
    if (advancedOptions?.font || advancedOptions?.fontColor) {
      slides = slides.map(slide => ({
        ...slide,
        style_overrides: {
          ...slide.style_overrides,
          ...(advancedOptions.font ? { hook_font_family: advancedOptions.font, body_font_family: advancedOptions.font } : {}),
          ...(advancedOptions.fontColor ? { hook_text_color: advancedOptions.fontColor, body_text_color: advancedOptions.fontColor } : {}),
        },
      }))
    }

    // 2c. Apply default text effects for readability (shadow + overlay).
    // News Drop / News Cyan run on a solid dark canvas with constrained images
    // — the readability shadows and overlay would just dirty the image zone, so skip them.
    if (!NEWS_TEMPLATES.has(templateId)) {
      slides = slides.map(slide => ({
        ...slide,
        style_overrides: {
          ...slide.style_overrides,
          overlay_opacity: slide.style_overrides?.overlay_opacity ?? 45,
          hook_text_effects: slide.style_overrides?.hook_text_effects ?? {
            shadow: { enabled: true, color: '#000000aa', size: 'lg' },
          },
          body_text_effects: slide.style_overrides?.body_text_effects ?? {
            shadow: { enabled: true, color: '#000000aa', size: 'md' },
          },
        },
      }))
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

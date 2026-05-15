import { createHash } from 'node:crypto'
import { GoogleGenAI, Type, type Schema } from '@google/genai'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GEMINI_TEXT_MODEL } from '@/lib/ai/gemini-model'
import type { Slide } from '@/lib/types/slide'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

// Phase 58 (MATCH-03, D-09): cap photos per call. Excess fall through to
// index-order downstream.
export const MAX_PHOTOS = 8

// Phase 58 (MATCH-04, D-09): hard timeout on Gemini call.
const TIMEOUT_MS = 10_000

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    assignments: {
      type: Type.ARRAY,
      description:
        'Each entry maps one photo to one slide. Each photoIndex appears at most once. Slides without a good match are simply omitted.',
      items: {
        type: Type.OBJECT,
        properties: {
          slideIndex: { type: Type.INTEGER, description: 'Zero-based slide index' },
          photoIndex: { type: Type.INTEGER, description: 'Zero-based photo index' },
        },
        required: ['slideIndex', 'photoIndex'],
      },
    },
  },
  required: ['assignments'],
}

function indexOrderFallback(slides: Slide[], photoUrls: string[]): (string | null)[] {
  return slides.map((_, idx) => (idx < photoUrls.length ? photoUrls[idx] : null))
}

async function fetchAsInlineData(
  url: string,
): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mimeType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    return { inlineData: { mimeType, data: buf.toString('base64') } }
  } catch {
    return null
  }
}

// Phase 58 (MATCH-03, D-07): SHA-256 cache key helpers.
function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function makePhotoSetKey(photoUrls: string[]): string {
  return sha256(JSON.stringify([...photoUrls].sort()))
}

function makeSlideManifestKey(slides: Slide[]): string {
  return sha256(
    JSON.stringify(
      slides.map((s) => ({ hook: s.hook_text, body: s.body_text, is_cta: s.is_cta })),
    ),
  )
}

export interface MatchOptions {
  /** User UUID for credit ledger attribution. */
  userId: string
  /** Service-role Supabase client for cache + credit_transactions writes. */
  admin: SupabaseClient
}

/**
 * Phase 58 (MATCH-01..05): premium-tier photo↔slide matching.
 *
 * - Caps photos at MAX_PHOTOS (excess falls through to index-order).
 * - Looks up cached result by (photoSetSHA256, slideManifestSHA256).
 * - Charges 1 credit (`gemini_vision_match`) BEFORE Gemini call; refunds
 *   on timeout, error, or zero-assignment outcome.
 * - 10-second timeout via Promise.race; timeout/error → index-order
 *   fallback (never blocks generation).
 *
 * The premium-tier gate lives in the CALLER (actions.ts). When `options`
 * is omitted (tests, free-tier callers, other entry points), this function
 * behaves identically to the parked file: no cache, no credit ledger,
 * full-Gemini path with the same MAX_PHOTOS + 10s timeout protections.
 */
export async function matchPhotosToSlides(
  slides: Slide[],
  photoUrls: string[],
  options?: MatchOptions,
): Promise<(string | null)[]> {
  if (photoUrls.length === 0) return slides.map(() => null)

  // Phase 58 (MATCH-03): cap photos.
  const capped = photoUrls.slice(0, MAX_PHOTOS)

  // Phase 58 (MATCH-03): cache lookup BEFORE Gemini call.
  let photoKey = ''
  let slideKey = ''
  if (options) {
    photoKey = makePhotoSetKey(capped)
    slideKey = makeSlideManifestKey(slides)
    try {
      const { data: cached } = await options.admin
        .from('match_photo_cache')
        .select('result_jsonb')
        .eq('photo_set_sha256', photoKey)
        .eq('slide_manifest_sha256', slideKey)
        .maybeSingle()
      if (cached?.result_jsonb) {
        // Cache HIT — no Gemini call, no credit charge.
        return cached.result_jsonb as (string | null)[]
      }
    } catch (err) {
      console.warn('[match-photos] cache lookup failed; proceeding to Gemini:', err)
    }
  }

  // Phase 58 (MATCH-05, D-10): charge 1 credit BEFORE Gemini call. Refund
  // on any failure outcome (timeout, error, 0 assignments). Mirrors the
  // imagen_generation refund pattern in src/lib/services/ai-regen.ts.
  let creditCharged = false
  if (options) {
    try {
      await options.admin.from('credit_transactions').insert({
        user_id: options.userId,
        type: 'gemini_vision_match',
        amount: 1,
        description: 'Premium photo↔slide matching (8 photo cap, 10s timeout)',
        reference_id: null,
      })
      creditCharged = true
    } catch (err) {
      console.warn(
        '[match-photos] credit charge failed; falling back to index order:',
        err,
      )
      return indexOrderFallback(slides, capped)
    }
  }

  const refundIfNeeded = async (reason: string) => {
    if (creditCharged && options) {
      try {
        await options.admin.from('credit_transactions').insert({
          user_id: options.userId,
          type: 'refund',
          amount: 1,
          description: `Refund: photo-match ${reason}`,
          reference_id: null,
        })
      } catch (err) {
        console.warn('[match-photos] refund insert failed:', err)
      }
    }
  }

  try {
    const photoParts = await Promise.all(capped.map(fetchAsInlineData))
    if (photoParts.some((p) => p === null)) {
      await refundIfNeeded('photo fetch failed')
      return indexOrderFallback(slides, capped)
    }

    const slideManifest = slides
      .map(
        (s, i) =>
          `Slide ${i}: hook="${s.hook_text}" | body="${s.body_text}"${s.is_cta ? ' | (closing CTA)' : ''}`,
      )
      .join('\n')

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
    parts.push({
      text: `You are matching user-uploaded photos to TikTok carousel slides by content fit.\n\nSlides:\n${slideManifest}\n\nPhotos follow, in order (photo 0, photo 1, ...). Inspect each photo and assign it to the slide whose hook+body it best illustrates.\n\nRules:\n- Each photoIndex must appear AT MOST ONCE in your assignments.\n- A slide without a clearly fitting photo should be omitted (do not force a bad match).\n- Prefer literal subject-matter fit (a YouTube screenshot belongs on a slide about YouTube).\n- If two photos could fit one slide, pick the better fit; the other photo can either go on a different slide or be omitted.\n- Return assignments in any order.`,
    })
    capped.forEach((_, i) => {
      parts.push({ text: `Photo ${i}:` })
      parts.push(photoParts[i]!)
    })

    // Phase 58 (MATCH-04): Promise.race against 10s timeout. Timeout/error
    // → fall through to index-order (never blocks generation).
    const geminiPromise = ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema,
      },
    })
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('match-photos timeout (10s)')), TIMEOUT_MS),
    )
    const response = await Promise.race([geminiPromise, timeoutPromise])

    if (!response.text) {
      await refundIfNeeded('empty response')
      return indexOrderFallback(slides, capped)
    }

    const parsed = JSON.parse(response.text) as {
      assignments?: Array<{ slideIndex: number; photoIndex: number }>
    }
    const assignments = parsed.assignments ?? []

    const result: (string | null)[] = slides.map(() => null)
    const usedPhotos = new Set<number>()
    for (const { slideIndex, photoIndex } of assignments) {
      if (
        Number.isInteger(slideIndex) &&
        Number.isInteger(photoIndex) &&
        slideIndex >= 0 &&
        slideIndex < slides.length &&
        photoIndex >= 0 &&
        photoIndex < capped.length &&
        !usedPhotos.has(photoIndex) &&
        result[slideIndex] === null
      ) {
        result[slideIndex] = capped[photoIndex]
        usedPhotos.add(photoIndex)
      }
    }

    // If the model returned nothing usable, fall back to index order so the
    // user's uploads aren't silently dropped.
    if (usedPhotos.size === 0) {
      await refundIfNeeded('zero assignments')
      return indexOrderFallback(slides, capped)
    }

    // Phase 58 (MATCH-03): cache successful result.
    if (options) {
      try {
        await options.admin.from('match_photo_cache').upsert({
          photo_set_sha256: photoKey,
          slide_manifest_sha256: slideKey,
          result_jsonb: result,
        })
      } catch (err) {
        console.warn('[match-photos] cache write failed (best-effort):', err)
      }
    }

    return result
  } catch (err) {
    console.warn('[match-photos] fell back to index order:', err)
    await refundIfNeeded('caught error')
    return indexOrderFallback(slides, capped)
  }
}

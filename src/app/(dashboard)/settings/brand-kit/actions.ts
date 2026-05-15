'use server'

import { revalidatePath } from 'next/cache'
import { GoogleGenAI, Type } from '@google/genai'
import { createClient } from '@/lib/supabase/server'
import type { BrandKit } from '@/lib/types/brand-kit'
import { rateLimit } from '@/lib/rate-limit'
import { getUserTier } from '@/lib/credits/check-credits'
import { FONT_CATALOG } from '@/lib/fonts/font-catalog'
import { GEMINI_TEXT_MODEL } from '@/lib/ai/gemini-model'

export async function getBrandKit(): Promise<BrandKit | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (data as BrandKit) ?? null
}

export async function saveBrandKit(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const name = (formData.get('name') as string) || 'My Brand'
    const primary_color = (formData.get('primary_color') as string) || null
    const secondary_color = (formData.get('secondary_color') as string) || null
    const text_color = (formData.get('text_color') as string) || null
    const background_color =
      (formData.get('background_color') as string) || null
    const font_family = (formData.get('font_family') as string) || null
    const logo_url = (formData.get('logo_url') as string) || null

    // Brand-kit-as-template fields (260427-bkt). Empty string → null.
    const accent_color = (formData.get('accent_color') as string) || null
    const heading_font_family = (formData.get('heading_font_family') as string) || null
    const body_font_family = (formData.get('body_font_family') as string) || null

    const ALLOWED_TEXT_ALIGN = new Set(['left', 'center', 'right'])
    const rawAlign = formData.get('text_align')
    const text_align =
      typeof rawAlign === 'string' && ALLOWED_TEXT_ALIGN.has(rawAlign) ? rawAlign : null

    const ALLOWED_TEXT_POSITION = new Set(['top', 'center', 'bottom'])
    const rawPosition2 = formData.get('text_position')
    const text_position =
      typeof rawPosition2 === 'string' && ALLOWED_TEXT_POSITION.has(rawPosition2) ? rawPosition2 : null

    const ALLOWED_HOOK_STYLE = new Set(['uppercase', 'normal', 'italic'])
    const rawHook = formData.get('hook_style')
    const hook_style =
      typeof rawHook === 'string' && ALLOWED_HOOK_STYLE.has(rawHook) ? rawHook : null

    const rawOverlay = formData.get('overlay_opacity_pct')
    let overlay_opacity_pct: number | null = null
    if (typeof rawOverlay === 'string' && rawOverlay !== '' && rawOverlay !== 'null') {
      const parsed = parseInt(rawOverlay, 10)
      if (!isNaN(parsed)) {
        overlay_opacity_pct = Math.min(100, Math.max(0, parsed))
      }
    }

    // Watermark fields (260427-hut). Treat empty / "null" string as null;
    // clamp size to 4–20 and opacity to 10–100 server-side as defense-in-depth.
    const ALLOWED_POSITIONS = new Set([
      'top-left', 'top-center', 'top-right',
      'middle-left', 'middle-center', 'middle-right',
      'bottom-left', 'bottom-center', 'bottom-right',
    ])
    const rawPosition = formData.get('logo_position')
    const positionStr =
      typeof rawPosition === 'string' && rawPosition !== '' && rawPosition !== 'null'
        ? rawPosition
        : null
    const logo_position = positionStr && ALLOWED_POSITIONS.has(positionStr) ? positionStr : null

    const rawSize = formData.get('logo_size_pct')
    let logo_size_pct: number | null = null
    if (typeof rawSize === 'string' && rawSize !== '' && rawSize !== 'null') {
      const parsed = parseInt(rawSize, 10)
      if (!isNaN(parsed)) {
        logo_size_pct = Math.min(20, Math.max(4, parsed))
      }
    }

    const rawOpacity = formData.get('logo_opacity_pct')
    let logo_opacity_pct: number | null = null
    if (typeof rawOpacity === 'string' && rawOpacity !== '' && rawOpacity !== 'null') {
      const parsed = parseInt(rawOpacity, 10)
      if (!isNaN(parsed)) {
        logo_opacity_pct = Math.min(100, Math.max(10, parsed))
      }
    }

    const { error } = await supabase.from('brand_kits').upsert(
      {
        user_id: user.id,
        name,
        primary_color,
        secondary_color,
        text_color,
        background_color,
        font_family,
        logo_url,
        logo_position,
        logo_size_pct,
        logo_opacity_pct,
        accent_color,
        heading_font_family,
        body_font_family,
        text_align,
        text_position,
        hook_style,
        overlay_opacity_pct,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/settings/brand-kit')
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// --- Style extraction from reference screenshot (260428-sty) ---
//
// Vision-driven Brand Kit auto-fill. User uploads a screenshot of a carousel
// they like; Gemini 2.5 Flash extracts visual style features and we snap fonts
// to FONT_CATALOG so we never claim a font we can't render.

export type StyleExtraction = {
  primary_color: string
  secondary_color: string
  accent_color: string
  background_color: string
  text_color: string
  heading_font_family: string
  body_font_family: string
  text_align: 'left' | 'center' | 'right'
  text_position: 'top' | 'center' | 'bottom'
  hook_style: 'uppercase' | 'normal' | 'italic'
  overlay_opacity_pct: number
  confidence: { fonts: number; colors: number; layout: number }
}

export type ExtractStyleResult =
  | { success: true; style: StyleExtraction }
  | { success: false; error: string; retryAfterSec?: number }

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const ALLOWED_ALIGN = new Set(['left', 'center', 'right'])
const ALLOWED_POSITION = new Set(['top', 'center', 'bottom'])
const ALLOWED_HOOK_STYLE = new Set(['uppercase', 'normal', 'italic'])

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function snapFont(family: string): string {
  const normalized = family.trim().toLowerCase()
  const exact = FONT_CATALOG.find((f) => f.family.toLowerCase() === normalized)
  if (exact) return exact.family
  // Fuzzy: first catalog entry whose family is contained in the requested string.
  const partial = FONT_CATALOG.find((f) =>
    normalized.includes(f.family.toLowerCase())
  )
  return partial?.family ?? 'Inter'
}

function sanitizeStyle(raw: unknown): StyleExtraction | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const hex = (k: string, fallback: string): string => {
    const v = typeof r[k] === 'string' ? (r[k] as string) : ''
    return HEX_RE.test(v) ? v.toLowerCase() : fallback
  }
  const enumStr = <T extends string>(
    k: string,
    allowed: Set<string>,
    fallback: T
  ): T => {
    const v = typeof r[k] === 'string' ? (r[k] as string) : ''
    return allowed.has(v) ? (v as T) : fallback
  }
  const num = (k: string, fallback: number, lo: number, hi: number): number => {
    const v = typeof r[k] === 'number' ? (r[k] as number) : Number(r[k])
    return Number.isFinite(v) ? clamp(v, lo, hi) : fallback
  }
  const conf = (r.confidence ?? {}) as Record<string, unknown>
  const confNum = (k: string): number => {
    const v = typeof conf[k] === 'number' ? (conf[k] as number) : Number(conf[k])
    return Number.isFinite(v) ? clamp(v, 0, 1) : 0.5
  }
  return {
    primary_color: hex('primary_color', '#000000'),
    secondary_color: hex('secondary_color', '#ffffff'),
    accent_color: hex('accent_color', '#ff3b30'),
    background_color: hex('background_color', '#1a1a2e'),
    text_color: hex('text_color', '#ffffff'),
    heading_font_family: snapFont(typeof r.heading_font_family === 'string' ? (r.heading_font_family as string) : 'Inter'),
    body_font_family: snapFont(typeof r.body_font_family === 'string' ? (r.body_font_family as string) : 'Inter'),
    text_align: enumStr('text_align', ALLOWED_ALIGN, 'center'),
    text_position: enumStr('text_position', ALLOWED_POSITION, 'center'),
    hook_style: enumStr('hook_style', ALLOWED_HOOK_STYLE, 'uppercase'),
    overlay_opacity_pct: Math.round(num('overlay_opacity_pct', 0, 0, 100)),
    confidence: {
      fonts: confNum('fonts'),
      colors: confNum('colors'),
      layout: confNum('layout'),
    },
  }
}

export async function extractStyleFromImage(
  formData: FormData
): Promise<ExtractStyleResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'No reference image provided' }
  }
  const { validateImageFile } = await import('@/lib/upload-validation')
  const validationError = validateImageFile(file)
  if (validationError) return { success: false, error: validationError }

  // Tiered cooldown: free = 24h, paid = 30s. In-memory limiter (good enough for
  // single-instance dev/staging). Promote to Upstash Redis when sharded.
  const tier = await getUserTier(user.id)
  const cooldown = tier === 'free' ? 24 * 60 * 60 : 30
  const { ok } = rateLimit(`bk-extract:${user.id}`, cooldown)
  if (!ok) {
    return {
      success: false,
      error:
        tier === 'free'
          ? 'Free plan is limited to 1 reference extract per day. Upgrade for unlimited.'
          : 'Please wait a moment before extracting another reference.',
      retryAfterSec: cooldown,
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { success: false, error: 'AI is not configured.' }

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const base64 = buf.toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const fontMenu = FONT_CATALOG.map((f) => f.family).join(', ')

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a brand designer extracting visual style from a reference screenshot of a social-media carousel.
Return JSON describing the style. Match the *style*, not the literal content.

Hard rules:
- All color fields MUST be 7-character lowercase hex (e.g. "#1a1a2e").
- heading_font_family and body_font_family MUST be picked from this list (closest match by feel — weight, contrast, serif/sans/display): ${fontMenu}.
- text_align ∈ {left, center, right}.
- text_position ∈ {top, center, bottom} — where the hook text sits on the canvas.
- hook_style ∈ {uppercase, normal, italic} — describe the hook's case treatment.
- overlay_opacity_pct: integer 0-100. 0 means no overlay over the background image; higher means a darker scrim.
- confidence.fonts, confidence.colors, confidence.layout: 0.0-1.0 reflecting how clearly each was readable in the image.

Pick a single dominant aesthetic — if the reference uses multiple slides with varying styles, infer the overarching brand identity.`,
            },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primary_color: { type: Type.STRING },
            secondary_color: { type: Type.STRING },
            accent_color: { type: Type.STRING },
            background_color: { type: Type.STRING },
            text_color: { type: Type.STRING },
            heading_font_family: { type: Type.STRING },
            body_font_family: { type: Type.STRING },
            text_align: { type: Type.STRING, enum: ['left', 'center', 'right'] },
            text_position: { type: Type.STRING, enum: ['top', 'center', 'bottom'] },
            hook_style: { type: Type.STRING, enum: ['uppercase', 'normal', 'italic'] },
            overlay_opacity_pct: { type: Type.NUMBER },
            confidence: {
              type: Type.OBJECT,
              properties: {
                fonts: { type: Type.NUMBER },
                colors: { type: Type.NUMBER },
                layout: { type: Type.NUMBER },
              },
              required: ['fonts', 'colors', 'layout'],
            },
          },
          required: [
            'primary_color',
            'secondary_color',
            'accent_color',
            'background_color',
            'text_color',
            'heading_font_family',
            'body_font_family',
            'text_align',
            'text_position',
            'hook_style',
            'overlay_opacity_pct',
            'confidence',
          ],
        },
      },
    })

    const text = response.text
    if (!text) return { success: false, error: 'AI returned an empty response.' }
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { success: false, error: 'AI returned malformed JSON.' }
    }
    const style = sanitizeStyle(parsed)
    if (!style) return { success: false, error: 'AI returned an unexpected shape.' }
    return { success: true, style }
  } catch (err) {
    return { success: false, error: (err as Error).message || 'Style extraction failed.' }
  }
}

export async function uploadLogo(
  formData: FormData
): Promise<{ publicUrl: string } | { error: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Not authenticated' }
    }

    const file = formData.get('file') as File
    const { validateImageFile } = await import('@/lib/upload-validation')
    const validationError = validateImageFile(file)
    if (validationError) return { error: validationError }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `logos/${user.id}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage
      .from('slide-backgrounds')
      .upload(path, file)

    if (error) {
      return { error: error.message }
    }

    const { data: publicData } = supabase.storage
      .from('slide-backgrounds')
      .getPublicUrl(path)

    return { publicUrl: publicData.publicUrl }
  } catch (err) {
    return { error: (err as Error).message }
  }
}

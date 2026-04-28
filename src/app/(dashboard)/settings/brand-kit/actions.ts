'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { BrandKit } from '@/lib/types/brand-kit'

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

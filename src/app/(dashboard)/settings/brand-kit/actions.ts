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
    if (!file || file.size === 0) {
      return { error: 'No file provided' }
    }

    const path = `logos/${user.id}/${Date.now()}-${file.name}`

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

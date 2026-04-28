'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

interface SocialLinks {
  tiktok?: string
  instagram?: string
  x?: string
  youtube?: string
}

interface Profile {
  username: string | null
  displayName: string
  bio: string
  email: string
  phone: string
  websiteUrl: string
  avatarUrl: string
  socialLinks: SocialLinks
}

const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_AVATAR_BYTES = 2 * 1024 * 1024

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_url, website_url, social_links')
    .eq('id', user.id)
    .maybeSingle()

  const socialLinks = (profile?.social_links ?? {}) as SocialLinks

  return {
    username: (profile?.username as string | null) ?? null,
    displayName: (profile?.display_name as string | null) ?? '',
    bio: (profile?.bio as string | null) ?? '',
    email: user.email ?? '',
    phone: (user.user_metadata?.phone as string) ?? '',
    websiteUrl: (profile?.website_url as string | null) ?? '',
    avatarUrl: (profile?.avatar_url as string | null) ?? '',
    socialLinks: {
      tiktok: socialLinks.tiktok ?? '',
      instagram: socialLinks.instagram ?? '',
      x: socialLinks.x ?? '',
      youtube: socialLinks.youtube ?? '',
    },
  }
}

export async function saveProfile(
  formData: FormData,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const displayName = ((formData.get('display_name') as string) ?? '').trim()
  const bio = ((formData.get('bio') as string) ?? '').trim()
  const phone = ((formData.get('phone') as string) ?? '').trim()
  const websiteUrl = ((formData.get('website_url') as string) ?? '').trim()

  if (bio.length > 280) {
    return { success: false, error: 'Bio must be 280 characters or fewer' }
  }
  if (websiteUrl) {
    try {
      const u = new URL(websiteUrl)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return { success: false, error: 'Website must use http:// or https://' }
      }
    } catch {
      return { success: false, error: 'Website must be a valid URL' }
    }
  }

  const socialLinks: SocialLinks = {}
  for (const key of ['tiktok', 'instagram', 'x', 'youtube'] as const) {
    const raw = ((formData.get(`social_${key}`) as string) ?? '').trim()
    if (raw) socialLinks[key] = raw.replace(/^@+/, '').slice(0, 64)
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      display_name: displayName || null,
      bio: bio || null,
      website_url: websiteUrl || null,
      social_links: socialLinks,
    })
    .eq('id', user.id)
  if (profileErr) {
    return { success: false, error: profileErr.message }
  }

  const { error: metaErr } = await supabase.auth.updateUser({
    data: { phone },
  })
  if (metaErr) {
    return { success: false, error: metaErr.message }
  }

  revalidatePath('/settings/profile')
  revalidatePath('/(dashboard)', 'layout')
  return { success: true }
}

export async function uploadAvatar(
  formData: FormData,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const file = formData.get('avatar') as File | null
  if (!file || file.size === 0) {
    return { success: false, error: 'No file uploaded' }
  }
  if (!ALLOWED_AVATAR_MIME.has(file.type)) {
    return { success: false, error: 'Avatar must be a JPG, PNG, or WebP image' }
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { success: false, error: 'Avatar must be 2MB or smaller' }
  }

  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (uploadErr) {
    return { success: false, error: uploadErr.message }
  }

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = pub.publicUrl

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', user.id)
  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  revalidatePath('/settings/profile')
  revalidatePath('/(dashboard)', 'layout')
  return { success: true, url }
}

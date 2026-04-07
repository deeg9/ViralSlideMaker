'use server'

import { nanoid } from 'nanoid'
import { hashApiKey } from '@/lib/crypto/hash'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createApiKey(label: string): Promise<
  | { success: true; key: string }
  | { success: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Validate label
  const trimmedLabel = label.trim()
  if (!trimmedLabel || trimmedLabel.length > 50) {
    return { success: false, error: 'Label must be between 1 and 50 characters' }
  }

  const admin = createAdminClient()

  // Check active key count (max 3)
  const { count } = await admin
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)

  if ((count ?? 0) >= 3) {
    return { success: false, error: 'Maximum 3 API keys allowed' }
  }

  // Generate key
  const rawKey = `vsl_${nanoid(32)}`
  const keyHash = await hashApiKey(rawKey)
  const prefix = rawKey.slice(0, 8)

  const { error } = await admin.from('api_keys').insert({
    user_id: user.id,
    key_hash: keyHash,
    prefix,
    label: trimmedLabel,
  })

  if (error) {
    return { success: false, error: 'Failed to create API key' }
  }

  revalidatePath('/settings/api-keys')
  return { success: true, key: rawKey }
}

export async function listApiKeys(): Promise<
  Array<{
    id: string
    prefix: string
    label: string
    created_at: string
    last_used_at: string | null
    revoked_at: string | null
  }>
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('api_keys')
    .select('id, prefix, label, created_at, last_used_at, revoked_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function revokeApiKey(keyId: string): Promise<
  | { success: true }
  | { success: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data } = await admin
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id')

  if (!data || data.length === 0) {
    return { success: false, error: 'Key not found or already revoked' }
  }

  revalidatePath('/settings/api-keys')
  return { success: true }
}

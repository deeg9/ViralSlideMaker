'use server'

import { randomBytes, createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createApiKey(
  name: string
): Promise<{ success: true; rawKey: string } | { success: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Validate name (1-64 chars, trimmed)
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 64) {
    return { success: false, error: 'Key name must be 1-64 characters' }
  }

  // Check key count limit (max 10 per user)
  const { count } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if ((count ?? 0) >= 10) {
    return { success: false, error: 'Maximum of 10 API keys reached' }
  }

  // Generate key: vsl_ prefix + 32 hex chars = 36 chars total
  const hex = randomBytes(16).toString('hex')
  const rawKey = `vsl_${hex}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const prefix = hex.slice(0, 8)

  const { error } = await supabase.from('api_keys').insert({
    user_id: user.id,
    name: trimmed,
    prefix,
    key_hash: keyHash,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/api-keys')
  return { success: true, rawKey }
}

export async function listApiKeys() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('api_keys')
    .select('id, name, prefix, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function revokeApiKey(
  keyId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', keyId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings/api-keys')
  return { success: true }
}

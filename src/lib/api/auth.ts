import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey } from '@/lib/crypto/hash'
import { getUserTier } from '@/lib/credits/check-credits'
import { ApiError } from '@/lib/api/errors'
import type { ApiKeyAuth } from '@/lib/api/types'

export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuth> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('UNAUTHORIZED', 'Missing or invalid Authorization header')
  }

  const rawKey = authHeader.slice(7)
  if (!rawKey.startsWith('vsl_')) {
    throw new ApiError('UNAUTHORIZED', 'Invalid API key format')
  }

  const keyHash = await hashApiKey(rawKey)
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!data || data.revoked_at) {
    throw new ApiError('UNAUTHORIZED', 'Invalid or revoked API key')
  }

  // Fire-and-forget update last_used_at
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  const tier = await getUserTier(data.user_id)
  return { userId: data.user_id, keyId: data.id, tier }
}

import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function authenticateApiKey(
  request: NextRequest
): Promise<{ userId: string; keyId: string }> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer vsl_')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const rawKey = authHeader.slice(7) // Remove "Bearer "
  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    throw new Error('Invalid API key')
  }

  // Timing-safe comparison as defense in depth (per AUTH-02)
  const storedHashBuf = Buffer.from(data.key_hash, 'utf8')
  const computedHashBuf = Buffer.from(keyHash, 'utf8')
  if (!timingSafeEqual(storedHashBuf, computedHashBuf)) {
    throw new Error('Invalid API key')
  }

  // Fire-and-forget: update last_used_at (non-blocking)
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { userId: data.user_id, keyId: data.id }
}

// src/lib/api/auth-core.ts
// Shared SHA-256 + DB lookup + timing-safe compare core for both REST (withApiAuth) and MCP (verifyToken).
// Does NOT depend on NextRequest — operates on a raw bearer string.
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export class InvalidApiKeyError extends Error {
  constructor(message = 'Invalid API key') {
    super(message)
    this.name = 'InvalidApiKeyError'
  }
}

export async function verifyApiKeyHash(
  rawKey: string
): Promise<{ userId: string; keyId: string }> {
  if (!rawKey.startsWith('vsl_')) {
    throw new InvalidApiKeyError()
  }

  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    throw new InvalidApiKeyError()
  }

  // Timing-safe compare as defense-in-depth (mirrors original auth.ts behaviour).
  const storedHashBuf = Buffer.from(data.key_hash, 'utf8')
  const computedHashBuf = Buffer.from(keyHash, 'utf8')
  if (
    storedHashBuf.length !== computedHashBuf.length ||
    !timingSafeEqual(storedHashBuf, computedHashBuf)
  ) {
    throw new InvalidApiKeyError()
  }

  // Fire-and-forget last_used_at update — do NOT await.
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { userId: data.user_id, keyId: data.id }
}

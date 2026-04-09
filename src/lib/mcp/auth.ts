import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/api/rate-limit'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

/**
 * MCP Bearer token verifier for use with withMcpAuth.
 *
 * Replicates the same SHA-256 hash + timing-safe comparison logic
 * from src/lib/api/auth.ts (authenticateApiKey), adapted for
 * mcp-handler's verifyToken interface.
 *
 * Returns AuthInfo on success, undefined on failure (any failure
 * reason -- missing token, invalid key, rate limited -- returns
 * the same undefined to avoid information disclosure per T-26-03).
 */
export async function verifyToken(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  // Reject if no token or not a vsl_ prefixed key
  if (!bearerToken || !bearerToken.startsWith('vsl_')) {
    return undefined
  }

  const keyHash = createHash('sha256').update(bearerToken).digest('hex')

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) {
    return undefined
  }

  // Timing-safe comparison as defense in depth (per T-26-01)
  const storedHashBuf = Buffer.from(data.key_hash, 'utf8')
  const computedHashBuf = Buffer.from(keyHash, 'utf8')
  if (!timingSafeEqual(storedHashBuf, computedHashBuf)) {
    return undefined
  }

  // Enforce rate limit (per T-26-02 / INFRA-02)
  const rl = await checkRateLimit(data.id)
  if (!rl.success) {
    return undefined
  }

  // Fire-and-forget: update last_used_at (non-blocking)
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    token: bearerToken,
    clientId: data.id,
    scopes: [],
    extra: {
      userId: data.user_id,
      keyId: data.id,
    },
  }
}

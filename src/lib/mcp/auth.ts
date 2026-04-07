import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey } from '@/lib/crypto/hash'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

/**
 * Verify an MCP Bearer token against the api_keys table.
 * Compatible with mcp-handler's withMcpAuth verifyToken signature.
 */
export async function verifyMcpToken(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken || !bearerToken.startsWith('vsl_')) {
    return undefined
  }

  const keyHash = await hashApiKey(bearerToken)
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!data || data.revoked_at) {
    return undefined
  }

  // Fire-and-forget: update last_used_at
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    token: bearerToken,
    clientId: data.user_id,
    scopes: [],
    extra: { userId: data.user_id, keyId: data.id },
  }
}

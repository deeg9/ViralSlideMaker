// src/lib/mcp/auth.ts
// MCP auth adapter for mcp-handler's withMcpAuth.
// Calls the shared verifyApiKeyHash (NextRequest-free) and the existing Upstash rate limiter.
// Returns AuthInfo on success; undefined on auth failure (→ 401 from withMcpAuth);
// throws TemporarilyUnavailableError on rate-limit failure (→ 503 with temporarily_unavailable errorCode).
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { TemporarilyUnavailableError } from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { verifyApiKeyHash, InvalidApiKeyError } from '@/lib/api/auth-core'
import { checkRateLimit } from '@/lib/api/rate-limit'

export async function verifyToken(
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined
  if (!bearerToken.startsWith('vsl_')) return undefined

  let userId: string
  let keyId: string
  try {
    ;({ userId, keyId } = await verifyApiKeyHash(bearerToken))
  } catch (err) {
    if (err instanceof InvalidApiKeyError) return undefined
    throw err // unexpected → bubble up; withMcpAuth maps to 500 ServerError
  }

  const rl = await checkRateLimit(keyId)
  if (!rl.success) {
    throw new TemporarilyUnavailableError('Rate limit exceeded')
  }

  return {
    token: bearerToken,
    clientId: keyId,
    scopes: [],
    extra: { userId, keyId },
  }
}

// src/lib/mcp/auth.ts
// MCP auth adapter for mcp-handler's withMcpAuth.
// Calls the shared verifyApiKeyHash (NextRequest-free) and the existing Upstash rate limiter.
// Returns AuthInfo on success; undefined on auth failure (→ 401 from withMcpAuth).
// On rate-limit failure we throw TemporarilyUnavailableError to signal intent, but note that
// mcp-handler's withMcpAuth catches every error from verifyToken and coerces it to
// InvalidTokenError → HTTP 401 (see node_modules/mcp-handler/dist/index.js:904-916).
// So clients currently see 401 "Invalid token" on rate-limit, not 503 temporarily_unavailable.
// To deliver a true 503 + Retry-After we would need to bypass withMcpAuth and write the
// Response ourselves in the route file.
//
// Defensive token scrubbing: this module guarantees the raw bearerToken never appears in any
// Error.message that escapes verifyToken. mcp-handler logs raw caught errors via console.error,
// so any leaked bearer would land in Vercel function logs. We strip bearerToken from every
// thrown message at the boundary below.
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

  try {
    const { userId, keyId } = await verifyApiKeyHash(bearerToken)

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
  } catch (err) {
    if (err instanceof InvalidApiKeyError) return undefined
    if (err instanceof TemporarilyUnavailableError) throw err
    // Unexpected error → strip any incidental bearer-token leakage before re-throwing.
    // withMcpAuth's catch will console.error this; we must guarantee no rawKey reaches logs.
    const original = err instanceof Error ? err.message : 'unknown error'
    const scrubbed = original.split(bearerToken).join('vsl_***')
    throw new Error(scrubbed)
  }
}

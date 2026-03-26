/**
 * Simple in-memory rate limiter using per-request cooldown.
 * Users wait a few seconds between requests instead of hitting a minute-long lockout.
 * For production with multiple serverless instances, replace with Upstash Redis.
 */

const store = new Map<string, number>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, expiresAt] of store) {
    if (now > expiresAt) store.delete(key)
  }
}, 5 * 60_000)

/**
 * Rate limit by enforcing a cooldown between requests.
 * @param key - Unique key (e.g. "carousel:userId")
 * @param cooldownSeconds - Seconds to wait between requests
 */
export function rateLimit(key: string, cooldownSeconds: number): { ok: boolean } {
  const now = Date.now()
  const expiresAt = store.get(key)

  if (expiresAt && now < expiresAt) {
    return { ok: false }
  }

  store.set(key, now + cooldownSeconds * 1000)
  return { ok: true }
}

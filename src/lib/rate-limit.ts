/**
 * Simple in-memory rate limiter.
 * For production with multiple serverless instances, replace with Upstash Redis.
 */

const cooldownStore = new Map<string, number>()
const bucketStore = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, expiresAt] of cooldownStore) {
    if (now > expiresAt) cooldownStore.delete(key)
  }
  for (const [key, entry] of bucketStore) {
    if (now > entry.resetAt) bucketStore.delete(key)
  }
}, 5 * 60_000)

/**
 * Cooldown-based rate limit: enforces N seconds between requests.
 * Best for expensive operations (AI generation).
 */
export function rateLimit(key: string, cooldownSeconds: number): { ok: boolean } {
  const now = Date.now()
  const expiresAt = cooldownStore.get(key)

  if (expiresAt && now < expiresAt) {
    return { ok: false }
  }

  cooldownStore.set(key, now + cooldownSeconds * 1000)
  return { ok: true }
}

/**
 * Bucket-based rate limit: allows N requests per minute.
 * Best for endpoints that need burst capacity (e.g. downloading multiple slides).
 */
export function rateLimitBucket(key: string, maxPerMinute: number): { ok: boolean } {
  const now = Date.now()
  const entry = bucketStore.get(key)

  if (!entry || now > entry.resetAt) {
    bucketStore.set(key, { count: 1, resetAt: now + 60_000 })
    return { ok: true }
  }

  if (entry.count >= maxPerMinute) {
    return { ok: false }
  }

  entry.count++
  return { ok: true }
}

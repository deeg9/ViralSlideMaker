/**
 * Simple in-memory rate limiter using sliding window.
 * For production with multiple serverless instances, replace with Upstash Redis.
 */

const windowMs = 60_000 // 1 minute window
const store = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}, 5 * 60_000)

export function rateLimit(key: string, maxRequests: number): { ok: boolean; remaining: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: maxRequests - 1 }
  }

  if (entry.count >= maxRequests) {
    return { ok: false, remaining: 0 }
  }

  entry.count++
  return { ok: true, remaining: maxRequests - entry.count }
}

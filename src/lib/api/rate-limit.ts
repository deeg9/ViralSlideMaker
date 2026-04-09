import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Upstash-based distributed rate limiter for API routes.
 *
 * Lazy-initialized to avoid build-time errors when env vars
 * are not available (e.g. during `next build` or tests).
 *
 * Strategy: sliding window, 60 requests per minute per API key.
 * Prefix: 'vsl:rl' to namespace in shared Redis.
 */
let ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit {
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'vsl:rl',
    })
  }
  return ratelimit
}

export async function checkRateLimit(keyId: string) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Gracefully skip rate limiting when Upstash is not configured
    return { success: true, limit: 60, remaining: 59, reset: Date.now() + 60000 }
  }
  const rl = getRatelimit()
  return rl.limit(keyId)
}

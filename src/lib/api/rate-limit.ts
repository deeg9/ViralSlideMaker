import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { RateLimitError } from '@/lib/api/errors'
import type { SubscriptionTier } from '@/lib/credits/types'

const redis = Redis.fromEnv()

const limiters: Record<SubscriptionTier, Ratelimit> = {
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:free',
    analytics: false,
  }),
  plus: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'rl:plus',
    analytics: false,
  }),
  pro: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'rl:pro',
    analytics: false,
  }),
}

export async function checkRateLimit(
  keyId: string,
  tier: SubscriptionTier
): Promise<{ limit: number; remaining: number; reset: number }> {
  const limiter = limiters[tier]
  const { success, limit, remaining, reset } = await limiter.limit(keyId)

  if (!success) {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000))
    throw new RateLimitError(retryAfter, limit, remaining)
  }

  return { limit, remaining, reset }
}

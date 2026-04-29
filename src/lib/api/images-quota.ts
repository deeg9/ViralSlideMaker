import { Redis } from '@upstash/redis'

/**
 * Daily upload quota counter for the API/MCP image upload endpoint.
 *
 * Strategy: per-API-key daily counter in Redis with 24h TTL set on first
 * upload of the day. Atomic via Redis INCR — concurrent requests cannot
 * race past the limit.
 *
 * Why this exists: rate-limit-only protection allows up to 60 uploads/min
 * = 86,400/day. At 5MB each that's 432GB/day/key — a real cost vector.
 * Daily quota of 200/key caps it at ~1GB/day (100× safer).
 */

export const DAILY_UPLOAD_LIMIT = 200
const KEY_PREFIX = 'vsl:uploads'

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = Redis.fromEnv()
  }
  return redis
}

function dayKey(keyId: string): string {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
  return `${KEY_PREFIX}:${keyId}:${today}`
}

function nextMidnightUTC(): number {
  const t = new Date()
  t.setUTCHours(24, 0, 0, 0)
  return t.getTime()
}

function secondsUntilMidnightUTC(): number {
  return Math.ceil((nextMidnightUTC() - Date.now()) / 1000)
}

export type UploadQuotaResult = {
  allowed: boolean
  used: number
  limit: number
  resetAt: number // ms timestamp of UTC midnight
  retryAfter: number // seconds until reset (for Retry-After header)
}

/**
 * Atomically increment the per-key daily upload counter and return whether
 * this request is within the quota. Always increments — quota is a
 * throttle, not a hard count. Over-quota requests still burn a slot to
 * make the throttle bite.
 *
 * Gracefully no-ops when Upstash env vars are not configured (e.g. local
 * dev), allowing the request through.
 */
export async function incrementUploadCount(keyId: string): Promise<UploadQuotaResult> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      allowed: true,
      used: 0,
      limit: DAILY_UPLOAD_LIMIT,
      resetAt: nextMidnightUTC(),
      retryAfter: secondsUntilMidnightUTC(),
    }
  }

  const r = getRedis()
  const k = dayKey(keyId)
  const used = await r.incr(k)
  if (used === 1) {
    // First upload of the day — set TTL to expire at next UTC midnight
    await r.expire(k, secondsUntilMidnightUTC())
  }

  return {
    allowed: used <= DAILY_UPLOAD_LIMIT,
    used,
    limit: DAILY_UPLOAD_LIMIT,
    resetAt: nextMidnightUTC(),
    retryAfter: secondsUntilMidnightUTC(),
  }
}

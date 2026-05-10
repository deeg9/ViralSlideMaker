/**
 * Phase 73 (COST-04): rolling-24h rate cap for style-from-reference vision extraction.
 *
 * Free tier:  STYLE_EXTRACTION_FREE_DAILY_CALL_CAP (default 5) calls per rolling 24h
 *             × STYLE_EXTRACTION_FREE_DAILY_IMAGES_CAP (default 3) images per call
 *             = 15 vision calls / day worst case (defends Pitfall 4 — cost blowup).
 * Premium:    Uncapped in v2.13. Per-tier configurability is DEFERRED per CONTEXT.md
 *             ("Per-tier cap configurability — not in v2.13 scope"); this helper
 *             returns { allowed: true } unconditionally for tier !== 'free'.
 *
 * Counting policy: this helper counts CHARGE rows only (not net charges minus refunds).
 * Rationale: a refund means the call FAILED — but the attempt is real. Counting it
 * against the cap is consistent with "rate-limit attempts, not successes" (anti-abuse).
 * The bill-alarm cron in route.ts takes the OPPOSITE stance (it sums NET cost, since
 * refunded calls did not actually cost the wire) — these are intentionally different.
 *
 * Phase 75 (extract-style-spec.ts) consumes this BEFORE chargeExtractionCredit:
 *   const cap = await checkExtractionRateCap(admin, userId, tier, urls.length)
 *   if (!cap.allowed) return { error: 'daily_cap_reached', detail: cap }
 *
 * Env var read happens at module load (per CONTEXT.md "read once per process,
 * not per request"). For test override, stub process.env BEFORE importing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SubscriptionTier } from '@/lib/credits/types'

// Phase 73 (COST-04): caps are env-driven with locked defaults from CONTEXT.md.
// Read once at module load — test files MUST stubEnv + dynamic-import to override.
export const FREE_DAILY_CALL_CAP =
  parseInt(process.env.STYLE_EXTRACTION_FREE_DAILY_CALL_CAP ?? '5', 10)
export const FREE_DAILY_IMAGES_PER_CALL =
  parseInt(process.env.STYLE_EXTRACTION_FREE_DAILY_IMAGES_CAP ?? '3', 10)

// CONTEXT.md decision: rolling 24h, NOT calendar day. Fairer UX, aligns with
// match-photos-to-slides cap behavior.
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000

export type RateCapReason =
  | 'no_images_provided'
  | 'too_many_images_per_call'
  | 'daily_cap_reached'
  | 'rate_check_failed'

export interface RateCapResult {
  allowed: boolean
  reason?: RateCapReason
  /** Count of CHARGE rows over the rolling 24h window. */
  callsToday: number
  /** max(0, cap - callsToday); Infinity for non-free tiers. */
  callsRemaining: number
  /** FREE_DAILY_IMAGES_PER_CALL or Infinity. */
  imagesPerCallCap: number
}

/**
 * Returns { allowed, reason?, callsToday, callsRemaining, imagesPerCallCap }.
 *
 * Fail-closed: if the DB lookup throws or errors, returns
 * { allowed: false, reason: 'rate_check_failed' } — this mirrors the
 * credit-deduction safety stance (better to reject one legitimate request
 * than to skip the cap entirely on outage).
 */
export async function checkExtractionRateCap(
  admin: SupabaseClient,
  userId: string,
  tier: SubscriptionTier,
  requestedImageCount: number,
): Promise<RateCapResult> {
  // Premium uncapped per deferred decision.
  if (tier !== 'free') {
    return {
      allowed: true,
      callsToday: 0,
      callsRemaining: Infinity,
      imagesPerCallCap: Infinity,
    }
  }

  if (requestedImageCount <= 0) {
    return {
      allowed: false,
      reason: 'no_images_provided',
      callsToday: 0,
      callsRemaining: FREE_DAILY_CALL_CAP,
      imagesPerCallCap: FREE_DAILY_IMAGES_PER_CALL,
    }
  }

  if (requestedImageCount > FREE_DAILY_IMAGES_PER_CALL) {
    return {
      allowed: false,
      reason: 'too_many_images_per_call',
      callsToday: 0,
      callsRemaining: FREE_DAILY_CALL_CAP,
      imagesPerCallCap: FREE_DAILY_IMAGES_PER_CALL,
    }
  }

  try {
    const since = new Date(Date.now() - ROLLING_WINDOW_MS).toISOString()
    const { count, error } = await admin
      .from('credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'gemini_vision_extract_style')
      .gte('created_at', since)

    if (error) {
      console.warn('[rate-cap] DB error; fail-closed:', error)
      return {
        allowed: false,
        reason: 'rate_check_failed',
        callsToday: 0,
        callsRemaining: 0,
        imagesPerCallCap: FREE_DAILY_IMAGES_PER_CALL,
      }
    }

    const callsToday = count ?? 0
    const callsRemaining = Math.max(0, FREE_DAILY_CALL_CAP - callsToday)

    if (callsToday >= FREE_DAILY_CALL_CAP) {
      return {
        allowed: false,
        reason: 'daily_cap_reached',
        callsToday,
        callsRemaining: 0,
        imagesPerCallCap: FREE_DAILY_IMAGES_PER_CALL,
      }
    }

    return {
      allowed: true,
      callsToday,
      callsRemaining,
      imagesPerCallCap: FREE_DAILY_IMAGES_PER_CALL,
    }
  } catch (err) {
    console.warn('[rate-cap] threw; fail-closed:', err)
    return {
      allowed: false,
      reason: 'rate_check_failed',
      callsToday: 0,
      callsRemaining: 0,
      imagesPerCallCap: FREE_DAILY_IMAGES_PER_CALL,
    }
  }
}

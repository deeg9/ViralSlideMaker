/**
 * Phase 73 (COST-07): single-retry policy for the style-from-reference vision
 * extraction call. Capped at 1 retry (2 total in-flight attempts) — NEVER 3.
 * Three retries is the cost killer per Pitfalls 4 + 8 (a transient blip becomes
 * 3× the spend).
 *
 * Transient errors (retry once):
 *   - Network errors (ECONNRESET, ETIMEDOUT, "fetch failed", "network")
 *   - Explicit timeouts ("timeout")
 *   - Gemini 5xx HTTP status (per err.status / err.statusCode)
 *
 * Permanent errors (NEVER retry):
 *   - Any 4xx (including 429 — rate limits fail loud, do NOT retry)
 *   - Gemini SAFETY block / finish_reason
 *   - Zod / parse / validation errors
 *   - Unknown errors (default — fail loud per COST-07)
 *
 * Phase 75 (extract-style-spec.ts) wiring:
 *   const spec = await withSingleRetry(() => callGeminiVision(prepared))
 */

export interface RetryPolicy {
  /** Max IN-FLIGHT attempts including the original. Capped at 2 by COST-07. */
  maxAttempts: 2
}

/**
 * Classify an error as transient (retry-able) or permanent.
 * Exposed for tests and for any caller that needs the same decision logic.
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()

  // Permanent signals win — check FIRST so a "safety" message that
  // happens to contain "timeout" still classifies correctly.
  if (msg.includes('blocked') || msg.includes('safety') || msg.includes('finish_reason')) {
    return false
  }
  if (msg.includes('zoderror') || msg.includes('invalid_type') || msg.includes('parse')) {
    return false
  }

  // Transient text signals.
  if (msg.includes('timeout')) return true
  if (msg.includes('econnreset') || msg.includes('etimedout')) return true
  if (msg.includes('fetch failed') || msg.includes('network')) return true

  // HTTP status from Gemini SDK or fetch — 5xx transient, 4xx permanent.
  const statusBag = err as { status?: number; statusCode?: number }
  const status = statusBag.status ?? statusBag.statusCode
  if (typeof status === 'number') {
    return status >= 500 && status < 600
  }

  // Default: do NOT retry on unknown — fail loud per COST-07.
  return false
}

/**
 * Phase 73 (COST-07): wrap an async fn with single-retry-on-transient-error.
 * Returns the result of the (first or second) successful call. If both
 * attempts throw, throws the SECOND error.
 *
 * Provably caps wrapped-fn invocations at 2 — verified by mock-call-count
 * assertions in style-extraction-retry.test.ts ("fn called twice" /
 * "called exactly N times"). NEVER 3 calls for any input.
 */
export async function withSingleRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (!isTransientError(err)) throw err
    console.warn('[extract-retry] transient error; ONE retry attempt:', err)
    return await fn() // SECOND attempt — that's it. No third try.
  }
}

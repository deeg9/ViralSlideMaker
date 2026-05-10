/**
 * Phase 73 (COST-06): charge-then-refund credit ledger helpers for the
 * style-from-reference vision extraction flow. Mirrors v2.6 gemini_vision_match
 * exactly — same table, same row shape, same description prefix convention.
 *
 * Phase 75 (extract-style-spec.ts) wiring:
 *   const charged = await chargeExtractionCredit(admin, userId, projectId)
 *   if (!charged) return { error: 'insufficient_credits' }
 *   try {
 *     const spec = await withSingleRetry(() => callGeminiVision(prepared))
 *     ...
 *   } catch (err) {
 *     await refundExtractionCredit(admin, userId, projectId, errorReason(err))
 *     throw err
 *   }
 *
 * Composes deductCreditAdmin from @/lib/credits/check-credits — does NOT
 * re-implement the deduct RPC. The existing RPC handles balance check + the
 * credit_transactions insert atomically.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { deductCreditAdmin } from '@/lib/credits/check-credits'

/** Phase 73 (COST-06): the canonical type string for extraction charges. */
export const EXTRACTION_CHARGE_TYPE = 'gemini_vision_extract_style' as const

/**
 * Phase 73 (COST-06): charge BEFORE the Gemini call. Returns true on
 * success, false if the user has insufficient balance. Mirrors v2.6
 * gemini_vision_match charge pattern — composes deductCreditAdmin so the
 * existing balance-check RPC stays the single source of truth.
 *
 * @param referenceId - typically the project_id; surfaces in ledger UI
 */
export async function chargeExtractionCredit(
  admin: SupabaseClient,
  userId: string,
  referenceId: string,
): Promise<boolean> {
  return deductCreditAdmin(
    admin,
    userId,
    EXTRACTION_CHARGE_TYPE,
    'Style-from-reference vision extraction',
    referenceId,
    1,
  )
}

/**
 * Phase 73 (COST-06): refund on Gemini-call failure. Inserts a 'refund'
 * row with descriptive `reason` text. NEVER throws — refund failure must
 * not mask the original error path.
 *
 * The description prefix `Refund: extract-style ` is load-bearing for the
 * bill-alarm cron, which uses LIKE 'Refund: extract-style%' to identify
 * extraction refunds vs match-photos refunds.
 */
export async function refundExtractionCredit(
  admin: SupabaseClient,
  userId: string,
  referenceId: string,
  reason: string,
): Promise<void> {
  try {
    const { error } = await admin.from('credit_transactions').insert({
      user_id: userId,
      type: 'refund',
      amount: 1,
      description: `Refund: extract-style ${reason}`,
      reference_id: referenceId,
    })
    if (error) {
      console.warn('[extract-ledger] refund insert errored (non-fatal):', error)
    }
  } catch (err) {
    console.warn('[extract-ledger] refund threw (non-fatal):', err)
  }
}

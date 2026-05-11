// Phase 75 Plan 01 (EXTRACT-01..03/06/07/08):
// Discriminated-union return contract + ExtractTelemetry shape for the
// extract-style-spec orchestrator. Single import surface for Plan 75-01,
// Phase 76 (Server Action), Phase 77 (emit pipeline).
//
// quick 260511-flj: refusal_flags REMOVED from ExtractSuccess (Phase 75 D-05
// superseded — the refusal pre-pass module is deleted entirely). RefusalFlags
// re-export REMOVED.
//
// References:
//   - REQUIREMENTS.md EXTRACT-01 (endpoint signature)
//   - REQUIREMENTS.md EXTRACT-08 (telemetry: vision_calls_count, tokens, cache_hit, duration_ms)
//   - .planning/phases/75-vision-extraction-two-phase-architecture-safety-config/75-CONTEXT.md
//       D-04 (error taxonomy: cap_reached / safety_blocked / extraction_failed / insufficient_credits)
//       D-08 (telemetry shape feeds Phase 73 bill-alarm cron)
//   - PITFALLS.md Pitfall 3 (closed-enum + two-phase firewall — types are CONSUMER side)
//
// Discrimination is on `ok` (NOT on `error`) so callers narrow with
// `if (result.ok)` — the conventional TS pattern that gives both branches
// full typed access without redundant null checks.
//
// ZOD VALIDATION INTENTIONALLY ABSENT in this file. Phase B firewall lives in
// Phase 74's parseStyleSpecSafe — types here are caller-side observability only.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { RateCapResult } from '@/lib/cost/style-extraction-rate-cap'

/**
 * Input contract for extractStyleSpec.
 *
 * `referenceBytes` is `Buffer[]` not URLs because Phase 76's Server Action
 * fetches bytes from Supabase Storage and hands us raw bytes. This is
 * consistent with EXTRACT-01: the URL→bytes hop is the Server Action's
 * responsibility, not the orchestrator's. (See CONTEXT.md grounding-anchors
 * "Phase 76 UI consumes this via Server Action wrapper".)
 *
 * `tier` is the SubscriptionTier surface used by the rate-cap. We accept the
 * narrow `'free' | 'paid'` here per the plan; the rate-cap itself accepts the
 * full `SubscriptionTier` (`'free' | 'plus' | 'pro'`). 'paid' maps to the
 * uncapped path inside checkExtractionRateCap (anything !== 'free').
 */
export interface ExtractInput {
  projectId: string
  userId: string
  tier: 'free' | 'paid'
  referenceBytes: Buffer[]
  admin: SupabaseClient
}

/**
 * Per-extraction telemetry — feeds bill-alarm cron + future per-user analytics.
 *
 * `vision_calls_count` is 1 on a non-cached extraction (quick 260511-flj —
 * refusal pre-pass call removed; only the main Phase A extraction call remains).
 *
 * `silent_drops` and `block_reason` are optional — present only when the
 * relevant code path executes (silent-drop counter populated on Phase B,
 * block_reason populated on safety_blocked).
 */
export interface ExtractTelemetry {
  vision_calls_count: number
  tokens_in: number
  tokens_out: number
  cache_hit: boolean
  duration_ms: number
  silent_drops?: Record<string, number>
  block_reason?: string
}

/** Success branch — ok:true. */
export interface ExtractSuccess {
  ok: true
  spec: StyleSpec
  cached: boolean
  telemetry: ExtractTelemetry
}

/**
 * Error branch — ok:false, discriminated further on `error`.
 *
 * Per CONTEXT.md D-04 + EXTRACT-07:
 *   - cap_reached         → free-tier rolling-24h cap hit (no charge, no Gemini call)
 *   - insufficient_credits → wallet empty (no Gemini call, no refund needed)
 *   - safety_blocked      → Gemini promptFeedback.blockReason populated
 *                           → refunded; recovery_suggestion populated for Phase 76 UI
 *   - extraction_failed   → timeout / 4xx / schema-fatal / invalid JSON
 *                           → refunded; detail describes the failure mode
 */
export type ExtractError =
  | {
      ok: false
      error: 'cap_reached'
      detail: RateCapResult
      telemetry: ExtractTelemetry
    }
  | {
      ok: false
      error: 'insufficient_credits'
      detail: string
      telemetry: ExtractTelemetry
    }
  | {
      ok: false
      error: 'safety_blocked'
      detail: unknown
      reason: string
      recovery_suggestion: string
      telemetry: ExtractTelemetry
    }
  | {
      ok: false
      error: 'extraction_failed'
      detail: string
      telemetry: ExtractTelemetry
    }

/** The discriminated-union return type — narrow with `if (result.ok)`. */
export type ExtractResult = ExtractSuccess | ExtractError

// Phase 73 (COST-03, Plan 02): style_spec_cache read/write helpers.
//
// The single biggest cost-defense lever in v2.13: SHA-256 of the preprocessed
// image bytes (Phase 73 Plan 01's prepareForVision output) keys this cache;
// a hit returns the persisted StyleSpec at $0 cost (no Gemini Vision call,
// no credit charge) and bumps last_hit_at fire-and-forget for future LRU
// eviction. A miss + persist makes the next call free for that user (and
// every other user uploading bit-identical preprocessed bytes).
//
// Phase 75 (vision extraction) consumes this module via two function calls:
//   - lookupStyleSpec(admin, sha256) — call IMMEDIATELY after prepareForVision
//     and BEFORE any credit charge. Hit short-circuits the whole pipeline.
//   - persistStyleSpec(admin, sha256, validatedSpec) — call AFTER Zod
//     validation succeeds. Idempotent on duplicate sha256.
//
// Contract: NEITHER helper throws. Cache I/O failure is logged + treated as
// a miss (lookup) or no-op (persist) — mirrors the v2.6 match-photos-to-slides
// cache-failure stance so Phase 75 doesn't need try/catch around every call.
//
// Storage primitive only — no Zod validation, no telemetry export. Phase 75
// owns validation (EXTRACT-02 two-phase architecture) and telemetry
// (EXTRACT-08). Garbage-in / garbage-out is the explicit contract here.
//
// TODO(Phase 74 STYLESPEC-01): replace `unknown` style_spec with the real
// StyleSpec type once that type ships. This module deliberately stays opaque
// to the spec shape so Phase 73 can ship before Phase 74's schema lands.
//
// Phase 80 (R5) defensive filter: lookupStyleSpec now drops any row whose
// stored `style_spec.schema_version` is not equal to the current
// STYLE_SPEC_VERSION (=2). The deploy-time migration
// `20260514_v213_phase80_style_spec_cache_v2_purge.sql` is the primary purge
// mechanism, but an in-flight v1 write could land between migration apply
// and STYLE_SPEC_VERSION rollout — the filter ensures a wrong-version row
// can never be returned (parseStyleSpecSafe in Plan 80-02 rejects v1 with
// ok:false; that would surface as a confusing extraction error). Treat
// schema-mismatched rows as a cache miss; do NOT delete eagerly (the
// migration owns deletion).

import type { SupabaseClient } from '@supabase/supabase-js'
import { STYLE_SPEC_VERSION } from '@/lib/types/style-spec'

const TABLE = 'style_spec_cache'
const DEFAULT_MODEL = 'gemini-2.5-flash'

export interface StyleSpecCacheRow {
  sha256: string
  // Validated by Phase 75 (EXTRACT-02); opaque at this layer.
  // TODO(Phase 74 STYLESPEC-01): swap `unknown` for the real StyleSpec type.
  style_spec: unknown
  model: string
  created_at: string
  last_hit_at: string
}

/**
 * Phase 73 (COST-03): cache lookup by SHA-256 of preprocessed bytes.
 *
 * Returns the persisted StyleSpec on hit (and bumps last_hit_at
 * fire-and-forget so future LRU eviction has the data without backfill);
 * returns null on miss. NEVER throws — cache failure must not block the
 * caller (mirrors src/lib/ai/match-photos-to-slides.ts cache-failure stance).
 *
 * @param admin - Supabase service-role client (server-only).
 * @param sha256 - 64-char hex SHA-256 of preprocessed image bytes.
 */
export async function lookupStyleSpec(
  admin: SupabaseClient,
  sha256: string,
): Promise<unknown | null> {
  try {
    const { data, error } = await admin
      .from(TABLE)
      .select('style_spec')
      .eq('sha256', sha256)
      .maybeSingle()

    if (error || !data) return null

    // Phase 80 R5: defensive schema_version filter — even after the
    // 20260514_v213_phase80_style_spec_cache_v2_purge.sql migration ran,
    // an in-flight v1 write could land between the migration apply and
    // STYLE_SPEC_VERSION rollout. A row at the wrong version cannot be
    // returned to callers (parseStyleSpecSafe in Plan 80-02 rejects v1
    // with ok:false; that would surface to the user as a confusing
    // extraction error). Drop the row defensively here.
    const candidateSpec = (data as { style_spec: unknown }).style_spec
    const candidateVersion =
      typeof candidateSpec === 'object' &&
      candidateSpec !== null &&
      !Array.isArray(candidateSpec)
        ? (candidateSpec as { schema_version?: unknown }).schema_version
        : undefined
    if (candidateVersion !== STYLE_SPEC_VERSION) {
      // Treat as a miss — do NOT bump last_hit_at, do NOT delete eagerly
      // (the deploy migration owns deletion; this path may run concurrent
      // with that migration and must remain side-effect-free for safety).
      return null
    }

    // Fire-and-forget last_hit_at bump — never await; never throw.
    // CONTEXT.md: "load-bearing for future LRU eviction without backfill".
    Promise.resolve(
      admin
        .from(TABLE)
        .update({ last_hit_at: new Date().toISOString() })
        .eq('sha256', sha256),
    )
      .then((res) => {
        const updateErr = (res as { error?: unknown } | null | undefined)?.error
        if (updateErr) {
          console.warn(
            '[style-spec-cache] last_hit_at update failed (non-blocking):',
            updateErr,
          )
        }
      })
      .catch((err) => {
        console.warn(
          '[style-spec-cache] last_hit_at update threw (non-blocking):',
          err,
        )
      })

    return candidateSpec
  } catch (err) {
    console.warn('[style-spec-cache] lookup failed; treating as miss:', err)
    return null
  }
}

/**
 * Phase 73 (COST-03): cache write. Idempotent on duplicate sha256
 * (concurrent extractions of the same image are safe via upsert
 * onConflict). NEVER throws — persist failure logs a warning and resolves.
 *
 * @param admin - Supabase service-role client (server-only).
 * @param sha256 - 64-char hex SHA-256 of preprocessed image bytes.
 * @param styleSpec - Validated StyleSpec from Phase 75 (opaque here).
 * @param model - Extraction model name; defaults to 'gemini-2.5-flash'.
 */
export async function persistStyleSpec(
  admin: SupabaseClient,
  sha256: string,
  styleSpec: unknown,
  model: string = DEFAULT_MODEL,
): Promise<void> {
  try {
    const { error } = await admin
      .from(TABLE)
      .upsert(
        { sha256, style_spec: styleSpec, model },
        { onConflict: 'sha256' },
      )
    if (error) {
      console.warn(
        '[style-spec-cache] persist failed (non-blocking):',
        error,
      )
    }
  } catch (err) {
    console.warn('[style-spec-cache] persist threw (non-blocking):', err)
  }
}

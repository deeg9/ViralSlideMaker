// Phase 79 (LEGAL-02, Plan 01): server-side helpers that read/write the
// `style_reference_uploads` audit table.
//
// CONTRACT (mirrors v2.6 match-photos-to-slides + Phase 73 style-spec-cache):
// neither helper EVER throws. Callers can rely on a structured return value
// (`{ ok: true } | { ok: false, error }` for the writer; plain boolean for
// the reader) and never need to wrap calls in try/catch. Failure modes
// surface as "user must re-accept" — a defensive posture that prevents a
// flaky DB connection from silently letting an un-accepted upload through.
//
// CONSUMERS (Plan 79-02):
//   * `acceptStyleFromReferenceTos` server action calls
//     recordStyleFromReferenceTosAcceptance() with the admin client and
//     the sha256s of the references the user is about to upload.
//   * `<ReferenceImageUploader>` upload handler calls
//     hasUserAcceptedCurrentTos() before opening the clickwrap modal —
//     true skips the modal (fast path), false requires acceptance first.
//
// IMPORTS: keep this module server-only. The Supabase client passed in MUST
// be the service-role admin client because the table's RLS policies only
// permit INSERT to `service_role`.

import type { SupabaseClient } from '@supabase/supabase-js'

const TABLE = 'style_reference_uploads'

export interface RecordTosAcceptanceArgs {
  /** auth.users.id of the accepting user. */
  userId: string
  /** SHA-256 hex digests of the reference image bytes the user is acknowledging. */
  sha256s: string[]
  /** ToS revision string from `STYLE_FROM_REFERENCE_TOS_VERSION`. */
  tosVersion: string
}

export type RecordTosAcceptanceResult =
  | { ok: true }
  | { ok: false; error: unknown }

/**
 * Inserts one audit row per sha256 in `args.sha256s`. Empty array is a
 * no-op (returns ok:true without touching the DB) so callers can pass
 * pre-deduplicated lists without an explicit length check.
 *
 * NEVER throws — `{ ok: false, error }` on any insert failure (network,
 * RLS, unique-violation, etc.). The caller is expected to surface
 * `ok: false` to the user as "could not record acceptance, try again"
 * rather than letting the upload proceed.
 *
 * @param admin - Supabase service-role client (server-only).
 * @param args  - userId + sha256s to acknowledge + tosVersion literal.
 */
export async function recordStyleFromReferenceTosAcceptance(
  admin: SupabaseClient,
  args: RecordTosAcceptanceArgs,
): Promise<RecordTosAcceptanceResult> {
  const { userId, sha256s, tosVersion } = args

  // Empty-array no-op — keeps callers cheap. accepted_at defaults to now()
  // in the schema, so we omit it from the payload.
  if (sha256s.length === 0) {
    return { ok: true }
  }

  const rows = sha256s.map((sha256) => ({
    user_id: userId,
    sha256,
    tos_version: tosVersion,
  }))

  try {
    const { error } = await admin.from(TABLE).insert(rows)
    if (error) {
      console.warn('[audit-log] insert failed (returning ok:false):', error)
      return { ok: false, error }
    }
    return { ok: true }
  } catch (err) {
    console.warn('[audit-log] insert threw (returning ok:false):', err)
    return { ok: false, error: err }
  }
}

/**
 * Returns true iff the user has at least one acceptance row for the
 * specified ToS version. Used on the upload hot path to decide whether
 * to skip the clickwrap modal.
 *
 * NEVER throws — returns `false` on any read failure. `false` is the
 * safe default: it forces the user to re-accept, which is the
 * acceptable failure mode legally (the worst outcome is a redundant
 * click; the unacceptable outcome would be silently letting through an
 * un-accepted upload).
 *
 * @param admin          - Supabase service-role client (server-only).
 * @param userId         - auth.users.id to check.
 * @param currentVersion - ToS version literal (typically
 *                         `STYLE_FROM_REFERENCE_TOS_VERSION`).
 */
export async function hasUserAcceptedCurrentTos(
  admin: SupabaseClient,
  userId: string,
  currentVersion: string,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from(TABLE)
      .select('id')
      .eq('user_id', userId)
      .eq('tos_version', currentVersion)
      .limit(1)

    if (error) {
      console.warn('[audit-log] hasUserAcceptedCurrentTos error (returning false):', error)
      return false
    }

    return Array.isArray(data) && data.length > 0
  } catch (err) {
    console.warn('[audit-log] hasUserAcceptedCurrentTos threw (returning false):', err)
    return false
  }
}

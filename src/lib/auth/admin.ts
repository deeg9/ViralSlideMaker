// Phase 86 (ADMIN-01): the first real admin helper in the codebase.
//
// `profiles` has no `role` column — admin identity is an env allowlist
// (`ADMIN_USER_IDS`, comma-separated Supabase user ids), consistent with the
// seed-explore env-gate pattern. This is the SINGLE reusable admin gate: both
// the `(admin)` route-group layout loader AND the Save-as-Template save
// endpoint import from here — the role check is never re-implemented inline.
//
// The gate is FAIL-SAFE-CLOSED: an unset/empty `ADMIN_USER_IDS` closes the
// admin surface for everyone, it is never accidentally open.

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Parse the `ADMIN_USER_IDS` env var (comma-separated Supabase user ids) into
 * a trimmed Set. An unset/empty env var yields an EMPTY set — fail-safe.
 */
function parseAdminAllowlist(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? ''
  return new Set(
    raw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
}

/**
 * True ONLY when `userId` is a non-empty string present (after trimming) in
 * the `ADMIN_USER_IDS` allowlist. A null/undefined/empty id → false. An empty
 * allowlist → false for everyone (FAIL-SAFE — the admin surface is fully
 * closed when the env var is unset, never open).
 */
export function isAdminUser(userId: string | null | undefined): boolean {
  if (typeof userId !== 'string') return false
  const trimmed = userId.trim()
  if (trimmed.length === 0) return false
  return parseAdminAllowlist().has(trimmed)
}

/**
 * Resolve the logged-in admin from a session-aware Supabase client (the one
 * from `createClient()` in `src/lib/supabase/server.ts`). Returns the admin
 * `{ id, email }` when there is a session AND the user is in the allowlist,
 * else `null`. This is a SESSION-COOKIE check — there is NO bearer token
 * (unlike seed-explore's dev-script token gate). Never throws.
 */
export async function requireAdmin(
  supabase: SupabaseClient,
): Promise<{ id: string; email: string | null } | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    if (!isAdminUser(user.id)) return null
    return { id: user.id, email: user.email ?? null }
  } catch {
    return null
  }
}

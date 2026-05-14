import type { SupabaseClient } from '@supabase/supabase-js'
import { publishProjectAdmin } from './publish'

/**
 * Single source of truth for "newly-generated carousels default to Public".
 *
 * Every carousel-generation entry point MUST call this immediately after
 * persisting `slide_data` + `generation_status: 'complete'`. There are three
 * entry points today:
 *
 *   1. `src/lib/services/carousel.ts → generateCarousel`
 *      — called by `/api/v1/carousel` (public API + MCP)
 *   2. `src/lib/services/carousel.ts → generateCarouselFromReferences`
 *      — called by `style-from-reference/actions.ts`
 *   3. `src/app/(dashboard)/project/[id]/actions.ts → generateCarousel`
 *      (the server-action duplicate) — called by the main Create form
 *
 * The recurring regression (quick-260514-k3j and prior) has been: a fix gets
 * applied at one site, then a new generation path is added later and ships
 * without the auto-publish wired in. Centralizing the call here makes it a
 * one-line ritual any new generation path can adopt — and a missing call
 * shows up immediately as "Private after generate".
 *
 * Best-effort by design: if hero render / upload / RPC fail, the slide data
 * is already persisted, so the user keeps their work. They can click Publish
 * manually from the editor. Failures are logged to console.warn so they
 * surface in server logs without crashing the generation response.
 */
export async function autoPublishOnGenerate(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
  title: string,
): Promise<void> {
  try {
    const result = await publishProjectAdmin(admin, userId, projectId, { title })
    if (!result.success) {
      console.warn(
        `[autoPublishOnGenerate] publish failed for project ${projectId}: ${result.error}`,
      )
    }
  } catch (err) {
    console.warn(
      `[autoPublishOnGenerate] publish threw for project ${projectId}:`,
      err,
    )
  }
}

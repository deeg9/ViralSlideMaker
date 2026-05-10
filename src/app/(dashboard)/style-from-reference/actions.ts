'use server'

// Phase 76 Plan 01 (PREVIEW-01):
// Server-Action wrapper around Phase 75's extractStyleSpec orchestrator.
// Three responsibilities:
//   1. Auth gate — no extraction without an authenticated user
//   2. Storage path -> Buffer hydration (Phase 75 expects Buffer[]; the
//      uploader hands us Storage object PATHS, NOT byte payloads)
//   3. Tier mapping — getUserTier returns 'free' | 'plus' | 'pro';
//      ExtractInput accepts the narrow 'free' | 'paid' surface
// Then it returns the discriminated-union ExtractResult UNCHANGED so the
// client (style-from-reference-shell) can route per error tag (PREVIEW-12
// recovery surface relies on this pass-through).
//
// FIREWALL: this file does NOT import the Gemini SDK directly. Phase 75
// owns the vendor surface; we only compose it. The grep gate in
// __tests__/actions.test.ts (Test 8) enforces this structurally.
//
// regenerateAction is the Phase 77 placeholder seam. Plan 76-03 wires the
// Generate CTA to it; Phase 77 replaces the body with the actual emit path.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserTier } from '@/lib/credits/check-credits'
import { extractStyleSpec } from '@/lib/ai/extract-style-spec'
import {
  SLIDE_REFERENCES_BUCKET,
  type ReferenceAssetRow,
} from '@/lib/types/projects-storage-constants'
import type { ExtractResult, ExtractTelemetry } from '@/lib/ai/extract-style-spec.types'

const ZERO_TELEMETRY: ExtractTelemetry = {
  vision_calls_count: 0,
  tokens_in: 0,
  tokens_out: 0,
  cache_hit: false,
  duration_ms: 0,
}

export interface ExtractStyleSpecActionInput {
  projectId: string
  references: ReferenceAssetRow[]
}

export async function extractStyleSpecAction(
  input: ExtractStyleSpecActionInput,
): Promise<ExtractResult> {
  // 1. Auth gate
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      error: 'extraction_failed',
      detail: 'unauthenticated',
      telemetry: ZERO_TELEMETRY,
    }
  }

  // 2. Empty-references gate (matches reducer's no-references check; the
  // reducer is the structural defense, this is the server-side belt-and-braces)
  if (input.references.length < 1) {
    return {
      ok: false,
      error: 'extraction_failed',
      detail: 'no-references',
      telemetry: ZERO_TELEMETRY,
    }
  }

  // 3. Hydrate Storage paths -> Buffer[] via the admin (service-role) client.
  // The slide-references bucket is private (Phase 74 RLS); the admin client
  // is what Phase 75's ExtractInput contract expects to flow through to the
  // rate-cap RPC anyway.
  const admin = createAdminClient()
  const referenceBytes: Buffer[] = []
  try {
    for (const row of input.references) {
      const { data, error } = await admin.storage
        .from(SLIDE_REFERENCES_BUCKET)
        .download(row.url)
      if (error) {
        return {
          ok: false,
          error: 'extraction_failed',
          detail: `storage-fetch-failed:${error.message ?? 'unknown'}`,
          telemetry: ZERO_TELEMETRY,
        }
      }
      // Blob -> ArrayBuffer -> Buffer
      const ab = await (data as Blob).arrayBuffer()
      referenceBytes.push(Buffer.from(ab))
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return {
      ok: false,
      error: 'extraction_failed',
      detail: `storage-fetch-failed:${msg}`,
      telemetry: ZERO_TELEMETRY,
    }
  }

  // 4. Tier mapping: free stays free; anything else -> 'paid' (uncapped path
  // inside checkExtractionRateCap).
  const rawTier = await getUserTier(user.id)
  const tier: 'free' | 'paid' = rawTier === 'free' ? 'free' : 'paid'

  // 5. Pass-through call. The orchestrator returns the discriminated union;
  // we MUST NOT re-shape it — the client routes per result.ok / result.error.
  return extractStyleSpec({
    projectId: input.projectId,
    userId: user.id,
    tier,
    referenceBytes,
    admin,
  })
}

// ------------------------------------------------------------------------- //
// regenerateAction — Phase 77 placeholder seam                              //
// ------------------------------------------------------------------------- //

export interface RegenerateNotImplemented {
  ok: false
  error: 'not_implemented'
  detail: string
}

export async function regenerateAction(): Promise<RegenerateNotImplemented> {
  // Phase 77 will replace this body with the actual emit path that consumes
  // state.spec + state.aspects + state.useBrandKitRemix from the reducer.
  return { ok: false, error: 'not_implemented', detail: 'Phase 77 will wire the emit path' }
}

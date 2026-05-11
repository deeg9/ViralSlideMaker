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
// Phase 77 Plan 02 Task 4 (EMIT-02 + EDITOR-01): regenerateAction wires
// the persisted-spec → emit → persist → projectId-return flow that the
// Phase 76 dashboard shell consumes via existing router.push routing.
import { generateCarouselFromReferences } from '@/lib/services/carousel'
import type { StyleSpec } from '@/lib/types/style-spec'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { SpecPreviewAspects } from '@/components/style-from-reference/state-machine'
import type { ContentSource } from '@/lib/ai/generate-from-style-spec.types'

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
// regenerateAction — Phase 77 EMIT-02 + EDITOR-01                           //
// ------------------------------------------------------------------------- //
//
// Wires the style-from-reference emit path:
//   1. Auth gate
//   2. Spec presence check (input.spec MUST be non-null)
//   3. Content shape validation (ai-copy needs topic; user-copy needs lines[])
//   4. generateCarouselFromReferences orchestrator (applies aspect filter +
//      brand-kit remix, calls generateFromStyleSpec, persists slide_data)
//   5. Discriminated-union return: { ok:true, projectId, slideCount } OR
//      { ok:false, error: 'unauthenticated' | 'no_spec' | 'invalid_input' |
//        'gemini_error' | 'token_budget_exceeded' | 'extraction_stale',
//        detail? }
//
// EDITOR-01 BY-CONSTRUCTION: this action returns projectId; the client
// (Phase 76 shell) navigates to /project/${projectId} via existing
// router.push pattern (same as today's generateCarousel emit flow). The
// SlideEditor mounts with persisted slide_data → useSlideEditor's
// initial state has past=[], present=slides → one Cmd+Z restores empty
// state. EMIT-10 single-pushHistory satisfied by construction with NO
// new editor wiring needed.

export interface RegenerateActionInput {
  projectId: string
  spec: StyleSpec
  aspects: SpecPreviewAspects
  useBrandKitRemix: boolean
  brandKit: BrandKit | null
  content: ContentSource
}

export type RegenerateActionResult =
  | { ok: true; projectId: string; slideCount: number }
  | {
      ok: false
      error:
        | 'unauthenticated'
        | 'no_spec'
        | 'invalid_input'
        | 'gemini_error'
        | 'token_budget_exceeded'
        | 'extraction_stale'
      detail?: string
    }

export async function regenerateAction(
  input: RegenerateActionInput,
): Promise<RegenerateActionResult> {
  // 1. Auth gate
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'unauthenticated' }
  }

  // 2. Spec presence — defends against client-side state desync
  if (!input.spec) {
    return { ok: false, error: 'no_spec' }
  }

  // 3. Content shape validation
  if (input.content.mode === 'ai-copy' && !input.content.topic) {
    return { ok: false, error: 'invalid_input', detail: 'ai-copy requires topic' }
  }
  if (
    input.content.mode === 'user-copy' &&
    (!Array.isArray(input.content.lines) || input.content.lines.length === 0)
  ) {
    return { ok: false, error: 'invalid_input', detail: 'user-copy requires lines[]' }
  }

  // 4. EDITOR-01: orchestrator persists to projects.slide_data; client
  //    navigates to /project/${projectId} via existing router.push pattern
  //    — SlideEditor mounts with the persisted slides exactly the way today's
  //    generateCarousel flow lands a project. EMIT-10 single-pushHistory
  //    satisfied by construction (initial state has past=[], present=slides;
  //    one Cmd+Z restores empty initial state — same as today's emit flow).
  const admin = createAdminClient()
  try {
    const result = await generateCarouselFromReferences(admin, user.id, input)
    return { ok: true, projectId: result.projectId, slideCount: result.slideCount }
  } catch (err) {
    // T-77-07: only return err.message — never the Error object (no stack
    // leak). T-77-12: do NOT echo spec content into the error path.
    const detail = err instanceof Error ? err.message : 'unknown'
    return { ok: false, error: 'gemini_error', detail }
  }
}

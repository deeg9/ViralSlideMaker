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
// Phase 79 Plan 02 Task 1 (LEGAL-01): clickwrap server action calls the
// audit-log writer from Plan 79-01. Helper NEVER throws — defense in depth
// here wraps the call in try/catch anyway so a future helper change can't
// silently start propagating exceptions through the dispatch path.
import { recordStyleFromReferenceTosAcceptance } from '@/lib/legal/audit-log'
import {
  SLIDE_REFERENCES_BUCKET,
  type ReferenceAssetRow,
} from '@/lib/types/projects-storage-constants'
import type { ExtractResult, ExtractTelemetry } from '@/lib/ai/extract-style-spec.types'
// Phase 77 Plan 02 Task 4 (EMIT-02 + EDITOR-01): regenerateAction wires
// the persisted-spec → emit → persist → projectId-return flow that the
// Phase 76 dashboard shell consumes via existing router.push routing.
import { generateCarouselFromReferences } from '@/lib/services/carousel'
// Phase 78 Plan 02 Task 1 (REMIX-05): regenerateFromReferencesAction creates
// a NEW (sibling) project and runs extract+emit against the inherited refs.
import { createProjectService } from '@/lib/services/projects'
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

// ------------------------------------------------------------------------- //
// regenerateFromReferencesAction — Phase 78 Plan 02 Task 1 (REMIX-05)        //
// ------------------------------------------------------------------------- //
//
// "Regenerate from references" UX entry point. Composes:
//   1. Auth gate
//   2. Source-project lookup (RLS gates by user_id; the calling user must be
//      able to read the source — owner OR via fork inheritance after Plan 78-01)
//   3. Source `reference_assets` presence + non-empty check (REMIX-04 inherit)
//   4. Storage path → Buffer hydration (admin client; mirror extractStyleSpecAction)
//   5. Sibling-create: NEW projects row owned by the CURRENT user (NEVER mutates
//      the source project — verified by Test 8)
//   6. Phase 75 extractStyleSpec({ projectId: NEW_PROJECT_ID, ... })
//   7. Phase 77 generateCarouselFromReferences({ projectId: NEW_PROJECT_ID,
//      spec, ... }) using sane defaults (mode='ai-copy', topic derived from
//      source title/topic, all aspects on, no brand-kit remix by default)
//   8. Returns { ok: true, projectId: NEW_PROJECT_ID } — client navigates
//      to /project/{projectId} via existing router.push pattern
//
// Sibling-create invariant: the only writes are
//   - createProjectService(...) → INSERT a NEW row owned by the CURRENT user
//   - generateCarouselFromReferences(...) → UPDATE the NEW row only
// The source project's row is read-only throughout. Test 8 enforces this by
// inspecting createProjectService + orchestrator inputs and asserting the
// source projectId never appears as a write target.
//
// LEGAL-03 framing: this Server Action's Input/Output shape carries no
// user-facing copy. The button component (Task 2) owns the "Inspired by"
// confirmation copy and the LEGAL-03 grep gate.

export interface RegenerateFromReferencesActionInput {
  sourceProjectId: string
}

export type RegenerateFromReferencesActionResult =
  | { ok: true; projectId: string }
  | {
      ok: false
      error:
        | 'unauthenticated'
        | 'source_not_found'
        | 'no_references'
        | 'extract_failed'
        | 'emit_failed'
      detail?: string
    }

export async function regenerateFromReferencesAction(
  input: RegenerateFromReferencesActionInput,
): Promise<RegenerateFromReferencesActionResult> {
  // 1. Auth gate — fires before any DB / Storage / Gemini work.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'unauthenticated' }
  }

  // 2. Source-project lookup. RLS gates row visibility; we project just the
  // columns we need. .single() returns { data: null } when the row is
  // missing OR when RLS denies — both surface as source_not_found.
  const { data: sourceRow } = await supabase
    .from('projects')
    .select('id, reference_assets, topic, title, template_id')
    .eq('id', input.sourceProjectId)
    .single()
  if (!sourceRow) {
    return { ok: false, error: 'source_not_found' }
  }
  const source = sourceRow as {
    id: string
    reference_assets: ReferenceAssetRow[] | null
    topic: string | null
    title: string | null
    template_id: string | null
  }

  // 3. References must be non-null AND non-empty. REMIX-04 inheritance from
  // Plan 78-01's fork RPC populates this column on forks; legacy projects
  // and non-style-from-reference projects keep null and short-circuit here.
  const references = source.reference_assets
  if (!references || references.length === 0) {
    return { ok: false, error: 'no_references' }
  }

  // 4. Sibling-create: NEW projects row owned by the CURRENT user. Title +
  // topic derived from the source — this surface intentionally has no
  // user-facing copy (the button modal doesn't ask for a title; the source
  // metadata is the best signal). The new row starts with empty slide_data;
  // generateCarouselFromReferences UPDATEs it in step 7.
  const baseTitle = (source.title ?? source.topic ?? 'Inspired by references').trim()
  const newTitle = `${baseTitle} — Inspired by`
  const newTopic = source.topic ?? baseTitle

  let newProjectId: string
  try {
    const { id } = await createProjectService(supabase, user.id, {
      title: newTitle,
      topic: newTopic,
      template_id: source.template_id ?? null,
    })
    newProjectId = id as string
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return { ok: false, error: 'emit_failed', detail: `create-failed:${detail}` }
  }

  // 5. Hydrate Storage paths → Buffer[] via admin client (slide-references
  // bucket is private; mirror extractStyleSpecAction step 3).
  const admin = createAdminClient()
  const referenceBytes: Buffer[] = []
  try {
    for (const row of references) {
      const { data, error } = await admin.storage
        .from(SLIDE_REFERENCES_BUCKET)
        .download(row.url)
      if (error) {
        return {
          ok: false,
          error: 'extract_failed',
          detail: `storage-fetch-failed:${error.message ?? 'unknown'}`,
        }
      }
      const ab = await (data as Blob).arrayBuffer()
      referenceBytes.push(Buffer.from(ab))
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return { ok: false, error: 'extract_failed', detail: `storage-fetch-failed:${detail}` }
  }

  // 6. Tier mapping (same shape as extractStyleSpecAction).
  const rawTier = await getUserTier(user.id)
  const tier: 'free' | 'paid' = rawTier === 'free' ? 'free' : 'paid'

  // 7. Phase 75 extractStyleSpec — projectId is the NEW project so the cost
  // ledger / cache lookups attribute correctly.
  const extractResult = await extractStyleSpec({
    projectId: newProjectId,
    userId: user.id,
    tier,
    referenceBytes,
    admin,
  })
  if (!extractResult.ok) {
    return {
      ok: false,
      error: 'extract_failed',
      detail: extractResult.error,
    }
  }

  // 8. Phase 77 generateCarouselFromReferences — sane defaults (ai-copy mode
  // with the source's topic; all aspects on; no brand-kit remix by default).
  // Project being UPDATEd is the NEW one; sibling-create invariant preserved.
  try {
    const emitResult = await generateCarouselFromReferences(admin, user.id, {
      projectId: newProjectId,
      spec: extractResult.spec,
      aspects: { palette: true, typography: true, layout: true, decorations: true },
      useBrandKitRemix: false,
      brandKit: null,
      content: { mode: 'ai-copy', topic: newTopic },
    })
    return { ok: true, projectId: emitResult.projectId }
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    return { ok: false, error: 'emit_failed', detail }
  }
}

// ------------------------------------------------------------------------- //
// acceptStyleFromReferenceTosAction — Phase 79 Plan 02 Task 1 (LEGAL-01)    //
// ------------------------------------------------------------------------- //
//
// Wires the clickwrap modal's Accept CTA to the Plan 79-01 audit writer.
//   1. Auth gate — anonymous calls return { ok:false, error:'unauthenticated' }
//      WITHOUT writing an audit row (no user_id to attribute it to)
//   2. recordStyleFromReferenceTosAcceptance(admin, { userId, sha256s: [],
//      tosVersion: version }) — empty sha256s is intentional: this records
//      the version-acceptance, not a per-image acknowledgement. The
//      reference-image audit row (sha256-keyed) is recorded by the upload
//      route (Plan 79-02 Task 2 server-side enforcement) when the user
//      actually uploads.
//   3. Recorder fail-secures via the discriminated union; we map { ok:false,
//      error } from the helper to { ok:false, error:'record_failed', detail }
//      so the modal can show a re-try message instead of an opaque crash.
//
// Try/catch wrapper around the recorder is defense-in-depth: the helper
// contract NEVER throws, but if a future change started rejecting we still
// surface a structured result so the modal stays functional.

export type AcceptStyleFromReferenceTosResult =
  | { ok: true }
  | { ok: false; error: 'unauthenticated' | 'record_failed'; detail?: string }

export async function acceptStyleFromReferenceTosAction(
  version: string,
): Promise<AcceptStyleFromReferenceTosResult> {
  // 1. Auth gate
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: 'unauthenticated' }
  }

  // 2. Audit-log write via service-role admin client (RLS routes inserts
  //    through service_role only).
  const admin = createAdminClient()
  try {
    const result = await recordStyleFromReferenceTosAcceptance(admin, {
      userId: user.id,
      sha256s: [],
      tosVersion: version,
    })
    if (result.ok) return { ok: true }

    // Helper returned a structured failure — surface it as record_failed
    // and pass the original error along as detail for forensics.
    const detail =
      result.error instanceof Error
        ? result.error.message
        : typeof result.error === 'string'
          ? result.error
          : 'unknown'
    return { ok: false, error: 'record_failed', detail }
  } catch (err) {
    // Defense-in-depth — the helper contract says it NEVER throws, but if
    // a future change starts rejecting we still surface a structured result.
    const detail = err instanceof Error ? err.message : 'unknown'
    return { ok: false, error: 'record_failed', detail }
  }
}

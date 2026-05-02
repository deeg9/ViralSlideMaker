---
phase: 54-infrastructure-foundation
type: code-review
status: clean
depth: standard
reviewer: orchestrator-inline
generated: 2026-04-30
files_reviewed: 12
findings_critical: 0
findings_high: 0
findings_medium: 0
findings_low: 2
---

# Phase 54 Code Review

**Scope:** 12 source files (excluding tests, snapshots, migrations).
Tests and SQL migrations were validated separately via vitest run + live
DB execution against the project's Supabase instance.

## Files reviewed

| File | LOC Δ | Notes |
|------|------:|-------|
| `src/lib/photo-treatment/sharp-config.ts` | +10 | Module-load side effects per D-04 |
| `src/lib/photo-treatment/treat.ts` | +175 | Core treatPhoto + applyPreset + extractPalette |
| `src/lib/ai/slop-guardrails.ts` | +60 | IMAGEN_ADDENDUM, PEXELS terms, filters |
| `src/lib/imagen/generate-image.ts` | +5 | Prepend IMAGEN_ADDENDUM |
| `src/lib/services/ai-regen.ts` | +4 | Prepend IMAGEN_ADDENDUM |
| `src/lib/pexels/search-photos.ts` | +9/-2 | Wrap query + filter results |
| `src/lib/ai/prompts.ts` | +5 | Append AI_HOOK_VARIETY_ADDENDUM in premium branch |
| `src/lib/render/templates/magazine-bold.ts` | +4/-1 | Inter -> Plus Jakarta Sans |
| `src/lib/render/templates/documentary.ts` | +5/-2 | Inter -> Plus Jakarta Sans (×2) |
| `src/app/api/v1/projects/[id]/track-download/route.ts` | +71 | New POST endpoint |
| `src/lib/download/zip-slides.ts` | +14 | Fire-and-forget tracking call |
| `scripts/capture-zip-baseline.ts` | +75 | One-shot baseline capture |

## Findings

### Critical (0)
None.

### High (0)
None.

### Medium (0)
None.

### Low (2)

**L-1: stylize-image.ts NOT covered by IMAGEN_ADDENDUM (informational)**
File: `src/lib/imagen/stylize-image.ts` (untracked, not modified by this phase)
The plan's SLOP-01 wiring covers two Imagen call sites (`generate-image.ts`
and `ai-regen.ts`) per D-09. The untracked `stylize-image.ts` uses
`gemini-2.5-flash-image-preview` (a different model, not Imagen) so it
correctly falls outside the IMAGEN_ADDENDUM scope. If a future phase
elevates stylize to Imagen, the guardrail addendum should be added there
too — left as a follow-up note rather than a phase blocker.

**L-2: track-download endpoint accepts unauthenticated body fields**
File: `src/app/api/v1/projects/[id]/track-download/route.ts`
Body fields `template_id` and `user_tier` are user-controlled but only
used for analytics denormalization — server-trusted `project.template_id`
overrides the client value when the client sends a string. `user_tier`
is currently NOT cross-checked against the user's actual tier. Per
T-54-02-02 in the plan threat model, this is accepted: corruption of the
user's own analytics row is not a security boundary. If admin dashboards
later trust `user_tier` for billing-adjacent decisions, the server
should look up the tier from the `users` row instead. Documented as a
known limitation; not a Phase 54 blocker.

## Cross-file checks

### Decision-implementation traceability

All 21 CONTEXT decisions (D-01..D-21) have at least one corresponding
code artifact or commit message reference. Spot-check:

| Decision | Artifact |
|----------|----------|
| D-01 (4 presets) | `treat.ts` switch on `spec.kind` covers all 4 |
| D-03 (SHA-256 cache key) | `buildCacheKey()` exported for tests |
| D-04 (sharp config) | `sharp-config.ts` cache(false) + concurrency(1) at module load |
| D-06 (bucket) | `20260501_treated_backgrounds_bucket.sql` applied to live DB |
| D-07 (cron) | `20260501_treated_backgrounds_retention_cron.sql` applied; verified `cron.job` |
| D-09 (single source) | All 4 call sites import from `slop-guardrails.ts` |
| D-10 (verbatim IMAGEN_ADDENDUM) | Substring-checked in tests |
| D-13/D-14 (Inter -> PJS) | grep confirms both templates swapped |
| D-16 (Imagen 4 Fast) | grep returns zero stale model strings |
| D-17/D-18 (events extension) | Constraint def verified live |
| D-19 (view) | `v_zip_download_rate` returns expected tuple live |
| D-20 (baseline) | `.planning/milestones/v2.9-METRIC-BASELINE.md` committed |

### Security boundaries

- `treat.ts` uses `createAdminClient()` (service role) for storage writes.
  `userId` is server-trusted (from authenticated session in calling pipeline).
  RLS `(storage.foldername(name))[1] = auth.uid()::text` enforces folder
  ownership at the bucket level — defense-in-depth.
- `track-download/route.ts` performs auth + ownership check before insert.
  Returns 404 (not 403) on ownership mismatch — no enumeration.
- `pg_cron` `cleanup_orphan_treated_backgrounds()` runs `SECURITY DEFINER`
  with empty `search_path` (matches existing pattern in
  `20260427_explore_remix_phase31_cron.sql`).
- `zip_download_rate()` runs `SECURITY DEFINER` with empty `search_path`;
  view aggregates only — no per-user data exposed.

### Performance / resource concerns

- `sharp.cache(false)` + `sharp.concurrency(1)` at module import — explicitly
  required by Pitfall #5 to prevent serverless memory fragmentation.
- `treatPhoto()` cache hit short-circuits via `storage.list({search})` BEFORE
  any sharp pipeline runs — single network round-trip on hot cache.
- ZIP-download tracking is fire-and-forget with `keepalive: true` — never
  blocks the user's download even on tracking failure.

## Self-Check: PASSED

No critical or high-severity issues. Two low-severity informational notes
documented above. Phase 54 is clean for code review purposes.

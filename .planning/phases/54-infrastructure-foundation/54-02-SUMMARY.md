---
phase: 54-infrastructure-foundation
plan: 02
status: complete
completed: 2026-04-30
self_check: PASSED
requirements_satisfied:
  - SLOP-01
  - SLOP-02
  - SLOP-04
  - SLOP-05
  - METRIC-01
  - METRIC-02
  - METRIC-03
key-files:
  created:
    - src/lib/ai/slop-guardrails.ts
    - src/lib/ai/__tests__/slop-guardrails.test.ts
    - supabase/migrations/20260501_carousel_events_download_zip.sql
    - supabase/migrations/20260501_zip_download_rate_view.sql
    - src/app/api/v1/projects/[id]/track-download/route.ts
    - scripts/capture-zip-baseline.ts
    - .planning/milestones/v2.9-METRIC-BASELINE.md
  modified:
    - src/lib/imagen/generate-image.ts
    - src/lib/services/ai-regen.ts
    - src/lib/pexels/search-photos.ts
    - src/lib/ai/prompts.ts
    - src/lib/render/templates/magazine-bold.ts
    - src/lib/render/templates/documentary.ts
    - src/lib/download/zip-slides.ts
    - src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap
    - public/templates/magazine-bold.png
    - public/templates/documentary.png
---

## Summary

Plan 54-02 lands the v2.9 quality controls on top of the photo-treatment
foundation from Plan 54-01: AI-slop guardrails (single source of truth in
`slop-guardrails.ts`), Imagen 4 Fast verification audit, premium-template
font swap (Inter → Plus Jakarta Sans), and ZIP-download-rate metric
infrastructure with baseline capture.

## Decisions implemented

- D-09: single source of truth at `src/lib/ai/slop-guardrails.ts`; 4 call
  sites import from it (3 Imagen + 1 Pexels + 1 prompts).
- D-10: `IMAGEN_ADDENDUM` locked verbatim — substring-checked in unit tests.
- D-11: Pexels query gets positive terms appended; results filtered post-fetch
  on alt-text against 7 negative terms; falls back to original on empty (never
  blocks generation).
- D-12: `AI_HOOK_VARIETY_ADDENDUM` appended to premium-tier branch of
  `buildSystemPrompt()`.
- D-13/D-14: Inter replaced with Plus Jakarta Sans in `magazine-bold.ts`
  (line 19, body) and `documentary.ts` (lines 29-30, both body and heading).
- D-15: post-swap re-validation passed (no fallback revert needed).
- D-16: Imagen 4 Fast verification audit — verify-only, zero stale model strings.
- D-17/D-18: extended existing `carousel_events` (no parallel events table);
  inserted via server endpoint `POST /api/v1/projects/[id]/track-download`.
- D-19: admin-only SQL view `v_zip_download_rate` (and underlying
  `zip_download_rate(start, end)` function).
- D-20: one-shot `scripts/capture-zip-baseline.ts` writes
  `.planning/milestones/v2.9-METRIC-BASELINE.md`.

## Imagen 4 Fast verification (Task 2 audit)

```
$ grep -rn "imagen-3\|imagen-2\|imagen-1" src/
(no matches, exit 1)

$ grep -rn "imagen-4.0-fast-generate-001" src/lib/imagen/ src/lib/services/
src/lib/imagen/generate-image.ts:38:      model: 'imagen-4.0-fast-generate-001',
src/lib/services/ai-regen.ts:71:      model: 'imagen-4.0-fast-generate-001',
```

(`src/lib/imagen/stylize-image.ts` uses `gemini-2.5-flash-image-preview`
— different model, unrelated to the Imagen audit.)

## Font swap thumbnail diff (Task 2)

| Template | Before (bytes) | After (bytes) | Δ |
|----------|---------------:|--------------:|---:|
| `magazine-bold.png` | 56,903 | 63,234 | +6,331 |
| `documentary.png`   | 37,439 | 37,042 |    -397 |

Snapshot diff: `magazine-bold` and `documentary` `fontFamily:` inline-style
strings in `premium-templates.test.tsx.snap` updated from `'Inter'` to
`'Plus Jakarta Sans'`. Other templates' snapshots untouched.

## Test results

| Suite | Pass | Fail | Notes |
|-------|-----:|-----:|-------|
| `slop-guardrails.test.ts` | 12 | 0 | All 7 spec behaviors + locked-string substring checks. |
| `prompts.test.ts` | 19 | 0 | No regression after `AI_HOOK_VARIETY_ADDENDUM` integration. |
| `validate.test.ts` (templates) | 7 | 0 | No regression after font swap. |
| `premium-templates.test.tsx` | 3 | 0 | Snapshots updated to reflect SLOP-05 change. |
| Full sweep | 561 | 12 | 12 pre-existing failures verified unrelated via `git stash` diff (rate-limit, projects/crud, stripe, slide-preview using `highlight-bar`, editor responsive, generate-slides — all failing on main pre-Phase-54). |

`npx tsc --noEmit` reports zero errors in any Phase 54-02 modified or
created file.

## Live DB verification

| Check | Result |
|-------|--------|
| `pg_get_constraintdef('carousel_events_event_type_check')` | `CHECK ((event_type = ANY (ARRAY['view'::text, 'download_zip'::text])))` |
| `SELECT downloads, projects_created, rate FROM v_zip_download_rate` | `{downloads: 0, projects_created: 53, rate: 0.0000}` |

Migrations applied via `mcp__supabase__apply_migration` (no `supabase db push` used).

## Baseline capture (Task 4)

Script stdout:
```
Wrote baseline: .planning/milestones/v2.9-METRIC-BASELINE.md
  downloads=0, projects=53, rate=0.00%
```

Baseline file at `.planning/milestones/v2.9-METRIC-BASELINE.md` documents
the pre-tracking floor (downloads=0 because tracking just landed) plus a
caveat section explaining how the Phase 58 ship gate evaluates against
this snapshot.

## Carry-forward to Phase 56

Treatment-pipeline integration is **deferred to Phase 56** (per CONTEXT.md
phase boundary). When premium templates begin consuming `treatPhoto()`
outputs, the generation pipeline will replace raw URL writes with treated
URLs at the call site documented in CONTEXT.md `<integration_points>`.
Phase 55 owns the `slide.original_source_url` schema split (per D-08
acknowledged in Plan 54-01).

## Self-Check: PASSED

- SLOP-01: ✅ `IMAGEN_ADDENDUM` prepended at every Imagen call site;
  single source in `slop-guardrails.ts`.
- SLOP-02: ✅ `pexelsQueryWithGuardrails()` + `filterPexelsResultsByAlt()`
  with safe-fallback; 7 negative alt terms locked.
- SLOP-04: ✅ `AI_HOOK_VARIETY_ADDENDUM` appended in premium branch.
- SLOP-05: ✅ Both templates swapped; thumbnails regenerated; v2.7
  audit suite re-runs green.
- METRIC-01: ✅ `download_zip` events tracked with full payload; endpoint
  + client wired with fire-and-forget call.
- METRIC-02: ✅ `v_zip_download_rate` view returns the 5-column tuple;
  admin-only via SECURITY DEFINER + GRANT to authenticated.
- METRIC-03: ✅ Baseline captured; result file committed at
  `.planning/milestones/v2.9-METRIC-BASELINE.md`.

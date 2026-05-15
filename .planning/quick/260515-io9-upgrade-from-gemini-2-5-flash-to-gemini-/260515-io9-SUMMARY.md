---
phase: quick-260515-io9
plan: 01
subsystem: ai
tags: [gemini, gemini-3-flash-preview, model-config, env-var, supabase-migration]

# Dependency graph
requires:
  - phase: 75-vision-extraction
    provides: extractStyleSpec orchestrator + GEMINI_VISION_MODEL constant
  - phase: 73-cost-rails
    provides: style_spec_cache table + persistStyleSpec DEFAULT_MODEL
provides:
  - Single env-backed GEMINI_TEXT_MODEL source-of-truth constant
  - All 13 Gemini TEXT-model call sites resolve through one import
  - style_spec_cache.model column default migration for gemini-3-flash-preview
  - grep-gate test forbidding future hardcoded gemini-2.5-flash text literals
affects: [gemini, ai-generation, style-extraction, cost-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Env-var-with-fallback model ID: process.env.GEMINI_TEXT_MODEL ?? '<default>' for zero-deploy rollback"
    - "Grep-gate test enforcing zero hardcoded model literals outside the constant module"

key-files:
  created:
    - src/lib/ai/gemini-model.ts
    - supabase/migrations/20260515_v213_style_spec_cache_default_gemini3.sql
    - src/lib/ai/__tests__/gemini-model.test.ts
  modified:
    - src/lib/ai/extract-style-spec.ts
    - src/lib/ai/generate-slides.ts
    - src/lib/ai/generate-from-style-spec.ts
    - src/lib/ai/match-photos-to-slides.ts
    - src/lib/captions/generate-captions.ts
    - src/lib/imagen/generate-prompt.ts
    - src/lib/services/ai-regen.ts
    - src/lib/cache/style-spec-cache.ts
    - src/app/(dashboard)/project/[id]/editor-actions.ts
    - src/app/(dashboard)/settings/brand-kit/actions.ts
    - src/app/api/cron/style-extraction-bill-alarm/route.ts

key-decisions:
  - "Target model is gemini-3-flash-preview per PLAN.md (source of truth); RESEARCH.md suggested gemini-3.1-flash-lite but the plan explicitly chose the preview SKU"
  - "GEMINI_VISION_MODEL kept as a backward-compat named export, re-pointed as a thin alias of GEMINI_TEXT_MODEL"
  - "No model filter added to lookupStyleSpec — cached StyleSpec is model-agnostic validated JSON; model column is provenance metadata"
  - "Existing style_spec_cache rows NOT backfilled — each row reflects the model it was extracted with"

patterns-established:
  - "Single env-backed model-ID constant: src/lib/ai/gemini-model.ts is the only place a Gemini text-model literal lives"
  - "Grep-gate test in gemini-model.test.ts fails the build on any reintroduced hardcoded gemini-2.5-flash text literal"

requirements-completed: [io9-MODEL-SWAP]

# Metrics
duration: 5min
completed: 2026-05-15
---

# Phase quick-260515-io9 Plan 01: Upgrade Gemini TEXT model to gemini-3-flash-preview Summary

**Centralized the Gemini TEXT-model ID into one env-backed `GEMINI_TEXT_MODEL` constant, flipped all 13 production call sites off the hardcoded `gemini-2.5-flash` literal to `gemini-3-flash-preview`, and added a grep-gate test plus a `style_spec_cache.model` default migration.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-15T20:49:24Z
- **Completed:** 2026-05-15T20:54:19Z
- **Tasks:** 3
- **Files modified:** 11 modified, 3 created

## Accomplishments
- New `src/lib/ai/gemini-model.ts` exporting `GEMINI_TEXT_MODEL` with the `process.env.GEMINI_TEXT_MODEL ?? 'gemini-3-flash-preview'` env-fallback pattern — rollback to 2.5 Flash is a zero-deploy env-var change.
- All 13 hardcoded `gemini-2.5-flash` text-model call sites across 10 production files now import the single constant; `GEMINI_VISION_MODEL` re-pointed as a thin backward-compat alias.
- New SQL migration `20260515_v213_style_spec_cache_default_gemini3.sql` bumps the `style_spec_cache.model` column DEFAULT (no backfill).
- New `gemini-model.test.ts` with a default-fallback assertion and a build-failing grep-gate that forbids any future hardcoded `gemini-2.5-flash'` text literal (allowlisting only the constant module and the untouched `stylize-image.ts` image model).
- Image-generation model `gemini-2.5-flash-image-preview` (`stylize-image.ts`) left untouched per scope.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GEMINI_TEXT_MODEL constant + flip all 11 production call sites** - `8cc2ef0` (feat)
2. **Task 2: Add style_spec_cache.model default migration** - `993989d` (feat)
3. **Task 3: Update test fixtures + add constant-resolution + grep-gate test** - `38ad903` (test)

_Note: Task 3 is a tdd task; the constant-resolution and grep-gate tests are new tests that pass GREEN against the Task 1 implementation, and the fixture updates align existing tests with the new model string. The plan-level RED/GREEN/REFACTOR gate is satisfied within the per-task `feat`/`test` commit sequence._

## Files Created/Modified
- `src/lib/ai/gemini-model.ts` - NEW. Single source-of-truth env-backed `GEMINI_TEXT_MODEL` constant.
- `supabase/migrations/20260515_v213_style_spec_cache_default_gemini3.sql` - NEW. ALTER COLUMN model SET DEFAULT migration (no backfill).
- `src/lib/ai/__tests__/gemini-model.test.ts` - NEW. Default-fallback assertion + grep-gate test.
- `src/lib/ai/extract-style-spec.ts` - `GEMINI_VISION_MODEL` re-pointed as alias of `GEMINI_TEXT_MODEL`.
- `src/lib/ai/generate-slides.ts` - Topic-flow Gemini call uses `GEMINI_TEXT_MODEL`.
- `src/lib/ai/generate-from-style-spec.ts` - Copy-Style Gemini call uses `GEMINI_TEXT_MODEL`.
- `src/lib/ai/match-photos-to-slides.ts` - Photo-matching vision call uses `GEMINI_TEXT_MODEL`.
- `src/lib/captions/generate-captions.ts` - Caption generation uses `GEMINI_TEXT_MODEL`.
- `src/lib/imagen/generate-prompt.ts` - Both Imagen prompt-rewriter calls use `GEMINI_TEXT_MODEL`.
- `src/lib/services/ai-regen.ts` - Slide-text regeneration uses `GEMINI_TEXT_MODEL`.
- `src/lib/cache/style-spec-cache.ts` - `DEFAULT_MODEL` = `GEMINI_TEXT_MODEL`; JSDoc updated.
- `src/app/(dashboard)/project/[id]/editor-actions.ts` - Both editor regenerate calls use `GEMINI_TEXT_MODEL`.
- `src/app/(dashboard)/settings/brand-kit/actions.ts` - Brand-kit AI helper uses `GEMINI_TEXT_MODEL`.
- `src/app/api/cron/style-extraction-bill-alarm/route.ts` - Cost-estimate comment text updated to gemini-3-flash-preview.
- `src/__tests__/imagen/generate-prompt.test.ts` - Fixture model string updated.
- `src/__tests__/ai/generate-slides.test.ts` - Fixture model string updated.
- `src/lib/cache/__tests__/style-spec-cache.test.ts` - "defaults model when omitted" test name + expectation updated; `gemini-2.5-pro` non-default fixture left unchanged.

## Decisions Made
- Executed against `gemini-3-flash-preview` as specified in PLAN.md frontmatter and tasks (the plan's source-of-truth choice). RESEARCH.md proposed `gemini-3.1-flash-lite` as an alternative, but the plan explicitly locked the preview SKU and the env-var fallback makes any later switch a zero-deploy change.
- `GEMINI_VISION_MODEL` retained as a named export in `extract-style-spec.ts` (now a thin alias) to avoid breaking any importer.
- No model filter added to `lookupStyleSpec` — per the plan's documented stale-cache decision, cached StyleSpec is model-agnostic validated JSON.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing, out-of-scope test failure (NOT fixed):** `src/__tests__/ai/generate-slides.test.ts > searchPhotos > calls Pexels with orientation=portrait` fails because its fixture asserts `query: 'nature'` while `searchPhotos` now passes a style-augmented query. Verified pre-existing by reproducing the same failure on the clean base commit `993989d` with all io9 changes stashed — it is unrelated to the Gemini model swap. Logged to `deferred-items.md`; left untouched per the SCOPE BOUNDARY rule. The model-fixture test in the same file (`generate-slides.test.ts:317`) passes.

**Lint baseline preserved:** `npm run lint` reports `119 problems (4 errors, 115 warnings)` — identical to the clean-base baseline (verified by stashing io9 changes). The 4 errors are pre-existing `require()`-import errors in `scripts/grep-gates/prompt-token-budget.cjs` (a `.cjs` file), out of scope. Zero new lint problems from this task's files.

## Verification Results
- Grep gate: zero hardcoded `gemini-2.5-flash'` text literals in non-test production code outside the constant module.
- `git diff` shows `20260510_style_spec_cache.sql` untouched.
- `gemini-2.5-flash-image-preview` still has its single occurrence in `stylize-image.ts` (image model untouched).
- `npx tsc --noEmit`: 19 errors — exactly the documented baseline (pre-existing test-mock errors); zero new errors.
- 307 tests pass across `src/lib/ai`, `src/lib/cache`, `src/lib/captions`, `src/lib/imagen`, `src/lib/services`.
- EMIT-06 token-budget gate green: assembled prompt 1371 tokens (budget 12000) — a model swap does not change prompt size.

## User Setup Required

None - no external service configuration required. Optional: set the `GEMINI_TEXT_MODEL` env var to override the default model (e.g. roll back to `gemini-2.5-flash`) with zero redeploy.

## Migration To Apply

`supabase/migrations/20260515_v213_style_spec_cache_default_gemini3.sql` was created but **NOT applied** to any database (per constraints). The orchestrator/user must apply it separately via the standard `supabase db push` flow.

## Next Phase Readiness
- Model swap complete; the env-backed constant gives a zero-deploy rollback escape hatch off the preview-status model.
- The pending SQL migration must be applied before new cache writes record the new default.

## Self-Check: PASSED

All created files exist on disk (`gemini-model.ts`, the migration, `gemini-model.test.ts`, this SUMMARY). All three task commits (`8cc2ef0`, `993989d`, `38ad903`) verified in `git log`.

---
*Phase: quick-260515-io9*
*Completed: 2026-05-15*

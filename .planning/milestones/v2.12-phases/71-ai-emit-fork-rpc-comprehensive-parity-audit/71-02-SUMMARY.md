---
phase: 71-ai-emit-fork-rpc-comprehensive-parity-audit
plan: 02
subsystem: ai-decoration-monoculture-gate, fork-rpc-sql-migration
tags: [ai, decoration, monoculture, advisory-gate, fork-rpc, supabase, migration, v2.12]
requirements_closed:
  - AI-05
  - MIGR-01
dependency_graph:
  requires:
    - 71-01  # resolved DecorationContent[] feeds the diversity check post-ingest
  provides:
    - decorationDiversityCheck (advisory monoculture gate with v3.0+ promote anchor)
    - DEFAULT_MONOCULTURE_THRESHOLD = 0.60 export
    - _strip_locked_from_slide_data extended to walk decorations[] (T-71-09 mitigation)
  affects:
    - src/lib/ai/generate-slides.ts (one new advisory call post-ingest)
tech_stack:
  added: []
  patterns:
    - v2.9 D-14 advisory-only diversity gate (console.warn, never fails CI)
    - v2.11 LOCK-08 SQL helper extension (one-line FOREACH ARRAY[] addition)
key_files:
  created:
    - src/lib/ai/decoration-diversity-check.ts
    - src/lib/ai/__tests__/decoration-diversity-check.test.ts
    - supabase/migrations/20260504_fork_strip_decoration_locked.sql
    - supabase/migrations/__tests__/fork-strip-decoration-locked.test.ts
  modified:
    - src/lib/ai/generate-slides.ts  # 3 LOC: import + advisory call after slidesWithDecorations
decisions:
  - Wired decorationDiversityCheck() into generate-slides.ts (recommended path) — production-time advisory log on every Gemini ingest from Phase 71 ship
  - Per-discriminator dominance: icons and shapes are independent populations; a 4/4 icon dominance does NOT compare against shape population (and vice versa)
  - Threshold uses >= comparison (60.0% triggers warn at the boundary)
  - Migration test infra: Option B (JS-side jsonb-walker port + SQL-string assertions) — no existing migration test infra in repo; pure infra-free approach
  - Migration redeclares only the helper, NOT fork_published_carousel — the RPC body is unchanged, so CREATE OR REPLACE on the helper propagates automatically
metrics:
  duration_min: 4
  completed: 2026-05-04
  tasks_completed: 2
  tests_added: 20  # 12 diversity + 8 migration (5 SQL-behavior + 3 file/structure)
  files_created: 4
  files_modified: 1
---

# Phase 71 Plan 02: Advisory monoculture gate + Fork RPC SQL migration — Summary

**One-liner:** Two parallel infra-class glue pieces — a pure advisory `decorationDiversityCheck` helper (≥60% lucideName/shapeKind dominance → console.warn; never fails CI; v3.0+ promotion anchor exported) wired post-ingest in `generate-slides.ts`, plus a one-line SQL extension to `_strip_locked_from_slide_data` adding `'decorations'` to the FOREACH ARRAY[] so forkers inherit decoration positions/colors but never lock state.

## Closes

- **AI-05** — Advisory monoculture gate for AI-emitted decorations
- **MIGR-01** — Fork RPC strip-decoration-locked migration

## What Shipped

### Task 1 — `decoration-diversity-check.ts` (commit `cec0791`)

Pure helper exporting:
- `decorationDiversityCheck(slides, opts?)` → `DiversityCheckResult` with `warned`, `dominantKind`, `dominantName`/`dominantShapeKind`, `dominantCount`, `total`, `share`
- `DEFAULT_MONOCULTURE_THRESHOLD = 0.60` (v3.0+ promote-to-fail anchor)
- `DiversityCheckOpts` (threshold override + carouselId tag)

Algorithm:
1. Walk `slides[].decorations?` — skip non-array gracefully
2. Build two independent frequency maps: `iconFreq` keyed by `lucideName`, `shapeFreq` keyed by `shapeKind`
3. Compute per-discriminator dominance (top count / population total)
4. If any candidate's `share >= threshold` → `console.warn` with `[decoration-diversity]` prefix, optional `carousel=<id>`, dominant key+name+share+count/total, "ADVISORY" suffix
5. Return populated result; otherwise `{ warned: false }`

Wired into `generate-slides.ts` post-`slidesWithDecorations.map(...)`:
```typescript
decorationDiversityCheck(slidesWithDecorations, {
  carouselId: parsedCarousel.title,
})
```

3 LOC; never blocks; never throws.

**Tests:** 12/12 GREEN. Coverage:
1. No decorations → silent
2. 40% diversity below threshold → silent
3. 80% Heart icon dominance → warns with full payload
4. 80% rect shape dominance → warns
5. Exactly 60% → warns (boundary inclusive)
6. 59% → silent
7. Per-discriminator independence (4 icons + 1 shape → icon population = 4, not 5)
8. Multi-deco-per-slide counted individually
9. `opts.carouselId` appears in warn message
10. `opts.threshold = 0.40` honored
11. Malformed entries gracefully skipped (never throws)
12. Exported constant equals 0.60

### Task 2 — Fork RPC SQL migration (commit `ffaef03`)

`supabase/migrations/20260504_fork_strip_decoration_locked.sql`:
- `CREATE OR REPLACE FUNCTION public._strip_locked_from_slide_data(p_slide_data jsonb)` — body identical to v2.11 baseline `20260502_fork_strip_locked.sql` EXCEPT one material change:
  ```sql
  FOREACH arr_field IN ARRAY ARRAY['text_boxes', 'custom_images', 'custom_texts', 'decorations']
  ```
  (Phase 71 added the 4th entry.)
- `fork_published_carousel` is NOT redeclared — the helper update propagates automatically.
- Header comment block + verification SQL refreshed to reference `slide_data->0->'decorations'->0->'locked'` for post-deploy spot-check.
- `GRANT EXECUTE` preserved across CREATE OR REPLACE.

**Diff against v2.11 baseline:** comment block refresh + the one ARRAY[] entry. No other body changes (verified by `diff` command).

**Tests:** 8/8 GREEN (5 SQL-behavior tests + 3 file/structure assertions):
1. Decoration `locked` stripped (key removed, not nulled)
2. Non-locked decoration preserved (all fields kept)
3. **Regression** — `text_boxes` locked still stripped (v2.11 LOCK-08)
4. **Regression** — `watermark.locked` still stripped (singleton path)
5. Missing `decorations` field is no-op
6. Migration file exists at expected path
7. Migration matches `ARRAY['text_boxes', 'custom_images', 'custom_texts', 'decorations']` regex
8. Helper structure preserved (CREATE OR REPLACE form, watermark path, `#- '{locked}'` operator)

**Test infra rationale:** Repo has no existing `supabase/migrations/__tests__/` directory or pg-mem dependency. Per the plan's discretion, picked **Option B**: pure-JS port of the SQL helper algorithm (one-for-one fidelity with the SQL FOREACH/jsonb_set/jsonb_array_elements logic) + file-content regex assertions on the migration. Zero infra dependency; deterministic; runs in 6ms. Future Plan 71-03 ship-gate can layer on a live integration test against a Supabase test instance if that infra lands later.

## Decisions Made

1. **Wire diversity check into generate-slides.ts** (recommended path in plan). Rationale: 3 LOC, zero risk (advisory only, never throws), buys production-time advisory logs from Phase 71 ship onward. The plan-71-01 ingest tests still GREEN (verified — wire never blocks).
2. **Per-discriminator frequency** (not combined). Rationale: a carousel with 4 Heart icons + 1 rect shape has 100% Heart icon-dominance but only 80% Heart overall-dominance — the per-discriminator metric is the structurally meaningful signal (Gemini emits two separate populations).
3. **>= threshold comparison** (60.0% triggers). Per Test 5 assertion in plan.
4. **Migration redeclares only the helper.** Rationale: `fork_published_carousel` body is unchanged; redeclaring it is dead weight that risks divergence from the v2.11 baseline. CREATE OR REPLACE on the helper propagates automatically (idempotent function-pointer update).
5. **Test infra Option B for migration.** Rationale: no existing infra; SQL-string assertions + JS-side helper port = zero-dependency / deterministic / fast. Documented for Plan 71-03 ship-gate to layer on richer integration testing if/when infra lands.

## Deviations from Plan

**None — plan executed exactly as written.**

The migration test count was 8 vs the planned ~5 because I added 3 supplemental file/structure assertions (file exists, ARRAY[] regex, helper preservation) on top of the 5 SQL-behavior tests. Strictly additive — does not weaken any planned coverage. Counts as scope-aligned (plan said "~5 SQL tests"; the 5 plan-specified scenarios are all covered).

## Verification

```
npx vitest run \
  src/lib/ai/__tests__/decoration-diversity-check.test.ts \
  supabase/migrations/__tests__/fork-strip-decoration-locked.test.ts
→ Test Files  2 passed
→ Tests       20 passed
```

```
npx tsc --noEmit | grep -c "error TS"
→ 17  (baseline preserved)
```

```
diff supabase/migrations/20260502_fork_strip_locked.sql \
     supabase/migrations/20260504_fork_strip_decoration_locked.sql
→ Header comment refresh + 'decorations' added to ARRAY[]
→ v2.11 redeclares fork_published_carousel; new migration correctly omits
  (helper-only redeclare; RPC body unchanged)
```

## Cross-Refs

- **Plan 71-01:** Resolved `DecorationContent[]` from `generate-slides.ts` ingest is the input population to `decorationDiversityCheck`. The wire fires AFTER the resolution pass and BEFORE `legacyToTextBoxes` — ensures we measure the post-ingest canonical shape.
- **Plan 71-03 (ship-gate doc):** Should enumerate this plan's outputs alongside the parity audit. Specifically: list `20260504_fork_strip_decoration_locked.sql` as a deploy-required migration AND list `decorationDiversityCheck` advisory wiring as a production-log signal to monitor in week 1 post-ship.
- **v2.9 D-14 (`src/lib/ai/__tests__/diversity.test.ts`):** Pattern parent for advisory-only diversity gates. v3.0+ promotion of either gate to fail-CI should import the relevant `DEFAULT_*_THRESHOLD` constant rather than redefining.
- **v2.11 LOCK-08 (`supabase/migrations/20260502_fork_strip_locked.sql`):** SQL pattern parent. Phase 71 MIGR-01 is the one-line forward-compatible extension; v2.11 LOCK-08 regression guards (Tests 3+4) verify no behavior drift.

## Threat Model Compliance

- **T-71-09 (Elevation of Privilege — original creator sets locked: true on decorations to block forker editing):** **MITIGATED.** Migration `_strip_locked_from_slide_data` walks decorations[] and removes the `locked` key via `#- '{locked}'`. Forker's project copy has `locked === undefined` on every decoration regardless of source. Tests 1+2 verify direct behavior; Tests 3+4 verify v2.11 LOCK-08 regression guards still pass.
- **T-71-10 (Tampering — RPC injection):** **ACCEPTED** per plan. RPC signature `(p_published_id uuid)` prevents injection; SECURITY DEFINER + `search_path = ''` preserved from v2.11.
- **T-71-11 (Information Disclosure — console.warn leaks carousel id):** **ACCEPTED** per plan. Server-side only; carousel id is non-PII.
- **T-71-12 (DoS — adversarial input to diversity check):** **ACCEPTED** per plan. O(N) over decorations; upstream Plan 71-01 clamps to maxItems=2 per slide × ≤10 slides → max 20 entries.

## Commits

| Hash      | Type | Message |
|-----------|------|---------|
| `cec0791` | feat | feat(71-02): advisory decorationDiversityCheck monoculture gate |
| `ffaef03` | feat | feat(71-02): fork RPC strip-decoration-locked migration |

## Self-Check: PASSED

- [x] `src/lib/ai/decoration-diversity-check.ts` exists
- [x] `src/lib/ai/__tests__/decoration-diversity-check.test.ts` exists (12 tests pass)
- [x] `supabase/migrations/20260504_fork_strip_decoration_locked.sql` exists, contains `'decorations'` in ARRAY[]
- [x] `supabase/migrations/__tests__/fork-strip-decoration-locked.test.ts` exists (8 tests pass)
- [x] `generate-slides.ts` modified — `decorationDiversityCheck` import + advisory call
- [x] Commit `cec0791` exists in git log
- [x] Commit `ffaef03` exists in git log
- [x] tsc baseline 17 preserved
- [x] Plan 71-01 (decoration-ai-ingest) tests STILL GREEN after the wire

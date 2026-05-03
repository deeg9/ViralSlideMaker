---
phase: 64-lock-hide-z-order
plan: 02
subsystem: editor + renderers + supabase
tags: [hidden, reducer, both-renderers, parity, selection-bounds, fork-rpc, supabase-migration, lock-08]

# Dependency graph
requires:
  - phase: 60-multi-select-foundation-watermark-schema-lift
    provides: hidden? field on TextBox / CustomImage / Watermark; applyDualWrite (BL-01)
  - phase: 63-alignment-distribute-smart-guides
    provides: computeSelectionBounds union-AABB read helper (Plan 63-01 lift; Phase 64 closes the hidden-skip gap)
  - phase: 64-lock-hide-z-order/01
    provides: SET_LOCKED reducer pattern reused for SET_HIDDEN (locked → hidden field swap, identical shape)
provides:
  - SET_HIDDEN reducer action (single-pushHistory toggle on selection ids; ref-equal short-circuit on no-change; routes text_boxes through applyDualWrite)
  - computeSelectionBounds hidden-skip filter — hidden text_boxes / custom_images / watermark EXCLUDED from union AABB (LOCK-07 read-side; locked still INCLUDED per Phase 63 D-01)
  - render-slide-satori.tsx hidden filter at 5 iteration sites (hook, body, custom_images.filter, watermark gate, custom_texts.filter via text_boxes mirror)
  - slide-preview.tsx hidden filter at 8 iteration sites (4 editable Rnd wrappers + 4 non-editable iteration sites; symmetric for TPLREND-05)
  - PARITY-01 PH1..PH5 — hidden element absent in BOTH renderer outputs (byte-identity invariant)
  - supabase/migrations/20260502_fork_strip_locked.sql — _strip_locked_from_slide_data jsonb walk + fork_published_carousel re-declaration (LOCK-08 forker takes ownership)
affects:
  - 64-03 (Z-ORDER reducer — SET_HIDDEN pattern reusable for ZORDER's per-id walk; selection-bounds is now hidden-aware so z-order operations on hidden elements behave consistently)
  - 65-layers-panel (Hide/Show toggle dispatches SET_HIDDEN; renderers already honor the field)
  - explore/remix flow (forking a published carousel now yields fully editable elements regardless of original creator's locks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer parity by byte-identical filter logic at iteration sites (TPLREND-05 invariant; same predicate `element.hidden === true` skips, same call-site shape, both renderers)"
    - "PARITY-01 absence-probe via renderToStaticMarkup — Satori React tree → HTML string assertion mirrors React preview innerHTML scan; sanity floor (without hidden flag) gates against vacuous-pass"
    - "Reducer trusts caller toggle math (mirrors SET_LOCKED from Plan 64-01 — toggle decision lives at dispatch site)"
    - "Pure SQL helper `_strip_locked_from_slide_data(jsonb) RETURNS jsonb` — IMMUTABLE jsonb walk, callable from any RPC; non-DEFINER (DEFINER inherited from caller)"

key-files:
  created:
    - supabase/migrations/20260502_fork_strip_locked.sql
  modified:
    - src/lib/editor/editor-actions.ts (SET_HIDDEN variant added to discriminated union)
    - src/lib/editor/editor-reducer.ts (SET_HIDDEN case mirroring SET_LOCKED; placed immediately after SET_LOCKED)
    - src/lib/editor/transforms/selection-bounds.ts (tb.hidden / ci.hidden / watermark.hidden gates; module header extended with Phase 64 LOCK-07 closure note)
    - src/lib/editor/__tests__/editor-reducer.test.ts (SH1..SH5 — 5 new tests)
    - src/lib/editor/__tests__/selection-bounds.test.ts (SB-H1..SB-H3 — 3 new tests)
    - src/components/slides/slide-preview.tsx (8 hidden filter sites — editable hook/body/ct/ci Rnd + non-editable hook/body/ci/ct + watermark gate ×2)
    - src/lib/render/render-slide-satori.tsx (5 hidden filter sites — hook/body/ci/watermark/ct)
    - src/lib/render/__tests__/parity.test.tsx (PH1..PH5 — 5 new tests; render-Satori-tree-to-HTML harness via renderToStaticMarkup)

key-decisions:
  - "Hidden filter logic IDENTICAL across both renderers at the SAME iteration sites — `element.hidden === true` (or `.filter(el => el.hidden !== true)` for map chains) is the single predicate. TPLREND-05 byte-identity is preserved because the gate is structural, not stylistic."
  - "Hidden ≠ Locked semantically. computeSelectionBounds INCLUDES locked (Phase 63 D-01: visible footprint) and EXCLUDES hidden (LOCK-07: no rendered footprint to pad union AABB). Both filters are independent — module header explicitly documents the separation to prevent future drift."
  - "Custom-text hidden flag lives on the text_boxes mirror (Phase 49 dual-write contract). Both renderers look up the matching text_box by id and read `hidden` from it. The legacy `slide.custom_texts` field doesn't carry hidden — the canonical surface is text_boxes."
  - "Watermark hidden gate placed BEFORE resolveWatermark in slide-preview.tsx — early-return when slide.watermark?.hidden === true so the legacy resolver path is uniformly suppressed across both renderers (the new unified slot AND the legacy brandKit-derived path)."
  - "Migration helper public._strip_locked_from_slide_data is IMMUTABLE + non-DEFINER. The wrapping fork_published_carousel keeps SECURITY DEFINER. Helper is grant-execute to authenticated only — no anon access; pure-data function so no DB permission concerns."
  - "Migration uses `jsonb #- '{locked}'` (key-removal) rather than `jsonb_set ... = null` (set-to-null) so the resulting jsonb is structurally identical to a slide with no locked field — matches the behavior of a freshly-generated carousel."

patterns-established:
  - "Pattern: SET_LOCKED → SET_HIDDEN reducer cluster — both actions mirror identical shape (locked → hidden field swap), identical idempotency rules, identical applyDualWrite routing. Future toggle-on-element-set actions follow this template."
  - "Pattern: byte-identical filter logic for both-renderer parity — when adding a new structural gate (hidden, future locked-skip, etc.), patch BOTH render-slide-satori.tsx and slide-preview.tsx (×2 branches) at the same iteration sites with the same predicate. PARITY-01 harness uses renderToStaticMarkup to compare both outputs."
  - "Pattern: pure SQL jsonb-walk helper for fork-time scrubbing — _strip_locked_from_slide_data is the second use of the v2.4 brand_kit_id strip pattern (template_id → 'bold-minimal' was first). Future fork-time scrubs (e.g. analytics ids, draft watermarks) can extend the helper."

requirements-completed: [LOCK-07, LOCK-08]

# Metrics
duration: ~9 min
completed: 2026-05-03
---

# Phase 64 Plan 02: HIDDEN reducer + both-renderer hidden filter + selection-bounds hidden-skip + Fork RPC strip-locked migration Summary

**SET_HIDDEN reducer mirroring SET_LOCKED + 13 byte-identical hidden-filter sites across both renderers (5 Satori + 8 React preview) + computeSelectionBounds hidden-skip + fork_published_carousel locked-strip migration; closes LOCK-07 + LOCK-08 with 13 new tests + tsc baseline preserved at 17.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-03T06:07Z
- **Completed:** 2026-05-03T06:16Z
- **Tasks:** 3 (all autonomous; Tasks 1+2 TDD RED→GREEN; Task 3 single migration commit)
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- **SET_HIDDEN reducer action** — single-pushHistory toggle on text_boxes ∪ custom_images ∪ watermark; routes through applyDualWrite (BL-01); ref-equal short-circuit on empty ids OR all-no-op selections (matches SET_LOCKED idempotency); placed immediately after SET_LOCKED in the reducer for clean clustering.
- **selection-bounds hidden-skip** — `tb.hidden === true continue` and `ci.hidden === true continue` filters added BEFORE the existing structural-anchor / push checks; watermark gate extended to require `slide.watermark.hidden !== true`. Module header extended with explicit Phase 64 LOCK-07 closure note distinguishing hidden (excluded) from locked (included per Phase 63 D-01).
- **Both renderers honor hidden** — render-slide-satori.tsx applies the filter at 5 iteration sites (hook/body JSX gates, custom_images.filter, watermark logical-and, custom_texts.filter via text_boxes mirror lookup). slide-preview.tsx applies it at 8 sites (4 editable Rnd wrappers + 4 non-editable iteration sites) — symmetric across both branches so editable=true and editable=false produce structurally identical output for hidden elements.
- **PARITY-01 PH1..PH5** — new Satori-rendered-to-HTML harness (renderToStaticMarkup wrapping buildSlideElement) lets the parity suite assert absence in BOTH renderer outputs. PH3 includes a brand-kit-equipped sanity floor proving the test isn't vacuously passing. PH5 also pins Plan 64-01's contract: locked alone renders normally; hidden takes precedence over locked.
- **LOCK-08 fork RPC migration** — new helper `_strip_locked_from_slide_data(jsonb)` walks every slide, every element of text_boxes / custom_images / custom_texts, and the watermark slot; uses `jsonb #- '{locked}'` for key-removal (vs set-to-null). fork_published_carousel re-declared with one added line (helper invocation between fetch and INSERT INTO projects). Helper is IMMUTABLE + non-DEFINER + pure-data — no DoS surface, no privilege escalation.

## Task Commits

Tasks 1 + 2 followed TDD RED→GREEN; Task 3 was a single SQL file commit.

1. **Task 1 RED: SH1..SH5 + SB-H1..SB-H3** — `bbd5cb2` (test) — 8 reducer + bounds tests authored against missing implementation
2. **Task 1 GREEN: SET_HIDDEN reducer + selection-bounds hidden-skip** — `3f2ec3f` (feat) — case + 3 filter sites; all 95 tests in both suites pass
3. **Task 2 RED: PH1..PH5 + Satori HTML harness** — `5fd2763` (test) — 5 parity tests + renderSatoriHtml helper authored
4. **Task 2 GREEN: both renderers honor hidden** — `329e964` (feat) — 13 filter sites across satori + preview; all 42 PARITY tests pass
5. **Task 3: fork_published_carousel locked-strip migration** — `0fa44bb` (feat) — _strip_locked_from_slide_data helper + RPC re-declaration

**Plan metadata commit:** (this commit, executor finalization)

## Files Created/Modified

- **`src/lib/editor/editor-actions.ts`** — Added `SET_HIDDEN` variant to the EditorAction discriminated union (12-line block with full behavior contract comment mirroring SET_LOCKED's shape).
- **`src/lib/editor/editor-reducer.ts`** — New `case 'SET_HIDDEN'` placed immediately after SET_LOCKED. Implementation is verbatim copy of SET_LOCKED's body with `locked` → `hidden`. Routes text_boxes through applyDualWrite (BL-01).
- **`src/lib/editor/transforms/selection-bounds.ts`** — `if (tb.hidden === true) continue` and `if (ci.hidden === true) continue` filters BEFORE the structural-anchor / rect-push code. Watermark gate extended to `idSet.has(...) && !hidden`. Module header JSDoc extended with explicit Phase 64 LOCK-07 separation-of-semantics note.
- **`src/lib/editor/__tests__/editor-reducer.test.ts`** — 5 new tests (SH1..SH5) in a parallel `describe('editorReducer — Phase 64 Plan 02 (LOCK-07): SET_HIDDEN single-dispatch contract')` block.
- **`src/lib/editor/__tests__/selection-bounds.test.ts`** — 3 new tests (SB-H1..SB-H3) in a parallel `describe('computeSelectionBounds — Phase 64 Plan 02 (LOCK-07): hidden-skip')` block.
- **`src/lib/render/render-slide-satori.tsx`** — 5 hidden-filter sites: `{!hookBox?.hidden && <div>}` and `{!bodyBox?.hidden && <div>}` JSX gates; `(slide.custom_images ?? []).filter(ci => ci.hidden !== true).map(...)`; watermark gate extended to `{watermark && !slide.watermark?.hidden && (...)}`; custom_texts filter via text_boxes mirror lookup.
- **`src/components/slides/slide-preview.tsx`** — 8 hidden-filter sites total. Editable branch (4): hook Rnd + body Rnd JSX-level gates, custom_texts.filter, custom_images.filter; watermark resolveWatermark closure now early-returns null on `slide.watermark?.hidden === true`. Non-editable branch (4): same 4 iteration sites with identical predicates; non-editable watermark closure ALSO early-returns on `slide.watermark?.hidden === true`. Symmetric for TPLREND-05.
- **`src/lib/render/__tests__/parity.test.tsx`** — 5 new tests (PH1..PH5) in a parallel `describe('Phase 64 Plan 02 (LOCK-07, PARITY-01): both renderers honor `hidden`')` block. New `renderSatoriHtml` helper does `renderToStaticMarkup(buildSlideElement(slide, template))` for absence-probe assertions on the Satori React tree.
- **`supabase/migrations/20260502_fork_strip_locked.sql`** — NEW. 130-line migration. Helper `public._strip_locked_from_slide_data(jsonb) RETURNS jsonb` (IMMUTABLE, non-DEFINER) walks each slide's text_boxes / custom_images / custom_texts arrays and watermark slot, removing `locked` via `jsonb #- '{locked}'`. fork_published_carousel re-declared with `new_slide_data := public._strip_locked_from_slide_data(pub.slide_data)` between fetch and INSERT. Both functions GRANTed to authenticated.

## Decisions Made

- **SET_HIDDEN mirrors SET_LOCKED verbatim.** The two reducer cases are byte-identical except `locked` ↔ `hidden`. This locks in the "single-dispatch toggle on element set" pattern as the reducer template for future per-element-flag actions.
- **Hidden ≠ Locked at the bounds layer.** Locked is INCLUDED in computeSelectionBounds (Phase 63 D-01: a locked element still has a visible footprint that defines alignment-target bounds). Hidden is EXCLUDED (LOCK-07: a hidden element has no rendered footprint, so it should not pad the union AABB). The module header now explicitly documents this separation to prevent future drift.
- **Custom-text hidden flag lives on the text_boxes mirror, not on `slide.custom_texts`.** Per the Phase 49 dual-write contract, `text_boxes` is the canonical schema and `custom_texts` is the legacy slice. Adding `hidden` to `custom_texts` would either (a) duplicate state (drift risk) or (b) require a Phase 49 schema lift. The lookup-by-id pattern via text_boxes mirror is the simplest correct path for both renderers.
- **Watermark hidden gate placed BEFORE resolveWatermark.** The legacy resolver reads from brandKit + slide.style_overrides — the `hidden` flag lives on the new unified `slide.watermark` slot. By early-returning on `slide.watermark?.hidden === true` BEFORE invoking the resolver, both renderer paths (legacy + new) are uniformly suppressed without modifying resolveWatermark itself (Plan 60-02 owns that contract; parity tests pin it).
- **Satori parity test uses renderToStaticMarkup, not full PNG bytes.** Comparing PNG output across renderer paths is infrastructure-heavy and fragile across font-version drift. The PH tests instead assert DOM/JSX element absence in the static-markup HTML — same shape as the existing PARITY-01 chrome-leak scans (multi-selection-ring, marquee, group-bounding-ring, floating-toolbar, smart-guide, lock-icon).
- **Migration uses `jsonb #- '{locked}'` (key-removal), not `jsonb_set ... = null` (set-to-null).** A forked slide whose elements have `locked: null` would still type-narrow as `{ locked?: boolean }` on the TypeScript side — but it carries an extra null field that drifts from the canonical "freshly-generated, never-locked" shape. Key-removal yields structurally identical output to a never-locked carousel.
- **Migration helper is non-DEFINER + IMMUTABLE.** The fork RPC wraps it in SECURITY DEFINER (it needs to read published_carousels with elevated privileges); the helper itself is pure jsonb→jsonb with no DB access. Splitting them keeps the privilege surface minimal — anyone with execute on the helper just gets jsonb manipulation, no row access.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's SQL helper had undeclared loop variable `arr_field`**
- **Found during:** Task 3 (writing the migration file from the plan's interfaces block)
- **Issue:** The plan's `<action>` block uses `FOR arr_field IN SELECT * FROM (VALUES ('text_boxes'), ('custom_images'), ('custom_texts')) AS t(name)` but the original DECLARE block doesn't declare `arr_field`, AND the `(VALUES ...) AS t(name)` aliases the column to `name`, not `arr_field`. PostgreSQL would raise a column-name-mismatch error.
- **Fix:** Added `arr_field text` to DECLARE; rewrote the loop as `FOREACH arr_field IN ARRAY ARRAY['text_boxes', 'custom_images', 'custom_texts']` which is the canonical PL/pgSQL pattern for iterating string literals (cleaner than VALUES + alias). Behavior identical; semantics correct.
- **Files modified:** supabase/migrations/20260502_fork_strip_locked.sql
- **Verification:** Visual SQL inspection — DECLARE block has `arr_field text`; FOREACH binds correctly. Helper's grep gates met (3 occurrences: declaration, fork RPC call, GRANT).
- **Committed in:** 0fa44bb (Task 3)

**2. [Rule 2 - Missing Critical] Helper function missing `SET search_path = ''`**
- **Found during:** Task 3 (cross-checking the surrounding migrations' patterns)
- **Issue:** The plan's helper definition omits `SET search_path = ''`, but every existing function in the explore_remix_phase29 migration (and the fork RPC itself) sets it. Empty search_path forces fully-qualified table/function references — without it, a SQL injection via search_path manipulation could escalate. Defense-in-depth.
- **Fix:** Added `SET search_path = ''` to the helper declaration (alongside LANGUAGE plpgsql + IMMUTABLE).
- **Files modified:** supabase/migrations/20260502_fork_strip_locked.sql
- **Verification:** Helper now matches the surrounding migrations' security posture (every public function in this codebase has empty search_path).
- **Committed in:** 0fa44bb (Task 3)

**3. [Rule 2 - Missing Critical] PH3 watermark test was vacuously passing**
- **Found during:** Task 2 RED run (4 of 5 PH tests failed; PH3 was the only one that passed before the implementation landed)
- **Issue:** PH3 set `slide.watermark.hidden = true` but did NOT supply a brandKit. resolveWatermark short-circuits to null when no brandKit is present, so the watermark URL was already absent from the rendered output regardless of the hidden flag. The test would have passed even if I never implemented the gate — it was vacuous.
- **Fix:** Restructured PH3 with TWO render passes: a floor (no `hidden`, brandKit supplied → URL present in both renderers) and a hidden pass (same setup + `hidden: true` → URL absent). Now the test fails until the implementation lands AND proves the implementation actually suppresses the URL.
- **Files modified:** src/lib/render/__tests__/parity.test.tsx (PH3 rewritten; +63 lines)
- **Verification:** PH3 now fails RED (alongside PH1/PH2/PH4/PH5) on the no-brandKit floor path; passes GREEN after both-renderer hidden gates land.
- **Committed in:** 5fd2763 (Task 2 RED, contains the rewritten PH3)

---

**Total deviations:** 3 auto-fixed (1 bug in plan's SQL, 2 missing critical — defense-in-depth + non-vacuous test gate)
**Impact on plan:** All three auto-fixes essential for correctness. The plan's SQL would have failed at migration time; the missing search_path would have left a known SQL-injection vector unpatched; the vacuous PH3 would have given a false-pass signal. None of these expanded scope — they all directly serve plan-stated success criteria.

## Issues Encountered

None — plan executed cleanly across 5 commits (2 RED + 2 GREEN + 1 single-step migration). RED gate confirmed on each TDD step (8 reducer/bounds tests + 5 parity tests = 13 total RED-then-GREEN). tsc baseline preserved at 17 throughout.

## Verification — final acceptance gates

| Gate | Expected | Actual |
|------|----------|--------|
| `npx tsc --noEmit` | 17 baseline preserved | **17** |
| `grep -c "case 'SET_HIDDEN'" editor-reducer.ts` | 1 | **1** |
| `grep -c "type: 'SET_HIDDEN'" editor-actions.ts` | 1 | **1** |
| `grep -v '^[[:space:]]*//' selection-bounds.ts \| grep -c "hidden === true"` | ≥ 2 | **3** |
| `grep -v '^[[:space:]]*//' render-slide-satori.tsx \| grep -c "hidden"` | ≥ 4 | **12** |
| `grep -v '^[[:space:]]*//' slide-preview.tsx \| grep -cE "\.hidden\b"` | ≥ 6 | **14** |
| `test -f supabase/migrations/20260502_fork_strip_locked.sql` | exists | **YES** |
| `grep -c "fork_published_carousel" 20260502_fork_strip_locked.sql` | ≥ 2 | **5** |
| `grep -c "_strip_locked_from_slide_data" 20260502_fork_strip_locked.sql` | ≥ 3 | **3** |
| Plan-spec test scope (`src/lib/editor/ src/components/editor/ src/components/slides/ src/lib/render/`) | all green | **784/784 passing across 52 files** |

**Pre-existing baseline failures (NOT caused by Plan 64-02):** legacy `src/__tests__/` Stripe-mock + auth-middleware suites. Confirmed pre-existing by Plan 64-01's identical observation; out of scope for plan-spec verification.

## Threat Register Status

| Threat ID | Disposition | Status | Notes |
|-----------|-------------|--------|-------|
| T-64-02-01 (Tampering: SET_HIDDEN with stale ids) | accept | satisfied | Reducer treats unknown ids as no-op (SH2 ref-equal short-circuit pins this implicitly — empty ids and unknown ids both return state unchanged). |
| T-64-02-02 (Information disclosure: hidden leaks into PNG) | mitigate | mitigated | Both renderers apply the IDENTICAL filter at the SAME iteration sites. PARITY-01 PH1..PH5 pin byte-identity via renderToStaticMarkup absence-probe assertions. |
| T-64-02-03 (Tampering: forker bypasses lock-strip via direct DB write) | accept | satisfied | Forker has full ownership of the new projects row — `locked` strip is a UX affordance, not a security control. RLS restricts forker to their own projects table. |
| T-64-02-04 (DoS: helper recursion on adversarially-large slide_data) | mitigate | mitigated | Helper is non-recursive (single LOOP per slide → single FOREACH per array → single LOOP per element). Slide count capped at ~50 by the editor; jsonb size capped by Postgres. No DoS surface. |
| T-64-02-05 (Elevation of privilege: _strip_locked_from_slide_data callable by anon) | accept | satisfied | Helper is GRANT EXECUTE only to authenticated; no anon access. SECURITY DEFINER inherited from fork_published_carousel; helper itself is non-DEFINER (IMMUTABLE / no DB access). Defense-in-depth: SET search_path = '' on helper too (auto-fix #2). |

## Threat Flags

None — no new security-relevant surface introduced. SET_HIDDEN accepts arbitrary ids[] (matches BULK_TRANSLATE/GROUP/UNGROUP/SET_LOCKED convention; no schema change at trust boundary). The fork RPC's surface is unchanged (same input → uuid output, same authn check, same RLS scope on inserted projects row); the strip step is internal-only.

## Post-Merge Action Item

**Required for LOCK-08 to take effect in production:**

```bash
npx supabase db push
```

This applies `20260502_fork_strip_locked.sql` to the Supabase shadow + production DB. Without it, the application code is unchanged (LOCK-08 is a server-side affordance only) — forks will still inherit `locked` flags until the migration deploys.

The migration is additive and idempotent (`CREATE OR REPLACE FUNCTION`) — safe to re-run; will not corrupt existing fork-RPC traffic.

## Next Phase Readiness

**Plan 64-03 seam:** Z-ORDER reducer pattern — SET_LOCKED + SET_HIDDEN cluster establishes the "single-dispatch toggle on element set with applyDualWrite + ref-equal short-circuit" template. Plan 64-03's `Z_ORDER` action (per-type internal routing) follows the same skeleton with op-based per-array splice instead of per-element field assignment. selection-bounds is now hidden-aware — z-order operations on hidden elements behave consistently with both renderers.

**Plan 65 seam:** Layers panel can dispatch SET_HIDDEN on selection ids; both renderers already honor the field; no further renderer work needed for visibility toggle UX.

**Explore/remix flow:** After `npx supabase db push`, forks are guaranteed to be fully editable — no inherited locks. Closes the LOCK-08 contract end-to-end.

## Self-Check: PASSED

**Files verified to exist:**
- src/lib/editor/editor-actions.ts — FOUND (SET_HIDDEN variant present)
- src/lib/editor/editor-reducer.ts — FOUND (SET_HIDDEN case present)
- src/lib/editor/transforms/selection-bounds.ts — FOUND (hidden-skip filters present)
- src/lib/editor/__tests__/editor-reducer.test.ts — FOUND (SH1..SH5 present)
- src/lib/editor/__tests__/selection-bounds.test.ts — FOUND (SB-H1..SB-H3 present)
- src/components/slides/slide-preview.tsx — FOUND (8 hidden-filter sites present)
- src/lib/render/render-slide-satori.tsx — FOUND (5 hidden-filter sites present)
- src/lib/render/__tests__/parity.test.tsx — FOUND (PH1..PH5 present)
- supabase/migrations/20260502_fork_strip_locked.sql — FOUND (helper + RPC re-declaration)

**Commits verified to exist:**
- bbd5cb2 (Task 1 RED) — FOUND
- 3f2ec3f (Task 1 GREEN) — FOUND
- 5fd2763 (Task 2 RED) — FOUND
- 329e964 (Task 2 GREEN) — FOUND
- 0fa44bb (Task 3 migration) — FOUND

---
*Phase: 64-lock-hide-z-order*
*Completed: 2026-05-03*

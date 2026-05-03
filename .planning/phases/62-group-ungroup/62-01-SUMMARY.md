---
phase: 62-group-ungroup
plan: 01
subsystem: ui
tags: [group, schema, reducer, selection-model, foundation, transform, react, vitest]

# Dependency graph
requires:
  - phase: 60-multi-select-foundation-watermark-schema-lift
    provides: groupId? field on TextBox/CustomImage/Watermark (Plan 60-01); useSelectionModel base + selection-state-outside-history contract (Plan 60-03); BULK_TRANSLATE action shape (Plan 60-03); applyDualWrite + pushHistory wrappers (Plan 50)
  - phase: 61-marquee-selection
    provides: marquee-driven N>=2 selection that Plan 62-03 will feed Cmd+G
provides:
  - getGroupMembers(slide, groupId): string[] pure helper for cross-type group membership reads
  - GROUP { slideIndex, ids[], groupId } reducer action (single pushHistory; subset-of-existing-group dissolves prior group entirely; N<=1 silent no-op)
  - UNGROUP { slideIndex, ids[] } reducer action (single pushHistory; idempotent on already-ungrouped; lossless across N cycles)
  - useSelectionModel.currentlyInsideGroup + enterGroup(elementId, slide) + exitGroup() — selection-state-outside-reducer-history invariant carry-forward
affects: [62-02-PLAN, 62-03-PLAN, 63-alignment, 64-lock-hide-zorder, 65-layers-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure transform helper at src/lib/editor/transforms/* (no react / 'use client' / document / window) — fourth member after axis-constrain, element-rect-intersect, normalize-rect, selection-bounds"
    - "Reducer-case structure mirroring BULK_TRANSLATE: slides.map → mutate target slide → applyDualWrite if text_boxes changed → return pushHistory exactly once"
    - "Selection-model extension via useState + useRef ref-mirror pattern (matches idsRef / primaryRef from Plan 60-03)"
    - "SEL-10 + SEL-11 effects extended to clear in-group flag in lock-step with ids/primary"

key-files:
  created:
    - src/lib/editor/transforms/group-membership.ts
    - src/lib/editor/__tests__/group-membership.test.ts
  modified:
    - src/lib/editor/editor-actions.ts
    - src/lib/editor/editor-reducer.ts
    - src/lib/editor/use-selection-model.ts
    - src/lib/editor/__tests__/editor-reducer.test.ts
    - src/lib/editor/__tests__/use-selection-model.test.ts

key-decisions:
  - "Subset-of-existing-group GROUP cascade: detect oldGroupIds among listed ids first; on the same slide.map walk, clear groupId on un-listed members of any old group AND assign action.groupId to listed ids — single O(N) pass per type-array (text_boxes ∪ custom_images ∪ watermark)"
  - "UNGROUP returns state-ref-equal when no listed id carries a groupId (Test U4) — prevents history pollution when Cmd+Shift+G fires on already-ungrouped selection"
  - "enterGroup(elementId, slide) takes the slide as 2nd arg by design — the hook stays decoupled from a slide reference internally, avoiding a useEffect that would re-fire on every presentSlides mutation"
  - "exitGroup uses functional updater preserving prev ref when already null — callback-ref-stable + idempotent + no extra render trigger"
  - "Tests E10/E11 (cross-type enterGroup for custom_image + watermark) added beyond plan's E1-E9 list; Rule 2 — auto-add critical coverage since enterGroup must walk all 3 element types"

patterns-established:
  - "groupId removal via destructuring: `const { groupId: _g, ...rest } = element` → produces object literally without the key, matching Test U3 byte-identity expectation across round-trips"
  - "Cascade detection precedes mutation walk: `oldGroupIds` Set computed in a single pass, used as predicate during the mutation map (no nested loops)"
  - "Hook test file imports `* as fs from 'fs'` + `* as path from 'path'` for source-grep invariants (E9), mirroring selection-bounds.test.ts pattern"

requirements-completed: [GROUP-01, GROUP-02, GROUP-03, GROUP-04, GROUP-05, KBD-09]

# Metrics
duration: 23min
completed: 2026-05-03
---

# Phase 62 Plan 01: Group/Ungroup Data Layer Summary

**Pure getGroupMembers helper + GROUP/UNGROUP reducer cases with subset-dissolve cascade + useSelectionModel currentlyInsideGroup/enterGroup/exitGroup extension — all locked decisions from CONTEXT D-01..D-05 pinned by 23 unit tests across 3 files.**

## Performance

- **Duration:** ~23 min
- **Started:** 2026-05-03T02:43Z (approx — plan dispatch)
- **Completed:** 2026-05-03T03:07Z
- **Tasks:** 3 (all `tdd="true"`, RED+GREEN per task)
- **Files modified:** 7 (2 created + 5 modified)
- **LOC delta:** +1057 lines (incl. test fixtures)

## Accomplishments

- **Data layer landed atomically.** GROUP and UNGROUP actions ship as pure reducer cases mirroring BULK_TRANSLATE's structural pattern (slides.map → applyDualWrite if text_boxes changed → single pushHistory). Plans 62-02 and 62-03 can now run as parallel-able UI/integration plans against a stable contract.
- **Subset-dissolve cascade implemented in single O(N) pass.** Test G4 pins the locked decision: GROUP on a subset of an existing group dissolves the prior group entirely (un-listed members lose their groupId; new groupId assigned to listed ids). PITFALL-3.3 (no nested groups) prevented at write time.
- **Lossless round-trip pinned by Test U3.** group→ungroup→group→ungroup→group→ungroup over 3 cycles preserves byte-identical positions. KBD-09 (single pushHistory per dispatch) verified by Tests G1, U1.
- **Selection-state-outside-reducer invariant preserved.** Plan 60-03 carry-forward: `currentlyInsideGroup` lives in React useState + useRef mirror, never in editor history. Test E9 grep-asserts editor-reducer.ts has zero `currentlyInsideGroup` references.
- **SEL-10 / SEL-11 effects extended in lock-step.** Slide-switch and stale-id pruning now also clear the in-group flag — matches the existing ids/primary contract for the new state slot.
- **81/81 plan-relevant tests pass; 165/165 editor-suite tests green; tsc baseline 17 errors preserved.**

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: getGroupMembers tests** — `28f05fc` (test) — 6 failing tests covering empty / no-match / single-type / cross-type / undefined-field / purity
2. **Task 1 GREEN: getGroupMembers helper** — `85a2253` (feat) — pure module at `src/lib/editor/transforms/group-membership.ts`; 6/6 unit tests passing
3. **Task 1 follow-on: GROUP/UNGROUP action variants** — `14b046b` (feat) — appended to `EditorAction` union with full JSDoc citing GROUP-02..05, KBD-09, PITFALL-3.3, PITFALL-3.4, BL-01
4. **Task 2 RED: GROUP/UNGROUP reducer tests** — `561edb7` (test) — 12 failing tests (G1-G7 + U1-U5)
5. **Task 2 GREEN: GROUP/UNGROUP reducer cases** — `a630e15` (feat) — 47/47 reducer tests pass; 154 editor-suite green
6. **Task 3 RED: enterGroup/exitGroup hook tests** — `30d6edf` (test) — 11 failing tests (E1-E11; plan called for 9, +2 cross-type defensive coverage)
7. **Task 3 GREEN: useSelectionModel extension** — `57a88bb` (feat) — 28/28 hook tests pass; 165 editor-suite green

**Plan metadata:** _final-commit-pending_ (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md update commit follows)

## Files Created/Modified

**Created:**
- `src/lib/editor/transforms/group-membership.ts` (34 LOC) — pure helper `getGroupMembers(slide, groupId): string[]`; walks text_boxes ∪ custom_images ∪ watermark in that order; empty groupId short-circuits to []
- `src/lib/editor/__tests__/group-membership.test.ts` (140 LOC) — 6 unit tests including a comment-stripped purity grep (E6 source-content gate)

**Modified:**
- `src/lib/editor/editor-actions.ts` (+45 LOC) — appended GROUP and UNGROUP variants to `EditorAction` union with full JSDoc
- `src/lib/editor/editor-reducer.ts` (+180 LOC) — added `case 'GROUP'` and `case 'UNGROUP'` AFTER BULK_DELETE / BEFORE UNDO; both end in exactly one `return pushHistory(state, slides)`; both route text_boxes through applyDualWrite when mutated
- `src/lib/editor/use-selection-model.ts` (+97 LOC) — extended `SelectionModel` interface with `currentlyInsideGroup` / `enterGroup` / `exitGroup`; added useState + useRef + sync effect; patched SEL-10 (slide-switch) and SEL-11 (stale-id prune) effects to clear the new flag
- `src/lib/editor/__tests__/editor-reducer.test.ts` (+501 LOC) — 12 tests appended after BULK_TRANSLATE block (7 GROUP + 5 UNGROUP; round-trip 3-cycle test U3 is lossless integration test)
- `src/lib/editor/__tests__/use-selection-model.test.ts` (+200 LOC) — 11 tests appended after Test 17 (E1-E11 covering enterGroup / exitGroup / SEL-10 / SEL-11 / outside-reducer invariant grep + cross-type coverage)

## Decisions Made

- **D-01 (groupId format):** Format string `g_${slideIndex}_${Date.now().toString(36)}` is the dispatcher's responsibility (Plan 62-03). The reducer treats `action.groupId` as opaque — no validation, no re-generation. CONTEXT D-01 honored: nanoid is NOT in package.json, no new dependency added.
- **D-02 (subset-dissolve cascade):** Implemented as single-pass detection + mutation. `oldGroupIds: Set<string>` is computed in a pre-pass over the target slide; the mutation walk then has both predicates (`idSet.has(tb.id)` for assignment + `oldGroupIds.has(tb.groupId)` for cascade clearance). O(N) per element-type-array.
- **D-03 (N<=1 no-op):** Implemented as `if (action.ids.length <= 1) return state` BEFORE the slides.map — no allocation, no pushHistory. Test G2/G3 pin reference equality.
- **D-04 (single pushHistory per dispatch):** Verified by past.length growing by exactly 1 per dispatch (Tests G1, U1, U3).
- **D-05 (selection state outside reducer history):** `currentlyInsideGroup` is a React useState slot with a useRef mirror; the reducer file has zero references to the field name (verified by Test E9 source-grep).
- **UNGROUP idempotency:** When NO listed id carries a defined groupId, UNGROUP returns `state` reference-equal (Test U4). Implementation tracks `anyChange` boolean across the slide-walk; only calls pushHistory when true.
- **groupId removal via destructuring:** `const { groupId: _g, ...rest } = tb` produces an object literally without the `groupId` key (rather than `{ ...tb, groupId: undefined }`). This matches Test U3 byte-identity expectation — `tb.groupId` is `undefined` after the destructure, and the property is NOT enumerable on the result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Cross-type enterGroup tests added (E10, E11)**
- **Found during:** Task 3 (selection-model extension)
- **Issue:** Plan listed 9 hook tests (E1-E9) but `enterGroup` walks text_boxes ∪ custom_images ∪ watermark; with only text_box coverage in E2-E5, a regression in the custom_image or watermark branch of `enterGroup` would have escaped the suite.
- **Fix:** Appended Test E10 (enterGroup with custom_image member) and Test E11 (enterGroup with watermark member). Both are simple parametric extensions of E2 — fixture swap only.
- **Files modified:** `src/lib/editor/__tests__/use-selection-model.test.ts` (+~30 LOC for E10/E11)
- **Verification:** Both pass on GREEN; total hook tests now 28 (= 17 existing + 11 new) instead of plan's 26.
- **Committed in:** `30d6edf` (Task 3 RED) + `57a88bb` (Task 3 GREEN)

---

**Total deviations:** 1 auto-fixed (1 missing-critical-coverage)
**Impact on plan:** No scope creep — pure test addition mirroring planned E2 with different fixture types. Plan-level test count went 26→28; production code untouched relative to plan.

## Issues Encountered

None. RED commits behaved as expected (test-file-resolution failure for getGroupMembers, 9/12 substantive failures for reducer tests, 10/11 substantive failures for hook tests; the trivially-passing tests were the no-op assertions where `default → return state` accidentally satisfies `expect(next).toBe(initial)` — these still pass on GREEN, so no contract change).

## Cross-Phase Constraint Compliance

| Constraint | Source | Status |
|------------|--------|--------|
| Flat schema only — no `Slide.groups[]`, no nested groups | D-01 / ARCHITECTURE §1 | **PASS** — `groupId?: string` is the only group field touched; subset-dissolve cascade prevents nesting at write time (Test G4 pins) |
| Single pushHistory per gesture | KBD-09 / PERF-01 | **PASS** — Tests G1, U1 verify past.length grows by exactly 1; G2/G3/U4 verify state-ref-equal on no-op cases |
| applyDualWrite for text_boxes mutations | BL-01 | **PASS** — Tests G6, U5 verify legacy custom_texts mirror is regenerated; hook_text/body_text untouched |
| Selection state outside reducer history | Plan 60-03 contract | **PASS** — Test E9 grep-asserts zero `currentlyInsideGroup` references in editor-reducer.ts |
| TPLREND-05 / PARITY-01 | TPLREND-05 / PARITY-01 | **TRIVIAL PASS** — no render code touched in this plan; Plan 62-02 owns the render gate |
| No new packages | RESEARCH ceiling | **PASS** — package.json unchanged; nanoid still absent |
| Watermark skip on translate | Plan 60-03 BULK_TRANSLATE contract | **N/A** — Plan 62-01 does NOT touch BULK_TRANSLATE; Plan 62-03 will inherit the skip when wiring group drag |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Seam exposed for Plan 62-02 (UI ring + click handlers):**
- `getGroupMembers(slide, groupId)` is the single read-helper for "select all members when any member is clicked" (Figma model). UI code calls it inside the click handler; no reducer round-trip needed.
- `currentlyInsideGroup` is the gate for double-click-enter / single-click-leaf semantics.

**Seam exposed for Plan 62-03 (keyboard + group drag):**
- `EditorAction['GROUP'] | EditorAction['UNGROUP']` actions are dispatch-ready. Plan 62-03 owns the `g_${slideIndex}_${Date.now().toString(36)}` construction at the dispatch site.
- `enterGroup(elementId, slide)` / `exitGroup()` are the Esc-handler primitives. Plan 60-04's tinykeys map already exposes the Esc-first-press slot for `exitGroup`.
- BULK_TRANSLATE (Plan 60-03) is the action Plan 62-03 dispatches for group drag — watermark skip + locked skip + structural-anchor skip are all preserved (group drag inherits all three for free).

**No blockers.** Phase 62 is now ~33% complete (1/3 plans shipped). Plan 62-02 and Plan 62-03 can proceed.

## Self-Check: PASSED

**Files verified to exist:**
- `src/lib/editor/transforms/group-membership.ts`: FOUND
- `src/lib/editor/__tests__/group-membership.test.ts`: FOUND
- `src/lib/editor/__tests__/editor-reducer.test.ts`: FOUND (modified)
- `src/lib/editor/__tests__/use-selection-model.test.ts`: FOUND (modified)
- `src/lib/editor/editor-actions.ts`: FOUND (modified)
- `src/lib/editor/editor-reducer.ts`: FOUND (modified)
- `src/lib/editor/use-selection-model.ts`: FOUND (modified)

**Commits verified to exist:**
- `28f05fc`: FOUND (test 62-01/t1 RED)
- `85a2253`: FOUND (feat 62-01/t1 helper GREEN)
- `14b046b`: FOUND (feat 62-01/t1 action variants)
- `561edb7`: FOUND (test 62-01/t2 RED)
- `a630e15`: FOUND (feat 62-01/t2 reducer cases GREEN)
- `30d6edf`: FOUND (test 62-01/t3 RED)
- `57a88bb`: FOUND (feat 62-01/t3 hook extension GREEN)

**Plan-level verification (re-run):**
- 81/81 plan-relevant tests pass (6 group-membership + 47 reducer + 28 hook)
- 165/165 editor-suite tests green (no regression)
- tsc baseline 17 errors preserved
- 1 `case 'GROUP'` + 1 `case 'UNGROUP'` in editor-reducer.ts
- 0 `currentlyInsideGroup` matches in editor-reducer.ts
- 0 forbidden imports in src/lib/editor/transforms/group-membership.ts (after comment-strip)

---

*Phase: 62-group-ungroup*
*Completed: 2026-05-03*

---
phase: 63-alignment-distribute-smart-guides
plan: 03
subsystem: ui
tags: [snap, smart-guides, sorted-edge-array, binary-search, hysteresis, perf-budget, pure-transforms, tdd]

# Dependency graph
requires:
  - phase: 60-multi-select-foundation
    provides: TextBox/CustomImage/Watermark schema + groupId/locked fields used by buildSnapIndex walks
  - phase: 62-groups
    provides: getGroupMembers convention used by callers when assembling excludeIds for multi-element drag
provides:
  - "buildSnapIndex(slide, excludeIds, canvasW?, canvasH?) → SnapIndex (sorted xEdges + yEdges)"
  - "findNearestSnap(value, sortedEdges, threshold) → SnapQueryResult (O(log N) binary search)"
  - "snapWithHysteresis(value, sortedEdges, prevWasSnapped) → HysteresisResult (asymmetric 5/7 enter/exit state machine)"
  - "SNAP_THRESHOLD_ENTER (5) + SNAP_THRESHOLD_EXIT (7) constants exported"
  - "Performance bench fixture verifying PERF-05 contract (<2ms per pointer-tick at N=30)"
affects: [63-04, 64, 65]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure transform module (no React, no DOM) — same convention as selection-bounds.ts, group-membership.ts, align.ts"
    - "Sorted-edge-array + lower_bound binary search for high-frequency spatial queries"
    - "Asymmetric hysteresis state machine with per-axis scalar state contract"
    - "Performance regression guard via vitest with median statistic + JIT warm-up loops"

key-files:
  created:
    - src/lib/editor/transforms/snap-index.ts
    - src/lib/editor/__tests__/snap-index.test.ts
    - src/lib/editor/__tests__/snap-index.bench.test.ts
  modified: []

key-decisions:
  - "Per-axis scalar hysteresis state (not bundled X+Y) — caller tracks wasSnappedX and wasSnappedY independently. Honors PITFALL-5.2 deadband per axis."
  - "TextBox height defaults to 0 (Phase 60 carryover gap) — produces a degenerate top==center==bottom Y edge entry; callers tolerate via dedupe-by-pos."
  - "Watermark size placeholder 18% × 5% (matches Plan 63-01 selection-bounds extension); Phase 64 lifts to real measurements."
  - "Locked elements ARE included in snap index (Figma rule); only excludeIds membership removes them."
  - "Stable Array.prototype.sort by pos ascending; duplicate edges allowed and handled correctly by lower_bound (Test SI-15 pins)."

patterns-established:
  - "Pure module convention extended to snap math: header JSDoc cites REQ-IDs + PITFALLs, no 'use client', no react import, no document/window references"
  - "Performance bench as a colocated vitest test file ({module}.bench.test.ts) that asserts a median budget — not max — with explicit JIT warm-up loops"
  - "Test naming SI-{N} pins to plan behavior items; PB{N} for perf budget cases"

requirements-completed: [SNAP-01, SNAP-02, SNAP-03, SNAP-08, SNAP-10, PERF-05]

# Metrics
duration: ~25min
completed: 2026-05-02
---

# Phase 63 Plan 03: snap-index pure module Summary

**Sorted-edge-array snap index with O(log N) binary search and asymmetric 5/7-px hysteresis — replaces the legacy O(N×M) double-loop and ships against a stable contract for Plan 63-04 drag wiring.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-03T04:14Z
- **Completed:** 2026-05-03T04:18Z
- **Tasks:** 2
- **Files modified:** 3 created (1 module, 2 tests)

## Accomplishments

- `buildSnapIndex(slide, excludeIds, canvasW?, canvasH?)` walks text_boxes ∪ custom_images ∪ watermark, contributes 3 X-edges + 3 Y-edges per element + canvas edges (0/W/2/W and 0/H/2/H), sorted ascending by `pos`. Locked elements included; structural-anchor TextBoxes skipped (Phase 60 documented gap); excludeIds drops by id (multi-element drag friendly).
- `findNearestSnap(value, sortedEdges, threshold)` — lower_bound binary search + 2-neighbor check, O(log N) per query. Handles duplicates (Test SI-15) and boundary cases (SI-22/23) correctly.
- `snapWithHysteresis(value, sortedEdges, prevWasSnapped)` — asymmetric 5/7 enter/exit state machine. Per-axis scalar state contract documented (callers track X and Y separately). All 4 transitions pinned by tests SI-16..SI-19.
- 49 tests pass (45 correctness SI-1..SI-26 + 4 perf PB1..PB4); median PB3 well under the 2ms PERF-05 budget at N=30 elements.

## Task Commits

1. **Task 1 RED: failing tests for snap-index pure module** — `40d3cae` (test)
2. **Task 1 GREEN: implement snap-index pure module** — `81e2c09` (feat)
3. **Task 2: perf bench fixture (PERF-05 contract)** — `c63d848` (test)

_TDD cycle for Task 1: RED commit `40d3cae` → GREEN commit `81e2c09`. No refactor commit — implementation was clean on first pass._

## Files Created/Modified

- `src/lib/editor/transforms/snap-index.ts` — Pure module exporting `buildSnapIndex`, `findNearestSnap`, `snapWithHysteresis`, `SNAP_THRESHOLD_ENTER`, `SNAP_THRESHOLD_EXIT`, plus `EdgeEntry`/`SnapIndex`/`SnapQueryResult`/`HysteresisResult` types.
- `src/lib/editor/__tests__/snap-index.test.ts` — 45 unit tests covering SI-1..SI-26 (build correctness, exclude semantics, watermark/locked rules, sorted invariant, binary-search correctness incl. duplicates and boundaries, hysteresis state machine, multi-axis bbox query convention, %-to-REF-px conversion, purity static check).
- `src/lib/editor/__tests__/snap-index.bench.test.ts` — 4 perf budgets (PB1: build < 0.5ms, PB2: single query < 0.05ms, PB3: 6-query tick < 2ms, PB4: hysteresis-tick < 2ms) using median statistic with JIT warm-up.

## Decisions Made

- **Per-axis scalar hysteresis state** — callers track `wasSnappedX` and `wasSnappedY` independently. Bundling X+Y in one helper would force a 2D state machine; per-axis is what matches PITFALL-5.2 (the deadband applies independently per axis). Documented in module JSDoc + Test SI-20.
- **TextBox height defaults to 0** — Phase 60 documented gap (no explicit height in TextBox schema). Produces a degenerate top==center==bottom Y edge entry; callers dedupe by pos. Carry-forward gap, not a regression.
- **Watermark size placeholder 18% × 5%** — mirrors Plan 63-01 selection-bounds extension. Phase 64 will lift to real measurements when lock semantics complete the watermark element story.
- **Locked elements INCLUDED in snap index** — Figma rule. Locked elements are valid snap targets; only `excludeIds` membership removes them. Pinned by Test SI-7.
- **Custom canvas dims supported** — `buildSnapIndex` accepts optional `canvasW`/`canvasH` (defaulting to 1080/1920) so callers can build indices for non-default aspect ratios. Test SI-26b pins.

## Deviations from Plan

None — plan executed as written.

One minor test correction during the GREEN gate: the SI-4 expected X-edge array initially listed two `540` entries; the correct count is three (tb1's right + tb2's left + canvas-center all coincide at 540). Fixed in test file before final commit. This is a test-authoring correction, not a deviation from the plan's algorithm or contract.

## Issues Encountered

None — all 49 tests pass on first GREEN run after the SI-4 expectation correction. tsc baseline preserved at 17 errors (no new errors introduced).

## TDD Gate Compliance

Plan 63-03 is `type: execute` (not `type: tdd` plan-level), but Task 1 had `tdd="true"`. Gate sequence verified in git log:
1. RED (test): commit `40d3cae` — `test(63-03/t1): add failing tests for snap-index pure module`
2. GREEN (feat): commit `81e2c09` — `feat(63-03/t1): implement snap-index pure module ...`

Task 2 ships a perf bench against the already-implemented module (no separate RED gate needed; the bench fails-loud-on-regression as a forward-looking guard).

## User Setup Required

None — no external services or environment configuration required.

## Next Phase Readiness

- **Plan 63-04 (Wave B integration)** has a stable contract to wire from drag handlers in `slide-preview.tsx`:
  - `onDragStart`: call `buildSnapIndex(slide, excludeIds)`. Cache result for the duration of the drag.
  - `onDrag` (per pointer-move tick): for each axis, compute the bbox query value (left/center/right for X, top/center-v/bottom for Y) and call `snapWithHysteresis(value, idx.{x,y}Edges, wasSnapped{X,Y})`. Update local hysteresis state from the returned `nextWasSnapped`.
  - `onDragStop`: discard the cached SnapIndex; reset `wasSnappedX`/`wasSnappedY` to null.
- **Multi-element drag (SNAP-09)** is wire-time work in Plan 63-04: the caller assembles `excludeIds` from the full set of elements being moved (e.g., union of group members via `getGroupMembers`), then queries the union AABB's edges via `findNearestSnap` independently per axis.
- **Equal-spacing "==" detection (SNAP-04 / DIFF-03)** is NOT in this plan — it's a separate Plan 63-04 surface that consumes the same `xEdges`/`yEdges` arrays but applies a different algorithm (gap-equality check across 3+ elements).

### Known gaps (carry-forward)

- Structural-anchor TextBox edges still not contributed (Phase 60-05 documented gap; Phase 63 inherits — would require DOM ref-based height resolution).
- Watermark size still placeholder 18% × 5% (Phase 64 lifts when lock + watermark resolution stories converge).

## Self-Check: PASSED

- `src/lib/editor/transforms/snap-index.ts` — FOUND
- `src/lib/editor/__tests__/snap-index.test.ts` — FOUND
- `src/lib/editor/__tests__/snap-index.bench.test.ts` — FOUND
- Commit `40d3cae` — FOUND in git log
- Commit `81e2c09` — FOUND in git log
- Commit `c63d848` — FOUND in git log
- 49/49 tests pass; tsc baseline preserved at 17 errors
- Static checks: 0 React/DOM lines; 1 binary search loop; 4 threshold references; 3 function declarations

---
*Phase: 63-alignment-distribute-smart-guides*
*Completed: 2026-05-02*

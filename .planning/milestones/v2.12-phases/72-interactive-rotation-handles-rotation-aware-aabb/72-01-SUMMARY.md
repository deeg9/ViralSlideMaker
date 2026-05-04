---
phase: 72-interactive-rotation-handles-rotation-aware-aabb
plan: 01
subsystem: editor-data-layer
tags: [reducer, transforms, rotation, aabb, decorations, pra-gate]
requires:
  - Phase 67 DecorationBase.rotation? schema field
  - Phase 68 BULK_TRANSLATE decorations branch + PRA1..PRA12 audit
  - Phase 64 LOCK-04 / LOCK-07 locked + hidden honor
provides:
  - BULK_ROTATE EditorAction + reducer case (decorations only v2.12)
  - computeRotatedAABB pure helper (selection-bounds.ts)
  - rotation-aware union AABB in computeSelectionBounds
  - rotation-aware alignment in alignElements + distributeElements
  - rotation-aware marquee intersect in elementsInRect
  - PRA13 audit entry in reducer-scope-symmetry.test.ts
affects:
  - Wave 2 Plan 72-02 (interactive rotation handle dispatches BULK_ROTATE)
  - Wave 3 Plan 72-03 (PTF15 fingerprint consumes rotated render path)
tech-stack:
  added: []
  patterns:
    - "Pure 2D cos/sin transform around element center (no DOM, no React)"
    - "Fast-path identity for rotation undefined / 0 / 360 (regression-safe)"
    - "Block-comment scope-stub pattern preserves PRA grep gate coverage"
    - "Threat-T-72-01 rotation clamp: ((r % 360) + 540) % 360 - 180 normalization"
key-files:
  created:
    - src/lib/editor/__tests__/bulk-rotate.test.ts
    - src/lib/editor/transforms/__tests__/rotated-aabb.test.ts
    - src/lib/editor/transforms/__tests__/selection-bounds-rotated.test.ts
    - src/lib/editor/transforms/__tests__/align-rotated.test.ts
    - src/lib/editor/transforms/__tests__/element-rect-intersect-rotated.test.ts
  modified:
    - src/lib/editor/editor-actions.ts
    - src/lib/editor/editor-reducer.ts
    - src/lib/editor/transforms/selection-bounds.ts
    - src/lib/editor/transforms/align.ts
    - src/lib/editor/transforms/element-rect-intersect.ts
    - src/lib/editor/__tests__/reducer-scope-symmetry.test.ts
decisions:
  - "v2.12 BULK_ROTATE routes ONLY decorations participation; text_boxes / custom_images / watermark are documented as deferred no-op stubs via block comments (PRA13 grep gate counts these mentions)"
  - "Rotation clamp short-circuits when input already in [-180, 180] so edge values 180 / -180 round-trip identically; out-of-range inputs normalized via canonical map"
  - "computeRotatedAABB does NOT integer-round at this layer — align.ts is the rounding boundary (PITFALL-4.4 / ALIGN-09); subpixel precision required for union math"
  - "Test files live in src/lib/editor/transforms/__tests__/ (new directory) per plan files_modified spec; sibling transform tests historically lived in src/lib/editor/__tests__/ — both layouts coexist now"
metrics:
  duration: "~25 min"
  completed: 2026-05-03
  task_count: 2
  test_count: 53
  files_modified: 11
---

# Phase 72 Plan 01: BULK_ROTATE reducer + rotation-aware AABB Summary

BULK_ROTATE EditorAction + reducer case (decorations-only) lands the rotation
data path with single-pushHistory, locked-honor, and PRA13 audit gate
extension. computeRotatedAABB pure helper + rotation-aware substitutions in
computeSelectionBounds / alignElements / distributeElements / elementsInRect
deliver true axis-aligned bounding boxes for rotated decorations across
selection bounds, alignment math, and marquee intersect.

## What Shipped

### Task 1 — BULK_ROTATE reducer + PRA13 audit
- **Action shape:** `{ type: 'BULK_ROTATE'; slideIndex: number; ids: string[]; rotation: number }`
- **Reducer case:** routes per-scope; decorations participate (rotation field
  set to clamped value, locked decorations skipped per LOCK-04 honor); text_boxes
  / custom_images / watermark documented as deferred no-op stubs in block-comment
  form (preserves PRA13 grep gate coverage per `stripLineComments` slicer rule).
- **Single pushHistory** per dispatch (PERF-01 / KBD-09).
- **Edge cases:** empty ids → ref-equal short-circuit; unknown ids → ref-equal
  short-circuit; no-decorations slide → ref-equal short-circuit; per-id no-op
  when rotation already equals action value (preserves cross-scope ref-equality
  per PRS9 / Phase 68 PARITY-16).
- **Threat T-72-01:** rotation clamp `((r % 360) + 540) % 360 - 180` applied
  only when input out of `[-180, 180]` so edge values `180` / `-180` round-trip
  identically. Defense-in-depth against future MCP/RPC dispatch sources.
- **PRA13 entry** added to `reducer-scope-symmetry.test.ts` `MULTI_SCOPE_ACTIONS`
  array; gate now covers PRA1..PRA13 + 4 SELF-CTRL methodology pins.

### Task 2 — Rotation-aware AABB across selection-bounds / align / marquee
- **`computeRotatedAABB(rect, rotationDeg)`** pure helper exported from
  `selection-bounds.ts`:
  - Identity fast-path for `undefined` / `0` / `% 360 === 0`
  - Standard 2D cos/sin transform around element center (cx, cy)
  - 4-corner bounding box; min/max of rotated x/y components
  - No integer rounding (subpixel precision; ALIGN-09 boundary preserved)
  - No clamp (corners may rotate past canvas edges → negative coords; pure)
- **`computeSelectionBounds`:** decorations branch substitutes
  `computeRotatedAABB(d.position, d.rotation)`; non-rotated decorations match
  pre-Phase-72 byte-identical behavior via the identity fast-path.
- **`buildMoveCandidates` (align.ts):** decorations contribute their rotated
  AABB so alignment `right` / `bottom` uses rotated width / height. Locked
  decorations still excluded (ALIGN-10 unchanged).
- **`elementsInRect`:** marquee intersects rotated AABB envelope so a rotated
  decoration at canonical 45° is selectable along its rotated-corner extent
  (regression: rotation=0/undefined unchanged).

## Test Counts by File

| File                                            | Count |
| ----------------------------------------------- | ----- |
| `bulk-rotate.test.ts`                           | 10    |
| `reducer-scope-symmetry.test.ts` (PRA1..PRA13 + 4 SELF-CTRL) | 17 |
| `rotated-aabb.test.ts`                          | 10    |
| `selection-bounds-rotated.test.ts`              | 6     |
| `align-rotated.test.ts`                         | 5     |
| `element-rect-intersect-rotated.test.ts`        | 5     |
| **Total**                                       | **53**|

## Verification Results

- Plan target suite: **53 / 53 GREEN** (exact match to plan verification target)
- Full `src/lib/editor/` suite: **568 / 568 GREEN** (no regressions)
- tsc baseline: **17 errors preserved** (no new tsc errors introduced)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Edge case bug] Rotation clamp normalized 180 → -180 unexpectedly**
- **Found during:** Task 1 GREEN run (Test 5: round-trip canonical angles)
- **Issue:** Initial threat-model T-72-01 clamp implementation used the canonical
  `((r % 360) + 540) % 360 - 180` formula unconditionally, which maps the
  half-open interval `[-180, 180)` and pushes `180` → `-180`. Plan behavior
  contract explicitly required `rotation = 180` to round-trip identically.
- **Fix:** Short-circuit the clamp when `action.rotation` is already in
  `[-180, 180]` (closed interval); only apply the canonical normalization for
  out-of-range inputs.
- **Files modified:** `src/lib/editor/editor-reducer.ts` (BULK_ROTATE case
  clamp branch).
- **Commit:** `4cda151`

**No other deviations.** Plan executed exactly as written; computeRotatedAABB
helper signature, file layout, and test counts match the plan spec verbatim.

## Authentication Gates

None — plan was pure data-layer work with no UI surface, no external service
dependencies, no auth required.

## Self-Check: PASSED

- Files exist:
  - FOUND: `src/lib/editor/__tests__/bulk-rotate.test.ts`
  - FOUND: `src/lib/editor/transforms/__tests__/rotated-aabb.test.ts`
  - FOUND: `src/lib/editor/transforms/__tests__/selection-bounds-rotated.test.ts`
  - FOUND: `src/lib/editor/transforms/__tests__/align-rotated.test.ts`
  - FOUND: `src/lib/editor/transforms/__tests__/element-rect-intersect-rotated.test.ts`
- Commits exist:
  - FOUND: `4cda151` (Task 1: BULK_ROTATE reducer + PRA13)
  - FOUND: `c62007c` (Task 2: rotation-aware AABB)

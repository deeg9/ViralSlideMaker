---
phase: 63-alignment-distribute-smart-guides
plan: 01
subsystem: editor-transforms
tags: [alignment, distribute, pure-transforms, reducer, locked-bounds, watermark-bounds]
requires:
  - "Plan 60-03 (BULK_TRANSLATE skip rules: locked, anchor!=='custom', watermark)"
  - "Plan 60-05 (computeSelectionBounds union AABB pure helper)"
  - "Plan 62-01 (GROUP/UNGROUP single-pushHistory pattern)"
provides:
  - "alignElements(slide, ids, axis, target) pure fn — 6-axis, integer-rounded"
  - "distributeElements(slide, ids, axis) pure fn — N>=3 gate, gap-equal spacing"
  - "AlignAxis | AlignTarget | DistributeAxis | AlignPatch types"
  - "ALIGN reducer action — single pushHistory, applyDualWrite, ref-equal short-circuit"
  - "DISTRIBUTE reducer action — same shape as ALIGN"
  - "computeSelectionBounds: locked + watermark INCLUDED in union AABB (Phase 60-05 gap closed for read side)"
  - "applyAlignPatches internal helper (defense-in-depth move-side filter)"
affects:
  - "Plan 63-02 (toolbar wiring): consumes alignElements + dispatches ALIGN; consumes distributeElements + dispatches DISTRIBUTE; tinykeys Alt+A/H/D/W/V/S + Cmd+Alt+H/V"
  - "Plan 63-04 (smart-guide drag integration): BULK_TRANSLATE skip rules for locked + watermark are now also enforced by ALIGN/DISTRIBUTE pure fns — drag integration can mirror"
  - "Phase 64 (lock semantics): completes the ALIGN-10 bounds-include-but-skip-move story; locked toggle UI lands in 64"
tech-stack:
  added: []
  patterns:
    - "Pure-module transform under src/lib/editor/transforms/ (mirrors selection-bounds + text-box-adapter convention)"
    - "Reducer routes through pure-fn boundary for rounding (Math.round at the pure-fn layer; reducer does NOT re-round — would double-round)"
    - "applyDualWrite (BL-01) wraps every text_boxes mutation, even for ALIGN/DISTRIBUTE"
    - "Ref-equal short-circuit when no slide changed (skips pushHistory; matches UNGROUP idempotency pattern)"
    - "Defense-in-depth move-side filter at reducer boundary mirrors pure-fn skip rules"
key-files:
  created:
    - "src/lib/editor/transforms/align.ts (245 LOC pure module)"
    - "src/lib/editor/__tests__/align.test.ts (467 LOC, 24 tests)"
    - ".planning/phases/63-alignment-distribute-smart-guides/63-01-SUMMARY.md (this file)"
  modified:
    - "src/lib/editor/transforms/selection-bounds.ts (+~57 LOC: watermark placeholder rect; locked already implicitly included; header lift)"
    - "src/lib/editor/__tests__/selection-bounds.test.ts (+~104 LOC: 5 new tests; 2 superseded)"
    - "src/lib/editor/editor-actions.ts (+~33 LOC: ALIGN + DISTRIBUTE on EditorAction union)"
    - "src/lib/editor/editor-reducer.ts (+~113 LOC: ALIGN + DISTRIBUTE cases + applyAlignPatches helper)"
    - "src/lib/editor/__tests__/editor-reducer.test.ts (+~364 LOC: 14 new tests AR1-AR13)"
decisions:
  - "Watermark placeholder rect 18%×5% anchored by enum (top-left=0/0; bottom-left=0/95; bottom-right=82/95). Schema-derived freeform sizing is a Phase 64 task — we DO NOT introduce a watermark size schema in 63"
  - "Pure align.ts is the rounding boundary (Math.round at every numeric output); reducer applies patches verbatim — avoids double-rounding (PITFALL-4.4)"
  - "ALIGN/DISTRIBUTE reducer cases ref-equal short-circuit when no candidates produced patches (empty ids, all-locked, only-watermark) — skips pushHistory, matches UNGROUP idempotency pattern"
  - "Move-side filter applied TWICE: pure align.ts (single source of truth) + applyAlignPatches reducer helper (defense-in-depth) — mirrors BULK_TRANSLATE pattern"
  - "Distribute candidates filter locked + watermark + structural-anchor BEFORE sort + outermost-pin — locked midway between two free elements is correctly skipped without disturbing the gap math (Test AR12 / D6 pin)"
  - "Custom-anchor TextBoxes treat height as 0 in selection-bounds AND alignElements — Phase 64 lift target (DOM-ref height resolution); selection-bounds header documents the only remaining Phase 60 gap"
requirements-completed:
  - "ALIGN-03: N=1→canvas, N≥2→selection (data layer)"
  - "ALIGN-04: distribute horizontal/vertical (data layer)"
  - "ALIGN-05: gap-based equal spacing (PITFALL-4.6 / Figma + Sketch consensus)"
  - "ALIGN-08: single pushHistory per dispatch (= PERF-01 carry-forward)"
  - "ALIGN-09: integer-rounded positions on dispatch (Math.round at the pure-fn boundary)"
  - "ALIGN-10: locked elements participate in selection bounds but DO NOT MOVE (read + move sides)"
metrics:
  duration: "~30 min wall-clock (3 atomic TDD task groups)"
  completed_date: "2026-05-03"
  tasks: 3
  files_changed: 8
  loc_delta: "+~929 (excluding SUMMARY)"
  tests_added: 43
  tests_total_after: "264 editor-suite tests pass (was 250)"
  tsc_baseline_errors: "17 → 17 (preserved)"
---

# Phase 63 Plan 01: Align/Distribute Pure Functions + Reducer + Selection-Bounds Lift Summary

**One-liner:** Pure `alignElements` + `distributeElements` transforms with integer rounding, ALIGN/DISTRIBUTE reducer actions calling `pushHistory` exactly once per dispatch, and `computeSelectionBounds` extended to include locked + watermark in the union AABB — closing the read-side ALIGN-10 gap left by Phase 60-05.

## What Shipped

### Wave A data layer — three artifacts, three tasks, six requirements

1. **`src/lib/editor/transforms/align.ts`** — 245 LOC pure module
   - `alignElements(slide, ids, axis: 'left'|'center-h'|'right'|'top'|'center-v'|'bottom', target: 'canvas'|'selection')`
   - `distributeElements(slide, ids, axis: 'horizontal'|'vertical')`
   - Both return `AlignPatch[]` = `{ id, patch: { x?, y? } }[]`.
   - Move-candidate filter: skip if id not selected, locked, watermark, or structural-anchor TextBox (anchor !== 'custom'). Single source of truth for the move side of ALIGN-10.
   - `Math.round` applied at every numeric output (ALIGN-09 / PITFALL-4.4).
   - Distribute uses gap-based equal spacing (PITFALL-4.6 / Figma + Sketch + Canva consensus): `gap = ((last.end - first.start) - sum(sizes)) / (N - 1)`.
   - Zero React, zero DOM, zero I/O. Reusable from server, RPC, future MCP `edit_slide`.

2. **`src/lib/editor/transforms/selection-bounds.ts`** — extended
   - Watermark now contributes a placeholder rect (18% wide × 5% tall) anchored by `watermark.position` enum. Covers all three positions: `top-left`, `bottom-left`, `bottom-right`. The default fallback also resolves to `bottom-right` so existing fixtures work unchanged.
   - Locked elements already flowed through unchanged in the read side (no `.locked` skip exists in this function); Tests 11 + 14 pin the read-side ALIGN-10 contract going forward.
   - Header reflects Phase 60 known-gap-closure for watermark and locked; structural-anchor TextBox height resolution remains the only open Phase 60 gap (Phase 64 lift target).

3. **`src/lib/editor/editor-reducer.ts`** + **`src/lib/editor/editor-actions.ts`**
   - `EditorAction` union extended with `ALIGN { slideIndex, ids, axis, target }` and `DISTRIBUTE { slideIndex, ids, axis }` — types imported from `align.ts` so the contract is single-sourced.
   - `editorReducer` ALIGN case: `alignElements` (pure) → `applyAlignPatches` → exactly one `pushHistory` (ALIGN-08 = PERF-01 carry-forward). Ref-equal short-circuit when no slide changed (matches UNGROUP idempotency pattern).
   - `editorReducer` DISTRIBUTE case: same shape with `distributeElements`.
   - `applyAlignPatches` (internal helper, not exported): walks `text_boxes` + `custom_images`, applies patches, routes `text_boxes` through `applyDualWrite` (BL-01). Defense-in-depth filters mirror the pure layer's pre-filter.

### Test coverage delta

| Suite | Before | After | New |
|-------|--------|-------|-----|
| `selection-bounds.test.ts` | 10 | 14 | 4 (Tests 11, 12/12b/12c, 13, 14 — Tests 7/7b superseded) |
| `align.test.ts` | 0 | 24 | 24 (A1-A16 + D1-D6 + D7/D8 purity) |
| `editor-reducer.test.ts` | 48 | 62 | 14 (AR1-AR13, AR7b) |
| **Editor suite total** | 250 | 264 | 14 |

`npx tsc --noEmit -p tsconfig.json` baseline preserved at 17 errors (no new TypeScript errors introduced).

## Seam Exposed

### For Plan 63-02 (toolbar wiring + tinykeys)
- Toolbar buttons: `dispatch({ type: 'ALIGN', slideIndex, ids, axis: 'left' | 'center-h' | ..., target })` — `target` resolved by N: `N === 1 ? 'canvas' : 'selection'`.
- Distribute buttons: `dispatch({ type: 'DISTRIBUTE', slideIndex, ids, axis: 'horizontal' | 'vertical' })` — disable button at `N < 3` (toolbar gate; pure fn also defends).
- Keyboard handlers (tinykeys): same dispatch shape; `Alt+A/H/D` → `left/center-h/right`; `Alt+W/V/S` → `top/center-v/bottom`; `Cmd+Alt+H/V` → distribute.

### For Plan 63-04 (smart-guide drag integration + multi-element bbox)
- Multi-element drag will use `computeSelectionBounds(slide, ids)` for the union bbox snap candidates (SNAP-09). The bounds now include locked + watermark, so dragging a group of `[locked, free, free]` snaps the union edge correctly.
- BULK_TRANSLATE skip rules (locked, structural anchor, watermark) are mirrored by `alignElements`/`distributeElements`/`applyAlignPatches` — drag integration in 63-04 can use the same predicate set without divergence.

## Deviations from Plan

### None — plan executed exactly as written.

The only nuance: "Test 7 / 7b" in the existing `selection-bounds.test.ts` documented the Phase 60 watermark-skip semantics; Phase 63 D-01 closes that gap, so those tests would now contradict the new behavior. Per plan Action step #3 ("CLOSE Phase 60-05 documented gap"), I replaced them with a brief comment block citing the Phase 63 D-01 supersession (no test removed silently — replacement comment is grep-able). The 4 new tests (11, 12/12b/12c, 13) plus the strengthened purity guard (14) net +5 cases.

### Auth gates
None — pure data-layer plan, no I/O.

## Threat Flags
None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Threat register T-63-01..05 mitigations all hold:

- **T-63-01** (tampering — unknown ids): pure fn filters via `idSet`; Test AR7 (empty ids) + AR7b (all-locked) pin the no-op short-circuit.
- **T-63-02** (tampering — watermark enum): pure fn `buildMoveCandidates` does not include watermark; Test A12 + AR4 pin.
- **T-63-03** (info disclosure): pure module — no I/O, no logs.
- **T-63-04** (DoS via large N): O(N log N) sort dominates; N capped at ~30 per slide (RESEARCH ceiling); no concern.
- **T-63-05** (elevation — locked move): pure fn skips locked from candidates; Test A10 + AR3 pin (defense-in-depth at applyAlignPatches reducer helper).

## Known Stubs
None — every patched element flows to actual schema fields read by both renderers (TPLREND-05 contract preserved).

## Self-Check: PASSED

**Files exist:**
- `src/lib/editor/transforms/align.ts` — FOUND
- `src/lib/editor/__tests__/align.test.ts` — FOUND
- `src/lib/editor/transforms/selection-bounds.ts` — FOUND (modified)
- `src/lib/editor/__tests__/selection-bounds.test.ts` — FOUND (modified)
- `src/lib/editor/editor-actions.ts` — FOUND (modified)
- `src/lib/editor/editor-reducer.ts` — FOUND (modified)
- `src/lib/editor/__tests__/editor-reducer.test.ts` — FOUND (modified)

**Commits exist:**
- `83a056e` — test(63-01/t1): RED selection-bounds — FOUND
- `5b91272` — feat(63-01/t1): GREEN selection-bounds — FOUND
- `1ed2e3d` — test(63-01/t2): RED align.ts — FOUND
- `28943cf` — feat(63-01/t2): GREEN align.ts — FOUND
- `15fc5e9` — test(63-01/t3): RED reducer ALIGN/DISTRIBUTE — FOUND
- `b60fb71` — feat(63-01/t3): GREEN reducer ALIGN/DISTRIBUTE — FOUND

**Verification grep gates:**
- `grep -c "case 'ALIGN'" src/lib/editor/editor-reducer.ts` → 1 ✓
- `grep -c "case 'DISTRIBUTE'" src/lib/editor/editor-reducer.ts` → 1 ✓
- `grep -c "type: 'ALIGN'" src/lib/editor/editor-actions.ts` → 1 ✓
- `grep -c "type: 'DISTRIBUTE'" src/lib/editor/editor-actions.ts` → 1 ✓
- `grep -c "Math.round" src/lib/editor/transforms/align.ts` → 9 ✓ (≥4)
- purity gate (`react|use client|document.|window.`) on align.ts → 0 ✓
- `grep -c "Watermark intentionally skipped" src/lib/editor/transforms/selection-bounds.ts` → 0 ✓
- `grep -cE "if[^a-zA-Z].*\.locked" src/lib/editor/transforms/selection-bounds.ts` → 0 ✓

**Test results:**
- `npx vitest run src/lib/editor/__tests__/align.test.ts` → 24/24 pass
- `npx vitest run src/lib/editor/__tests__/selection-bounds.test.ts` → 14/14 pass
- `npx vitest run src/lib/editor/__tests__/editor-reducer.test.ts` → 62/62 pass
- `npx vitest run src/lib/editor/` → 264/264 pass
- `npx tsc --noEmit -p tsconfig.json` → 17 errors (baseline preserved)

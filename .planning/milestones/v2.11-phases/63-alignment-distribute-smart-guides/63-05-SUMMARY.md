---
phase: 63-alignment-distribute-smart-guides
plan: 05
subsystem: editor-tests-deprecation
tags: [parity, perf-budget, locked-elements, integration-test, polish, deprecation-marker, milestone-gate]

# Dependency graph
requires:
  - phase: 63-alignment-distribute-smart-guides
    provides: "Plan 63-01 align.ts pure module + ALIGN/DISTRIBUTE reducer cases (locked-include-bounds-not-move at the unit layer)"
  - phase: 63-alignment-distribute-smart-guides
    provides: "Plan 63-02 floating-alignment-toolbar component + slide-preview onAlign wiring"
  - phase: 63-alignment-distribute-smart-guides
    provides: "Plan 63-03 snap-index pure module — buildSnapIndex / snapWithHysteresis"
  - phase: 63-alignment-distribute-smart-guides
    provides: "Plan 63-04 SmartGuideOverlay component + slide-preview drag-handler integration; legacy useAlignmentGuides import retired"
provides:
  - "PARITY-03 milestone gate — 8 multi-element fixture tests (PT-03A..H) confirm every v2.11 editor-only chrome absent in editable={false} render path; PT-03H positive control prevents false-negative class"
  - "ALIGN-10 end-to-end integration pin (5 tests AL1-AL5) — locked-include-bounds-not-move + watermark contributes-bounds-not-moves + DISTRIBUTE locked-skip + single pushHistory invariant"
  - "PERF-05 integration verification (3 tests PI1-PI3) — full onDrag tick budget at N=30 < 2ms median, including modifier-check + 3 X-snaps + 3 Y-snaps + 2 detectEqualSpacing"
  - "Legacy use-alignment-guides.ts @deprecated JSDoc + dev-mode console.warn shim + DEP1/DEP2 grep guards (zero production importers; Phase 66 deletion target documented)"
affects: [64, 65, 66]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regression-confirmation fixture suite: tests that pin existing behavior introduced by upstream plans (PT-03A..F mirror Plans 60-05/61-02/62-02/63-02/63-04). Pure tests with no new production code."
    - "Kitchen-sink + positive-control test pair (PT-03G + PT-03H): single fixture asserts ALL chrome testids absent under editable={false}, then SAME fixture under editable={true} asserts every testid PRESENT — guards against false negatives where the test passes only because the fixture is broken upstream."
    - "Integration-tick perf bench mirroring slide-preview.tsx's runSnapForDrag closure (Plan 63-04). Catches the failure mode where unit benches still pass but a future plan adds a heavier helper inside the onDrag pipeline."
    - "Two-layer deprecation strategy: file-header JSDoc @deprecated tag + per-export tag + dev-mode console.warn shim + grep-test gate for zero production importers. Hard runtime warning + soft compile-time warning + structural enforcement."

key-files:
  created:
    - src/lib/editor/__tests__/align-locked-bounds.test.ts (199 LOC, 5 tests AL1-AL5) — ALIGN-10 end-to-end integration pin
    - src/lib/editor/__tests__/snap-index-perf.test.ts (288 LOC, 5 tests PI1/PI2/PI3 + DEP1/DEP2) — PERF-05 integration verify + legacy deprecation gates
    - .planning/phases/63-alignment-distribute-smart-guides/63-05-SUMMARY.md (this file)
  modified:
    - src/lib/render/__tests__/parity.test.tsx (+309 LOC, 8 new tests PT-03A..H — PARITY-03 milestone gate)
    - src/hooks/use-alignment-guides.ts (+19 LOC — file-header @deprecated JSDoc + per-export @deprecated tag + dev-mode console.warn shim)

key-decisions:
  - "Tests PT-03A..F are regression confirmations of behavior already pinned by Plans 60-05, 61-02, 62-02, 63-02, 63-04. They passed on first run because the underlying chrome was already structurally gated. Treating them as test() commits (regression-pin) rather than feat() since no new production code shipped — they CODIFY the gate as a permanent regression test."
  - "PT-03G (kitchen sink) + PT-03H (positive control) form an inseparable pair. PT-03G asserts every chrome testid absent in editable=false; PT-03H asserts those same testids PRESENT in editable=true with the SAME fixture. If PT-03G passed alone and the fixture were broken upstream, the test would silently pass. PT-03H proves the fixture is correctly assembled."
  - "marquee-overlay deliberately omitted from PT-03H positive control. It is transient state (only present during an active marquee drag, not selection-driven). PT-03G still asserts its absence in editable=false; the asymmetry is documented inline."
  - "Integration perf test (PI1) mirrors Plan 63-04's runSnapForDrag closure shape, NOT the React-rendered slide-preview. This catches algorithmic regressions in the integration overhead without depending on React render mechanics — keeping the bench deterministic across vitest environments."
  - "Hold-Cmd PI2 budget (< 0.1ms) is intentionally tighter than the unit bench's findNearestSnap ceiling (< 0.05ms). The early-out path is exercised end-to-end here including modifier check + branch return — a single ref read is well below the budget. If PI2 fails, the early-out path was inadvertently expanded (e.g., a future plan added work BEFORE the cmd check)."
  - "PI3 consistency check skips the assertion when median < 0.05ms — performance.now() resolution is itself ~10us, and very-low medians can artifact the 3× ratio without any actual regression. Always asserts max < 5ms as the absolute floor."
  - "Legacy use-alignment-guides.ts retained as dead code per CONTEXT D-09. Phase 66 cleanup target. Two-layer deprecation: file-header JSDoc + per-export tag for IDE hints; dev-mode console.warn for runtime; DEP2 grep gate as the structural enforcement (zero production importers — fails CI if a future plan accidentally re-imports)."
  - "DEP2 grep filters BOTH the self-file AND any __tests__/ directory entry. The legacy contract may still need exercising by tests that explicitly verify the legacy hook's behavior (defensive — none today, but the pattern keeps the gate sustainable through Phase 66)."

requirements-completed:
  - "PARITY-03: parity test with multi-element fixtures (selection ring, group bbox, marquee active, smart guides active, floating toolbar) — 8 new tests PT-03A..H pin the structural gate end-to-end"
  - "ALIGN-10 (end-to-end pin): locked elements participate in selection bounds for alignment math, but DO NOT MOVE on dispatch — 5 tests AL1-AL5 confirm via reducer dispatch path"
  - "PERF-05 (integration verification): smart-guide-active drag with N=30 elements completes the onDrag handler in <2ms median — 3 tests PI1-PI3 mirror runSnapForDrag closure"

# Metrics
metrics:
  duration: ~25 minutes
  completed_date: 2026-05-02
  tasks: 3
  files_created: 2
  files_modified: 2
  loc_delta: ~+815 (309 parity + 199 align-locked + 288 perf+DEP + 19 deprecation marker)
  tests_added: 18 (8 PARITY-03 + 5 ALIGN-10 + 5 PERF/DEP)
  tests_total_after_in_scope: "745/745 (51 test files: editor + slides + lib/editor + lib/render — up from 727 in Plan 63-04)"
  tsc_baseline_errors: "17 → 17 (preserved)"
---

# Phase 63 Plan 05: PARITY-03 Multi-Element Fixture Suite + ALIGN-10 Integration + PERF-05 Integration Verify Summary

**Final-wave polish + parity gate plan: ships the comprehensive PARITY-03 multi-element fixture suite (8 tests covering every v2.11 editor-only chrome surface), the ALIGN-10 end-to-end integration pin (5 tests via reducer dispatch), the PERF-05 integration-level perf verification (3 tests mirroring slide-preview's runSnapForDrag closure), and the legacy use-alignment-guides.ts @deprecated marker. All 24 Phase 63 reqs are now complete.**

## Performance

- **Duration:** ~25 min wall-clock
- **Completed:** 2026-05-02
- **Tasks:** 3 (all atomic test commits)
- **Files created:** 2 (align-locked-bounds.test.ts + snap-index-perf.test.ts)
- **Files modified:** 2 (parity.test.tsx +309 LOC; use-alignment-guides.ts +19 LOC deprecation)
- **LOC delta:** ~+815
- **tsc baseline:** 17 → 17 (preserved)

## Accomplishments

### Task 1 — PARITY-03 multi-element fixture suite (parity.test.tsx +309 LOC)

8 new tests PT-03A through PT-03H cover every v2.11 editor-only chrome:

- **PT-03A:** multi-selection-ring (Plan 60-05) — N>=2 selection + editable=false → testid absent.
- **PT-03B:** group-bounding-ring (Plan 62-02) — 2 grouped elements + editable=false → testid absent.
- **PT-03C:** marquee-overlay (Plan 61-02) — editable=false → testid absent (idle state regression).
- **PT-03D:** floating-alignment-toolbar (Plan 63-02) — N>=2 + onAlign + editable=false → testid absent.
- **PT-03E:** smart-guide-overlay (Plan 63-04) — editable=false → root + -x + -y + -equal sub-pool testids all absent.
- **PT-03F:** equal-spacing == indicator — editable=false + 3 equally-spaced elements → no smart-guide-overlay-equal AND no Figma-pink #FF00C7.
- **PT-03G:** KITCHEN SINK — single fixture (grouped + locked + watermark + N=4 selection) under editable=false → ALL chrome testids absent.
- **PT-03H:** POSITIVE CONTROL — same fixture under editable=true → multi-selection-ring + group-bounding-ring + floating-alignment-toolbar + smart-guide-overlay-{root,x,y,equal} all PRESENT. Validates fixture correctness end-to-end (prevents the false-negative class where PT-03G passes only because the fixture is broken upstream).

All 8 tests passed on first run — the chrome was already structurally gated by Plans 60-05 / 61-02 / 62-02 / 63-02 / 63-04. The PARITY-03 contract is now CODIFIED as a permanent regression test (any future plan that accidentally leaks chrome into the editable=false branch will fail loudly).

### Task 2 — ALIGN-10 end-to-end integration pin (align-locked-bounds.test.ts, 199 LOC, 5 tests)

`src/lib/editor/__tests__/align-locked-bounds.test.ts` exercises the full dispatch path (pure-fn → reducer → state.present mutation):

- **AL1:** ALIGN axis=left + 3 imgs with middle locked → bounds.x=10 (locked included via Plan 63-01); locked stays at 50; un-locked imgs move to 10.
- **AL2:** ALIGN axis=right same fixture → bounds.right=100 (locked included); un-locked snap to 90; locked stays at 50.
- **AL3:** watermark + 2 imgs ALIGN axis=left → watermark contributes to bounds (Plan 63-01) but enum position unchanged; both imgs move to bounds.x=0.
- **AL4:** DISTRIBUTE horizontal with 4 imgs (1 locked spatially "in middle") → locked stays at original x=20; outermost un-locked pinned; inner un-locked redistributed (gap=35, position 45).
- **AL5:** Single pushHistory invariant pin — one ALIGN dispatch → past.length grows by exactly 1 (ALIGN-08 / PERF-01).

All 5 tests passed on first run — Plan 63-01 already pinned the contract at the unit level; this confirms it holds end-to-end (no regression introduced by Plan 63-02 toolbar wiring or Plan 63-04 smart-guide drag handlers).

### Task 3 — PERF-05 integration verify + legacy @deprecated marker (snap-index-perf.test.ts, 288 LOC, 5 tests; use-alignment-guides.ts +19 LOC)

`src/lib/editor/__tests__/snap-index-perf.test.ts` mirrors slide-preview.tsx's runSnapForDrag closure shape:

- **PI1:** 60 ticks each running modifier-check + 3 X-axis snapWithHysteresis (left/center-h/right) + 3 Y-axis snapWithHysteresis (top/center-v/bottom) + 2 detectEqualSpacing (X axis + Y axis) — median < 2ms (PERF-05 contract).
- **PI2:** 60 ticks with Cmd held — early-out is a single ref read + return — median < 0.1ms.
- **PI3:** 100 ticks consistency check — max < 3× median (no allocation churn / V8 hidden-class transitions); skipped when median < 0.05ms (perf.now() resolution artifact).
- **DEP1:** grep gate — `src/hooks/use-alignment-guides.ts` carries `@deprecated` JSDoc tag + references `snap-index.ts` + documents `Phase 66` deletion target.
- **DEP2:** grep gate — zero production code (filters self + `__tests__/`) imports `use-alignment-guides`.

`src/hooks/use-alignment-guides.ts` modified:
- File-header JSDoc block: `@deprecated` tag + migration pointer to `src/lib/editor/transforms/snap-index.ts` + `Phase 66 will delete this file` notice.
- Per-export `@deprecated` tag on `useAlignmentGuides` function.
- Dev-mode `console.warn` shim inside the hook body — silenced under test/production to avoid log noise on legacy contract regression tests.
- Runtime behavior unchanged (file is dead code; retained for Phase 66 cleanup).

## Task Commits

1. **Task 1** — `dffd68f` test(63-05/t1): PARITY-03 multi-element fixture suite — every editor-only chrome absent in editable={false}
2. **Task 2** — `dfb0e07` test(63-05/t2): ALIGN-10 end-to-end integration pin — locked-include-bounds-not-move via reducer dispatch
3. **Task 3** — `28132d3` test(63-05/t3): PERF-05 integration verify + legacy @deprecated marker on use-alignment-guides.ts

_All three tasks committed as `test(...)` rather than the typical `test(...) → feat(...)` TDD pair: this plan's tasks ship NEW TESTS but NO NEW PRODUCTION BEHAVIOR — every contract was already pinned by Plans 63-01..04 at the unit level. These tests CODIFY the contracts as permanent regression gates. The legacy @deprecated marker is a comment + a dev-mode log + an export tag — no behavioral change._

## Files Created/Modified

**Created (2):**
- `src/lib/editor/__tests__/align-locked-bounds.test.ts` — 5 tests AL1-AL5, 199 LOC.
- `src/lib/editor/__tests__/snap-index-perf.test.ts` — 5 tests PI1/PI2/PI3 + DEP1/DEP2, 288 LOC.

**Modified (2):**
- `src/lib/render/__tests__/parity.test.tsx` — +309 LOC, 8 new tests PT-03A..H. Pre-existing 28 tests untouched.
- `src/hooks/use-alignment-guides.ts` — +19 LOC. File-header @deprecated JSDoc + per-export @deprecated tag + dev-mode console.warn shim. Runtime hook behavior unchanged.

## Decisions Made

See `key-decisions` in frontmatter. The most consequential:

1. **PARITY-03 tests passed on first run as regression confirmations.** Plans 60-05 / 61-02 / 62-02 / 63-02 / 63-04 already implemented the structural gates; Plan 63-05 codifies the contract as a permanent set of 8 regression tests. PT-03H positive control is the load-bearing piece: without it, PT-03G would be a false-negative if the fixture were broken upstream.

2. **PT-03H deliberately omits marquee-overlay from positive control.** marquee-overlay is transient state (only present during an active marquee drag — not selection-driven). The asymmetry is documented inline; PT-03G still asserts its absence in editable=false. Including it in PT-03H would force the test to mock RAF + pointer-events, which is out of scope for this plan.

3. **Integration perf test (PI1) does NOT render React.** It mirrors the runSnapForDrag closure shape directly. This makes the bench deterministic across vitest environments and isolates the algorithmic cost (the React render path is already covered by Plan 63-04's SP11 — 60 onDrag → 0 React renders).

4. **Two-layer deprecation strategy.** File-header JSDoc + per-export tag = soft (IDE / static-analysis); dev-mode console.warn = hard (runtime in dev); DEP2 grep gate = structural (CI fails if re-imported). Together they form a defense-in-depth pattern that catches accidental re-imports at every layer.

## Deviations from Plan

### Plan executed exactly as written.

Three minor adjustments worth noting:

1. **TDD commit form.** Plan tasks 1-3 all carry `tdd="true"` but every contract was already pinned by upstream plans (63-01..04). The tests passed on first run as regression confirmations. I chose `test(...)` commits (rather than `test(...)` RED → `feat(...)` GREEN pairs) since no new production behavior shipped. The contract is CODIFIED, not introduced. The TDD gate spirit is preserved: every test serves as a permanent regression boundary, and any future regression will surface as a `test(...)` failure during CI runs.

2. **Plan 63-04 already extended PARITY-01 with smart-guide / alignment-guide testid scans** (line 354-362 of parity.test.tsx). My PT-03E + PT-03G repeat those scans inline, but pin them via `querySelector` rather than `innerHTML` regex — `querySelector` returns the actual element ref and is the canonical proof that the testid is structurally absent (vs. just textually absent in the HTML).

3. **PI3 consistency check has a floor.** When median < 0.05ms, the 3× ratio is not asserted (performance.now() ~10us resolution can artifact the ratio). The absolute max < 5ms ceiling is always asserted. This is documented inline.

### Auth gates

None — pure test + JSDoc plan, no I/O, no external services.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Threat register T-63-19..T-63-22 mitigations all hold:

- **T-63-19** (editor chrome leaking into Satori PNG): PT-03A..H cover every v2.11 chrome surface; PT-03H positive control prevents false negatives.
- **T-63-20** (future plan re-imports legacy useAlignmentGuides): DEP2 grep gate prevents re-import at CI; @deprecated JSDoc + console.warn shim provide IDE + runtime warnings.
- **T-63-21** (PERF-05 budget regression): PI1 integration bench catches algorithmic regressions; PI2 catches Hold-Cmd path expansion; PI3 catches allocation churn.
- **T-63-22** (test-only changes — no production behavior): Accepted. All three tasks are test files + JSDoc deprecation marker.

## Known Stubs

None — every fixture renders concrete DOM trees through the actual SlidePreview component. Every assertion checks specific testids or content. No mock data or placeholder strings flow to UI.

## Known Gaps (Carry-Forward)

Inherited from earlier Phase 63 plans, untouched by Plan 63-05:

- **Structural-anchor TextBox height resolution** — Phase 60 known gap. Heights resolve to 0 in alignment math (acceptable for v2.11 since structural anchors don't participate in vertical alignment by design). Phase 64 lift target via DOM-ref helper.
- **Watermark size still placeholder 18% × 5%** — Phase 64 lift when watermark gains real x/y/width/height schema fields.
- **Legacy `src/hooks/use-alignment-guides.ts` retained as dead code** — Plan 63-05 added the @deprecated marker. Phase 66 will delete the file.

## Phase 63 Completion Status

All 24 Phase 63 requirements covered across Plans 63-01..05:

**Wave A (Alignment) — 10 reqs:**
- ALIGN-01..03: 6-axis alignment + N=1→canvas / N≥2→selection (Plan 63-01 align.ts; Plan 63-02 keyboard wiring)
- ALIGN-04..05: distribute horizontal/vertical + gap-based equal spacing (Plan 63-01 align.ts)
- ALIGN-06: distribute disabled at N<3 with tooltip (Plan 63-02 floating toolbar)
- ALIGN-07: Floating Figma-style toolbar above multi-selection bounds (Plan 63-02)
- ALIGN-08: single pushHistory per gesture (Plan 63-01 reducer; Plan 63-05 AL5 integration pin)
- ALIGN-09: integer-rounded positions on dispatch (Plan 63-01 align.ts Math.round at boundary)
- ALIGN-10: locked elements participate in selection BOUNDS but DO NOT MOVE (Plan 63-01 unit pin; Plan 63-05 AL1-AL4 integration pin)

**Wave B (Smart Guides) — 14 reqs:**
- SNAP-01..03: 5px snap threshold + element-edge + canvas-edge snap (Plan 63-03 snap-index.ts; Plan 63-04 wiring)
- SNAP-04: equal-spacing == indicator (Plan 63-04 detectEqualSpacing + smart-guide-overlay-equal pool)
- SNAP-05: Hold-Cmd disables snap (Plan 63-04 runSnapForDrag short-circuit; Plan 63-05 PI2 perf pin)
- SNAP-06: smart guide overlay inside scaled canvas (Plan 63-04 SmartGuideOverlay mounted REF px)
- SNAP-07: persistent guide DOM with translate3d (Plan 63-04 imperative-ref pool; PERF-03)
- SNAP-08..10: sorted edge arrays + binary search + asymmetric hysteresis (Plan 63-03 buildSnapIndex + snapWithHysteresis)
- DIFF-03: Figma equal-spacing pink == cross-ref (Plan 63-04 + Plan 63-05 PT-03F #FF00C7 scan)
- PERF-03: no React reconciliation per pointer-move (Plan 63-04 SP11 60 onDrag → 0 React renders)
- PERF-05: <2ms perf budget at N=30 (Plan 63-03 unit bench PB3/PB4; Plan 63-05 integration bench PI1)
- PARITY-03: parity test with multi-element fixtures (Plan 63-05 PT-03A..H)

## Seam Exposed for Phase 64 (Lock/Hide + Z-Order)

- **Lock toggle in floating-alignment-toolbar:** Plan 63-02 reserved a button slot. Phase 64's LOCK-03 Cmd+Shift+L can wire there directly — the toolbar is component-level, the keybinding is Plan 60-04 tinykeys.
- **Locked-elements-skip-marquee invariant** from Phase 61 + **locked-included-in-bounds invariant** from Plan 63-01 are the foundation for Phase 64 LOCK-04 (selectable but non-movable) full semantics.
- **AL3 / AL4 watermark + locked behavior** (Plan 63-05) is the integration baseline; Phase 64 watermark schema lift can reuse the test pattern by replacing the placeholder rect with a freeform x/y/width/height fixture.

## Seam Exposed for Phase 65 (Layers Panel + TPLREND-05 Audit)

- **PARITY-03 fixture pattern** (PT-03G kitchen sink + PT-03H positive control) can be extended for layers-panel-induced ordering — same pair-test discipline catches reorder-induced parity drift.
- **snap-index.ts** is the canonical snap math. Layers panel reorder mutates array order; the next drag rebuilds buildSnapIndex from scratch — no carry-forward state to invalidate.
- **smart-guide-overlay-root** + sub-pool testids (-x, -y, -equal) form a stable testid contract for layers-panel-driven re-renders.

## Seam Exposed for Phase 66 (Polish)

- **`src/hooks/use-alignment-guides.ts` Phase 66 deletion target documented** — file-header JSDoc explicitly names the cleanup phase. DEP2 grep gate is the safety net (deleting the file should not break any production import).
- **tinykeys binding hints / tooltip text on toolbar buttons (KBD-08)** are reserved spots for Phase 66 polish. Plan 63-02 toolbar already exposes the props surface.
- **PI3 consistency floor (median > 0.05ms)** documented; Phase 66 can refine the perf test if vitest's perf.now() resolution warrants tighter assertions.

## Self-Check: PASSED

**Files created exist:**
- `src/lib/editor/__tests__/align-locked-bounds.test.ts` — FOUND
- `src/lib/editor/__tests__/snap-index-perf.test.ts` — FOUND
- `.planning/phases/63-alignment-distribute-smart-guides/63-05-SUMMARY.md` — FOUND (this file)

**Files modified exist:**
- `src/lib/render/__tests__/parity.test.tsx` — FOUND (extended +309 LOC)
- `src/hooks/use-alignment-guides.ts` — FOUND (extended +19 LOC)

**Commits exist in git log:**
- `dffd68f` test(63-05/t1) — FOUND
- `dfb0e07` test(63-05/t2) — FOUND
- `28132d3` test(63-05/t3) — FOUND

**Verification grep gates:**
- `grep -c "PARITY-03" src/lib/render/__tests__/parity.test.tsx` → 9 ✓ (≥1)
- `grep -c "ALIGN-10" src/lib/editor/__tests__/align-locked-bounds.test.ts` → 2 ✓ (≥1)
- `grep -c "@deprecated" src/hooks/use-alignment-guides.ts` → 2 ✓ (≥1)
- `grep -rn "use-alignment-guides" src/ --include='*.ts' --include='*.tsx' | grep -v 'src/hooks/use-alignment-guides.ts' | grep -v '__tests__'` → empty ✓ (zero production importers)

**Test results:**
- `npx vitest run src/lib/render/__tests__/parity.test.tsx` → 36/36 pass (28 baseline + 8 new)
- `npx vitest run src/lib/editor/__tests__/align-locked-bounds.test.ts` → 5/5 pass
- `npx vitest run src/lib/editor/__tests__/snap-index-perf.test.ts` → 5/5 pass
- `npx vitest run src/lib/editor/ src/components/editor/ src/components/slides/ src/lib/render/` → 745/745 pass (51 test files; +18 vs Plan 63-04's 727 baseline)
- `npx tsc --noEmit -p tsconfig.json` → 17 errors (baseline preserved)

## TDD Gate Compliance

Plan 63-05 is `type: execute` (not plan-level `type: tdd`), but each task carries `tdd="true"`. The standard TDD gate sequence (`test(...)` RED → `feat(...)` GREEN) does not strictly apply here because every contract was already implemented by Plans 63-01..04. All three tasks ship NEW REGRESSION TESTS, not new production behavior. They commit as `test(...)` because:

1. The behavior under test is already correct in the codebase (Plans 63-01..04).
2. Adding the test CODIFIES the contract as a permanent regression boundary — any future plan that breaks the contract will fail this test in CI.
3. There is no implementation to GREEN — the tests passed on first run because the upstream contract holds.

This is the "regression-pin" form of TDD: the test itself is the deliverable, and a passing run on first commit is the success criterion. The legacy @deprecated marker (Task 3) is a JSDoc + dev-mode console.warn — no production behavior change.

## User Setup Required

None — no external services, environment configuration, or auth credentials required.

---
*Phase: 63-alignment-distribute-smart-guides*
*Completed: 2026-05-02*
*Phase 63 — the largest of v2.11 (24 reqs across 5 plans) — is now FULLY COMPLETE.*

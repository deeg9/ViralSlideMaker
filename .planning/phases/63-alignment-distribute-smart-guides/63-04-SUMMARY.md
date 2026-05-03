---
phase: 63-alignment-distribute-smart-guides
plan: 04
subsystem: editor-ui
tags: [smart-guides, drag-integration, hysteresis-state, multi-element, hold-cmd-disable, equal-spacing, translate3d, ref-based-perf, tdd]

# Dependency graph
requires:
  - phase: 63-alignment-distribute-smart-guides
    provides: "Plan 63-03 snap-index pure module — buildSnapIndex / snapWithHysteresis / SNAP_THRESHOLD_ENTER / SNAP_THRESHOLD_EXIT"
  - phase: 60-multi-select-foundation
    provides: "selection-bounds.ts (computeSelectionBounds union AABB), use-modifier-state.ts (Hold-Cmd ref + blur reset)"
  - phase: 62-groups
    provides: "shouldGroupDrag (group-membership.ts) for SNAP-09 multi-element excludeIds assembly"
provides:
  - "SmartGuideOverlay component (forwardRef) with imperative updateGuides + clear API; persistent pool of 8 X + 8 Y + 8 equal-spacing slots, direct DOM mutation via translate3d"
  - "detectEqualSpacing pure helper for the SNAP-04 / DIFF-03 == indicator"
  - "slide-preview.tsx drag-handler integration: onDragStart builds snap index; onDrag queries snapWithHysteresis + detectEqualSpacing + updateGuides via ref; onDragStop clears"
  - "buildExcludeIds closure assembling group + multi-select co-moving ids for snap-index excludeIds (SNAP-09)"
  - "runSnapForDrag closure: best-of-3-edges-per-axis snap with Hold-Cmd short-circuit, pushed to overlay via ref"
  - "PARITY-01 chrome-leak regex extended with smart-guide and alignment-guide testid scans (defensive)"
affects: [63-05, 64, 65, 66]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Imperative ref handle (forwardRef + useImperativeHandle) with persistent pool of DOM nodes — bypasses React reconciliation per pointer-move (PERF-03)"
    - "translate3d on willChange:transform divs — GPU-composited path; mutating .style.transform from JS keeps the work off the main thread"
    - "Per-axis hysteresis scalar refs (Plan 63-03 contract) — wasSnappedX and wasSnappedY tracked independently"
    - "Multi-element drag union AABB query: when selection.ids.length >= 2 includes the dragger, computeSelectionBounds is offset by drag delta and used as the snap query rect; snap result is translated back to this element's coords"
    - "Best-of-3 candidate edges per axis: left/center-h/right (X) and top/center-v/bottom (Y); pick smallest delta"

key-files:
  created:
    - src/lib/editor/transforms/equal-spacing.ts (70 LOC) — pure detectEqualSpacing helper
    - src/lib/editor/__tests__/equal-spacing.test.ts (162 LOC, 11 tests ES1-ES11)
    - src/components/editor/smart-guide-overlay.tsx (271 LOC) — persistent-pool component with imperative ref API
    - src/components/editor/__tests__/smart-guide-overlay.test.tsx (232 LOC, 10 tests SG1-SG10)
    - src/components/slides/__tests__/slide-preview-smart-guides.test.tsx (527 LOC, 12 tests SP1-SP12)
    - .planning/phases/63-alignment-distribute-smart-guides/63-04-SUMMARY.md (this file)
  modified:
    - src/components/slides/slide-preview.tsx (+356 LOC, -119 LOC) — full drag-handler integration; legacy useAlignmentGuides import retired; legacy alignment-guide JSX removed
    - src/lib/render/__tests__/parity.test.tsx (+9 LOC) — PARITY-01 chrome-leak scan extended with smart-guide + alignment-guide testid blocklist entries

key-decisions:
  - "runSnapForDrag computes best-of-3 candidate edges per axis (left/center/right for X; top/center/bottom for Y) — picking the smallest delta. This gives users 3 snap targets per element but only 1 winning guide line, matching Figma's visual model."
  - "Multi-element drag query rect = computeSelectionBounds(selection.ids) offset by drag delta. The snap result is translated back to the dragged element's coords by the invariant `delta = data.x - queryX`. Single source of truth for both the dragged element and any siblings react-rnd doesn't even render in the multi-drag case."
  - "Equal-spacing detection runs across ALL slide elements (NOT excluding the dragger). The == indicator is decoration that describes the canvas's visible state — including the dragging element keeps the indicator stable as it moves into / out of equal alignment. (Snap targets are different: those exclude the dragger.)"
  - "Pool size 8 per axis + 8 equal-spacing slots — generous overshoot. Realistic snap states use ≤3 simultaneously; 24 hidden divs cost is negligible. Avoids the alternative of dynamic mounting which would force React reconciliation."
  - "SmartGuideOverlay sized 1080×1920 REF px, mounted INSIDE the scaled canvas wrapper (downstream of editable=true branch + scale CSS transform). Coords align at every zoom level (SNAP-06 + PITFALL-5.3)."
  - "Hold-Cmd disable wired by reading modifiers.get().cmd at the TOP of runSnapForDrag — clears overlay + returns input unchanged. modifier-blur reset is consumed (Plan 60-04 contract); SP5 verifies the assumption holds via a synthetic blur fixture."
  - "Legacy useAlignmentGuides import retired but file retained at src/hooks/use-alignment-guides.ts (CONTEXT D-09 — Phase 66 cleanup target). Retirement verified via grep count = 0 in slide-preview.tsx (SP9)."
  - "Parity test extension is DEFENSIVE: smart-guide testid scan is the immediate gate; alignment-guide testid scan is a forward-looking guard against future code re-introducing the legacy DOM."

requirements-completed:
  - "SNAP-02 (element edge snap): runSnapForDrag queries idx.xEdges + idx.yEdges built by buildSnapIndex from text_boxes ∪ custom_images ∪ watermark"
  - "SNAP-03 (canvas edge snap): canvas edges 0/540/1080 + 0/960/1920 contributed by buildSnapIndex (Plan 63-03)"
  - "SNAP-04 (equal-spacing == indicator): detectEqualSpacing helper + smart-guide overlay equal-segment pool"
  - "SNAP-05 (Hold-Cmd disable): runSnapForDrag short-circuits when modifiers.get().cmd is true; overlay cleared; data.x/y unchanged"
  - "SNAP-06 (overlay inside scaled canvas): SmartGuideOverlay sized REF px, mounted downstream of editable=true; coords align at every zoom"
  - "SNAP-07 (translate3d ref-based): updateGuides mutates ref.style.transform = translate3d(...) directly; no setState; PERF-03 verified by SG7 + SP11"
  - "SNAP-09 (multi-element union-bbox): buildExcludeIds covers group members + multi-select; query rect = computeSelectionBounds offset by drag delta"
  - "DIFF-03 (Figma equal-spacing pink == cross-ref): detectEqualSpacing + pink #FF00C7 segment slots + parity test scan"
  - "PERF-03 (no React reconciliation per pointer-move): SG7 (60 spam updateGuides → 0 React renders) + SP11 (60 onDrag → 0 mount renders)"

# Metrics
metrics:
  duration: ~30 minutes
  completed_date: 2026-05-02
  tasks: 3
  files_created: 6
  files_modified: 2
  loc_delta: ~1430 (incl. tests)
  tests_added: 33 (11 equal-spacing + 10 smart-guide-overlay + 12 slide-preview-smart-guides)
  tests_total_after_in_scope: "727/727 (49 test files: editor + slides + lib/editor + lib/render)"
  tsc_baseline_errors: "17 → 17 (preserved)"
---

# Phase 63 Plan 04: SmartGuideOverlay + Drag Integration Summary

**Wave-2 integration plan: ships the visible Figma-style smart guides + equal-spacing == indicator by wiring Plan 63-03's pure snap module into all 4 onDragStart/onDrag/onDragStop sites in slide-preview.tsx, mounting a persistent-pool SmartGuideOverlay component inside the scaled canvas, and retiring the legacy useAlignmentGuides hook.**

## Performance

- **Duration:** ~30 min wall-clock (3 atomic TDD task groups)
- **Completed:** 2026-05-02
- **Tasks:** 3 (each: RED test → GREEN implementation; 6 commits total)
- **Files created:** 6 (3 source modules + 3 test files)
- **Files modified:** 2 (slide-preview.tsx + parity.test.tsx)
- **LOC delta:** ~+1430 (includes tests)
- **tsc baseline:** 17 → 17 (preserved)

## Accomplishments

### Task 1 — `detectEqualSpacing` pure helper (SNAP-04 + DIFF-03)

`src/lib/editor/transforms/equal-spacing.ts` (70 LOC). Axis-agnostic detector: takes `Array<{ id, pos, size }>`, returns `EqualSpacingMatch | null`.

- Pre-sorts by pos (stable V8 sort).
- Computes consecutive gaps; returns null on overlap (negative gap) or unequal gaps (max delta from gap[0] > epsilon).
- Default epsilon = 1 px.
- Returns `{ gapSize, segments[N-1], elementIds[N] }` ready for the overlay.

11 tests pass — ES1 (N<3 → null), ES2/ES3 (equal gaps → match), ES4 (unequal → null), ES5/ES6/ES10 (epsilon tolerance + strict + default), ES7 (sorts unsorted input), ES8 (purity static check), ES9 (overlap → null), ES11 (zero-size elements OK — Phase 60 height=0 carry-forward).

### Task 2 — `SmartGuideOverlay` component (SNAP-06, SNAP-07, PERF-03)

`src/components/editor/smart-guide-overlay.tsx` (271 LOC). `forwardRef` + `useImperativeHandle` exposes `updateGuides(SmartGuideUpdate)` + `clear()`. NO state, NO setState — direct DOM mutation only.

- Persistent pool: 8 X-line slots + 8 Y-line slots + 8 equal-spacing slots.
- updateGuides walks each pool, sets `display: 'block'` + `transform: translate3d(Xpx, Ypx, 0)` for visible slots, `display: 'none'` for unused.
- Equal-spacing slots use absolute positioning + `color`/`backgroundColor` = `#FF00C7` (Figma signature pink).
- Root container: `position: absolute`, `inset: 0`, sized `1080×1920`, `pointer-events: none`, `zIndex: 60`.

10 tests pass — SG1-SG10 cover initial mount, hidden initial state, updateGuides flow, translate3d format, pink == indicator, PERF-03 (60 spam calls → 0 React renders), clear() behavior, pointer-events:none, 'use client' directive.

### Task 3 — slide-preview.tsx drag-handler integration

Replaces the legacy `useAlignmentGuides` consumption at all 4 Rnd sites (hook, body, custom_text, custom_image) with the snap-index + smart-guide flow.

**Refs added:**
- `snapIndexRef: SnapIndex | null` — built once on onDragStart, reused per onDrag tick, cleared on onDragStop.
- `wasSnappedXRef`, `wasSnappedYRef: number | null` — per-axis hysteresis state.
- `guideOverlayRef: SmartGuideOverlayHandle | null` — imperative handle into the overlay.

**Helper closures:**
- `runSnapForDrag(x, y, w, h)`:
  1. If `modifiers.get().cmd` → clear overlay + return input (SNAP-05).
  2. For each X-axis candidate (`x`, `x+w/2`, `x+w`) call `snapWithHysteresis` against `idx.xEdges`; pick smallest |delta|. Same for Y.
  3. Update wasSnappedX/YRef from `nextWasSnapped`.
  4. Build xLines + yLines from snapped edges; run `detectEqualSpacing` across slide elements; `guideOverlayRef.current.updateGuides(...)`.
  5. Return `{ x: x + bestX.delta, y: y + bestY.delta }`.
- `buildExcludeIds(draggedId)`: assembles `Set<string>` of co-moving ids from `shouldGroupDrag` (group case) or full selection (multi-select case).

**At each Rnd site:**
- onDragStart: `snapIndexRef.current = buildSnapIndex(slide, buildExcludeIds(id))`; reset hysteresis refs.
- onDrag: optional union-AABB query (when `selection.ids.length >= 2 && includes(id)` → `computeSelectionBounds` offset by drag delta as `(queryX, queryY, queryW, queryH)`); call `runSnapForDrag`; translate result back to this element's coords via `data.x - queryX` invariant.
- onDragStop: clear `snapIndexRef`, `wasSnappedX/YRef`, and `guideOverlayRef.current.clear()`.

**Mount & retirement:**
- `<SmartGuideOverlay ref={guideOverlayRef} />` mounted at line 2433 — downstream of the line-790 `editable=false` early return (TPLREND-05 / PARITY-01 structural gate).
- Legacy `{activeGuides.map(...)}` JSX removed.
- `useAlignmentGuides` import + `calculateSnap` / `clearGuides` references retired. File retained at `src/hooks/use-alignment-guides.ts` per CONTEXT D-09 (Phase 66 cleanup target).
- `buildOthersForSnap` helper removed (no consumer).

**Parity test extension** (PARITY-01 chrome-leak scan):
- `expect(html).not.toMatch(/data-testid="[^"]*smart-guide[^"]*"/)` — primary new gate.
- `expect(html).not.toMatch(/data-testid="[^"]*alignment-guide[^"]*"/)` — defensive guard against legacy DOM regressions.

12 tests pass — SP1 (onDragStart builds index + onDrag snaps to canvas-center), SP2 (multi-element drag excludes group members), SP3 (snap result writes back + overlay shows X-line), SP4 (Hold Cmd disables snap), SP5 (modifier resets on blur), SP6 (onDragStop clears state), SP7 + SP10 (overlay editor-only structural gate), SP8 (equal-spacing == indicator with 3 aligned elements), SP9 (useAlignmentGuides import retired), SP11 (60 onDrag calls → 0 React renders), SP12 (ungrouped multi-select drag works).

## Task Commits

1. **Task 1 RED** — `d1ad805` test(63-04/t1): RED failing tests for detectEqualSpacing pure helper
2. **Task 1 GREEN** — `abc8aed` feat(63-04/t1): GREEN detectEqualSpacing pure helper
3. **Task 2 RED** — `559e6c1` test(63-04/t2): RED failing tests for SmartGuideOverlay component
4. **Task 2 GREEN** — `19f7883` feat(63-04/t2): GREEN SmartGuideOverlay component
5. **Task 3 RED** — `d26be94` test(63-04/t3): RED failing tests for slide-preview smart-guide integration
6. **Task 3 GREEN** — `e418714` feat(63-04/t3): GREEN slide-preview smart-guide drag integration

_TDD cycle: each task pairs a `test(...)` RED commit with a `feat(...)` GREEN commit. No refactor commits — implementation was clean on first GREEN pass for all three tasks._

## Files Created/Modified

**Created (6):**
- `src/lib/editor/transforms/equal-spacing.ts` — Pure helper.
- `src/lib/editor/__tests__/equal-spacing.test.ts` — 11 tests (ES1-ES11).
- `src/components/editor/smart-guide-overlay.tsx` — Imperative-ref component.
- `src/components/editor/__tests__/smart-guide-overlay.test.tsx` — 10 tests (SG1-SG10).
- `src/components/slides/__tests__/slide-preview-smart-guides.test.tsx` — 12 tests (SP1-SP12).
- `.planning/phases/63-alignment-distribute-smart-guides/63-04-SUMMARY.md` — this file.

**Modified (2):**
- `src/components/slides/slide-preview.tsx` (+356, -119) — full integration.
- `src/lib/render/__tests__/parity.test.tsx` (+9) — PARITY-01 chrome-leak scan extended.

## Decisions Made

See `key-decisions` in frontmatter. The most consequential:

1. **Equal-spacing detection runs across ALL slide elements (not excluding the dragger).** This is a UX decision: the == indicator is decoration describing the canvas's visible equal-gap state. Including the dragger keeps the indicator stable as it moves into / out of alignment. Snap targets are a different concept and DO exclude the dragger.

2. **Multi-element drag uses computeSelectionBounds offset by drag delta as the query rect.** The snap result is then translated back to the dragged element's coords via the invariant `delta = data.x - queryX`. Single source of truth: the union AABB is queried once, not N times.

3. **Pool size 8 per axis is intentional overshoot.** Avoids dynamic mounting (which forces React reconciliation per render). 24 hidden divs cost is negligible; the predictable pool size makes the code branchless and the perf budget verified.

4. **runSnapForDrag computes best-of-3 candidate edges per axis.** Three candidates (left/center/right for X; top/center/bottom for Y) but ONE winning guide. Matches Figma's visual model exactly.

## Deviations from Plan

### Plan executed exactly as written.

Two minor adjustments noted:

1. **Test SP9 grep specificity**: The plan spec called for `grep -c "useAlignmentGuides" → 0`. My initial GREEN had two `useAlignmentGuides` literals in code COMMENTS (line 10 + line 2431). Reworded both comments to use "alignment-guides" (hyphen, no camelCase) to keep the grep gate strict. The behavioral contract is unchanged — only the comment wording.

2. **Parity test scan extension**: The plan's verification section asked for a smart-guide testid scan in PARITY-01. I added BOTH `smart-guide` and `alignment-guide` patterns (the latter is defensive — in case a future plan accidentally re-introduces the legacy DOM). +9 LOC, no behavioral surprise.

### Auth gates

None — pure UI/UX wiring plan, no I/O.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Threat register T-63-14..T-63-18 mitigations all hold:

- **T-63-14** (data.x mutation in onDrag): Documented react-rnd snap pattern; Plan 60-05 + Plan 62-03 already used the same pattern. SP3 + SP6 verify net correctness.
- **T-63-15** (smart-guide overlay leaking into Satori PNG): Mounted strictly inside editable={true} branch (line 2433 > 790). SP7 + SP10 + parity.test.tsx PARITY-01 chrome-leak scan pin.
- **T-63-16** (DoS — 60Hz allocations in onDrag): SP11 verifies 60 onDrag → 0 React renders; runSnapForDrag is stable-closure in `useCallback`. PERF-05 bench from Plan 63-03 already verified <2ms budget at N=30.
- **T-63-17** (Hold-Cmd permanent on blur): Plan 60-04 useModifierState resets on blur + visibilitychange. SP5 verifies via synthetic blur fixture.
- **T-63-18** (hysteresis state stuck on element delete during drag): onDragStop reset clears hysteresis; bounded blast radius. Accepted.

## Known Stubs

None — every visible chrome surface flows to actual DOM mutations or schema reads. The smart-guide overlay's slots are pre-rendered but display:none; updateGuides toggles them on. detectEqualSpacing returns concrete coords. runSnapForDrag returns the snap result for write-back into react-rnd's data object.

## Known Gaps (Carry-Forward)

- **Structural-anchor TextBox edges still skipped from snap index** — Phase 60-05 documented gap; height resolution requires DOM ref via the rendered-height observer pattern at slide-preview.tsx. Phase 64 lift target (alongside ALIGN-10 lock semantics + watermark size).
- **Watermark size still placeholder 18% × 5%** — mirrors Plan 63-01 selection-bounds extension. Phase 64 lifts when watermark gains real x/y/width/height schema fields.
- **`src/hooks/use-alignment-guides.ts` retained as dead code** — per CONTEXT D-09, legacy file is NOT deleted in Phase 63. Phase 66 cleanup target. The import is retired (grep count = 0 in slide-preview.tsx).
- **`buildOthersForSnap` helper retired without explicit deprecation marker** — was a `useCallback` inside slide-preview.tsx that built an array of TextBox shapes for the legacy `calculateSnap`. With Plan 63-04 it has no consumer; removed cleanly. Verified by grep + tsc baseline preservation.

## Seam Exposed for Plan 63-05 (PARITY-03 multi-element fixture extension)

- The smart-guide overlay testid `smart-guide-overlay-root` (and pool sub-testids `-x`, `-y`, `-equal`) is now part of the PARITY-01 chrome-leak regex blocklist. PARITY-03's multi-element fixtures can re-use these testids as absence assertions in the editable=false render branch.
- The `detectEqualSpacing` helper is reusable from any future surface (e.g., a layers-panel "equal spacing" indicator). The signature is axis-agnostic and pure.
- The `runSnapForDrag` closure pattern (build-once / query-per-tick / clear-on-stop) is the canonical model for any future drag-time chrome (rotation snap, cursor magnetism, etc.). Phase 65+ surfaces can mirror it.

## Self-Check: PASSED

**Files created exist:**
- `src/lib/editor/transforms/equal-spacing.ts` — FOUND
- `src/lib/editor/__tests__/equal-spacing.test.ts` — FOUND
- `src/components/editor/smart-guide-overlay.tsx` — FOUND
- `src/components/editor/__tests__/smart-guide-overlay.test.tsx` — FOUND
- `src/components/slides/__tests__/slide-preview-smart-guides.test.tsx` — FOUND

**Commits exist in git log:**
- `d1ad805` test(63-04/t1) RED — FOUND
- `abc8aed` feat(63-04/t1) GREEN — FOUND
- `559e6c1` test(63-04/t2) RED — FOUND
- `19f7883` feat(63-04/t2) GREEN — FOUND
- `d26be94` test(63-04/t3) RED — FOUND
- `e418714` feat(63-04/t3) GREEN — FOUND

**Verification grep gates:**
- `grep -c "useAlignmentGuides" src/components/slides/slide-preview.tsx` → 0 ✓ (legacy retired)
- `grep -c "buildSnapIndex" src/components/slides/slide-preview.tsx` → 6 ✓ (≥1 — 1 import + 4 onDragStart sites + 1 helper-closure ref)
- `grep -c "snapWithHysteresis" src/components/slides/slide-preview.tsx` → 4 ✓ (≥2 — 1 import + X-axis + Y-axis snap calls inside runSnapForDrag's loops; loops compile to 2 syntactic call sites)
- `grep -c "modifiers.get().cmd" src/components/slides/slide-preview.tsx` → 2 ✓ (≥1 — runSnapForDrag check + comment)
- `grep -c "SmartGuideOverlay" src/components/slides/slide-preview.tsx` → 6 ✓ (≥2 — import + type alias + ref decl + comments + JSX mount)
- `grep -c "guideOverlayRef" src/components/slides/slide-preview.tsx` → 10 ✓ (≥4 — ref decl + 4 onDragStop clears + onDrag updateGuides reference + Cmd-skip clear + JSX ref + comments)
- SmartGuideOverlay JSX line 2433 > 790 (editable=false early return) ✓ (structural gating)

**Test results:**
- `npx vitest run src/lib/editor/__tests__/equal-spacing.test.ts` → 11/11 pass
- `npx vitest run src/components/editor/__tests__/smart-guide-overlay.test.tsx` → 10/10 pass
- `npx vitest run src/components/slides/__tests__/slide-preview-smart-guides.test.tsx` → 12/12 pass
- `npx vitest run src/components/slides/ src/components/editor/ src/lib/editor/ src/lib/render/` → 727/727 pass (all in-scope regression green; +33 vs Plan 63-03's 694 baseline)
- `npx tsc --noEmit -p tsconfig.json` → 17 errors (baseline preserved)

## TDD Gate Compliance

Plan 63-04 is `type: execute` (not plan-level `type: tdd`), but each task has `tdd="true"`. Gate sequence verified in git log for all 3 tasks:

1. Task 1 — RED: `d1ad805` `test(63-04/t1): ...` → GREEN: `abc8aed` `feat(63-04/t1): ...`
2. Task 2 — RED: `559e6c1` `test(63-04/t2): ...` → GREEN: `19f7883` `feat(63-04/t2): ...`
3. Task 3 — RED: `d26be94` `test(63-04/t3): ...` → GREEN: `e418714` `feat(63-04/t3): ...`

No REFACTOR commits — implementation was clean on first GREEN pass for all three tasks.

## User Setup Required

None — no external services, environment configuration, or auth credentials required.

---
*Phase: 63-alignment-distribute-smart-guides*
*Completed: 2026-05-02*

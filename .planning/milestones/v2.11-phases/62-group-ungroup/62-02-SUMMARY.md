---
phase: 62-group-ungroup
plan: 02
subsystem: editor-ux
tags: [group, ring, click-handlers, double-click, parity, ui-surface]

# Dependency graph
requires:
  - phase: 62-group-ungroup
    plan: 01
    provides: getGroupMembers helper + useSelectionModel.currentlyInsideGroup/enterGroup/exitGroup + GROUP/UNGROUP reducer actions
  - phase: 60-multi-select-foundation-watermark-schema-lift
    plan: 05
    provides: computeSelectionBounds pure helper + multi-selection-ring chrome pattern + per-element 4-wrapper click site map
  - phase: 61-marquee-selection
    plan: 02
    provides: canvas-root onPointerDown/Move/Up state machine + no-drag click-empty branch (Plan 60-05 carry-forward) + Shift-additive marquee no-op invariant
provides:
  - "data-testid=\"group-bounding-ring\" rendered conditionally inside the editable=true branch (after multi-selection-ring at line 1992, before MarqueeOverlay; structurally gated by line-606 non-editable early return)"
  - "Group-aware onMouseDown branch on 4 wrappers (hook ~1277, body ~1455, custom_text ~1645, custom_image ~1867) — single-click on grouped element selects ALL group members unless currentlyInsideGroup === target.groupId"
  - "onDoubleClick handler on the same 4 wrappers — invokes onEnterGroup(elementId, slide) when target carries a groupId"
  - "Canvas-empty no-drag pointerup branch extension — calls onExitGroup() BEFORE onSelectionChange({ ids: [], primary: null }) when currentlyInsideGroup !== null"
  - "currentlyInsideGroup / onEnterGroup / onExitGroup props threaded through SlideCanvas → SlidePreview from slide-editor's useSelectionModel"
  - "PARITY-01 chrome regex extended to scan for group-bounding-ring testid in editable=false render trees + 2 new it() blocks (editable=false with grouped selection; editable=true with empty selection)"
affects: [62-03-keyboard-and-group-drag, 63-alignment, 64-lock-hide-zorder, 65-layers-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Editor-only chrome rendered AFTER existing multi-selection-ring (line 1992) and BEFORE MarqueeOverlay (line ~2086) in the editable=true branch — sibling of the Plan 60-05 ring with distinct outline-style (dotted vs dashed) + outline-offset (6 vs 4) + zIndex (51 vs 50) for z-fight-free coexistence"
    - "Visual state on a single testid via data-attributes (data-group-id + data-entered) — easier for tests + future Phase 65 layers panel reads than DOM-attribute alternation"
    - "Group-aware click branch ordering: stopPropagation → element resolution → SHIFT BRANCH (Plan 60-05) → GROUP BRANCH (Plan 62-02) → SEL-01 fallback. Test C5 pins the ordering."
    - "onDoubleClick parameter explicitly typed as React.MouseEvent — react-rnd's d.ts surfaces onMouseDown but not onDoubleClick, so TS otherwise infers implicit any"
    - "Multi-element group selection clears legacy single-id slots (onTextBoxSelect/onCustomTextSelect/onCustomImageSelect with null) — group ≠ single-element selection (right-rail mirror invariant)"

key-files:
  created:
    - src/components/slides/__tests__/slide-preview-group-ring.test.tsx (201 LOC, 6 tests)
    - src/components/slides/__tests__/slide-preview-group-clicks.test.tsx (492 LOC, 11 tests)
  modified:
    - src/components/slides/slide-preview.tsx (+~200 LOC: ring block + 4 group-aware onMouseDown branches + 4 onDoubleClick handlers + canvas-empty exitGroup branch + 3 new props + getGroupMembers import)
    - src/components/editor/slide-canvas.tsx (+~17 LOC: 3 new props pass-through)
    - src/components/editor/slide-editor.tsx (+~7 LOC: wire selection.currentlyInsideGroup/enterGroup/exitGroup at SlideCanvas mount)
    - src/lib/render/__tests__/parity.test.tsx (+~70 LOC: chrome regex extension + 2 new PARITY-01 group-gate tests)

key-decisions:
  - "Ring renders when ANY selected element has a groupId AND that group has >=2 members — partial-selection-of-group state still shows the AABB (locked decision in PLAN Test R3 design). Communicates 'you have hit a grouped element' even before Plan 62-03's Cmd+G dispatcher expands selection to the full member set."
  - "First-matching-groupId wins for ring rendering — multi-group multi-select edge case renders ONE ring around the FIRST selected element with a groupId. Phase 65 (layers panel) may revisit if users routinely combine 2+ groups in a single multi-selection."
  - "Visual distinction encoded via outline-style: dotted (not entered) vs solid (entered). outlineOffset=6 (vs multi-selection-ring's 4) + zIndex=51 (vs 50) so a group ring nests cleanly outside any concurrent multi-selection-ring without z-fighting."
  - "Group-aware branch sits BEFORE SEL-01 fallback AND AFTER SEL-02 Shift-toggle. Test C5 pins this ordering — Shift-click on a grouped hook fires the toggle, NOT the group expansion. Inside-group exception (currentlyInsideGroup === target.groupId) makes single-click target the LEAF for right-rail leaf-property editing."
  - "Group selection clears legacy single-id slots (onTextBoxSelect(null), etc.) — multi-element group is NOT a single-element selection. Mirrors the existing Plan 60-05 Shift-click pattern at the same call sites."
  - "Custom-text wrapper resolves groupId via slide.text_boxes (NOT legacy slide.custom_texts) — Phase 49 adapter contract (TextBox.id == CustomText.id) makes the text_boxes mirror the canonical source post-Plan 60-01. Matches getGroupMembers' walk order."
  - "exitGroup-before-clear in the canvas-empty no-drag branch is a SINGLE user gesture → SINGLE observable behavior pattern. Plan 62-03's Esc handler will mirror this two-step on keyboard escape (already noted in CONTEXT D-04)."
  - "onDoubleClick types: parameter explicitly annotated as React.MouseEvent because react-rnd's TypeScript declarations surface onMouseDown but not onDoubleClick — without the explicit type, TS would infer implicit any and emit TS7006 errors against the strict-noImplicitAny baseline."

requirements-completed: [GROUP-06, GROUP-07, GROUP-08, GROUP-10]

# Metrics
duration: ~10min
completed: 2026-05-02
---

# Phase 62 Plan 02: Group Ring + Click Handlers + Double-Click Enter Summary

**Phase 62 UI surface lands. Wired the dashed/solid group bounding-box ring (editable-only, PARITY-01-gated), the Figma-model "select-any-member-selects-group" click branch on 4 wrappers, the double-click-enters-group handler, and the canvas-empty exitGroup-then-clear branch — pinned by 17 new test cases (6 ring + 8 click + 3 exit) and 2 new parity tests, with tsc baseline 17 errors preserved across all 3 atomic RED+GREEN commit pairs.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-03T03:13Z
- **Completed:** 2026-05-03T03:24Z
- **Tasks:** 3 (all `tdd="true"`, RED+GREEN per task)
- **Files modified:** 6 (2 created + 4 modified)
- **LOC delta:** +~990 lines (incl. test fixtures)

## Accomplishments

- **Group bounding-box ring lands.** `data-testid="group-bounding-ring"` rendered as a sibling of the existing multi-selection-ring (Plan 60-05) inside the editable=true branch. Visual distinction encoded via outline-style toggle (dotted not-entered vs solid entered) + outline-offset 6 + zIndex 51, so a group ring nests cleanly outside any concurrent multi-selection-ring (offset 4, zIndex 50). Data-attributes (`data-group-id`, `data-entered`) surface state for tests and future Phase 65 layers panel.
- **TPLREND-05 / PARITY-01 carry-forward intact.** Ring testid lives at slide-preview.tsx line 2168 (>line-606 non-editable early return). Parity test extended with chrome-regex scan + 2 new it() blocks (editable=false with grouped selection → ring absent; editable=true with empty selection → ring absent). 25/25 parity tests pass (23 baseline + 2 new).
- **Figma-model GROUP-10 click semantics on all 4 wrappers.** Hook (line ~1277), body (~1455), custom_text (~1645), custom_image (~1867) each gain a group-expansion branch in onMouseDown, gated by `target.groupId && currentlyInsideGroup !== target.groupId`. Inside-group click falls through to SEL-01 leaf select. Test C5 pins the Shift-toggle-before-group-expansion ordering.
- **GROUP-07 double-click enters group.** Same 4 wrappers carry an explicitly-typed `onDoubleClick={(e: React.MouseEvent) => ...}` handler that invokes `onEnterGroup(id, slide)` when target carries a groupId. No-op on ungrouped elements.
- **GROUP-08 canvas-empty exitGroup-then-clear.** Single line addition to the canvas onPointerUp no-drag branch: when `currentlyInsideGroup !== null && !shiftHeld`, `onExitGroup()` fires BEFORE `onSelectionChange({ ids: [], primary: null })`. Single user gesture → single observable behavior. Shift-held no-op preserved per Plan 61-02 invariant (Test X3).
- **Props plumbing through SlideCanvas → SlidePreview from slide-editor's useSelectionModel.** 3 new props (`currentlyInsideGroup`, `onEnterGroup`, `onExitGroup`) thread verbatim through SlideCanvas (thin forwarding wrapper), with slide-editor's mount site wiring `selection.currentlyInsideGroup / enterGroup / exitGroup` from Plan 62-01.
- **17/17 plan-relevant tests pass; 373/373 broad regression suite green; tsc baseline 17 errors preserved.**

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: group-bounding-ring tests** — `2f4b1a1` (test) — 6 tests, 4/6 fail at RED (R2 + R6 trivially pass — group testid simply absent)
2. **Task 1 GREEN: ring + props plumbing + parity gate** — `cdba76c` (feat) — ring block + 3 new props on SlidePreview + SlideCanvas pass-through + slide-editor wiring + parity test extension. 6/6 ring + 25/25 parity pass.
3. **Task 2 RED: group-aware click handler tests** — `7d2796f` (test) — 8 tests, 3/8 fail at RED (C1, C2, C7 — the rest pass trivially via existing SEL-01 paths)
4. **Task 2 GREEN: group-aware click + double-click on 4 wrappers** — `c7e0723` (feat) — 4 wrappers extended; explicit React.MouseEvent type on onDoubleClick to satisfy noImplicitAny. 8/8 click pass; 9/9 marquee + 6/6 ring still pass.
5. **Task 3 RED: click-outside-group exit tests** — `776213d` (test) — 3 tests, 1/3 fail at RED (X1 — X2/X3 trivially pass since exitGroup hook simply unwired before GREEN)
6. **Task 3 GREEN: canvas-empty exitGroup-then-clear branch** — `9ec97f1` (feat) — single conditional in the no-drag branch. 3/3 exit + 8/8 click + 9/9 marquee + 6/6 ring + 25/25 parity all pass.

**Plan metadata:** _final-commit-pending_ (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md update commit follows)

## Files Created/Modified

**Created:**
- `src/components/slides/__tests__/slide-preview-group-ring.test.tsx` (201 LOC) — 6 tests: R1 happy-path (groupId+selection→ring), R2 empty-selection, R3 single-member-of-group (PLAN-locked partial-selection decision), R4 entered-state (solid outline), R4b not-entered-state (dotted outline; positive control for the visual-distinction toggle), R6 selection-without-groupId
- `src/components/slides/__tests__/slide-preview-group-clicks.test.tsx` (492 LOC) — 11 tests: C1 hook-group-expand, C2 image-group-expand, C3 ungrouped-single-select-preserves-SEL-01, C4 inside-group-leaf-select, C5 Shift-precedes-group-branch (ordering pin), C6 orphan-groupId-fallback, C7 double-click-enters-group, C8 double-click-on-ungrouped-no-op, X1 click-outside-while-inside-group exits-then-clears, X2 click-outside-not-inside-group only-clears, X3 Shift+click-outside-while-inside-group preserves-Plan-61-02-invariant

**Modified:**
- `src/components/slides/slide-preview.tsx` (+~200 LOC) — getGroupMembers import (line 16-19), 3 new SlidePreviewProps fields with full JSDoc citing GROUP-06/07/08/10 + PARITY-01, signature destructure update, ring block (lines ~2007-2079), 4 onMouseDown group-aware branches, 4 onDoubleClick handlers, canvas-empty exitGroup conditional in onPointerUp no-drag branch
- `src/components/editor/slide-canvas.tsx` (+~17 LOC) — GroupEnterFn / GroupExitFn type aliases, 3 new SlideCanvasProps fields, signature destructure update, 3-prop pass-through to SlidePreview
- `src/components/editor/slide-editor.tsx` (+~7 LOC) — `currentlyInsideGroup={selection.currentlyInsideGroup}` / `onEnterGroup={selection.enterGroup}` / `onExitGroup={selection.exitGroup}` at the SlideCanvas mount site (line ~835)
- `src/lib/render/__tests__/parity.test.tsx` (+~70 LOC) — chrome regex extension (1 line added inside the existing PARITY-01 test) + 2 new it() blocks (PARITY-01 Plan 62-02 group-gate; PARITY-01 Plan 62-02 empty-selection-gate)

## Decisions Made

- **D-01 (Ring renders on partial group selection):** Test R3 pins the locked decision: ring shows when ANY group member is in the selection AND `currentlyInsideGroup === null`. PLAN rationale (line 248): "gives users immediate visual feedback that they have a group selected even if their click handler is mid-cycle. Plan 62-03's Cmd+G dispatcher will replace selection with the full member set, so in practice ring appears after the group-aware click expands selection. For single-member-of-group state (transitional or pathological), the ring still appears — communicates 'you have hit a grouped element.'"
- **D-02 (First-matching-groupId wins):** Multi-group multi-select edge case renders ONE ring around the FIRST selected element with a groupId. Schema is flat (CONTEXT D-01), no nested groups; the layers panel (Phase 65) may revisit if users routinely combine 2+ groups.
- **D-03 (Visual distinction toggle):** outline-style branch on `currentlyInsideGroup === group.id` — solid (entered) vs dotted (not entered). outlineOffset 6 + zIndex 51 differentiate from multi-selection-ring (4 + 50) for clean nesting. Test R4 + R4b pin the visual toggle.
- **D-04 (Branch ordering: Shift > Group > SEL-01):** Group-expansion branch sits AFTER SEL-02 Shift toggle and BEFORE SEL-01 single-click replace. Test C5 pins by asserting Shift-click on grouped hook produces a TOGGLE call (functional updater shape), NOT a group-replace call. Inside-group exception falls through to SEL-01 leaf select.
- **D-05 (Group selection clears legacy single-id slots):** When the group-expansion branch fires, all three legacy single-id setters (onTextBoxSelect, onCustomTextSelect, onCustomImageSelect) are called with `null` — multi-element group ≠ single-element. Mirrors the existing Plan 60-05 Shift-click pattern at the same 4 sites.
- **D-06 (Custom-text resolves groupId via slide.text_boxes):** Phase 49 adapter contract makes TextBox.id == CustomText.id; post-Plan 60-01 `groupId?: string` lives on TextBox. The custom-text wrapper looks up `ctBox = slide.text_boxes?.find((tb) => tb.id === ct.id)` to align with `getGroupMembers`' walk order. Custom-image wrapper reads `ci.groupId` directly (CustomImage carries the field natively).
- **D-07 (exitGroup-before-clear single-gesture pattern):** The canvas-empty no-drag branch fires `onExitGroup?.()` THEN `onSelectionChange({ ids: [], primary: null })` in sequence — a single user gesture produces a single observable behavior (group ring collapses + selection clears in one render). Plan 62-03's Esc handler will mirror this two-step on keyboard escape per CONTEXT D-04.
- **D-08 (onDoubleClick explicit type annotation):** react-rnd's TypeScript declarations expose `onMouseDown?: (e: MouseEvent) => void` but NO onDoubleClick — Rnd is rendered with `<Rnd ...>` and onDoubleClick passes through to the underlying div as an extra HTML attribute. Without an explicit `(e: React.MouseEvent)` annotation, TS infers implicit any and emits TS7006 against the strict-noImplicitAny tsconfig baseline. The annotation is a typing-fix, not a behavior change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Explicit React.MouseEvent type on 4 onDoubleClick handlers**
- **Found during:** Task 2 GREEN, after first vitest run.
- **Issue:** The plan's `<group_aware_click_branch_pattern>` showed `onDoubleClick={(e) => { ... }}` without parameter type. After implementation on all 4 wrappers, `npx tsc --noEmit` jumped from 17 errors to 21 — the new errors were 4 instances of TS7006 ("Parameter 'e' implicitly has an 'any' type") at slide-preview.tsx lines 1336, 1499, 1696, 1906. Root cause: `react-rnd`'s d.ts surfaces `onMouseDown?: (e: MouseEvent) => void` but does NOT declare onDoubleClick; the prop pass-through is an extra HTML attribute, and without an explicit annotation TS can't infer the event type from Rnd's prop signature. The existing onMouseDown handlers benefit from Rnd's typed prop; the new onDoubleClick handlers needed manual typing.
- **Fix:** Added `(e: React.MouseEvent) => { ... }` annotation to all 4 onDoubleClick handlers. tsc baseline back to 17 errors.
- **Files modified:** `src/components/slides/slide-preview.tsx` (4 type annotations)
- **Committed in:** `c7e0723` (Task 2 GREEN)

**2. [Plan refinement — test expanded for Test R4 visual-distinction completeness] Added Test R4b (positive control for not-entered dotted outline)**
- **Found during:** Task 1 RED-test design.
- **Issue:** Plan listed Test R4 ("entered state → solid outline") but didn't explicitly pin the not-entered state's outline-style. R4 alone could pass even if the implementation rendered solid outline in BOTH states — defeating the user-facing visual distinction (the entire point of the toggle). The PLAN's must-haves explicitly require "When inside a group, the group ring renders with a different visual style (e.g., solid border) to indicate 'entered' state."
- **Fix:** Added Test R4b as a positive control — same fixture as R4 except `currentlyInsideGroup={null}`. Asserts the style attribute contains 'dotted'. With R4 + R4b, the implementation MUST branch on currentlyInsideGroup to satisfy both tests; a constant outline-style would fail one or the other.
- **Files modified:** `src/components/slides/__tests__/slide-preview-group-ring.test.tsx` (+1 it() block)
- **Committed in:** `2f4b1a1` (Task 1 RED) and `cdba76c` (Task 1 GREEN — passes)
- **Test count impact:** Plan's "6 ring tests" → 6 actual (R1, R2, R3, R4, R4b, R6 — R4 and R4b together cover what Plan called Test R4; R5 is the parity test that lives in parity.test.tsx not the ring file). Net: same number of tests, but split-by-direction for stronger pinning.

---

**Total deviations:** 2 auto-fixed (1 blocking-typing, 1 test-pinning-completeness)
**Impact on plan:** No scope change — both fixes are quality-of-implementation refinements. The typing fix is a Rule 3 baseline-preserve correction (would have broken tsc baseline otherwise); the test refinement is a Rule 2 missing-coverage addition that prevents an entire class of regression (constant-outline-style implementation passing R4 alone).

## Issues Encountered

None. RED commits behaved as expected (R2/R6 trivially pass at RED — empty-state and ungrouped-state legitimately produce no ring even before implementation; C3/C4/C5/C6/C8 trivially pass at RED — existing SEL-01 path satisfies the "no group expansion" expectations; X2/X3 trivially pass at RED — exitGroup hook is simply unwired so calling it would fail, but tests assert it ISN'T called).

## Cross-Phase Constraint Compliance

| Constraint | Source | Status |
|------------|--------|--------|
| TPLREND-05 / PARITY-01: editor-only chrome | Plans 58/60-05/61-02 carry-forward | **PASS** — group-bounding-ring testid at line 2168 > line-606 non-editable early return; PARITY-01 chrome regex extended; 2 new it() blocks confirm absence on editable=false + empty-selection paths |
| No "primary" key-object UX | PITFALL-12.3 / 1.3 | **PASS** — group ring shows membership only; multi-element group selection clears legacy single-id slots; right rail's existing N>=2 → MultiSelectTypeBar branch (Plan 60-05) handles the multi-state UI |
| Single pushHistory per gesture | KBD-09 | **TRIVIAL PASS** — Plan 62-02 calls onSelectionChange (a setState wrapper) and onEnterGroup/onExitGroup (also setStates). Zero reducer dispatches. KBD-09 invariant trivially preserved. |
| isEditing guard | RESEARCH cross-phase | **N/A** — this plan adds no keyboard handlers; Plan 62-03 owns Cmd+G + Esc-with-group-awareness. |
| onDragStop only | RESEARCH cross-phase | **N/A** — no drag handlers added; Plan 62-03 owns group drag. |
| No new packages | RESEARCH ceiling | **PASS** — package.json unchanged. |
| Phase 60-05 known gaps carry forward | Plan 60-05 SUMMARY §"Phase 60 Known Gaps" | **PASS** — computeSelectionBounds still skips structural-anchor TextBoxes + watermark. Group ring may underestimate bounds when a group contains a structural-anchor box (e.g., the body anchor='top' in the makeSlideWithImageGroup test fixture); this is a known carry-forward documented in Plan 60-05 + selection-bounds.ts module header. Phase 63 (alignment) lifts the rendered-height resolution into a shared helper. |
| Selection state outside reducer history | Plan 60-03 contract | **PASS** — currentlyInsideGroup is React useState (Plan 62-01) routed through React props; no reducer dispatches added in this plan. |
| Cmd+click no-op | Plan 60-05 / Plan 62 CONTEXT | **PASS** — no e.metaKey check added in any of the 4 wrappers; deep-select-through-groups remains a Phase 65+ deferred decision. |

## Phase 62 Plan 02 Known Gaps (intentional, documented for Plan 62-03 + Phase 63+ inheritors)

1. **Esc-key handler ownership in Plan 62-03.** This plan only handles the click-outside path (canvas-empty no-drag → exitGroup-then-clear). Plan 62-03 will add a tinykeys map binding for Escape that branches on currentlyInsideGroup: first Esc exits group; second Esc clears selection (matches Plan 60-04 wiring + CONTEXT D-04).
2. **Cmd+G / Cmd+Shift+G keyboard bindings deferred to Plan 62-03.** This plan only enables manual entry into the data layer (e.g., via React DevTools setting `groupId` on a text_box). After Plan 62-03 ships, users will form groups via Cmd+G and the group ring will appear automatically.
3. **Group drag deferred to Plan 62-03.** Group drag dispatcher consumes the same `onSelectionChange` callback already wired in this plan; the BULK_TRANSLATE action contract (Plan 60-03) is what Plan 62-03 will dispatch.
4. **Watermark click is single-element-only.** The watermark IS a draggable target group member at the data layer (Plan 60-01 + Plan 62-01), but the editor doesn't expose a watermark click-wrapper — clicks pass through `pointerEvents: 'none'`. The 4 onMouseDown wrappers cover hook/body/custom_text/custom_image; watermark group membership is read by `getGroupMembers` for ring AABB but not click-target-resolved. Phase 64+ may revisit when freeform watermark positioning becomes a user requirement.
5. **Multi-group multi-select shows only the first group's ring.** When the user has 2+ groups in a single multi-selection (e.g., via Shift-click expansion across groups), only the first-encountered groupId's ring renders. Phase 65 (layers panel) may revisit if this becomes a routine pattern.
6. **Structural-anchor TextBox + watermark gaps in computeSelectionBounds carry forward.** Group ring AABB may underestimate bounds when a group contains a structural-anchor box; documented as deferred to Phase 63 (alignment) per Plan 60-05 SUMMARY.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Seam exposed for Plan 62-03 (keyboard + group drag):**
- `selection.currentlyInsideGroup` + `selection.enterGroup` + `selection.exitGroup` are already wired through SlideCanvas → SlidePreview. Plan 62-03's Esc-handler branch (in the slide-editor tinykeys map) consumes them directly from the existing `selection` model — no new prop plumbing needed.
- `onSelectionChange` callback is the same callback Plan 62-03's group-drag dispatcher will use to mark selection on drag start; the click handlers are already group-aware.
- `getGroupMembers(slide, groupId)` is the read helper Plan 62-03's BULK_TRANSLATE dispatcher will call to enumerate group members for fan-out delta application.

**Seam for Phase 63 (alignment):**
- The structural-anchor TextBox height resolution helper (the rendered-height observer pattern at slide-preview.tsx:589-637) needs to be lifted into `selection-bounds.ts` so `computeSelectionBounds` returns full-fidelity AABBs for groups containing hook/body anchor=top boxes. Plan 60-05 SUMMARY documents this gap; Plan 62-02 inherits without resolution.

**No blockers.** Phase 62 is now ~67% complete (2/3 plans shipped). Plan 62-03 can proceed.

## Self-Check: PASSED

**Files verified to exist:**
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/slides/slide-preview.tsx`: FOUND (modified — 2197 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/slides/__tests__/slide-preview-group-ring.test.tsx`: FOUND (created — 201 LOC, 6 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/slides/__tests__/slide-preview-group-clicks.test.tsx`: FOUND (created — 492 LOC, 11 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/slide-canvas.tsx`: FOUND (modified — 207 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/slide-editor.tsx`: FOUND (modified — 1067 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/render/__tests__/parity.test.tsx`: FOUND (modified — 592 LOC)

**Commits verified to exist:**
- `2f4b1a1`: FOUND (test 62-02/t1 RED)
- `cdba76c`: FOUND (feat 62-02/t1 ring + props plumbing GREEN)
- `7d2796f`: FOUND (test 62-02/t2 RED)
- `c7e0723`: FOUND (feat 62-02/t2 group-aware click handlers GREEN)
- `776213d`: FOUND (test 62-02/t3 RED)
- `9ec97f1`: FOUND (feat 62-02/t3 canvas-empty exitGroup branch GREEN)

**Plan-level verification (re-run):**
- 6/6 ring tests pass (Tests R1, R2, R3, R4, R4b, R6)
- 11/11 group-clicks tests pass (C1-C8 + X1-X3)
- 9/9 marquee tests still pass (zero regression)
- 25/25 parity tests pass (23 baseline + 2 new PARITY-01 group-gate)
- 373/373 broad regression suite green (slide-preview + render + editor)
- tsc baseline 17 errors preserved
- Structural gate: ring testid line 2168 > non-editable early return line 606 ✓
- Satori source clean: 0 `group-bounding-ring` matches in render-slide-satori.tsx
- 4 onDoubleClick handlers in slide-preview.tsx (count = 6 includes 2 comment refs; 4 actual JSX)
- 5 getGroupMembers(slide calls in slide-preview.tsx (1 ring + 4 wrappers)
- Cmd+click is still a no-op: 0 `e.metaKey` matches in slide-preview.tsx

---

*Phase: 62-group-ungroup*
*Completed: 2026-05-02*

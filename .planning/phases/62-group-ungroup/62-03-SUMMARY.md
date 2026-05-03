---
phase: 62-group-ungroup
plan: 03
subsystem: editor-keyboard-and-drag
tags: [group, keyboard, tinykeys, group-drag, bulk-translate, esc-group-aware, integration, parity]

# Dependency graph
requires:
  - phase: 62-group-ungroup
    plan: 01
    provides: GROUP/UNGROUP reducer cases; getGroupMembers helper; useSelectionModel.currentlyInsideGroup/enterGroup/exitGroup
  - phase: 62-group-ungroup
    plan: 02
    provides: group-bounding-ring rendered in editable=true; group-aware onMouseDown branches; canvas-empty exitGroup branch; SlidePreview/SlideCanvas group-state props plumbed
  - phase: 60-multi-select-foundation-watermark-schema-lift
    plan: 03
    provides: BULK_TRANSLATE action shape; selection-state-outside-history contract; locked/structural-anchor/watermark skip rules in reducer
  - phase: 60-multi-select-foundation-watermark-schema-lift
    plan: 04
    provides: tinykeys map at slide-editor.tsx; isEditingTarget firewall (KBD-02); $mod+a / Escape bindings extended in this plan
provides:
  - shouldGroupDrag(slide, selection, currentlyInsideGroup, draggedElementId): string[] | null pure helper
  - "$mod+g binding (Cmd+G): GROUP dispatch with groupId=g_${slideIndex}_${b36}; preventDefault on N<=1 + N>=2 paths (Chrome Find Next suppression)"
  - "$mod+Shift+g binding (Cmd+Shift+G): UNGROUP dispatch with UNION of all groupIds in selection; no preventDefault on no-op path"
  - "Group-aware Escape: first press exits group when currentlyInsideGroup !== null; otherwise clears selection (Plan 60-04 SEL-08 carry-forward)"
  - "Group-drag onDragStop: 4 site dispatch (hook + body + custom_text + custom_image) firing onGroupDrag → BULK_TRANSLATE in a single call when selection equals group's full member set"
  - "onGroupDrag prop on SlidePreview + SlideCanvas + slide-editor wiring to dispatch({ type: 'BULK_TRANSLATE', ...payload })"
  - "PG1 reducer test pinning lossless GROUP → BULK_TRANSLATE → UNGROUP round-trip"
  - "RT1 + RT2 parity tests pinning no groupId leak in Satori render path"
affects: [63-alignment, 64-lock-hide-zorder, 65-layers-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure transform helper extension (shouldGroupDrag) at src/lib/editor/transforms/group-membership.ts — fifth pure helper, mirrors set-equality pattern from selection-bounds + axis-constrain"
    - "Group-drag-detect-and-fan-out invariant on 4 onDragStop sites: shouldGroupDrag → onGroupDrag → early return BEFORE per-element callback (single pushHistory per gesture, KBD-09 / PERF-01)"
    - "Drag-start-ref read-then-clear pattern carried forward from Plan 61-02 (KBD-07 axis-constrain) — consumed exactly once per gesture for delta computation"
    - "tinykeys binding addition pattern: append to existing map; preventDefault AFTER guard returns false; isEditingTarget firewall as first line"
    - "Group-aware Esc replacement: branch on selection.currentlyInsideGroup; first press exits, second press clears (mirrors Plan 62-02 click-outside two-state)"
    - "react-rnd test mock — thin div wrapper that stashes onDragStop/onDragStart callbacks on a registry keyed by per-render data-rnd-key, enabling synthetic drag-stop firing without actual mouse-pointer simulation"

key-files:
  created:
    - src/components/slides/__tests__/slide-preview-group-drag.test.tsx (359 LOC, 4 tests)
  modified:
    - src/components/editor/slide-editor.tsx (+91 LOC: imports getGroupMembers + 2 new tinykeys bindings + replaced Escape + onGroupDrag wiring at SlideCanvas mount + JSDoc)
    - src/lib/editor/transforms/group-membership.ts (+61 LOC: shouldGroupDrag pure function with cross-type element resolution + set-equality check)
    - src/components/slides/slide-preview.tsx (+103 LOC: shouldGroupDrag import + onGroupDrag prop on interface + signature destructure + 4 onDragStop branches)
    - src/components/editor/slide-canvas.tsx (+12 LOC: onGroupDrag prop + signature destructure + pass-through)
    - src/components/editor/__tests__/slide-editor.shortcuts.test.tsx (+316 LOC: 8 new tests covering Cmd+G / Cmd+Shift+G / Esc-with-group + probe extensions on TextEditorPanel/SlideCanvas mocks)
    - src/lib/editor/__tests__/group-membership.test.ts (+125 LOC: 7 new shouldGroupDrag tests SGD1-SGD7)
    - src/lib/editor/__tests__/editor-reducer.test.ts (+104 LOC: Test PG1 round-trip GROUP → BULK_TRANSLATE → UNGROUP)
    - src/lib/render/__tests__/parity.test.tsx (+136 LOC: editorReducer import + Tests RT1/RT2 parity invariants)

key-decisions:
  - "groupId construction at dispatch site (Plan 62-01 D-01 honored): `g_${selectedIndex}_${Date.now().toString(36)}` — nanoid still NOT a dep; reducer treats action.groupId as opaque"
  - "Cmd+G calls preventDefault on BOTH N<=1 and N>=2 paths (PITFALL-9.3): Chrome's Find Next dialog must NEVER pop while our handler is in scope, even when our action is a no-op. The reducer is unaffected — N<=1 returns state-ref-equal per Plan 62-01 G2/G3 invariants."
  - "Cmd+Shift+G no-op path returns BEFORE preventDefault (intentional asymmetry): when no selected element carries a groupId, our handler does NOT claim the binding — Chrome's Find Previous (which is also Cmd+Shift+G) keeps working as a fallthrough. Symmetric to Plan 62-01 reducer's UNGROUP-no-op state-ref-equal behavior."
  - "Cmd+Shift+G UNION expansion: walks distinct groupIds among selection, then unions every groupId's full member set. Partial-group selections still ungroup the whole group — matches Plan 62-01 reducer Test U2 contract (un-listed members of a partial group are NOT cleared on UNGROUP, but the dispatch ids list is full set so reducer does see all members)."
  - "Group-aware Esc replaces — does not extend — the existing Escape binding. The branch on selection.currentlyInsideGroup runs BEFORE the clear, so first-press-inside-group is purely exitGroup with NO selection mutation. Mirrors Plan 62-02's canvas-empty exitGroup-then-clear two-step pattern (single user gesture → single observable behavior)."
  - "shouldGroupDrag uses STRICT set-equality (no subset, no superset) for selection-vs-group-membership. Subset → null (user's explicit subset is honored); superset → null (drag would fan-out a delta to non-members, violating GROUP-09 'group selection IS group drag' invariant). Tests SGD3 + SGD4 pin both directions."
  - "All 4 onDragStop sites dispatch the same onGroupDrag shape — even hook + body which are structural-anchor TextBoxes. The reducer's BULK_TRANSLATE skips structural-anchor (Plan 60-03 contract carry-forward) so the hook's drag delta produces a no-op for the hook itself but moves grouped sibling elements; matches PITFALL-3.5 expectation."
  - "react-rnd test mock pattern: previous group-clicks tests use the real react-rnd component and fire onMouseDown via DOM events (which works because Rnd forwards onMouseDown to the underlying div). onDragStop has no DOM-event analog, so this plan's test file mocks react-rnd entirely. Scoped via vi.mock to a single test file — does not affect group-clicks/group-ring/marquee/parity test files which keep using the real component."
  - "RT2 byte-identity assertion is innerHTML-equality, not snapshot — innerHTML is what the React reconciler ultimately renders, byte-identical innerHTML across renders proves the schema mutation never reached any DOM-bound projection. Stronger than testid-presence checks for the exhaustive 'no leaked attribute anywhere' invariant."

requirements-completed: [GROUP-02, GROUP-03, GROUP-04, GROUP-05, GROUP-08, GROUP-09, KBD-09]

# Metrics
duration: ~13min
completed: 2026-05-03
---

# Phase 62 Plan 03: Cmd+G / Cmd+Shift+G + Group-Aware Esc + Group Drag Summary

**Phase 62 ships end-to-end. Cmd+G / Cmd+Shift+G keyboard bindings dispatch GROUP / UNGROUP through the existing tinykeys map, the Escape handler is now group-aware (first press exits group, second press clears), and onDragStop on any of the 4 element wrappers fans the drag delta out across all group members in a single BULK_TRANSLATE dispatch — pinned by 21 new test cases (8 keyboard + 7 helper + 4 drag + 1 reducer round-trip + 2 parity) with the tsc baseline preserved at 17 errors and the full Phase 62 regression suite (159 tests across 9 files) green.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-05-03T03:30Z (approx — plan dispatch)
- **Completed:** 2026-05-03T03:43Z
- **Tasks:** 3 (all `tdd="true"`, RED+GREEN per task; Task 3 has 2 test-only commits)
- **Files modified:** 9 (1 created + 8 modified)
- **LOC delta:** +1346 lines (incl. test fixtures)

## Accomplishments

- **End-to-end Phase 62 lands.** After this plan, the user can: select 2+ elements → Cmd+G → all members get a shared groupId → ring appears (via Plan 62-02) → drag any member → all members move (via this plan's group drag) → Cmd+Z → Cmd+Shift+G to dissolve. The full feature is testable against real production usage.
- **Cmd+G + Cmd+Shift+G bindings shipped on existing tinykeys map.** isEditingTarget firewall (KBD-02) preserved; Cmd+G calls preventDefault on BOTH N<=1 and N>=2 paths to suppress Chrome's Find Next dialog (PITFALL-9.3). Cmd+Shift+G's no-op path returns BEFORE preventDefault — intentional asymmetry so Chrome's Find Previous keeps working when nothing-to-ungroup.
- **Group-aware Escape.** First press exits the group when `currentlyInsideGroup !== null`; second press clears (Plan 60-04 SEL-08 behavior preserved). Mirrors Plan 62-02's canvas-empty exitGroup-then-clear two-step semantics — single user gesture, single observable behavior across keyboard + click paths.
- **Group drag fan-out via single BULK_TRANSLATE dispatch.** All 4 onDragStop sites (hook + body + custom_text + custom_image) detect group drag via the new `shouldGroupDrag` pure helper and dispatch `onGroupDrag` once with the full group's member ids + computed delta — the per-element position-change callback is bypassed (Test GD1 pins). Single pushHistory per gesture (KBD-09 / PERF-01 carry-forward).
- **shouldGroupDrag pure helper.** Returns the group's full member ids when (1) `currentlyInsideGroup === null`, (2) `selection.ids.length >= 2`, (3) dragged element has a groupId, AND (4) `selection.ids` set-equals the group's full member set. Strict set-equality (no subset, no superset) honors the user's explicit selection signal.
- **PARITY-01 round-trip pinned.** RT1 verifies GROUP → BULK_TRANSLATE → UNGROUP produces no `groupId` leak in the Satori render path; RT2 verifies a no-drag GROUP → UNGROUP cycle is a true byte-identical render no-op (innerHTML equality). PITFALL-3.6 (schema migration trauma) pinned for the editable={false} slot of the parity contract.
- **21/21 plan-relevant tests pass; 159/159 Phase 62 regression suite green; 560/560 broad cross-suite regression green; tsc baseline 17 errors preserved.**

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1 RED: Cmd+G / Cmd+Shift+G / group-aware Esc tests** — `c1965d2` (test) — 8 new tests; 4/8 fail at RED (KG1 GROUP dispatch, KG4 preventDefault, KU1 UNGROUP dispatch, KE1 Esc-exits-group); 4/8 trivially pass (KG2 N<=1 no-op, KG3 firewall, KU2 no-op, KE2 outside-group clear)
2. **Task 1 GREEN: bindings + Esc replacement** — `16dd0be` (feat) — appends 2 new tinykeys bindings; replaces Escape with group-aware variant; imports getGroupMembers; updates JSDoc. 13/13 shortcut tests pass
3. **Task 2a RED: shouldGroupDrag tests** — `202c9fe` (test) — 7 failing tests (SGD1-SGD7) covering all locked decisions including cross-type membership
4. **Task 2a GREEN: shouldGroupDrag pure helper** — `f7fb46f` (feat) — appended to group-membership.ts; 13/13 helper tests pass
5. **Task 2b RED: group-drag onDragStop tests** — `2d78fce` (test) — 4 tests (GD1-GD4); 2/4 fail at RED (GD1 + GD2 — onGroupDrag prop not yet defined); 2/4 trivially pass (GD3 + GD4 — fall-through path always works for ungrouped + inside-group cases)
6. **Task 2b GREEN: 4-site onDragStop branches + props plumbing + slide-editor wiring** — `dbc4d6d` (feat) — modifies 3 production files; 4/4 group-drag tests pass; 155/155 broader regression green
7. **Task 3a: PG1 reducer round-trip** — `daffc57` (test) — 1 new test pins GROUP → BULK_TRANSLATE → UNGROUP losslessness; 48/48 reducer tests pass (47 prior + PG1)
8. **Task 3b: RT1 + RT2 parity invariants** — `ef3207d` (test) — 2 new tests pin no-groupId-leak in Satori render path; 27/27 parity tests pass

**Plan metadata:** _final-commit-pending_ (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md update commit follows)

## Files Created/Modified

**Created:**
- `src/components/slides/__tests__/slide-preview-group-drag.test.tsx` (359 LOC, 4 tests + react-rnd mock)

**Modified:**
- `src/components/editor/slide-editor.tsx` (+91 LOC) — getGroupMembers import; 2 new tinykeys bindings ($mod+g + $mod+Shift+g); REPLACED Escape binding with group-aware variant; onGroupDrag wiring at SlideCanvas mount; updated JSDoc header
- `src/lib/editor/transforms/group-membership.ts` (+61 LOC) — shouldGroupDrag(slide, selection, currentlyInsideGroup, draggedElementId): string[] | null pure helper with cross-type element resolution + strict set-equality membership check
- `src/components/slides/slide-preview.tsx` (+103 LOC) — shouldGroupDrag import (alongside getGroupMembers); onGroupDrag prop on SlidePreviewProps interface with full JSDoc; signature destructure update; group-drag fan-out branch in 4 onDragStop sites (hook + body + custom_text + custom_image)
- `src/components/editor/slide-canvas.tsx` (+12 LOC) — onGroupDrag prop on SlideCanvasProps; signature destructure; pass-through to SlidePreview
- `src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` (+316 LOC) — TextEditorPanel mock probe extension (data-groupids + data-selected-ids); SlideCanvas mock with probe-enter-group/probe-exit-group buttons + data-inside-group; 8 new tests (KG1-KG4, KU1-KU2, KE1-KE2)
- `src/lib/editor/__tests__/group-membership.test.ts` (+125 LOC) — shouldGroupDrag import; 7 new tests (SGD1-SGD7) with cross-type fixture
- `src/lib/editor/__tests__/editor-reducer.test.ts` (+104 LOC) — Test PG1 round-trip GROUP → BULK_TRANSLATE → UNGROUP at the reducer boundary
- `src/lib/render/__tests__/parity.test.tsx` (+136 LOC) — editorReducer import; Tests RT1 (GROUP→BULK_TRANSLATE→UNGROUP no-leak) + RT2 (no-drag cycle byte-identical render)

## Decisions Made

- **D-01 (groupId construction at dispatch site):** Plan 62-01 D-01 honored — `g_${selectedIndex}_${Date.now().toString(36)}` per CONTEXT D-01 (nanoid is NOT a dep). The reducer treats `action.groupId` as opaque and trusts the dispatcher's choice; this dispatch site is the canonical groupId factory. Test KG1 pins the format with `expect(...).toMatch(/^g_0_[a-z0-9]+$/)`.
- **D-02 (Cmd+G N<=1 still preventDefault):** PITFALL-9.3 — Chrome's Find Next dialog must NEVER pop over our canvas, even when our handler is a no-op. The reducer never sees the dispatch (we return BEFORE the dispatch on N<=1), but the browser's default action is suppressed. Asymmetric to Cmd+Shift+G's no-op path (D-03).
- **D-03 (Cmd+Shift+G no-op path returns BEFORE preventDefault):** When the user has no grouped elements selected, we return early without preventDefault — Chrome's Find Previous (also Cmd+Shift+G) keeps working as a fallthrough. The user has nothing to ungroup, so we shouldn't claim the binding. Asymmetric to Cmd+G (D-02) by design — Cmd+G ALWAYS has a sensible group-formation interpretation; Cmd+Shift+G doesn't (you can't ungroup nothing).
- **D-04 (Cmd+Shift+G UNION expansion):** When 2+ groupIds are present in the selection, the dispatch ids list = the union of all members of all groups. Partial-group selections still ungroup the whole group — `selection.ids` filtered to grouped elements + getGroupMembers expansion produces the full member set. The reducer's UNGROUP idempotency rule (Test U4) ensures any duplicates in the list are harmless.
- **D-05 (Esc handler REPLACE not extend):** The existing Escape binding from Plan 60-04 is replaced with a group-aware variant (not chained). First-press-inside-group is purely `exitGroup()` with NO selection mutation. Tests KE1 (inside-group: selection preserved) + KE2 (outside-group: selection cleared) pin both branches.
- **D-06 (shouldGroupDrag set-equality is STRICT):** Selection must equal the group's full member set — no subset, no superset. SGD3 (subset → null) + SGD4 (superset includes ungrouped → null) pin both directions. Subset is the user's explicit signal "move only these"; superset is "move these AND something outside the group" — a different gesture.
- **D-07 (4 onDragStop sites all dispatch through onGroupDrag):** Even hook + body (structural-anchor TextBoxes) get the same group-drag branch. The reducer's BULK_TRANSLATE skips structural-anchor silently (Plan 60-03 contract carry-forward) so a group containing the hook still moves the OTHER members; the hook stays put. PITFALL-3.5: "if the group ends up 'broken apart' visually, that's the user's signal to ungroup" — the implementation enables this exact UX without surprising history dispatches.
- **D-08 (drag-start ref read-then-clear pattern):** The startRef from `*DragStartRef.current` (Plan 61-02 axis-constrain pattern) is read once, captured in a local const, then cleared. The group-drag delta computation uses the local; the per-element fall-through doesn't need it. Single-gesture-bounded ref consumption — UNDO-01 pattern from Plan 59 onResizeStop.
- **D-09 (react-rnd test mock):** This plan's test file mocks react-rnd as a thin div + onDragStop/onDragStart registry. Existing slide-preview tests (group-clicks, group-ring, marquee, parity) use the real component and don't need this mock — `vi.mock` is scoped to the single test file. Tests can fire onDragStop synthetically with controlled x/y values, avoiding pointer-event simulation that jsdom doesn't support.
- **D-10 (RT2 innerHTML byte-equality):** Stronger than testid-presence assertions — innerHTML is the rendered DOM the React reconciler emits. Byte-identical innerHTML across the GROUP→UNGROUP cycle proves no schema mutation reached any DOM-bound projection (data attributes, classes, text, anything). Defense-in-depth complement to RT1's grep-for-groupId-string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Coverage] Test SGD7 added (cross-type group drag detection)**
- **Found during:** Task 2a — shouldGroupDrag test design.
- **Issue:** Plan listed 6 tests (SGD1-SGD6) but the helper walks text_boxes ∪ custom_images ∪ watermark for `draggedElementId` resolution. With only text_box-based fixtures (SGD1-SGD6 all use makeTextBox), a regression in the custom_image OR watermark resolution branch would have escaped the suite. Mirrors the same Plan 62-01 deviation that added Tests E10/E11 for cross-type enterGroup coverage.
- **Fix:** Appended Test SGD7 — slide with text_box + custom_image + watermark all sharing groupId='g_x', selection includes all 3, dragged is the custom_image. Asserts the helper returns all 3 ids.
- **Files modified:** `src/lib/editor/__tests__/group-membership.test.ts` (+~20 LOC for SGD7)
- **Verification:** Pass on GREEN; total shouldGroupDrag tests now 7 (= 6 planned + 1 cross-type extension).
- **Committed in:** `202c9fe` (Task 2a RED) + `f7fb46f` (Task 2a GREEN — passes)

**2. [Rule 3 - Blocking issue] Test mock infrastructure for onDragStop firing**
- **Found during:** Task 2b — slide-preview-group-drag test design.
- **Issue:** None of the existing slide-preview test files mock react-rnd; they fire onMouseDown via DOM events (which works because Rnd forwards it to the underlying div). onDragStop has no DOM-event analog — the only ways to fire it are (a) full pointer-event simulation (jsdom doesn't support drag events realistically) or (b) intercepting the Rnd component's prop wiring. Without (a) or (b), Tests GD1-GD4 cannot exercise the new onDragStop branches.
- **Fix:** Added a `vi.mock('react-rnd', ...)` in this test file only, mocking Rnd as a thin div that stashes onDragStop + onDragStart on a per-render registry keyed by data-rnd-key. Tests then call the registered callbacks synchronously with controlled x/y values. Scoped to the single test file via `vi.mock`'s file-local semantics — does not affect group-clicks/group-ring/marquee/parity which still use the real component.
- **Files modified:** `src/components/slides/__tests__/slide-preview-group-drag.test.tsx` (mock setup at top; 359 LOC total)
- **Verification:** All 4 group-drag tests pass; broader regression suite (155 tests across 21 files) shows zero impact.
- **Committed in:** `2d78fce` (Task 2b RED) + `dbc4d6d` (Task 2b GREEN)

---

**Total deviations:** 2 auto-fixed (1 missing-critical-coverage, 1 test-infrastructure-blocking)
**Impact on plan:** No scope creep. SGD7 is a 20-LOC fixture-swap parametric extension of SGD1; the react-rnd mock is a self-contained test infrastructure pattern that follows the same shape as the existing TextEditorPanel/SlideCanvas mocks in slide-editor.shortcuts.test.tsx.

## Issues Encountered

**1. (Resolved during Task 2b GREEN) deltaX/deltaY initially 0 in tests**
- **Cause:** First implementation read `startRef` from `*DragStartRef.current[id]` but my test mock only fired onDragStop, not onDragStart. The slide-preview captures startRef in onDragStart; without that fire, the ref was null and the delta defaulted to 0.
- **Resolution:** Updated the react-rnd mock to also stash onDragStart, then fire `entry.onDragStart?.()` before `entry.onDragStop()` in each test. Production code path is unchanged (real react-rnd always fires onDragStart before onDragStop).
- **Time impact:** ~3 min — caught immediately on first GREEN test run.

## Cross-Phase Constraint Compliance

| Constraint | Source | Status |
|------------|--------|--------|
| Flat schema only — no Slide.groups[], no nested groups | D-01 / ARCHITECTURE §1 | **PASS** — `groupId?: string` is the only group field touched; this plan dispatches GROUP/UNGROUP/BULK_TRANSLATE, all of which respect the flat schema |
| Single pushHistory per gesture | KBD-09 / PERF-01 | **PASS** — Cmd+G dispatches GROUP (1×); Cmd+Shift+G dispatches UNGROUP (1×); group drag dispatches BULK_TRANSLATE (1×). Test GD1 verifies per-element callback NOT called when group drag fires (would otherwise be 2 dispatches → 2 history entries). PG1 verifies the chain dispatches exactly 3 (GROUP + BULK_TRANSLATE + UNGROUP). |
| applyDualWrite for text_boxes mutations | BL-01 | **PASS** — GROUP/UNGROUP/BULK_TRANSLATE reducer cases (Plan 62-01 + Plan 60-03) all route text_boxes mutations through applyDualWrite. PG1 verifies the legacy custom_texts mirror is well-formed across the 3-step chain (positions reflect translate; no groupId leak). |
| Selection state outside reducer history | Plan 60-03 contract | **PASS** — `currentlyInsideGroup` (Plan 62-01) is consumed via React props in this plan; never enters reducer history. Selection.ids stays the same after Cmd+G/Cmd+Shift+G dispatch (the elements just gain/lose a groupId). |
| TPLREND-05 / PARITY-01 | TPLREND-05 / PARITY-01 | **PASS** — RT1 (no groupId leak in render) + RT2 (byte-identical innerHTML across no-drag GROUP/UNGROUP cycle) extend the parity contract for the new editor surface. The 2 group-bounding-ring parity tests from Plan 62-02 still pass. |
| isEditing guard at slide-editor.tsx | KBD-02 | **PASS** — Both new bindings AND the modified Escape binding start with `if (isEditingTarget(e.target)) return`. grep gate `>=11` (was 9 in Plan 60-04; +2 from new bindings; Escape replacement preserved its existing guard). |
| preventDefault for browser-default conflict | KBD-03 + PITFALL-9.3 | **PASS** — Cmd+G calls preventDefault on BOTH N<=1 and N>=2 paths (D-02). Cmd+Shift+G's no-op returns BEFORE preventDefault by design (D-03 — asymmetric). Escape calls preventDefault unconditionally (existing Plan 60-04 behavior preserved). |
| Watermark + structural-anchor + locked skip on BULK_TRANSLATE | Plan 60-03 contract | **PASS** — inherited unchanged. Group drag dispatches via the same BULK_TRANSLATE action that Plan 60-03 already gated. Test GD1 fixture uses 2 custom_images (no skip-eligible elements) so the contract is implicit; PG1 + RT1 use custom-role text_boxes (also no skip) — full coverage of the locked + watermark + structural-anchor skip rules already lives in Plan 60-03's reducer test suite. |
| onDragStop only — never per-tick onDrag | RESEARCH cross-phase / PERF-01 | **PASS** — group drag dispatch fires from onDragStop in all 4 sites; no onDrag dispatches added. Existing axis-constrain logic in onDrag (Plan 61-02) is untouched. |
| No new packages | RESEARCH ceiling | **PASS** — package.json unchanged; nanoid still absent; Date.now-based scheme used per CONTEXT D-01. |
| No nested groups | PITFALL-3.3 | **PASS** — Plan 62-01 reducer dissolves the old group on subset-Cmd+G; this plan dispatches a single GROUP action with the new groupId and trusts the reducer's cascade. Test G4 in Plan 62-01 pins. |
| Cmd+click no-op | Plan 60-05 / Plan 62 CONTEXT | **PASS** — no e.metaKey check added at any of the 4 wrappers in this plan; deep-select-through-groups remains a Phase 65+ deferred decision. |

## Phase 62 Plan 03 Known Gaps (intentional, documented for Phase 63+ inheritors)

1. **Group drag with structural-anchor TextBox in selection.** When a group contains the hook or body, BULK_TRANSLATE skips the structural-anchor (Plan 60-03 contract carry-forward) — the OTHER group members move; the hook stays put. PITFALL-3.5 expectation: "if the group ends up broken apart visually, that's the user's signal to ungroup." Phase 63 (alignment) may revisit when the rendered-height observer is lifted into selection-bounds for full-fidelity group AABB math.
2. **Multi-group drag falls through to per-element callback.** When the selection spans 2+ distinct groupIds, `shouldGroupDrag` returns null (the dragged element's group is a strict subset of the selection — superset case). The drag fires the existing per-element onPositionChange, which dispatches a single per-element action — fine for now; Phase 65 (layers panel) may revisit if multi-group multi-drag becomes a routine pattern.
3. **Cmd+G with N=1 grouped element silently swallows the keypress.** Per D-02, we always preventDefault on Cmd+G even when N<=1. A user pressing Cmd+G on a single grouped element gets no UI feedback and Chrome's Find Next is suppressed. Acceptable trade-off (Find Next on the editor canvas is rare); a future refinement could surface a toast "select 2+ elements to group".
4. **Cmd+Shift+G with focus on watermark drops the binding.** The watermark wrapper currently has `pointerEvents: 'none'` (Plan 62-02 known gap), so the user cannot click the watermark. Once Phase 64+ exposes a watermark click target, the new Cmd+Shift+G binding will already work for it (the handler walks watermark in the groupId-collection loop).
5. **Group drag with N=30 elements at 60Hz on a slow device.** Performance is dispatch-once at onDragStop only — onDrag is untouched. PERF-01 carry-forward; verified by Plan 60-03 + this plan's BULK_TRANSLATE skip rules. Real-device benchmarking not in scope; deferred to Phase 65 if users report jank.
6. **PARITY-01 chrome regex from Plan 62-02 not extended in this plan.** Plan 62-02's chrome regex scans `editable={false}` HTML for `multi-selection-ring|marquee-overlay|group-bounding-ring`. This plan introduces no new editor-only chrome (the new bindings are pure dispatches; the new prop is forwarded, not rendered). The existing 25 parity tests + 2 new RT1/RT2 cover the schema-leak surface.

## User Setup Required

None — no external service configuration required. Phase 62 ships fully autonomous.

## Next Phase Readiness

**Phase 62 is now 100% complete (3/3 plans shipped).** End-to-end user gesture chain testable:
- Multi-select via marquee (Phase 61) OR Cmd+A (Phase 60) → 2+ elements selected
- Cmd+G (this plan) → all members get shared groupId
- Group ring renders dotted (Plan 62-02)
- Drag any member → ALL members move (this plan; single Cmd+Z reverts)
- Double-click a member → enter group (Plan 62-02); group ring renders solid
- Single-click member → leaf select; right-rail shows leaf properties
- Esc once → exit group (this plan)
- Esc again → clear selection (Plan 60-04 carry-forward)
- Cmd+Shift+G → ungroup; ring disappears

**Seam exposed for Phase 63 (alignment):**
- `shouldGroupDrag` is the read helper Phase 63's group-aware align/distribute can reuse to detect "treat-this-group-as-a-single-unit" gestures.
- Group drag's BULK_TRANSLATE dispatch shape is the same as alignment's — Phase 63 alignment math can reuse the dispatch layer; only the delta computation differs.

**Seam exposed for Phase 64 (lock/hide/z-order):**
- Group ring + group selection both already skip locked + structural-anchor + watermark via the inherited Plan 60-03 BULK_TRANSLATE contract. Phase 64 z-order on multi-selection containing groups: each group member moves +1/-1 individually with array clamping (RESEARCH commitment carry-forward).

**Seam exposed for Phase 65 (layers panel):**
- `getGroupMembers` is the cross-type read helper layers panel will use to render group rows. Plan 62-02 known gap #5 (multi-group multi-select shows only first group's ring) may inform layers panel design.

**No blockers.** Phase 63 (alignment) can proceed.

## Self-Check: PASSED

**Files verified to exist:**
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/slide-editor.tsx`: FOUND (modified — 1156 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/slide-canvas.tsx`: FOUND (modified — 219 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/slides/slide-preview.tsx`: FOUND (modified — 2300 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/__tests__/slide-editor.shortcuts.test.tsx`: FOUND (modified — 526 LOC, 13 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/slides/__tests__/slide-preview-group-drag.test.tsx`: FOUND (created — 359 LOC, 4 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/transforms/group-membership.ts`: FOUND (modified — 95 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/__tests__/group-membership.test.ts`: FOUND (modified — 264 LOC, 13 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/__tests__/editor-reducer.test.ts`: FOUND (modified — 1453 LOC, 48 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/render/__tests__/parity.test.tsx`: FOUND (modified — 727 LOC, 27 tests)

**Commits verified to exist:**
- `c1965d2`: FOUND (test 62-03/t1 RED)
- `16dd0be`: FOUND (feat 62-03/t1 bindings GREEN)
- `202c9fe`: FOUND (test 62-03/t2a RED)
- `f7fb46f`: FOUND (feat 62-03/t2a shouldGroupDrag GREEN)
- `2d78fce`: FOUND (test 62-03/t2b RED)
- `dbc4d6d`: FOUND (feat 62-03/t2b group drag GREEN)
- `daffc57`: FOUND (test 62-03/t3 PG1)
- `ef3207d`: FOUND (test 62-03/t3 RT1+RT2)

**Plan-level verification (re-run):**
- 13/13 shortcut tests pass (8 new + 5 prior)
- 13/13 group-membership tests pass (6 getGroupMembers + 7 shouldGroupDrag)
- 48/48 editor-reducer tests pass (47 prior + 1 new PG1)
- 4/4 group-drag tests pass (GD1-GD4)
- 27/27 parity tests pass (25 prior + 2 new RT1, RT2)
- 159/159 full Phase 62 regression suite green (9 test files)
- 560/560 broad cross-suite regression green (41 test files: src/lib/editor + src/components/editor + src/components/slides + src/lib/render)
- tsc baseline preserved at 17 errors
- 1× '$mod+g': binding (grep -F)
- 1× '$mod+Shift+g': binding (grep -F)
- 11× isEditingTarget(e.target) in slide-editor.tsx (was 9; +2 from new bindings)
- 1× type: 'BULK_TRANSLATE' in slide-editor.tsx (the new wire-up)
- 1× type: 'GROUP' in slide-editor.tsx (Cmd+G)
- 1× type: 'UNGROUP' in slide-editor.tsx (Cmd+Shift+G)
- 5× shouldGroupDrag references in slide-preview.tsx (1 import + 4 call sites)
- 11× onGroupDrag references in slide-preview.tsx (prop type + destructure + 4 if-checks + 4 invocations + 1 import comment)

---

*Phase: 62-group-ungroup*
*Completed: 2026-05-03*

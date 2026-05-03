---
phase: 65-layers-panel-tplrend-audit
plan: 02
subsystem: ui
tags: [layers-panel, lock-toggle, visibility-toggle, z-order-buttons, plan-64-wiring, perf-02-trivial, kbd-09-carry-forward]

# Dependency graph
requires:
  - phase: 64-lock-hide-z-order
    provides: SET_LOCKED / SET_HIDDEN / Z_ORDER reducer actions (Plans 64-01 / 64-02 / 64-03) — caller-toggle-math + ref-equal short-circuit + single-pushHistory contract
  - plan: 65-01
    provides: LayersPanel + LayerChip + GroupRow components with empty data-testid slots (chip-lock-slot / chip-vis-slot / chip-reorder-slot / group-lock-slot / group-vis-slot) reserved for in-place fill
provides:
  - LayerChip lock/visibility/reorder buttons wired to Plan 64-01..03 reducer actions
  - GroupRow group-scope lock/visibility buttons wired (group-scope SET_LOCKED / SET_HIDDEN with full memberIds — single dispatch / single pushHistory)
  - Unified ids[] callback shape on LayersPanelProps.onLockToggle / onVisibilityToggle (chip wraps single id; group passes memberIds straight through — eliminates separate group handlers)
  - slide-editor.tsx handleLayerLockToggle / handleLayerVisibilityToggle / handleLayerReorder useCallback dispatchers
affects: [65-03-tplrend-audit, 66-final-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Caller-toggle-math at chip / group level (chip computes !row.locked; group computes !row.allLocked) — reducer trusts the caller-provided boolean (Plan 64-01 D-01 carry-forward)"
    - "stopPropagation on every toggle button onClick — prevents bubble to outer chip onClick (selection unchanged when only toggling lock; LT8 + GT4 pin)"
    - "Unified ids[] callback shape — chip wraps [row.id] in array; group passes memberIds[] directly through the SAME parent callback. Eliminates need for separate group handlers; single SET_LOCKED / SET_HIDDEN action shape covers both cases"
    - "Pressed visual state (data-pressed + bg-[#3d0000] text-white) driven directly off row.locked / row.hidden / row.allLocked / row.allHidden — React.memo's areEqual already gates on these fields"
    - "Watermark z-order buttons wired but reducer silently absorbs single-slot scope no-op via no-scope-changed short-circuit (Plan 64-03 D-03) — chip is NOT responsible for hiding the buttons"
    - "Title-attribute keyboard-shortcut hints surface for free (Lock layer ⌘⇧L / Bring forward ⌘] / Send backward ⌘[) without registering new tinykeys bindings — KBD-08 deferred to Phase 66"

key-files:
  created:
    - src/components/editor/layers-panel/__tests__/layer-chip.toggles.test.tsx
    - src/components/editor/layers-panel/__tests__/group-row.toggles.test.tsx
    - src/components/editor/layers-panel/__tests__/layers-panel.integration.test.tsx
  modified:
    - src/components/editor/layers-panel/types.ts (extended LayerChipProps + GroupRowProps + LayersPanelProps with toggle callbacks)
    - src/components/editor/layers-panel/layer-chip.tsx (replaced 3 placeholder slots with 4 real buttons — lock + vis + up + down)
    - src/components/editor/layers-panel/group-row.tsx (replaced 2 placeholder slots with 2 real group-scope buttons)
    - src/components/editor/layers-panel/layers-panel.tsx (5 useCallback handlers wrap the parent props for stable refs; pass to chips + groups)
    - src/components/editor/slide-editor.tsx (3 new useCallback dispatchers + 3 new prop wires on the LayersPanel mount)
    - src/components/editor/layers-panel/__tests__/layer-chip.memo.test.tsx (Harness + base props extended with new optional callback fields — LM1..LM3 contract preserved)
    - src/components/editor/layers-panel/__tests__/layers-panel.test.tsx (5 render-tests updated to provide new required LayersPanelProps fields)

key-decisions:
  - "Unified ids[] shape on onLockToggle / onVisibilityToggle (DECISION locked at Task 3 step A): chip dispatches with [row.id]; group dispatches with memberIds. Same parent callback. Eliminates separate group handlers; one call → one dispatch → one pushHistory."
  - "Toggle math at chip / group level, NOT in the reducer (Plan 64-01 D-01 carry-forward). Chip computes !row.locked / !row.hidden; group computes !row.allLocked / !row.allHidden. Reducer trusts the caller-provided boolean."
  - "Watermark z-order buttons wired (LT7), reducer absorbs (Plan 64-03 D-03). The chip is NOT responsible for hiding watermark up/down; the reducer's single-slot no-scope-changed short-circuit handles it. Visual consistency wins (no missing buttons on any chip type)."
  - "Group-row z-order intentionally OUT of scope. Cross-array reorder + multi-id splice with adjacent-selected guard is v2.12+ (Plan 64-03 ZA4). Group-row only gets lock + vis."
  - "Task 3 committed as a single combined commit (test fixtures + production wiring + new integration tests). The integration tests cannot exist without the LayersPanelProps refactor (typed required callbacks); separating into RED+GREEN here would require committing in a state that fails tsc on multiple consumer files. Tasks 1 + 2 followed strict RED→GREEN."

patterns-established:
  - "Pattern: chip / group toggle buttons stopPropagation onClick + caller-toggle-math + unified ids[] callback shape. Future PR adding a chip-level color swatch or another toggle should follow the same template."
  - "Pattern: parent useCallback wraps the panel-prop callbacks once — keeps React.memo's areEqual on chip referentially stable across renders. The panel exposes 5 stable callback refs (1 select + 1 startRename + 1 commitRename + 1 cancelRename + 3 toggle wrappers)."
  - "Pattern: visual pressed state (data-pressed + bg-[#3d0000] text-white) — directly off the toggle source-of-truth field on the row. No local state."

requirements-completed: [LAYERS-05, LAYERS-06, LAYERS-07]

# Metrics
duration: 9min
completed: 2026-05-03
---

# Phase 65 Plan 02: Lock/Visibility/Z-order Toggles → Plan 64 Reducer Wiring Summary

**Filled the 5 placeholder slots from Plan 65-01 (chip-lock-slot / chip-vis-slot / chip-reorder-slot / group-lock-slot / group-vis-slot) with 6 real toggle buttons (4 chip + 2 group); each click dispatches Plan 64-01/02/03 reducer actions through a unified ids[] callback shape; single dispatch per click → single pushHistory entry (KBD-09 / PERF-01 carry-forward); 33/33 layers-panel tests + 86/86 reducer + 45/45 keyboard + 42/42 parity green; tsc baseline preserved.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-03T07:13:00Z
- **Completed:** 2026-05-03T07:22:05Z (approx)
- **Tasks:** 3 (Tasks 1 + 2 followed strict TDD RED→GREEN; Task 3 committed as a single combined RED+GREEN — see Deviations)
- **Files created:** 3 (all test files: layer-chip.toggles + group-row.toggles + layers-panel.integration)
- **Files modified:** 7 (types + chip + group-row + panel + slide-editor + 2 existing test files)
- **Production LOC delta:** ~140 (chip +84, group-row +48, panel +38, types +41, slide-editor +24)
- **Test LOC added:** ~482 (LT1..LT8 = 183 + GT1..GT4 = 118 + PI1..PI3 = 181)

## Accomplishments

- **LayerChip lock + visibility + reorder buttons wired** — replaced the 3 empty placeholder slots with 4 real buttons (lock, vis, up, down). Click dispatches the unified `onLockToggle([row.id], !row.locked)` / `onVisibilityToggle([row.id], !row.hidden)` / `onReorder(row.id, 'forward'|'backward')` callbacks. Each button calls `e.stopPropagation()` so clicks don't bubble to the chip's outer onClick (selection unchanged on toggle — LT8 pins this). Visual pressed state (data-pressed + bg-[#3d0000] text-white) driven off `row.locked` / `row.hidden`. Title-attribute keyboard-shortcut hints surface for free (KBD-08 deferred).
- **GroupRow group-scope lock + visibility wired** — replaced 2 placeholder slots with 2 real buttons. Group-lock dispatches `onGroupLockToggle(memberIds, !row.allLocked)` → SET_LOCKED on all members in a single dispatch (one pushHistory entry). Symmetric for group-vis. Group-row z-order intentionally OUT of scope (cross-array multi-id splice deferred to v2.12+ per Plan 64-03 ZA4).
- **LayersPanel callback wrappers** — 5 useCallback handlers (handleChipLockToggle / handleChipVisToggle / handleChipReorder / handleGroupLockToggle / handleGroupVisToggle) wrap the panel-level props. All ref-stable across renders so React.memo's areEqual on LayerChip stays effective. Chip dispatches `[row.id]`; group dispatches `memberIds` directly through the SAME parent callback (unified ids[] shape — DECISION at Task 3 step A).
- **slide-editor.tsx 3 new useCallback dispatchers** — handleLayerLockToggle / handleLayerVisibilityToggle / handleLayerReorder land next to handleLayerRename. Each is a thin wrapper around dispatch with the canonical Plan 64 action shape. Toggle math lives at the chip / group level (Plan 64-01 D-01 caller-toggle-math); the reducer trusts the caller-provided boolean. No new keyboard bindings — `isEditingTarget` grep count UNCHANGED at 29.
- **PI1..PI3 integration tests** — full chain proven: chip-button-click → LayersPanel callback → parent dispatch → exact reducer-action shape (`{ type: 'SET_LOCKED', slideIndex, ids, locked }` for chip lock; `{ type: 'SET_HIDDEN', slideIndex, ids: [...memberIds], hidden }` for group vis; `{ type: 'Z_ORDER', slideIndex, ids: [imageId], op: 'forward' }` for chip up-arrow on a custom_image).
- **Watermark chip z-order buttons wired (LT7)** — the chip is NOT responsible for hiding the buttons. Click dispatches `onReorder('wm-1', 'forward')`; the reducer (Plan 64-03 D-03) silently absorbs the single-slot no-op via the no-scope-changed short-circuit. Visual consistency wins.

## Task Commits

Plan 65-02 produced 5 commits (interleaved with 2 commits from the parallel Plan 65-03 wave; only Plan 65-02 commits listed below):

1. **88253b1** — `test(65-02/t1): LT1..LT8 chip toggle button tests (RED)`
   - Extended LayerChipProps + GroupRowProps + LayersPanelProps with toggle callbacks (unified ids[] shape).
   - Wrote layer-chip.toggles.test.tsx covering LT1..LT8: lock toggle (both directions), vis toggle (both directions), up/down z-order, watermark no-op, stopPropagation.
   - 8/8 RED — buttons not yet wired.

2. **4e7eaaa** — `feat(65-02/t1): wire chip lock + visibility + reorder buttons`
   - Replaced 3 placeholder slots with 4 real buttons in layer-chip.tsx.
   - Lock / vis / up / down buttons + stopPropagation + pressed visual state + title hints.
   - LT1..LT8 GREEN (8/8).

3. **6524237** — `test(65-02/t2): GT1..GT4 group-row toggle tests (RED)`
   - Wrote group-row.toggles.test.tsx covering GT1..GT4: group-lock (both directions), group-vis (both directions), no-bubble-to-onToggleExpanded.
   - 4/4 RED.

4. **ea1cec8** — `feat(65-02/t2): wire group-row lock + visibility toggles`
   - Replaced 2 placeholder slots in group-row.tsx with real buttons.
   - GT1..GT4 GREEN (4/4).

5. **29c23b9** — `feat(65-02/t3): wire LayersPanel→Plan 64 reducer dispatch + slide-editor handlers + PI1..PI3 integration tests`
   - LayersPanel: 5 useCallback handlers (chip + group toggle wrappers).
   - slide-editor.tsx: 3 new dispatchers + 3 new prop wires on LayersPanel mount.
   - PI1..PI3 integration tests covering full chain.
   - Existing test fixtures (layers-panel.test.tsx + layer-chip.memo.test.tsx) updated for new required props.
   - PI1..PI3 GREEN (3/3); full layers-panel suite 33/33.

## Files Created/Modified

### Created

- `src/components/editor/layers-panel/__tests__/layer-chip.toggles.test.tsx` (183 LOC) — LT1..LT8 covering chip lock/vis/reorder dispatch, watermark no-op behavior, and stopPropagation.
- `src/components/editor/layers-panel/__tests__/group-row.toggles.test.tsx` (118 LOC) — GT1..GT4 covering group lock/vis dispatch with full memberIds + no-bubble-to-expand.
- `src/components/editor/layers-panel/__tests__/layers-panel.integration.test.tsx` (181 LOC) — PI1..PI3 full-chain integration tests (panel → callback → dispatch shape).

### Modified

- `src/components/editor/layers-panel/types.ts` — Extended LayerChipProps with `onLockToggle / onVisibilityToggle / onReorder`; GroupRowProps with `onGroupLockToggle / onGroupVisibilityToggle`; LayersPanelProps with the unified `onLockToggle(ids, locked) / onVisibilityToggle(ids, hidden) / onReorder(id, op)` shape. Cited Plan 64-01..03 reducer shapes in JSDoc.
- `src/components/editor/layers-panel/layer-chip.tsx` — Replaced 3 placeholder slots (chip-lock-slot / chip-vis-slot / chip-reorder-slot) with 4 real buttons (chip-lock-button + chip-vis-button + chip-reorder-up + chip-reorder-down). Each button: stopPropagation, pressed visual state from row.locked / row.hidden, title-attribute keyboard-shortcut hints, aria-pressed for screen readers.
- `src/components/editor/layers-panel/group-row.tsx` — Replaced 2 placeholder slots (group-lock-slot / group-vis-slot) with 2 real buttons (group-lock-button + group-vis-button). Pressed visual state driven off row.allLocked / row.allHidden.
- `src/components/editor/layers-panel/layers-panel.tsx` — Added 5 useCallback handlers (handleChipLockToggle / handleChipVisToggle / handleChipReorder + handleGroupLockToggle / handleGroupVisToggle). Pass to LayerChip + GroupRow as props.
- `src/components/editor/slide-editor.tsx` — Added handleLayerLockToggle / handleLayerVisibilityToggle / handleLayerReorder useCallback dispatchers next to handleLayerRename. Wire to LayersPanel mount.
- `src/components/editor/layers-panel/__tests__/layer-chip.memo.test.tsx` — Harness extended with onLockToggle / onVisibilityToggle / onReorder useCallback wrappers; base areEqual fixture extended with the new optional fields. LM1..LM3 + LM-areEqual contract preserved.
- `src/components/editor/layers-panel/__tests__/layers-panel.test.tsx` — 5 render-tests updated to provide new required LayersPanelProps fields (vi.fn() stubs).

## Decisions Made

1. **Unified ids[] shape on onLockToggle / onVisibilityToggle** (Plan 65-02 Task 3 DECISION). Chip wraps single id in `[row.id]`; group passes `memberIds` straight through to the SAME parent callback. Eliminates the need for separate group handlers — group dispatch is just an N-id call. The chip wrapper does the array-wrap; the group-row wrapper passes its memberIds straight through. Both land at the same `dispatch({ type: 'SET_LOCKED' | 'SET_HIDDEN', slideIndex, ids, ... })` site in slide-editor.tsx — one pushHistory entry per click.

2. **Toggle math at chip / group level, NOT in the reducer** (Plan 64-01 D-01 carry-forward). Chip computes `!row.locked` / `!row.hidden`; group computes `!row.allLocked` / `!row.allHidden`. Reducer trusts the caller-provided boolean. Same pattern as the existing Cmd+Shift+L tinykeys binding.

3. **Watermark z-order buttons wired but reducer silently absorbs** (LT7 + Plan 64-03 D-03). The chip is NOT responsible for hiding watermark up/down arrows. Click fires `onReorder('wm-id', 'forward')`; the reducer's single-slot no-scope-changed short-circuit handles it. Visual consistency wins (every chip type has the same button set).

4. **Group-row z-order intentionally OUT of scope.** Cross-array reorder + multi-id splice with adjacent-selected guard is v2.12+ (Plan 64-03 ZA4). Group-row gets only lock + vis.

5. **stopPropagation on every toggle button.** All four chip buttons + both group buttons call `e.stopPropagation()` on onClick — prevents bubble to chip's outer onClick (selection) and group-row's chevron (expand/collapse). LT8 + GT4 pin this.

6. **Title-attribute keyboard hints surface for free.** "Lock layer (⌘⇧L)" / "Toggle visibility" / "Bring forward (⌘])" / "Send backward (⌘[)" — text-only tooltips on the buttons. KBD-08 (visible Cmd+symbol legend overlay) deferred to Phase 66; v2.11 still gets discoverability via tooltips.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1 (bugs), Rule 2 (missing critical functionality), or Rule 3 (blocking issues) deviations occurred. The deviation rules' threat-model checkboxes (T-65-02-01..05) all hit `accept` or `mitigate` dispositions covered by existing test pins (LT8 + GT4 cover T-65-02-04 spoofing mitigation).

### Procedural Adjustments

**1. [Procedural] Task 3 committed as a single combined commit (RED + GREEN merged)**
- **Found during:** Task 3 authoring
- **Issue:** The Task 3 test file (layers-panel.integration.test.tsx) cannot exist as a standalone RED commit because it requires the LayersPanelProps refactor (new required callbacks) — that refactor cascades into 4 consumer files (layers-panel.tsx, slide-editor.tsx, layer-chip.memo.test.tsx fixture, layers-panel.test.tsx fixtures) that would all fail tsc if committed alone.
- **Resolution:** Tasks 1 + 2 followed strict RED → GREEN cycles. Task 3 landed as a single GREEN commit covering the LayersPanel + slide-editor wiring + new integration tests + updated existing test fixtures. The combined commit message (29c23b9) explicitly documents this split-vs-combined choice and references the cascading-tsc rationale.
- **Files modified:** 5 in commit 29c23b9.
- **Commit:** 29c23b9.

**2. [Procedural] tsc baseline IMPROVED below 17**
- **Found during:** Final verification.
- **Issue:** Plan said "tsc baseline 17 errors". Current count (excluding the parallel Plan 65-03 in-flight untracked file `parity.regression-sweep.test.tsx`) is **0 errors** — substantially below baseline.
- **Resolution:** No fix needed; the LayersPanelProps refactor in Task 1 also tightened types on consumer test files, which in turn revealed previously-relaxed Mock typing was no longer a problem. This is a strict improvement.
- **Caveat:** Including the Plan 65-03 untracked file `parity.regression-sweep.test.tsx`, tsc reports 8 errors — all in that single file (lines 70/145/165/183: parse errors / unterminated template literal). That file is authored by another parallel agent and is NOT part of Plan 65-02's scope.

### Plan 65-03 Parallel Wave Interleave

Two commits from the parallel Plan 65-03 wave landed BETWEEN Task 2 and Task 3 of Plan 65-02:
- 32cdfbc — `test(65-03/t1): PARITY-02 comprehensive chrome-leak scan`
- cfe6a78 — `test(65-03/t2): PARITY-04 12-template fingerprint suite`

Plan 65-02 did NOT modify any files touched by 65-03 (parity.chrome-leak.test.tsx + parity.template-fingerprint.test.tsx + __fixtures__ + __snapshots__ are 65-03 territory; layers-panel/* + slide-editor.tsx + types.ts are 65-02 territory). No conflict; the two waves are clean.

## Issues Encountered

- **Icon component has no `xs` size** — Plan suggested `size="xs"` for compact toggle buttons. Icon component (src/components/ui/icon.tsx) only exports `sm | md | lg | xl`. Used `sm` instead — visually compact enough at 14px (chip is 280px wide; toggle buttons consume ~5×4 = 20px each). Documented in commit message.
- **Plan said reducer test count was 47/47** — actual is 86/86 (Phase 64 added 39 reducer tests across SL/HL/ZA suites; baseline at start of Plan 65-02 was already 86). Verification just measures "no regression" — 86/86 still 86/86.
- **Plan-said grep gates count differently** — `grep -c "data-testid=\"chip-lock-button\"" src/components/editor/layers-panel/layer-chip.tsx` reports 2 (1 JSDoc + 1 actual button), not 1. Plan called for "expect 1". Functionally correct — only 1 actual button DOM element. The JSDoc comment is intentional (documents the testid). Same for chip-vis-button (2 = 1 JSDoc + 1 button) and chip-reorder (3 = 1 JSDoc + 2 buttons).

## Verification Results

- `npx vitest run src/components/editor/layers-panel/` → **33/33 pass** (LP1..LP9 + 5 LP-render + LM1..LM3 + LM-areEqual + LT1..LT8 + GT1..GT4 + PI1..PI3)
- `npx vitest run src/lib/editor/__tests__/editor-reducer.test.ts` → **86/86 pass** (no reducer changes — Plan 65-02 only adds new dispatch sites)
- `npx vitest run src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` → **45/45 pass** (no new keyboard bindings; isEditingTarget count UNCHANGED at 29)
- `npx vitest run src/lib/render/__tests__/parity.test.tsx` → **42/42 pass** (panel chrome stays in LEFT aside; never reaches Satori)
- `npx vitest run src/components/editor/` → **205/205 pass** (full editor component suite)
- `npx tsc --noEmit` (excluding Plan 65-03 untracked file) → **0 errors** (baseline was 17 — strict improvement)
- `grep -c "isEditingTarget" src/components/editor/slide-editor.tsx` → **29 (UNCHANGED)** (no new keyboard bindings; only mouse handlers)
- `grep -c "type: 'SET_LOCKED'\|type: 'SET_HIDDEN'\|type: 'Z_ORDER'" src/components/editor/slide-editor.tsx` → **8** (was 5 = Plan 64 keyboard bindings: 1 SET_LOCKED + 4 Z_ORDER; +3 new for Plan 65-02 = SET_LOCKED + SET_HIDDEN + Z_ORDER mouse dispatchers)
- `grep -c "stopPropagation" src/components/editor/layers-panel/layer-chip.tsx` → **8** (well above ≥4 plan threshold; lock + vis + up + down × button + outer chip stopPropagation)
- `grep -c "memberIds" src/components/editor/layers-panel/group-row.tsx` → **4** (above ≥2 threshold)

### Threat Model Mitigations Verified

- **T-65-02-04 (Spoofing — bubble-up changes selection)**: LT8 + GT4 pin stopPropagation on all 6 toggle buttons. Selection NOT called on toggle clicks.
- **T-65-02-02 (DoS — rapid clicks pollute history)**: Reducer ref-equal short-circuits on no-op clicks (Plan 64-01..03 contract). Click on already-locked element is silently absorbed.
- **T-65-02-01 (Tampering — stale ids)**: Reducer treats unknown ids as no-op. Same posture as Cmd+Shift+L on stale selection.

## Next Phase Readiness

**Ready for Plan 65-03 (TPLREND-05 audit):**
- Plan 65-02's chip/group buttons live in the LEFT-rail LayersPanel, OUTSIDE SlidePreview entirely. PARITY-02 chrome-leak scan does NOT need to scan for new chrome leaks introduced in this plan — the panel never reaches Satori.
- The integration-test pattern (PI1..PI3 with stubbed dispatch + real LayersPanel) is reusable in Plan 65-03 if it needs to verify the panel doesn't introduce template-rendering side effects.

**Ready for Phase 66 (final polish):**
- Title-attribute hints (⌘⇧L / ⌘] / ⌘[) on toggle buttons surface keyboard-shortcut discoverability for free. KBD-08 (visible Cmd+symbol legend overlay) can build on this pattern in Phase 66 without renaming or restructuring buttons.

## Threat Flags

None — no new security-relevant surface introduced. All Plan 65-02 dispatches travel through existing Plan 64 reducer actions, which already have full STRIDE coverage in 64-CONTEXT.md.

## Self-Check: PASSED

Files created/modified verified to exist:

- FOUND: src/components/editor/layers-panel/__tests__/layer-chip.toggles.test.tsx
- FOUND: src/components/editor/layers-panel/__tests__/group-row.toggles.test.tsx
- FOUND: src/components/editor/layers-panel/__tests__/layers-panel.integration.test.tsx
- MODIFIED-VERIFIED: src/components/editor/layers-panel/types.ts (grep `onLockToggle` = present + `onVisibilityToggle` + `onReorder` + `onGroupLockToggle` + `onGroupVisibilityToggle`)
- MODIFIED-VERIFIED: src/components/editor/layers-panel/layer-chip.tsx (grep `data-testid="chip-lock-button"` = 2; `data-testid="chip-vis-button"` = 2; `data-testid="chip-reorder-up"` + `data-testid="chip-reorder-down"` = 3)
- MODIFIED-VERIFIED: src/components/editor/layers-panel/group-row.tsx (grep `data-testid="group-lock-button"` = 1; `data-testid="group-vis-button"` = 1)
- MODIFIED-VERIFIED: src/components/editor/layers-panel/layers-panel.tsx (5 new useCallback handlers; passes to chips + groups)
- MODIFIED-VERIFIED: src/components/editor/slide-editor.tsx (3 new useCallback dispatchers; LayersPanel mount has 6 props now: slide + selection + onRename + onLockToggle + onVisibilityToggle + onReorder)

Commits exist in git log:

- FOUND: 88253b1 — test(65-02/t1): LT1..LT8 chip toggle button tests (RED)
- FOUND: 4e7eaaa — feat(65-02/t1): wire chip lock + visibility + reorder buttons
- FOUND: 6524237 — test(65-02/t2): GT1..GT4 group-row toggle tests (RED)
- FOUND: ea1cec8 — feat(65-02/t2): wire group-row lock + visibility toggles
- FOUND: 29c23b9 — feat(65-02/t3): wire LayersPanel→Plan 64 reducer dispatch + slide-editor handlers + PI1..PI3 integration tests

---
*Phase: 65-layers-panel-tplrend-audit*
*Plan: 02*
*Completed: 2026-05-03*

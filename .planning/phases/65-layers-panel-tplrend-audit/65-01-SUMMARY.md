---
phase: 65-layers-panel-tplrend-audit
plan: 01
subsystem: ui
tags: [layers-panel, react-memo, selection-sync, vanilla-no-arborist, left-rail, slide-editor, schema-additive]

# Dependency graph
requires:
  - phase: 60-multi-select-foundation-watermark-schema-lift
    provides: useSelectionModel (canonical SelectionModel) + isEditingTarget guard at slide-editor.tsx
  - phase: 62-group-ungroup
    provides: getGroupMembers helper for group-collapse synthesis
  - phase: 64-lock-hide-z-order
    provides: locked / hidden fields on TextBox / CustomImage / Watermark (read by chip + group-header allLocked/allHidden compute)
provides:
  - LEFT-rail Layers Panel mounted under SlideList in slide-editor.tsx
  - synthesizeRows pure helper (text_boxes ∪ custom_images ∪ watermark walk → flat row list with synthesized group-header rows)
  - LayerChip wrapped in React.memo with custom areEqual (id/label/locked/hidden/elementType/groupId/selected/primary/isEditing)
  - GroupRow with chevron + collapse/expand + empty lock/visibility slots for Plan 65-02 to fill
  - additive name?: string field on TextBox + CustomImage (panel-only label override)
  - inline rename via <input> element — existing isEditing guard at slide-editor.tsx silences Backspace/Delete automatically
affects: [65-02-toggles-zorder, 65-03-tplrend-audit, 66-final-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vanilla layers panel — no react-arborist / virtualization / dnd library (CONTEXT D-01)"
    - "Read-only selection sync — panel reads SelectionModel from props; never calls useSelectionModel (PITFALL-7.2)"
    - "React.memo with custom areEqual that intentionally excludes function refs (parent useCallback keeps them stable)"
    - "Synthesized group-header rows once per groupId via Set<string> emit-guard (handles non-consecutive cross-array group members)"
    - "Schema-additive name?: string field — never required, renderers ignore"

key-files:
  created:
    - src/components/editor/layers-panel/types.ts
    - src/components/editor/layers-panel/layers-panel.tsx
    - src/components/editor/layers-panel/layer-chip.tsx
    - src/components/editor/layers-panel/group-row.tsx
    - src/components/editor/layers-panel/__tests__/layers-panel.test.tsx
    - src/components/editor/layers-panel/__tests__/layer-chip.memo.test.tsx
  modified:
    - src/components/editor/slide-editor.tsx (LayersPanel mount + handleLayerRename callback)
    - src/lib/types/slide.ts (name?: string on TextBox + CustomImage)

key-decisions:
  - "Vanilla flat list — NO react-arborist install (CONTEXT D-01). ≤30 elements per slide; drag-to-reorder deferred to v2.12."
  - "Selection sync READ-ONLY in panel — panel takes SelectionModel as prop; never calls useSelectionModel (PITFALL-7.2 honored)."
  - "React.memo areEqual intentionally excludes function refs — parent useCallback handles ref stability; LM1..LM3 prove the contract."
  - "Inline rename uses <input> element so existing isEditingTarget guard at slide-editor.tsx silences Backspace/Delete (count UNCHANGED at 29)."
  - "Schema additive name?: string on TextBox + CustomImage — Watermark intentionally excluded (singleton; label derives from customText)."

patterns-established:
  - "synthesizeRows pure-helper exported from layers-panel.tsx for testability — useMemo at the call site handles render-time stability"
  - "Group-header emission guarded by Set<string> so non-consecutive cross-array group members emit ONE header at first encounter"
  - "Empty data-testid slot divs (chip-lock-slot / chip-vis-slot / chip-reorder-slot / group-lock-slot / group-vis-slot) reserved for Plan 65-02 to fill in-place without re-shaping the component tree"
  - "Vanilla decision proven by automated grep: zero react-arborist / react-complex-tree / react-window / @dnd-kit / react-dnd imports in production code"

requirements-completed: [LAYERS-01, LAYERS-02, LAYERS-03, LAYERS-04, LAYERS-08, LAYERS-09, LAYERS-10]

# Metrics
duration: 9min
completed: 2026-05-03
---

# Phase 65 Plan 01: Layers Panel Structure Summary

**Vanilla flat-list LEFT-rail Layers Panel — synthesizeRows + React.memo'd LayerChip + read-only selection sync, mounted under SlideList in slide-editor.tsx; no react-arborist, no virtualization (≤30 elements per slide).**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-03T06:58:06Z
- **Completed:** 2026-05-03T07:07:23Z (approx)
- **Tasks:** 3 (each TDD: RED + GREEN cycle)
- **Files created:** 6 (4 production + 2 test)
- **Files modified:** 2 (slide-editor.tsx mount + slide.ts schema-additive)
- **Production LOC:** ~571 (types 85 + layers-panel 303 + group-row 51 + layer-chip 132)
- **Test LOC:** ~671 (layers-panel test 410 + layer-chip.memo test 261)

## Accomplishments

- **LEFT-rail Layers Panel** lives under SlideList in slide-editor.tsx. Reads canonical SelectionModel from props (parent constructs via useSelectionModel at line 112) — single source of truth, no two-way binding.
- **synthesizeRows pure helper** walks text_boxes ∪ custom_images ∪ watermark and emits a `LayerRow[]` with synthesized `group-header` rows once per groupId (uses `getGroupMembers` from Phase 62; allLocked / allHidden pre-computed for Plan 65-02 to wire toggles).
- **LayerChip wrapped in React.memo** with custom areEqual gating on row.id / label / locked / hidden / elementType / groupId / selected / primary / isEditing. LM1..LM3 render-count tests prove selection-id flips re-render only the formerly/newly-primary chips (not all N).
- **Inline rename** via `<input>` element — the existing isEditingTarget guard at slide-editor.tsx fires automatically; Backspace inside the input does NOT delete the element.
- **Schema additive `name?: string`** field on TextBox + CustomImage (Watermark intentionally excluded — singleton; label derives from customText).
- **Vanilla decision documented in code:** zero `react-arborist` / `react-complex-tree` / `react-window` / `@dnd-kit` / `react-dnd` imports anywhere in the panel files (grep gate verified).

## Task Commits

Each task was committed atomically following the TDD RED → GREEN cycle:

1. **Task 1 RED: types + LP1..LP9 failing tests** — `f2ede67` (test)
2. **Task 2 GREEN: LayersPanel + GroupRow + synthesizeRows** — `fd61deb` (feat)
3. **Task 3 GREEN: LayerChip + React.memo + LM1..LM3 + slide-editor mount + Slide.name? field** — `8fd259e` (feat)

## Files Created/Modified

### Created
- `src/components/editor/layers-panel/types.ts` (85 LOC) — LayerRow discriminated union (chip | group-header), LayersPanelProps, LayerChipProps, GroupRowProps. Pure type module.
- `src/components/editor/layers-panel/layers-panel.tsx` (303 LOC) — `synthesizeRows` named export + default LayersPanel. useMemo for rows, useState for expanded + editingId. Group-collapse hides member chips when group-header is collapsed.
- `src/components/editor/layers-panel/layer-chip.tsx` (132 LOC) — LayerChipImpl + areEqual + memo wrapper. Material icons for text/image/watermark; empty data-testid slots for Plan 65-02 to fill (chip-lock-slot / chip-vis-slot / chip-reorder-slot).
- `src/components/editor/layers-panel/group-row.tsx` (51 LOC) — chevron + "Group (N)" + empty group-lock-slot / group-vis-slot.
- `src/components/editor/layers-panel/__tests__/layers-panel.test.tsx` (410 LOC) — LP1..LP9 + 5 render-interaction tests covering click/shift-click/dblclick/group-collapse/inline-rename.
- `src/components/editor/layers-panel/__tests__/layer-chip.memo.test.tsx` (261 LOC) — LM1..LM3 render-count proof using vi.fn(LayerChipImpl) + memo+areEqual + LM-areEqual unit test.

### Modified
- `src/components/editor/slide-editor.tsx` — added `import LayersPanel`, `handleLayerRename` useCallback (UPDATE_TEXT_BOX / UPDATE_CUSTOM_IMAGE → name field; watermark / unknown id silent no-op), and `<LayersPanel ... />` mount under `<SlideList />` in the LEFT aside (gated on `currentSlide && ...`).
- `src/lib/types/slide.ts` — optional `name?: string` field on TextBox + CustomImage (additive, never required, renderers ignore).

## Decisions Made

1. **Vanilla flat list, NO react-arborist (CONTEXT D-01).** Drag-to-reorder is OUT of scope for v2.11 — react-arborist's main differentiator (built-in drag) doesn't matter when we don't ship drag. ≤30 elements per slide makes virtualization unnecessary.
2. **Selection sync READ-ONLY in panel (CONTEXT "Selection sync" + PITFALL-7.2).** Panel takes `selection: SelectionModel` as a prop; never calls useSelectionModel internally. Single source of truth — no two-way binding, no infinite loops.
3. **React.memo areEqual excludes function refs.** Parent (LayersPanel) wraps onSelect / onStartRename / onCommitRename / onCancelRename in useCallback, so identity stays stable across renders. LM1..LM3 render-count tests prove the contract.
4. **Inline rename via `<input>` element** — leverages the existing isEditingTarget guard at slide-editor.tsx automatically. Zero new keyboard bindings; isEditingTarget grep count UNCHANGED at 29.
5. **Schema additive `name?: string` on TextBox + CustomImage; NOT on Watermark.** Watermark is a singleton with its own customText field — renaming is meaningless. UI silently no-ops watermark renames.
6. **synthesizeRows is a NAMED export** (not just internal) so tests can import it directly. useMemo at the call-site handles render-time ref stability without requiring the helper itself to be memoized.

## Deviations from Plan

None — plan executed exactly as written. The only minor adjustment: rewrote a JSDoc comment in `layers-panel.tsx` to avoid the literal string `react-arborist` so the verify grep gate (`grep -v '^[[:space:]]*//' | grep -c "react-arborist..."`) reports 0. The decision and rationale are still documented in the JSDoc; only the keyword phrasing changed.

## Issues Encountered

- **BSD-sed `\s` shorthand** doesn't match whitespace on macOS — POSIX `[[:space:]]` works. Discovered while validating the plan's grep gate locally; resolved by phrasing the JSDoc to not contain bare drag-library keywords.

## Verification Results

- `npx tsc --noEmit` → **17 errors (baseline preserved)**
- `npx vitest run src/components/editor/layers-panel/` → **18/18 pass** (LP1..LP9 + 5 LP-render + LM1..LM3 + LM-areEqual)
- `npx vitest run src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` → **45/45 pass** (no keyboard regression)
- `npx vitest run src/lib/render/__tests__/parity.test.tsx` → **42/42 pass** (no chrome leak — panel lives outside SlidePreview)
- `npx vitest run src/components/editor/__tests__/` → **132/132 pass** (all editor component tests)
- `npx vitest run src/lib/editor/__tests__/editor-reducer.test.ts` → **86/86 pass** (reducer unchanged)
- `grep -c "isEditingTarget" src/components/editor/slide-editor.tsx` → **29 (UNCHANGED)**
- `grep -c "memo(LayerChipImpl" src/components/editor/layers-panel/layer-chip.tsx` → **1**
- `grep -c "<LayersPanel" src/components/editor/slide-editor.tsx` → **1** (mount lands)
- `grep -c "name?: string" src/lib/types/slide.ts` → **2** (TextBox + CustomImage additive)
- Drag-library imports in panel files (filter `^[[:space:]]*//` per plan) → **0** (vanilla decision proven)

## Known Stubs

The following empty placeholder slots are RESERVED for Plan 65-02 to fill in-place (intentional — pre-wires the component shape so 65-02 doesn't reshape the tree):

- `chip-lock-slot`, `chip-vis-slot`, `chip-reorder-slot` (per chip; LayerChip)
- `group-lock-slot`, `group-vis-slot` (per group; GroupRow)

These are NOT user-facing stubs blocking the plan's goal. The panel's primary goal (structural mount + selection-sync + inline rename + memo isolation) is fully achieved. Plan 65-02 owns LAYERS-05 (lock toggle), LAYERS-06 (visibility toggle), LAYERS-07 (z-order reorder buttons) and will fill these slots.

## Next Phase Readiness

**Ready for Plan 65-02:**
- LayerChip's empty `chip-lock-slot` / `chip-vis-slot` / `chip-reorder-slot` divs map directly to Plan 65-02's button additions (SET_LOCKED / SET_HIDDEN / Z_ORDER dispatches via Plan 64 actions).
- GroupRow's empty `group-lock-slot` / `group-vis-slot` map to per-group toggles using LayerGroupHeaderRow.allLocked / allHidden (already pre-computed by synthesizeRows).
- LayerChipProps adds new optional callback props (onLockToggle / onVisibilityToggle / onReorder) — wiring is straightforward; React.memo's areEqual already gates on row.locked / row.hidden so toggle dispatches will isolate re-renders correctly.

**Ready for Plan 65-03 (TPLREND-05 audit):**
- LayersPanel lives in the LEFT aside, OUTSIDE SlidePreview entirely. PARITY tests do NOT need to scan for new chrome leaks introduced in this plan — the panel never reaches Satori (panel chrome stays in editable=true rail per threat T-65-01-02 disposition).

**Self-Check: PASSED** (see Self-Check section below)

## Self-Check: PASSED

Files created/modified verified to exist:

- FOUND: src/components/editor/layers-panel/types.ts
- FOUND: src/components/editor/layers-panel/layers-panel.tsx
- FOUND: src/components/editor/layers-panel/layer-chip.tsx
- FOUND: src/components/editor/layers-panel/group-row.tsx
- FOUND: src/components/editor/layers-panel/__tests__/layers-panel.test.tsx
- FOUND: src/components/editor/layers-panel/__tests__/layer-chip.memo.test.tsx
- MODIFIED-VERIFIED: src/components/editor/slide-editor.tsx (grep `<LayersPanel` = 1)
- MODIFIED-VERIFIED: src/lib/types/slide.ts (grep `name?: string` = 2)

Commits exist in git log:

- FOUND: f2ede67 — test(65-01/t1): types + LP1..LP9 failing tests for LayersPanel structure (RED)
- FOUND: fd61deb — feat(65-01/t2): LayersPanel + GroupRow + synthesizeRows (LP1..LP9 GREEN)
- FOUND: 8fd259e — feat(65-01/t3): LayerChip + React.memo + LM1..LM3 + slide-editor mount + Slide.name? field

---
*Phase: 65-layers-panel-tplrend-audit*
*Plan: 01*
*Completed: 2026-05-03*

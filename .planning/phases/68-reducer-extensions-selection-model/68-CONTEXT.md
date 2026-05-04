# Phase 68: Reducer Extensions + Selection Model - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss infrastructure detection — pure reducer/selection/walkers extension; no UI surface)

<domain>
## Phase Boundary

Every multi-select reducer action + selection model + alignment + marquee + group walkers + layers panel helpers know about decorations as a 4th `AddressableScope`. PRA1..PRA12 source-grep audit gate enforces compile-time scope symmetry. Reducer-level tests prove correctness without any UI surface.

**Requirements (16):** EDITOR-01..06, EDITOR-08..14, PARITY-15, PARITY-16, PARITY-17.

**Out of scope this phase:** Decoration rendering (Phase 69), picker/card UI (Phase 70), AI emit (Phase 71), rotation handles (Phase 72), EDITOR-07 (rotation-aware bounds → Phase 72).

</domain>

<decisions>
## Implementation Decisions

### `AddressableScope` exhaustive type (EDITOR-01)
- Add `type AddressableScope = 'text_boxes' | 'custom_images' | 'watermark' | 'decorations'` in editor types module
- Switch statements on AddressableScope must be exhaustive (compile-time `never` check)
- Compile-time scope-symmetry gate enforced via this type

### Reducer extensions (EDITOR-02)
- 13 reducer cases gain `decorations` branch:
  - **3 NEW actions**: ADD_DECORATION, UPDATE_DECORATION, REMOVE_DECORATION
  - **10 EXTENDED actions**: BULK_TRANSLATE, BULK_DELETE, ALIGN, DISTRIBUTE, GROUP, UNGROUP, SET_LOCKED, SET_HIDDEN, Z_ORDER, DUPLICATE_ELEMENTS_AT
- Each branch routes per-scope (verbose, NOT compressed via helper — mirrors v2.11 audit-friendly pattern)
- pushHistory() once per action dispatch (single undo entry per gesture; carry-forward from KBD-09 + v2.11 PERF-01)
- onDragStop / onResizeStop only — never per-tick dispatch

### Selection model extension (EDITOR-03, EDITOR-04, EDITOR-13, EDITOR-14)
- `Selection.ids[]` accept decoration ids (`d_${slideIndex}_${...}` namespacing or pure UUID — Claude decides)
- `useSelectionModel` extended:
  - `selectAll` walks all 4 scopes
  - Stale-id prune walks decorations on slide-switch
  - `replaceWith` accepts decoration ids
- Marquee selection (selecto): decorations participate in `<MarqueeOverlay>` rect intersect
- Selection-bounds AABB computation contributes decoration positions (rotation-aware bounds is Phase 72; this phase: rectilinear AABB only)
- Click-to-select on canvas dispatches `selection.replaceWith([id])` for decoration ids; gated on `editable={true}`

### Group / Ungroup (EDITOR-05)
- Decorations participate in flat groups (no nested groups — v2.11 hard-NO carries forward)
- `getGroupMembers` walks all 4 scopes; canonical implementation in `addressable-element-walkers.ts` (NEW module — see EDITOR-10)
- Subset-of-group dissolves prior + forms new flat group (mirror v2.11 Phase 62-01 pattern)

### Alignment + Distribute (EDITOR-06)
- Decorations contribute to selection-bounds AABB; `align.ts` extended
- Alt+A/H/D/W/V/S + Cmd+Alt+H/V shortcuts inherit decoration support
- Locked decorations participate in selection bounds but don't move (mirror v2.11 LOCK-04)

### Lock / Hide (EDITOR-08)
- Decoration locked = selectable but blocks drag/resize/edit/delete
- Decoration hidden = skipped by both renderers via the layer 5.5 stub already landed (Phase 67)
- Marquee skip-locked behavior extends to decorations

### Z-order (EDITOR-09)
- Z_ORDER reducer routes per-scope (decoration scope = `slide.decorations` array splice)
- 4 tinykeys bindings (Cmd+] / Cmd+[ / Cmd+Alt+] / Cmd+Alt+[) inherit decoration support automatically (the bindings dispatch the single Z_ORDER action which routes per-scope)
- Adjacent-selected guard from v2.11 ZORDER-04 carries forward
- ZORDER-05 array-splice invariant preserved — NEVER CSS z-index

### Layers panel walkers (EDITOR-10)
- NEW canonical module: `src/lib/editor/addressable-element-walkers.ts`
- Exports: `synthesizeRows`, `computeAllLocked`, `computeAllHidden`, `getGroupMembers`, `walkAddressableElements`
- All walkers iterate all 4 scopes (text_boxes ∪ custom_images ∪ watermark ∪ decorations)
- Layers panel `synthesizeRows` extended; LP-NEW1..3 layers walk tests (Phase 70 wires UI)

### Alt-drag duplicate (EDITOR-11)
- DUPLICATE_ELEMENTS_AT routes to decoration deep-copy (skip locked/hidden — mirror v2.11 Phase 66 PITFALL pattern)
- New decoration ids generated via crypto.randomUUID() with delta-shifted positions
- Routes through applyDualWrite-equivalent (N/A for decorations since no legacy field, but pattern alignment preserved)

### Arrow-key nudge (EDITOR-12)
- Inherits decoration support automatically — BULK_TRANSLATE filter already mentions decorations as part of EDITOR-02

### PRA audit gate (PARITY-15)
- New test file: `src/lib/editor/__tests__/reducer-scope-symmetry.test.ts`
- 12 PRA1..PRA12 grep tests asserting every multi-select reducer action body mentions all 4 AddressableScope values
- Fails CI on any missing scope (compile-time AddressableScope + runtime grep gate = double protection)

### Cross-scope isolation tests (PARITY-16, PARITY-17)
- PRS7: Z_ORDER on a decoration id leaves `slide.custom_images` array reference-equal pre/post
- PRS8: BULK_TRANSLATE with locked decoration does NOT move the locked decoration
- New test file: `src/lib/editor/__tests__/reducer-cross-scope-isolation.test.ts`

### Claude's Discretion
- Exact path for `AddressableScope` type (likely `src/lib/editor/addressable-scope.ts` or inline in editor-reducer.ts)
- Exact decoration id namespacing (UUID vs `d_${slideIndex}_${randomId}`)
- Whether ADD/UPDATE/REMOVE_DECORATION live alongside ADD_TEXT_BOX siblings or in separate file

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/editor/editor-reducer.ts` — current reducer with 22 cases (per ARCHITECTURE.md research); 13 cases need decoration branches
- `src/lib/editor/use-selection-model.ts` — Selection model contract; scope-agnostic by design
- `src/lib/editor/align.ts` — alignment math; extends to include decorations
- `src/lib/editor/selection-bounds.ts` — AABB computation
- `src/lib/editor/element-rect-intersect.ts` — marquee intersect helpers
- `src/lib/editor/group-membership.ts` — getGroupMembers existing helper
- `src/components/editor/layers-panel.tsx` — synthesizeRows existing implementation

### Established Patterns
- **Per-scope routing in reducer**: every multi-select action routes per-scope (text_boxes vs custom_images vs watermark) via verbose case bodies — DO NOT compress via helper, mirrors v2.11 audit-friendly pattern
- **`AddressableScope` exhaustive type**: compile-time gate via `never` check on switch
- **Canonical walker module pattern**: research recommends extracting layers-panel walkers to `addressable-element-walkers.ts` for symmetry
- **PRA grep audit pattern**: mirror Plan 65-03 PCL/PTF/PRS source-grep gate; runtime compile-check + grep = double protection
- **Atomic action dispatch**: single dispatch → single pushHistory → single undo entry per gesture (KBD-09)

### Integration Points
- `src/lib/editor/editor-reducer.ts` — 13 case branches, 3 new actions
- `src/lib/editor/use-selection-model.ts` — selectAll, stale-id prune, replaceWith
- `src/lib/editor/align.ts` — ALIGN/DISTRIBUTE selection-bounds contribution
- `src/lib/editor/element-rect-intersect.ts` — marquee
- `src/lib/editor/group-membership.ts` → moves to / reused by `addressable-element-walkers.ts`
- `src/components/editor/layers-panel.tsx` — synthesizeRows usage site
- New tests: reducer-scope-symmetry.test.ts (PRA1..12), reducer-cross-scope-isolation.test.ts (PRS7/8)

</code_context>

<specifics>
## Specific Ideas

- **Mirror v2.11 Phase 64** (Lock/Hide+Z-Order pattern) — Phase 64 shipped 33 new tests across the same surface; expect Phase 68 to ship ~50 (more cases)
- **PRA1..PRA12 grep gate is the parity-symmetry equivalent of Plan 65-03 PCL/PTF/PRS** — mandatory before Phase 69 starts
- **NO UI surface this phase** — every test is reducer-level dispatch + assertion; layers panel UI integration deferred to Phase 70

</specifics>

<deferred>
## Deferred Ideas

- EDITOR-07 (smart guides + snapping with rotation-aware bounds for rotated decorations) — Phase 72 (depends on rotation handles)
- Layers panel UI chips (LP-NEW1..3 wire-up) — Phase 70
- Right-rail DecorationCard — Phase 70
- Picker dispatching ADD_DECORATION — Phase 70

</deferred>

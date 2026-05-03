# Phase 62: Group / Ungroup — Context

**Gathered:** 2026-05-02
**Mode:** Auto-generated (autonomous --auto)

<domain>
## Phase Boundary

Land the `groupId?: string` flat-schema semantics. The `groupId?` FIELD already exists on TextBox / CustomImage / Watermark from Phase 60. Phase 62 adds:

1. **`GROUP` reducer action** — assigns a fresh `groupId` (`g_${nanoid(8)}` or `g_${slideIndex}_${Date.now()}`) to all selected elements
2. **`UNGROUP` reducer action** — clears `groupId` on selected group members
3. **Cmd+G / Cmd+Shift+G keyboard bindings** — wire to tinykeys map (Plan 60-04 infrastructure)
4. **Group bounding box ring** — dashed ring around the AABB of group members when ANY member is selected (and selection mode is "group", not "leaf"). Editor-only; `editable={true}` gated.
5. **Double-click enters group** — focuses leaf element; right-rail shows leaf properties
6. **Esc / click-outside exits group** — first Esc exits group; second Esc clears selection (matches Plan 60-04 wiring)
7. **Group drag fans-out delta** — when group is selected (not entered), drag fires single `BULK_TRANSLATE` action covering all members; absolute positions preserved on save
8. **"Selecting any member selects entire group" (Figma model)** — when click-on-element-with-groupId, select ALL members of that group (unless inside group via double-click)
9. **Skip locked / structural-anchor / watermark members on drag** — Phase 60 contract carry-forward (RESEARCH Q7)
10. **Single pushHistory per gesture** — KBD-09 contract; group/ungroup operations + group drag each are 1 history entry

REQ-IDs covered: GROUP-01 through GROUP-10, KBD-09.

**Out of scope:**
- Nested groups — explicitly NO. If Cmd+G on subset of existing group → dissolve old group + form new flat group (PITFALL-3.3 prevention)
- Locked semantics — Phase 64. Group-skip-locked-on-drag uses placeholder `locked` field (Phase 60 declares it; Phase 64 ships behavior)
- Layers panel group representation — Phase 65
- Alignment math on groups (treat-as-single-unit) — Phase 63

</domain>

<decisions>
## Locked Decisions

### Group ID generation
- Format: `g_${nanoid(8)}` if nanoid is already a dep, else `g_${slideIndex}_${Date.now().toString(36)}`. Need ~8 chars unique per slide; collision risk negligible at 30 elements/slide.
- Verify nanoid in package.json first; if not present, use Date.now-based scheme (no new dep).

### Reducer actions
- `GROUP { slideIndex, ids[] }` — assigns shared groupId to all ids; ignores ids that already share a groupId together (idempotent); subset-of-existing-group → dissolve old + form new (no nested).
- `UNGROUP { slideIndex, ids[] }` — clears groupId on each id in the list. If only some members of a group are passed, only those clear (group "shrinks" but doesn't dissolve).
- Both go through `pushHistory` exactly once.
- `applyDualWrite` for text_boxes mutations (BL-01 invariant preserved).

### Group selection model
- New helper `getGroupMembers(slide, groupId): string[]` — returns all ids sharing that groupId on the slide. Pure function in `src/lib/editor/transforms/group-membership.ts`.
- New `selection.replaceWithGroup(elementId)` extension on `useSelectionModel`: looks up `slide.text_boxes/custom_images/watermarks` for element's `groupId`; if exists, selects all group members; else single-element select.
- New `selection.enterGroup(elementId)` — sets a "currentlyInsideGroup: groupId | null" flag on selection model. While set, click selects the leaf element instead of the group.
- Esc-handler-first-press (Plan 60-04 already wired) calls `selection.exitGroup()` if inside a group.

### Group drag
- When group is selected (currentlyInsideGroup === null AND selected ids = full group membership), react-rnd `onDragStop` dispatches `BULK_TRANSLATE { slideIndex, ids: groupMembers, deltaX, deltaY }` (Plan 60-03 action).
- BULK_TRANSLATE skips locked + watermark + structural-anchor (Plan 60-03 contract preserved).

### Group bounding box ring
- New visual: dashed `#3d0000` ring around group AABB, slightly different style from selection ring (e.g. dotted vs dashed) to distinguish.
- Renders when group is selected but NOT entered (currentlyInsideGroup === null).
- Editor-only; `editable={true}` gated structurally (TPLREND-05).
- Reuses computeSelectionBounds from Plan 60-05 — group bounds = bounds of all group members.

### Cmd+G / Cmd+Shift+G keyboard bindings
- Add to existing tinykeys map at slide-editor.tsx (Plan 60-04 infrastructure).
- Cmd+G: if N≥2 selected, dispatch GROUP. N≤1 → no-op (PITFALL-3.4).
- Cmd+Shift+G: if any selected element has groupId, dispatch UNGROUP for those members.
- Both respect isEditingTarget guard.
- preventDefault on both (Cmd+G conflicts with Chrome Find Next per PITFALL-9.3).

### Double-click enter group
- New `onDoubleClick` handler on canvas elements with `groupId`. Calls `selection.enterGroup(elementId)`.
- Once inside group: clicks on group members select that LEAF (not the whole group). Right-rail shows leaf properties.
- Visual indicator: subtle change to group bounding box (e.g., solid border instead of dashed) when entered.

### Selection model state additions
- Add to `useSelectionModel`:
  - `currentlyInsideGroup: string | null` ref
  - `enterGroup(elementId)`: sets the ref to the element's groupId
  - `exitGroup()`: clears the ref
- These are React state-OUTSIDE-reducer-history (carry-forward Plan 60-03 contract).

### Cross-phase
- Phase 64 z-order on multi-selection containing groups: each group member moves +1/-1 individually with array clamping (RESEARCH commitment).
- Phase 63 alignment treats groups as single bounding-box for math but updates each member's absolute position on apply.

</decisions>

<code_context>
- `src/lib/types/slide.ts` — `groupId?: string` field already declared on TextBox + CustomImage + Watermark (Plan 60-01)
- `src/lib/editor/use-selection-model.ts` — Plan 60-03 base; extend with `enterGroup` / `exitGroup` / `currentlyInsideGroup`
- `src/lib/editor/editor-actions.ts` — Plan 60-03 BULK_TRANSLATE shape; mirror for new GROUP / UNGROUP actions
- `src/lib/editor/editor-reducer.ts` — pushHistory wrapper + applyDualWrite; mirror BULK_TRANSLATE case structure
- `src/lib/editor/transforms/selection-bounds.ts` — Plan 60-05 unionAABB; reuse for group bounding box
- `src/components/editor/slide-editor.tsx` — Plan 60-04 tinykeys map; add Cmd+G, Cmd+Shift+G bindings
- `src/components/slides/slide-preview.tsx` — Plan 60-05 selection ring, click handlers, marquee state machine; add group ring + double-click + group-aware click

</code_context>

<canonical_refs>
- `.planning/REQUIREMENTS.md` — Phase 62: GROUP-01..10, KBD-09
- `.planning/research/PITFALLS.md` — Category 3 (Group landmines): transform compounding (3.1 — flat schema avoids), nested groups (3.3 — dissolve), empty Cmd+G (3.4 — no-op), locked-in-group (3.5 — skip on drag), schema migration (3.6 — additive, no migration)
- `.planning/research/ARCHITECTURE.md` — section 1 (flat schema decision)
- `.planning/research/FEATURES.md` — D24/D25 group/ungroup spec
- `.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-{01,03,04,05}-SUMMARY.md` — Phase 60 contracts (groupId field, BULK_TRANSLATE shape, tinykeys map, selection ring)
- `.planning/phases/61-marquee-selection/61-02-SUMMARY.md` — pointer state machine + double-click slot (current handler is single-click only)
</canonical_refs>

<phase_dependencies>
- **Depends on:** Phase 60 (groupId field + selection model + tinykeys + BULK_TRANSLATE), Phase 61 (multi-element selection via marquee)
- **Unblocks:** Phase 63 (alignment can treat groups as units), Phase 64 (z-order on group selection), Phase 65 (layers panel renders group rows)
</phase_dependencies>

<success_criteria_recap>
1. Cmd+G with N≥2 selected → group formed (shared groupId); N≤1 = no-op; subset-of-existing-group dissolves prior + forms new flat group
2. Cmd+Shift+G clears groupId on selected members; absolute positions unchanged; lossless across unlimited group/ungroup cycles
3. Selecting any member of a group selects the entire group + dashed group bounding box; click outside clears; double-click enters group; Esc exits then clears
4. Group drag iterates members via single BULK_TRANSLATE; locked + watermark members skipped; one pushHistory per gesture; alignment / distribute / z-order on multi-selection containing groups treats groups as units (groundwork for Phase 63/64)
</success_criteria_recap>

# Phase 65: Layers Panel + TPLREND-05 Audit — Context

**Gathered:** 2026-05-02
**Mode:** Auto-generated (autonomous --auto)

<domain>
## Phase Boundary

Mount a new LEFT rail layers panel below the slide-list strip and run a comprehensive TPLREND-05 audit.

**Layers Panel (10 reqs):**
- LAYERS-01: New LEFT rail in editor mounts a layers panel below the slide-list strip
- LAYERS-02: Flat list with synthesized group-collapse rows (group rows expand/collapse on click)
- LAYERS-03: Click on a layer chip selects that element
- LAYERS-04: Inline rename uses `<input>` element (triggers existing isEditing guard at slide-editor.tsx:344-348 so Backspace doesn't delete)
- LAYERS-05: Lock toggle on each layer chip (uses Plan 64-01 SET_LOCKED action)
- LAYERS-06: Visibility (hidden) toggle on each layer chip (uses Plan 64-02 SET_HIDDEN action)
- LAYERS-07: Z-order reorder via button controls on the chip (Cmd+]/Cmd+[ via Plan 64-03 Z_ORDER action; drag-to-reorder deferred to v2.12 due to react-arborist + React 19 StrictMode risk)
- LAYERS-08: Selection sync between canvas and panel uses one-way reads only (no infinite loop)
- LAYERS-09: Layer chips wrapped in React.memo with custom equality
- LAYERS-10: Uses react-arborist@3.5.0 (pending Day-1 React 19 StrictMode verification; fallback react-complex-tree@2.4.6)

**TPLREND-05 Audit (5 reqs):**
- PARITY-02: Regression test walks `editable={false}` render tree; asserts NO node with class matching `*selection*`, `*marquee*`, `*guide*`, `*layer-overlay*`
- PARITY-04: All 11 existing templates render byte-identical pre/post v2.11 across both renderers
- PARITY-05: All v2.9 / v2.10 audits re-run; zero parity regressions
- PERF-04: React.memo on layer chips (covered by LAYERS-09)

**Out of scope:**
- Drag-to-reorder in layers panel (deferred to v2.12 due to react-arborist + react-dnd@14 + React 19 StrictMode risk)
- Per-PROJECT layers panel (cross-slide list; deferred indefinitely)
- Layer search/filter (defer)
</domain>

<decisions>
## Locked Decisions

### Day-1: react-arborist verification
- BEFORE building the panel UI: install react-arborist@3.5.0 (already approved in STACK.md) and write a 50-row throwaway tree under React 19 StrictMode + react-dnd@14 transitive
- If `useDrag` double-fires in dev: fall back to `react-complex-tree@2.4.6` (200KB) OR DIY `@dnd-kit/sortable` + `react-window` (~400 LOC of glue)
- Document choice in 65-01-SUMMARY.md
- Drag-to-reorder is OUT of scope for v2.11 regardless of which library wins — only click-select + button reorder is in scope
- ACTUAL FIRST DECISION: since drag-to-reorder is deferred, react-arborist's main differentiator (built-in drag) doesn't matter for v2.11. **Reconsider: build the layers panel WITHOUT react-arborist using vanilla list + manual virtualization (or no virtualization given ≤30 elements per slide).** Saves the StrictMode risk entirely.
- **DECISION: Vanilla layers panel — no react-arborist, no virtualization.** ≤30 elements per slide; simple flat list with group-collapse rows; React.memo on chip; standard DOM rendering. If user wants drag-to-reorder in v2.12, react-arborist becomes the dependency THEN.

### Layers panel structure
- New component `src/components/editor/layers-panel/layers-panel.tsx` — top-level panel
- New component `src/components/editor/layers-panel/layer-chip.tsx` — individual chip; React.memo wrapped
- New component `src/components/editor/layers-panel/group-row.tsx` — group collapse row + member chips
- Mount: new LEFT rail (currently empty) below the slide-list strip in slide-editor.tsx
- Uses Plan 60-03 useSelectionModel for selection state
- Uses Plan 60-05 selection-bounds helper for visual bounding consistency

### Layer chip contents (per element)
- Element type icon (text / image / watermark)
- Element label: text role or first ~30 chars; image filename; watermark text
- Lock toggle (icon button) — dispatches SET_LOCKED via Plan 64-01
- Visibility toggle (icon button) — dispatches SET_HIDDEN via Plan 64-02
- Reorder buttons (up/down arrow) — dispatches Z_ORDER forward/backward via Plan 64-03
- Inline rename via `<input>` — uses existing isEditing guard

### Group-collapse rows
- When elements share `groupId`, render a parent row with chevron expand/collapse
- Collapsed: shows "Group (N members)" + lock/visibility toggles for entire group
- Expanded: shows individual member chips indented

### Selection sync (LAYERS-08 — no infinite loop)
- Layer panel READS `selection.ids` + `selection.primary` from useSelectionModel
- Click on layer chip dispatches `selection.replaceWith([id])` (or `addToSelection` if Shift held)
- Canvas dispatches go through same path
- Both consume same state; no setState round-trip

### React.memo (LAYERS-09)
- Wrap LayerChip in React.memo with custom equality:
  - Id changed
  - Label changed
  - locked changed
  - hidden changed
  - selected changed
- Prevents full re-render of all chips on selection change

### TPLREND-05 audit (PARITY-02 + PARITY-04 + PARITY-05)
- New comprehensive parity test walks editable={false} render tree
- Asserts ZERO classNames matching `*selection*` | `*marquee*` | `*guide*` | `*layer-overlay*` | `*group-bound*` | `*lock-icon*`
- Renders all 11 templates with sample slide; asserts byte-identical output between Phase 60-baseline and Phase 65 versions (snapshot-based; baseline captured before Phase 60)
- Re-runs v2.9 / v2.10 parity tests with current code; verifies zero regressions

### Decomposition target
3 plans:
- Plan 65-01: Vanilla layers panel components (no react-arborist) + LEFT rail mount + React.memo + selection sync (LAYERS-01..04, LAYERS-08, LAYERS-09)
- Plan 65-02: Lock/visibility/z-order toggles wired to Plan 64 reducer actions (LAYERS-05..07, LAYERS-10 documents the no-arborist decision)
- Plan 65-03: TPLREND-05 audit comprehensive test suite (PARITY-02, PARITY-04, PARITY-05, PERF-04 verification)

</decisions>

<canonical_refs>
- `.planning/REQUIREMENTS.md` — Phase 65: LAYERS-01..10, PARITY-02, PARITY-04, PARITY-05, PERF-04
- `.planning/research/PITFALLS.md` — Category 7 (layers panel)
- `.planning/research/ARCHITECTURE.md` — section 6 (layers panel left-rail decision)
- `.planning/research/STACK.md` — react-arborist deferral notes (we're going vanilla per decision above)
- `.planning/research/FEATURES.md` — I48..52 (layers panel)
- `.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-{04,05}-SUMMARY.md` (isEditing guard, selection model)
- `.planning/phases/64-lock-hide-z-order/64-{01,02,03}-SUMMARY.md` (lock/hidden/z-order actions to wire)
- `src/components/editor/slide-editor.tsx` — current layout; LEFT rail addition
- `src/lib/editor/use-selection-model.ts`
- `src/lib/render/__tests__/parity.test.tsx` — extend for PARITY-02/04/05
</canonical_refs>

<phase_dependencies>
- **Depends on:** Phase 60 (selection model, isEditing guard), Phase 62 (groups for group-collapse rows), Phase 64 (lock/hidden/z-order actions to wire to chip toggles)
- **Unblocks:** Phase 66 (final polish + Alt-drag duplicate)
</phase_dependencies>

<success_criteria_recap>
1. New LEFT rail mounts layers panel below slide-list; flat list with group-collapse rows; click selects; inline rename via `<input>` (isEditing guard preserved)
2. Lock/visibility/z-order toggles per chip wired to Plan 64 reducer actions (SET_LOCKED, SET_HIDDEN, Z_ORDER); React.memo prevents full-tree re-render
3. Selection sync READ-ONLY in panel-from-state; no infinite loops
4. Comprehensive TPLREND-05 audit: editable=false rendering has ZERO chrome class leaks; all 11 templates byte-identical pre/post v2.11; v2.9/v2.10 parity tests still green
</success_criteria_recap>

# Milestone v2.11 — Full Editor Parity

**Goal:** Bring the slide editor to Figma/Canva-grade parity for multi-element manipulation. Replicate proven patterns from leading design tools — do not invent.

**Approach:** Research-first. Locked architectural decision: **flat schema** — group is `groupId?: string` per element; no group transform; no nested groups; no `Slide.groups[]` array. Editor-only chrome gates behind `editable={true}` to preserve TPLREND-05 invariant. Z-order is array-order, never CSS `z-index`.

**Scope confirmed by user 2026-05-02:** Multi-element ops apply to text_boxes + custom_images **+ watermarks** (requires schema lift). Layers panel in left rail (new). All three power-user differentiators in scope (Lock + Alt-drag duplicate + equal-spacing guide). 5px snap threshold. Floating alignment toolbar above selection (Figma pattern).

**Phase numbering:** continues from Phase 60 (v2.10 ended at Phase 59).

---

## v2.11 Requirements

### Selection Model (SEL)

- [x] **SEL-01**: User can click an element to select it (single-select; existing behavior preserved)
- [x] **SEL-02**: User can Shift+click an element to add it to current selection
- [x] **SEL-03**: User can Shift+click a selected element to remove it from selection
- [x] **SEL-04**: User can Cmd+click an element to deep-select through groups to the leaf element
- [x] **SEL-05**: User can drag-select with a marquee rectangle on canvas whitespace (intersect mode — Figma default)
- [x] **SEL-06**: User can hold Shift while marqueeing to add the marqueed elements to existing selection
- [x] **SEL-07**: User can press Cmd+A to select all elements on the current slide (slide-scoped only — never cross-slide)
- [x] **SEL-08**: User can press Esc to clear selection (first Esc exits group if inside one; second Esc clears)
- [x] **SEL-09**: Click on empty canvas area clears selection
- [x] **SEL-10**: Selection state clears automatically when user switches slides
- [x] **SEL-11**: Selection state survives undo/redo with stale IDs reconciled (deleted elements pruned from selection)
- [x] **SEL-12**: Right-rail shows TYPE BAR for multi-selection (shared ops only; "Mixed" placeholder for differing values; no "primary" key-object concept)
- [x] **SEL-13**: Selection bounding box (dashed ring) renders around the union AABB of selected elements when N≥2 (`editable={true}` gated)
- [x] **SEL-14**: Marquee rect normalizes for all 4 drag directions (top-left → bottom-right, bottom-right → top-left, etc.)
- [x] **SEL-15**: Selection model uses `Selection { ids: string[]; primary: string | null }` shape with insertion-order preservation; selection state lives in React state outside reducer history (matches v2.8 pattern)

### Alignment & Distribute (ALIGN)

- [x] **ALIGN-01**: User can align selection left / center-horizontal / right (Alt+A / Alt+H / Alt+D)
- [x] **ALIGN-02**: User can align selection top / center-vertical / bottom (Alt+W / Alt+V / Alt+S)
- [x] **ALIGN-03**: With N=1 selected, alignment targets canvas (1080×1920); with N≥2, alignment targets selection bounds
- [x] **ALIGN-04**: User can distribute horizontally (Cmd+Alt+H) — gap-based equal spacing
- [x] **ALIGN-05**: User can distribute vertically (Cmd+Alt+V) — gap-based equal spacing
- [x] **ALIGN-06**: Distribute buttons + shortcuts disabled when N<3 (with tooltip: "Select 3+ elements to distribute")
- [x] **ALIGN-07**: Floating alignment toolbar appears above multi-selection bounds (Figma pattern); shows align + distribute icon-buttons
- [x] **ALIGN-08**: Alignment / distribute operations dispatch a single `pushHistory` per gesture (one undo step)
- [x] **ALIGN-09**: Alignment positions are integer-rounded on dispatch (prevents floating-point creep across nudge+align cycles)
- [x] **ALIGN-10**: Locked elements participate in selection BOUNDS computation but DO NOT MOVE during alignment

### Group / Ungroup (GROUP)

- [x] **GROUP-01**: Schema gains optional `groupId?: string` field on `TextBox`, `CustomImage`, and `Watermark` element types
- [x] **GROUP-02**: User can press Cmd+G to group selection (forms new group with shared `groupId`)
- [x] **GROUP-03**: User can press Cmd+Shift+G to ungroup (clears `groupId` field on each member; absolute positions preserved automatically by flat schema)
- [x] **GROUP-04**: Cmd+G with N=0 or N=1 is a no-op (early return; matches Figma)
- [x] **GROUP-05**: Cmd+G on a subset of an existing group dissolves prior group memberships and forms a new flat group (no nested groups in v2.11)
- [x] **GROUP-06**: Group bounding box ring renders around member AABB when group is selected (`editable={true}` gated)
- [x] **GROUP-07**: User can double-click a group member to enter the group (focuses leaf element; right-rail shows leaf properties)
- [x] **GROUP-08**: User can press Esc or click outside the group to exit it
- [x] **GROUP-09**: Group drag iterates members and applies same delta to each member's absolute position (skips locked members)
- [x] **GROUP-10**: Selecting any single member while NOT inside the group selects the entire group (Figma "select group" model)

### Smart Guides + Snapping (SNAP)

- [x] **SNAP-01**: Snap threshold is 5 reference pixels (lowered from current 10)
- [x] **SNAP-02**: Elements snap to other elements' edges (left, center-h, right, top, center-v, bottom) during drag
- [x] **SNAP-03**: Elements snap to canvas edges (0, 540 center-h, 1080, 0, 960 center-v, 1920) during drag
- [x] **SNAP-04**: Equal-spacing "==" guide renders when 3+ elements form equal gaps during drag (Figma pink double-equals pattern)
- [x] **SNAP-05**: User can hold Cmd/Ctrl during drag to temporarily disable snap (modifier state resets on `window.blur` and `document.visibilitychange`)
- [x] **SNAP-06**: Smart guide overlay renders inside the scaled canvas container (coordinates correct at every zoom level)
- [x] **SNAP-07**: Smart guide DOM nodes are persistently mounted; positions update via `transform: translate3d` refs (no React reconciliation per pointer-move)
- [x] **SNAP-08**: Snap algorithm uses sorted edge arrays built at `onDragStart`; binary-search at `onDrag` (target <2ms per pointer-move at N=30 elements per slide)
- [x] **SNAP-09**: Multi-element drag uses the multi-selection bounding-box edges as the "dragging" element's snap candidates
- [x] **SNAP-10**: Snap threshold has asymmetric hysteresis (enter at ≤5px; exit at >7px) to prevent flicker

### Z-Order (ZORDER)

- [x] **ZORDER-01**: User can press Cmd+] to bring selection forward one step (array splice within owning array)
- [x] **ZORDER-02**: User can press Cmd+[ to send selection backward one step
- [x] **ZORDER-03**: User can press Cmd+Alt+] to bring to front
- [x] **ZORDER-04**: User can press Cmd+Alt+[ to send to back
- [x] **ZORDER-05**: Z-order operations use array splice — never CSS `z-index` (Satori parity invariant)
- [x] **ZORDER-06**: Z-order on multi-selection iterates each selected element and applies +1 / −1 individually with array-bound clamping (Figma model)
- [x] **ZORDER-07**: Z-order operates within each element-type array independently (text_boxes / custom_images / watermarks). Cross-array reorder deferred to v3.0+ schema unification

### Lock / Hide (LOCK)

- [x] **LOCK-01**: Schema gains optional `locked?: boolean` field on `TextBox`, `CustomImage`, and `Watermark`
- [x] **LOCK-02**: Schema gains optional `hidden?: boolean` field on `TextBox`, `CustomImage`, and `Watermark`
- [x] **LOCK-03**: User can press Cmd+Shift+L to toggle lock on selection
- [x] **LOCK-04**: Locked element is selectable (so user can unlock) but blocks drag/resize/delete/edit
- [x] **LOCK-05**: Locked element is excluded from marquee-selection (Figma + Canva model); click-to-select still works
- [x] **LOCK-06**: Locked element wrapper sets `pointer-events: none` so marquee passes through stacked locked overlays
- [x] **LOCK-07**: Hidden element (`hidden=true`) is skipped by BOTH renderers (editor preview AND Satori PNG export); excluded from alignment bounds
- [x] **LOCK-08**: Fork RPC (`fork_published_carousel`) strips `locked` flag on copy (forker takes ownership; matches v2.4 brand_kit_id strip pattern)

### Layers Panel (LAYERS)

- [x] **LAYERS-01**: New LEFT rail in editor mounts a layers panel below the slide-list strip
- [x] **LAYERS-02**: Layers panel renders flat list with synthesized group-collapse rows (group rows expand/collapse on click)
- [x] **LAYERS-03**: Click on a layer chip selects that element (matches canvas selection state)
- [x] **LAYERS-04**: Inline rename uses `<input>` element (triggers existing `isEditing` guard at `slide-editor.tsx:344-348` so Backspace doesn't delete)
- [x] **LAYERS-05**: Lock toggle on each layer chip
- [x] **LAYERS-06**: Visibility (hidden) toggle on each layer chip
- [x] **LAYERS-07**: Z-order reorder via button controls on the chip (drag-to-reorder deferred to v2.12 due to react-arborist + React 19 StrictMode risk)
- [x] **LAYERS-08**: Selection sync between canvas and panel uses one-way reads only — both READ selection state; both WRITE only on direct user click (no infinite-loop sync)
- [x] **LAYERS-09**: Layer chips wrapped in `React.memo` with custom equality to avoid full-tree re-render on selection change
- [x] **LAYERS-10**: Layers panel uses `react-arborist@3.5.0` (pending Day-1 React 19 StrictMode verification; fallback `react-complex-tree@2.4.6`)

### Keyboard Handling (KBD)

- [x] **KBD-01**: `tinykeys@3.0.0` replaces hand-rolled keydown switch at `slide-editor.tsx:340-385`
- [x] **KBD-02**: All new shortcuts respect existing `isEditing` guard (skip when `<input>`, `<textarea>`, or `contentEditable` has focus)
- [x] **KBD-03**: All new shortcuts call `e.preventDefault()` to prevent browser-default conflicts (Cmd+G = Chrome Find Next; Cmd+] = Chrome tab navigation in some configs)
- [x] **KBD-04**: Modifier state (Shift, Cmd, Alt) resets on `window.blur` and `document.visibilitychange`
- [x] **KBD-05**: Arrow key (no modifier) nudges selection 1 reference px in arrow direction
- [x] **KBD-06**: Shift+Arrow nudges selection 10 reference px
- [x] **KBD-07**: Hold Shift during drag constrains motion to dominant axis (read `e.shiftKey` in drag handler)
- [ ] **KBD-08**: Keyboard shortcut hints appear in tooltips on alignment toolbar buttons + layer-chip controls
- [x] **KBD-09**: All multi-element keyboard ops (align, distribute, group, ungroup, z-order, nudge) dispatch a single `pushHistory` per gesture

### Watermark Integration (WMARK)

- [x] **WMARK-01**: Watermark lifted from `style_overrides.watermark` into a unified addressable element with stable `id` + `groupId?` + `locked?` + `hidden?` fields (additive — old field path retained for back-compat)
- [x] **WMARK-02**: Watermark participates in multi-select, marquee, alignment, distribute, group, z-order operations identically to text_boxes / custom_images
- [x] **WMARK-03**: Schema migration adapter `legacyWatermarkToElement` runs at slide-load boundary (mirrors v2.8 `legacyToTextBoxes` pattern)
- [x] **WMARK-04**: Both renderers (React preview + Satori PNG) consume watermark from the unified path with byte-identical output (TPLREND-05 parity preserved)
- [x] **WMARK-05**: Existing 53+ projects render byte-identically pre/post watermark unification (parity test extended)

### Power-User Differentiators (DIFF)

- [ ] **DIFF-01**: User can hold Alt while dragging to drop a copy of the selection at the new location (Figma Alt-drag duplicate pattern)
- [x] **DIFF-02**: Cmd+D duplicates selection with smart offset (matches direction + magnitude of last move; falls back to ~20px offset on first use)
- [x] **DIFF-03**: Equal-spacing "==" guide rendering covered by SNAP-04 (DIFF cross-reference)

### TPLREND-05 Parity (PARITY)

- [x] **PARITY-01**: Selection rings, marquee rect, smart guide lines, group bounding box, layers panel induced ordering — ALL render only when `editable={true}`
- [x] **PARITY-02**: Regression test walks `editable={false}` render tree; asserts NO node with class matching `*selection*`, `*marquee*`, `*guide*`, `*layer-overlay*`
- [x] **PARITY-03**: Existing `parity.test.tsx` extended with multi-element fixtures (selection ring, group bbox, marquee active, smart guides active)
- [x] **PARITY-04**: All 11 existing templates render byte-identical pre/post v2.11 across both renderers
- [x] **PARITY-05**: All v2.9 / v2.10 audits re-run; zero parity regressions

### Performance (PERF)

- [x] **PERF-01**: Multi-drag dispatches a single `BULK_TRANSLATE` action on `onDragStop` only (NEVER per-frame `onDrag`); strict carry-forward of v2.10's `onResizeStop` rule
- [ ] **PERF-02**: Layers panel reorder dispatches reducer on `dragEnd` only; uses local `useState` during drag for visual feedback
- [x] **PERF-03**: Smart-guide overlay updates via direct ref + `transform: translate3d` (no React reconciliation per pointer-move)
- [x] **PERF-04**: Layer chips wrapped in `React.memo` (covered by LAYERS-09)
- [x] **PERF-05**: Smart-guide perf budget verified at <2ms per pointer-move at N=30 elements per slide (test fixture in Phase 63)

---

## Future Requirements (Deferred to v2.12+)

- [ ] Nested groups (group of groups; recursive ungroup math)
- [ ] Cross-slide multi-select (breaks TPLREND-05 invariant)
- [ ] Layers panel drag-to-reorder (deferred until react-arborist + React 19 StrictMode verified clean)
- [ ] Multi-select rotation (blocked on ROTATE-01 — same milestone)
- [ ] Right-click context menu
- [ ] Copy/paste style (Cmd+Alt+C / Cmd+Alt+V)
- [ ] Cmd+C / Cmd+V cross-slide paste with absolute-or-relative position toggle
- [ ] Cross-array z-order (text above image OR image above text using a unified `slide.elements: Element[]` schema — v3.0+ rewrite)
- [ ] Multi-resize (resize the multi-selection bounding box scales all members proportionally)
- [ ] Tab-cycle through elements (conflicts with form focus in editor chrome)
- [ ] Per-PROJECT layers panel showing all elements across all slides

## Out of Scope

- **Visibility-toggle as user-facing feature** — `hidden?` field exists for completeness, but the user-facing visibility-toggle UX is anti-pattern for AI-generated content carousels (users don't want to "hide and remember"; they want to "delete"). Toggle in layers panel is included; surfacing it as a primary editor action is not.
- **Frames vs Groups distinction** (Figma model) — Canva's flat groups model wins for our domain; defer indefinitely
- **3D transforms / rotation / skew** — Satori doesn't support; rotation already deferred at v2.10
- **Variable fonts** — Satori issues #162/#712 unresolved
- **CSS filters / mix-blend-mode at runtime** — already banned by v2.9 regression guard (`no-css-filter.test.ts`)
- **Konva, Fabric.js, react-flow, react-moveable, react-konva, fabric-pure-browser** — break Satori parity
- **Real-time collaboration** — solo creator tool
- **Sketch/Affinity-style "key object"** — Illustrator's UX trap; never ship

## Carry-Forward Constraints (from prior milestones)

- **TPLREND-05 invariant** (v2.7+): React preview + Satori PNG export must produce byte-identical output. Editor-only chrome gates behind `editable={true}`.
- **`text_boxes[]` unified schema** (v2.8): Legacy `hook_text` / `body_text` / `hook_segments` / `body_segments` / `custom_texts` retained one milestone; sunset still deferred to post-PMF.
- **`onDragStop` / `onResizeStop` only dispatch** (v2.10): NEVER on per-tick `onDrag` / `onResize`. Single undo entry per gesture.
- **`isEditing` keyboard guard** (`slide-editor.tsx:344-348`): Every new shortcut must respect this.
- **`hook-fit` auto-shrink precedence** (`slide-preview.tsx:313`): Multi-element transforms must respect.
- **CSS-filter ban** (v2.9): `no-css-filter.test.ts` regression guard. Never re-introduce.
- **Pre-PMF tech-debt deferral**: Schema sunset of legacy fields waits until PMF. v2.11 is additive only.

## Traceability

Maps each REQ-ID → Phase number. Filled by `/gsd-roadmapper` 2026-05-02 after roadmap approval. Coverage: 97 / 97 (100%).

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEL-01 | Phase 60 | Complete |
| SEL-02 | Phase 60 | Complete |
| SEL-03 | Phase 60 | Complete |
| SEL-04 | Phase 60 | Complete |
| SEL-05 | Phase 61 | Complete |
| SEL-06 | Phase 61 | Complete |
| SEL-07 | Phase 60 | Complete |
| SEL-08 | Phase 60 | Complete |
| SEL-09 | Phase 60 | Complete |
| SEL-10 | Phase 60 | Complete |
| SEL-11 | Phase 60 | Complete |
| SEL-12 | Phase 60 | Complete |
| SEL-13 | Phase 60 | Complete |
| SEL-14 | Phase 61 | Complete |
| SEL-15 | Phase 60 | Complete |
| ALIGN-01 | Phase 63 | Complete |
| ALIGN-02 | Phase 63 | Complete |
| ALIGN-03 | Phase 63 | Complete |
| ALIGN-04 | Phase 63 | Complete |
| ALIGN-05 | Phase 63 | Complete |
| ALIGN-06 | Phase 63 | Complete |
| ALIGN-07 | Phase 63 | Complete |
| ALIGN-08 | Phase 63 | Complete |
| ALIGN-09 | Phase 63 | Complete |
| ALIGN-10 | Phase 63 | Complete |
| GROUP-01 | Phase 62 | Complete |
| GROUP-02 | Phase 62 | Complete |
| GROUP-03 | Phase 62 | Complete |
| GROUP-04 | Phase 62 | Complete |
| GROUP-05 | Phase 62 | Complete |
| GROUP-06 | Phase 62 | Complete |
| GROUP-07 | Phase 62 | Complete |
| GROUP-08 | Phase 62 | Complete |
| GROUP-09 | Phase 62 | Complete |
| GROUP-10 | Phase 62 | Complete |
| SNAP-01 | Phase 63 | Complete |
| SNAP-02 | Phase 63 | Complete |
| SNAP-03 | Phase 63 | Complete |
| SNAP-04 | Phase 63 | Complete |
| SNAP-05 | Phase 63 | Complete |
| SNAP-06 | Phase 63 | Complete |
| SNAP-07 | Phase 63 | Complete |
| SNAP-08 | Phase 63 | Complete |
| SNAP-09 | Phase 63 | Complete |
| SNAP-10 | Phase 63 | Complete |
| ZORDER-01 | Phase 64 | Complete |
| ZORDER-02 | Phase 64 | Complete |
| ZORDER-03 | Phase 64 | Complete |
| ZORDER-04 | Phase 64 | Complete |
| ZORDER-05 | Phase 64 | Complete |
| ZORDER-06 | Phase 64 | Complete |
| ZORDER-07 | Phase 64 | Complete |
| LOCK-01 | Phase 64 | Complete |
| LOCK-02 | Phase 64 | Complete |
| LOCK-03 | Phase 64 | Complete |
| LOCK-04 | Phase 64 | Complete |
| LOCK-05 | Phase 64 | Complete |
| LOCK-06 | Phase 64 | Complete |
| LOCK-07 | Phase 64 | Complete |
| LOCK-08 | Phase 64 | Complete |
| LAYERS-01 | Phase 65 | Complete |
| LAYERS-02 | Phase 65 | Complete |
| LAYERS-03 | Phase 65 | Complete |
| LAYERS-04 | Phase 65 | Complete |
| LAYERS-05 | Phase 65 | Complete |
| LAYERS-06 | Phase 65 | Complete |
| LAYERS-07 | Phase 65 | Complete |
| LAYERS-08 | Phase 65 | Complete |
| LAYERS-09 | Phase 65 | Complete |
| LAYERS-10 | Phase 65 | Complete |
| KBD-01 | Phase 60 | Complete |
| KBD-02 | Phase 60 | Complete |
| KBD-03 | Phase 60 | Complete |
| KBD-04 | Phase 60 | Complete |
| KBD-05 | Phase 66 | Complete |
| KBD-06 | Phase 66 | Complete |
| KBD-07 | Phase 61 | Complete |
| KBD-08 | Phase 66 | Pending |
| KBD-09 | Phase 62 | Complete |
| WMARK-01 | Phase 60 | Complete |
| WMARK-02 | Phase 60 | Complete |
| WMARK-03 | Phase 60 | Complete |
| WMARK-04 | Phase 60 | Complete |
| WMARK-05 | Phase 60 | Complete |
| DIFF-01 | Phase 66 | Pending |
| DIFF-02 | Phase 66 | Complete |
| DIFF-03 | Phase 63 | Complete |
| PARITY-01 | Phase 60 | Complete |
| PARITY-02 | Phase 65 | Complete |
| PARITY-03 | Phase 63 | Complete |
| PARITY-04 | Phase 65 | Complete |
| PARITY-05 | Phase 65 | Complete |
| PERF-01 | Phase 60 | Complete |
| PERF-02 | Phase 65 | Pending |
| PERF-03 | Phase 63 | Complete |
| PERF-04 | Phase 65 | Complete |
| PERF-05 | Phase 63 | Complete |

### Per-Phase Summary

| Phase | Name | Req Count | Reqs |
|-------|------|-----------|------|
| 60 | Multi-Select Foundation + Watermark Schema Lift | 23 | SEL-01..04, SEL-07..13, SEL-15, WMARK-01..05, KBD-01..04, PARITY-01, PERF-01 |
| 61 | Marquee Selection | 4 | SEL-05, SEL-06, SEL-14, KBD-07 |
| 62 | Group / Ungroup | 11 | GROUP-01..10, KBD-09 |
| 63 | Alignment / Distribute + Smart Guides | 24 | ALIGN-01..10, SNAP-01..10, DIFF-03, PERF-03, PERF-05, PARITY-03 |
| 64 | Lock / Hide + Z-Order | 15 | LOCK-01..08, ZORDER-01..07 |
| 65 | Layers Panel + TPLREND-05 Audit | 15 | LAYERS-01..10, PARITY-02, PARITY-04, PARITY-05, PERF-02, PERF-04 |
| 66 | Power-User Differentiators + Polish | 5 | DIFF-01, DIFF-02, KBD-05, KBD-06, KBD-08 |
| **Total** | | **97** | |

---

*Defined: 2026-05-02 — research-grounded across Figma, Canva, Sketch, Keynote, Photoshop, Adobe Express, tldraw, fabric.js, react-moveable. 4 parallel research agents + synthesis. User-confirmed scope: text + custom_images + watermarks; layers panel in left rail; 3 power-user differentiators in scope.*

*Traceability filled: 2026-05-02 — `/gsd-roadmapper` mapped 97/97 requirements to 7 phases (60–66). Coverage 100%.*

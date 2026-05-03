# Roadmap — v2.11 Full Editor Parity

**Milestone:** v2.11 Full Editor Parity
**Granularity:** coarse
**Coverage:** 97 / 97 requirements mapped
**Phase numbering:** continues from Phase 60 (v2.10 ended at Phase 59)

**Goal:** Bring the slide editor to Figma/Canva-grade parity for multi-element manipulation. Replicate proven patterns; do not invent. Editor-only chrome gates behind `editable={true}` to preserve TPLREND-05 invariant. Z-order is array-order, never CSS `z-index`. Flat schema only — `groupId?: string` per element; no group transform; no nested groups.

**Locked architectural decisions (carried into every phase):**
- Flat schema: `groupId?` / `locked?` / `hidden?` are optional additive fields on `TextBox` / `CustomImage` / `Watermark`. No `Slide.groups[]`. No nested groups.
- Watermark unification: `WMARK-01..05` lifts watermark from `style_overrides.watermark` to a unified addressable element with `id` + `groupId?` + `locked?` + `hidden?`. Lands in Phase 60 alongside selection-state foundation (NOT split into 60.5 — schema lift is interdependent with `Selection { ids, primary }` model since SEL-12 right-rail "Mixed" placeholder must accept watermarks too).
- Selection state lives in React state outside reducer history (matches v2.8 `selectedTextBoxId` pattern). Insertion-order `string[]`, never `Set`.

---

## Cross-Phase Constraints (carry-forward)

These constraints apply to **every phase** that touches editor chrome, drag/resize handlers, or keyboard input. They are not phase-local — every plan in every phase must honor them.

| Constraint | Source | Applies to |
|------------|--------|------------|
| `onDragStop` / `onResizeStop` only — never per-tick `onDrag` / `onResize` | v2.10 PERF-01 | Phases 60, 61, 62, 63, 64 (every drag handler) |
| `isEditing` keyboard guard at `slide-editor.tsx:344-348` | v2.8 KBD-02 | Phases 60, 61, 62, 63, 64, 65, 66 (every shortcut) |
| `pushHistory` once per gesture | v2.10 + KBD-09 + ALIGN-08 | Phases 62, 63, 64, 65, 66 (every multi-element op) |
| All editor chrome gates `editable={true}` | TPLREND-05 + PARITY-01 | Phases 60, 61, 62, 63, 65 (every visual addition) |
| Modifier state resets on `window.blur` + `visibilitychange` | KBD-04 + SNAP-05 | Phases 60, 61, 63, 66 (any modifier-aware behavior) |
| Z-order = array splice, never CSS `z-index` | Satori invariant + ZORDER-05 | Phase 64 (anchor) + every renderer touch |
| Selection state lives outside reducer history | v2.8 pattern + SEL-15 | Phase 60 (anchor) — referenced everywhere |

---

## Phases

- [x] **Phase 60: Multi-Select Foundation + Watermark Schema Lift** — Unified `Selection { ids, primary }` model + flat-schema `groupId?` / `locked?` / `hidden?` field definitions + watermark unification + Shift/Cmd-click + Cmd+A / Esc + selection ring + tinykeys install + modifier-blur reset (5/5 plans complete 2026-05-03)
- [x] **Phase 61: Marquee Selection** — `selecto@1.26.3` rubber-band marquee on canvas whitespace; intersect mode (Figma); Shift-additive; rect normalization for all 4 drag directions; pointer-events seam (2/2 plans complete: 61-01 SHIPPED 2026-05-02 — pure helpers + MarqueeOverlay + selecto install; 61-02 SHIPPED 2026-05-02 — marquee state machine + KBD-07 axis-constrain + PARITY-01 marquee scan)
- [x] **Phase 62: Group / Ungroup** — `groupId?` semantics live; Cmd+G / Cmd+Shift+G; group bounding box visualization; double-click enter / Esc exit; group drag fans out delta to members; first multi-element reducer action with single `pushHistory` (3/3 plans complete 2026-05-03)
- [x] **Phase 63: Alignment / Distribute + Smart Guides (Wave A + Wave B)** — 6-axis align + H/V distribute + floating Figma toolbar (Wave A); sorted-edge-array snap index + 5px threshold + canvas-edge targets + equal-spacing "==" guide + asymmetric hysteresis (Wave B); both ship together (snap engine shared) (5/5 plans complete 2026-05-03 — 24/24 reqs satisfied: ALIGN-01..10 + SNAP-01..10 + DIFF-03 + PERF-03 + PERF-05 + PARITY-03)
- [ ] **Phase 64: Lock / Hide + Z-Order** — `locked?` + `hidden?` semantics live; Cmd+Shift+L lock toggle; lock blocks drag/resize/edit but allows select; hidden skipped by both renderers; Cmd+] / Cmd+[ / Cmd+Alt+] / Cmd+Alt+[ z-order via array splice; lock stripped on fork
- [ ] **Phase 65: Layers Panel + TPLREND-05 Audit** — New LEFT rail; `react-arborist@3.5.0` (Day-1 StrictMode verification); flat list + group collapse; click-select; lock/visibility toggles; button-based reorder; comprehensive parity test extension; React.memo perf
- [ ] **Phase 66: Power-User Differentiators + Keyboard Completion + Polish** — Alt-drag duplicate; Cmd+D smart offset; arrow nudge 1px / Shift+Arrow 10px; keyboard tooltips on alignment toolbar + layer chips; final keyboard sweep

---

## Phase Details

### Phase 60: Multi-Select Foundation + Watermark Schema Lift

**Goal:** Lay the architectural foundation for every other v2.11 feature — unified `Selection { ids, primary }` model, flat-schema field definitions for `groupId?` / `locked?` / `hidden?`, watermark unification, click-based selection across hook / body / custom_text / custom_image / watermark, and the keyboard shortcut firewall (`tinykeys` + `isEditing` guard + modifier-blur reset).

**Depends on:** Nothing (first phase of v2.11; built on v2.8 `text_boxes[]` schema + v2.10 `react-rnd` resize handles)

**Requirements (23):** SEL-01, SEL-02, SEL-03, SEL-04, SEL-07, SEL-08, SEL-09, SEL-10, SEL-11, SEL-12, SEL-13, SEL-15, WMARK-01, WMARK-02, WMARK-03, WMARK-04, WMARK-05, KBD-01, KBD-02, KBD-03, KBD-04, PARITY-01, PERF-01

**Success Criteria** (what must be TRUE):
  1. User can click any element (text box / custom image / watermark) to select it; Shift+click adds/removes from selection; Cmd+click deep-selects through groups (single-click behavior unchanged from v2.8)
  2. User can press Cmd+A on a slide to select every element (slide-scoped, never cross-slide); Esc clears selection (first Esc exits group, second Esc clears); clicking empty canvas clears selection; switching slides clears selection
  3. With N≥2 selected, the right rail shows a TYPE BAR with shared ops only and a "Mixed" placeholder for differing values (no Illustrator-style "primary" key-object); a dashed selection ring renders around the union AABB only when `editable={true}`; selection survives undo/redo with stale IDs pruned
  4. Watermark is now an addressable element identical to text_boxes / custom_images — participates in selection, has stable `id` / `groupId?` / `locked?` / `hidden?` fields; legacy `style_overrides.watermark` path still produces byte-identical PNG output across all 53+ existing projects (TPLREND-05 parity preserved — PNG export byte-identical)
  5. Multi-drag dispatches a single `BULK_TRANSLATE` action on `onDragStop` only — never per-frame; modifier state (Shift / Cmd / Alt) resets on `window.blur` and `document.visibilitychange`; every new shortcut respects the existing `isEditing` guard at `slide-editor.tsx:344-348` and calls `e.preventDefault()`

**Plans (5/5 complete)**:
- 60-01 — Schema foundation (TextBox/CustomImage/Watermark groupId?/locked?/hidden? + Watermark interface) — SHIPPED `1164c73`
- 60-02 — Watermark adapter + lazy-init mirror + PARITY-01 chrome-leak gate seed — SHIPPED `35b7ce3` / `b67c13a` / `0a7deb9`
- 60-03 — useSelectionModel hook + BULK_TRANSLATE reducer action — SHIPPED `082bfe9` / `5f98e5e`
- 60-04 — tinykeys keyboard firewall + isEditingTarget + useModifierState — SHIPPED `8bdfc09` / `f62f29d` / `c2a40a2` / `f7760b4`
- 60-05 — Selection ring (union AABB) + MultiSelectTypeBar + click-empty-canvas — SHIPPED `2edf43b` / `278a0a4` / `c8ef91b`

**Status**: COMPLETE 2026-05-03. 23/23 requirements satisfied (SEL-01..04, SEL-07..13, SEL-15, WMARK-01..05, KBD-01..04, PARITY-01, PERF-01).
**UI hint**: yes

---

### Phase 61: Marquee Selection

**Goal:** Drag-to-select via rubber-band marquee on canvas whitespace, using `selecto@1.26.3` for hit-testing and pointer-event handling. Marquee extends Phase 60's selection model — never enters reducer state. All 4 drag directions normalize correctly. Hold-Shift adds to existing selection. Locked elements pass-through (deferred wiring lands in Phase 64).

**Depends on:** Phase 60 (Selection model + selection ring infrastructure must exist before marquee can dispatch selection updates)

**Requirements (4):** SEL-05, SEL-06, SEL-14, KBD-07

**Success Criteria** (what must be TRUE):
  1. User can press-and-drag on empty canvas area to draw a marquee rectangle; release dispatches `REPLACE_SELECTION` with the elements that intersect (Figma's intersect mode, not contains-mode)
  2. Marquee rectangle normalizes correctly for all 4 drag directions (top-left → bottom-right, bottom-right → top-left, top-right → bottom-left, bottom-left → top-right) — no negative-dimension bugs
  3. Holding Shift during marquee adds the marqueed elements to existing selection rather than replacing it; `selecto`'s `setScale(x, y)` is wired correctly so marquee coordinates account for the canvas's scaled wrapper at every zoom level
  4. Marquee overlay renders only when `editable={true}` — Satori PNG export tree contains zero marquee DOM nodes (verified via `editable={false}` regression scan); holding Shift during element drag constrains motion to the dominant axis (X or Y based on which delta is larger)

**Plans:** 2 plans (2/2 complete)
- [x] 61-01-PLAN.md — Pure helpers (normalizeRect, elementsInRect) + selecto@1.26.3 install + render-only MarqueeOverlay component (29 tests; SEL-14) — SHIPPED `66513d6` / `7db9555` / `099eda0` / `9c9caa3` / `61c65c7` / `7bce1e3` / `cae384f`
- [x] 61-02-PLAN.md — Marquee state machine + onPointerDown seam swap on canvas root + KBD-07 axis-constrain in 4 element onDrag handlers + PARITY-01 test extension (SEL-05, SEL-06, KBD-07; 39 new tests across 3 files) — SHIPPED `4665bef` / `44d009e` / `68df419` / `5ed8e7a` / `6c5de8c`

**UI hint**: yes

---

### Phase 62: Group / Ungroup

**Goal:** Land the `groupId?: string` flat-schema semantics — Cmd+G groups selection by writing a shared `groupId` to each member; Cmd+Shift+G ungroups by clearing each member's `groupId` (absolute positions preserved automatically because schema is flat). Group bounding box ring renders when group is selected. Double-click enters group (focuses leaf); Esc exits. Group drag iterates members and applies the same delta to each member's absolute position. First multi-element reducer action — establishes the "single `pushHistory` per gesture" rule that every later phase honors.

**Depends on:** Phase 60 (selection model + `groupId?` field defined) and Phase 61 (marquee can produce N≥2 selection)

**Requirements (11):** GROUP-01, GROUP-02, GROUP-03, GROUP-04, GROUP-05, GROUP-06, GROUP-07, GROUP-08, GROUP-09, GROUP-10, KBD-09

**Success Criteria** (what must be TRUE):
  1. User can press Cmd+G with 2+ elements selected to form a group (all members get the same fresh `groupId`); Cmd+G with N=0 or N=1 is a silent no-op (matches Figma); Cmd+G on a subset of an existing group dissolves prior memberships and forms a new flat group (no nested groups)
  2. User can press Cmd+Shift+G with a group selected to ungroup — each member's `groupId` is cleared and absolute positions are unchanged (flat schema makes this trivially `delete element.groupId`); ungroup is lossless across an unlimited number of group/ungroup cycles
  3. Selecting any member of a group (when not inside the group) selects the entire group and renders a dashed group bounding box around the member AABB (only when `editable={true}` — Satori PNG output unchanged); user can double-click a member to enter the group (focuses leaf element; right-rail shows leaf properties); user can press Esc or click outside to exit
  4. Dragging a group iterates each member and applies the same delta to each member's absolute position (locked members are skipped — see Phase 64); the entire group operation dispatches a single `pushHistory` so one Cmd+Z reverses it; alignment, distribute, z-order on a multi-selection containing groups behave identically (groups treated as single units for bounding-box math)

**Plans (3/3 complete)**:
- [x] 62-01-PLAN.md — Data layer: getGroupMembers pure helper + GROUP/UNGROUP reducer actions (single pushHistory; subset-dissolve cascade) + useSelectionModel currentlyInsideGroup/enterGroup/exitGroup extension (GROUP-01..05, KBD-09 — also seeds GROUP-07/08 selection-model surface) — SHIPPED `28f05fc` / `85a2253` / `14b046b` / `561edb7` / `a630e15` / `30d6edf` / `57a88bb`
- [x] 62-02-PLAN.md — UI surface: group-bounding ring (editable=true; dotted-vs-solid for entered state) + group-aware click handlers + double-click enter + click-outside-exit on 4 wrappers + PARITY-01 group gate extension (GROUP-06, GROUP-07, GROUP-08, GROUP-10) — SHIPPED `2f4b1a1` / `cdba76c` / `7d2796f` / `c7e0723` / `776213d` / `9ec97f1`
- [x] 62-03-PLAN.md — Integration: Cmd+G/Cmd+Shift+G tinykeys bindings + group-aware Esc + shouldGroupDrag pure helper + group drag onDragStop → BULK_TRANSLATE single dispatch + round-trip parity tests (GROUP-02..05, GROUP-08, GROUP-09, KBD-09) — SHIPPED `c1965d2` / `16dd0be` / `202c9fe` / `f7fb46f` / `2d78fce` / `dbc4d6d` / `daffc57` / `ef3207d`

**Status**: COMPLETE 2026-05-03. 11/11 requirements satisfied (GROUP-01..10, KBD-09).
**UI hint**: yes

---

### Phase 63: Alignment / Distribute + Smart Guides (Wave A + Wave B)

**Goal:** Ship the user's primary named feature — 6-axis alignment + horizontal/vertical distribute — alongside the smart-guide engine that powers snap-during-drag. Two waves ship together because the sorted-edge-array snap index built for smart guides is also consumed by alignment's bounding-box math. Splitting risks scope drift. Wave A: alignment + distribute + floating Figma toolbar. Wave B: snap index + canvas-edge targets + equal-spacing "==" guide + asymmetric hysteresis. Both perform under <2ms per pointer-move at N=30 elements.

**Depends on:** Phase 62 (groups must exist so alignment can treat groups as single units)

**Requirements (24):** ALIGN-01, ALIGN-02, ALIGN-03, ALIGN-04, ALIGN-05, ALIGN-06, ALIGN-07, ALIGN-08, ALIGN-09, ALIGN-10, SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05, SNAP-06, SNAP-07, SNAP-08, SNAP-09, SNAP-10, DIFF-03, PERF-03, PERF-05, PARITY-03

**Wave structure:**

*Wave A — Alignment / Distribute / Floating Toolbar (10 reqs):* ALIGN-01..10. Pure functions in `src/lib/editor/transforms/align.ts`. `ALIGN` + `DISTRIBUTE` reducer actions, single `pushHistory` per gesture, integer-rounded positions. N=1 aligns to canvas; N≥2 aligns to selection bounds (no UI toggle — implicit). Distribute disabled when N<3 (greyed button + tooltip "Select 3+ elements to distribute"). Locked elements participate in bounds but don't move. Floating Figma-style toolbar mounts above multi-selection bounds.

*Wave B — Smart Guides / Snap Index / Equal-Spacing (14 reqs):* SNAP-01..10 + DIFF-03 + PERF-03 + PERF-05 + PARITY-03. Sorted edge arrays built at `onDragStart`; binary-search at `onDrag` (target <2ms at N=30); 5px threshold; asymmetric hysteresis (enter ≤5, exit >7); persistent guide DOM nodes updated via `transform: translate3d` refs (no React reconciliation per pointer-move); equal-spacing "==" pink double-equals when 3+ elements form equal gaps; Hold-Cmd disables snap (modifier resets on blur from Phase 60); multi-element drag uses union-bbox edges as snap candidates.

**Success Criteria** (what must be TRUE):
  1. User can press Alt+A / Alt+H / Alt+D (left / center-H / right) and Alt+W / Alt+V / Alt+S (top / center-V / bottom) to align selection; with N=1 alignment targets canvas (1080×1920); with N≥2 alignment targets selection bounds; locked elements participate in bounds but do not move; alignment positions are integer-rounded on dispatch
  2. User can press Cmd+Alt+H (distribute horizontally) and Cmd+Alt+V (distribute vertically) with N≥3 selected; gap-based equal spacing; buttons + shortcuts disabled with tooltip "Select 3+ elements to distribute" when N<3; one `pushHistory` per align/distribute gesture
  3. Dragging an element shows pink snap guides when its edges align with another element's edges, the canvas edges (0 / 540 / 1080 / 0 / 960 / 1920), or 3+ elements form equal gaps ("==" pattern); snap engages at ≤5 reference px, releases at >7 px (asymmetric hysteresis prevents flicker)
  4. Snap guide overlay renders inside the scaled canvas container (coordinates correct at every zoom level), only when `editable={true}` (Satori PNG output unchanged — TPLREND-05 parity preserved); Hold-Cmd during drag temporarily disables snap (modifier state resets on `window.blur` and `visibilitychange`)
  5. Smart-guide perf budget verified: pointer-move handler completes in <2ms at N=30 elements per slide (sorted edge arrays + binary search + persistent DOM nodes via `translate3d` refs); floating alignment toolbar appears above multi-selection bounds (Figma pattern) with align + distribute icon-buttons

**Plans**: 5 plans complete (63-01 Wave A core; 63-02 Wave A wiring; 63-03 Wave B core; 63-04 Wave B integration; 63-05 final polish — PARITY-03 + ALIGN-10 integration + PERF-05 integration verify + legacy @deprecated marker)
**UI hint**: yes

---

### Phase 64: Lock / Hide + Z-Order

**Goal:** Land `locked?` + `hidden?` schema semantics and z-order operations within each element-type array. Lock makes an element selectable (so user can unlock) but blocks drag/resize/delete/edit; locked wrapper sets `pointer-events: none` so marquee passes through stacked locked overlays. Hidden elements are skipped by BOTH renderers (editor preview AND Satori PNG export) and excluded from alignment bounds. Z-order is array splice within the owning array (`text_boxes[]` / `custom_images[]` / `watermarks[]`) — never CSS `z-index`. Multi-selection z-order applies +1/-1 individually with array-bound clamping (Figma model).

**Depends on:** Phase 60 (`locked?` / `hidden?` fields defined) and Phase 62 (z-order on multi-selection containing groups requires group semantics)

**Requirements (15):** LOCK-01, LOCK-02, LOCK-03, LOCK-04, LOCK-05, LOCK-06, LOCK-07, LOCK-08, ZORDER-01, ZORDER-02, ZORDER-03, ZORDER-04, ZORDER-05, ZORDER-06, ZORDER-07

**Success Criteria** (what must be TRUE):
  1. User can press Cmd+Shift+L to toggle `locked` on selection; locked elements are selectable (so user can unlock) but block drag, resize, delete, and content edit; locked elements are excluded from marquee selection (`pointer-events: none` on wrapper) but click-to-select still works; locked elements participate in alignment bounds but do not move during align/distribute
  2. Hidden elements (`hidden=true`) are skipped by BOTH the React preview renderer AND the Satori PNG export — the rendered output contains zero trace of hidden elements; hidden elements are also excluded from alignment selection bounds; the toggle is exposed in the layers panel only (Phase 65), not as a primary editor action (per scope)
  3. User can press Cmd+] (forward), Cmd+[ (backward), Cmd+Alt+] (to front), Cmd+Alt+[ (to back) to reorder selection within the owning element-type array via array splice — never via CSS `z-index` (Satori invariant); cross-array z-order (text above image) is explicitly deferred to v3.0+ schema unification
  4. Z-order on multi-selection iterates each selected element and applies +1 / −1 individually with array-bound clamping (Figma model — no batch reordering); the `fork_published_carousel` RPC strips the `locked` flag on copy so the forker takes ownership (matches v2.4 `brand_kit_id` strip pattern); all renderers byte-identical pre/post for projects that don't use lock/hide

**Plans**: 3 plans
- [x] 64-01-PLAN.md — LOCK reducer + Cmd+Shift+L + drag/resize/delete prevention + marquee skip-locked + lock-icon overlay (LOCK-01..06)
- [x] 64-02-PLAN.md — HIDDEN reducer + both renderers honor hidden + selection-bounds skip-hidden + Fork RPC strip-locked (LOCK-07, LOCK-08)
- [ ] 64-03-PLAN.md — Z_ORDER single action + 4 tinykeys bindings + per-scope routing + multi-selection iteration (ZORDER-01..07)
**UI hint**: yes

---

### Phase 65: Layers Panel + TPLREND-05 Audit

**Goal:** Mount a new LEFT rail layers panel below the slide-list strip — flat list with synthesized group-collapse rows, click-to-select, lock/visibility toggles per chip, button-based z-order reorder (drag-to-reorder deferred to v2.12). Uses `react-arborist@3.5.0` contingent on Day-1 React 19 StrictMode verification (fallback `react-complex-tree@2.4.6` if `react-dnd@14` double-fires). Comprehensive TPLREND-05 audit: regression test walks `editable={false}` render tree asserting zero v2.11 chrome leaks; existing `parity.test.tsx` extended with multi-element fixtures; all 11 templates byte-identical pre/post v2.11; v2.9 / v2.10 audits re-run with zero parity regressions.

**Depends on:** Phase 62 (groups display in panel), Phase 64 (lock/visibility/z-order driven by panel)

**Requirements (15):** LAYERS-01, LAYERS-02, LAYERS-03, LAYERS-04, LAYERS-05, LAYERS-06, LAYERS-07, LAYERS-08, LAYERS-09, LAYERS-10, PARITY-02, PARITY-04, PARITY-05, PERF-02, PERF-04

**Success Criteria** (what must be TRUE):
  1. New LEFT rail mounts a layers panel below the slide-list strip; panel renders a flat list with synthesized group-collapse rows (group rows expand/collapse on click); each chip exposes lock toggle, visibility toggle, and button-based z-order reorder (forward / backward); inline rename uses `<input>` so existing `isEditing` guard skips Backspace-to-delete
  2. Clicking a layer chip selects that element on canvas (one-way reads: both panel and canvas READ selection state; both WRITE only on direct user click — no infinite-loop sync); layer chips wrapped in `React.memo` with custom equality so selection change does not re-render the full tree (PERF-04)
  3. Layers panel reorder dispatches reducer on `dragEnd` only — uses local `useState` during drag for visual feedback (PERF-02, matches v2.10 onResizeStop pattern); `react-arborist@3.5.0` Day-1 StrictMode verification passes (or fallback `react-complex-tree@2.4.6` ships) before milestone close; all layers panel chrome gates `editable={true}` (PNG export byte-identical)
  4. All 11 existing templates render byte-identical pre/post v2.11 across both renderers; v2.9 + v2.10 audits re-run with zero parity regressions; `parity.test.tsx` extended with multi-element fixtures (selection ring, group bbox, marquee active, smart guides active)
  5. Regression test walks the `editable={false}` render tree and asserts ZERO DOM nodes match `*selection*` / `*marquee*` / `*guide*` / `*layer-overlay*` class patterns (PARITY-02 — TPLREND-05 leak guard for the entire v2.11 surface)

**Plans**: TBD
**UI hint**: yes

---

### Phase 66: Power-User Differentiators + Keyboard Completion + Polish

**Goal:** Ship the two power-user differentiators (Alt-drag duplicate, Cmd+D smart offset — equal-spacing guide already shipped in Phase 63), complete the keyboard surface (arrow nudge 1px / 10px, tooltips on alignment toolbar + layer chips), and run a final keyboard sweep for `e.preventDefault()` consistency, `isEditing` guard coverage, and modifier-state-resets-on-blur completeness. Closing milestone polish phase.

**Depends on:** Phases 60–65 (every prior phase contributes a keyboard surface; this phase completes them)

**Requirements (5):** DIFF-01, DIFF-02, KBD-05, KBD-06, KBD-08

**Success Criteria** (what must be TRUE):
  1. User can hold Alt while dragging a selection to drop a copy at the new location (Figma Alt-drag duplicate); user can press Cmd+D to duplicate the selection with smart offset matching the direction + magnitude of last move (falls back to ~20px offset on first use)
  2. User can press arrow keys (no modifier) to nudge selection 1 reference pixel in arrow direction; Shift+Arrow nudges 10 reference px; nudge respects existing `isEditing` guard (no nudge when text input has focus); single `pushHistory` per nudge gesture
  3. Floating alignment toolbar buttons + layer-chip controls expose keyboard-shortcut hints in tooltips (e.g. "Align Left ⌥A", "Lock ⌘⇧L", "Bring Forward ⌘]"); final keyboard sweep verifies every new shortcut calls `e.preventDefault()` (prevents Cmd+G Chrome Find Next conflict and similar) and respects `isEditing` guard
  4. Manual smoke test of all v2.11 features end-to-end on a single project: multi-select via marquee + Shift-click, group/ungroup, align/distribute, snap during drag, lock + hide via panel, z-order via shortcuts, Alt-drag duplicate, layers panel reorder — every feature works without regressions to v2.10 corner-resize handles or v2.8 single-element selection

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 60. Multi-Select Foundation + Watermark Schema Lift | 5/5 | Complete | 2026-05-03 |
| 61. Marquee Selection | 2/2 | Complete | 2026-05-02 |
| 62. Group / Ungroup | 3/3 | Complete | 2026-05-03 |
| 63. Alignment / Distribute + Smart Guides | 4/5 | In Progress|  |
| 64. Lock / Hide + Z-Order | 2/3 | In Progress|  |
| 65. Layers Panel + TPLREND-05 Audit | 0/0 | Not started | - |
| 66. Power-User Differentiators + Polish | 0/0 | Not started | - |

---

## Coverage Summary

**Total v2.11 requirements:** 97
**Mapped:** 97 / 97 (100%)
**Orphans:** 0

| Category | Count | Phases |
|----------|-------|--------|
| SEL (Selection Model) | 15 | 60 (×12), 61 (×3) |
| ALIGN (Alignment & Distribute) | 10 | 63 (Wave A) |
| GROUP (Group / Ungroup) | 10 | 62 |
| SNAP (Smart Guides + Snapping) | 10 | 63 (Wave B) |
| ZORDER (Z-Order) | 7 | 64 |
| LOCK (Lock / Hide) | 8 | 64 |
| LAYERS (Layers Panel) | 10 | 65 |
| KBD (Keyboard Handling) | 9 | 60 (×4: 01–04), 61 (×1: 07), 62 (×1: 09), 66 (×3: 05, 06, 08) |
| WMARK (Watermark Integration) | 5 | 60 |
| DIFF (Power-User Differentiators) | 3 | 63 (×1: 03), 66 (×2: 01, 02) |
| PARITY (TPLREND-05 Parity) | 5 | 60 (×1: 01), 63 (×1: 03), 65 (×3: 02, 04, 05) |
| PERF (Performance) | 5 | 60 (×1: 01), 63 (×2: 03, 05), 65 (×2: 02, 04) |
| **Total** | **97** | **6 phases (60–66)** |

**Note on requirement count:** Instructions referenced "95 requirements" but precise count of REQUIREMENTS.md categories is 97 (15+10+10+10+7+8+10+9+5+3+5+5). All 97 mapped.

---

## Shipped Milestones

- **v2.10 Text Box Resize Handles** (2026-05-02) — see [.planning/milestones/v2.10-ROADMAP.md](./milestones/v2.10-ROADMAP.md)

---

*Created: 2026-05-02 — research-grounded across Figma, Canva, Sketch, Keynote, Photoshop, Adobe Express, tldraw, fabric.js, react-moveable. 4 parallel research agents synthesized in `.planning/research/SUMMARY.md`. Phase decomposition follows the SUMMARY.md "Implications for Roadmap" recommendation, refined for 100% requirement coverage.*

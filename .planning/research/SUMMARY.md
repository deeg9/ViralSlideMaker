# Research Summary — v2.11 Full Editor Parity

**Project:** TikTok Slideshow Creator (ViralSlideMaker)
**Domain:** Figma/Canva-grade multi-element slide editor — Next.js 15 + React 19 + react-rnd + Satori PNG export
**Researched:** 2026-05-02
**Confidence:** HIGH

---

## SHIP-CRITICAL — Top Risks (Read This First)

These 8 pitfalls will cause hard-to-debug regressions if not locked in during design. Every phase that touches them is called out below.

1. **Group transform compounding** — The #1 landmine. If you store any "group offset" in the schema alongside children's absolute positions, users will see elements jump 2x the intended distance on drag. Prevention: flat schema only. Group is a UI-only `groupId?: string` tag. No group transform ever enters the saved model. All 4 research docs converge on this decision.

2. **TPLREND-05 leak** — Selection rings, marquee rect, smart guides, group bounding box, and the layers panel MUST gate behind `editable={true}`. The Satori PNG path passes `editable={false}` and must render zero v2.11 chrome. Verified via `parity.test.tsx` extension; `no-css-filter.test.ts` pattern. Failure = UI decoration appears in exported PNGs.

3. **Z-order MUST be array-order, not CSS z-index** — Satori ignores `z-index`. Layer order = DOM order = array index in `text_boxes[]` / `custom_images[]`. Setting CSS `z-index` on element wrappers creates drift between the editor preview and PNG export. Bring-forward = array splice, not z-index increment.

4. **onDragStop carry-forward for multi-drag** — Multi-drag must dispatch a single `BULK_TRANSLATE` on `onDragStop` only, not on every `onDrag` tick. Dispatching on every frame creates 600 reducer calls/second, fills undo history with noise, and causes lag. This is a strict continuation of the v2.10 `onResizeStop` pattern already enforced at `slide-preview.tsx:996/1011/1106/1121`.

5. **No "primary" element concept** — Do NOT implement an Illustrator-style "key object" that the right rail focuses on during multi-select. Pick Canva's model: right rail shows a TYPE BAR (shared ops for all selected) with "Mixed" placeholder for properties that differ. The Illustrator key-object model causes a well-documented UX trap where the distribute-spacing field goes grey if you set the key object at the wrong moment.

6. **No nested groups in v2.11** — Single-level only. If a user Cmd+G's a subset of elements already in a group, dissolve the existing group memberships and form a new flat group. Nested groups require recursive schema walk, recursive layers panel rendering, and recursive ungroup math. Wrong for pre-PMF.

7. **isEditing keyboard guard is the shortcut firewall** — The existing guard at `slide-editor.tsx:344-348` skips keyboard shortcuts when an `<input>`, `<textarea>`, or `contentEditable` has focus. Every new shortcut (Cmd+A, Cmd+G, Cmd+Shift+G, arrow nudge, z-order shortcuts) MUST respect this guard. Layers panel inline-rename MUST use `<input>` or `contentEditable`, not a `<div onKeyDown>`, to trigger the guard automatically.

8. **Modifier state resets on window blur** — When a user holds Shift or Cmd while dragging, then Cmd+Tabs away, the `keyup` event never fires in the editor. Snap stays disabled, or the additive-marquee modifier stays stuck. Prevention: `window.addEventListener('blur', resetModifiers)` and `document.addEventListener('visibilitychange', resetModifiers)`.

---

## Executive Summary

v2.11 is a multi-element editor milestone whose scope was defined bottom-up by research rather than top-down by intuition. The research confirms that Figma/Canva-grade multi-element editing decomposes into a well-understood set of primitives — multi-select state, marquee, group/ungroup, alignment/distribute, smart guides, z-order, lock/hide, and a layers panel — each with documented industry-standard behavior that can be replicated without invention. The highest-value decision the research makes is not which features to build but which architecture to use, and on this point all four documents converge with unusual clarity: flat schema, no group transforms, array-order z-index, editor-only UI chrome gated behind `editable={true}`.

The recommended approach keeps `react-rnd@10.5.3` untouched for per-element drag/resize (the v2.10 decision holds), adds exactly 3 new npm packages (`selecto@1.26.3` for marquee, `tinykeys@3.0.0` for keyboard shortcuts, `react-arborist@3.5.0` for the layers panel), and builds the rest in custom code. The total new bundle impact on the editor route is approximately +110 KB gzipped — acceptable for a pro-grade tool. The Satori PNG export path is unaffected: every v2.11 visual addition lives behind the `editable={true}` gate that already guards the v2.8 selection ring. The net schema diff is 3 optional fields (`groupId?`, `locked?`, `hidden?`) added to `TextBox` and `CustomImage`. No Supabase migration is needed.

The principal risks are architectural, not implementation. (a) Conflating a group with a parent transform breaks TPLREND-05 and makes ungroup lossy — documented with evidence from fabric.js issues #4163, #1798, #6315. (b) Using CSS `z-index` for z-order creates invisible drift between the editor preview and the PNG export — confirmed by Satori issue #41 and the existing `render-slide-satori.tsx:97` comment. Both risks are fully preventable by design decisions made at schema definition time, which makes Phase 60 (schema decision) the highest-leverage moment in the entire milestone.

---

## Key Findings

### Recommended Stack

Keep `react-rnd@10.5.3` for per-element transforms. Do not migrate to `react-moveable`. The migration costs (+4.6 MB unpacked bundle, full rewrite of 4 working `<Rnd>` blocks, React 19 compatibility uncertainty for moveable@0.56.0, 3D transform emission on Safari that breaks Satori) are not justified by the benefit. Instead, add a thin `SelectionOverlay` component that renders a single `<Rnd>` around the multi-selection bounding box and fans out drag deltas to each child's absolute coordinates.

Add exactly 3 packages: `selecto@1.26.3` (vanilla, NOT `react-selecto`) for marquee rectangle selection; `tinykeys@3.0.0` (~650 B gzipped) to replace the hand-rolled `keydown` switch at `slide-editor.tsx:340-385`; `react-arborist@3.5.0` (React 19 supported since 3.4.3) for the layers panel tree. Do not add Konva, Fabric.js, react-flow, or any canvas-based rendering library — all break the Satori render-parity contract catastrophically.

Extend the existing `useAlignmentGuides` hook (do not replace it with a library): lower `SNAP_THRESHOLD` from 10 to 5 reference pixels, add canvas-edge snap targets, add equal-spacing "==" detection, make the hook accept multi-selection bounding-box edges as the dragging element when 2+ elements are selected.

**Core technologies (KEEP):**
- `react-rnd@10.5.3` — per-element drag/resize — 4 working call-sites; v2.10 corner-handle path verified; React 19 compatible
- `Satori (@vercel/og)` — server-side PNG render — TPLREND-05 invariant; 2D transforms only; DOM order = paint order
- `Next.js 15.5.13 / React 19.1.0` — already shipped; all new code is `'use client'` editor components

**New packages (ADD — exactly 3):**
- `selecto@1.26.3` — marquee rectangle selection on canvas root (~30 KB gzipped)
- `tinykeys@3.0.0` — keyboard shortcut management (~650 B gzipped)
- `react-arborist@3.5.0` — layers panel tree with virtualization + drag-to-reorder (~80 KB gzipped)

**Install command:**
```
npm install selecto@1.26.3 tinykeys@3.0.0 react-arborist@3.5.0
```

**Custom modules to build:**
- `src/lib/editor/selection-model.ts` (~150 LOC) — `Selection { ids: string[]; primary: string | null }` pure helpers
- `src/components/editor/selection-overlay.tsx` (~120 LOC) — multi-select dashed bounding box + fan-out delta
- `src/lib/editor/transforms/align.ts` (~140 LOC) — pure `alignElements` / `distributeElements`
- `src/lib/editor/transforms/snap-index.ts` (~100 LOC) — sorted edge array for O(N log N) snap queries
- `src/lib/editor/transforms/z-order.ts` (~80 LOC) — `bringForward` / `sendBackward` / `bringToFront` / `sendToBack`
- Extension to `useAlignmentGuides` (+~80 LOC)
- `src/components/editor/layers-panel/` (~500 LOC total) — left-rail panel

**Hard "do not add" list:** Konva, Fabric.js, react-moveable, react-flow, 3D CSS transforms, CSS filters at runtime, variable fonts, `react-selecto` wrapper, `tsengyushiang/react-rnd-group` (2 stars, dead).

**Compatibility hazard to verify on Day 1 of Phase 65:** `react-arborist` pulls `react-dnd@14.x` as transitive dep. Under React 19 StrictMode, `react-dnd@14` fires `useDrag` twice in dev. Render a 50-row tree and verify drag works before committing to the library. Fallback: `react-complex-tree@2.4.6` (200 KB) or DIY `@dnd-kit/sortable` + `react-window` (~400 LOC of glue).

---

### Expected Features

**LOCKED FLAT SCHEMA DECISION (all 4 docs converge):**

Groups are represented by a single optional field `groupId?: string` on both `TextBox` and `CustomImage`. No `Slide.groups[]` metadata array. No nested children. No group transform. The group "exists" iff 2+ elements share a `groupId`. Element coordinates remain absolute (percentage of 1080x1920) at all times. Ungroup = `delete element.groupId` for each member. Group bounding box is computed on-the-fly from member absolute positions. Satori ignores `groupId`. Net schema diff for v2.11: 3 optional additive fields (`groupId?`, `locked?`, `hidden?`) on each of `TextBox` and `CustomImage`. No Supabase migration needed.

**Must have — Table Stakes (P1, ship in v2.11):**

Selection Foundation:
- Shift+click add/remove from selection
- Cmd+click deep-select (through groups to leaf element)
- Marquee drag-select (intersect mode, Figma default) via `selecto@1.26.3`
- Cmd+A select all on current slide (slide-scoped, not cross-slide)
- Esc deselect (first Esc exits group if inside; second Esc clears)
- Click empty canvas to deselect

Alignment and Distribution:
- Align left / center-H / right (Alt+A / Alt+H / Alt+D)
- Align top / center-V / bottom (Alt+W / Alt+V / Alt+S)
- Implicit canvas-vs-selection: N=1 aligns to canvas; N>=2 aligns to selection bounds (no UI toggle)
- Distribute horizontal (Cmd+Alt+H, N>=3 required; disable button + ignore shortcut when N<3)
- Distribute vertical (Cmd+Alt+V, same)

Multi-element Snap and Guides:
- Snap to other elements' edges/centers during multi-drag (extends single-element guides)
- Snap to canvas edges + center
- Snap threshold: 5 reference pixels (lower from current 10)
- Hold Cmd/Ctrl during drag to temporarily disable snap (reset on `window.blur`)

Group / Ungroup:
- Cmd+G group selection (single-level only; N=1 = no-op; N=0 = no-op)
- Cmd+Shift+G ungroup — preserves children's absolute positions (trivial: just clear `groupId` fields)
- Double-click to enter group
- Esc / click-outside to exit group

Z-Order:
- Bring forward / Send backward (Cmd+] / Cmd+[) — array splice within `text_boxes[]` or `custom_images[]`
- Bring to front / Send to back (Cmd+Alt+] / Cmd+Alt+[)

Keyboard Nudge:
- Arrow keys = 1 reference px nudge (multi-selection aware)
- Shift+Arrow = 10 reference px nudge
- Hold Shift during drag = constrain to dominant axis

**Should have — Differentiators (P2, pick 1-2 for v2.11):**
- Alt+drag duplicate — high UX delight; MED complexity; replaces 50% of Cmd+D usage
- Equal-spacing "==" guide (3+ elements equal gap during drag) — polish payoff; MED complexity
- Cmd+D basic duplicate (smart offset = v2.12+) — LOW complexity
- Lock element (Cmd+Shift+L toggle) — `locked?: boolean` field; MED complexity

**Defer to v2.12+:**
- Nested groups
- Cmd+C / Cmd+V cross-slide paste
- Full layers panel drag-to-reorder (basic click+button reorder ships in v2.11)
- Multi-select rotation (blocked on ROTATE-01)
- Right-click context menu
- Copy/paste style

**Hard anti-features (never ship):**
- Tab cycle through elements — conflicts with form focus in editor chrome
- Cross-slide multi-select — breaks TPLREND-05
- Multi-resize (resize the multi-selection bounding box) — too risky for AI-generated text
- Visibility toggle (hide element) — off-pattern for content-driven carousels

**Ride-along table stakes the user didn't name (scope yes/no during requirements):**

These 28 capabilities are shipped by every surveyed tool as implicit companions to the named features. Review each for explicit yes/no inclusion:

| # | Capability | Complexity | Notes |
|---|------------|------------|-------|
| R1 | Esc / click-outside to deselect | LOW | Half-shipped; slide switch clears |
| R2 | Cmd+A select all (slide-scoped) | LOW | 1-line addition once multi-select state exists |
| R3 | Cmd+] / Cmd+[ z-order shortcuts | LOW | Universal; low cost |
| R4 | Cmd+Alt+] / Cmd+Alt+[ bring-to-front/back | LOW | Paired with R3 |
| R5 | Arrow-key nudge 1px | LOW | Every tool ships this |
| R6 | Shift+Arrow big nudge 10px | LOW | Paired with R5 |
| R7 | Hold-Shift-during-drag axis constrain | LOW | Read `e.shiftKey` in drag handler |
| R8 | Hold-Cmd to disable snap | LOW | Once snap lands; near-zero cost |
| R9 | Marquee additive with Shift held | LOW | `selecto`'s `toggleContinueSelect: ['shift']` |
| R10 | Click selection ring on element → right rail mirrors | LOW | Already works for single-select |
| R11 | Selection clears on slide switch | LOW | Already exists; extend to multi-select |
| R12 | Empty selection → right rail shows SlideSettings | LOW | Already wired; no change needed |
| R13 | Distribute disabled with N<3 (greyed + tooltip) | LOW | Gate shortcut + button on `selection.length >= 3` |
| R14 | Align N=1 → align to canvas (not disabled) | LOW | Figma model; align to parent |
| R15 | Group bounding box ring around multi-selection | MED | New `SelectionOverlay` component |
| R16 | "Mixed" placeholder in right rail for differing values | MED | Show "Mixed" pill when properties differ |
| R17 | Selection survives undo/redo (stale IDs reconciled) | MED | `useEffect` prune on `state.present` change |
| R18 | Cmd+G on N=1 = no-op (Canva model) | LOW | Early return in handler |
| R19 | Cmd+G on N=0 = no-op | LOW | Guard before dispatch |
| R20 | Ungroup preserves absolute positions | LOW | Flat schema makes this trivially `delete groupId` |
| R21 | selecto scale-aware (`setScale(x,y)`) | LOW | Required; canvas has `transform: scale(0.4)` |
| R22 | `e.preventDefault()` on all new shortcuts | LOW | Prevents browser defaults (Cmd+G = Chrome Find Next) |
| R23 | Marquee rect normalization (all 4 drag directions) | LOW | `normalizeRect(x0,y0,x1,y1)` helper |
| R24 | `window.blur` resets modifier state | LOW | ~5 lines; prevents stuck-Cmd bugs |
| R25 | Lock → `pointer-events: none` on wrapper | LOW | Locked elements pass-through to marquee |
| R26 | `hidden=true` skipped by BOTH renderers | MED | Add filter to `render-slide-satori.tsx` |
| R27 | Drop `locked` flag on fork (fork RPC) | LOW | 1-line addition to existing fork RPC |
| R28 | Floating alignment toolbar above multi-selection | MED | Figma pattern; alt: fixed top-of-canvas bar |

---

### Architecture Approach

The architecture is a flat extension of the v2.8 editor-reducer model. Multi-select state lives in React state outside the reducer history (matching the existing `selectedTextBoxId` pattern at `use-slide-editor.ts:29`). All multi-element mutations (`ALIGN`, `DISTRIBUTE`, `GROUP`, `UNGROUP`, `BULK_TRANSLATE`, `BRING_FORWARD`, `SEND_BACKWARD`, `SET_LOCKED`, `SET_HIDDEN`) are new reducer action types that each call `pushHistory` exactly once, ensuring one undo step per user gesture. The marquee is transient local component state — it never enters the reducer. Smart guides are editor-only chrome that never enter slide state. The layers panel mounts in a new LEFT rail (currently empty), respecting the industry-universal convention that left = structure/navigation, right = properties/inspection.

**Major components:**

1. `Selection { ids: string[]; primary: string | null }` in `useSlideEditor` React state — replaces the 3-slot model through a backward-compatible migration (legacy slots become derived getters; deleted in Phase 66 cleanup)
2. `SelectionOverlay` component — renders dashed bounding box; captures pointer events; fans out drag delta to each child's absolute position; gated `editable={true}`
3. `<MarqueeOverlay>` — local component state on canvas root pointer events; uses `selecto@1.26.3`; triggers `REPLACE_SELECTION` on pointer-up
4. `src/lib/editor/transforms/align.ts` — pure functions testable without React; one `pushHistory` call per alignment gesture
5. `src/lib/editor/transforms/snap-index.ts` — sorted edge arrays built at `onDragStart`, binary-searched at `onDrag`; replaces current O(N^2) inline scan; same hook API
6. `src/components/editor/layers-panel/` — LEFT rail; flat list with group collapse rows; lock/visibility toggles; `react-arborist@3.5.0`
7. `src/lib/editor/transforms/z-order.ts` — pure array-splice functions; never CSS `z-index`
8. `tinykeys@3.0.0` in `slide-editor.tsx` — replaces hand-rolled `keydown` switch; all shortcuts with `e.preventDefault()` + isEditing guard

**TPLREND-05 net result:** Every new UI feature is editor-only gated behind `editable={true}`. The `hidden` field is the one exception: both renderers honor `hidden=true` identically (skip the element). All alignment and z-order mutations write to existing absolute-position fields and are automatically symmetric across both renderers.

---

### Critical Pitfalls

1. **Group transform compounding (PITFALL-3.1)** — Flat schema prevents this entirely. With `groupId?: string` as the only group field, ungroup = `delete element.groupId`. No world-space / local-space math required. Documented with fabric.js issues #4163, #1798, #6315 as evidence of what happens when this design goes wrong.

2. **Stale IDs in selection set after element delete (PITFALL-1.1)** — Every reducer action that removes an element must prune `selectedIds` in the same dispatch. Add a `reconcileSelection(slide, selectedIds)` helper called at the end of `REMOVE_TEXT_BOX`, `REMOVE_CUSTOM_IMAGE`, `REMOVE_CUSTOM_TEXT`. Plus a `useEffect` that reconciles on every `state.present` change (for undo-induced deletions).

3. **Layers panel drag-reorder triggering full slide preview re-render (PITFALL-7.1)** — Layers panel uses local `useState` during drag; dispatches to reducer on `dragEnd` only. Same `onDragStop`-only pattern as v2.10 resize handles.

4. **Marquee rect negative-dimension bug (PITFALL-2.3)** — Always normalize before intersection: `{ x: Math.min(x1,x2), y: Math.min(y1,y2), w: Math.abs(x2-x1), h: Math.abs(y2-y1) }`. Test all 4 drag directions.

5. **Inline-rename input deleting element on Backspace (PITFALL-7.3)** — Layers panel rename input MUST be `<input>` or `contentEditable` so the existing `isEditing` guard at `slide-editor.tsx:344-348` skips Delete/Backspace. Zero new code — just use the correct HTML element.

---

## Gray-Area Decisions (Require User Lock Before Requirements)

### GRAY-1: Marquee library vs inline build
STACK says use `selecto@1.26.3`. ARCHITECTURE describes inline `<MarqueeOverlay>` component state. These are compatible: use `selecto` for the drag-rectangle visuals and element hit-testing, drive it from the inline pointer-event hooks. No conflict.

### GRAY-2: Layers panel — left rail (ARCHITECTURE) vs differentiator-tier deferral (FEATURES)
ARCHITECTURE recommends LEFT rail (industry unanimous: Figma/Canva/Sketch/tldraw). FEATURES recommends `DIFF` tier — the existing Layer Strip covers 80% of cases; extend Layer Strip first rather than build a new panel. **User decision needed.** Recommendation: ship a basic layers panel (no drag-to-reorder) in Phase 65. Left rail is the correct placement when it ships.

### GRAY-3: Watermarks in multi-select scope
PROJECT.md milestone constraint: "Multi-select / groups affect non-text elements too — custom_images, watermarks." ARCHITECTURE excludes watermarks explicitly (`v2.11 multi-select scope = text_boxes[] union custom_images[] only`). Watermarks live in `style_overrides.watermark`, not in a flat element array, so including them requires schema change. **User decision needed.** Recommendation: exclude watermarks from v2.11 multi-select. Decorative overlays are template-defined and non-user-editable — exclude with high confidence.

### GRAY-4: react-arborist Day-1 StrictMode verification
react-arborist pulls react-dnd@14.x. In React 19 StrictMode dev, react-dnd@14 is known to fire `useDrag` twice. Production builds are clean per the arborist 3.4.3 release notes. Must verify on Day 1 of Phase 65. Fallback library documented.

---

## Open Questions for User Decision

1. **Max element count target per slide** — v2.11 perf guards calibrated for N<=30. Is this the right ceiling?
2. **Layers panel: left rail vs Layer Strip extension vs defer entirely** — user calls this.
3. **Lock element: v2.11 scope or v2.12** — `locked?` field is additive; MED complexity; shares panel real estate with layers panel.
4. **Alt+drag duplicate: v2.11 scope** — Figma standard; MED complexity; high UX delight.
5. **Marquee additive-with-Shift confirmation** — Shift held = ADD to existing selection (Figma model). Confirm this is intended.
6. **Snap threshold: 5px or 8px** — STACK says 5 (Moveable/Figma measured); ARCHITECTURE says 8 (DEV Community canvas analysis). Pick one at requirements time.
7. **Floating alignment toolbar location** — above selection bounds (Figma) or fixed top-of-canvas (Canva)?

---

## Implications for Roadmap

Phase numbering continues from Phase 60 (v2.10 ended at Phase 59). The STACK suggests 4 phases, ARCHITECTURE suggests 5 phases, PITFALLS maps to 12 build phases. These unify into a single 5-phase core plus a polish/cleanup phase:

### Phase 60 — Multi-Select Foundation
**Rationale:** Every other v2.11 feature requires 2+ elements to be selected. Selection state correctly modeled (flat `string[]`, outside reducer history, reconciled on undo) is the highest-leverage architectural decision. Phase 60's schema decision for `groupId` is the single most important moment in the milestone.
**Delivers:** Unified `Selection { ids, primary }` state; Shift-click / Cmd-click; Cmd+A / Esc; click-empty-canvas deselect; right-rail "Mixed" placeholder; selection ring around union bounding box; selection cleared on slide switch; `tinykeys@3.0.0` installed
**Addresses:** FEATURES A2, A3, A5, A6, A7; schema fields `groupId?` / `locked?` / `hidden?` defined here
**Avoids:** PITFALL-1.1 (stale IDs after delete), PITFALL-1.2 (selection persists across slide switch), PITFALL-1.4 (Set mutation), PITFALL-12.3 (no "primary" key-object concept)
**Research flag:** LOW — well-documented; matches existing codebase pattern

### Phase 61 — Marquee Selection
**Rationale:** Drag-to-select is the fastest way to select multiple elements. Depends on Phase 60's selection model. Ships `selecto@1.26.3`.
**Delivers:** Rubber-band marquee on empty-canvas pointer-drag; intersect mode (Figma default); Shift-held = additive; `selecto@1.26.3` scale-aware (`setScale(x,y)` for canvas transform); final `REPLACE_SELECTION` on pointer-up
**Implements:** `<MarqueeOverlay>` as local state inside `<SlidePreview editable={true}>`; `elementsInRect()` pure function in `src/lib/editor/transforms/marquee.ts`
**Avoids:** PITFALL-2.1 (pointer events to canvas root only — `e.target === e.currentTarget`), PITFALL-2.3 (normalize rect), PITFALL-2.4 (use `pointerdown` not `mousedown`), PITFALL-2.5 (Rnd children `stopPropagation`)
**Research flag:** LOW — `selecto` is battle-tested; pointer-event seam well-documented

### Phase 62 — Group / Ungroup
**Rationale:** Groups are the most schema-impactful feature. Building before alignment means alignment can treat groups as single units. Flat schema makes this phase mostly additive with minimal risk.
**Delivers:** `groupId?: string` on `TextBox` + `CustomImage`; Cmd+G / Cmd+Shift+G; `GROUP` / `UNGROUP` reducer actions; group bounding box visualization; enter-group (double-click) / exit-group (Esc)
**Uses:** `src/lib/editor/transforms/group-bounds.ts` (pure AABB); updates to `applyDualWrite` (strip `groupId` on legacy emission)
**Avoids:** PITFALL-3.1 (no group transform — flat schema), PITFALL-3.3 (no nested groups — no-op or flatten), PITFALL-3.4 (N=0/N=1 = no-op), PITFALL-3.6 (nullable field, no migration)
**Research flag:** LOW — flat schema consensus is clear across all 4 docs

### Phase 63 — Alignment / Distribute + Smart Guides (Parallel-Shippable)

*Alignment:*
**Rationale:** The user's primary named feature. Depends on Phase 60 (multi-select), independent of Phase 62 (groups).
**Delivers:** 6-axis alignment; H + V distribute (gap-based, N>=3 only); align-to-canvas for N=1, align-to-selection for N>=2; floating alignment toolbar above selection; keyboard shortcuts (Alt+A/H/D/W/V/S, Cmd+Alt+H/V)
**Implements:** `src/lib/editor/transforms/align.ts` (pure); `ALIGN` + `DISTRIBUTE` reducer actions (one `pushHistory` each)
**Avoids:** PITFALL-4.1 (N=1 aligns to canvas), PITFALL-4.2 (disable distribute with N<3), PITFALL-4.4 (round positions), PITFALL-4.6 (gap-based not center-based), PITFALL-4.7 (locked elements in bounds but don't move)

*Smart Guides (parallel code surface):*
**Rationale:** Independent of alignment logic; two developers can ship simultaneously.
**Delivers:** Sorted-edge-array snap index at `onDragStart`; binary search at `onDrag`; threshold 5px; canvas-edge targets; equal-spacing "==" markers; group-AABB-aware snapping; Hold-Cmd bypass
**Implements:** `src/lib/editor/transforms/snap-index.ts`; extends `useAlignmentGuides`; persistent guide `<div>` nodes updated via `transform: translate3d` refs (no React reconciliation per frame)
**Avoids:** PITFALL-5.1 (pre-compute at drag-start), PITFALL-5.2 (asymmetric hysteresis), PITFALL-5.3 (overlay inside scaled container), PITFALL-5.5 (blur resets Cmd state), PITFALL-11.2 (refs not re-renders)
**Research flag:** MEDIUM for smart guides — perf-sensitive; verify <2ms per frame at N=30 before ship

### Phase 64 — Lock / Hide + Z-Order
**Rationale:** Lock/hide share the `locked?` / `hidden?` fields and the layers panel surface. Z-order depends on groups existing (so group members can be treated as a unit). Grouping these three together is efficient.
**Delivers:** `locked?` + `hidden?` schema fields; `SET_LOCKED` / `SET_HIDDEN` reducer actions; lock = `disableDragging={true}` + `pointer-events: none` for marquee; `hidden=true` skipped by BOTH renderers; Cmd+Alt+] / Cmd+Alt+[ / Cmd+] / Cmd+[ shortcuts; `src/lib/editor/transforms/z-order.ts`; lock stripped on fork
**Avoids:** PITFALL-6.1 (z-order = array splice, never CSS z-index), PITFALL-6.2 (within-array only), PITFALL-8.1 (lock = selectable but immovable), PITFALL-8.2 (hidden excluded from alignment bounds), PITFALL-8.3 (lock stripped on fork), PITFALL-8.4 (locked elements pointer-events: none)
**Research flag:** LOW — all decisions are explicit; array-splice pattern matches v2.9 Satori precedent

### Phase 65 — Layers Panel + TPLREND-05 Audit
**Rationale:** Last because it depends on all prior phases (displays groups from 62, exposes lock/visibility from 64, drives z-order from 64). Right time for a comprehensive TPLREND-05 audit.
**Delivers:** `src/components/editor/layers-panel/` in LEFT rail; flat list with group collapse; lock/visibility toggles; click-to-select; button-based z-order reorder; parity tests for all new schema fields; regression test for zero editor chrome in `editable={false}` render tree
**Uses:** `react-arborist@3.5.0` (contingent on Day-1 StrictMode verification)
**Avoids:** PITFALL-7.1 (dispatch on dragEnd only), PITFALL-7.2 (no selection-sync infinite loop), PITFALL-7.3 (inline rename = `<input>`), PITFALL-10.1/10.2/10.3 (all editor chrome gated), PITFALL-11.3 (`React.memo` on layer chips)
**Research flag:** MEDIUM — react-arborist Day-1 verification is a dependency; left-rail CSS layout is new work

### Phase 66 — Polish / Keyboard Completion / Cleanup
**Rationale:** Close ride-along table stakes, complete keyboard shortcut surface, delete legacy selection slots.
**Delivers:** Complete `tinykeys` keyboard surface with `e.preventDefault()` + isEditing guard + `window.blur` modifier reset; floating alignment toolbar (if not Phase 63); delete legacy 3-slot selection state; final parity test pass
**Avoids:** PITFALL-9.1 (Cmd+A in text input), PITFALL-9.2 (arrow keys in text input), PITFALL-9.3 (Cmd+G Chrome conflict), PITFALL-9.4 (modifier stuck on blur), PITFALL-12.2 (shortcut tooltips)
**Research flag:** LOW — keyboard handling is deterministic; tinykeys API well-documented

### Phase Ordering Rationale

Multi-select state (Phase 60) is the prerequisite for everything — no other phase can begin without it. Groups (Phase 62) precede alignment (Phase 63) so alignment can treat groups as single units. Smart guides are a parallel code surface that any developer can ship alongside alignment. Lock/hide/z-order (Phase 64) share schema fields and panel controls with the layers panel, making them efficient to batch. The layers panel (Phase 65) is last because it integrates Phase 62 + 64 output. This order avoids the pitfall of building "a layers panel that shows groups" before groups exist, and avoids building "alignment that respects groups" before the group model is defined.

---

## Research Flags

**Needs validation before or during the phase:**
- **Phase 61 (Marquee):** Verify `selecto`'s `setScale(x, y)` API works with the canvas's `transform: scale(0.4)` wrapper. Test Day 1.
- **Phase 63 (Smart Guides):** Performance test at N=30 after replacing `useAlignmentGuides`. Budget: <2ms per pointer-move.
- **Phase 65 (Layers Panel):** react-arborist StrictMode Day-1 verification. Fallback to `react-complex-tree@2.4.6` if drag double-fires in dev.

**Standard patterns — skip research phase:**
- **Phase 60 (Multi-Select State):** Matches existing codebase pattern; `string[]` over `Set` for insertion-order stability.
- **Phase 62 (Group/Ungroup):** Flat schema decision locked by all 4 docs; group math trivial with flat schema.
- **Phase 63 sub (Alignment/Distribute):** Pure math; gap-based distribute is Figma/Sketch/Canva consensus.
- **Phase 64 (Lock/Z-Order):** Array-splice z-order directly constrained by Satori's DOM-order rendering.
- **Phase 66 (Keyboard):** tinykeys API well-documented; all shortcuts enumerated in STACK.md.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified via Context7 + npm view 2026-05-02; react-arborist StrictMode hazard documented with mitigation; version pins locked |
| Features | HIGH | Every named feature sourced from Figma/Canva official docs; shortcuts cross-verified against Canva PDF shortcut table; distribute semantics verified against Figma + GIMP |
| Architecture | HIGH | Codebase audited line-by-line; existing patterns confirmed; Figma plugin API + tldraw architecture sourced |
| Pitfalls | MEDIUM-HIGH | ~50 pitfalls sourced from real GitHub issues (fabric.js, react-moveable, react-rnd, Satori) and official docs; ~5 pitfalls flagged LOW confidence (inferred from patterns) |

**Overall confidence: HIGH**

### Gaps to Address

- **selecto + transform:scale parent** — verify `setScale(x, y)` accuracy in Phase 61 before requirements lock.
- **Cross-array z-order** — v2.11 limits z-order to within-array. If users request custom image behind hook text, this is a known gap requiring v3.0+ schema unification. Flag in Phase 64 requirements.
- **Watermark in multi-select scope** — PROJECT.md says yes; ARCHITECTURE says no. Resolve before Phase 60 requirements written (see GRAY-3).
- **Snap threshold: 5px vs 8px** — decide at requirements time.
- **react-arborist StrictMode** — unknown until Day 1 of Phase 65. Fallback documented.

---

## Sources

### Primary (HIGH confidence)

Context7 libraries:
- `/bokuweb/react-rnd` — version, API, group-transform absence (issue #911 open, no resolution)
- `/daybrush/selecto` — react usage, hitRate, selectFromInside, toggleContinueSelect
- `/jamiebuilds/tinykeys` — `$mod` modifier, sequence support, React useEffect cleanup pattern
- `/jameskerr/react-arborist` — Tree component props, custom row + drag preview, React 19 support since 3.4.3
- `/daybrush/moveable` — surveyed and rejected; groupable docs, snapThreshold 5px, translate3d Safari issue #433

Official documentation:
- [Figma Plugin API — GroupNode](https://www.figma.com/plugin-docs/api/GroupNode/) — group as parent-child tree (deliberately not mirrored)
- [Figma Help — Select layers](https://help.figma.com/hc/en-us/articles/360040449873) — marquee intersect, Shift-click, Cmd+A
- [Figma Help — Adjust alignment](https://help.figma.com/hc/en-us/articles/360039956914) — distribute gap-based; 1px rounding; N=1 aligns to parent
- [Figma Help — Set nudge values](https://help.figma.com/hc/en-us/articles/4404575206295) — 1px / 10px defaults
- [Figma Help — Left sidebar layers](https://help.figma.com/hc/en-us/articles/360039831974) — left = structure, right = properties
- [Canva Help — Group, layer, align](https://www.canva.com/help/layer-group-align/) — Cmd+G, multi-select behavior
- [Canva keyboard shortcuts PDF](https://justclickhere.co.uk/wp-content/uploads/2020/01/Canva-shortcuts-table-watermarked-1.pdf) — full shortcut table verified
- [Moveable.Snappable docs](https://daybrush.com/moveable/release/latest/doc/Moveable.Snappable.html) — snapThreshold default 5px confirmed
- [tldraw Groups docs](https://tldraw.dev/sdk-features/groups) — group preserves page positions; parentId model
- [Evil Martians — Figma Plugin API algorithms](https://evilmartians.com/chronicles/figma-plugin-api-dive-into-advanced-algorithms-and-data-structures) — no z-index in Figma; layer order = array position
- [Satori README](https://github.com/vercel/satori) — 3D transforms explicitly unsupported
- [Satori issue #217](https://github.com/vercel/satori/issues/217) — z-index ignored; DOM order = paint order

### Secondary (MEDIUM confidence)
- [fabric.js #4163](https://github.com/fabricjs/fabric.js/issues/4163) — group transform compounding bug (real evidence of landmine)
- [fabric.js #1798](https://github.com/fabricjs/fabric.js/issues/1798) — ungroup position loss
- [DEV Community — Snapping Visualization Enhancement](https://dev.to/therealgabry/snapping-visualization-enhancement-4h31) — 8px threshold claim
- [react-moveable groupable handbook](https://github.com/daybrush/moveable/blob/master/packages/react-moveable/groupable.md) — explicit transform compounding warning
- [Canva Oct 2025 post-mortem](https://soloshannon.substack.com/p/canva-is-broken-and-i-almost-lost) — alignment toolbar UX lesson

### Tertiary (LOW confidence — inferred)
- Figma's exact "last-clicked = primary" mechanic (not formally documented; empirical community consensus)
- Snap hysteresis 14px exit threshold (general pattern; no Figma/Canva spec)
- react-arborist StrictMode behavior in React 19 production (reported fixed in 3.4.3; not personally verified)

### Internal codebase (verified during research)
- `src/hooks/use-alignment-guides.ts` — existing snap, `SNAP_THRESHOLD = 10`, brute-force pairwise
- `src/lib/editor/editor-reducer.ts` — `pushHistory`, `applyDualWrite`, `MAX_HISTORY=50`
- `src/lib/editor/use-slide-editor.ts:29` — "selection changes never push undo/redo" pattern
- `src/lib/render/render-slide-satori.tsx:97` — "Satori has no z-index; layer order = DOM order"
- `src/components/slides/slide-preview.tsx:1073` — `editable={true}` selection ring gate pattern
- `src/components/editor/slide-editor.tsx:340-393` — isEditing guard; keyboard handler to extend

---
*Research completed: 2026-05-02*
*Ready for roadmap: yes*
*Phase numbering: continues from Phase 60 (v2.10 ended at Phase 59)*

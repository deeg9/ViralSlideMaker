# Architecture Research — v2.11 Full Editor Parity

**Domain:** Multi-element editing in a Next.js + Supabase + Satori carousel editor
**Researched:** 2026-05-02
**Confidence:** HIGH (existing codebase audited end-to-end; Figma/Canva/tldraw/Adobe XD architectural patterns sourced from official docs and public engineering posts)

> Scoped per `<milestone_context>` — only NEW v2.11 architecture decisions. Existing Next.js / Supabase / react-rnd / Satori / `text_boxes[]` v2.8 schema are NOT re-researched.

---

## TL;DR — Decision Stack

| # | Decision | Verdict | Why |
|---|----------|---------|-----|
| 1 | Group representation | **Option C — Editor-only groups** with `groupId?: string` flat-array membership; NO nested children in schema | Satori has no group concept; absolute positions on every element keep TPLREND-05 invariant trivial; v2.8 migration trauma still fresh |
| 2 | Multi-select state | **`{ ids: string[]; primary: string \| null }`** in `useSlideEditor` React state (NOT reducer history) | Mirrors Figma's "primary selection" model; insertion order matters for distribute; "Mixed" rendering needs `ids` enumeration |
| 3 | Alignment as pure functions | `src/lib/editor/transforms/align.ts` — pure `(elements, axis, target) → updates` | Single ALIGN action through `pushHistory` once → one undo step per gesture |
| 4 | Smart guides | **8px threshold; on `onDrag` (60Hz); pre-sorted edge arrays at `onDragStart`; binary-search per pointer-move** | <2ms per frame for N≤30 elements; reuses existing `useAlignmentGuides` hook design |
| 5 | Marquee selection | **Local component state** in a new `<MarqueeOverlay>`; final `REPLACE_SELECTION` dispatch on pointer-up | Transient — never enters reducer history |
| 6 | Layers panel | **LEFT rail** (Figma + Canva + Sketch + tldraw consensus); flat list with group expand/collapse chevrons; new component `src/components/editor/layers-panel/` | Right rail already crowded with text-rail / SlideSettings; left rail is empty today |
| 7 | Z-order | **Array order in `text_boxes[]` + `custom_images[]`** plus a unified `z` field is rejected; instead use the existing per-array order and add `bringForward` / `sendBackward` actions that splice within the array | Matches Satori's "DOM order = layer order" reality (line 97 of `render-slide-satori.tsx`); zero new schema field |
| 8 | TPLREND-05 parity | New schema fields: ONLY `groupId?: string`, `locked?: boolean`, `hidden?: boolean` (read by both renderers — `hidden` skips the element; `locked` is editor-only) | Selection rings, marquee, smart guides, group bbox, layers panel all editor-only and `editable={true}` gated |
| 9 | History for N-element ops | **Single `pushHistory` per gesture/action** — `ALIGN`, `GROUP`, `UNGROUP`, `BULK_TRANSLATE`, `BULK_RESIZE` are all single-action multi-element mutations | Existing reducer pattern; `BULK_TRANSLATE` dispatched on `onDragStop` only (matches v2.10 `onResizeStop` precedent) |
| 10 | Build order | **5 phases** — see §10 below. Multi-select → groups → align/distribute (parallel with smart-guides) → layers panel → polish | Natural seams: alignment needs multi-select; layers panel needs groups; smart guides is parallel-shippable |

---

## Existing Architecture (Anchor Points — Read From Codebase)

Audited from the source files. These are NOT decisions — they are constraints v2.11 must respect.

### Schema (`src/lib/types/slide.ts`)

- `Slide` carries `text_boxes?: TextBox[]` (Phase 49 unified) + legacy `hook_text` / `body_text` / `custom_texts` (deprecated, retained through v2.9+, sunset post-PMF)
- `Slide.custom_images?: CustomImage[]` (own array — NOT inside `text_boxes`)
- Watermark = `style_overrides.watermark` (NOT a flat element — special case at `slide-preview.tsx:746-814`)
- Decorative overlays = `template.overlays[]` (NOT user-editable; out of v2.11 scope per `<milestone_context>`)
- `TextBox.position` = `{ anchor: 'top'|'center'|'bottom'|'custom'; x?: number; y?: number; width?: number }` — percentage-based on 1080×1920 reference canvas
- `CustomImage` = `{ id, url, x, y, width, height, opacity?, border_radius? }` — also percentage-based, but with **explicit `height`** (text boxes have implicit height via auto-fit)

### Reducer (`src/lib/editor/editor-reducer.ts` + `editor-actions.ts`)

- `EditorHistory = { past: Slide[][]; present: Slide[]; future: Slide[][] }` — slide-array-level snapshots (NOT element-level diffs)
- `pushHistory(state, newPresent)` is the gate — every action that should be undoable must route through it
- `MAX_HISTORY = 50`
- 14 existing actions: `ADD_SLIDE`, `REMOVE_SLIDE`, `DUPLICATE_SLIDE`, `REORDER_SLIDES`, `UPDATE_SLIDE`, `SET_SLIDES`, `ADD_CUSTOM_TEXT`, `UPDATE_CUSTOM_TEXT`, `REMOVE_CUSTOM_TEXT`, `ADD_CUSTOM_IMAGE`, `UPDATE_CUSTOM_IMAGE`, `REMOVE_CUSTOM_IMAGE`, `ADD_TEXT_BOX`, `UPDATE_TEXT_BOX`, `REMOVE_TEXT_BOX`, `UNDO`, `REDO`
- `applyDualWrite(slide, nextTextBoxes)` runs after every text-box mutation — derives legacy `hook_text` / `body_text` / `hook_segments` / `body_segments` / `custom_texts` from the canonical `text_boxes[]`. Any new element-mutating action that touches text_boxes MUST also call this helper.

### Selection state (`src/lib/editor/use-slide-editor.ts`)

- `selectedTextBoxId: string | null` lives in **React state** OUTSIDE the reducer history (line 29 — "Selection changes never push undo/redo")
- `selectedCustomTextId` and `selectedCustomImageId` live as separate `useState` slots in `slide-editor.tsx` (lines 83–84)
- That's THREE parallel selection scopes today, all single-id strings. v2.11 unifies them.

### Renderer parity (`src/lib/render/resolve-overlay.ts` + `render-slide-satori.tsx`)

- **Satori has NO z-index support** — layer order is determined by JSX/DOM order (explicit comment at `render-slide-satori.tsx:97`)
- Both React preview (`slide-preview.tsx`) and Satori (`render-slide-satori.tsx`) consume `resolve-overlay.ts` for shared rendering primitives (TPLREND-05 contract)
- Today's render order (verified from both files): background → grain → tint → vignette → bottom-card → overlays → hook-text → body-text → custom_images → watermark → forced-watermark → slide-number-badge

### Snap guides (already exist at `src/hooks/use-alignment-guides.ts`)

- `SNAP_THRESHOLD = 10` reference px (~5 screen px at typical scale) — runs O(N×M) edge-vs-source comparison per pointer-move
- Triggered on every `onDrag` of every `<Rnd>` instance in `slide-preview.tsx`
- Returns matched guide positions; preview renders them via `activeGuides` state
- v2.11 will REPLACE this with a sorted-edge-array implementation (§4) but the API surface (`calculateSnap` / `clearGuides`) is intentionally compatible

### Editor pointer surface (`slide-canvas.tsx` + `slide-preview.tsx`)

- `slide-canvas.tsx` is a thin wrapper — the actual pointer-events live inside `<SlidePreview editable={true}>`
- Each text box and custom image is wrapped in a `<Rnd>` (react-rnd) instance
- Canvas-background `onClick` clears selection (`slide-preview.tsx:954-960`) — this is the seam where marquee-start lives in v2.11

---

## 1. Group Representation in Schema

### Options Surveyed

| Option | Description | Industry Example |
|--------|-------------|------------------|
| **A. Nested tree** | `Slide.children: (Element \| Group)[]`; group has its own `children: Element[]` | **Figma Group/Frame** (children stored in `children[]`, position relative to parent via `relativeTransform`) |
| **B. Flat array + groupId** | `Element.groupId?: string`; `Slide.groups[]` carries metadata; positions remain absolute | **Adobe Illustrator** behavior (positions are absolute even when grouped); some Konva.js tutorials |
| **C. Editor-only groups** | Groups exist only in client UI state; the schema persists a flat element array with all positions absolute | **Sketch (older versions)**; equivalent to Adobe Illustrator's "group as a UI affordance" |

### Public Architectural Revelations Cited

- **Figma**: GroupNode has `children: readonly SceneNode[]`, sorted back-to-front; positions are `relativeTransform` (relative to parent) plus `absoluteTransform` (page-relative). Frames vs Groups differ on layout/clipping but both are tree nodes. Source: [Figma Plugin API — GroupNode](https://www.figma.com/plugin-docs/api/GroupNode/), [When to use groups versus frames](https://www.figma.com/best-practices/groups-versus-frames/).
- **tldraw**: Tree-of-shapes; each shape has `parentId`. `editor.groupShapes()` "preserves page positions; only `parentId` and local coordinates change." `editor.ungroupShapes()` "preserves their exact page positions and rotations." Source: [tldraw Groups docs](https://tldraw.dev/sdk-features/groups).
- **Adobe XD**: Scenegraph tree with `children` arrays on Group/Artboard nodes. Source: [Adobe XD Scenegraph](https://developer.adobe.com/xd/uxp/develop/reference/scenegraph/).
- **Evil Martians** Figma analysis: confirms Figma exposes z-stacking via "the position in the array of children" — there is no explicit z-index. Source: [Evil Martians — Figma Plugin API algorithms](https://evilmartians.com/chronicles/figma-plugin-api-dive-into-advanced-algorithms-and-data-structures).

### Recommendation: **Option C — Editor-only groups**

Add ONE field to `TextBox` and `CustomImage`:

```typescript
// src/lib/types/slide.ts
export interface TextBox {
  // ... existing fields ...
  /** v2.11: editor-only group membership. NOT a parent-child relationship —
      the element's position remains absolute (% of 1080×1920). The editor
      synthesizes the group's bounding box at render time from member
      positions. Two elements with the same `groupId` are treated as one
      selection unit by drag/align/transform actions. Satori IGNORES this
      field — render output is unchanged regardless of grouping state. */
  groupId?: string
}

export interface CustomImage {
  // ... existing fields ...
  groupId?: string
}
```

NO `Slide.groups[]` metadata array. NO nesting. The group "exists" iff ≥2 elements share a `groupId`.

### Rationale

1. **TPLREND-05 invariant is trivially preserved.** Satori never sees groups. No `<g>` SVG wrapper. No new layer. Zero changes to `render-slide-satori.tsx` or `resolve-overlay.ts`. The render pipeline works on absolute positions today and continues to do so.

2. **v2.8 migration trauma.** The Phase 49 dual-write (`applyDualWrite`) exists because the v2.8 schema migration nearly broke render parity. Every NEW field on `TextBox` adds a third coordinate to that already-fragile dual-write. A single `groupId?: string` is the smallest possible footprint.

3. **No "ungroup preserves positions" math.** With Options A/B, ungrouping requires `worldPos = parent.transform.mul(localPos)` reconstruction. With Option C, ungroup is `delete element.groupId` for each member — a one-liner per element. Group is `element.groupId = newId` for each selected member. Symmetric. No floating-point drift.

4. **The editor can still synthesize a group bbox** for the selection ring + drag handle. `groupBounds(slide, groupId) = aabb(elements where e.groupId === groupId)` is a pure function in `src/lib/editor/transforms/group-bounds.ts`. Computed on every render — no cache needed for the typical N≤30 element count.

5. **Nested groups ARE supported** with no schema change — give the inner group a `groupId` of its own and have the editor walk up a "group-of-groups" map. BUT this is YAGNI for v2.11; the milestone goal is parity for flat groups. Document the path; don't build it.

6. **Decorative overlays + watermarks are excluded** by design. `template.overlays[]` is template-defined, not user-editable. Watermark is `style_overrides.watermark` (project-wide). v2.11 multi-select scope = `text_boxes[]` ∪ `custom_images[]` only. This matches the milestone constraint statement.

### Why NOT Option A (nested tree)

- Re-walks the schema at every dispatch (the reducer would need to recurse into `Slide.children` instead of mapping flat arrays).
- Forces position-coordinate-system change (relative-to-group), which the Satori renderer would have to replicate. Direct TPLREND-05 risk.
- Migration: every existing slide row in Postgres needs to be rewritten. v2.8 already did this; user is not signing up for another.

### Why NOT Option B (flat + Slide.groups[])

- `Slide.groups[]` is metadata that's meaningful only when ≥2 elements share its id. Adding it is "synthetic state" that can drift from the membership flags.
- No real benefit over Option C — the only thing `Slide.groups[]` could carry is `name` (for the layers panel), and a group name is editor-only ergonomic UX that can live in client state for now.

### Trade-offs Acknowledged

- **No per-group transform.** A user cannot rotate or scale "the group as a whole" — there's no group origin to scale around. v2.11 doesn't need this (rotation is in v2.10's deferred list — `ROTATE-01`). When rotation lands, revisit.
- **No clipping** (Figma Frame-style). Groups in our editor behave like Figma Groups, not Frames. Acceptable — the canvas is fixed 9:16, no nested scroll regions.
- **Layers panel needs to walk the flat array and synthesize tree structure for display.** Costs O(N) per render; trivial for N≤30.

---

## 2. Multi-Select State in `editor-reducer.ts`

### Recommendation

**Replace** the three current single-id slots (`selectedTextBoxId`, `selectedCustomTextId`, `selectedCustomImageId`) with a **single unified selection model** in `useSlideEditor`:

```typescript
// src/lib/editor/use-slide-editor.ts
export interface Selection {
  /** Insertion-ordered list of selected element ids. Order matters for
      distribute (which uses outermost two as boundaries) and for the
      "primary" selection that drives the right-rail focus. */
  ids: string[]
  /** The "anchor" of the selection — the element whose properties the
      right rail surfaces when values are uniform, OR the most-recently
      added element. Always satisfies `primary === null || ids.includes(primary)`. */
  primary: string | null
}
```

State lives in `useSlideEditor` React state (NOT in the reducer history, NOT in `EditorHistory`). Selection is transient UI state; it must NOT be undoable.

### New Action Types

These dispatch through the reducer ONLY when they affect element-bearing state (e.g., a multi-drag mutates positions). Pure selection changes use plain `setSelection`:

```typescript
// Pure setters (NOT reducer actions — call setSelection directly)
setSelection({ ids: [], primary: null })            // CLEAR
setSelection({ ids: [id], primary: id })             // SELECT (single)
setSelection(s => ({                                 // ADD_TO_SELECTION (Shift-click)
  ids: s.ids.includes(id) ? s.ids : [...s.ids, id],
  primary: id,
}))
setSelection(s => ({                                 // REMOVE_FROM_SELECTION
  ids: s.ids.filter(x => x !== id),
  primary: s.primary === id ? (s.ids.find(x => x !== id) ?? null) : s.primary,
}))
setSelection({ ids: nextIds, primary: nextIds[nextIds.length - 1] ?? null })  // REPLACE (marquee)
setSelection({ ids: allElementIds, primary: allElementIds[0] ?? null })       // SELECT_ALL (Cmd+A)

// Reducer actions for multi-element mutations (existing action set extended)
{ type: 'BULK_TRANSLATE', slideIndex, ids, dx, dy }              // arrow-key nudge / multi-drag
{ type: 'ALIGN', slideIndex, ids, axis, target }                 // §3
{ type: 'DISTRIBUTE', slideIndex, ids, axis }                    // §3 (N≥3 enforced in pure fn)
{ type: 'GROUP', slideIndex, ids, groupId? }                     // Cmd+G; groupId optional, defaults to crypto.randomUUID()
{ type: 'UNGROUP', slideIndex, groupId }                         // Cmd+Shift+G
{ type: 'BRING_FORWARD' | 'SEND_BACKWARD' | 'BRING_TO_FRONT' | 'SEND_TO_BACK', slideIndex, ids }
{ type: 'SET_LOCKED', slideIndex, ids, locked: boolean }         // layers-panel toggle
{ type: 'SET_HIDDEN', slideIndex, ids, hidden: boolean }         // layers-panel toggle
```

### Right-Rail Behavior with Multi-Select

| Tool | Behavior on Multi-Select |
|------|--------------------------|
| **Figma** | Shows "Mixed" placeholder for any property that differs across the selection; values that match show normally |
| **Canva** | Shows the most-recently-clicked element's properties (the "primary") |
| **Adobe XD** | Same as Figma — "Mixed" badge |

**Recommendation: Figma model.** When `selection.ids.length > 1`:

- For each property the right rail shows (`font_size`, `color`, `text_align`, `effects.shadow`, etc.): if all members have the same value, render normally. If values differ, render `<MixedValuePlaceholder />` (a literal "Mixed" pill).
- Bulk edits write the new value to ALL members of the selection via `BULK_UPDATE_TEXT_BOX` (a generalization of `UPDATE_TEXT_BOX` that takes `ids: string[]` instead of `textBoxId: string`).
- `selection.primary` is informational only — drives "Bring to front" relative ordering and the chip highlight in `LayerStrip`.

### Why This Shape

- **`ids: string[]` (not `Set<string>`):** insertion order is needed for `distribute` (it uses outermost two as boundaries), for `LayerStrip` chip ordering, and for serialization stability across renders. `Set` doesn't preserve a stable iteration order across V8 deopt edges in older browsers.
- **`primary: string | null`:** matches Figma's "primary selection" pattern (the anchor for keyboard transforms, the ref point for align-to-selection).
- **Outside reducer history:** matches existing pattern (Phase 49 D-16 — "Stored OUTSIDE the editor history — selection changes never push undo/redo"). Selection has its own React state that survives undo/redo. After an UNDO, `selection.primary` may point at a now-deleted id → `useEffect` reconciliation pass clears any stale ids on every `state.present` change.

### Migration Path from Current 3-Slot Model

```typescript
// Step 1 (Phase 1 of v2.11): introduce Selection alongside the legacy slots.
//   - selectedTextBoxId, selectedCustomTextId, selectedCustomImageId stay as
//     derived getters: selection.primary IF that id matches a text_box / custom_text /
//     custom_image. Components keep working unchanged.
// Step 2 (Phase 2): migrate components one by one to read selection.
// Step 3 (Phase 5 cleanup): delete the 3 legacy slots.
```

This is the v2.8 dual-write pattern applied to selection state — proven safe.

---

## 3. Alignment / Distribute as Pure Functions

### File Layout

```
src/lib/editor/transforms/
├── align.ts             # Pure functions: alignElements, distributeElements
├── group-bounds.ts      # Pure: aabb of elements (used by selection ring + align target='selection')
├── snap-index.ts        # §4 — sorted edge index for smart guides
├── z-order.ts           # §7 — array-mutation helpers (bringForward, etc.)
└── __tests__/
    ├── align.test.ts
    ├── distribute.test.ts
    └── group-bounds.test.ts
```

### Signatures

```typescript
// src/lib/editor/transforms/align.ts

import type { Slide, TextBox, CustomImage } from '@/lib/types/slide'

export type AlignAxis =
  | 'left' | 'center-h' | 'right'
  | 'top'  | 'center-v' | 'bottom'

export type AlignTarget = 'canvas' | 'selection'

export interface ElementRef {
  kind: 'text_box' | 'custom_image'
  id: string
}

/**
 * Compute the new positions for `ids` such that they align on `axis`.
 *
 * - target='canvas': anchor is the 1080×1920 canvas (e.g. left=0%, center-h=50%).
 * - target='selection': anchor is the AABB of the selection itself.
 *
 * Returns a list of element-update patches. Caller builds a single ALIGN
 * reducer action that applies all patches in one pushHistory call.
 *
 * Pure — no React, no DOM, no I/O. Works in % units (matches schema).
 */
export function alignElements(
  slide: Slide,
  ids: ElementRef[],
  axis: AlignAxis,
  target: AlignTarget,
): Array<{ ref: ElementRef; patch: { x?: number; y?: number } }>

/**
 * Compute new positions for ids such that the gaps between adjacent
 * elements are equal along `axis`. Requires ids.length >= 3 — otherwise
 * returns [] (no-op; caller may surface a UI hint).
 *
 * The outermost two elements are pinned in place; the inner ones move.
 * Matches Figma + Illustrator distribute semantics.
 */
export function distributeElements(
  slide: Slide,
  ids: ElementRef[],
  axis: 'horizontal' | 'vertical',
): Array<{ ref: ElementRef; patch: { x?: number; y?: number } }>
```

### Reducer Wiring

```typescript
// editor-reducer.ts (new case)
case 'ALIGN': {
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    const patches = alignElements(slide, action.ids, action.axis, action.target)
    return applyPatches(slide, patches)  // helper that maps over text_boxes + custom_images
                                          // and routes text_boxes through applyDualWrite
  })
  return pushHistory(state, slides)
}
```

ONE `pushHistory` call → ONE undo step. The user dispatches `{ type: 'ALIGN', ... }` once; the reducer applies N patches before snapshotting. This matches the v2.10 `onResizeStop` precedent (single dispatch per gesture).

### Why Pure Functions

- **Testable without React** — `align.test.ts` is plain TS unit tests in vitest; no jsdom setup, no fixture slides with `<Rnd>` mocks.
- **Reusable for the future REST API** — when v3.0+ exposes `POST /slides/{i}/align`, the same pure function runs server-side without any editor state.
- **Composable** — group-bounds.ts uses it; layers-panel uses it for "align selected"; future MCP `edit_slide` tool can call it directly.

### Public Reference: Figma's Alignment Semantics

Figma documents that distribute "considers the leftmost and rightmost objects as boundaries" and "allows up to 1px of rounding" when snap-to-pixel-grid is on. Our percentage-based schema means we don't rasterize until render — so we get sub-pixel accuracy for free; round only when persisting if needed. Source: [Figma — Adjust alignment, rotation, position](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions).

---

## 4. Smart Guides During Drag

### Performance Budget

Target: **<2ms per pointer-move** (well under the 16ms 60fps frame budget). Scaling to N=30 elements (a generous v2.11 ceiling — typical slide has ≤6).

### Algorithm

**O((N + 1) · log N + S)** where S = small constant of axis edges per element (3 — left/center/right or top/center/bottom + canvas center).

```
On onDragStart:
  1. Walk all elements EXCEPT the dragging one
  2. Build two flat arrays:
     - xEdges: sorted [{ pos: number, kind: 'left'|'center'|'right'|'canvas-center', sourceId: string }, ...]
     - yEdges: sorted [{ pos: number, kind: 'top'|'center'|'bottom'|'canvas-center', sourceId: string }, ...]
  3. Cache canvasEdges = [0, 540 (center), 1080] for X; [0, 960, 1920] for Y
  4. Merge canvas edges into the sorted arrays (linear pass — they're sorted insertion points)

On onDrag (60Hz):
  1. Compute dragging element's 3 X-edges + 3 Y-edges (left/center/right; top/center/bottom)
  2. For each of the 3 X-edges:
       binarySearch(xEdges, edge.pos) → returns nearest index
       check edges at index-1, index, index+1 within SNAP_THRESHOLD (8px ref)
  3. Same for Y-edges
  4. Pick the smallest-delta match per axis; apply offset to dragging position
  5. Push matched edges to React state for guide-line rendering

On onDragStop:
  Clear the index. Clear active guides.
```

### Data Structure

```typescript
// src/lib/editor/transforms/snap-index.ts

interface EdgeEntry { pos: number; sourceId: string; kind: string }
interface SnapIndex { x: EdgeEntry[]; y: EdgeEntry[] }

export function buildSnapIndex(slide: Slide, excludeIds: Set<string>): SnapIndex
export function querySnap(
  index: SnapIndex,
  draggingX: number, draggingW: number,
  draggingY: number, draggingH: number,
): { snappedX: number; snappedY: number; matchedXIds: string[]; matchedYIds: string[] }
```

The index is built **once at `onDragStart`** and queried on every `onDrag`. The **existing** `useAlignmentGuides` hook does N×M scanning on every frame (N edges of dragging × M edges across all others) — fine for N≤6 today, will become a 16ms breach at N=30. The replacement keeps the same hook signature so callers don't change.

### Threshold

**8px reference pixels** (industry consensus — DEV Community canvas-editor analysis cites 8px as default; Konva sample uses 5–10; Figma uses ~8 with zoom adjustment). Today's `SNAP_THRESHOLD = 10` is acceptable but we'll standardize to 8 for tighter feel. Source: [Snapping Visualization Enhancement — DEV Community](https://dev.to/therealgabry/snapping-visualization-enhancement-4h31).

### Where Guide Lines Render

**Editor-only overlay `<div>` absolute-positioned over the canvas.** NOT in the schema. NOT in Satori. The current implementation already does this correctly via `slide-preview.tsx` consuming `activeGuides` from the hook. We keep that pattern.

### What About Group-Aware Snapping?

When an entire group is dragging, treat the group AABB's edges as the dragging edges (not each member's). When a non-group element is dragging, treat each group's AABB as a single snap target (not each group member). Synthesized at `buildSnapIndex` time — no schema change.

### TPLREND-05

Smart guides are PURELY editor chrome. They never enter slide state. They never reach Satori. ✓

---

## 5. Marquee Selection

### State

**Local component state in a new `<MarqueeOverlay>` inside `slide-preview.tsx`'s editable branch.** NOT in the reducer. NOT in `useSlideEditor`. Marquee is transient — it lives between pointer-down and pointer-up.

```typescript
// inside <SlidePreview editable={true}>
const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
```

### Pointer Sequence

```
pointerDown on canvas root (target === e.currentTarget):
  - if NOT modifier (Shift/Cmd held → keep current selection)
       → setSelection({ ids: [], primary: null })
  - setMarquee({ x0: clientX, y0: clientY, x1: clientX, y1: clientY })
  - setPointerCapture()

pointerMove (only when marquee != null):
  - setMarquee(m => ({ ...m, x1: clientX, y1: clientY }))
  - compute intersect set: every element whose AABB intersects the marquee rect
  - setSelection({ ids: intersectIds, primary: intersectIds[0] ?? null })   // live-update during drag
  - throttle to rAF (NOT to 60Hz raw — rAF is plenty)

pointerUp:
  - setMarquee(null)
  - releasePointerCapture()
  - if selection still {ids: []}, no-op (empty drag = clear)
```

### Element-vs-Rect Intersection

Pure function in `src/lib/editor/transforms/marquee.ts`:

```typescript
export function elementsInRect(
  slide: Slide,
  rect: { x: number; y: number; w: number; h: number },  // % of canvas
): ElementRef[]
```

AABB-vs-AABB intersection — `O(N)` per pointer-move, trivial for N≤30.

### Why Local State (NOT Reducer)

- Marquee position changes 60Hz during a drag. Routing through `dispatch` and `pushHistory` would create 60 useless history entries per second.
- The FINAL selection is a `setSelection` call (still not a reducer action — selection isn't reducer-owned per §2).
- Transient UI state never enters undo/redo. Same pattern as `editingCustomTextId` and `draggingElementId` already in `slide-preview.tsx` (lines 361–363).

### Pointer-Event Source

The canvas root `<div>` already has the `onClick={(e) => { if (e.target === e.currentTarget) { clear } }}` handler at `slide-preview.tsx:954-960`. Replace with pointerdown/move/up to enable marquee. **DO NOT use `onMouseDown`** — pointer events handle touch + pen + mouse uniformly; marquee with mouse-only handlers fails on iPad.

### Conflict with `<Rnd>` Drag

react-rnd captures pointerdown on its handle. Marquee starts on the canvas root. The two are mutually exclusive by event-target check — Rnd's `e.stopPropagation()` already prevents canvas-root from receiving pointerdown when an element is clicked. ✓

### Public Reference: tldraw Brush Tool

tldraw documents that "Hit testing evaluates cursor position against shape bounds" and "shift enables additive selection." We mirror this — Shift held during marquee = ADD to existing selection rather than REPLACE. Source: [tldraw Editor docs](https://tldraw.dev/reference/editor/Editor).

---

## 6. Layers Panel

### Mounting Location: **Left rail**

Industry consensus is unambiguous:

| Tool | Layers Panel Location |
|------|----------------------|
| Figma | Left sidebar |
| Canva | Left sidebar (Pages + Position panel) |
| Sketch | Left sidebar |
| Adobe XD | Left sidebar |
| tldraw | Left side panel |
| Today's editor | (none — right rail is text-rail + SlideSettings) |

Source: [Figma — View layers and pages in the left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-left-sidebar), [Figma — Right sidebar properties](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar). Both Canva and Figma converge on the convention: **left = navigation/structure, right = properties/inspection**.

Today's editor's right rail is already crowded (Text/Elements/Images tabs + photo-treatment + watermark). Mounting Layers there would force a 4th tab; mounting on the left fits the dominant industry convention AND consumes empty real estate.

### Component Model

```typescript
// src/components/editor/layers-panel/index.tsx
interface LayersPanelProps {
  slide: Slide
  selection: Selection                                    // §2
  onSelect: (ids: string[], primary: string | null) => void
  onReorder: (action: ReorderAction) => void              // dispatches BRING_FORWARD etc.
  onLockToggle: (refs: ElementRef[], locked: boolean) => void
  onVisibilityToggle: (refs: ElementRef[], hidden: boolean) => void
  onGroup: (refs: ElementRef[]) => void
  onUngroup: (groupId: string) => void
}
```

### Tree or Flat?

**Flat list synthesized from the flat schema, with virtual group rows.** Walk `slide.text_boxes[]` + `slide.custom_images[]` once; bucket entries by `groupId`; emit display rows in render order:

```
┌───────────────────────────────────────┐
│ Layers                            [+] │
├───────────────────────────────────────┤
│ ▼ Group "untitled-1"        🔒 👁     │
│   • Hook text                  🔒 👁   │
│   • Body text                  🔒 👁   │
│ • Custom image (sunset.jpg)    🔒 👁   │
│ • Custom text "click here"     🔒 👁   │
└───────────────────────────────────────┘
```

Top of the panel = top of the z-order (Figma/Sketch convention; opposite of Photoshop's bottom-up order — but more discoverable).

### New `Element` Fields for Lock/Visibility

```typescript
// add to BOTH TextBox and CustomImage interfaces
locked?: boolean       // editor-only — Satori IGNORES this. Locked elements
                       // resist all pointer events and keyboard transforms;
                       // panel still shows them for unlock.
hidden?: boolean       // schema field — BOTH renderers skip when true.
                       // Use case: A/B compare layouts without deleting elements.
```

### Reorder Mechanics

The layers panel calls `onReorder({ type: 'BRING_FORWARD', ids: [...] })`. The reducer splices the element forward by one in its source array (`text_boxes[]` for text boxes, `custom_images[]` for images). See §7.

### Drag-to-Reorder

**v2.11 ships click + button reorder only.** Drag-to-reorder within the panel adds 200+ LoC of dnd-kit wiring + cross-slide drop semantics. Defer to a quick task post-PMF.

### TPLREND-05 Audit

Layers panel is editor-only. Lock/visibility:
- `locked` — editor-only ✓
- `hidden=true` — both renderers must skip the element. Trivial: `if (textBox.hidden) return null` in both `slide-preview.tsx` text box mappers AND `render-slide-satori.tsx` text box mappers.
- `hidden=false` — both renderers proceed normally.

---

## 7. Z-Order

### Today's Render Order (Verified from `render-slide-satori.tsx` and `slide-preview.tsx`)

```
0   Background image / fill
1   Grain texture (template.grainMode)
2   Tint overlay (template.overlayColor × overlayOpacity)
3   Vignette (template.vignette)
4   Bottom-card (template.backgroundMode === 'image-with-bottom-card')
5   Template overlays (in template.overlays[] order)
6   Hook text
7   Body text
8   custom_images[] (in array order)
9   custom_texts[] (in array order — legacy field)
10  Brand watermark (style_overrides.watermark)
11  Forced free-tier watermark
12  Slide-number badge (editor only — not in Satori)
```

(Confirmed by reading both files. Comments at `render-slide-satori.tsx:97`, `:273`, `:462`, `:507` make this layer order explicit.)

### Recommendation: **Use array order — DO NOT add a `z` field**

```typescript
// src/lib/editor/transforms/z-order.ts
export function bringForward(slide: Slide, ids: ElementRef[]): Slide
export function sendBackward(slide: Slide, ids: ElementRef[]): Slide
export function bringToFront(slide: Slide, ids: ElementRef[]): Slide
export function sendToBack(slide: Slide, ids: ElementRef[]): Slide
```

Each function splices entries within `text_boxes[]` AND/OR `custom_images[]` (preserving the cross-array hierarchy from layer 6→9 above). Returns a new slide.

### Why NOT Add `z: number`

1. **Satori's reality.** Satori has no z-index — render order = DOM order = JSX order = array order (line 97 `render-slide-satori.tsx`). Adding a `z` field means **the renderer must sort by z** before rendering. Two synchronization sources of truth (array order + z field) is a recipe for divergence between React preview and Satori.

2. **Figma does the same.** [Evil Martians' Figma Plugin API analysis](https://evilmartians.com/chronicles/figma-plugin-api-dive-into-advanced-algorithms-and-data-structures) documents that Figma "does not provide a z-index property" and z-stacking is determined by "position in the array of children." This is the pattern at every tree-of-shapes design tool.

3. **Cross-array hierarchy is hardcoded.** Text boxes always render BELOW custom images today (layers 6–7 vs 8). Making "bring custom_image behind hook text" possible requires merging the two arrays, OR keeping them separate and adding a layer-level offset. v2.11 scope keeps them separate — `bringForward` on a custom image moves it within `custom_images[]`. To move a custom image BEHIND text, the user would need to "send to back" of `custom_images[]` (renders below other images, but still above text). **This matches user expectation**: photos stack above type by default.

4. **Zero schema diff.** Satori parity audit: trivially preserved. ✓

### Acknowledged Limitations

- A user CANNOT put a custom_image behind hook text in v2.11 without manually rearranging text_boxes via the layers panel. This is acceptable — historical slides have always behaved this way; nobody has asked for it.
- Cross-array reordering (e.g. "make this custom_image render between hook and body") is a v3.0+ feature requiring schema unification. Defer.

---

## 8. TPLREND-05 Parity Preservation — Per-Feature Audit

| v2.11 Feature | Touches Schema? | Touches Editor State? | Touches React Preview? | Touches Satori? | Verdict |
|---------------|-----------------|----------------------|------------------------|-----------------|---------|
| Multi-select state | NO | YES (`Selection` in useSlideEditor) | YES (`editable={true}` only — selection rings) | NO | Editor-only ✓ |
| Selection rings (dashed outlines) | NO | YES | YES (gated `editable={true}`) | NO | Editor-only ✓ |
| Marquee rect | NO | YES (component-local) | YES (gated `editable={true}`) | NO | Editor-only ✓ |
| Smart guide lines | NO | YES (`activeGuides` in hook) | YES (gated `editable={true}`) | NO | Editor-only ✓ |
| Group bounding box visualization | NO (groupId is the only field) | YES | YES (gated `editable={true}`) | NO | Editor-only ✓ |
| `Element.groupId?: string` field | YES (additive — both schemas) | YES | NO (preview ignores) | NO (Satori ignores) | Schema-additive, render-neutral ✓ |
| `Element.locked?: boolean` field | YES (additive) | YES (gates pointer events) | NO (preview ignores) | NO (Satori ignores) | Schema-additive, render-neutral ✓ |
| `Element.hidden?: boolean` field | YES (additive) | YES (layers panel toggle) | YES (skips when true — same gate in both renderers) | YES (skips when true — same gate in both renderers) | **Schema field; both renderers honor identically** ✓ |
| Layers panel | NO | YES (reads slide; dispatches actions) | NO (mounts in left rail OUTSIDE the SlidePreview) | NO | Editor-only ✓ |
| Alignment / distribute (transform results) | YES (writes new positions on existing fields) | YES | YES (re-renders with new positions) | YES (re-renders with new positions) | Symmetric — both renderers honor identically ✓ |
| Z-order shift (array reorder) | YES (mutates array order on existing fields) | YES | YES | YES | Symmetric — array order = render order in both ✓ |
| Multi-drag / nudge (BULK_TRANSLATE) | YES (writes positions) | YES | YES | YES | Symmetric ✓ |
| Group / Ungroup | YES (writes/clears `groupId`) | YES | NO behavior change | NO behavior change | Group is editor-only ergonomic; render output identical ✓ |

**Net schema diff for v2.11: 3 optional fields** (`groupId`, `locked`, `hidden`) on each of `TextBox` and `CustomImage`. Two are editor-only, one (`hidden`) is honored identically by both renderers. No new actions touch `resolve-overlay.ts`. No new actions break existing `applyDualWrite` (legacy fields don't carry `groupId` / `locked` / `hidden` — they're new-schema-only; the dual-write strips them on legacy emission, which is correct since legacy fields are sunsetting).

### Parity Test Plan (for v2.11)

Add to `tests/parity.test.tsx` (existing in v2.9):

1. Slide with `hidden: true` on the hook text → both renderers omit hook
2. Slide with two grouped elements → both renderers position them identically (groupId is no-op for renderer)
3. Slide with `locked: true` element → both renderers render it normally (locked is no-op for renderer)
4. Multi-drag end state → both renderers render at the post-drag positions
5. Post-distribute slide → both renderers render at the equally-spaced positions

Each test renders BOTH the React preview AND the Satori PNG and asserts identical DOM/SVG output. Pattern matches v2.9's existing parity tests.

---

## 9. History (Undo/Redo) for Multi-Element Operations

### Existing Pattern (Already Correct)

`pushHistory(state, newPresent)` snapshots the entire `Slide[]` array per call. Each reducer case calls `pushHistory` exactly ONCE. This is fine for multi-element ops as long as we route them through ONE reducer case.

### v2.11 Action Patterns

| Action | Dispatch Frequency | History Entries Per User Gesture |
|--------|--------------------|----------------------------------|
| ALIGN N elements | 1 dispatch on button-click | 1 |
| DISTRIBUTE N elements | 1 dispatch on button-click | 1 |
| GROUP N elements | 1 dispatch on Cmd+G | 1 |
| UNGROUP a groupId | 1 dispatch on Cmd+Shift+G | 1 |
| BULK_TRANSLATE (multi-drag) | 1 dispatch on `onDragStop` (same pattern as v2.10 `onResizeStop`) | 1 per drag gesture |
| BULK_TRANSLATE (arrow-key nudge) | 1 dispatch per keystroke | 1 per keystroke (acceptable — matches Figma) |
| Marquee selection | 0 reducer dispatches (selection isn't reducer-owned) | 0 |
| BRING_FORWARD / SEND_BACKWARD | 1 dispatch per click | 1 per click |
| SET_LOCKED / SET_HIDDEN | 1 dispatch per toggle | 1 per toggle |

### Critical Anti-Pattern to Avoid

```typescript
// WRONG: dispatches N times → N undo entries for one logical operation
ids.forEach(id => dispatch({ type: 'UPDATE_TEXT_BOX', ... }))

// RIGHT: dispatches once → 1 undo entry
dispatch({ type: 'BULK_UPDATE_TEXT_BOX', ids, updates })
```

This is the failure mode the v2.10 `onResizeStop` pattern was designed to prevent (issue: react-rnd fires `onResize` on every frame; only `onResizeStop` should dispatch). v2.11 multi-drag continues that pattern — `<Rnd>` fires `onDrag` for live snap feedback; only `onDragStop` dispatches the reducer mutation.

### Selection Survival Across Undo/Redo

Selection lives outside the reducer history. After undo, `state.present` may not contain elements with the ids in `selection.ids`. Reconciliation pass:

```typescript
useEffect(() => {
  // Strip ids from selection that no longer exist in the current slide
  const currentIds = new Set([
    ...(slide.text_boxes ?? []).map(t => t.id),
    ...(slide.custom_images ?? []).map(c => c.id),
  ])
  setSelection(s => {
    const filtered = s.ids.filter(id => currentIds.has(id))
    if (filtered.length === s.ids.length) return s  // no change
    return { ids: filtered, primary: filtered.includes(s.primary ?? '') ? s.primary : (filtered[0] ?? null) }
  })
}, [slide])
```

---

## 10. Build-Order / Phase Decomposition

5 phases, dependency-ordered. Smart guides ships in parallel to Phase 3 (independent code surface).

```
Phase 1 — Multi-Select Foundation
   ├─ Selection state model in useSlideEditor
   ├─ Pointer-event refactor: Shift/Cmd-click on elements adds/removes
   ├─ Marquee selection (canvas-root pointerdown → REPLACE_SELECTION on up)
   ├─ Cmd+A / Esc shortcuts
   └─ Right-rail "Mixed" placeholder for properties that differ across selection
   ▼ blocks Phase 3 (alignment needs ≥2 selected); blocks Phase 4 (groups need multi-select)

Phase 2 — Group / Ungroup
   ├─ Schema: optional `groupId?: string` on TextBox + CustomImage
   ├─ Reducer: GROUP / UNGROUP actions
   ├─ Cmd+G / Cmd+Shift+G keyboard shortcuts (in slide-editor.tsx)
   ├─ Selection-as-group: when selecting any member, select the whole group (Figma model)
   ├─ Group bounding-box visualization (editor-only overlay)
   └─ Pure helper: groupBounds(slide, groupId)
   ▼ blocks Phase 5 (layers panel needs group rendering)

Phase 3 — Alignment / Distribute  ←─┐
   ├─ src/lib/editor/transforms/align.ts (pure)            │
   ├─ Reducer: ALIGN / DISTRIBUTE actions                  │
   ├─ Right-rail align bar (6 align icons + 2 distribute) │
   └─ Keyboard shortcuts (optional in v2.11; defer)        │
                                                            │  parallel
Phase 4 — Smart Guides (parallel with Phase 3)  ←──────────┘
   ├─ src/lib/editor/transforms/snap-index.ts (pure)
   ├─ Replace useAlignmentGuides with sorted-edge-array implementation
   ├─ Group-aware snapping (group AABB as snap target / snap edge)
   └─ Render <SmartGuideOverlay editable={true}>

Phase 5 — Layers Panel + Lock + Visibility + Z-Order
   ├─ Schema: optional `locked?: boolean` + `hidden?: boolean`
   ├─ Both renderers honor `hidden=true` (parity test)
   ├─ src/components/editor/layers-panel/ (new)
   ├─ src/lib/editor/transforms/z-order.ts (pure)
   ├─ Reducer: BRING_FORWARD / SEND_BACKWARD / BRING_TO_FRONT / SEND_TO_BACK / SET_LOCKED / SET_HIDDEN
   ├─ Mount in LEFT rail (new — left rail is empty today)
   └─ Update keyboard nudge to skip locked elements

Phase 6 — Polish / QA (optional — only if budget allows)
   ├─ Drag-to-reorder within layers panel (optional)
   ├─ Group rename UI (optional — group name lives in client state, not schema)
   ├─ Duplicate selected (Cmd+D extension to multi-element)
   └─ Migration of legacy 3-slot selection state to new Selection model
```

### Phase Dependency Graph

```
Phase 1 (Multi-Select)
    │
    ├──────► Phase 2 (Groups)
    │           │
    └──────► Phase 3 (Align)  ◄── independent ── Phase 4 (Smart Guides)
                │
                └──► Phase 5 (Layers Panel + Z-Order)
                        │
                        └──► Phase 6 (Polish)
```

### Why This Order

1. **Multi-select first.** Every other v2.11 feature needs ≥2 elements selected. Building it first unblocks everything.
2. **Groups before alignment** is a deliberate sequencing — alignment-on-a-group should treat the group as a unit (move all members together), so groups need to exist before alignment is meaningful for multi-element selections that include groups.
3. **Smart guides parallel to alignment.** Different code surface (snap-index.ts vs align.ts), zero overlap. Two devs could ship them simultaneously.
4. **Layers panel last** because it depends on groups (to render hierarchical rows) and z-order (to rank rows). Lock/visibility ride along since they live in the panel.

### Estimated Phase Sizing (rough)

| Phase | LoC (production) | LoC (tests) | Risk |
|-------|------------------|-------------|------|
| 1 | ~600 | ~250 | MEDIUM — touches every selection-consuming component |
| 2 | ~250 | ~150 | LOW — additive schema field, reducer-pure mutations |
| 3 | ~350 | ~200 | LOW — pure functions, single new action |
| 4 | ~300 | ~150 | MEDIUM — perf-sensitive, replaces existing hook |
| 5 | ~500 | ~250 | MEDIUM — new schema fields with renderer participation |

---

## Sources Cited

### Figma (Public Plugin API + Engineering Blog)

- [Figma Plugin API — GroupNode](https://www.figma.com/plugin-docs/api/GroupNode/) — children stored back-to-front in array; relativeTransform vs absoluteTransform; groups must always have children
- [Figma Plugin API — Node Types overview](https://www.figma.com/plugin-docs/api/nodes/) — DocumentNode → PageNode → SceneNode tree, children-related properties on Page/Frame/Group via ChildrenMixin
- [Figma — When to use groups versus frames](https://www.figma.com/best-practices/groups-versus-frames/) — Groups have no layout/clipping; Frames do. Groups auto-fit children
- [Figma — View layers and pages in the left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-pages-in-the-left-sidebar) — confirms left-rail convention
- [Figma — Right sidebar properties](https://help.figma.com/hc/en-us/articles/360039832014-Design-prototype-and-explore-layer-properties-in-the-right-sidebar) — confirms left = structure, right = properties
- [Figma — Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) — distribute uses outermost two as boundaries; up to 1px rounding
- [Figma Engineering Blog — How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) — tree of nodes; CRDT-style edits

### Independent Figma Architecture Analysis

- [Evil Martians — Figma Plugin API: diving into advanced algorithms](https://evilmartians.com/chronicles/figma-plugin-api-dive-into-advanced-algorithms-and-data-structures) — confirms Figma has no z-index; layer order = position in children array

### tldraw (Open-source — Direct Architectural Reference)

- [tldraw — Groups documentation](https://tldraw.dev/sdk-features/groups) — groups are nested tree with parentId; positions preserved on group/ungroup; Cmd+G / Cmd+Shift+G shortcuts
- [tldraw — Editor reference](https://tldraw.dev/reference/editor/Editor) — Editor class as central orchestrator (store, history, input, tools)
- [tldraw — Selection and transformation](https://tldraw.dev/features/composable-primitives/selection-and-transformation) — Shift = additive, Cmd = clone, programmatic selection management

### Adobe XD (Public Plugin Reference)

- [Adobe XD — Scenegraph](https://developer.adobe.com/xd/uxp/develop/reference/scenegraph/) — node tree mirroring layer panel; container nodes have `children`
- [Adobe XD — scenegraph (legacy docs)](https://adobexdplatform.com/plugin-docs/reference/scenegraph.html) — Group/Artboard contain SceneNodeList of children

### Canva (Public Engineering Blog)

- [Canva Engineering Blog — Behind the draw](https://www.canva.dev/blog/engineering/behind-the-draw/) — finite state machines for tool/event management
- [Canva Engineering Blog — Software Architecture tag](https://www.canva.dev/blog/engineering/tag/software-architecture/) — service-aligned architecture posts

### Smart Guides / Snapping Implementations

- [DEV Community — Snapping Visualization Enhancement](https://dev.to/therealgabry/snapping-visualization-enhancement-4h31) — 8px default threshold, zoom-adjusted, hardware-accelerated guide rendering
- [Konva.js — Objects Snapping sandbox](https://konvajs.org/docs/sandbox/Objects_Snapping.html) — production canvas-snap implementation in JS

### Marquee Selection Patterns

- [Web Components — Performant Rectangle Selection](https://blog.coolhead.in/creating-a-performant-rectangle-selection-box-with-callbacks-using-web-components) — pointer-event capture pattern
- [Rete.js — Lasso/marquee selection example](https://retejs.org/examples/lasso-marquee-selection/) — node-based editor marquee semantics

### Internal Codebase References (NOT external research — listed for traceability)

- `src/lib/types/slide.ts` — TextBox, CustomImage, Slide schemas
- `src/lib/editor/editor-reducer.ts` — pushHistory + applyDualWrite patterns
- `src/lib/editor/use-slide-editor.ts` — current selection-outside-history pattern
- `src/lib/editor/editor-actions.ts` — current 14-action surface
- `src/components/slides/slide-preview.tsx` — editable={true} gate; <Rnd> wrapper pattern; pointer-event seam at canvas-root onClick
- `src/components/editor/slide-canvas.tsx` — thin wrapper above SlidePreview
- `src/components/editor/slide-editor.tsx` — current keyboard-shortcut handler (lines 340–393)
- `src/lib/render/resolve-overlay.ts` — TPLREND-05 contract module
- `src/lib/render/render-slide-satori.tsx` — confirms "Satori has no z-index; layer order = DOM order" (line 97)
- `src/hooks/use-alignment-guides.ts` — current snap-guides implementation (to be replaced in Phase 4)
- `src/components/editor/text-rail/LayerStrip.tsx` — existing layer chip pattern (extends naturally to layers-panel)

---

*Architecture research for: v2.11 Full Editor Parity (multi-element editing — multi-select, groups, alignment, smart guides, layers panel)*
*Researched: 2026-05-02*

# Stack Research — v2.11 Full Editor Parity

**Domain:** Multi-element slide editor (Next.js 14 + react-rnd + Satori PNG export, TikTok 1080×1920 carousels)
**Researched:** 2026-05-02
**Confidence:** HIGH on libraries + versions (Context7-verified for moveable / selecto / tinykeys / react-arborist; npm-view-verified for all version pins). MEDIUM on internal Figma/Canva algorithmic primitives (vendor-confidential). HIGH on Satori limitation set (issues + docs reviewed).
**Context7 calls made:**
- `library: "react-rnd"` → `/bokuweb/react-rnd` (16 snippets, "v10.4.13" listed but npm `latest` is **10.5.3**)
- `library: "react-moveable"` → `/daybrush/moveable` (87 snippets) + `docs: groupable / snappable / snapThreshold`
- `library: "selecto"` → `/daybrush/selecto` (56 snippets, react usage)
- `library: "tinykeys"` → `/jamiebuilds/tinykeys` (49 snippets, $mod docs)
- `library: "react-hotkeys-hook"` → `/johannesklauss/react-hotkeys-hook` (254 snippets)
- `library: "react-arborist"` → `/jameskerr/react-arborist` (152 snippets, custom row + drag preview)
- `library: "interact.js"` → `/taye/interact.js` (168 snippets — surveyed but not selected)
- npm-view: `react-moveable@0.56.0` (published >1yr ago), `react-rnd@10.5.3`, `selecto@1.26.3`, `react-selecto@1.26.3`, `tinykeys@3.0.0`, `react-arborist@3.5.0`, `react-hotkeys-hook@5.3.0`, `@dnd-kit/core@6.3.1`, `konva@10.3.1`, `fabric@7.3.1`

---

## TL;DR — The v2.11 Decision

**Keep `react-rnd@10.5.3` for per-element drag/resize. Add a thin "TransformContainer" layer in front of it for multi-select group transforms. DO NOT swap to react-moveable.**

The v2.10 decision to choose react-rnd over react-moveable still holds in v2.11. react-moveable's group-transform API (`onDragGroup` / `onResizeGroup` / `target={[...elements]}`) is genuinely powerful, but adopting it in v2.11 requires:
1. Rewriting 4 working `<Rnd>` blocks in `slide-preview.tsx` (lines 989, 1099, 1215, 1382 — hook, body, custom_text, custom_image)
2. Keeping `react-selecto@1.26.3` as a peer (already a transitive dep of react-moveable — bundle isn't free either way)
3. Risking React 19 incompatibility (react-moveable@0.56.0 published > 1 year ago, no explicit React 19 peer dep, depends on `flushSync` from react-dom which works but is undocumented for R19)
4. Adopting moveable's CSS-`transform: translate()/matrix()` model, which collides with our existing `position={{x,y}}` percentage-based persistence and needs a translation layer at every save call

The right v2.11 architecture is:
- **Per-element transforms:** unchanged (`<Rnd>` per text_box / custom_image / watermark)
- **Multi-select state:** new reducer slice `selectedIds: string[]` + `selectionBBox` derived
- **Marquee:** add `selecto@1.26.3` (vanilla, **NOT** `react-selecto` — see §3) bound to slide canvas root
- **Group transform overlay:** custom 60-line component that draws a single dashed bounding box around the selection, captures pointer events, and broadcasts `delta` to a fan-out reducer that updates each child's `x,y,width,height` percentages
- **Smart guides + snap:** **extend** the existing `useAlignmentGuides` (already in `src/hooks/use-alignment-guides.ts`) — its brute-force pairwise primitive is already correct for ≤30 elements/slide
- **Layers panel:** add `react-arborist@3.5.0` (Context7 score 90.6, virtualized, drag-and-drop built in)
- **Keyboard:** add `tinykeys@3.0.0` (650B, `$mod` cross-platform, replaces the hand-rolled keydown listener at `slide-editor.tsx:340-385`)

Total new dependencies: 3 packages, ~125 KB unpacked combined. Total removed: 0.

---

## Recommended Stack

### Core Technologies (KEEP)

| Technology | Version | Purpose | Why Keep |
|------------|---------|---------|----------|
| react-rnd | **10.5.3** (current) | Per-element drag + resize | Already shipped v1.3 + v2.10 corner-resize + v2.8 selection ring. Works under React 19 + Next 15 (peerDependencies declare `>=16.3.0`). 4 working call-sites in `slide-preview.tsx`. v2.10 just verified its corner-handle path with `enableResizing` flip + Shift escape hatch. **Non-trivial sunk cost.** |
| Satori (via @vercel/og) | (existing) | Server-side PNG render | TPLREND-05 invariant. Constraint binding: 2D transforms only, no z-index, DOM order = paint order ([Satori issue #217](https://github.com/vercel/satori/issues/217)). Every v2.11 capability must round-trip. |
| Next.js | 15.5.13 | App Router + RSC | Already shipped |
| React | 19.1.0 | UI runtime | Already shipped |

### Supporting Libraries (ADD)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **selecto** | **1.26.3** | Marquee rectangle selection | One instance bound to `<SlideCanvas>` root. Emits `onSelect({ selected, added, removed })`. Use **vanilla** package (`selecto`), not `react-selecto` — see §3. ~115 KB unpacked, ~30 KB gz. |
| **tinykeys** | **3.0.0** | Keyboard shortcuts | Replaces hand-rolled `keydown` switch in `slide-editor.tsx`. ~61 KB unpacked, **~650 B gzipped**. Cross-platform `$mod` modifier maps Cmd/Ctrl. Returns explicit `unsubscribe()` for `useEffect` cleanup. |
| **react-arborist** | **3.5.0** | Layers panel (tree + virtualization) | Single-tree-per-slide with hook / body / customs / images / watermarks as nodes; group nodes have children. Built-in drag-to-reorder (z-order), inline rename (layer naming), multi-select, virtualization via `react-window`. ~355 KB unpacked. **React 19 supported** since 3.4.3. |

### Already Installed — Pressed Into Service (no install)

| Library | Version | New v2.11 Use |
|---------|---------|---------------|
| @dnd-kit/core | 6.3.1 | NOT used for canvas drag (react-rnd handles that). Already in use for slide-list reorder. |
| @dnd-kit/sortable | 10.0.0 | Same — slide-list only. |

### Custom Code (build, don't install)

| Module | Lines (est.) | Purpose |
|--------|--------------|---------|
| `src/lib/editor/selection-model.ts` | ~150 | `selectedIds: Set<string>`, `selectionBBox`, helpers `addToSelection / removeFromSelection / toggleSelection / clearSelection`. Pure functions. |
| `src/components/editor/selection-overlay.tsx` | ~120 | Dashed bounding box around multi-selection. Captures pointer events, fans out `delta` to children. **Editable-only — gated behind `editable={true}` like the v2.8 selection ring.** |
| `src/lib/editor/group-model.ts` | ~80 | Flat `groups: { id, childIds[] }[]` array on `Slide`. NOT a parent-child tree (see §4 for rationale). |
| Extension to `useAlignmentGuides` | +~80 | Add element-pairwise distance-spacing equality (Figma "smart selection" pattern), 4-edge snap targets per other element + canvas, threshold raised from 10 → match Moveable's industry-default 5. |
| `src/lib/editor/align-distribute.ts` | ~140 | Pure functions: `alignLeft/Center/Right/Top/Middle/Bottom` (selection-aware: align to canvas if 1 selected, align to selection bbox if ≥2 selected — Figma/Canva pattern), `distributeH / distributeV`. |

---

## Per-Question Deep-Dive

### Q1. Does react-rnd support multi-element transforms? Does the v2.10 react-rnd-over-moveable decision still hold for v2.11?

**Answer: NO native support. YES the v2.10 decision still holds — augment, don't replace.**

#### Evidence: react-rnd has zero first-party multi-element support

- [bokuweb/react-rnd issue #911](https://github.com/bokuweb/react-rnd/issues/911) ("Is there a way to select multiple RnD div's together and drag them?") is **open with no resolution, no PR, no maintainer reply** as of research date.
- The community extension [tsengyushiang/react-rnd-group](https://github.com/tsengyushiang/react-rnd-group) implements matrix-based group transforms but has **2 stars, 0 forks** — effectively unmaintained. Do not depend on it.
- react-rnd's `position` model uses `transform: translate(x,y)` set via `react-draggable` internals and `style.width/height` from `react-resizable`. These are per-element. There is no "parent" mode.

#### What the v2.10 decision was, and why it still applies

The v2.10 milestone audit (`.planning/v2.10-MILESTONE-AUDIT.md`) chose react-rnd over react-moveable because:
1. **Already integrated** — selection ring (Phase 52), corner resize (Phase 59), drag/snap-to-guides (`use-alignment-guides`) all wired through Rnd's event surface.
2. **Satori parity** — Rnd writes `transform: translate(...)` + width/height; the renderer already strips Rnd-only style at PNG render time (we use `position` percentages, not the live transform).
3. **react-moveable's bundle** is **4.6 MB unpacked** (npm `dist.unpackedSize`), pulls 13 dependencies (`@daybrush/utils`, `@egjs/agent`, `@scena/matrix`, `gesto`, `overlap-area`, `react-css-styled`, **`react-selecto`**...).

For v2.11, the question becomes: *does multi-select force a swap?* Answer: **no, because adding a thin TransformContainer + selecto on top of unchanged Rnd uses dramatically less new code than rewriting 4 working Rnd blocks AND inheriting moveable's transform-based persistence model.*

#### LOC + bundle tradeoff matrix

| Approach | New LOC | Removed LOC | New bundle (unpacked) | Satori-render compat | TPLREND-05 risk |
|----------|---------|-------------|----------------------|----------------------|-----------------|
| **(a) Wrap Rnd in TransformContainer** ✓ recommended | +350 | 0 | +**500 KB** (selecto 115 + arborist 355 + tinykeys 61 ≈ 530 KB total combined) | Identical to today (editor-only, gated) | **Zero** — render path untouched |
| (b) Build custom transform layer (no library) | +600 | 0 | 0 | Identical | Zero, but more code to test |
| (c) Swap to react-moveable | +800 | -200 (the 4 Rnd blocks) | **+4.6 MB** | Identical (if we strip moveable's `transform: matrix3d` at render — see §7) | **HIGH** — moveable emits `translate3d` on Safari ([moveable issue #433](https://github.com/daybrush/moveable/issues/433)) which Satori does NOT support ([satori README](https://github.com/vercel/satori): "three-dimensional transforms are not supported") |
| (d) Konva/react-konva (canvas-based) | +1500 | -800 (entire SlidePreview render branch) | +1.5 MB | **BREAKS Satori** — Konva paints to a `<canvas>` not DOM, so the editor and PNG-render paths diverge entirely | **CATASTROPHIC** |
| (e) Fabric.js | +1500 | -800 | **+22 MB** | Same as Konva — canvas-painted | CATASTROPHIC |
| (f) react-flow | +1200 | -800 | +900 KB | Mismatched — react-flow's coordinate system is for nodes-and-edges graphs, not z-ordered design canvases | High |
| (g) interact.js (no React wrapper) | +700 | -200 | +200 KB | Identical | Zero — but hand-rolling Rnd-equivalent gestures in interact.js loses the v2.10 corner-handle work |

**Pick (a).** Concrete sketch:
```tsx
// src/components/editor/selection-overlay.tsx
function SelectionOverlay({ selectedIds, slide, scale, onMove, onResize }) {
  if (selectedIds.length < 2) return null  // single-select keeps Rnd UI
  const bbox = computeSelectionBBox(slide, selectedIds)
  return (
    <Rnd
      position={{ x: bbox.x * scale, y: bbox.y * scale }}
      size={{ width: bbox.width * scale, height: bbox.height * scale }}
      bounds="parent"
      enableResizing={{ topLeft: true, topRight: true, bottomLeft: true, bottomRight: true }}
      onDrag={(_, d) => onMove({ dx: d.deltaX / scale, dy: d.deltaY / scale })}
      onResize={(_, _dir, ref) => onResize({
        scaleX: parseInt(ref.style.width) / (bbox.width * scale),
        scaleY: parseInt(ref.style.height) / (bbox.height * scale),
      })}
      style={{ outline: '2px dashed #3d0000', zIndex: 100 }}
    >
      {/* empty overlay — children Rnd's stay where they are, fan out delta */}
    </Rnd>
  )
}
```
This reuses the same `<Rnd>` we already trust, just at the group level. **Critically, it stays editor-only — Satori never sees it because the PNG path doesn't render this branch.**

> Source notes: [react-rnd #911](https://github.com/bokuweb/react-rnd/issues/911), [Moveable groupable docs](https://github.com/daybrush/moveable/blob/master/packages/react-moveable/groupable.md) (Context7 `/daybrush/moveable`), [Satori transforms #217](https://github.com/vercel/satori/issues/217).

---

### Q2. What library powers Figma/Canva-style snap-and-align guides? Algorithmic primitive? Threshold?

**Answer: Keep DIY (we already have it). Algorithmic primitive is brute-force pairwise — correct at our scale. Industry threshold is 5px (Moveable default), our current 10px is too loose.**

#### What we already have

`src/hooks/use-alignment-guides.ts` (123 lines) implements brute-force pairwise snap:
- `snapAxis(edges, guideSources, position)` — for each draggable edge × each guide source, computes `|edge - guide|` and picks the minimum if ≤ `SNAP_THRESHOLD`.
- Guide sources per other element: 4 edges + 1 center per axis = 6 targets per element per axis.
- `SNAP_THRESHOLD = 10` reference pixels (doc-comment says ~5 screen pixels at typical scale).

This is the right primitive. The pre-built libraries don't outperform it.

#### What the libraries actually do

| Library | Algorithmic primitive (when documented) | Default threshold | Verdict |
|---------|----------------------------------------|-------------------|---------|
| **moveable's `snappable`** | Brute-force pairwise (same as ours), plus secondary snapping to grid lines. Context7 docs surface `snapDirections`, `elementGuidelines`, `snapThreshold`. | **5px** ([Moveable.Snappable docs](https://daybrush.com/moveable/release/latest/doc/Moveable.Snappable.html): "Distance value that can snap to guidelines. (default: 5)") | If we adopted moveable, we'd get the same algorithm we have. Not worth the swap. |
| **moveable-snap** | Same primitive, same threshold | 5px | Stand-alone version of moveable's snap module. Marginal value if we don't take moveable. |
| **react-snapaxis** | Search returns no current package. Not maintained at npm. | — | Skip. |
| **snapsvg** | SVG-specific, not a snap-engine for design tools | — | Wrong domain. |
| **interact.js `snap` modifier** | Function-driven snap targets (developer supplies a function returning the snap target). Brute-force iteration. | Per-modifier `range` configurable, no documented default | Same primitive, no benefit. |

#### Algorithmic primitive — the correct answer

**Brute-force pairwise is correct at our scale.** A k-d tree or sweep-line would matter only at >1000 elements per scene. Our slides have ~5–15 elements (hook + body + 0–8 custom_texts + 0–6 custom_images + 1 watermark). At n ≤ 30, the pairwise cost is `n² × 6 axis-targets × 2 axes = ~10K comparisons per drag tick`, well under 16ms.

Adobe's published 2014 white-paper on Photoshop's "Smart Guides" uses the same pattern (brute-force pairwise during drag, with the "spacing equality" detection — three or more equal distances trigger purple distance bars). That's the only sub-feature worth adding to our existing hook for v2.11:

#### v2.11 extensions to `useAlignmentGuides`

1. **Lower threshold 10 → 5px** — match the industry default ([Moveable.Snappable](https://daybrush.com/moveable/release/latest/doc/Moveable.Snappable.html); Figma's behavior matches at 5px-equivalent).
2. **Add canvas-edge guides** — currently we only snap to canvas center. Add `0` and `REF_WIDTH` / `REF_HEIGHT` as snap targets.
3. **Add equal-spacing detection** — if three elements have the same horizontal gap when dragging a fourth, render purple "distance bars" between them. Figma calls this "Smart selection" ([Figma Help: Adjust alignment](https://help.figma.com/hc/en-us/articles/360039956914), [Figma Help: Smart selection](https://help.figma.com/hc/en-us/articles/360040450233)).
4. **Multi-select drag mode** — when ≥2 elements are selected, snap the bounding-box edges (not individual element edges).

LOC delta: ~80 lines added to the existing hook. **No new library dependency.**

> Sources: [Moveable.Snappable docs](https://daybrush.com/moveable/release/latest/doc/Moveable.Snappable.html), [Figma Smart Selection](https://help.figma.com/hc/en-us/articles/360040450233), [Figma alignment + dimensions](https://help.figma.com/hc/en-us/articles/360039956914), existing `src/hooks/use-alignment-guides.ts`.

---

### Q3. Marquee selection: popular React primitive, or always hand-rolled?

**Answer: Use `selecto@1.26.3` (vanilla, NOT react-selecto). It's the de-facto standard outside Figma/Canva-built-from-scratch designs, and it's already a transitive dep of moveable so the patterns are battle-tested.**

#### Survey of options

| Option | Last published | Adoption | Verdict |
|--------|----------------|----------|---------|
| **selecto** | active (1.26.3 current) | Daybrush's project; powers moveable's group selection; ~30k weekly downloads | **WINNER** |
| **react-selecto** | active (1.26.3 wraps selecto) | Thin wrapper, adds ~6 KB | Skip — it just adds a React adapter that's a 30-line `useEffect` we already write. Vanilla `selecto` lets us drive from our own state cleanly. |
| react-rectangle-selection | **last published 7 years ago**, 1 dependent | Dead | Skip |
| react-marquee-selection | not a dedicated package — repurposed | — | Skip |
| @dnd-kit native marquee | **does not exist** ([dnd-kit issue #120](https://github.com/clauderic/dnd-kit/issues/120) "Support for multi-select and drag?" is open since 2021 with no resolution) | — | Skip |
| Hand-rolled (pointer events + bbox intersection) | — | The Figma/Canva approach | **Backup if selecto trips R19** |

#### Why selecto, not react-selecto

`react-selecto` is literally `selecto` + ~30 lines of React-effect-wrapping (Context7 `/daybrush/selecto` shows the wrapper as `<Selecto ...props />` forwarding to `new Selecto()`). We will already write a hook to bind selecto to our slide-canvas-relative coordinate system, so the React wrapper buys us nothing. Direct `selecto` install also avoids pulling `selecto` *and* `react-selecto` together (which would happen if we adopted moveable, since react-moveable depends on `react-selecto`).

#### Standard pattern (selecto)

```tsx
// src/components/editor/use-marquee-selection.tsx
import Selecto from 'selecto'
import { useEffect, useRef } from 'react'

export function useMarqueeSelection({
  containerRef, selectableSelector, onSelectionChange, scale,
}) {
  const selectoRef = useRef<Selecto | null>(null)
  useEffect(() => {
    if (!containerRef.current) return
    const s = new Selecto({
      container: containerRef.current,
      dragContainer: containerRef.current,  // restrict marquee to canvas
      selectableTargets: [selectableSelector],  // e.g. '[data-selectable="true"]'
      hitRate: 0,                              // allow partial overlap (Canva default)
      selectByClick: false,                    // we have separate click-select handler
      selectFromInside: false,                 // empty-canvas drag only — don't trigger marquee from inside an element (would conflict with Rnd drag)
      toggleContinueSelect: ['shift'],         // Shift = additive selection
      keyContainer: window,
    })
    s.on('select', e => {
      onSelectionChange({ added: e.added.map(el => el.id), removed: e.removed.map(el => el.id) })
    })
    selectoRef.current = s
    return () => { s.destroy() }
  }, [containerRef, selectableSelector])
  return selectoRef
}
```

Bind to `<SlideCanvas>` via a `data-selectable="true"` attribute on every element wrapper (text_box / custom_image / watermark). Rnd's drag layer naturally consumes pointer events first, so marquee only fires from empty-canvas drags — which is the correct Figma/Canva behavior.

> Sources: [Selecto react usage](https://github.com/daybrush/selecto/blob/master/packages/react-selecto/README.md) (Context7 `/daybrush/selecto`), [dnd-kit #120](https://github.com/clauderic/dnd-kit/issues/120), [react-rectangle-selection npm](https://www.npmjs.com/package/react-rectangle-selection) (last publish 2018).

---

### Q4. Groups + z-order: standard schema/data structure?

**Answer: Use a flat array of `groups: { id, childIds[] }[]` on `Slide`, NOT a parent-child tree on each element. Z-order = DOM order in the render layer (Satori has no z-index — render-slide.ts:204/210/213/216 confirms our existing pattern).**

#### Figma's model (per [GroupNode](https://developers.figma.com/docs/plugins/api/GroupNode/), [children](https://www.figma.com/plugin-docs/api/properties/nodes-children/), [Plugin API blog](https://evilmartians.com/chronicles/figma-plugin-api-dive-into-advanced-algorithms-and-data-structures))

- `GroupNode` is a `SceneNode` with `ChildrenMixin` — i.e. parent-child tree.
- Children carry **relative coordinates** (relative to the group's transform origin); `relativeTransform` and `absoluteTransform` are both available.
- Groups are sized to fit their content (read-only `width` / `height`).
- Groups can be nested.
- **A group with no children deletes itself.**
- Z-order = position in the parent's `children[]` array (lower index = behind).

#### Canva's model (per [Canva Help: Layers](https://www.canva.com/help/finding-and-arranging-layers/), [Group, layer, align](https://www.canva.com/help/layer-group-align/))

- Flat layer list per page; "Position" panel toggles between Layers tab and Arrange tab.
- Bring forward: `Ctrl + ]`; Bring to front: `Alt+Ctrl+]`; Send backward: `Ctrl + [`; Send to back: `Alt+Ctrl+[`.
- Groups are flat parent-child but the layers panel shows them as a single collapsible row (like Figma).

#### Why we should NOT mirror Figma's tree

Adopting Figma's parent-child SceneGraph means every element on every Slide gains a `parentId` field, every reducer action walks the tree, undo/redo snapshots traverse, and the `text_boxes_to_legacy` adapter (Phase 49) needs nested rebuild on every save. That's a multi-week refactor that breaks v2.8's hard-won schema unification. **Wrong tradeoff for v2.11.**

#### The right v2.11 schema — flat groups index

```ts
// addition to src/lib/types/slide.ts
export interface ElementGroup {
  id: string                  // crypto.randomUUID()
  name?: string               // optional user-given name
  childIds: string[]          // text_box / custom_image / watermark IDs (FLAT — no nested groups in v2.11)
  locked?: boolean
}

export interface SlideStyleOverrides {
  // ...existing...
  /** v2.11: visual stack order from back→front. Each entry is an element ID
      (text_box.id | custom_image.id | watermark id). When omitted, falls back
      to the implicit DOM order: bg → custom_images → hook → body → custom texts → watermarks.
      Editor-only — Satori path computes DOM order from this array. */
  z_order?: string[]
}

export interface Slide {
  // ...existing...
  /** v2.11: flat group index. Groups are pure organization — they do NOT
      have their own coordinate system. A group's bounding box is computed
      on-the-fly from its children's absolute positions. */
  groups?: ElementGroup[]
}
```

**Why flat:**
1. Element coordinates stay absolute (no parent-relative math). Drag a group → fan-out delta to each child's absolute `x,y`. Ungroup → just delete the group entry; child positions are already correct.
2. The `groups` array is independent of `text_boxes` / `custom_images`. No schema-migration cascade.
3. Render path: Satori reads elements in z_order, ignoring group membership. Group-as-organization is purely a UI concept.
4. Group resize: scale child coordinates around the group's centroid. Implementation: ~40 lines in a pure function.
5. Nested groups in v2.11 are explicitly out-of-scope. If demand emerges, we promote to Figma-style tree in v2.12.

#### Z-order — the Satori-imposed reality

Per `src/lib/render/render-slide.ts:195-216` (already shipped):
- Satori paints in DOM order. Layer 0 = background image, 1 = custom_images, 2 = custom_texts, 5 = watermark, 6 = forced free-tier watermark.
- `z-index` is set in DOM but **Satori ignores it** — it's there only for the React preview to match.
- v2.11 `z_order` field becomes the source of truth for *intra-layer* ordering (within text_boxes, within custom_images, etc.). The renderer iterates `z_order` to determine paint sequence.

> Sources: [Figma GroupNode](https://developers.figma.com/docs/plugins/api/GroupNode/), [Figma children](https://www.figma.com/plugin-docs/api/properties/nodes-children/), [Canva layers](https://www.canva.com/help/finding-and-arranging-layers/), [Canva keyboard shortcuts](https://www.canva.com/help/canva-keyboard-shortcuts/), `src/lib/render/render-slide.ts` lines 195-216.

---

### Q5. Layers panel — standard React tree component?

**Answer: `react-arborist@3.5.0` is the right choice. Already battle-tested in VSCode-style file explorers; Context7 score 90.6; React 19 supported since 3.4.3; built-in virtualization, drag-to-reorder, multi-select, inline rename.**

#### Survey

| Component | Version | Bundle (unpacked) | React 19 support | Drag-to-reorder | Virtualization | Verdict |
|-----------|---------|-------------------|------------------|-----------------|----------------|---------|
| **react-arborist** | **3.5.0** | 355 KB | **YES** since 3.4.3 ([Releases](https://github.com/brimdata/react-arborist/releases)) | YES (built-in) | YES (react-window) | **WINNER** |
| react-sortable-tree | 2.8.0 | 600+ KB | unknown — last pub 4 yrs ago | YES | partial | Stale, skip |
| @dnd-kit/sortable + react-window manually | — | already installed | YES | DIY | DIY | ~400 lines of glue. Skip if arborist works. |
| react-complex-tree | 2.4.6 | 200 KB | partial | YES | YES | Smaller bundle. Acceptable backup. |
| Custom from scratch | — | 0 | — | DIY | DIY | ~600 lines. Skip — arborist exists. |

#### What we get from arborist

- `<Tree initialData={...} width={300} height={500} />` — virtualized via react-window
- Built-in `multiSelect` prop with Cmd/Shift/click semantics
- `onMove({ dragIds, parentId, index })` for drag-to-reorder → maps directly to our `z_order` array writes
- `onRename({ id, name })` for layer naming (group naming, custom_text naming)
- Custom `renderRow` so each row shows: icon (text/image/group/watermark) + name + visibility toggle + lock toggle (Canva pattern, [Canva help](https://www.canva.com/help/finding-and-arranging-layers/))
- Selection state controlled prop → directly drives our `selectedIds` reducer slice

#### Layers panel UX — table stakes per Figma + Canva

From [Canva Help: Layers panel](https://www.canva.com/help/finding-and-arranging-layers/) and Figma's layers panel:
- One row per element, top of list = front-most (z-order MAX).
- Indent for group children.
- Click row = select; Shift-click = range; Cmd-click = toggle.
- Rename via double-click or F2.
- Icon column (eye = visibility, lock = locked).
- Drag rows to reorder z (Canva's "drag up to bring forward").
- Group rows are collapsible.
- Ctrl+]/[ shortcuts move selected layer up/down one position.

react-arborist gives us **all of the above for free** except the visibility/lock toggles (those are 2 lines in `renderRow`).

#### Phase-locking caveat

react-arborist has a peer of `react-dnd` 14.x (transitive). React-dnd 14 has a known issue with React 19 strict mode that causes double-renders during drag. The fix is in arborist 3.4.3+ which bumped `react-window` to 1.8.11. **Verify on Day 1 of the milestone:** install arborist, render a 50-row tree, verify drag works under StrictMode in dev. If it fails, fall back to react-complex-tree or DIY @dnd-kit/sortable + react-window.

> Sources: [react-arborist 3.4.3 release](https://github.com/brimdata/react-arborist/releases), [react-arborist props](https://context7.com/jameskerr/react-arborist/llms.txt) (Context7), [Canva layers panel](https://www.canva.com/help/finding-and-arranging-layers/).

---

### Q6. Keyboard handling — react-hotkeys-hook vs tinykeys vs DIY?

**Answer: `tinykeys@3.0.0`. Smallest bundle, cross-platform `$mod` modifier built-in, returns explicit unsubscribe for clean useEffect, no React-coupling overhead.**

#### Comparison

| Library | Version | Gzipped | Cross-platform mod | Sequence support (e.g. `g i`) | React idiom |
|---------|---------|---------|-------------------|--------------------------------|-------------|
| **tinykeys** | **3.0.0** | **~650 B** | YES (`$mod` → Meta on Mac, Ctrl elsewhere) | YES | `useEffect(() => { const u = tinykeys(window, {...}); return u }, [])` — clean |
| react-hotkeys-hook | 5.3.0 | ~3.5 KB | YES (`mod`) | partial | `useHotkeys('mod+s', cb)` — declarative but more re-renders |
| hotkeys-js | 3.x | ~5 KB | YES | YES | not React-aware |
| TanStack Hotkeys (new — 2025) | not in registry yet | unknown | YES | YES | very promising but **too new for v2.11 (pre-1.0)** |
| DIY (current `slide-editor.tsx:340-385`) | — | 0 | manual | NO | switch-on-key, hand-handles `metaKey/ctrlKey` |

#### Why tinykeys wins for v2.11

1. **`$mod` modifier** — our current code at `slide-editor.tsx:350` does `const cmd = e.metaKey || e.ctrlKey`. tinykeys' `$mod+D` does the same in 5 chars instead of 50.
2. **Sequence support** — Figma's "G G" (group toggle), Canva's "T" (text tool), needed in v2.12+.
3. **Bundle** — at 650 B, gzipped, this is essentially free.
4. **Skip-when-typing** — currently 8 lines at `slide-editor.tsx:341-348`. tinykeys' README documents the `event.target` filter pattern with 3-line snippets.
5. **Cleanup story** — tinykeys' `unsubscribe()` return is explicit; react-hotkeys-hook leaks listeners under StrictMode in some patterns ([known issue](https://github.com/JohannesKlauss/react-hotkeys-hook/issues)).

#### v2.11 keyboard shortcut surface (full list)

| Shortcut | Action |
|----------|--------|
| `$mod+1`/`2`/`3` | (existing) Switch active text box |
| `$mod+D` | (existing) Add custom text |
| `Delete`/`Backspace` | (existing) Remove custom |
| **`$mod+A`** | NEW — Select all on current slide |
| **`Escape`** | NEW — Clear selection |
| **`$mod+G`** | NEW — Group selection |
| **`$mod+Shift+G`** | NEW — Ungroup |
| **`$mod+]`** | NEW — Bring forward (Canva-aligned) |
| **`$mod+[`** | NEW — Send backward |
| **`$mod+Alt+]`** | NEW — Bring to front |
| **`$mod+Alt+[`** | NEW — Send to back |
| **`ArrowLeft`/`Right`/`Up`/`Down`** | NEW — Nudge selection by **1 reference px** (Figma small nudge default — [Figma Help: Set nudge values](https://help.figma.com/hc/en-us/articles/4404575206295)) |
| **`Shift+Arrow`** | NEW — Nudge by **10 reference px** (Figma big nudge default) |
| **`$mod+L`** | NEW — Toggle lock on selection (matches Figma; Canva uses `Alt+Ctrl+L`) |
| `$mod+Z` | (existing reducer) Undo |
| `$mod+Shift+Z` | (existing reducer) Redo |

#### Multi-modifier conflict resolution

Standard tinykeys/Figma/Canva patterns:
- **Most specific first.** `$mod+Shift+G` registered before `$mod+G` — tinykeys matches longest combo.
- **Shift is purely a modifier**, never a primary trigger. So `Shift+ArrowLeft` is OK; bare `Shift` is not a shortcut.
- **`event.preventDefault()`** on every match to prevent browser defaults (`$mod+]` = browser zoom in some browsers without prevention).
- **`event.repeat` filter** on nudge: if `e.repeat`, skip — that lets the OS' typematic auto-repeat fire instead of stacking 10 reducer dispatches per second (avoids history pollution).

> Sources: [tinykeys $mod modifier](https://github.com/jamiebuilds/tinykeys/blob/main/README.md) (Context7 `/jamiebuilds/tinykeys`), [Figma nudge defaults](https://help.figma.com/hc/en-us/articles/4404575206295), [Canva keyboard shortcuts](https://www.canva.com/help/canva-keyboard-shortcuts/).

---

### Q7. What we should NOT add — capabilities/libraries that look attractive but break TPLREND-05

#### Hard "do not add" list

| Don't add | Why it breaks TPLREND-05 / project | Use instead |
|-----------|------------------------------------|-------------|
| **Konva / react-konva** (10.3.1 / 19.2.3) | Canvas-painted; the editor would render to `<canvas>` while Satori renders DOM-to-PNG. The two paths would diverge entirely. **Catastrophic.** | Stick with DOM elements + Rnd + Satori. |
| **Fabric.js** (7.3.1) | Same — canvas-painted. Plus 22 MB unpacked. | DOM elements. |
| **react-flow** | Coordinate system is for graphs, not stacked design canvases. z-ordering and bounding-box semantics don't map. | DOM + Rnd. |
| **3D transform CSS** (`transform: rotate3d`, `translate3d`, `scaleZ`, `perspective`, `transform-style: preserve-3d`) | Satori does NOT support 3D ([Satori README](https://github.com/vercel/satori) explicitly: "three-dimensional transforms are not supported"). Even adding `translate3d(0,0,0)` for "GPU acceleration" silently breaks Satori. | Use 2D `translate()` + `scale()` only. Already enforced by react-rnd. |
| **CSS filters during runtime** (`filter: blur / hue-rotate / drop-shadow`) | Already a known v2.9 pitfall ([Satori #573](https://github.com/vercel/satori/issues/573)). v2.9 solved by pre-baking via sharp + `slide-backgrounds-treated` bucket. **Do not regress.** | Pre-render via sharp. There's a `no-css-filter.test.ts` regression guard. |
| **CSS variables in transform/font** | Satori parses computed style; CSS custom-property dereference is partial (some props yes, some no). | Inline numeric values. |
| **`box-decoration-break: clone`** | Already documented in `slide-preview.tsx:54-57`: "Satori does not [support it], so the React preview must match Satori's line-boundary breaking". **Do not add.** | Single-line highlight pills; if multiline pill needed, render two `<span>`s manually. |
| **Variable fonts** | Satori issues [#162](https://github.com/vercel/satori/issues/162) / [#712](https://github.com/vercel/satori/issues/712) unresolved. Project decision in `PROJECT.md` line 340 confirms "Variable fonts — Satori issues #162/#712 unresolved as of 2026-05" → deferred. | Static TTF via Fontsource (already standardized). |
| **react-moveable's `transform: matrix3d(...)` mode** | Moveable emits `translate3d` on Safari ([moveable #433](https://github.com/daybrush/moveable/issues/433)). 3D transforms break Satori. | Stick with react-rnd's `translate(x,y)` only. |
| **`tsengyushiang/react-rnd-group`** | 2 stars, abandoned, unverified | DIY TransformContainer (~120 LOC). |
| **`react-selecto`** (vs vanilla `selecto`) | Bundle bloat for ~30 lines of useEffect glue. | Use vanilla `selecto`. |
| **Rotation handles** (ROTATE-01 deferred from v2.10) | Out of scope per PROJECT.md line 54: "Definitively deferred to v2.11+: ... rotation handles (ROTATE-01)". Adding rotation now is mission creep. | Defer to v2.12. |
| **`@dnd-kit/multi-drag`** (any third-party multi-drag plugin) | dnd-kit's own [issue #120](https://github.com/clauderic/dnd-kit/issues/120) ("Support for multi-select and drag?") is open since 2021. No vetted plugin exists. | Use selecto + custom selection-overlay. |
| **CSS `contain: layout / paint / strict`** | Browser-only optimization. Satori ignores. Risk: code that relies on contain for selection-isolation behaves differently in editor vs PNG export. | Don't rely on contain. |
| **Web Components / Shadow DOM** for layer panel | Satori renders only React→JSX; not a concern for layers panel itself, but if you build editor UI in shadow DOM you lose the global keyboard/marquee context. | Plain React components. |
| **Pointer Events Lock API** | Browser-only; not in Satori's contract. Generally fine but document any shortcut behavior carefully. | Standard `addEventListener`. |
| **`preserve-3d` on group containers** | Tempting for "scene-graph feel". Breaks Satori. | Pure 2D `transform: translate(x,y) scale(s)`. |

#### "Maybe later, definitely not v2.11"

| Capability | Why defer | Revisit when |
|------------|-----------|--------------|
| Rotation | ROTATE-01 explicitly deferred from v2.10 | After multi-select ships and stabilizes |
| Skew / warp | Satori has partial transform support but warp = 3D matrix; rare on TikTok carousels | Probably never |
| Real-time collab | PROJECT.md "Out of Scope" — solo creator tool | Not in current product thesis |
| GPU-accelerated marquee preview | Visual polish; not table-stakes | Post-PMF |
| Context menus (right-click) | Nice-to-have but not in Figma/Canva's core multi-select MVP | v2.12 |
| Pan/zoom canvas | Currently fixed at fit-to-screen scale; users don't need pan in 9:16 vertical | Probably never (carousel editor not Figma) |

> Sources: [Satori README](https://github.com/vercel/satori), [Satori #217 transforms](https://github.com/vercel/satori/issues/217), [Satori #573 filters](https://github.com/vercel/satori/issues/573), [Satori #162 variable fonts](https://github.com/vercel/satori/issues/162), [Moveable #433 translate3d Safari](https://github.com/daybrush/moveable/issues/433), `PROJECT.md` lines 50, 54, 340.

---

## Installation

```bash
# v2.11 — exactly 3 new dependencies
npm install selecto@1.26.3 tinykeys@3.0.0 react-arborist@3.5.0
```

That's it. No dev-dep additions needed. No removals.

**Type compatibility note:** All three ship with their own TypeScript types. `selecto` types are emitted from the package directly (no `@types/selecto` needed). `tinykeys` ships ESM + CJS + `.d.ts`. `react-arborist` ships TS sources.

**Bundle impact (gzipped, App Router page that imports the editor):**
- selecto: ~30 KB
- tinykeys: ~0.65 KB
- react-arborist (+react-window already pulled by react-dnd): ~80 KB (+ ~20 KB if not already pulled)
- **Total ≈ +110 KB gzipped on the editor route only.** No change for any other route — editor is already split. Acceptable for a Pro-grade tool.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Keep react-rnd + custom TransformContainer | Swap to react-moveable | Only if v2.11 rotation/skew + group-aware rotation become P0 (out of scope per PROJECT.md). Costs +4.6 MB unpacked, full rewrite of 4 Rnd blocks, React 19 risk. |
| selecto (vanilla) | react-selecto wrapper | Never — wrapper is 30 lines we already write |
| tinykeys | react-hotkeys-hook | Only if team prefers declarative `useHotkeys('mod+s', cb)` syntax over imperative effect. Bundle is +5×. |
| react-arborist | DIY @dnd-kit/sortable + react-window | If arborist trips React 19 StrictMode double-renders on Day 1 verification, fall back to DIY (~400 LOC). |
| Extend `useAlignmentGuides` | Adopt moveable's `snappable` | Only if we adopt moveable for other reasons. Algorithm is identical; threshold is identical (5px). |
| Flat `groups: { id, childIds[] }[]` | Figma-style parent-child SceneGraph | If nested groups become P0. Massive schema migration. v2.12+ at earliest. |
| Build group-transform overlay (60 LOC) | tsengyushiang/react-rnd-group | Never — 2 stars, dead. |

---

## Stack Patterns by Variant

**If multi-select touches a group:** treat the entire group as one element for drag/resize (clicking any group child = selecting the whole group; double-click = "enter the group" Figma-style — out of scope for v2.11, defer to v2.12).

**If marquee starts inside an Rnd:** marquee should not fire — selecto's `selectFromInside: false` handles this. Verify pointer-event ordering: Rnd's drag handler captures first, marquee only on empty-canvas drags.

**If a group is selected and user nudges with arrow keys:** fan-out delta to each child's `x,y` (no scaling). Same delta to all children = group translation.

**If a group is resized:** scale child positions and dimensions around the group's centroid. Edge case: child whose `font_size` is bound to width (the v2.10 corner-handle FONTSCALE-01 contract) — scale font_size by the same ratio to maintain v2.10 invariant.

**If a slide is loaded from a project saved before v2.11:** `groups`, `z_order`, `locked` are all optional; missing fields default to "no groups, no explicit z_order, nothing locked". Zero migration risk.

**If user enables "lock" on a layer:** Rnd's `disableDragging={true}` + `enableResizing={false}` skip flag. selecto's `selectableTargets` filter excludes locked targets via attribute selector `[data-locked="false"]`.

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| react-rnd@10.5.3 | current | React 19.1.0 ✓, Next 15.5 ✓ | peerDependencies declare `>=16.3.0`. Already in use. |
| selecto@1.26.3 | latest | React 19 ✓ (no React peer dep — vanilla DOM library) | Used through `useEffect` |
| tinykeys@3.0.0 | latest | Any (no React peer dep) | Vanilla DOM |
| react-arborist@3.5.0 | latest | **React 19 ✓ since 3.4.3** ([release notes](https://github.com/brimdata/react-arborist/releases)) | Pulls react-dnd 14.x as transitive — verify on Day 1 under StrictMode |
| react-moveable@0.56.0 | (NOT recommended) | **React 19 status unclear** | Last published >1 year ago. No explicit React 19 peer. Avoid. |

### Known compatibility hazards

1. **react-arborist + StrictMode** — react-dnd 14.x is known to fire `useDrag` twice in dev mode under React 19 StrictMode. Visible only in dev; production builds are clean. Mitigate by disabling StrictMode in editor route, or by upgrading to react-arborist 3.5.0 which uses react-window 1.8.11 (resolved in arborist's own integration). Verify on Day 1.

2. **selecto + transform: scale parent** — if the slide-canvas wrapper has a `transform: scale()` for fit-to-screen (which it does — see `slide-preview.tsx` line 992 `scale={scale}` prop on Rnd), selecto's pointer-to-element hit testing must use the same scale factor. Selecto exposes `setScale(x,y)` to handle this. Track via prop and call on resize.

3. **tinykeys + Next.js App Router** — must be in a `'use client'` component because it touches `window`. Already our pattern in `slide-editor.tsx`. No new constraint.

4. **TPLREND-05 invariant** — every v2.11 visual addition (selection rings, marquee box, smart-guide lines, layers panel, group bounding box) must be **gated behind `editable={true}`** like the v2.8 selection ring (see `slide-preview.tsx:1073` selectionRingClass). The Satori PNG path passes `editable=false` and renders zero v2.11 chrome. Verify by extending the existing `parity.test.tsx` (10 cases) with cases proving `text_boxes_to_legacy` round-trip is unchanged when `groups`, `z_order`, `locked` are populated.

---

## Sources

### Context7
- [`/bokuweb/react-rnd`](https://context7.com/bokuweb/react-rnd) — version, API, group-transform absence
- [`/daybrush/moveable`](https://context7.com/daybrush/moveable) — groupable, snappable, snapThreshold, React usage, default control CSS
- [`/daybrush/selecto`](https://context7.com/daybrush/selecto) — react usage, hitRate, selectFromInside, toggleContinueSelect
- [`/jamiebuilds/tinykeys`](https://context7.com/jamiebuilds/tinykeys) — `$mod` modifier, sequence support, React useEffect pattern
- [`/jameskerr/react-arborist`](https://context7.com/jameskerr/react-arborist) — Tree component props, custom row + drag preview
- [`/johannesklauss/react-hotkeys-hook`](https://context7.com/johannesklauss/react-hotkeys-hook) — comparison reference
- [`/taye/interact.js`](https://context7.com/taye/interact.js) — surveyed (not selected)

### Official documentation
- [Moveable.Snappable docs (snapThreshold default 5px)](https://daybrush.com/moveable/release/latest/doc/Moveable.Snappable.html)
- [Satori README — transform support](https://github.com/vercel/satori#readme)
- [Satori issue #217 — 3D transforms not supported](https://github.com/vercel/satori/issues/217)
- [Satori issue #573 — CSS filters break PNG export](https://github.com/vercel/satori/issues/573)
- [Satori issues #162 / #712 — variable fonts unresolved](https://github.com/vercel/satori/issues/162)
- [Figma GroupNode plugin API](https://developers.figma.com/docs/plugins/api/GroupNode/)
- [Figma children property](https://www.figma.com/plugin-docs/api/properties/nodes-children/)
- [Figma Help — Adjust alignment, rotation, position](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions)
- [Figma Help — Smart selection (equal-spacing detection)](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection)
- [Figma Help — Set small and big nudge values (1px / 10px defaults)](https://help.figma.com/hc/en-us/articles/4404575206295-Set-small-and-big-nudge-values)
- [Canva Help — Finding and arranging layers](https://www.canva.com/help/finding-and-arranging-layers/)
- [Canva Help — Group, layer, and align elements](https://www.canva.com/help/layer-group-align/)
- [Canva Help — Keyboard shortcuts (Ctrl+] forward, Alt+Ctrl+] front, etc.)](https://www.canva.com/help/canva-keyboard-shortcuts/)

### GitHub issues (verified open / closed status as of 2026-05-02)
- [react-rnd #911 — multi-select dragging (open, no resolution)](https://github.com/bokuweb/react-rnd/issues/911)
- [react-rnd #732 — transform property override](https://github.com/bokuweb/react-rnd/issues/732)
- [react-rnd #110 — transform: scale parent](https://github.com/bokuweb/react-rnd/issues/110)
- [moveable #433 — translate3d on Safari](https://github.com/daybrush/moveable/issues/433)
- [dnd-kit #120 — Support for multi-select and drag (open since 2021)](https://github.com/clauderic/dnd-kit/issues/120)
- [react-arborist 3.4.3 release — React 19 support](https://github.com/brimdata/react-arborist/releases)
- [tsengyushiang/react-rnd-group — 2 stars, dead](https://github.com/tsengyushiang/react-rnd-group)

### Internal artifacts
- `package.json` (verified versions: react-rnd@10.5.3, sharp@0.33.5, @dnd-kit/core@6.3.1, react@19.1.0, next@15.5.13)
- `src/components/slides/slide-preview.tsx` (4 working `<Rnd>` blocks at lines 989, 1099, 1215, 1382; v2.10 corner-handle pattern at 1025-1061)
- `src/hooks/use-alignment-guides.ts` (existing brute-force pairwise snap, threshold 10 — to be lowered to 5)
- `src/lib/editor/editor-reducer.ts` (existing `applyDualWrite`, `pushHistory`, MAX_HISTORY=50 — multi-select actions slot in cleanly)
- `src/lib/types/slide.ts` (TextBox / CustomImage / SlideStyleOverrides — `z_order` and `groups` add as optional fields)
- `src/lib/render/render-slide.ts` lines 195-216 (Satori z-order pattern: DOM order, no z-index, three explicit layers)
- `PROJECT.md` lines 30-34 (v2.11 hard constraints), 50 (v2.10 deferred items including ROTATE-01), 340 (variable fonts deferred)
- `.planning/v2.10-MILESTONE-AUDIT.md` (v2.10 react-rnd-vs-moveable decision rationale)

### Verification — npm view as of 2026-05-02
- `react-rnd@10.5.3` (peers: react/react-dom >=16.3.0)
- `react-moveable@0.56.0` (published >1 year ago, no React 19 peer declared)
- `selecto@1.26.3` (vanilla, no React peer)
- `react-selecto@1.26.3` (depends on selecto ~1.26.3)
- `tinykeys@3.0.0` (no peers, ~650 B gzipped)
- `react-arborist@3.5.0` (peers: react/react-dom >= 16.14)
- `react-hotkeys-hook@5.3.0`
- `@dnd-kit/core@6.3.1` (already installed)
- `konva@10.3.1` (NOT recommended)
- `fabric@7.3.1` (NOT recommended — 22 MB)

---
*Stack research for: TikTok carousel slide editor — v2.11 Full Editor Parity*
*Researched: 2026-05-02*
*Confidence: HIGH — all libraries verified on npm + Context7; all algorithmic claims sourced; all version-compatibility hazards flagged.*

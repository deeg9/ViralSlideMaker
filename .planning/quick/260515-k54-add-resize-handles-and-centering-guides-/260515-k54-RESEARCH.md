# Quick Task 260515-k54: Resize Handles + Centering Guides for Icons/Shapes — Research

**Researched:** 2026-05-15
**Domain:** Slide-editor canvas — element transformation (resize) + smart alignment guides
**Confidence:** HIGH (codebase seam fully traced; web patterns corroborate existing in-repo implementation)

## Summary

Icons and shapes (`Decoration[]`) currently render in an editable `<Rnd>` wrapper in `slide-preview.tsx` that supports **drag only** — `enableResizing={false}` (line 2946) and the decoration's `onDragStart`/`onDragStop` handlers **never touch the snap index** (no `buildSnapIndex` / `runSnapForDrag` calls). Text boxes and custom-images already have the full machinery: 8-handle resize on `<Rnd>` and snap-to-center smart guides wired through `runSnapForDrag` + `<SmartGuideOverlay>`.

The good news for the planner: **this is a wiring task, not a new-system task.** The data model (`DecorationBase.position = {x, y, width, height}`) already carries width/height; the reducer's `UPDATE_DECORATION` already accepts a full `position` shallow-merge with a `noHistory` live-preview channel; the snap engine (`snap-index.ts`) is pure and element-type-agnostic. The decoration `<Rnd>` block just needs the same three things the **custom-image `<Rnd>` block already has**: (1) an `enableResizing` config + `resizeHandleStyles` + `onResizeStop`, (2) `buildSnapIndex` on `onDragStart` + `runSnapForDrag` in a new `onDrag` handler, and (3) a `runSnapForDrag` final pass in `onDragStop`.

**Primary recommendation:** Clone the **custom-image `<Rnd>` block** (`slide-preview.tsx` ~2638–2790) as the template for the decoration `<Rnd>` block (~2938–3037). The custom-image element is the closest analog — it is a `{x,y,width,height}` element with full 8-handle resize, `lockAspectRatio`, snap-on-drag, and a `width/height` size-commit callback. Do NOT clone the text-box block (it has hook/body-specific font-scaling logic that does not apply to icons/shapes).

## Track A — Figma/Canva Patterns (web research)

Actionable findings only. These corroborate the patterns **already implemented in this repo** for text boxes and custom-images — so they are validation, not new design input.

### Resize handles (8-handle bounding box)
- **8 handles:** 4 corners (resize W+H) + 4 mid-side (corner=both, left/right=width, top/bottom=height). `react-rnd` exposes exactly this via the `enableResizing` object — custom-images already enable all 8. [CITED: help.figma.com/articles/1500006206242]
- **Proportional resize:** Figma corner-drag is free-aspect by default; **Shift = lock aspect ratio**; **Alt/Option = resize from center**. [CITED: help.figma.com/articles/360040451453]
- **Icons/shapes UX expectation:** for icons specifically, users expect aspect-ratio preservation to be the *default* (an icon stretched non-uniformly looks broken). Figma's default-free-aspect is a deliberate choice for general layers; for an icon/shape tool, defaulting corner-drag to proportional is the more forgiving choice. `react-rnd` supports `lockAspectRatio={true}` (custom-images use exactly this). `[ASSUMED]` — see Assumptions Log A1.
- **Handle hit area:** the visible handle should be small (~8–12px) but the hit/grab zone larger (~24px) for touch (WCAG 2.5.8 AA). The text-box corner handles already do this via a `cornerHandleHitStyle` 24×24 wrapper around a 12×12 visual; custom-images use a simpler 8×8 handle with `-4` offset. [VERIFIED: slide-preview.tsx lines 1399–1407, 2629–2666]
- **Cursors:** `nwse-resize` (TL/BR), `nesw-resize` (TR/BL), `ew-resize` (L/R), `ns-resize` (T/B). `react-rnd` sets these automatically per handle.

### Smart guides / snap-to-center
- Canva smart guides snap an element to **canvas center**, **other elements' edges**, and **other elements' centers**, drawing a colored line (Canva = purple/magenta; this repo uses `#3d0000`-family chrome) only while the element is in motion. [CITED: canva.com/help, magicslides.app]
- **Snap threshold:** neither Figma nor Canva publish exact px. This repo has already made the decision: **5 ref-px enter / 7 ref-px exit** asymmetric hysteresis (a 2px deadband that kills guide flicker). [VERIFIED: `snap-index.ts` SNAP-01/SNAP-10]. The planner should reuse these constants — no new threshold research needed.
- **Release-to-snap:** Figma/Canva commit the snapped position on pointer-up even if the live drag didn't visually snap. This repo already does this — `onDragStop` runs a final `runSnapForDrag` pass (see `slide-preview.tsx` ~1672–1685 comment block).

**Sources (Track A):**
- https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
- https://help.figma.com/hc/en-us/articles/360040451453-Scale-layers-while-maintaining-proportions
- https://www.canva.com/help/margins-bleed-crop-marks/
- https://www.magicslides.app/blog/how-to-change-snap-options-on-canva

## Track B — Codebase Seam Analysis (THE load-bearing section)

### Data-model gap: NONE — icons/shapes already carry width/height

`DecorationBase.position` is `{ x: number; y: number; width: number; height: number }` (% of canvas, 0–100) — **identical 4-tuple semantics to `CustomImage`**.
- File: `src/lib/types/decoration.ts` lines 25–27
- The decoration `<Rnd>` already computes `dwPx`/`dhPx` from `d.position.width`/`d.position.height` (`slide-preview.tsx` lines 2934–2935) and passes them as `size={{ width: dwPx, height: dhPx }}`.
- **No schema change, no migration, no Zod change needed.** The width/height fields exist and are already rendered.

### Reducer: NONE — `UPDATE_DECORATION` already accepts full `position`

`case 'UPDATE_DECORATION'` (`src/lib/editor/editor-reducer.ts` lines 425–449) does a shallow-merge `{ ...existing, ...action.updates }` over the whole decoration, and `action.updates.position` may carry any subset of `{x,y,width,height}`. It also already supports a `noHistory: true` live-preview channel. **No new reducer action (no `RESIZE_DECORATION`) is needed** — a resize commit is just `UPDATE_DECORATION` with `updates.position` carrying new width/height (+ possibly new x/y).

### The seam — three concrete gaps in ONE file

All work is in **`src/components/slides/slide-preview.tsx`**, the editable decoration `<Rnd>` block at **lines ~2938–3037**.

| # | Gap | Current state | Fix (clone from custom-image block) |
|---|-----|---------------|--------------------------------------|
| 1 | **No resize handles** | `enableResizing={false}` (line 2946) | Replace with the 8-handle object + `resizeHandleStyles` + `onResizeStop`. Custom-image block lines 2647–2666 (config + handle styles) and 2784–2791 (`onResizeStop`) are the exact template. |
| 2 | **No snap on drag** | decoration `onDragStart` (2947–2950) only sets `draggingElementId` + drag-start ref; there is **no `buildSnapIndex` call**, and there is **no `onDrag` handler at all** | Add `snapIndexRef.current = buildSnapIndex(slide, buildExcludeIds(d.id))` + reset `wasSnappedX/YRef` in `onDragStart`. Add an `onDrag` handler that calls `runSnapForDrag` (custom-image lines 2678–2713 is the exact template, incl. multi-select `computeSelectionBounds` branch). |
| 3 | **No snap on drag-stop / no overlay clear** | decoration `onDragStop` (2951–2985) commits position but never runs the final snap pass or clears the guide overlay | Add the final `runSnapForDrag` pass + `snapIndexRef.current = null` + `guideOverlayRef.current?.clear()` (custom-image lines 2714–2723). |

### Is the resize/snap code element-type-agnostic? — Mostly YES

- **`snap-index.ts` (`buildSnapIndex`, `findNearestSnap`, `snapWithHysteresis`):** pure, no React/DOM, fully type-agnostic. `buildSnapIndex` walks `text_boxes`, `custom_images`, `watermark`. **GAP:** it does **not currently walk `slide.decorations`** (lines 187–217). Other decorations won't be snap *targets* until added. This is a ~6-line addition: a `for (const d of slide.decorations ?? [])` loop calling the existing `pushElementEdges(d.id, d.position.x, d.position.y, d.position.width, d.position.height)`. Decorations already have real width/height, so unlike text boxes there is no height-0 degenerate case.
- **`runSnapForDrag` (`slide-preview.tsx` ~955–1060):** a `useCallback` that reads `snapIndexRef`, queries `snapWithHysteresis` per axis, drives `guideOverlayRef`. Type-agnostic — it takes raw `(x, y, w, h)` px. Already called by both text-box and custom-image drag. Decoration drag just needs to call it.
- **`buildExcludeIds` (`slide-preview.tsx` ~1067+):** assembles the exclude set (self + group/multi-select co-movers). Type-agnostic — keyed on ids. Already correct for decorations.
- **`<SmartGuideOverlay>` + `guideOverlayRef`:** render-only, type-agnostic. No change.
- **`enableResizing` const (line 1388):** text-box-specific (`top:false, bottom:false` because text boxes auto-fit height). **Do NOT reuse for decorations** — decorations need all 8 handles like custom-images. Define a separate decoration config or inline it.

### Minimal refactor — NOT a parallel implementation

The user's requirement ("share the SAME logic, not a parallel implementation") is satisfied because the *shared logic already exists as pure modules* (`snap-index.ts`) and a shared `useCallback` (`runSnapForDrag`). The decoration `<Rnd>` block simply isn't *calling* them. The fix wires the existing decoration block into the existing shared functions — it adds zero new snap/resize algorithms.

One genuine shared-module edit: adding the `decorations` loop to `buildSnapIndex` (so decorations become snap *targets*, and so text/image elements snap to decorations too). That is a strict improvement applied at the single source of truth — exactly the "shared, not parallel" outcome the user wants.

### Resize → font-scale: does NOT apply

The text-box `onResizeStop` (lines 1763–1799) has hook/body-specific logic — corner-drag scales `font_size` via `scaleFontSizeOnCorner`. **Icons/shapes have no font.** Decoration `onResizeStop` should mirror the **custom-image** `onResizeStop` (lines 2784–2791): commit `width`/`height` percentages + new `x`/`y`, nothing else. This is why the planner must template from the custom-image block, not the text-box block.

### Aspect-ratio for icons/shapes
- `DecorationCard` (right rail, `src/components/editor/text-rail/decoration-card.tsx`) **already has an aspect-lock** for the W/H numeric inputs — when editing W or H for `shapeKind ∈ {rect, circle, triangle, ...}` it proportionally adjusts the other axis (lines 183–203). There is an existing notion of which decorations are aspect-locked.
- `react-rnd` `lockAspectRatio` is a boolean prop. Recommended: for **icons**, set `lockAspectRatio={true}` on the `<Rnd>` (icons should never stretch); for **shapes**, either always-locked, or locked unless Shift is held (Figma muscle memory is Shift=lock, but for shapes a stretchable rect is legitimate). This is a small UX decision for the planner — see Assumptions Log A1.

### Dispatch path (already wired, extend it)
- `slide-editor.tsx` line 1587: `onDecorationPositionChange` → `dispatch({ type: 'UPDATE_DECORATION', ... updates: { position: {...x,y} } })`. For resize, either (a) extend this callback to also accept width/height, or (b) add a sibling `onDecorationSizeChange` callback mirroring `onCustomImageSizeChange`. Option (b) matches the existing custom-image symmetry (`onCustomImagePositionChange` + `onCustomImageSizeChange` are separate props). The chain to extend: `slide-preview.tsx` prop → `slide-canvas.tsx` (forwards `onDecorationPositionChange` at line 203 — add sibling) → `slide-editor.tsx` (dispatch).

## Files & Line References (planner hand-off)

| Concern | File | Lines |
|---------|------|-------|
| Decoration data model (width/height exist) | `src/lib/types/decoration.ts` | 25–27 (`DecorationBase.position`) |
| Editable decoration `<Rnd>` block (THE edit site) | `src/components/slides/slide-preview.tsx` | ~2938–3037 |
| `enableResizing={false}` to flip | `src/components/slides/slide-preview.tsx` | 2946 |
| Decoration `onDragStart` / `onDragStop` (need snap wiring) | `src/components/slides/slide-preview.tsx` | 2947–2985 |
| **Template to clone — custom-image `<Rnd>` block** | `src/components/slides/slide-preview.tsx` | ~2638–2877 (resize config 2647–2666; onDrag snap 2678–2713; onDragStop snap 2714–2723; onResizeStop 2784–2791) |
| Shared snap engine (pure) | `src/lib/editor/transforms/snap-index.ts` | whole file; `buildSnapIndex` 149–224 (add decorations loop ~217) |
| `runSnapForDrag` shared callback | `src/components/slides/slide-preview.tsx` | ~955–1060 |
| `buildExcludeIds` | `src/components/slides/slide-preview.tsx` | ~1067+ |
| Smart guide overlay (render-only, no change) | `src/components/editor/smart-guide-overlay.tsx` | whole file |
| Reducer `UPDATE_DECORATION` (accepts full `position`, no change) | `src/lib/editor/editor-reducer.ts` | 425–449 |
| Dispatch wiring (extend for size) | `src/components/editor/slide-editor.tsx` | 1587–1600 |
| Prop forwarding (extend for size) | `src/components/editor/slide-canvas.tsx` | 95–96, 136, 203 |
| DecorationCard aspect-lock precedent | `src/components/editor/text-rail/decoration-card.tsx` | 183–203 |
| Deprecated — do NOT use | `src/hooks/use-alignment-guides.ts` | retired Phase 63 |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Resize handles + hit-testing + cursors | Custom corner/edge DOM + drag math | `react-rnd` `enableResizing` object — already a dependency, already used by text-boxes + custom-images |
| Snap detection / center alignment | New snap algorithm | `buildSnapIndex` + `runSnapForDrag` — already pure + shared |
| Guide line rendering | New overlay component | `<SmartGuideOverlay>` + `guideOverlayRef` — already mounted |
| Resize commit action | New `RESIZE_DECORATION` reducer case | `UPDATE_DECORATION` with `updates.position` — already exists |

**Key insight:** Every piece already exists. The single decoration `<Rnd>` block is the only thing not plugged in. Re-implementing any of the above would create exactly the "parallel implementation" the user explicitly rejected.

## Common Pitfalls

1. **Rotation transform vs Rnd translate.** The decoration block puts `rotate()` on an inner `decoration-visual-wrap` div, NOT the `<Rnd>` outer node, because Rnd owns `transform: translate()` (see comment at lines 3004–3011). When adding resize, keep rotation on the inner wrapper; let `<Rnd>` own outer transform untouched.
2. **Cloning the wrong block.** Text-box `onResizeStop` does font-scaling — icons/shapes have no font. Clone the **custom-image** block.
3. **`onResizeStop` only, never `onResize` per-tick.** Carry-forward constraint (v2.10 PERF-01 / KBD-09): dispatch the `UPDATE_DECORATION` commit once on `onResizeStop` so undo records exactly one step per gesture. Live snap *guides* during drag are fine (overlay is ref-driven, no dispatch).
4. **Decorations not yet snap targets.** `buildSnapIndex` doesn't iterate `slide.decorations` — without the ~6-line addition, a dragged decoration snaps to canvas-center + text/images but two decorations won't snap to each other.
5. **TPLREND-05 parity.** Resize handles are editor chrome — they already only render in the `editable={true}` branch. The Satori PNG path (`render-slide-satori.tsx`) and non-editable preview must stay byte-identical. No renderer file should be touched. (Carry-forward PARITY invariant.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Icons should default corner-resize to aspect-locked (`lockAspectRatio={true}`); shapes either always-locked or Shift-to-lock. Figma defaults to free-aspect, but a stretched icon looks broken. | Track A / Aspect-ratio | LOW — purely a UX default; if wrong, flip a boolean. Planner should confirm with user: "icons aspect-locked by default?" |

## Open Questions

1. **Aspect-lock default for shapes** — locked always, or free with Shift-to-lock? Recommendation: icons always-locked; shapes free-resize (a rect/line legitimately stretches) with Shift = lock, matching Figma muscle memory. Low-stakes; planner can pick or ask.
2. **Resize handle visual** — match the text-box 12×12-in-24×24 WCAG hit zone, or the simpler custom-image 8×8? Recommendation: use the custom-image 8×8 style for consistency with the other `{x,y,w,h}` element; revisit touch QA later (carry-forward A11Y-01 touch QA is already pending).

## RESEARCH COMPLETE

**File:** `.planning/quick/260515-k54-add-resize-handles-and-centering-guides-/260515-k54-RESEARCH.md`

**Confidence:** HIGH — codebase seam fully traced; the entire feature is wiring an existing decoration `<Rnd>` block into existing shared, type-agnostic snap/resize machinery. Zero new algorithms, zero schema/reducer changes.

**Key findings:**
- Icons/shapes ALREADY carry `position: {x,y,width,height}` — no data-model gap, no migration.
- Reducer `UPDATE_DECORATION` already shallow-merges a full `position` — no new action needed.
- The only edit site is the decoration `<Rnd>` block in `slide-preview.tsx` (~2938–3037), plus a ~6-line addition to `buildSnapIndex` so decorations become snap targets.
- The custom-image `<Rnd>` block (~2638–2877) is the exact template to clone — same `{x,y,w,h}` semantics, full 8-handle resize, snap-on-drag already wired.
- Do NOT clone the text-box block (hook/body font-scaling logic does not apply to icons/shapes).

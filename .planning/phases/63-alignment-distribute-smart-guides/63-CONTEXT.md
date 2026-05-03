# Phase 63: Alignment / Distribute + Smart Guides — Context

**Gathered:** 2026-05-02
**Mode:** Auto-generated (autonomous --auto)

<domain>
## Phase Boundary

Largest phase of v2.11 — 24 reqs split into **Wave A (alignment) + Wave B (smart guides)**. Both waves ship together because the sorted-edge-array snap index built for smart guides is also consumed by alignment's bounding-box math.

### Wave A — Alignment / Distribute / Floating Toolbar (10 reqs)

ALIGN-01..10:
- 6-axis alignment (Alt+A/H/D for left/center-h/right; Alt+W/V/S for top/center-v/bottom) — ALIGN-01, ALIGN-02
- N=1 → align to canvas (1080×1920); N≥2 → align to selection bounds — ALIGN-03
- Distribute horizontal/vertical (Cmd+Alt+H/V), gap-based equal spacing — ALIGN-04, ALIGN-05
- Distribute disabled when N<3 (greyed button + tooltip) — ALIGN-06
- Floating Figma-style toolbar above multi-selection bounds — ALIGN-07
- Single pushHistory per gesture (one undo step) — ALIGN-08
- Integer-rounded positions on dispatch (prevents floating-point creep) — ALIGN-09
- Locked elements participate in selection BOUNDS but DO NOT MOVE — ALIGN-10

### Wave B — Smart Guides / Snap Index / Equal-Spacing (14 reqs)

SNAP-01..10 + DIFF-03 + PERF-03 + PERF-05 + PARITY-03:
- 5px snap threshold (lowered from current 10) — SNAP-01
- Snap to other elements' edges + canvas edges + center — SNAP-02, SNAP-03
- Equal-spacing "==" Figma pink double-equals when 3+ elements form equal gaps — SNAP-04, DIFF-03
- Hold Cmd disables snap; modifier resets on blur — SNAP-05
- Smart guide overlay inside scaled canvas; coordinates correct at every zoom — SNAP-06
- Persistent guide DOM nodes; positions update via `transform: translate3d` refs (no React reconciliation per pointer-move) — SNAP-07, PERF-03
- Sorted edge arrays at onDragStart; binary search at onDrag; <2ms per pointer-move at N=30 — SNAP-08, PERF-05
- Multi-element drag uses union-bbox edges as snap candidates — SNAP-09
- Asymmetric hysteresis (enter ≤5, exit >7) prevents flicker — SNAP-10
- PARITY-03: parity test with multi-element fixtures (selection ring, group bbox, marquee active, smart guides active)

**Out of scope for Phase 63:**
- Lock element behavior (Phase 64; ALIGN-10 uses placeholder `locked` field declared in Plan 60-01)
- Z-order operations (Phase 64)
- Layers panel (Phase 65)
- Alt-drag duplicate (Phase 66)
- Rotation alignment (deferred indefinitely per v2.10 ROTATE-01)
</domain>

<decisions>
## Locked Decisions

### Wave A: Alignment functions
- Pure module `src/lib/editor/transforms/align.ts`:
  - `alignElements(elements, axis: 'left'|'center-h'|'right'|'top'|'center-v'|'bottom', target: 'canvas'|'selection'): elements[]`
  - `distributeElements(elements, axis: 'horizontal'|'vertical'): elements[]`
- N=1 → target='canvas' (Figma model); N≥2 → target='selection'; no UI toggle in v2.11 (research recommendation)
- Distribute requires N≥3 (GIMP semantic; matches Figma)
- Locked elements: include in bounds (`Math.min`/`Math.max`), exclude from move (filter before update)
- Watermark: skip both bounds and move (Plan 60-05 deferred-items.md known gap; Phase 63 picks up the bounds half — watermark counts in selection bounds for alignment, but doesn't move; this is the correct Figma behavior)
- Integer-rounded on dispatch (Math.round on every position update)
- Single dispatch action `ALIGN { slideIndex, ids[], axis, target }` and `DISTRIBUTE { slideIndex, ids[], axis }` — both go through pushHistory once

### Wave A: Floating toolbar
- New component `src/components/editor/floating-alignment-toolbar.tsx`
- Renders ABOVE multi-selection bounds (Figma pattern; positioned via union AABB)
- Mounts inside slide-preview.tsx editable={true} branch; `pointer-events: auto` on the toolbar itself
- Buttons: 6 alignment icons + 2 distribute icons + lock toggle (Phase 64 wires; placeholder visible in 63 if reasonable)
- Distribute buttons disabled when N<3 with tooltip
- Hides when N≤1
- Editor-only — TPLREND-05 gated structurally

### Wave B: Snap index data structure
- Pure module `src/lib/editor/transforms/snap-index.ts`:
  - `buildSnapIndex(elements, canvasW=1080, canvasH=1920) → { xEdges: number[], yEdges: number[] }`
  - Sorted arrays of edge positions (left, center-h, right per element + 0/540/1080 canvas; top, center-v, bottom + 0/960/1920)
  - `findNearestSnap(value, sortedEdges, threshold=5): { snappedTo: number | null, delta: number }`
  - Binary search via lower_bound; O(log N) per query
- Built once at onDragStart from `slide.text_boxes`+`custom_images` (excluding currently-dragging element); reused per onDrag tick
- Hysteresis state: `wasSnapped: { x: number | null, y: number | null }`. Enter snap when delta ≤ 5; exit when delta > 7.

### Wave B: Smart guide rendering
- New component `src/components/editor/smart-guide-overlay.tsx`
- Renders 0-N persistent `<div>` lines (vertical/horizontal) absolute-positioned with `pointer-events: none`
- Updates position via direct `ref.style.transform = 'translate3d(...)' ` in RAF callback (NOT React state — PERF-03)
- Mounted inside scaled canvas container so coordinates align (PITFALL-5.3)
- Editor-only — TPLREND-05 gated
- Equal-spacing "==" indicator: pink double-equals between 3+ elements when gaps are equal (Figma signature)

### Wave B: Hold-Cmd disable snap
- During drag: read `useModifierState().get().cmd` (or `meta` on Mac)
- If true: skip snap math entirely; guide overlay hides
- modifier-blur reset already wired (Plan 60-04 useModifierState)

### Wave B: Multi-element drag union-bbox
- When N≥2 selected and dragged together (BULK_TRANSLATE pattern), the "dragging" element edges are the UNION AABB
- Reuses computeSelectionBounds from Plan 60-05 (extending it to include locked + watermark for bounds purposes — change is already partial per Plan 60-05's documented gap; Phase 63 should make this complete)

### Wave A: Wiring
- New keyboard bindings via tinykeys (Plan 60-04 map):
  - Alt+A → align left
  - Alt+H → align center-h
  - Alt+D → align right
  - Alt+W → align top
  - Alt+V → align center-v
  - Alt+S → align bottom
  - Cmd+Alt+H → distribute horizontal
  - Cmd+Alt+V → distribute vertical
- All respect isEditingTarget guard
- All preventDefault (browser may have conflicts — Cmd+Alt+H is Chrome history; Cmd+Alt+V is Chrome view source)

### TPLREND-05 invariant
- Floating toolbar editor-only ✓
- Smart guide overlay editor-only ✓
- Equal-spacing "==" indicator editor-only ✓
- Alignment / distribute mutate absolute positions in schema (production-relevant) — both renderers consume identical schema, byte-identical output
- PARITY-03 extends parity.test.tsx with: alignment toolbar absent in editable=false, smart guide overlay absent in editable=false

### Decomposition target
4-5 plans:
- Plan 63-01 (Wave A core): align/distribute pure functions + reducer actions + tests (data layer)
- Plan 63-02 (Wave A wiring): floating toolbar component + keyboard bindings + canvas integration (UI)
- Plan 63-03 (Wave B core): snap index + smart guides (snap math)
- Plan 63-04 (Wave B integration): drag handler integration + hysteresis + multi-element + Hold-Cmd disable + equal-spacing
- Plan 63-05 (Polish): parity test extensions + perf budget verification + locked-elements-participate-in-bounds completion

</decisions>

<canonical_refs>
- `.planning/REQUIREMENTS.md` — Phase 63: ALIGN-01..10, SNAP-01..10, DIFF-03, PERF-03, PERF-05, PARITY-03
- `.planning/research/PITFALLS.md` — Categories 4 (alignment), 5 (smart guides)
- `.planning/research/ARCHITECTURE.md` — sections 3 (alignment pure functions), 4 (smart guide perf budget)
- `.planning/research/FEATURES.md` — B10..B16 (alignment/distribute), C17..C23 (smart guides + equal spacing)
- `src/lib/editor/transforms/selection-bounds.ts` — Plan 60-05 union AABB, extend for alignment math
- `src/lib/editor/use-modifier-state.ts` — Plan 60-04 ref-based shift/cmd reads
- `src/lib/editor/use-selection-model.ts` — Plan 60-03 + Plan 62-01 enterGroup/exitGroup
- `src/components/slides/slide-preview.tsx` — Plan 60-05 + Plan 61-02 + Plan 62-02 click/drag/marquee/group infra
- `src/hooks/use-alignment-guides.ts` — pre-existing single-element snap (legacy; Phase 63 replaces with snap-index pure helper)
</canonical_refs>

<phase_dependencies>
- **Depends on:** Phase 60 (selection model + BULK_TRANSLATE + tinykeys + selection-bounds), Phase 62 (groups treated as units)
- **Unblocks:** Phase 64 (lock semantics complete the ALIGN-10 bounds-include-but-skip-move story), Phase 65 (layers panel + parity audit)
</phase_dependencies>

<success_criteria_recap>
1. 6-axis alignment (Alt+A/H/D/W/V/S) + 2-axis distribute (Cmd+Alt+H/V); N=1→canvas, N≥2→selection bounds; locked-included-in-bounds-not-moved; integer-rounded; single pushHistory
2. Cmd+Alt+H/V distribute disabled at N<3 with tooltip; gap-based equal spacing
3. Smart guides: 5px snap threshold; canvas edges + element edges + equal-spacing == pattern; asymmetric hysteresis ≤5/>7
4. Smart guide overlay editor-only (`editable={true}` gated); positions updated via translate3d ref (no React reconciliation per pointer-move); <2ms perf budget at N=30
5. Hold-Cmd disables snap; modifier resets on blur; floating Figma-style toolbar above selection bounds; PARITY-03 fixtures pass
</success_criteria_recap>

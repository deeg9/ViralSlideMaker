# Phase 61: Marquee Selection — Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous --auto; gray areas resolved via REQUIREMENTS.md + research)

<domain>
## Phase Boundary

Drag-to-select via rubber-band marquee on canvas whitespace, using `selecto@1.26.3` for hit-testing and pointer-event handling.

**Concrete deliverables:**
1. **Marquee overlay** — `<MarqueeOverlay>` component renders the dragging rectangle when pointer-down on canvas root + drag. Local component state — never enters reducer history.
2. **selecto integration** — `selecto@1.26.3` installed; configured for intersect mode (Figma default; not contains-mode); `setScale(x, y)` wired to canvas's existing `transform: scale(0.4)` wrapper.
3. **Pointer-event seam** — Pointer-down on canvas root WHERE `e.target === e.currentTarget` triggers marquee start. Existing click-empty-canvas-clears (Plan 60-05) becomes the no-drag branch.
4. **Rect normalization** — All 4 drag directions normalize correctly (top-left → bottom-right, bottom-right → top-left, top-right → bottom-left, bottom-left → top-right). `normalizeRect(x0, y0, x1, y1) → { x, y, w, h }` pure helper.
5. **Shift-additive** — Holding Shift during marquee adds the marqueed elements to existing selection (vs. replacing). Reads `useModifierState().get().shift` (Plan 60-04 hook).
6. **Final dispatch** — On pointer-up, compute element-vs-rect intersections; dispatch `selection.replaceWith([...marqueeIds])` OR `selection.addToSelection([...marqueeIds])` based on Shift state.
7. **Axis-constrain on drag** — `KBD-07`: holding Shift during element drag (NOT marquee) constrains motion to dominant axis. This is wired in drag handlers (`onDrag`) — read `e.shiftKey`.

**REQ-IDs covered:** SEL-05, SEL-06, SEL-14, KBD-07.

**Out of scope:**
- Group selection behavior (Phase 62)
- Locked elements pass-through (deferred wiring lands in Phase 64; for Phase 61 we ignore locked state)
- Custom Cmd-modifier behavior on marquee (e.g. Figma's hold-Cmd-for-contain-mode) — defer if not required by reqs

</domain>

<decisions>
## Implementation Decisions (locked)

### selecto integration
- Vanilla `selecto@1.26.3` (NOT `react-selecto` — saves ~30 lines of wrapper). Per STACK.md.
- Mount on canvas-root pointerdown.
- Configure: `selectByClick: false` (we have own click handlers from Plan 60-05), `selectFromInside: false` (Figma intersect default), `hitRate: 0` (any overlap counts).
- `setScale(x, y)` — wire scale-aware via existing canvas `transform: scale(...)` wrapper. Day-1 verification flagged in research; if `setScale` has issues, fallback to manual coordinate transform in onSelect callback.

### Rect normalization
- New pure helper `src/lib/editor/transforms/normalize-rect.ts`:
  ```ts
  export function normalizeRect(x0: number, y0: number, x1: number, y1: number): { x: number; y: number; w: number; h: number } {
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }
  }
  ```
- Unit tests cover all 4 drag directions (top-left → bottom-right, etc.)

### Element-vs-rect intersection (intersect mode)
- New pure helper `src/lib/editor/transforms/element-rect-intersect.ts`:
  ```ts
  export function elementsInRect(slide: Slide, rect: { x, y, w, h }): string[] {
    // Returns ids of elements whose AABB intersects rect.
    // Skip watermark (Phase 60 deferred-items.md known gap).
    // Skip locked elements only after Phase 64 ships behavior; in Phase 61 include them.
  }
  ```
- Walks `text_boxes`, `custom_images`. Watermark/structural-anchor skipped (matches Plan 60-05 selection-bounds.ts conservative scope).

### Shift-additive marquee
- On marquee end: `shiftHeld = useModifierState().get().shift`
- `shiftHeld` → `selection.addToSelection(marqueeIds)`
- `!shiftHeld` → `selection.replaceWith(marqueeIds)` (marquee REPLACES selection by default in Figma)
- Edge case: empty marquee (no elements intersected) — DO NOT clear existing selection if Shift held; clear if not held (matches Figma).

### Marquee overlay rendering
- New component `src/components/editor/marquee-overlay.tsx` — single `<div>` absolute-positioned with `pointer-events: none` so it doesn't block clicks
- Visual: dashed cyan/blue border (~1px), translucent fill (~rgba(0, 100, 255, 0.1))
- Renders ONLY when `editable={true}` (TPLREND-05; PARITY-01 with teeth — extend parity test fixture)
- Mounted inside the scaled canvas container so coordinates align (PITFALL-5.3 carry-forward)

### KBD-07 axis-constrain during element drag
- In `slide-preview.tsx` element drag handler (existing react-rnd `onDrag` callback): read `e.shiftKey`. If true, lock to dominant axis (`Math.abs(deltaX) > Math.abs(deltaY) ? deltaY=0 : deltaX=0`).
- This is editor-only constraint; modifies the position passed back to react-rnd.
- Apply uniformly to TextBox + CustomImage drag handlers.

### TPLREND-05 invariant
- Marquee overlay structurally inside `editable={true}` branch in slide-preview.tsx (matches selection ring pattern from Plan 60-05).
- Extend parity.test.tsx with: marquee active during editable=true → rect rendered; editable=false → zero `*marquee*` testids.

### Pointer-event flow
- pointerdown on canvas root + `e.target === e.currentTarget` → start marquee (NOT click-clear).
- pointermove → update marquee rect; throttle to RAF (perf).
- pointerup → finalize: compute intersections, dispatch selection update.
- pointerdown on a child element → existing click-to-select handler (no marquee).
- ESC during marquee → cancel marquee (no selection change).

</decisions>

<code_context>
## Existing Code Insights

**Canvas root pointer-event seam:**
- `src/components/slides/slide-preview.tsx` — Plan 60-05 added `onClick` for click-empty-canvas-clears (line ~1735+). Phase 61 swaps to `onPointerDown` and adds the start-marquee branch. Click-clear becomes the "pointer-up without drag" path.

**useModifierState hook:**
- `src/lib/editor/use-modifier-state.ts` — Plan 60-04 ships this. Returns ref-based `get()` so Phase 61 marquee handler reads modifier state without re-rendering.

**Canvas scale wrapper:**
- The slide canvas is rendered at native 1080×1920 reference resolution and CSS-scaled to fit viewport. `selecto.setScale(x, y)` accounts for this. Day-1 verification: drag a marquee at 0.4× scale, confirm coordinates match.

**Selection model integration:**
- `src/lib/editor/use-selection-model.ts` — Plan 60-03 ships `replaceWith` + `addToSelection`. Phase 61 marquee handler is a thin wrapper.

**Selection ring extension:**
- Plan 60-05's union AABB ring (`data-testid="multi-selection-ring"`) re-renders automatically when marquee finalizes (selection state updates → AABB recomputes).

**TPLREND-05 parity test:**
- `src/lib/render/__tests__/parity.test.tsx` — extended in Plan 60-05 with PARITY-01 ring scan. Phase 61 extends with marquee scan.

</code_context>

<specifics>
## Specific Ideas

- **Intersect-vs-contain default:** Figma intersect (default; any element AABB-overlapping marquee). Confirmed in REQUIREMENTS SEL-05.
- **Performance:** v2.11 element count per slide ≤30. Marquee intersect math at pointer-move is O(N) per frame; trivially under budget.
- **selecto config minimum:**
  ```ts
  new Selecto({
    container: canvasRoot,
    selectableTargets: ['.element-marker'], // tagged on each element wrapper
    selectByClick: false,
    selectFromInside: false,
    hitRate: 0,
    toggleContinueSelect: ['shift'],
  })
  ```

</specifics>

<deferred>
## Deferred Ideas

- **Cmd-held contain mode** — Figma allows Cmd to switch from intersect to contain mid-drag. Not in REQUIREMENTS; defer.
- **Marquee on locked elements** — Phase 64 lands locked semantics; for Phase 61 marquee includes locked elements (no UX consequence yet).
- **Right-click marquee menu** — Phase 62/64 may add right-click menu on selection.

</deferred>

<canonical_refs>
- `.planning/REQUIREMENTS.md` — Phase 61 reqs: SEL-05, SEL-06, SEL-14, KBD-07
- `.planning/research/STACK.md` — selecto@1.26.3 verified version + config
- `.planning/research/PITFALLS.md` — Category 2 (marquee pitfalls): pointer-events, locked-elements, rect-normalization, touchstart-vs-pointerdown, child propagation
- `.planning/research/ARCHITECTURE.md` — section 5 (marquee local state, never reducer)
- `.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-REVIEW-FIX.md` — Plan 60 fixes that affect Phase 61 (HIGH-2 migrateLegacySlides immutability; HIGH-1 BULK_DELETE pattern Phase 61 may follow for marquee-clear)
- `src/lib/editor/use-selection-model.ts` — Plan 60-03 selection API
- `src/lib/editor/use-modifier-state.ts` — Plan 60-04 ref-based modifier reads
- `src/lib/editor/keyboard-utils.ts` — Plan 60-04 isEditingTarget guard
- `src/components/slides/slide-preview.tsx` — Plan 60-05 click-empty-canvas seam + selection ring (line 1735+)
- `src/lib/render/__tests__/parity.test.tsx` — Plan 60-02/05 PARITY-01 with teeth
</canonical_refs>

<phase_dependencies>
- **Depends on:** Phase 60 (selection model + click-empty-canvas seam + useModifierState + isEditingTarget guard)
- **Unblocks:** Phase 62 (group ops can be triggered from marquee-produced N≥2 selections)
</phase_dependencies>

<success_criteria_recap>
1. User can press-and-drag on empty canvas area to draw a marquee rectangle; release dispatches `replaceWith` (or `addToSelection` if Shift held) with the elements that intersect (Figma's intersect mode)
2. Marquee rectangle normalizes correctly for all 4 drag directions — no negative-dimension bugs
3. Holding Shift during marquee adds the marqueed elements to existing selection rather than replacing it; `selecto`'s `setScale` wired correctly so marquee coordinates account for canvas's scaled wrapper
4. Marquee overlay renders only when `editable={true}` — Satori PNG export tree contains zero marquee DOM nodes (verified via parity.test.tsx); holding Shift during element drag constrains motion to dominant axis
</success_criteria_recap>

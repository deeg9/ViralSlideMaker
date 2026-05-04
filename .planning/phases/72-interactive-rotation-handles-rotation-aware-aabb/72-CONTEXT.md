# Phase 72: Interactive Rotation Handles + Rotation-Aware AABB - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning
**Mode:** Auto-generated (smart-discuss; phase has UI hint = yes; final v2.12 phase — closes ROTATE-01..04 deferred from v2.10)

<domain>
## Phase Boundary

Power users can drag-rotate decorations via Figma/Canva-style handle (16px circle ~20px above selected element). New `BULK_ROTATE` reducer action with single pushHistory entry per gesture. `selection-bounds.ts` extended to compute rotation-aware corners via cos/sin transform. Alignment + smart guides + marquee intersect honor rotated bounds. Numeric rotation input in DecorationCard (–180° to 180°). 45°-rotated arrow shape renders byte-identical across renderers (PTF15).

**Requirements (7):** ROTATE-01..04, EDITOR-07, CARD-06, PARITY-08

**Out of scope:** Rotation handles for text_boxes / custom_images (defer; this phase is decoration-only); rotation snap (15° increments — could be Phase 73 if user demand emerges)

</domain>

<decisions>
## Implementation Decisions

### rotation field (ROTATE-01)
- Already shipped in Phase 67 DecorationBase schema (rotation?: number, default 0, range -180..180)
- This phase adds the interactive surface + AABB-aware bounds

### Rotation handle (ROTATE-02)
- 16px circular handle rendered ~20px above element bounds (Figma/Canva pattern)
- Rendered in slide-preview.tsx editable={true} path only (chrome gated)
- Visible on selected decoration; mounted as overlay above the rendered decoration `<div>`
- Cursor: `grab` on hover; `grabbing` during drag

### Drag-to-rotate dispatch (ROTATE-03)
- New reducer action: `BULK_ROTATE` with payload `{ ids[], rotation: number }`
- Reducer routes per-scope (text_boxes / custom_images / decorations / watermark) — for v2.12 ONLY decorations participate (text_boxes / custom_images / watermark rotation deferred)
- BULK_ROTATE applied to ids → updates rotation field on each addressed decoration
- Drag gesture:
  - onPointerDown: capture starting angle from element center → cursor
  - onPointerMove: compute delta angle, apply CSS transform locally (no dispatch per-tick — PERF carry-forward)
  - onPointerUp: dispatch BULK_ROTATE once with final rotation; single pushHistory entry per gesture
- Gestures preserved: Shift+drag = snap to 15° increments (recommended; standard pattern)

### Rotation-aware AABB (ROTATE-04, EDITOR-07)
- Extend `selection-bounds.ts`:
  - For each rotated decoration, compute 4 corners via cos/sin transform around element center
  - True AABB = bounding box of the 4 rotated corners (max - min in x and y)
  - Multi-selection bounds = union of all rotated AABBs
- Extend `align.ts`: alignment math uses rotation-aware AABB for rotated decorations
- Extend `element-rect-intersect.ts`: marquee intersect uses rotation-aware AABB
- Smart guides (Phase 63 pattern): snap to rotated edges via rotation-aware AABB
- Locked rotated decorations participate in selection bounds but don't move (mirror v2.11 LOCK-04)
- Test fixtures: 0° / 45° / 90° / 30° / -45° rotation cases for selection-bounds + alignment + marquee

### Numeric rotation input in DecorationCard (CARD-06)
- Add numeric input to DecorationCard (Phase 70-04)
- Range: -180 to 180 degrees (integer; or 1-decimal precision)
- Round-trip with drag handle: editing input updates canvas instantly; dragging handle updates input value
- Commit on blur/Enter (single pushHistory)
- Enter triggers immediate dispatch

### PTF15 — 45° rotated arrow byte-identical (PARITY-08)
- New test fixture: arrow shape with rotation=45
- Pipe through both renderers; assert byte-identical fingerprint via string equality
- Snapshots committed
- Edge case: ensure CSS `transform: rotate()` produces identical output in Satori PNG and React preview

### Click-to-select (carry-forward)
- Click on decoration with rotation handle visible → handle gets click priority over decoration body (handle's onPointerDown blocks bubble)
- Esc cancels active rotation drag (revert to start angle)

### Claude's Discretion
- Exact handle position offset (recommend ~20px above; Figma uses 28px)
- Whether to support keyboard-only rotation (e.g. Cmd+R toggles 90°) — recommend skip; rotation handle + numeric input is sufficient
- Snap behavior: Shift = 15° increments (recommend); Alt = freeform
- Cursor style during drag (grab/grabbing standard)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/types/decoration.ts` — Phase 67 — rotation? already on DecorationBase
- `src/lib/render/decoration-renderer.tsx` — Phase 69 — applies CSS `transform: rotate(${rotation}deg)`
- `src/lib/editor/editor-reducer.ts` — Phase 68 — BULK_TRANSLATE pattern; BULK_ROTATE mirrors structure
- `src/lib/editor/transforms/selection-bounds.ts` — Phase 68 — rectilinear AABB; this phase adds rotation-aware compute
- `src/lib/editor/transforms/align.ts` — Phase 68 — alignment uses selection-bounds
- `src/lib/editor/transforms/element-rect-intersect.ts` — Phase 68 — marquee uses element rects
- `src/components/editor/text-rail/decoration-card.tsx` — Phase 70-04 — extend with numeric rotation input (CARD-06)
- `src/components/slides/slide-preview.tsx` — editable={true} path; rotation handle overlay mounts here
- `parity-fingerprint-fixtures.ts` — Phase 69-03 + 71-03 — extend with rotated fixtures

### Established Patterns
- **Single dispatch per gesture** (KBD-09 / PERF-01): onPointerUp dispatches BULK_ROTATE once; per-tick uses local CSS transform only
- **editable={true} chrome gate**: rotation handle renders only when editable; never bleeds to Satori path
- **Rotation-aware AABB via cos/sin**: standard 2D rotation transform
  ```
  cx, cy = element center
  for each corner (x, y):
    nx = cx + (x - cx) * cos(θ) - (y - cy) * sin(θ)
    ny = cy + (x - cx) * sin(θ) + (y - cy) * cos(θ)
  AABB = (min/max nx, min/max ny)
  ```
- **15° snap with Shift**: standard Figma/Canva pattern
- **Numeric input round-trip with drag**: DecorationCard mirrors react-rnd numeric pattern from v2.10

### Integration Points
- `src/lib/editor/editor-reducer.ts` (NEW BULK_ROTATE action; routes per-scope)
- `src/lib/editor/transforms/selection-bounds.ts` (rotation-aware AABB function)
- `src/lib/editor/transforms/align.ts` (rotation-aware bounds in alignment math)
- `src/lib/editor/transforms/element-rect-intersect.ts` (rotation-aware marquee intersect)
- `src/components/slides/slide-preview.tsx` (rotation handle overlay; pointer-event handling)
- `src/components/editor/text-rail/decoration-card.tsx` (numeric rotation input — CARD-06)
- New tests: BULK_ROTATE reducer; selection-bounds rotation-aware; alignment with rotated; marquee with rotated; PTF15 fingerprint

</code_context>

<specifics>
## Specific Ideas

- **Mirror v2.11 Phase 60-03 BULK_TRANSLATE** — same payload structure (ids + delta); just different transform field
- **Mirror v2.10 Phase 59 corner-resize** — react-rnd numeric round-trip pattern for the DecorationCard numeric input
- **Mirror v2.11 Phase 63 smart guides** — alignment math now consumes rotation-aware bounds
- **PTF15 single fixture** — 45°-rotated arrow shape; ~5 tests (1 fingerprint snapshot + 4 equiv assertions)

</specifics>

<deferred>
## Deferred Ideas

- Rotation handles for text_boxes / custom_images / watermark — defer; this phase is decoration-only
- 15° snap toggle (Shift+drag) — recommended in plan but if too much scope, defer to v2.13
- Keyboard rotation shortcut (Cmd+R toggles 90°) — defer
- Multi-select rotation (rotate group around centroid) — defer; this phase rotates each decoration around its own center

</deferred>

# Phase 45: Renderer Composition - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch table)

<domain>
## Phase Boundary

Wire the Phase 44 template schema (overlay zones, `backgroundMode`, per-segment highlight pills) into both render paths so a single template config drives the live React preview AND the Satori PNG export with **no preview/export drift**. The Murphy reference visual must be reproducible end-to-end once Phase 46 authors `magazine-bold` against this surface.

What is in scope:
- Satori renderer (`src/lib/render/render-slide-satori.tsx`) composes `template.overlays` (chip, counter, mid pill, bottom card) on top of the base layout, respecting position, padding, and DOM order.
- `backgroundMode === 'image-bleed'` and `'image-with-bottom-card'` paint a full-bleed photo with the appropriate overlay/card composition.
- Page-counter overlay component renders dynamically from slide index.
- Per-word highlight pills render as inline `<span>` chips in both Satori AND React preview using the same markup.
- React preview component (`src/components/slides/slide-preview.tsx`) matches Satori output for overlay zones, page counter, and highlight pills.
- New shared resolver `resolveOverlayContent(content, ctx)` to guarantee parity.
- Tests proving no drift.

What is NOT in scope:
- New template definitions (`magazine-bold`, `tr3nding-news`, `documentary`) — Phase 46.
- AI prompt tuning for compact layouts — Phase 47.
- Template thumbnails / picker UI changes — Phase 48.
- Schema changes — locked in Phase 44; this phase consumes them.
- Pixel-diff visual regression infrastructure — out of scope; snapshot + DOM tests only.

</domain>

<decisions>
## Implementation Decisions

### Slot Layout & Pixel Anchors (Area 1)
- Each named slot has a fixed pixel anchor in a `SLOT_GEOMETRY` constant shared between Satori and React preview:
  - `top-left`: `(60, 60)` inset from top-left corner.
  - `top-right`: `(W - 60, 60)` inset from top-right corner.
  - `mid`: horizontally centered, `y ≈ 55%` of canvas height.
  - `bottom-card`: spans full width × `~38%` height, anchored at bottom (Murphy reference matches).
  - `free`: no auto-positioning — overlay's own `offset.{x,y}` becomes absolute pixel coordinates.
- When `backgroundMode === 'image-with-bottom-card'`, hook/body text falls back to a card-aware preset (left-aligned, padding 80px, bottom-anchored INSIDE the card). User-supplied `style_overrides.text_position`, `hook_position`, `body_position` still win.
- DOM order (Satori has no z-index) for image modes:
  1. Background photo (full-bleed cover)
  2. Tint overlay (`template.overlayColor` × `overlayOpacity`) — kept for tonal control
  3. Bottom card (when `image-with-bottom-card`)
  4. Overlays (chip, counter, mid pill) — above tint, BELOW main hook so headline pills stay top-most
  5. Hook text (with mint pills as inline spans)
  6. Body text
  7. `custom_images`
  8. Brand watermark
  9. Forced free-tier watermark
- Overlay `style` block accepts the same CSS subset already declared in `TemplateOverlay.style` (string `padding`, `borderRadius` string-or-number, etc.). Renderer applies it as inline style; no normalization needed.

### Per-Word Highlight Pill Rendering (Area 2)
- Each `TextSegment` with `highlightColor` becomes an inline `<span>` with:
  - `backgroundColor: highlightColor`
  - `padding: '4px 12px'` (pill) / `'4px 8px'` (block)
  - `borderRadius: '8px'` (pill) / `'0'` (block)
  - `marginRight: '8px'` after the segment for visual breathing room
- Multi-line wrapping breaks the pill at line boundaries (Satori has no `box-decoration-break: clone` — same fallback already in use for `TextHighlightEffect`).
- React preview uses the **same span markup** with the **same inline styles** — explicitly NO `box-decoration-break: clone` even though browsers support it. Parity with Satori is the contract (TPLREND-05); document the gotcha as a comment in `slide-preview.tsx`.
- Spacing between consecutive segments preserved by existing `renderSegmentChildren` separator (`' '`); pill `marginRight: 8px` adds breathing room beyond the space.

### Background Composition Modes (Area 3)
- `image-bleed`: photo full-bleed (1080×1920 cover, top:0 left:0). Tint overlay paints above using `template.overlayColor` + `overlayOpacity` (kept for tonal control of B&W photo treatments).
- `image-with-bottom-card`: same full-bleed photo + tint, plus a bottom card:
  - Height: 38% of canvas (≈730px on 1920).
  - Color: `template.backgroundColor` with alpha `0.85` default (use rgba unless template provides 8-digit hex).
  - Padding: 80px (matches Murphy reference card breathing room).
  - Card sits ABOVE tint, BELOW overlays/text.
- Existing `style_overrides.layout: 'cover'/'body'` (NEWS_LAYOUT preset) and new `template.backgroundMode` are **mutually exclusive**. Resolution order: if `style_overrides.layout` is set → NEWS_LAYOUT path wins (legacy news templates unchanged); else if `template.backgroundMode` is set → new path runs; else current flat-color behavior. The 5 existing templates leave `backgroundMode` undefined → zero behavior change.
- Bottom-card text overflow: hook+body share the card. Hook uses existing `news-hook-fit.ts` auto-shrink helper (extended/wrapped if needed for card mode). Body uses `overflow: hidden` — Phase 47 prompt tuning enforces word caps so this is rarely hit.

### Render Context & Preview/Export Parity (Area 4)
- New optional `ctx` param on Satori `buildSlideElement(slide, template, brandKit, tier, origin, ctx?)`:
  - `ctx = { slideIndex: number; totalSlides: number; topic?: string }`
  - Satori entry points (`render-slide.ts` / `/api/v1/projects/[id]/render` / MCP `render_carousel`) pass the array index and length they already know plus `project.topic`.
  - Callers that omit `ctx` render counter as `1/1` and resolve `slide-field` to empty string — graceful degradation, no thrown errors.
- New props on `<SlidePreview>`: `slideIndex?: number = 0`, `totalSlides?: number = 1`. Editor callsites (`slide-canvas.tsx`, `slide-grid.tsx`, `slide-list.tsx`) pass the array index and length.
- New shared resolver `src/lib/render/resolve-overlay.ts`:
  ```ts
  export function resolveOverlayContent(
    content: OverlayContent,
    ctx: { slideIndex: number; totalSlides: number; topic?: string; slide: Slide }
  ): string
  ```
  Both Satori and React preview call this with the same ctx → guarantees zero drift on `page-counter` format string parsing, `slide-field` lookup (`topic` from ctx, `hook_text`/`body_text` from `ctx.slide`), and `literal` passthrough.
- Test strategy:
  - `src/lib/render/resolve-overlay.test.ts` — unit tests for all three discriminator branches and missing-ctx fallback.
  - Satori snapshot tests in `src/__tests__/render/render-slide-satori.test.tsx` for each new combo: overlay-only, image-bleed, image-with-bottom-card, mint-pill highlights.
  - DOM render test in `src/__tests__/components/slide-preview.test.tsx` — assert same overlay text content + same span/marginRight class signatures as Satori snapshot.
  - **No pixel-diff** (defer to v3.0+).

### Claude's Discretion
- Exact Satori snapshot file naming convention (follow whatever pattern the existing render-slide-satori tests use).
- Whether `SLOT_GEOMETRY` lives in `resolve-overlay.ts` or a new `slot-geometry.ts` (recommend colocating with resolver for now).
- Where to put the bottom-card style helper — likely `resolve-overlay.ts` or a small `compose-background.ts`.
- Whether to extract a `<HighlightSpan>` React component or inline the span builder in both renderers — judge by code size after first wire-up.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/render/render-slide-satori.tsx:32` — existing `renderSegmentChildren(text, segments, baseColor, accentColor)` already iterates `TextSegment[]` and emits `<span>` children. Extend to honor `highlightColor` / `highlightStyle`. Current call sites: hook (line 252), body (line 261), custom_texts (line 325).
- `src/lib/render/render-slide-satori.tsx:75` — existing `satoriHighlightStyle()` wires `TextHighlightEffect` (per-text-effect) into a `backgroundColor + padding` style. The new per-segment pills follow the same shape; can reuse the "no `box-decoration-break`" comment.
- `src/components/slides/slide-preview.tsx` (1094 lines) — large React component already mirrors Satori for hook/body/custom_texts. The same segment iteration pattern needs to be extended for highlight pills.
- `src/lib/render/news-hook-fit.ts` — existing auto-shrink for news templates. The bottom-card mode hook fitting can call this helper (or an extended variant).
- `src/lib/types/project.ts:10` — `topic?: string` already on `Project`. Phase 45 just needs to thread it through render context (no schema migration).
- `src/lib/render/templates/index.ts` (Phase 44) — exports `OverlaySlot`, `OverlayContent`, `TemplateOverlay`, `SlideTemplate.overlays`, `SlideTemplate.backgroundMode`. All optional → no existing-template edits needed.

### Established Patterns
- Satori is z-index-free; layering is DOM order. New overlays must be inserted at the correct position in the JSX tree.
- Existing tests live under `src/__tests__/render/` (Satori) and `src/__tests__/components/` (React preview).
- Resolved-style helpers (`resolveSlideStyles`, `resolveWatermark`, `resolveForcedWatermark`) follow the convention of pure functions returning style payloads — `resolveOverlayContent` follows the same pattern.
- Type imports use `@/lib/...` alias (tsconfig paths).

### Integration Points
- Satori call site for `buildSlideElement`: search shows `src/lib/render/render-slide.ts` is the orchestrator that calls into Satori. The new `ctx` param flows from the API route through render-slide.ts.
- Editor preview uses `<SlidePreview>` from `slide-canvas.tsx`, `slide-grid.tsx`, `slide-list.tsx`. All three already pass slide arrays — adding `slideIndex` + `totalSlides` is local.
- MCP `render_carousel` (v2.6) and REST `/api/v1/projects/[id]/render` (v2.5) both call into the same Satori path. They must pass `ctx` → grep for the render orchestrator entry points and add the ctx-build there.

</code_context>

<specifics>
## Specific Ideas

- Murphy reference (`/Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_1.png`, `_2.png`) is the visual target — Phase 45 must render slide 1 visually identical when Phase 46 ships `magazine-bold` with: `backgroundMode: 'image-with-bottom-card'`, top-left chip overlay (literal "TR3NDING" or topic), top-right page-counter, mint pill highlights on `hook_segments`.
- Bottom-card alpha default `0.85`: chosen to match the Murphy reference's "near-opaque but slightly translucent" look. Templates can override via `template.backgroundColor` 8-digit hex.
- Slot inset `60px`: matches the visual breathing room from canvas edge in Murphy reference. `top-right` slot uses `right: 60px` not `left: W-60` to make Satori absolute positioning work correctly.
- Pill `marginRight: 8px` is independent of `TextHighlightEffect` (per-text-effect highlight) padding — the two systems operate on different layers and should stay distinct.

</specifics>

<deferred>
## Deferred Ideas

- Pixel-diff visual regression with playwright/image-diff — defer to v3.0+ when the milestone needs production-grade visual contracts.
- `box-decoration-break: clone` in React preview — explicitly rejected for Phase 45 (creates preview/export drift). Reconsider only if Satori gains support.
- Multi-line measurement for bottom-card overflow — defer; Phase 47 prompt caps + existing news-hook-fit auto-shrink cover the common case.
- Custom resolver hooks on `slide-field` (uppercase, slug, etc.) — defer; already deferred in Phase 44 CONTEXT.
- Per-overlay z-index escape hatch — defer; named-slot DOM ordering is sufficient for v2.7 templates.

</deferred>

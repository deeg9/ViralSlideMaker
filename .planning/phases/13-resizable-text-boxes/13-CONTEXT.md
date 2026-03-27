# Phase 13: Resizable Text Boxes - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can resize text boxes by dragging handles, with dimensions persisted and rendered correctly in PNG exports.

</domain>

<decisions>
## Implementation Decisions

### Resize Behavior
- Width-only resize — text height auto-adjusts to content (Canva pattern for text boxes)
- Minimum width: 20% of slide width — prevents unreadable text
- Resize handles on left and right edges only (since height is auto)

### Data Model
- Store width as percentage (0-100) — consistent with existing position system
- Default text box width: existing template-defined width (backward compatible)
- New fields: `hook_width`, `body_width` on SlideStyleOverrides

### Claude's Discretion
- react-rnd configuration details and scale prop handling
- Handle visual styling (color, size, hover state)
- Whether to show width value during drag

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolveSlideStyles()` — add `hookWidth`, `bodyWidth` to returned styles
- `SlideStyleOverrides` — add `hook_width`, `body_width` percentage fields
- `slide-preview.tsx` — currently uses react-draggable for positioning, need to replace with react-rnd
- `TextEditorPanel` — could add width input alongside existing controls

### Established Patterns
- Override pattern: types → resolveSlideStyles → renderers pick it up
- Percentage-based coordinate system for positions
- Scale factor handling in slide-preview.tsx (canvas is scaled down from 1080x1920)

### Integration Points
- `slide-preview.tsx` — replace react-draggable with react-rnd for combined drag+resize
- All 3 renderers — apply width from resolveSlideStyles
- `render-slide-satori.tsx` — Satori uses percentage widths naturally
- `render-slide.ts` — HTML renderer uses percentage widths

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard resize handle pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

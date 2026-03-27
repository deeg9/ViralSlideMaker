# Phase 14: Alignment Snap Guides - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure-like — pure client-side UI polish)

<domain>
## Phase Boundary

Users get visual alignment feedback when positioning text boxes, making professional-looking layouts easy. Dashed guide lines appear when elements align (center, edges) and text boxes snap to aligned positions.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — standard alignment guide pattern. Key constraints:
- Guide lines should be dashed, subtle (not distracting)
- Snap threshold: ~5px screen distance (adjust for canvas scale factor)
- Show guides for: horizontal center, vertical center, top/bottom edge alignment between text boxes
- Guides are purely visual — they don't persist to data model
- Must work with the react-rnd drag callbacks from Phase 13

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `slide-preview.tsx` — contains the editable canvas with react-rnd text boxes
- `resolveSlideStyles()` — provides text box positions and widths
- Canvas reference dimensions: 1080x1920, displayed at scale

### Established Patterns
- Percentage-based coordinate system
- Scale factor applied via CSS transform on canvas

### Integration Points
- `slide-preview.tsx` onDrag callback — calculate guide positions during drag
- SVG or absolute-positioned divs for guide line rendering

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard alignment guide pattern like Canva/Figma.

</specifics>

<deferred>
## Deferred Ideas

None — last phase.

</deferred>

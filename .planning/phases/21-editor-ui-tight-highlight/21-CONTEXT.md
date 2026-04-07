# Phase 21: Editor UI & Tight Highlight - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can control all text effects through intuitive editor controls — toggles, color pickers, size presets, and sliders — for any text element. Also implements tight highlight with Satori fallback.

</domain>

<decisions>
## Implementation Decisions

### UI Control Layout
- Collapsible "Effects" section below existing controls per text element (hook, body, selected custom text) — matches existing panel structure
- Hide sub-controls (color/size/thickness) when toggle is off — reduces clutter
- Default colors: Shadow #00000099, Outline #000000, Highlight #00000088
- Reuse existing 4 swatches (#fff, #3d0000, #7d6161, #fadbdb) + custom picker — consistent with existing UI

### Interaction Behavior
- Toggle off preserves settings — toggling off then on restores previous color/size
- Instant live preview — update on every change (slider drag, color pick)
- Shadow S/M/L uses 3-button group matching existing text position presets (Top/Center/Bottom)
- Highlight style uses 2-button group: [Tight] [Full] matching existing alignment buttons

### Claude's Discretion
- Component extraction (inline vs separate TextEffectsControls component)
- Slider implementation details
- Exact spacing/padding within the effects section

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/editor/text-editor-panel.tsx` — existing editor panel with toggles, color swatches, sliders
- `src/lib/render/resolve-styles.ts` — resolveTextEffects(), buildHighlightWrapperStyle()
- `src/lib/types/slide.ts` — TextEffects, TextShadowEffect, TextOutlineEffect, TextHighlightEffect interfaces

### Established Patterns
- Toggle buttons: dark red (#3d0000) when active, light pink (#fff0f0) when inactive
- Color swatches: 4 preset circles + custom color picker
- Sliders: range input with live value display label
- Button groups: horizontal row of buttons (like text position Top/Center/Bottom, alignment Left/Center/Right)
- Collapsible sections exist in the panel

### Integration Points
- text-editor-panel.tsx — add effects section for hook, body, and custom text
- Slide state updates via existing dispatch/update patterns
- TextEffects type flows through resolveSlideStyles → renderers (already wired in Phase 20)

</code_context>

<specifics>
## Specific Ideas

Three instances of the effects panel: one in hook section, one in body section, one in custom text section (when selected). Match the existing UI color scheme (#3d0000 dark red, #7d6161 muted brown, #fadbdb light pink, #fff0f0 very light pink).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

# Phase 11: Bold & Italic - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can apply bold and italic formatting to individual text boxes and see it rendered correctly in browser preview and PNG exports.

</domain>

<decisions>
## Implementation Decisions

### Toolbar Placement
- B/I toggle buttons go in the text editor panel, inline with each text field label — consistent with existing font size/color controls
- Icon toggle buttons (B/I) with active state highlight — matches Canva pattern

### Bold/Italic Scope
- Each text box (hook, body) gets independent bold/italic toggles
- Font weight 700 for bold (standard bold) — already loaded in Phase 10's font loader

### Claude's Discretion
- Exact icon styling and hover states
- Whether to add keyboard shortcuts (Cmd+B, Cmd+I) in this phase or defer

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SlideStyleOverrides` in `src/lib/types/slide.ts` — extend with `hook_font_weight`, `body_font_weight`, `hook_font_style`, `body_font_style`
- `resolveSlideStyles()` in `src/lib/render/resolve-styles.ts` — Phase 10 utility, add new fields here
- `TextEditorPanel` in `src/components/editor/text-editor-panel.tsx` — add B/I buttons alongside existing controls
- `loadFontBuffers()` in `src/lib/render/load-font.ts` — already loads weight 700

### Established Patterns
- Style overrides merge in editor reducer via `UPDATE_SLIDE` action's `style_overrides` spread
- All renderers consume `resolveSlideStyles()` output — adding fields there propagates automatically
- Undo/redo works for free via existing reducer

### Integration Points
- `resolveSlideStyles()` — add `hookFontWeight`, `bodyFontWeight`, `hookFontStyle`, `bodyFontStyle` to returned object
- `slide-preview.tsx` — apply fontWeight/fontStyle from resolved styles
- `render-slide-satori.tsx` — apply fontWeight/fontStyle in Satori JSX
- `render-slide.ts` — apply fontWeight/fontStyle in HTML template
- `load-font.ts` — ensure italic variant (400italic) is also loaded

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard bold/italic toggle pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

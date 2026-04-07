# Phase 12: Font Picker & Google Fonts - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can choose from a curated library of Google Fonts for each text box, with live preview in the editor and correct rendering in PNG exports via Satori TTF font loading.

</domain>

<decisions>
## Implementation Decisions

### Font Catalog
- ~30-40 popular Google Fonts curated list — enough variety without overwhelming
- 4 categories: Sans-serif, Serif, Display, Handwriting
- Default font for new slides: Inter (already used as Satori fallback)

### Font Picker UX
- Dropdown in text editor panel, per text box — same pattern as font size/color/bold/italic
- Each font name rendered in its own typeface for visual browsing (standard Canva/Figma pattern)
- Per-text-box font selection (hook and body independent) — matches bold/italic pattern from Phase 11

### Claude's Discretion
- Exact dropdown styling and animation
- Whether to lazy-load font previews or load all at once
- Font search/filter within dropdown

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `loadFontBuffers()` in `src/lib/render/load-font.ts` — already loads TTF from Google Fonts, add dynamic font name support
- `resolveSlideStyles()` — add `hookFontFamily`, `bodyFontFamily` fields
- `SlideStyleOverrides` — add `hook_font_family`, `body_font_family` fields
- `TextEditorPanel` — add font picker dropdown alongside existing controls

### Established Patterns
- Style override pattern validated in Phase 10-11: add field to types → update resolveSlideStyles → renderers pick it up
- Toggle button pattern from Phase 11 for UI controls

### Integration Points
- `load-font.ts` — must support loading ANY font from the curated list, not just template defaults
- `route.ts` — must pass dynamically loaded fonts to ImageResponse
- All 3 renderers consume `resolveSlideStyles()` output
- Google Fonts CSS link in HTML renderer must include selected font

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard font picker pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

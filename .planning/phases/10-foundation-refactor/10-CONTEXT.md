# Phase 10: Foundation Refactor - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Exported slide images render in the correct template font, and all renderers share a single style resolution function. This is a pure refactor/bug-fix phase with no new user-facing features.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from research:
- Satori requires raw TTF font file ArrayBuffers, not CSS font names
- The render route (src/app/api/render/route.ts) currently passes NO fonts option to ImageResponse — all exports render in Noto Sans
- Style resolution is duplicated across 3+ renderers — must consolidate into resolveSlideStyles()
- Template fonts must be bundled or fetched as TTF files for Satori

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Template definitions in src/lib/templates/ define font families per style
- SlideStyleOverrides type in src/lib/types already supports per-slide overrides
- Existing render route at src/app/api/render/route.ts uses Satori/ImageResponse

### Established Patterns
- React reducer pattern with undo/redo (useSlideEditor hook)
- Template system defines fonts, colors, layout per visual style
- Brand kit overrides template defaults

### Integration Points
- src/app/api/render/route.ts — Satori render pipeline (needs font files)
- src/components/slide-preview.tsx — browser preview renderer
- Template definitions — font family declarations

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>

# Phase 19: Validation Spike & Data Model - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase)

<domain>
## Phase Boundary

The rendering strategy is confirmed and all text effect types, persistence, and shared resolution logic are in place before any renderer work begins. This phase has two parts: (1) a validation spike confirming Satori natively supports textShadow and WebkitTextStroke CSS properties, and (2) defining the TextEffects type hierarchy with per-element independence and a shared resolveTextEffects() utility.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research findings to incorporate:
- Satori natively supports `textShadow` and `WebkitTextStrokeWidth`/`WebkitTextStrokeColor` (verified in compiled bundle)
- Use 8-digit hex colors (#00000080) instead of rgba() to avoid Satori Issue #441 parse bug
- TextEffects should be a nested interface on SlideStyleOverrides (hook_text_effects, body_text_effects) and CustomText (text_effects)
- Shared resolveTextEffects() utility should follow the existing resolveSlideStyles() pattern
- Shadow presets: small=2px offset, medium=4px, large=6px
- Outline thickness range: 1-8px
- Highlight padding range: 4-24px
- Highlight styles: 'tight' and 'full-width'

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/types/slide.ts` — Slide, SlideStyleOverrides, CustomText interfaces
- `src/lib/render/resolve-styles.ts` — resolveSlideStyles() shared utility pattern
- `src/app/api/render/route.ts` — Satori rendering endpoint for spike testing

### Established Patterns
- Style overrides use optional fields on SlideStyleOverrides
- resolveSlideStyles() is the single source of truth for both preview and export renderers
- Font loading uses in-memory Map cache

### Integration Points
- TextEffects type will be consumed by all three renderers (Phase 20)
- resolveTextEffects() will be called alongside resolveSlideStyles()
- Effect settings stored in slide_data JSON column (no migration needed)

</code_context>

<specifics>
## Specific Ideas

Design doc committed at docs/plans/2026-04-07-text-effects-design.md with full specification. Research findings in .planning/research/ confirm native Satori support, simplifying the approach.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

# Phase 20: Renderer Implementation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase)

<domain>
## Phase Boundary

Text effects (shadow, outline, and highlight) render correctly across all three renderers for all text element types, using the shared resolveTextEffects() utility built in Phase 19. This phase wires the resolved CSS properties into: (1) React editor preview, (2) Satori PNG export, and (3) HTML export — for hook text, body text, and custom text boxes.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key context from Phase 19:
- resolveTextEffects() returns ResolvedTextEffectStyles with textShadow, WebkitTextStrokeWidth, WebkitTextStrokeColor, highlightColor, highlightPadding, highlightStyle fields
- resolveSlideStyles() now returns hookEffects, bodyEffects alongside existing style fields
- Satori natively supports textShadow and WebkitTextStroke — use the CSS properties directly
- Use 8-digit hex colors (#00000080) not rgba()
- Tight highlight (box-decoration-break: clone) not supported in Satori — fall back to full-width for Satori, use real tight in preview/HTML
- Custom text boxes: use resolveTextEffects(ct.text_effects) per custom text
- All effect properties are optional — skip rendering when undefined/disabled

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/render/resolve-styles.ts` — resolveTextEffects(), resolveSlideStyles() with hookEffects/bodyEffects
- `src/lib/types/slide.ts` — TextEffects, TextShadowEffect, TextOutlineEffect, TextHighlightEffect interfaces
- `src/lib/render/render-slide-satori.tsx` — buildSlideElement() for Satori JSX
- `src/lib/render/render-slide.ts` — buildSlideHtml() for HTML output
- `src/components/slides/slide-preview.tsx` — React editor preview component

### Established Patterns
- Satori renderer uses inline styles on absolute-positioned divs (no z-index, DOM order)
- HTML renderer uses CSS classes in <style> block
- Preview component uses React inline styles with scale transform
- All three renderers read from the same Slide + SlideTemplate types

### Integration Points
- buildSlideElement() — apply hookEffects/bodyEffects styles to hook/body divs, apply per-custom-text effects
- buildSlideHtml() — add CSS properties to .hook/.body classes, add inline styles to custom text divs
- slide-preview.tsx — apply effects to hook/body/custom text div styles

</code_context>

<specifics>
## Specific Ideas

Follow the pattern established in resolve-styles.ts where resolveSlideStyles is the single source of truth. The resolved effect styles should spread directly onto the existing style objects in each renderer.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

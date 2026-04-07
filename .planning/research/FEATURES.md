# Feature Landscape: Text Effects (v2.1)

**Domain:** Text effects for TikTok/Instagram carousel slide creator
**Researched:** 2026-04-07
**Overall confidence:** HIGH

## Table Stakes

Features users expect from any design tool offering text effects. Missing = the feature feels half-baked.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Text shadow with color control | Every design tool (Canva, Adobe Express, Figma) offers shadow with color. Users will compare. | Low | Satori's bundled version in `next/og` (v0.7.2, Next.js 15.5.13) **natively supports `textShadow`** -- no duplicate-element workaround needed. Verified in compiled source. |
| Text outline with color + thickness | Canva "Hollow" and "Splice" effects, Adobe Express outline -- second most-used text effect after shadow. | Low-Med | Satori natively supports `WebkitTextStrokeWidth` + `WebkitTextStrokeColor` (merged Nov 2024, present in bundled build). Should work directly. |
| Background highlight behind text | Standard readability technique for text over photos. Canva calls it "Background" effect. Essential for carousel slides where text sits on busy images. | Med | Two sub-styles needed: tight (inline marker) and full-width (banner). Tight is harder in Satori -- see Differentiators. |
| Per-element independence | Each text box (hook, body, custom) must have its own independent effect settings. Shared global effects would be a dealbreaker. | Low | Already planned in the `TextEffects` interface on `SlideStyleOverrides` and `CustomText`. No extra complexity. |
| Toggle on/off per effect | Users must be able to enable/disable each effect independently without losing their settings (color, size). | Low | Standard boolean toggle pattern. Sub-controls hidden when toggle is off. |
| Color picker for each effect | Shadow, outline, and highlight all need color control. Swatch presets + full picker. | Low | Reuse existing color swatch + picker pattern from text color controls in `text-editor-panel.tsx`. |

## Differentiators

Features that set the product apart from carousel-specific competitors. PostNitro, aiCarousels, and PostWaffle have **zero** text effects -- shipping any of these puts the product ahead.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Shadow size presets (S/M/L) | Simpler than Canva's offset-x/offset-y/blur/spread sliders. Faster for carousel creators who want "good enough" quickly. Three presets mapping to offset values (2px/4px/6px) is the right abstraction level. | Low | Canva uses 4 sliders (offset, direction, blur, transparency). Our preset approach trades flexibility for speed -- correct tradeoff for the carousel use case. |
| Tight highlight ("marker" style) | Text with per-line background color, like a highlighter pen. Very popular on Instagram/TikTok carousels for readability. Most carousel tools lack this. | Med-High | Requires `box-decoration-break: clone` on inline `<span>` elements in browser renderers (preview + HTML export). Satori likely does NOT support `box-decoration-break` for inline elements -- will need a per-line-wrapping workaround or accept full-width-only in PNG export. **This is the hardest feature in the set.** |
| Full-width highlight (banner style) | Colored rectangle behind entire text box. Simpler variant of highlight. | Low | Just a `<div>` with `backgroundColor` and padding behind the text. Works in all three renderers including Satori. |
| Highlight padding control | Slider for padding around highlighted text (4-24px). Gives users fine control over how much "breathing room" the highlight has. | Low | Simple numeric slider mapped to padding value. |
| Effect combinations | Shadow + outline + highlight can all be enabled simultaneously on the same text element. | Low | Each effect is independent in the data model. CSS properties and Satori styles compose naturally. |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Blur radius control for shadow | Satori renders shadows as sharp-edged (no blur in SVG text-shadow). Adding a blur slider would look correct in the browser preview but wrong in PNG export -- creating a confusing WYSIWYG mismatch. | Use the S/M/L presets which control offset only. The sharp shadow at 1080x1920 looks fine. Revisit blur if/when switching to Playwright renderer. |
| Gradient text fills | Requires `background-clip: text` which Satori supports but is complex to combine with outline and shadow effects. Different feature category. | Defer to a future "Advanced Text Effects" milestone. |
| Neon glow effect | Requires blurred shadow (multiple `text-shadow` values with blur). Same WYSIWYG mismatch problem as blur radius. Canva's neon is impressive but Satori cannot reproduce it. | Defer until Playwright/canvas renderer is available. |
| Curved/warped text | Completely different rendering approach (SVG path text). Not a "text effect" in the CSS sense. | Separate milestone entirely. |
| Per-character effects | Animating or styling individual characters differently. Massive complexity for minimal carousel value. | Not applicable to static carousel images. |
| Offset X/Y sliders for shadow | Canva-style directional shadow control. Over-engineered for carousel use case. Most users just want "add shadow to make text readable." | S/M/L presets with fixed 45-degree offset direction. Simpler, faster, and avoids the Satori blur mismatch. |
| Outline-only text (hollow) | Canva's "Hollow" removes fill color leaving only stroke. Niche use case, adds UI complexity (need to explain fill vs stroke). | Can be achieved by setting text color to transparent + enabling outline. Don't need a separate toggle. |
| Multiple shadows | CSS supports comma-separated `text-shadow` values for stacked effects. Over-engineered for v2.1. | Single shadow per element is sufficient. |

## Feature Dependencies

```
Text shadow --------> Color picker component (exists)
                  \-> S/M/L preset button group (new, but pattern exists in text position presets)

Text outline -------> Color picker component (exists)
                  \-> Thickness slider (new, but pattern exists in font-size slider)

Background highlight -> Color picker component (exists)
                    \-> Style toggle: tight/full-width (new button group)
                    \-> Padding slider (new, reuse slider pattern)
                    \-> Tight highlight needs per-line wrapping logic (new, complex)

All effects ---------> TextEffects interface in slide.ts (new)
                    \-> Per-element storage on SlideStyleOverrides + CustomText (new fields)
                    \-> Three renderers updated: preview, Satori, HTML

Satori renderer -----> textShadow CSS property (verified: supported in bundled @vercel/og 0.7.2)
                    \-> WebkitTextStrokeWidth/Color (verified: supported in bundled build)
                    \-> backgroundColor on wrapping elements (verified: supported)
```

**Critical dependency chain:** Types -> Satori renderer -> Preview renderer -> HTML renderer -> Editor UI. Types must be defined first. Renderer updates must happen before UI so there is something to preview.

## Rendering Compatibility Matrix

This is the key constraint driving feature decisions.

| Effect | Browser Preview | Satori PNG Export | HTML Export | Fidelity Match |
|--------|----------------|-------------------|-------------|----------------|
| Shadow (no blur) | `text-shadow` CSS | `textShadow` (native) | `text-shadow` CSS | HIGH -- all three use real CSS/equivalent |
| Outline | `-webkit-text-stroke` | `WebkitTextStrokeWidth` + `WebkitTextStrokeColor` (native) | `-webkit-text-stroke` | HIGH -- native support confirmed |
| Highlight: full-width | `div` with `backgroundColor` | `div` with `backgroundColor` | `div` with `backgroundColor` | HIGH -- identical approach |
| Highlight: tight | `span` + `box-decoration-break: clone` | Likely needs wrapper `div` per line or accept full-width fallback | `span` + `box-decoration-break: clone` | LOW-MED -- Satori may not match browser rendering |

## Satori Native Support Finding (IMPORTANT)

**The design doc (`docs/plans/2026-04-07-text-effects-design.md`) recommends duplicate-element workarounds for shadow and outline in Satori. This research finds that native CSS properties may work directly, which would significantly reduce implementation complexity.**

Verified by inspecting the compiled `@vercel/og` (v0.7.2) bundled with Next.js 15.5.13:
- `textShadow` is parsed and rendered (found: parser function, shadow offset/radius/color handling)
- `WebkitTextStrokeWidth` and `WebkitTextStrokeColor` are in the supported property set
- Both are in the inheritable text properties set

**Recommendation:** Try native CSS properties in Satori FIRST. Only fall back to duplicate-element workarounds if native rendering produces visual artifacts. This could save 10+ hours of implementation time.

**Confidence:** HIGH -- verified in actual compiled source code at `node_modules/next/dist/compiled/@vercel/og/index.node.js`.

**Caveat:** The `paint-order` behavior for outline depends on the resvg version bundled with `@vercel/og`. If stroke renders on top of fill (obscuring thin text), the 4-element cardinal workaround may still be needed for outline specifically. A quick spike will determine this.

## MVP Recommendation

Prioritize in this order:

1. **TextEffects type + data model** -- Foundation for everything. Low complexity, zero risk.
2. **Text shadow (all three renderers)** -- Highest user impact (readability on photos), lowest complexity given native Satori support. Use native `textShadow` in Satori, no duplicate elements.
3. **Text outline (all three renderers)** -- Second highest impact, also natively supported. Use `WebkitTextStrokeWidth`/`Color` in Satori.
4. **Background highlight: full-width** -- Simple `div` with `backgroundColor` works identically in all renderers. Ship this first.
5. **Background highlight: tight** -- Most complex feature due to Satori limitations with inline `box-decoration-break`. May need a per-line wrapper approach or accept visual difference between preview and export. Ship as stretch goal or accept full-width fallback in PNG export.
6. **Editor UI panel** -- Build after renderers are working so controls have visible feedback.

**Defer from MVP:** Blur radius for shadow, neon glow, gradient text, curved text. These all require a rendering pipeline change (Satori to Playwright/canvas).

## Complexity Assessment

| Feature | Implementation Effort | Risk |
|---------|----------------------|------|
| Shadow (native Satori) | 2-3 hours | Low -- native support verified |
| Shadow (duplicate-element fallback) | 4-6 hours | Low -- well-understood pattern, but likely unnecessary |
| Outline (native Satori) | 2-3 hours | Low-Med -- `paint-order` rendering depends on resvg version |
| Outline (4-element cardinal fallback) | 6-8 hours | Med -- alignment edge cases at different font sizes |
| Highlight: full-width | 2-3 hours | Low -- simple wrapper div |
| Highlight: tight | 6-10 hours | Med-High -- `box-decoration-break` unlikely in Satori, need line-splitting logic |
| Editor UI (all controls) | 4-6 hours | Low -- reuses existing patterns (toggles, swatches, sliders) |
| Per-element data model | 1-2 hours | Low -- optional fields on existing interfaces |

**Total estimate (native approach):** 15-25 hours
**Total estimate (workaround approach):** 25-35 hours

## Sources

- [Satori GitHub repository](https://github.com/vercel/satori) -- CSS support reference
- [Satori text-stroke PR #645](https://github.com/vercel/satori/pull/645) -- Merged Nov 2024, adds WebkitTextStroke support
- [Satori outdated in next/og - Issue #72940](https://github.com/vercel/next.js/issues/72940) -- Version tracking
- [Canva text effects help](https://www.canva.com/help/text-effects/) -- Competitor feature reference
- [Adobe Express shadow effects](https://helpx.adobe.com/express/web/add-effects-to-your-designs/add-text/add-shadow-effects-to-text.html) -- Competitor reference
- [CSS box-decoration-break MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/box-decoration-break) -- Tight highlight technique
- [Multi-line padded text CSS-Tricks](https://css-tricks.com/multi-line-padded-text/) -- Implementation patterns for tight highlights
- Verified: compiled `@vercel/og` source at `node_modules/next/dist/compiled/@vercel/og/index.node.js` confirms `textShadow`, `WebkitTextStrokeWidth`, `WebkitTextStrokeColor` support

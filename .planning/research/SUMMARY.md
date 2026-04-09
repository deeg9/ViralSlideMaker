# Project Research Summary

**Project:** TikTok Slideshow Creator — v2.1 Text Effects
**Domain:** CSS text effects for multi-renderer carousel slide creator (Satori PNG + browser preview + HTML export)
**Researched:** 2026-04-07
**Confidence:** HIGH

## Executive Summary

This milestone adds three text effects — shadow, outline, and background highlight — to an existing carousel slide creator. The project's rendering pipeline is unusual: it maintains three renderers (React browser preview, Satori-based PNG export via `next/og`, and HTML export) that must produce visually identical output. The dominant finding across all research files is that Satori, as bundled in Next.js 15.5.13 (`@vercel/og` 0.7.2), natively supports `textShadow` and `WebkitTextStrokeWidth`/`WebkitTextStrokeColor` — properties the existing design doc assumed were unsupported and planned to fake with duplicate DOM elements. This single finding changes the entire implementation strategy: all three renderers can share the same CSS properties, collapsing what was a complex multi-renderer fork into a straightforward unified CSS approach.

The recommended approach is to define a `TextEffects` interface at the type layer, resolve effects to CSS in a shared utility (`resolveTextEffects()`), and spread the same CSS properties across all three renderers. Shadow and outline require no renderer-specific branching. Background highlight requires one structural decision: Satori does not support `box-decoration-break: clone`, so the "tight" (per-line) highlight mode cannot be reproduced in PNG export — full-width highlight is the pragmatic fallback. Total estimated effort drops from 25-35 hours (workaround approach) to 15-25 hours (native CSS approach).

The critical risk is Satori CSS parser strictness. Satori's `textShadow` parser has a known bug (Issue #441) with `rgba()` percentage-alpha syntax. This is mitigated by using 8-digit hex colors (`#00000080`) instead of `rgba()` functions throughout. A 30-minute validation spike — render a test slide with `textShadow` and `WebkitTextStrokeWidth` via the `/api/render` route and inspect the PNG — should run before any implementation begins to confirm native support and rule out surprises.

## Key Findings

### Recommended Stack

The existing stack requires zero new dependencies. Next.js 15.5.13 bundles `@vercel/og` 0.7.2 which includes Satori support for all required CSS properties. All text effects are implementable with CSS properties already available in the rendering pipeline. The only verified gap is `box-decoration-break` for Satori inline highlight, which is handled by accepting full-width fallback in PNG export rather than adding a dependency.

**Core technologies (unchanged):**
- Next.js 15.5.13: Framework + Satori via `next/og` — bundled Satori confirms `textShadow` + `WebkitTextStroke` support
- React 19.1.0: Browser preview rendering — standard CSS properties for all effects
- Satori via `@vercel/og` 0.7.2: PNG export — native support verified in compiled bundle
- Playwright 1.58.2: HTML export renderer — full CSS support including `box-decoration-break: clone` for tight highlight
- `@radix-ui/react-switch` 1.2.6: Toggle controls for effect enable/disable — already installed
- Tailwind CSS 4.x: Editor panel styling — already in use

**Do NOT add:** standalone `satori` npm package (version conflict with bundled version), `canvas`/`node-canvas`, `fabric.js`, `konva`, or any "text effect" npm library targeting canvas rendering.

### Expected Features

**Must have (table stakes):**
- Text shadow with color control — every design tool competitor (Canva, Adobe Express) offers this; missing = feature feels half-baked
- Text outline with color + thickness — second most-used text effect; Canva's "Hollow" and "Splice" depend on it
- Background highlight behind text — essential for carousel readability on busy photo backgrounds
- Per-element independence — each text box (hook, body, custom) needs independent effect settings; global effects would be a dealbreaker
- Toggle on/off per effect without losing settings — standard boolean toggle pattern
- Color picker for each effect — reuse existing swatch + picker pattern from `text-editor-panel.tsx`

**Should have (differentiators):**
- Shadow size presets (S/M/L) — simpler than Canva's 4-slider approach; correct abstraction for carousel creators who want "good enough" fast
- Tight highlight ("marker" style) — per-line background color very popular on TikTok/Instagram; carousel-specific competitors (PostNitro, aiCarousels, PostWaffle) have zero text effects
- Full-width highlight (banner style) — simpler variant, works identically across all renderers
- Highlight padding control (4-24px slider)
- Effect combinations — shadow + outline + highlight simultaneously on same element

**Defer (v2+):**
- Blur radius slider for shadow — Satori renders SVG drop shadows differently than browser blur; would create WYSIWYG mismatch
- Neon glow, gradient text, curved/warped text — require Playwright/canvas renderer swap
- Per-character effects — massive complexity for no carousel value
- Multiple shadows, offset X/Y sliders — over-engineered for carousel use case

### Architecture Approach

The architecture is a unified CSS passthrough pattern. A single `resolveTextEffects(effects: TextEffects): ResolvedTextEffectStyles` function converts semantic effect data to CSS properties. Because all three renderers share the same CSS property names for shadow and outline, the resolved object is spread directly onto style objects in each renderer with no branching. Highlight is the one structural exception — it requires a wrapper `div` with `backgroundColor` rather than a CSS property on the text element itself.

**Major components:**
1. `src/lib/types/slide.ts` — Add `TextEffects` hierarchy interfaces; add `hook_effects`/`body_effects` to `SlideStyleOverrides` and `effects` to `CustomText`
2. `src/lib/render/resolve-styles.ts` — Add `resolveTextEffects()` with `SHADOW_PRESETS` map; extend `ResolvedSlideStyles`
3. `src/lib/render/render-slide-satori.tsx` — Apply resolved effect styles to hook/body/custom text JSX; add highlight wrapper divs
4. `src/lib/render/render-slide.ts` — Apply effect CSS strings to HTML output
5. `src/components/slides/slide-preview.tsx` — Apply resolved effect styles to React inline styles; add highlight wrappers
6. `src/components/editor/text-effects-controls.tsx` (NEW) — Reusable toggle + color + size controls; used three times (hook, body, selected custom text)
7. `src/components/editor/text-editor-panel.tsx` — Import and render `TextEffectsControls` for all three text element types

**Build order:** Types -> Resolution -> Satori renderer -> HTML renderer -> Preview renderer -> Editor UI. Renderer steps 3-5 are independent of each other once step 2 is complete.

### Critical Pitfalls

1. **Building duplicate-element workarounds before testing native Satori CSS** — Run a 30-minute spike rendering `textShadow` and `WebkitTextStrokeWidth` via `/api/render` before writing any implementation code. Native support is verified; workarounds are unnecessary and add 10-15 hours of complexity.

2. **Three renderers drifting out of sync** — Create `buildEffectStyles(effects: TextEffects): React.CSSProperties` as a shared utility before adding effects to any renderer. Never copy-paste effect logic across renderer files.

3. **Tight highlight broken on multi-line text in Satori** — Satori does not support `box-decoration-break: clone`. Test with 4-line body text in Satori specifically. Accept full-width fallback in PNG export; keep per-line tight rendering in browser preview and HTML export.

4. **Satori `textShadow` rgba syntax bug** — Never use `rgba(r, g, b, percentage%)` format (triggers Issue #441). Use 8-digit hex (`#00000080`) or decimal-alpha `rgba(0,0,0,0.5)` throughout.

5. **Effects implemented for hook/body but not custom text boxes** — The three text types have separate code paths in all renderers. Implement effects for all three types in the same phase using the shared utility. Do not ship without verifying the effects panel appears for selected custom text boxes.

## Implications for Roadmap

Based on combined research, the milestone maps cleanly to 3 phases with a mandatory validation spike before implementation.

### Phase 1: Validation Spike + Data Model
**Rationale:** The entire implementation strategy depends on confirmed native Satori CSS support. A 30-minute render test must confirm this before committing to the unified approach. Types must be defined before any renderer work can start.
**Delivers:** Confirmed rendering strategy + complete TypeScript type definitions for the `TextEffects` hierarchy
**Addresses:** Pitfall 1 (native vs duplicates), foundation for all features
**Avoids:** Building the wrong architecture; type drift between renderers

### Phase 2: Renderer Implementation (Shadow + Outline + Full-Width Highlight)
**Rationale:** Renderers must be updated before UI exists. Shadow and outline use identical CSS across all renderers — implement together. Full-width highlight is structurally similar (wrapper div) and low-risk; include here. Tight highlight is deferred to Phase 3 due to Satori complexity.
**Delivers:** Working PNG export and browser preview for shadow, outline, and full-width highlight on all three text element types (hook, body, custom)
**Implements:** `resolve-styles.ts` additions, `render-slide-satori.tsx`, `render-slide.ts`, `slide-preview.tsx` updates
**Avoids:** Pitfall 2 (renderer drift) via shared utility; Pitfall 5 (custom text forgotten) by implementing all three text types in this phase

### Phase 3: Tight Highlight + Editor UI
**Rationale:** Editor controls require working renderers to provide visible feedback. Tight highlight is the most complex feature (Satori fallback logic) and benefits from isolation. UI reuses existing patterns (toggles, swatches, sliders) and is low-risk.
**Delivers:** Complete text effects editor panel with toggles, color pickers, and size controls; tight highlight mode with graceful Satori fallback
**Implements:** `text-effects-controls.tsx` (new), `text-editor-panel.tsx` updates, tight highlight with `box-decoration-break: clone` in preview/HTML + full-width fallback in Satori
**Avoids:** Pitfall 4 (tight highlight multi-line bug) by testing specifically with 4-line body text in Satori before shipping

### Phase Ordering Rationale

- Phase 1 before everything: a failed spike would change the entire architecture; must resolve first
- Renderers before UI (Phase 2 before 3): controls need visible feedback to be meaningful during development
- Shadow + outline together in Phase 2: they share the same unified CSS passthrough pattern and similar complexity
- Tight highlight in Phase 3: isolated from simpler effects; fallback logic is easier to reason about in its own phase
- All effects must include custom text boxes in the same phase they are implemented (Pitfall 5 prevention)

### Research Flags

Phases with standard patterns (skip additional research):
- **Phase 1 (spike):** Code test against existing codebase — no research needed, just run it
- **Phase 2 (renderers):** Unified CSS passthrough is well-documented; Satori CSS properties verified; build order is deterministic
- **Phase 3 (UI):** UI patterns already established in `text-editor-panel.tsx`; reuse existing toggle/slider/swatch components

No phase in this milestone requires `/gsd-research-phase` — all unknowns are resolved by the Phase 1 spike, which is a 30-minute code test rather than additional research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all CSS properties verified in compiled `@vercel/og` bundle at `node_modules/next/dist/compiled/@vercel/og/index.node.js` |
| Features | HIGH | Competitor analysis (Canva, Adobe Express, PostNitro) plus verified Satori rendering compatibility matrix |
| Architecture | HIGH | Existing codebase inspected; build order confirmed by dependency analysis; component boundaries match existing patterns |
| Pitfalls | HIGH | Verified against Satori GitHub issues (#441, #645, #578), compiled bundle, and codebase file inspection |

**Overall confidence:** HIGH

### Gaps to Address

- **Satori `paint-order` for outline:** Browser preview needs explicit `paintOrder: 'stroke'` added to match Satori's auto-behavior. Verify match during Phase 1 spike.
- **Shadow color defaults on dark templates:** Default `#00000099` is invisible on dark overlay templates. Phase 3 should test all templates and potentially auto-adjust default to white shadow on dark backgrounds.
- **Slider debounce:** Color pickers and sliders firing `onChange` continuously will flood the undo history (MAX_HISTORY=50) and cause preview jank. Phase 3 must add 150ms debounce to onChange and use `onChangeComplete` for undo history pushes only — not the preview path.
- **Satori `textShadow` blur fidelity:** Satori renders drop shadows via SVG `feGaussianBlur`; subtle visual differences from browser `text-shadow` are possible at same pixel values. Shadow presets with conservative values mitigate this; verify during Phase 1 spike.

## Sources

### Primary (HIGH confidence)
- Compiled `@vercel/og` bundle: `node_modules/next/dist/compiled/@vercel/og/index.node.js` — verified `textShadow`, `WebkitTextStrokeWidth`, `WebkitTextStrokeColor` support
- [Satori GitHub README CSS support table](https://github.com/vercel/satori) — confirmed `boxShadow`, `filter`, `backgroundClip: text` support
- [Satori text-stroke PR #645](https://github.com/vercel/satori/pull/645) — merged Nov 19, 2024; adds WebkitTextStroke support
- [Satori Issue #441](https://github.com/vercel/satori/issues/441) — `textShadow` rgba percentage-alpha parse bug; confirmed workaround
- Existing codebase: `src/lib/render/render-slide-satori.tsx`, `src/components/slides/slide-preview.tsx`, `src/lib/types/slide.ts`, `src/app/api/render/route.ts`

### Secondary (MEDIUM confidence)
- [Satori CSS Support (DeepWiki)](https://deepwiki.com/vercel/satori/4-advanced-usage) — `display: inline` not supported; `box-decoration-break` not in supported list
- [Canva text effects help](https://www.canva.com/help/text-effects/) — competitor feature reference for table stakes
- [CSS box-decoration-break MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/box-decoration-break) — tight highlight browser technique

### Tertiary (LOW confidence)
- [Next.js Issue #72940](https://github.com/vercel/next.js/issues/72940) — satori version tracking in next/og; version confirmed via bundle inspection instead

---
*Research completed: 2026-04-07*
*Ready for roadmap: yes*

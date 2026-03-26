# Project Research Summary

**Project:** TikTok Slideshow Creator — v1.3 Rich Text Editing
**Domain:** Carousel slide editor text styling (font picker, bold/italic, resizable text boxes, alignment guides)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

This milestone adds professional text editing capabilities to an existing carousel slide editor built on Next.js 15, React 19, Satori (via `next/og` ImageResponse), and Supabase. The architecture is clean and well-defined: a three-layer pipeline where data flows through a reducer into two parallel renderers (a React client preview and a Satori server-side PNG exporter). Every feature in this milestone extends `SlideStyleOverrides` and must render identically in both renderers. The single most critical constraint is that Satori does NOT use CSS font names — it requires raw font file ArrayBuffers passed explicitly to `ImageResponse`. This constraint shapes almost every decision in the milestone.

The recommended approach is to build in strict dependency order: first extract a shared `resolveSlideStyles()` function to eliminate style resolution duplication across renderers, then implement bold/italic toggles (lowest risk, validates the full override pipeline), then font picker with server-side font loading infrastructure (highest user value, medium risk), then resizable text boxes (data model change, medium risk), and finally alignment snap guides (pure UI polish, no server impact). The stack additions are minimal: one new package (`react-rnd` to replace `react-draggable` with drag+resize in one component), the Google Fonts Developer API, and approximately 300 lines of custom utility code. No rich text editors, canvas libraries, or additional resize libraries are needed.

The critical risk that must be fixed immediately is a pre-existing production bug: the current render route passes no `fonts` option to `ImageResponse`, meaning exports already render in Satori's default Noto Sans font regardless of template font settings. This must be fixed before building the font picker UI. Beyond that, the main risks are: (1) Satori requiring separate font file variants for each weight/style combination (no faux bold/italic synthesis), (2) preview-vs-export text layout drift due to Satori's different text shaping engine, and (3) coordinate system complexity when adding resize to the scaled canvas.

## Key Findings

### Recommended Stack

The existing stack (Next.js 15, React 19, Supabase, Gemini 2.5 Flash, Satori/ImageResponse, Tailwind 4, shadcn/ui) is unchanged and validated. The only new npm package is `react-rnd@^10.5.3`, which replaces `react-draggable` with a component that handles both drag AND resize with a `scale` prop compatible with the existing scaled canvas. Everything else — font picker UI, bold/italic toggles, snap guides — is implemented with zero new npm packages using the existing shadcn Popover/Command pattern, Google Fonts CSS2 API, and custom geometry math (~100 LOC).

Dynamic font loading uses two separate paths by necessity: the client preview injects a `<link>` tag pointing to the Google Fonts CSS2 endpoint, while Satori requires fetching the `.ttf` file as an ArrayBuffer and passing it in the `fonts` array of `ImageResponse`. Font ArrayBuffers must be cached server-side in a `Map<string, ArrayBuffer>` to avoid per-render fetches. `next/font/google` is explicitly not viable here because it only works with static build-time declarations, not runtime user selection.

**Core technologies:**
- `react-rnd@^10.5.3`: drag + resize for text boxes — replaces `react-draggable`, supports `scale` prop, published March 2026
- Google Fonts CSS2 API: client-side font loading — stable, no API key required
- Google Fonts Developer API: font list metadata — free API key required, cache response daily (`GOOGLE_FONTS_API_KEY`)
- Custom `resolveSlideStyles()`: shared style resolution — eliminates 3-renderer duplication before adding 8 new fields
- Custom `useAlignmentGuides` hook: snap guide logic — ~100 LOC, no library needed for 2-3 text elements

### Expected Features

See [FEATURES.md](FEATURES.md) for full feature analysis, competitor breakdown (Canva, Figma), and dependency graph.

**Must have (v1.3 table stakes):**
- Bold/italic toggles per text box — universal expectation in any design tool; whole-box formatting only, not inline rich text
- Font picker with curated Google Fonts — core user request; 30-50 popular fonts with search, not all 1,500+
- Resizable text boxes — users expect drag handles; horizontal resize only (width), height auto from content
- Snap alignment guides — canvas center, edges, cross-box alignment; makes positioning feel professional

**Should have (v1.4 differentiators):**
- Font preview rendered in its own typeface in the picker dropdown
- Letter spacing and line height controls (simple CSS, low risk)
- Recently used fonts (localStorage, trivial after font picker exists)
- Text shadow (most requested text effect, Satori-compatible)

**Defer (v2+):**
- Inline rich text (per-word bold/italic) — requires Slate/TipTap, rich text data model, and complex Satori span rendering
- Custom font uploads — font hosting, validation, licensing concerns
- Text on a path / curved text — Satori does not support SVG text paths
- Text effects beyond shadow (outline, glow, gradient) — each needs render parity; high scope creep risk

### Architecture Approach

The architecture requires no structural changes to the editor pattern. All new features flow through the existing `UPDATE_SLIDE` reducer action by extending `SlideStyleOverrides` with 8 new optional fields. The critical prerequisite refactor is extracting `resolveSlideStyles(slide, template): ResolvedSlideStyles` as a shared function consumed by all renderers — without this, adding 8 fields to 3 renderer copies creates 24 potential divergence points between preview and export. The font loading infrastructure adds two new modules: `font-catalog.ts` (static curated list with variant metadata) and `load-font.ts` (fetch/cache TTF buffers for Satori). The font picker and alignment guide hook are new components with no downstream dependencies.

**Major components:**
1. `resolve-styles.ts` (NEW) — single source of truth for all style overrides across all renderers; must be extracted first
2. `font-catalog.ts` + `load-font.ts` (NEW) — font metadata with variant availability, and server-side TTF buffer caching for Satori
3. `font-picker.tsx` (NEW) — searchable dropdown built on shadcn Popover/Command; lazy-loads font CSS previews
4. `use-alignment-guides.ts` (NEW) — snap guide calculation hook; client-only, ephemeral, never persisted
5. `slide-preview.tsx` (MODIFIED) — consume `resolveSlideStyles()`, swap `react-draggable` for `react-rnd`, add guide overlay, inject Google Font `<link>` tags
6. `render-slide-satori.tsx` + `render/route.ts` (MODIFIED) — consume `resolveSlideStyles()`, fetch font buffers per slide, pass to ImageResponse

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for full details, phase-specific warnings, and the pre-existing codebase issue.

1. **Satori ignores CSS font names — needs raw TTF ArrayBuffers** — Fix the pre-existing bug in `render/route.ts` (no `fonts` option currently passed to `ImageResponse`) before any font picker UI work. This is a production bug affecting all existing exports right now.

2. **Satori cannot synthesize bold/italic — each variant needs its own font file** — For every font in the picker, load separate TTF files for each weight/style variant (400, 700, 900, 400-italic, 700-italic). Satori silently falls back to regular weight with no error if the requested variant is missing. Gate bold/italic buttons in the UI for fonts that lack those variants.

3. **Preview and export text layout differ** — Satori's Yoga-based engine produces different line breaks, metrics, and kerning than the browser. Use identical font files in both paths. Test all fonts with long, short, and multi-line text to identify layout drift. Consider adding a "preview render" button that generates actual Satori output so users can verify before downloading.

4. **Divergent override resolution across renderers** — Extract `resolveSlideStyles()` before adding any new fields. The current codebase duplicates resolution logic across 3 renderers; adding 8 more fields to all copies without consolidation guarantees preview-vs-export visual inconsistency.

5. **Coordinate system confusion for resizable text boxes** — Screen pixels, 1080x1920 reference pixels, and percentages are all simultaneously in play. Use `react-rnd` (which has a `scale` prop) instead of layering a separate resize library on top of `react-draggable`. Test resize behavior at multiple viewport sizes. Dispatch only on `onResizeStop`, not during drag, to avoid undo stack bloat.

## Implications for Roadmap

The build order is driven by hard dependencies. Each phase validates infrastructure the next phase depends on. No phase can safely be skipped or reordered.

### Phase 1: Foundation Refactor + Pre-existing Bug Fix

**Rationale:** Two blockers must be resolved before any visible feature work begins. The missing Satori font loading (`render/route.ts` passes no `fonts` option) is a production bug that affects every current export. The `resolveSlideStyles()` extraction is a prerequisite refactor that must precede adding 8 new override fields to 3 renderers. Both are pure infrastructure with zero external dependencies.
**Delivers:** Exports render in the correct template font (currently broken). All renderers share a single `resolveSlideStyles()` function. Zero user-visible UI changes, but a correct foundation.
**Addresses:** Pre-existing font rendering bug in production; establishes the shared override pattern all subsequent phases rely on.
**Avoids:** Pitfall 1 (missing fonts in Satori), Pitfall 4 (divergent renderer resolution creating preview-vs-export visual drift)

### Phase 2: Bold/Italic Toggles

**Rationale:** Simplest feature in the milestone. Validates the complete end-to-end override pipeline (data model extension → UI control → preview render → server render → undo/redo) before tackling more complex font infrastructure. Zero external dependencies beyond Phase 1.
**Delivers:** Bold (B) and italic (I) toggle buttons per text box in the editor panel. Correct rendering in both browser preview and PNG export. Works immediately for existing template fonts because Phase 1 fixes font loading.
**Uses:** `resolveSlideStyles()` from Phase 1; extends `SlideStyleOverrides` with `hook_font_weight`, `hook_font_style`, `body_font_weight`, `body_font_style`
**Avoids:** Pitfall 11 (inline rich text scope creep — per-text-box only), Pitfall 14 (template `hookStyle` conflict — define clear override precedence in `resolveSlideStyles`: user override wins over template style), Pitfall 5 (backward compatibility — all new fields optional with `??` fallbacks)

### Phase 3: Font Picker + Google Fonts Infrastructure

**Rationale:** Highest user-perceived value feature of the milestone. Builds on Phase 1's font loading fix. The server-side integration (catalog, TTF buffer loading, caching, passing to ImageResponse) is the riskiest part and must be built and tested before the picker UI.
**Delivers:** Searchable font picker dropdown (30-50 curated fonts grouped by category), live font preview in editor via `<link>` tag injection, correct custom font in PNG exports via TTF buffer loading.
**Uses:** Google Fonts CSS2 API (client-side preview), Google Fonts Developer API (font list + variant metadata), new `font-catalog.ts` and `load-font.ts` modules, shadcn Popover/Command for the picker UI
**Implements:** `hook_font_family` and `body_font_family` fields in `SlideStyleOverrides`
**Avoids:** Pitfall 1+2 (font loading for all variants), Pitfall 4 (FOUT — use `document.fonts.load()` before applying font), Pitfall 9 (curate 30-50 fonts, not all 1,500+), Pitfall 12 (normalize font names to exact Google API format; convert to CSS string only at render time)

### Phase 4: Resizable Text Boxes

**Rationale:** Modifies the core text box coordinate system. Must come after Phase 3 because text box dimensions depend on the active font. Alignment guides (Phase 5) need stable, explicitly-stored text box widths that this phase introduces.
**Delivers:** Left/right resize handles on text boxes. Independent `hook_width` and `body_width` stored as percentages in `SlideStyleOverrides`. All renderers updated to use per-box width instead of the current symmetric `100 - hookX * 2` calculation. Backward compatible (existing slides fall back to symmetric calculation).
**Uses:** `react-rnd@^10.5.3` (replaces `react-draggable`); adds `hook_width`, `body_width` to `SlideStyleOverrides` and `resolveSlideStyles()`
**Avoids:** Pitfall 6 (coordinate confusion — `react-rnd` `scale` prop handles screen-to-reference-space conversion), Pitfall 5 (backward compatibility — fallback to symmetric calc when field is `undefined`), Pitfall 10 (undo stack bloat — dispatch only on `onResizeStop`), Pitfall 13 (mobile touch targets — 44x44px minimum for resize handles)

### Phase 5: Alignment Snap Guides

**Rationale:** Pure UI polish with no data model or server rendering impact. Placed last because it benefits from knowing real text box widths (introduced in Phase 4). Snap accuracy requires measured bounding boxes, not just position coordinates.
**Delivers:** Visual snap guide lines (dashed overlay divs) when dragging text boxes near canvas center (50%), safe zone boundaries (11%/89%), and other text box edges and centers.
**Uses:** Custom `useAlignmentGuides` hook; `onDrag` callback on `react-rnd` (supported natively); overlay `<div>` elements in `SlidePreview`
**Avoids:** Pitfall 7 (wrong snap positions due to unknown box size — use `getBoundingClientRect()` for actual rendered dimensions; snap from visual center/edges, not position origin)

### Phase Ordering Rationale

- Phase 1 must be first: every other phase depends on working Satori font rendering and the shared `resolveSlideStyles()` function.
- Phase 2 (bold/italic) before Phase 3 (font picker) because it validates the full override pipeline end-to-end with zero external risk. If something in the pipeline is broken, bold/italic makes it visible before the more complex font integration begins.
- Phase 3 (font picker) before Phase 4 (resize) because text box dimensions change with font, so resize handles must be tested against actual font-rendered text to confirm bounding box measurements are correct.
- Phase 5 (guides) last because snap precision depends on knowing real text box widths, which Phase 4 introduces as explicit stored values rather than computed estimates.
- Phases 2-5 could technically be parallelized across engineers, but the sequential order above minimizes debugging complexity for a solo developer.

### Research Flags

Phases needing extra care during implementation (not full research-phase, but test-before-proceeding):

- **Phase 3 (Font Picker — server integration):** Satori font buffer loading is the trickiest integration point in the milestone. Implement and test server-side PNG rendering with a single custom font before building the full picker UI. Do not assume it works until you have a downloaded PNG with the correct font rendered. Risk: HIGH.
- **Phase 4 (Resize — coordinate system):** The three-level coordinate system (screen px → 1080x1920 reference px → percentage) is non-trivial. Test resize behavior at mobile, tablet, and desktop viewport sizes before calling the feature complete. Risk: MEDIUM.

Phases with standard, well-understood patterns (skip additional research):

- **Phase 1 (Refactor + bug fix):** Pure extraction of existing logic into a shared function. No behavior change. Standard refactor pattern. The Satori `fonts` option is documented and working.
- **Phase 2 (Bold/Italic):** Identical pattern to the existing `hook_font_size` override. Adds two CSS properties through `resolveSlideStyles()`. Very low risk.
- **Phase 5 (Guides):** Client-only, no persistence, no server rendering impact. Custom snap logic is ~100 LOC of geometry math. Low risk.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | `react-rnd` verified on npm (March 2026 publish). Google Fonts API docs verified. Satori font format requirements confirmed against GitHub issues. `next/font` limitation confirmed via Next.js team discussion. |
| Features | HIGH | Table stakes derived from direct Canva/Figma feature analysis. Bold/italic as whole-box toggle (vs. inline rich text) is the clear correct choice for carousel slides. Anti-features are well-justified with concrete Satori rendering constraints. |
| Architecture | HIGH | Based on direct codebase analysis of all affected files. `resolveSlideStyles()` design is implementation-ready. Build order is dependency-driven, not arbitrary. Satori CSS subset limitations are documented and verified. |
| Pitfalls | HIGH | Pre-existing bug confirmed via direct codebase inspection (`render/route.ts` line 87-90). Satori font weight fallback behavior confirmed via GitHub issue #263. Coordinate system analysis based on existing `react-draggable` scale implementation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Satori font rendering fidelity per font:** Some Google Fonts may produce more layout drift between browser and Satori than others (kerning, line breaking, metrics). Cannot determine which fonts are problematic until tested. Mitigation: test all 30-50 catalog fonts during Phase 3 with both short and long text, document any that render poorly.
- **Google Fonts variant availability:** Not all Google Fonts have bold or italic variants. `font-catalog.ts` must include variant metadata so the UI can disable bold/italic buttons for fonts lacking those variants. Must be built into Phase 3 from the start.
- **Mobile resize UX for Phase 4:** Resize handles need 44x44px touch targets and a tap-to-select-then-resize interaction model. The exact mobile interaction pattern needs UX validation before Phase 4 ships.
- **Undo/redo debounce strategy:** A coalescing or debounce strategy (either 300ms debounce or `onChangeComplete`-only) must be chosen before building any new interactive control in Phases 2-5. The current MAX_HISTORY=50 cap limits damage but rapid interactions can flush meaningful undo history.

## Sources

### Primary (HIGH confidence)
- [Next.js ImageResponse docs](https://nextjs.org/docs/app/api-reference/functions/image-response) — font loading options, `fonts` array format
- [Vercel custom font guide](https://vercel.com/kb/guide/using-custom-font) — TTF ArrayBuffer approach for ImageResponse
- [react-rnd GitHub](https://github.com/bokuweb/react-rnd) — API reference, `scale` prop, version 10.5.3
- [react-rnd npm](https://www.npmjs.com/package/react-rnd) — publish date March 2026
- [Google Fonts CSS2 API](https://developers.google.com/fonts/docs/css2) — font loading endpoint, multi-variant request format
- [Google Fonts Developer API](https://developers.google.com/fonts/docs/developer_api) — font list and variant metadata
- [Satori README](https://github.com/vercel/satori/blob/main/README.md) — supported CSS subset, font requirements
- [Satori issue #263](https://github.com/vercel/satori/issues/263) — font weight silent fallback behavior confirmed
- Direct codebase analysis — `src/lib/types/slide.ts`, `src/components/slides/slide-preview.tsx`, `src/lib/render/render-slide-satori.tsx`, `src/app/api/render/route.ts`, `src/lib/editor/editor-reducer.ts`, `src/components/editor/text-editor-panel.tsx`

### Secondary (MEDIUM confidence)
- [Next.js dynamic font loading discussion #40345](https://github.com/vercel/next.js/discussions/40345) — confirms `next/font` cannot load fonts at runtime
- [Satori discussions #662](https://github.com/vercel/satori/discussions/662) — TTF/OTF required, WOFF2 not supported
- [Canva Help Center - Add and Edit Text](https://www.canva.com/help/add-and-edit-text/) — UX patterns for text editing in design tools
- [Canva Apps SDK - Fonts Example](https://www.canva.dev/docs/apps/examples/fonts/) — font picker UX patterns

### Tertiary (LOW confidence)
- Satori-based preview for pixel-perfect parity — mentioned as a long-term option but not validated for feasibility or performance at this project's scale

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*

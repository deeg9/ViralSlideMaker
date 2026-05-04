# Stack Research — v2.12 Shapes & Icons (Decoration Primitives)

**Domain:** Web slide editor — adding decorative primitives (icons + shapes) to a Satori-rendered carousel image generator
**Researched:** 2026-05-03
**Confidence:** HIGH (versions verified via `npm view`; Satori behavior verified via README + presets.ts source + PR #98 + existing v2.9 codebase pattern)

---

## TL;DR — One-Liner Per Decision

| New capability | Pick | Why this not the alternative |
|----------------|------|------------------------------|
| Icon library | **`lucide-react@^1.14.0`** (already installed at `0.577`, upgrade to v1) | Already in tree; v1 is React-19-tested; brand-icon removal is irrelevant to us |
| Icon picker render | **Direct named imports + manual chunking via static index map** (NOT `DynamicIcon`) | Maintainer recommends against `DynamicIcon` for typical apps; per-icon chunks blow up network requests; we render at SVG-stroke level (≈400 bytes/icon at runtime) |
| Virtualized 4-col grid | **`@tanstack/react-virtual@^3.13`** | Headless / DOM-agnostic → trivially jsdom-testable; first-class grid + `measureElement`; bidirectional virtualization; same author as our existing react-table mental model |
| Fuzzy search | **`@leeoniya/ufuzzy@^1.0.19`** | 7.6KB minified; benchmarked 78× faster than Fuse over 162k items; our corpus is ~1,700 names + ~3-5 tags each ≈ 8-10k tokens; zero index-build overhead |
| Shape rendering primitive | **CSS-styled `<div>` for rect/circle/ellipse + pre-baked `<img src="/shapes/foo.svg">` for triangle/polygon/star/arrow/line** | Mirrors the validated v2.9 `renderDecorativeOverlay` pattern; sidesteps Satori's documented partial inline-SVG support; both renderers consume the same path |
| Arrows / connectors | **Pre-baked SVG asset library + parameterized renderer (NO third-party lib)** | `react-xarrows` no longer maintained; `perfect-arrows` returns coords only — we'd hand-roll the SVG anyway; matches our existing decorative arrow-up/down/left/right assets in `public/overlays/` |
| Color picker | **`react-colorful@^5.6.1`** (NEW) — `HexColorPicker` + `HexColorInput` with alpha | 2.8KB gzipped, 13× lighter than react-color; tree-shakeable; hooks-only; zero deps; integrates trivially with brand-kit palette swatches above the picker |

**Net new dependencies:** 3 (`@tanstack/react-virtual`, `@leeoniya/ufuzzy`, `react-colorful`) — combined ≤25KB gzipped impact on the editor route.

**Net new asset directory:** `public/shapes/` — pre-baked SVG primitives (analogous to `public/overlays/` shipped in v2.9 Phase 56).

**No new lucide install** — already at `^0.577.0`; v2.12 first phase upgrades to `^1.14.0`.

---

## Recommended Stack

### Core Technologies — NEW for v2.12

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `lucide-react` | `^1.14.0` (upgrade from current `0.577.0`) | Icon library — 1,700+ icons | Already in tree, React 19 peerDep declared (`^16.5.1 \|\| ^17 \|\| ^18 \|\| ^19`), v1 dropped UMD = 32.3% size reduction, breaking change is brand-icon removal (Github/Slack/Figma/etc) which we don't depend on. Used for the picker grid AND for renderer output. |
| `@tanstack/react-virtual` | `^3.13.24` | Virtualized 4-column grid for the icon picker (1,700 icons, infinite scroll feel) | Headless (no DOM assumptions) → jsdom-testable in vitest. First-class grid + bidirectional virtualization. Same maintenance team as `@tanstack/react-table` we already mentally model. ~9KB gzipped. |
| `@leeoniya/ufuzzy` | `^1.0.19` | Fuzzy search over icon name + tags (~8-10k token corpus) | 7.6KB minified. Benchmark: 434ms across 162k items vs Fuse 33,875ms (78×). Zero index build. Memory: 28MB peak vs Fuse 245MB. Matches our "type-as-you-search" UX. |
| `react-colorful` | `^5.6.1` | Hex + alpha color picker for fill/stroke/shadow | 2.8KB gzipped (13× smaller than react-color). Tree-shakeable; only `HexColorPicker` + `HexAlphaColorPicker` + `HexColorInput` enter bundle. Hooks-only, zero deps, accessible. |

### Existing Stack — UNCHANGED (no re-research)

Already validated at v2.11; the v2.12 milestone re-uses these without modification:

| Technology | Existing version | Role in v2.12 |
|------------|------------------|---------------|
| `next@15.5.13` | — | App Router, `/api/render`, edge-friendly Satori |
| `react@19.1.0` | — | All editor + preview surfaces |
| `satori` (via `next/og` resp. `@vercel/og` import path) | per next/og | PNG export — TPLREND-05 invariant |
| `react-rnd@^10.5.3` | — | Decoration drag/resize wrapper (peer of text_boxes / custom_images / watermark) |
| `selecto@1.26.3` | — | Marquee selection — decorations are first-class peers |
| `tinykeys@3.0.0` | — | Keyboard firewall for picker shortcuts (Esc / arrows / Enter) |
| `@dnd-kit/core@^6.3.1` | — | Already in tree if we ever lift the layers panel — NOT used in picker; arrow-key nav is hand-rolled per `tanstack/virtual` docs |
| `vitest@^4.1.0` + `jsdom@^29` | — | Picker tests run in jsdom; tanstack/virtual works there |
| `node-vibrant@^4.0.4` | — | Already extracts `derived_palette[]` per slide; brand-kit palette in color picker reuses this exact array |

### Supporting Libraries / Patterns

| Pattern | Implementation | When |
|---------|----------------|------|
| **Pre-baked shape SVGs** | Add `public/shapes/{rect,circle,triangle,line,ellipse,arrow-tip,polygon-5,polygon-6,star-5,star-6,...}.svg` mirroring v2.9 `public/overlays/` pattern | Triangle, polygon, star, arrow, line — anything that needs SVG-path geometry. Decoration carries `kind: 'shape'` + `shape: 'triangle' \| ...` + style params (fill/stroke/etc). Renderer maps `shape` → asset path. |
| **CSS-styled `<div>`** | Inline styles only — `borderRadius: '50%'` for circle, `borderRadius: 0` for rect, `transform: rotate(...)` etc. | Rect, circle, ellipse — any shape expressible as a styled `<div>` with width/height/borderRadius/border. Stroke = CSS border. Shadow = CSS boxShadow. Both renderers (Satori + React preview) emit IDENTICAL inline-styled div. |
| **Decoration asset registry** | New file `src/lib/render/decorations/registry.ts` mirroring `src/lib/render/templates/decorative.ts` from v2.9 — closed enum of allowed shape ids + intrinsic dimensions | Picker enumeration (typed), validator (runtime safety), renderer dispatch |
| **Shape renderer helper** | New `renderDecoration(decoration, origin?)` exported from `src/lib/render/resolve-overlay.ts` — same module that already exports `renderDecorativeOverlay` / `renderGrain` / `renderVignette` | TPLREND-05 invariant: BOTH renderers (`render-slide-satori.tsx` + `slide-preview.tsx`) consume the helper from this single module |
| **Lucide icon as an `<img src="data:image/svg+xml,...">`** in Satori | At Satori render time, server-side: import the icon's SVG component → `renderToStaticMarkup` → URL-encode → emit as `<img src="data:image/svg+xml,...">`. In React preview: render the lucide-react component directly. | This is the ONLY Satori-safe way to render lucide icons — Satori's inline-SVG handler (`#86`/PR #98) embeds via the same data-URI mechanism, but doing it explicitly in our code keeps the path predictable and the parity test deterministic. |

### Development Tools (no new tooling)

| Tool | Purpose | Notes |
|------|---------|-------|
| `vitest@4.x` | Picker virtualization tests + parity fingerprint | tanstack/virtual exposes `useVirtualizer` which works under jsdom (no `IntersectionObserver` polyfill needed at default config; only `Element.prototype.getBoundingClientRect` mocking, which jsdom 29 ships) |
| `@testing-library/react@^16.3.2` | User-event keyboard tests on picker | Already installed; arrow-key + Enter + Esc tests use `fireEvent.keyDown` on container |
| `tsx` | Pre-bake any procedurally generated star/polygon SVG via `scripts/build-shapes.ts` | Mirrors v2.9 `scripts/build-textures.ts` shipped in Phase 56 |

---

## Installation

```bash
# Upgrade existing
npm install lucide-react@^1.14.0

# Net new
npm install @tanstack/react-virtual@^3.13.24 @leeoniya/ufuzzy@^1.0.19 react-colorful@^5.6.1
```

No dev dep additions. No peerDep conflicts (all four declare React 19 support; `react-colorful` peers React 16+).

Estimated total bundle delta on the editor route after tree-shaking:
- `@tanstack/react-virtual`: ~9KB gzipped
- `@leeoniya/ufuzzy`: ~3KB gzipped (7.6KB minified)
- `react-colorful` (HexColorPicker + Alpha + HexColorInput): ~3KB gzipped
- `lucide-react` upgrade: NEGATIVE delta — v1 dropped UMD for 32.3% size reduction

**Net editor bundle impact: ≤15KB gzipped.** Picker route may dynamically `import()` the `@tanstack/react-virtual` chunk if we want to keep slide-list / dashboard untouched, but at <10KB it's not worth the route-split complexity.

---

## Alternatives Considered

| Recommended | Alternative | When the Alternative Would Be Better |
|-------------|-------------|--------------------------------------|
| `@tanstack/react-virtual` | `react-window@2.x` (FixedSizeGrid) | If we needed the simplest possible API with no measurement and we never planned variable-size items. react-window is ~2KB smaller but has historically NOT had a clean infinite-loader story (needs `react-window-infinite-loader`); maintainer Brian Vaughn moved attention partly to the React core team. |
| `@tanstack/react-virtual` | `react-virtuoso` | If we wanted out-of-the-box infinite scroll + grouping. React-virtuoso is heavier (~25KB) and `VirtuosoGrid` does NOT ship keyboard navigation — you implement the same `scrollIntoView`-on-arrow-key pattern manually. With manual keyboard nav required either way, headless tanstack-virtual wins on size + testability. |
| `@leeoniya/ufuzzy` | `fuse.js@^7` | If we needed scored relevance ranking with weighted fields and complex query syntax (AND/OR/exact-match operators). Fuse is the better all-rounder for big SaaS search; for an icon picker over ~10k tokens it's massive overkill (33KB minified vs 7.6KB). |
| `@leeoniya/ufuzzy` | `minisearch` | If we were also doing prefix search + boolean queries against larger corpora (10k+ documents). For 1,700 icons, minisearch's index-build overhead is wasted ceremony. |
| `react-colorful` | `@uiw/react-color` | If we wanted Sketch / Material / Wheel picker variants ready-to-go. We only need hex + alpha — paying the bundle tax for picker variants we won't ship is wrong. |
| `react-colorful` | shadcn/ui's planned color primitive | shadcn does NOT yet ship a color picker primitive (verified — our existing `shadcn@4.0.8` has only Label, Switch, etc.). When/if it does we can revisit; for now react-colorful is the standard. |
| Direct named imports | `lucide-react/dynamic` `<DynamicIcon name="..." />` | Only if the picker MUST work for arbitrary user-supplied icon names from a CMS-style field. Our picker enumerates the closed set — direct named imports tree-shake perfectly. |
| Pre-baked SVGs in `public/shapes/` | Inline `<svg>` JSX rendered by Satori | If Satori had robust first-class `<svg>` support. PR #98 added inline-SVG support via internal data-URI conversion — but the README and `presets.ts` make zero mention of `<circle>`/`<rect>`/`<polygon>`/`<path>`/`<line>`/`<ellipse>`. Pre-baking is the deterministic, parity-safe path. |
| Hand-rolled arrow renderer | `react-xarrows` | If we needed connector lines BETWEEN existing components (e.g. flowchart edges). Maintainer marked the project unmaintained — better alternatives exist (react-flow), but react-flow is full-canvas overkill for single-arrow decorations. |
| Hand-rolled arrow renderer | `perfect-arrows` | If we wanted curved/perfect-arrow geometry. The library only returns coordinates — you still write the SVG yourself. For 5-10 arrow variants we ship as static SVGs and skip the runtime cost. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `konva` / `fabric.js` | Full canvas-based 2D engines. We have an HTML/CSS slide editor — replacing the rendering substrate is a category change with 6+ months of integration cost and wholesale loss of TPLREND-05 (canvas rendering does NOT match Satori SVG output byte-for-byte). v2.11 research already excluded these for the multi-element editor. | `react-rnd` (already in tree) for drag/resize; Satori for export; CSS-div / pre-baked SVG for shape geometry. |
| `react-konva` / `react-fabric` | Same fundamental issue as above; React wrappers don't change the substrate problem. | Same as above. |
| `react-xarrows` | Maintainer-flagged unmaintained. Drawing arrows BETWEEN existing component refs at runtime is also the wrong abstraction — our arrows are decorations with absolute positions, not connectors. | Pre-baked arrow SVG assets in `public/shapes/`; same model as v2.9 `arrow-up/-down/-left/-right.svg` already shipped. |
| `react-flow` (xyflow) | Diagram/graph framework. Tens of KB of unused infrastructure when all we need is "draw an arrow on a slide." | Pre-baked SVGs (see above). |
| `lucide-react/dynamic` `<DynamicIcon />` for the picker | Maintainer's own guidance: "dynamic imports are unnecessary and recommended against" except for unbounded CMS-style icon name fields. Build-time AND bundle-time hostile (every icon becomes a separate module). | Static index map: `import * as icons from 'lucide-react'` filtered to a closed enum, OR precompiled `Object.fromEntries(...)` map. The picker's grid renders icons by direct component reference. |
| Inline `<svg><circle/></svg>` JSX directly in Satori paths | Satori's inline-SVG support (PR #98) embeds via internal data-URI conversion — but the supported-elements list in `presets.ts` does NOT include `circle`/`rect`/`polygon`/`path`/`line`/`ellipse`. Behavior is observed to vary across Satori versions; the parity invariant TPLREND-05 cannot tolerate that uncertainty. | Pre-baked SVG asset → `<img src="/shapes/{id}.svg">` (proven path; mirrors all 14 v2.9 decorative overlays already shipping byte-identical between renderers). |
| `box-decoration-break: clone` for any new highlight surface | Already documented anti-pattern in `resolve-overlay.ts:134-138`. Satori does not support it; using it would create preview/export drift. | Full-width highlight (already the chosen path for `TextHighlightEffect`). |
| CSS `filter:` / `backdrop-filter:` / `mix-blend-mode:` for shape effects | Documented Pitfall #2 in `resolve-overlay.ts:391-395`. Silently dropped by Satori (vercel/satori#573 — blur filter doesn't render). | Bake the effect into the static SVG (e.g. inner-shadow as a `<filter>` defined inside the asset; renderer just pulls the `<img>`). For runtime-tunable shadows: `boxShadow` on the wrapping div (Satori supports this CSS prop; verified in `presets.ts`). |
| `react-window-infinite-loader` | Bridges the gap react-window doesn't natively cover; we're not picking react-window so this is moot. | tanstack/virtual handles infinite-scroll patterns natively via `onScrollEnd` + `count` prop. |
| New canvas paint primitive (Pixi, three.js, fabric) | Wrong abstraction layer; no PNG export parity with Satori; massive bundle. | DOM + CSS — same primitives as v2.11. |

---

## Stack Patterns by Variant

**If a decoration is `kind: 'icon'`:**
- Editor preview → render `<{lucideIcon} />` directly (lucide-react component)
- Satori PNG export → server-side: import the icon by name, `renderToStaticMarkup` to SVG string, emit as `<img src={"data:image/svg+xml," + encodeURIComponent(svg)}>` with `width/height` set explicitly (Satori needs intrinsic dims on `<img>` — verified, see `resolve-overlay.ts:464-467` ASSET_DIMENSIONS pattern)
- Stroke color → set via CSS `color` on the wrapper, lucide icons use `currentColor` for stroke (this is already how the React preview gets dynamic-colored icons; the data-URI variant must inline the resolved color into the SVG before encoding)
- Stroke width → lucide-react `strokeWidth` prop (default 2; range 0.5–3 per UI spec)

**If a decoration is `kind: 'shape'` with shape ∈ {rect, circle, ellipse}:**
- Both renderers → emit a styled `<div>` with: `width/height` from `decoration.size`, `borderRadius` (50% for circle, half-of-min-dim for ellipse, configurable for rect), `backgroundColor` from `fillColor`, `border: ${strokeWidth}px solid ${strokeColor}`, `boxShadow` from shadow params, `opacity` from opacity
- Same DOM shape across renderers → byte-identical Satori output

**If a decoration is `kind: 'shape'` with shape ∈ {triangle, line, polygon-N, star-N, arrow-N}:**
- Both renderers → emit `<img src="/shapes/{shape-id}.svg">` styled with absolute pos/size/opacity
- Pre-baked asset: ID-encoded variant (e.g. `triangle-equilateral`, `polygon-5`, `star-6`) — closed enum gates input
- Color tinting → SVG asset uses `fill="currentColor"` + `stroke="currentColor"`; renderer sets CSS `color` on `<img>` (NOT `<img>` directly — Satori reads `color` and uses it for SVG rendering when the asset uses currentColor — verified via the existing `sticky-note-accent.svg` tinting pattern in `resolve-overlay.ts:455-458`)
- For variable stroke width or fill that ISN'T color: pre-bake variants OR inline the SVG into the renderer module and let it accept fill/stroke props (acceptable since shape count is ≤30; lucide is the part with 1,700)

**If user picks fill = "none" (stroke-only shape):**
- For div-based shapes → `backgroundColor: 'transparent'`, keep `border` only
- For SVG-based shapes → ship two variants per shape: `triangle-fill.svg` + `triangle-outline.svg`, OR pre-bake a generic `triangle.svg` whose `fill` is parameterized via `currentColor` and let `color: transparent` zero the fill while a CSS `outline`-equivalent stroke comes from the same SVG's `stroke="currentColor"`. Recommend the two-variant approach — simpler, no Satori-specific quirks.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `lucide-react@^1.14.0` | `react@^16.5.1 \|\| ^17 \|\| ^18 \|\| ^19` (peerDep) | Verified `npm view`. v1.0.0 released 2026-03-23. |
| `lucide-react@^1.x` upgrade from `^0.577` | None for our codebase | Brand-icon removal is the only breaking change; we don't import any of: Chromium, Codepen, Codesandbox, Dribbble, Facebook, Figma, Framer, Github, Gitlab, Instagram, LinkedIn, Pocket, RailSymbol, Slack — verified with `grep` (none of these appear in `lucide-react` import sites). |
| `@tanstack/react-virtual@^3.13` | `react@^16.8 \|\| ^17 \|\| ^18 \|\| ^19` | Headless hooks; no DOM coupling that could break under React 19 StrictMode. |
| `@leeoniya/ufuzzy@^1.0.19` | Universal — no React peer | Plain JS class. Use it inside a `useMemo` keyed on the icon corpus (built once at module load). |
| `react-colorful@^5.6.1` | `react@^16.8 \|\| ^17 \|\| ^18 \|\| ^19` (declares 16.8+ for hooks) | Functional / hooks-only, no class internals — safe under React 19 + Concurrent Mode. |
| `node-vibrant@^4.0.4` (existing) | Used SERVER-only | Brand-kit palette source for color picker swatches; do NOT pull onto client bundle. |

---

## Integration Points (Where v2.12 Code Bolts Onto v2.11)

| New code | Bolts onto | Pattern reference |
|----------|------------|-------------------|
| `decorations[]` schema | `src/lib/types/slide.ts` (alongside `text_boxes` / `custom_images` / `watermark`) | Phase 60 watermark schema-lift pattern (additive, idempotent legacy bridge) |
| `Decoration` interface (`{ id, kind: 'icon'\|'shape', ...style, position, groupId?, locked?, hidden?, name? }`) | Same file; mirrors `TextBox` / `CustomImage` field shape for selection / lock / hide / group / layers | Phase 60 (WMARK-04) — Decoration peers Text/Image/Watermark in `Selection.ids[]` |
| `renderDecoration(decoration, ctx, origin?)` | `src/lib/render/resolve-overlay.ts` — single source of truth | Mirrors `renderDecorativeOverlay` (Phase 56), `renderGrain` (Phase 55), `renderVignette` (Phase 55) |
| Both renderers | `src/lib/render/render-slide-satori.tsx` (server) + `src/components/slides/slide-preview.tsx` (client) | Map `slide.decorations[].filter(d => !d.hidden).map(d => renderDecoration(d, ...))`. Single import; identical JSX output. |
| Editor right-rail decoration card | `src/components/editor/decoration-card.tsx` (NEW) | Mirrors `text-rail/ActiveTextBoxCard` (Phase 50) selection-driven shell. Shows fill, stroke (color + width), size, shadow, opacity for the active decoration. |
| Picker entry point | `src/components/editor/decoration-picker/` (NEW directory) | Two-tab modal: "Icons" (lucide grid) + "Shapes" (12-tile grid). Both tabs use tanstack/virtual + ufuzzy + tinykeys. |
| Picker integration into canvas | `src/components/editor/slide-canvas.tsx` — add a "+ Decoration" button alongside existing "+ Text" / "+ Image" affordances | Same dispatch pattern: `dispatch({ type: 'ADD_DECORATION', decoration: { ... } })`. |
| Reducer actions | `src/lib/editor/editor-reducer.ts` — new `ADD_DECORATION` / `UPDATE_DECORATION` / `REMOVE_DECORATION` actions, plus extending `BULK_TRANSLATE` / `Z_ORDER` / `DUPLICATE_ELEMENTS_AT` to include decorations in their per-scope branches | Phase 60 + Phase 64 + Phase 66 reducer extension pattern |
| Selection / multi-select | `src/lib/editor/selection.ts` — extend `Selection.ids[]` resolution to walk `slide.decorations[]` alongside text_boxes / custom_images / watermark | Phase 60 (WMARK-04) flat-id pattern |
| Layers panel | `src/components/editor/layers-panel/` — register a new `LayerKind: 'decoration'` row variant | Phase 65 LAYERS-04 |
| Brand-kit palette in color picker | `react-colorful`'s `<HexColorInput>` lives BELOW a strip of `<button>` swatches sourced from `brandKit.colors[]` + `slide.style_overrides.derived_palette[]` | Reuse the existing v2.9 `derived_palette[]` field — already on every slide. No new extraction. |
| Gemini AI emit | `src/lib/ai/generate-slides.ts` schema → emit `decorations[]` per slide; advisory monoculture gate (e.g. ≥60% slides emit identical icon) | Phase 58 advisory-gate pattern (`hookOpeningTrigram`); Phase 51 light-touch JSON-schema-extension pattern |

---

## Testing Strategy (No New Tooling)

Picker virtualization tests run under `vitest@4` + `jsdom@29`:

- **`tanstack/virtual` under jsdom:** Works without polyfills — `useVirtualizer` reads `getBoundingClientRect()` (jsdom 29 returns zeros, so the test sets `--row-count` via `count` prop and asserts visible row count via `virtualRows.length`).
- **`ufuzzy` under jsdom:** Pure JS, no DOM — runs everywhere.
- **`lucide-react` under jsdom:** Renders SVG; jsdom 29 supports SVG element creation. `@testing-library/react` renders icons fine.
- **`react-colorful` under jsdom:** Functional; pointer events fire via `fireEvent`. Hue / saturation drag tests use mocked `pointerdown`+`pointermove`+`pointerup`.

PARITY tests (TPLREND-05 invariant — extending the v2.11 Phase 65 audit suite):
- New `parity.decorations.test.tsx` snapshots — for each `kind: 'icon'` and each shape variant, assert `buildSlideElement(slide, ...)` (Satori path) and `<SlidePreview slide={...} />` (React preview) emit byte-identical inline-styled JSX trees.
- Extend `no-css-filter.test.ts` to grep `decorations` JSX paths.
- Extend `no-z-index.test.ts` to assert decoration DOM order respects array order (Satori has no z-index).

---

## Sources

**Primary (HIGH confidence):**
- `npm view lucide-react versions` — verified `1.14.0` is latest, `0.577.0` exists (our current); v1.0.0 released 2026-03-23
- `npm view lucide-react@1.14.0 peerDependencies` — verified React 19 support: `^16.5.1 || ^17 || ^18 || ^19`
- `npm view @tanstack/react-virtual version` — `3.13.24`
- `npm view @leeoniya/ufuzzy version` — `1.0.19`
- `npm view react-colorful version` — `5.6.1` (latest stable)
- `npm view satori version` — `0.26.0` (verified — used by next/og)
- [Satori README — supported HTML/CSS](https://github.com/vercel/satori/blob/main/README.md) — explicitly lists allowed elements; SVG shape elements absent
- [Satori presets.ts](https://github.com/vercel/satori/blob/main/src/handler/presets.ts) — fetched & verified: NO svg/circle/rect/polygon/path/line/ellipse presets
- [Satori issue #573 — CSS filter unsupported with resvg](https://github.com/vercel/satori/issues/573) — verified the existing v2.9 anti-pattern callouts
- [Satori PR #98 — `<svg>` element support](https://github.com/vercel/satori/pull/98) — embeds via data URI; explicitly throws on `<text>` inside SVG
- [Lucide v1 release / migration guide](https://lucide.dev/guide/version-1) — brand-icon removal is the only breaking change relevant to us
- [Lucide React migration v0→v1](https://lucide.dev/guide/react/migration) — confirmed brand-icon removal scope
- [Lucide DynamicIcon docs](https://lucide.dev/guide/react/advanced/dynamic-icon-component) — maintainer's own "recommended against" guidance for typical apps
- [Lucide discussion #2451 — how dynamic imports actually work](https://github.com/lucide-icons/lucide/discussions/2451) — every icon becomes a separate module
- Existing codebase verification: `src/lib/render/resolve-overlay.ts:432-505` (decorative renderer pattern); `public/overlays/*.svg` (proven asset pattern); `package.json` (version pins); `src/lib/render/render-slide-satori.tsx:374-448` (overlay render integration point)

**Secondary (MEDIUM confidence — multi-source corroborated):**
- [uFuzzy npm package + benchmark](https://www.npmjs.com/package/@leeoniya/ufuzzy) — 7.6KB minified; 78× faster than Fuse on 162k items
- [react-colorful README](https://github.com/omgovich/react-colorful) — 2.8KB gzipped, hooks-only
- [DEV / Borstch / LogRocket virtualization comparisons](https://blog.logrocket.com/react-virtualized-vs-react-window/) — tanstack-virtual vs react-window vs react-virtuoso 2024-2025 comparisons
- [Raul Carini's lucide icon-picker blog](https://www.raulcarini.dev/blog/icon-picker) — concrete pattern reference (uses tanstack-virtual)

**Tertiary (LOW confidence — single source, treated as advisory):**
- WebSearch results on react-window v2 status (Brian Vaughn moved to React core team; CHANGELOG accessible but specific v2.x date not tightly verified)
- WebSearch results on react-xarrows maintenance status (one source notes maintainer recommends react-flow alternative)

---

*Stack research for: v2.12 Shapes & Icons (Decoration Primitives)*
*Researched: 2026-05-03*
*Net new deps: `@tanstack/react-virtual`, `@leeoniya/ufuzzy`, `react-colorful`. Upgrade: `lucide-react` 0.577 → 1.14.*

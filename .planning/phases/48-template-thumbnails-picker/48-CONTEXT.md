# Phase 48: Template Thumbnails & Picker - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch table)

<domain>
## Phase Boundary

Phase 48 ships:
1. A one-off thumbnail-generation script (`scripts/generate-template-thumbnails.ts`) that renders all 8 templates' `sample` data through Satori → resvg-wasm → PNG, writing to `public/templates/<id>.png`. Runs via `npm run thumbs`. Idempotent.
2. A picker DOM-signature test that pins TPLTHUMB-02 (no swatches, all 8 templates render via `<SlidePreview>` + `sample` data).

The picker UI itself does NOT need refactoring — Phase 45/46 already wired all templates through `<SlidePreview>` + `makeSampleSlide(template)`. TPLTHUMB-02 is functionally satisfied; this phase locks it with a regression test and ships PNGs for the `template.thumbnail` paths that exist on each template config.

What is in scope:
- New file `scripts/generate-template-thumbnails.ts` reusing Satori + resvg-wasm pipeline
- New `npm run thumbs` script entry in `package.json`
- 8 PNG files in `public/templates/<id>.png` (5 legacy + 3 new)
- New test `src/__tests__/components/template-picker.test.tsx` asserting all 8 templates render via SlidePreview, no swatch fallbacks, layout has 8+1 tiles (8 templates + brand-kit tile)

What is NOT in scope:
- Picker UI refactoring (already correct from Phase 45/46)
- Picker performance work (current SlidePreview tile rendering is fast enough)
- Wiring the `template.thumbnail` field into a fallback consumer (deferred — picker uses live SlidePreview, not stale PNGs)
- Editing template TS files (their `thumbnail: '/templates/<id>.png'` paths are correct after this phase)
- Generating thumbnails for the brand-kit synthesized template (synthesized at runtime per user)
- /explore card og:image / share previews (future enhancement — out of scope)

</domain>

<decisions>
## Implementation Decisions

### Thumbnail PNG Generation Strategy (Area 1) — TPLTHUMB-01
- **Generation method:** One-off script `scripts/generate-template-thumbnails.ts`. NOT a build-time hook. NOT a vitest test. Runs on-demand via `npm run thumbs`.
- **Tooling:** Plain TypeScript file invoked via `tsx scripts/generate-template-thumbnails.ts` (tsx is already a project dev dep — verify).
- **Templates covered:** All 8 (5 legacy + 3 new). Existing 5 paths (`/templates/highlight-bar.png`, `/templates/news-drop.png`, etc.) are referenced but the PNG files don't currently exist — this script creates the missing baseline.
- **Pipeline:** Reuses existing `buildSlideElement` from `src/lib/render/render-slide-satori.tsx`. For each template:
  1. Build a sample slide via `makeSampleSlide(template)` (extract this helper or duplicate from `template-picker.tsx`)
  2. Call `buildSlideElement(slide, template, null, null, undefined, ctx)` with `ctx = { slideIndex: 0, totalSlides: 1, topic: undefined }`
  3. Render via Satori → SVG, then resvg-wasm → PNG (same chain as `/api/render`)
  4. Write to `public/templates/${template.id}.png`
- **Font loading:** Reuses existing `loadFont()` helper. Anton + Inter must load before Satori call. Async startup.
- **Output:** 8 PNGs at `public/templates/<id>.png`. Each 1080×1920 (the existing canvas size).
- **NPM script:** Add `"thumbs": "tsx scripts/generate-template-thumbnails.ts"` to `package.json` scripts. Idempotent — overwrites existing PNGs.
- **Logging:** Console output: `[thumbs] Generated public/templates/<id>.png` per template. Final summary: `[thumbs] Wrote 8 PNGs to public/templates/`.

### Picker Consistency & Verification (Area 2) — TPLTHUMB-02
- **Picker UI is unchanged** — existing `src/components/slides/template-picker.tsx` lines 119-158 already iterate `templates.map((template) => <SlidePreview slide={makeSampleSlide(template)} ...>)`. Phase 48 confirms this with a regression test.
- **Verification test:** New `src/__tests__/components/template-picker.test.tsx`:
  - Mock `BrandKit` (configured + unconfigured cases)
  - Render `<TemplatePicker selectedId="bold-yellow" onSelect={vi.fn()} brandKit={null} />`
  - Assert: exactly 8 SlidePreview components are rendered for the templates list (use `getAllByTestId('slide-preview-root')`, filter to non-brand-kit ones)
  - Assert: when brandKit is null/empty, the brand-kit tile shows the empty state (not a SlidePreview)
  - Assert: when brandKit is configured, the brand-kit tile DOES render a SlidePreview (9 total previews)
  - Assert: NO fallback to swatches/text-only labels — every iteration renders a SlidePreview
- **`thumbnail` field retained:** Even though Phase 48 won't wire the picker to consume `template.thumbnail`, the field has 8 valid PNG paths after script runs. Future consumers (og:image, share previews) can use it.
- **Layout regression:** Test assertion that the picker container has 9 tile children (8 templates + 1 brand-kit tile) when `brandKit` is configured. Pins layout against future regressions.

### Claude's Discretion
- Whether to colocate `makeSampleSlide` into a shared helper (e.g., `src/lib/render/sample-slide.ts`) so both the picker and the thumbnail script use the same builder. Recommend yes for testability.
- Whether to expose the script's output paths as a returned array for testability, or rely on filesystem assertions. Recommend filesystem checks via `existsSync` after run.
- Whether to add a basic `--dry-run` flag to the script for CI. Optional — script is fast (~5s for 8 PNGs) so unlikely needed.
- Whether to include the brand-kit synthesized template in the script. Recommend NO — synthesized at runtime per user; no useful static PNG.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/slides/template-picker.tsx` (161 lines) — already correct for TPLTHUMB-02. The map at line 119 renders `<SlidePreview>` for every template. `makeSampleSlide(template)` (line 31) is the exact builder Phase 48 needs.
- `src/lib/render/render-slide-satori.tsx` — `buildSlideElement(slide, template, brandKit?, tier?, origin?, ctx?)`. Phase 48 calls it directly from the script with no brandKit/tier/origin/forced-watermark.
- `src/lib/render/load-font.ts` — existing font loader. Phase 48 awaits Anton + Inter at script start.
- `/api/render/route.ts` — production Satori → resvg pipeline. Phase 48 mirrors the rasterization approach (Satori SVG output piped to resvg-wasm).
- `tsx` — already installed (used by other scripts).
- Phase 45 `<SlidePreview>` already uses `data-testid="slide-preview-root"` — needed for the picker test.

### Established Patterns
- Scripts under `scripts/` (if exists) or top-level. Existing scripts are limited; Phase 48 may create the `scripts/` directory.
- Test files live under `src/__tests__/components/`. Existing pattern uses `@testing-library/react` + `render()` + jsdom.
- npm script entries follow `"<verb>": "<command>"` pattern in package.json `scripts` section.
- Satori font loading is async — script must await before invoking `buildSlideElement`.

### Integration Points
- `template.thumbnail: '/templates/<id>.png'` paths exist on all 8 templates (Phase 46 added them for the 3 new templates; existing 5 also reference these paths).
- `public/templates/` directory does NOT currently exist on disk — script must create it (`fs.mkdirSync(..., { recursive: true })`).
- Phase 48 does NOT touch any rendering code — pure additive (script + test).

</code_context>

<specifics>
## Specific Ideas

- The thumbnail script is dev-only — not run on Vercel build. Generated PNGs are committed to the repo and served as static assets from `public/`.
- The picker currently shows the brand-kit tile in slot 0 when configured (or an empty-state link when not). Templates render starting in slot 1+. The DOM-signature test must account for both branches.
- The legacy 5 templates (`highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`) reference `/templates/<id>.png` paths that have been broken since v1. Phase 48 finally generates them — but no code currently reads `template.thumbnail`, so the "fix" is forward-looking.
- Existing test infra: Vitest 4.1, @testing-library/react 16, jsdom 29 — sufficient for the picker DOM test.
- Script runtime estimate: ~5s for 8 PNGs (Satori is fast; resvg-wasm is the bottleneck at ~500ms per PNG).

</specifics>

<deferred>
## Deferred Ideas

- Build-time auto-regeneration of thumbnails on template changes (would slow dev iteration; manual `npm run thumbs` is sufficient).
- og:image / share-card generation pipeline using `template.thumbnail` (future enhancement — v2.8+).
- Picker virtualization for >20 templates (not needed at 8; reconsider when premium tier expands).
- Brand-kit thumbnail caching per-user (out of scope; brand kit is rendered live in picker).
- Visual regression / playwright pixel-diff for the picker (deferred per Phase 45 decision).

</deferred>

# Phase 46: Premium Template Authoring - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous batch table)

<domain>
## Phase Boundary

Author 3 new premium templates (`magazine-bold`, `tr3nding-news`, `documentary`) as plain TS modules in `src/lib/render/templates/`, populate them with sample data so the template picker renders real mini-previews, register them in `src/lib/render/templates/index.ts`, and add a regression snapshot test that proves the 5 existing templates render byte-identical to the v2.6 baseline. The Phase 44 schema and Phase 45 renderer are CONSUMED — no schema or renderer changes in this phase.

What is in scope:
- 3 new template TS modules: `src/lib/render/templates/magazine-bold.ts`, `tr3nding-news.ts`, `documentary.ts`
- Update `src/lib/render/templates/index.ts` to import + register the 3 new templates (appended AFTER the existing 5)
- Sample data populated on each new template so `<SlidePreview>` renders real mini-previews
- Regression snapshot test for the 5 existing templates (additive — does not modify Phase 45 tests)
- Snapshot tests for the 3 new templates exercised through Satori `buildSlideElement`
- DOM signature tests for the 3 new templates rendered through `<SlidePreview>` (parity gate)
- Phase 44 validator (`validateTemplateRegistry`) must pass at module load — any overlay misconfig fails the build

What is NOT in scope:
- Schema changes (Phase 44 is locked)
- Renderer changes (Phase 45 is locked — magazine-bold proves Phase 45 works end-to-end)
- AI prompt changes (Phase 47)
- Template thumbnail PNG generation (Phase 48 — Phase 46 ships `thumbnail: '/templates/<id>.png'` paths only)
- Template picker UI changes (Phase 48)
- Editing or removing the 5 existing templates (`highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`)

</domain>

<decisions>
## Implementation Decisions

### magazine-bold (Murphy Reference) — Area 1
- **Mint accent hex:** `#A8E0B0` (soft sage-mint pulled from Murphy reference image, used for highlight pills AND topic chip background)
- **Fonts:** `'Anton', sans-serif` for hook (already loaded for news-drop, condensed display), `'Inter', sans-serif` for body. NO new font loads.
- **Sizes (bottom-card mode):** `hookFontSize: '72px'` (smaller than news-drop 110px because card has padding 80px), `bodyFontSize: '32px'`. `hookStyle: 'uppercase'`.
- **Background:** `backgroundColor: '#000000'` (the bottom card uses this with alpha 0.85 per Phase 45 `bottomCardBackground`), `backgroundMode: 'image-with-bottom-card'`, `overlayColor: '#000000'`, `overlayOpacity: 0.15` (subtle tint over photo for B&W contrast control).
- **textColor:** `'#ffffff'` (white text on dark card).
- **textAlign:** `'left'`. **textPosition:** `'bottom'` (irrelevant for card mode but kept for fallback).
- **accentColor:** `'#A8E0B0'` (mint).
- **Overlays (3):**
  1. `top-left` chip: `content: { type: 'slide-field', field: 'topic' }`, style `{ background: '#A8E0B0', color: '#000000', padding: '8px 16px', borderRadius: '4px', fontSize: '28px', fontWeight: 700, textTransform: 'uppercase' }`.
  2. `top-right` page-counter: `content: { type: 'page-counter' }`, style `{ background: 'rgba(0,0,0,0.6)', color: '#ffffff', padding: '8px 16px', borderRadius: '4px', fontSize: '28px', fontWeight: 700 }`.
  3. Bottom card is implicit via `backgroundMode: 'image-with-bottom-card'` — Phase 45 renders it; no explicit overlay needed.

### tr3nding-news — Area 2
- **Mid-pill default content:** `'TR3NDING'` literal — matches Murphy slide-1 reference. Configurable via overlay `content.text` for future variants (`'BREAKING'`, `'EXCLUSIVE'`, `'HOT TAKE'`).
- **Background mode:** `backgroundMode: 'image-with-bottom-card'` (same composition as magazine-bold for cohesion).
- **Accent + fonts:** Mint `#A8E0B0` (matches magazine-bold for premium-tier visual cohesion), `'Anton', sans-serif` hook + `'Inter', sans-serif` body.
- **Sizes:** Same as magazine-bold (`hookFontSize: '72px'`, `bodyFontSize: '32px'`).
- **Mid-pill styling:** `{ background: '#000000', color: '#A8E0B0', padding: '12px 24px', borderRadius: '40px', fontSize: '28px', fontWeight: 700, textTransform: 'uppercase' }`. Position `mid` slot.
- **Overlays (3):**
  1. `top-right` page-counter (same shape as magazine-bold for consistency).
  2. `mid` pill: `content: { type: 'literal', text: 'TR3NDING' }` with the styling above.
  3. Bottom card implicit via `backgroundMode`.
- **NO top-left topic chip** — the mid-pill is the visual identity here.

### documentary — Area 3
- **Background:** `backgroundMode: 'image-bleed'` (NO bottom card — minimal/photo-forward). Tonal control via `overlayColor: '#000000'` + `overlayOpacity: 0.35` (mid-strength tint for legibility on bright photos).
- **Bottom-darken gradient:** Rendered via a `free`-slot overlay zone:
  - `position: 'free'`
  - `offset: { x: 0, y: 1340 }`
  - `content: { type: 'literal', text: '' }` (empty — the overlay div IS the gradient surface)
  - `style: { width: '1080px', height: '580px', background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))' }`
  - DOM order: this gradient sits BELOW hook/body in the overlays loop (overlays render before hook per Phase 45 layer stack), so hook/body remain on top. Empty literal is fine — `resolveOverlayContent` returns `''` and the renderer still emits the styled div.
- **Fonts + sizing:** `'Inter', sans-serif` for both (sans-serif minimal). `hookFontSize: '56px'` (smaller — story-led), `bodyFontSize: '32px'` (matches premium tier — body sizes consolidated to 32px across all 3 templates). `hookStyle: 'normal'` (NOT uppercase — minimal voice). `textColor: '#ffffff'`. `textAlign: 'left'`. `textPosition: 'bottom'` (text sits in the gradient-darkened zone).
- **accentColor:** `'#ffffff'` (no accent pill — minimal).
- **Overlays (2):**
  1. `top-right` page-counter — ghosted styling: `{ color: '#ffffff', opacity: 0.7, fontSize: '28px', fontWeight: 400, padding: '0', background: 'transparent' }` (size matches premium tier, ghosted via opacity).
  2. The `free`-slot gradient described above.
- **NO top-left chip, NO mid-pill, NO highlight pills on segments** — minimal aesthetic locks this.

### Sample Data + Registration + Regression — Area 4
- **magazine-bold sample:**
  - `hook_text: 'FOLK SINGER FIGHTS BACK AFTER AI CLONED HER VOICE'`
  - `body_text: 'Murphy Campbell, a folk singer from Western North Carolina, sues OpenAI for copyright theft.'`
  - `hook_segments: [{text: 'FOLK SINGER'}, {text: 'FIGHTS BACK', highlightColor: '#A8E0B0', highlightStyle: 'pill'}, {text: 'AFTER AI'}, {text: 'CLONED HER VOICE', highlightColor: '#A8E0B0', highlightStyle: 'pill'}]`
- **tr3nding-news sample:**
  - `hook_text: 'STARTUP RAISES $50M IN 12 MINUTES'`
  - `body_text: 'AI infrastructure boom drives record-breaking seed round.'`
  - `hook_segments: [{text: 'STARTUP RAISES'}, {text: '$50M', highlightColor: '#A8E0B0', highlightStyle: 'pill'}, {text: 'IN'}, {text: '12 MINUTES', highlightColor: '#A8E0B0', highlightStyle: 'pill'}]`
- **documentary sample:**
  - `hook_text: 'The Last Glassblower of Murano'`
  - `body_text: 'How four centuries of craft survive in a digital age.'`
  - NO `hook_segments` (minimal aesthetic — segments break the unified-text feel).
- **Registry order:** Append the 3 new templates AFTER the existing 5 in `templates: SlideTemplate[]`:
  ```ts
  export const templates: SlideTemplate[] = [
    highlightBar,
    newsDrop,
    newsCyan,
    y2kPop,
    boldYellow,
    magazineBold,    // new — Phase 46
    tr3ndingNews,    // new — Phase 46
    documentary,     // new — Phase 46
  ]
  ```
  This preserves `getTemplate()` fallback (highlight-bar stays first).
- **Regression strategy:** Add a NEW snapshot test file `src/__tests__/render/legacy-templates-regression.test.tsx` that snapshots all 5 existing templates' Satori output with a fixed `Slide` fixture. Test fails loud if ANY byte changes. Phase 45's existing snapshot tests stay untouched.
- **Thumbnails:** Each new template ships `thumbnail: '/templates/<id>.png'` path string. The PNGs are NOT generated in Phase 46 — Phase 48 owns thumbnail generation. Picker uses `sample`-driven mini-previews (Phase 45 capability) so thumbnails are decorative until Phase 48.
- **Phase 44 validator runs at module load** — any misconfig in the 3 new overlay declarations fails `npm run build` immediately. Plan tasks must verify the build still passes after registration.

### Claude's Discretion
- Exact field ordering inside each new template config (recommend matching the order in existing templates for diff readability).
- Whether to colocate the regression snapshot fixture data inline in the test file or extract to a `fixtures.ts` helper (recommend inline for now — only 5 fixtures).
- Test file location for new template snapshots — likely add to `src/__tests__/render/render-slide-satori.test.tsx` or new `premium-templates.test.tsx`.
- Whether the `documentary` gradient `free`-slot overlay should be the FIRST or LAST overlay in the array — last keeps DOM order with text-on-top, first keeps the gradient as a "background-like" first layer. Recommend last for explicit DOM-order intent.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/render/templates/news-drop.ts` (37 lines) — closest analog: bold display headline + accent color + sample data. magazine-bold and tr3nding-news copy this skeleton then add `overlays` + `backgroundMode`.
- `src/lib/render/templates/highlight-bar.ts` (24 lines) — minimal example showing required fields without overlays.
- `src/lib/render/templates/index.ts` — registry array; Phase 44 validator runs at module load (line 86: `validateTemplateRegistry(templates)`).
- Phase 45 `src/lib/render/resolve-overlay.ts` — provides `SLOT_GEOMETRY`, `resolveOverlayContent`, `renderSegments`, `bottomCardBackground`. Templates author against this surface.
- Phase 45 `<SlidePreview>` and `buildSlideElement` consume `template.overlays` + `template.backgroundMode` automatically — no renderer changes needed for new templates to render.
- Phase 44 `validateTemplateRegistry` (`src/lib/render/templates/validate.ts`) — fails fast on slot/slide-field/page-counter/duplicate-slot misconfig with actionable error messages.
- Existing Satori snapshot test at `src/__tests__/render/render-slide-satori.test.tsx` — pattern for new template snapshot test.
- Existing DOM signature test at `src/__tests__/components/slide-preview-overlays.test.tsx` — pattern for new template parity test.

### Established Patterns
- Templates are plain TS modules under `src/lib/render/templates/<id>.ts` exporting a `SlideTemplate` constant.
- Sample data uses `hook_text` (string), `body_text` (string), optional `hook_segments` (TextSegment[]) following the schema in `src/lib/types/slide.ts`.
- Anton + Inter fonts already loaded — no `loadFont` changes needed.
- Snapshot tests use `expect(element).toMatchSnapshot('label')` after `buildSlideElement(slide, template, brandKit, tier, origin, ctx)`.
- DOM signature tests use `@testing-library/react` `render()` then assert on `data-testid` and DOM structure.

### Integration Points
- Picker UI (`src/components/slides/template-picker.tsx`) iterates `templates` array and renders mini-previews via `<SlidePreview>`. New templates appear automatically after registration.
- `getTemplate(id)` fallback unchanged (highlight-bar remains the array head).
- AI prompt context (Phase 47) reads template metadata (id, name, accentColor) — Phase 47 will reference `magazine-bold`, `tr3nding-news`, `documentary` by id.
- Thumbnail PNG generation (Phase 48) will read `template.sample` and pre-render via existing Satori pipeline.

</code_context>

<specifics>
## Specific Ideas

- Murphy reference `/Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_1.png` and `_slide_2.png` are the visual ground truth for `magazine-bold`. Phase 46 must render slide 1 visually similar (B&W full-bleed photo, mint TR3NDING-style chip top-left displaying topic, page counter top-right with dark pill, bottom semi-opaque black card with bold all-caps headline + mint pill highlights on key spans).
- Mint hex `#A8E0B0` chosen as a unifying premium-tier accent — magazine-bold and tr3nding-news both use it. Documentary deliberately omits accent (minimal voice).
- Sample copy uses real story-shaped content, not lorem ipsum — picker preview should look like a real slide.
- `documentary` gradient via `free`-slot overlay is the first non-trivial use of the `free` slot in v2.7. Validates the schema's flexibility without requiring schema extension.

</specifics>

<deferred>
## Deferred Ideas

- More premium templates (5-10 additional) — captured in REQUIREMENTS.md as TPLNEW-FUTURE-01, owned by v2.8+.
- Per-template content-fit feedback loop (model generates → renderer measures overflow → model regenerates) — TPLAI-FUTURE-01, v2.8+.
- User-customizable overlay zones (drag-to-reposition chip in editor) — TPLNEW-FUTURE-02, v3.0+.
- Template marketplace / user-uploaded templates — out of scope (REQUIREMENTS.md, v3.0+).
- Animated templates / video output — out of scope (project pivot, locked to static carousels).
- Hand-drawn / illustrated templates — out of scope (separate art-direction pass).

</deferred>

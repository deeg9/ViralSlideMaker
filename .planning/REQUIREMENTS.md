# Milestone v2.7 Premium Templates — Requirements

**Goal:** Replace the current 5 visually weak templates with a richer template system + 3-4 new "magazine-style" premium templates that match modern viral creator aesthetics. Reference design: the Murphy Campbell folk-singer carousel.

**Reference designs:**
- `/Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_1.png` — B&W folk singer with banjo, "TR3NDING" pill, mint-highlighted headline "FOLK SINGER FIGHTS BACK AFTER AI CLONED HER VOICE AND STOLE HER COPYRIGHT", topic chip top-left, page counter "1/5" top-right
- `/Users/deeg/Downloads/MurphyFolkSinger/murphy_carousel_slide_2.png` — folk singer at microphone, body text "MURPHY CAMPBELL IS A FOLK SINGER FROM WESTERN NORTH CAROLINA…" with mint-highlighted spans on "FOLK SINGER" and "WESTERN NORTH CAROLINA"

## v2.7 Requirements

### Template Schema Extensions (TPLSCHEMA)

- [x] **TPLSCHEMA-01**: `SlideTemplate` type supports a structured `overlays` field declaring zero-to-many overlay components per template (top-left chip, top-right counter, mid pill, bottom card, etc.). Each overlay has a position, styling block, and content source.
- [x] **TPLSCHEMA-02**: Overlay content sources include literal text, dynamic page-counter (`{currentSlide}/{totalSlides}`), and slide-field references (e.g. `topic` from project metadata) so the same overlay reads the right data per slide context.
- [x] **TPLSCHEMA-03**: Templates can declare a `backgroundMode`: `'color'` (current behavior — flat fill), `'image-bleed'` (full-bleed photo, no overlay card), or `'image-with-bottom-card'` (full-bleed photo with semi-opaque text card at bottom).
- [x] **TPLSCHEMA-04**: `TextSegment` type extended with optional `highlightColor` and `highlightStyle` fields supporting per-word background highlight pills (the mint/teal pill behind "FIGHTS BACK", "CLONED HER VOICE" etc. in the reference design). Backwards compatible: existing segments without these fields render unchanged.
- [x] **TPLSCHEMA-05**: Template registry validation — startup-time check that every registered template's overlays declare valid positions and content sources, with a clear error message on misconfiguration.

### Renderer Composition (TPLREND)

- [x] **TPLREND-01**: Satori renderer (`src/lib/render/render-slide-satori.tsx`) composes overlay zones declared in a template's `overlays` field on top of the base layout, respecting position, padding, and z-order.
- [x] **TPLREND-02**: When `backgroundMode === 'image-bleed'` or `'image-with-bottom-card'`, photo background renders full-bleed beneath all overlays (currently flat color shows through any photo).
- [x] **TPLREND-03**: Page-counter overlay component (`{currentSlide}/{totalSlides}`) renders dynamically from slide index in both Satori and React preview paths; styles come from the template overlay declaration, not hardcoded.
- [x] **TPLREND-04**: Per-word highlight backgrounds render as pill backgrounds (rounded rect, color from `TextSegment.highlightColor`) behind the text, in both Satori PNG export and the live React preview.
- [x] **TPLREND-05**: Live React preview component (`src/components/slide/slide-preview.tsx`) matches Satori output for overlay zones, page counter, and highlight pills (no preview/export drift).

### Premium Template Authoring (TPLNEW)

- [x] **TPLNEW-01**: New template `magazine-bold` matches the Murphy reference design (B&W photo full-bleed, top-left topic chip, top-right page counter, bottom semi-opaque black card with bold all-caps copy + mint highlight pills on selected words). Registered in `src/lib/render/templates/`.
- [x] **TPLNEW-02**: New template `tr3nding-news` features a bold mid-card pill above the headline (matching the "TR3NDING" pill aesthetic from the reference) plus mint accent highlights. Mid-pill content is template-configurable so future variants can use other labels ("BREAKING", "EXCLUSIVE", etc.).
- [x] **TPLNEW-03**: New template `documentary` — full photo with subtle gradient darken at bottom + minimal sans-serif body copy, no decorative pills. Photo-forward, story-led aesthetic.
- [x] **TPLNEW-04**: All new premium templates have populated `sample` data so the template picker can render real mini-previews instead of synthetic swatches (matches existing pattern in `templates/index.ts:SlideTemplate.sample`).
- [x] **TPLNEW-05**: Existing 5 templates (`highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`) continue to work unchanged — additive milestone, no regressions on legacy template render paths.

### AI Prompt Tuning (TPLAI)

- [x] **TPLAI-01**: `generateCarousel` system/user prompts updated so generated content fits compact bottom-card layouts: hook ≤ 12 words, body ≤ 35 words, no orphans (no duplicate hook/body lines on the same slide).
- [x] **TPLAI-02**: Spelling and grammar quality gate — prompts explicitly require correct spelling; a spell-check pass on critical fields catches and retries on obvious typos like "MUSICAN" before persisting.
- [x] **TPLAI-03**: AI suggests `hook_segments` / `body_segments` with `highlightColor` set to the template's accent color, marking action verbs and proper nouns as highlighted (matches the reference's mint-pill emphasis pattern).
- [x] **TPLAI-04**: Template-aware generation: when the user picks a magazine-style template, the AI is given a one-line "voice note" prompt (e.g. "you are writing for a punchy news-style carousel") to nudge tone toward the template's aesthetic.

### Template Thumbnails (TPLTHUMB)

- [ ] **TPLTHUMB-01**: Each new premium template ships with a 9:16 PNG thumbnail at `public/templates/<id>.png` (consistent with existing template thumbnails) rendered from the template's `sample` data, so the template picker shows actual visual identity, not just a text label.
- [ ] **TPLTHUMB-02**: Template picker UI consistently uses the `sample`-driven mini-preview for all templates (no mix of swatches and previews).

## Future Requirements (deferred)

- **TPLNEW-FUTURE-01**: Additional premium templates (likely 5-10 more) following the same overlay-zone vocabulary — captured for v2.8+
- **TPLAI-FUTURE-01**: Per-template content-fit feedback loop (model generates → renderer measures overflow → model regenerates) — captured for v2.8+
- **TPLNEW-FUTURE-02**: User-customizable overlay zones (drag-to-reposition chip/pill in the editor) — captured for v3.0+

## Out of Scope (v2.7)

- **Hand-drawn / illustrated templates:** v2.7 focuses on photo-driven magazine-style aesthetics. Illustrated/cartoon templates require a separate art-direction pass.
- **Animated templates / video output:** This project is static carousel images only (project pivot, locked). Animation belongs to a different product surface.
- **Template marketplace / user-uploaded templates:** Templates remain code-defined in `src/lib/render/templates/` for v2.7. User-authored templates are a v3.0+ scope question.
- **Major Satori → other-renderer swap:** v2.7 stays on Satori. If overlay composition turns out to be infeasible in Satori, that's a separate research phase, not in scope here.

## Traceability

| Phase | Requirements |
|-------|--------------|
| 44. Template Schema Foundation | TPLSCHEMA-01, TPLSCHEMA-02, TPLSCHEMA-03, TPLSCHEMA-04, TPLSCHEMA-05 |
| 45. Renderer Composition | TPLREND-01, TPLREND-02, TPLREND-03, TPLREND-04, TPLREND-05 |
| 46. Premium Template Authoring | TPLNEW-01, TPLNEW-02, TPLNEW-03, TPLNEW-04, TPLNEW-05 |
| 47. AI Prompt Tuning | TPLAI-01, TPLAI-02, TPLAI-03, TPLAI-04 |
| 48. Template Thumbnails & Picker | TPLTHUMB-01, TPLTHUMB-02 |

**Coverage:** 19/19 v2.7 requirements mapped (5 + 5 + 5 + 4 + 2 = 19).

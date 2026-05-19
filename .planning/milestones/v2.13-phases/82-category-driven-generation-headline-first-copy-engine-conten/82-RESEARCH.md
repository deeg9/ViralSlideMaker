# Phase 82 — Technical Research

**Researched:** 2026-05-17
**Status:** Complete — informs planning

> Phase 82's WHAT (82-SPEC.md, 10 reqs) and HOW (82-CONTEXT.md, locked decisions) are
> already settled. This RESEARCH.md grounds those decisions in the *actual* current
> code surfaces so the planner produces accurate, executor-ready tasks.

## Codebase Findings (verified by direct read)

### Template registry — hide-not-delete already partly built
`src/lib/render/templates/index.ts`:
- `templates: SlideTemplate[]` registers **13** templates: `highlight-bar`, `news-drop`,
  `news-cyan`, `y2k-pop`, `bold-yellow`, `magazine-bold`, `tr3nding-news`, `documentary`,
  `editorial-serif`, `notes-app-chic`, `brutalist-grid`, `paper-essay` (12 user-facing)
  plus fixture/test templates registered separately for validator tests.
- `HIDDEN_FROM_PICKER: ReadonlySet<string>` **already exists** — currently hides
  `highlight-bar`, `news-drop`, `magazine-bold`, `documentary`, `brutalist-grid`.
- `pickerTemplates = templates.filter(t => !HIDDEN_FROM_PICKER.has(t.id))` → currently
  **8 picker-visible** templates: `news-cyan`, `y2k-pop`, `bold-yellow`, `tr3nding-news`,
  `editorial-serif`, `notes-app-chic`, `paper-essay`.
- `getTemplate(id)` falls back to `templates[0]` = `highlight-bar` on unknown id — this
  is the silent fallback SPEC R7 targets.
- **Implication:** the hide-not-delete *mechanism* is done. Phase 82 curation = (a) the
  keeper-list user sign-off, then (b) adjusting `HIDDEN_FROM_PICKER` to the approved set,
  and (c) wiring the picker to filter by category, not just the global hidden set.
- `SlideTemplate` interface is rich (overlays, `backgroundMode: 'image-bleed'`,
  `accentColor`, `aiVoiceNote`). `news-cyan`/`news-drop`/`tr3nding-news` already exist as
  news-flavored templates — "polish the keepers" means refining one of these toward the
  reference (full-bleed photo + dark gradient + kicker), not building new.

### Prompt assembly — templateId is the only style signal today
`src/lib/ai/prompts.ts` (348 lines):
- `buildSystemPrompt(templateId?)` — `NEWS_TEMPLATES = new Set(['news-drop','news-cyan'])`
  branches a `newsDropAddendum`. `SLIDE STRUCTURE RULES` (line ~103) mandate hook + body.
- `buildFromSpecPrompt` is a SIBLING (style-from-reference path) — Phase 82 must NOT
  touch it (v2.13 untouched per SPEC constraints).
- Category modules go in a NEW `src/lib/ai/categories/` dir per CONTEXT — one module per
  category + a registry, mirroring `templates/index.ts`.

### Schemas — body_text required in two places
`src/lib/ai/schemas.ts`: `SlideContentSchema.body_text: z.string()` (line 35, required);
`hook_segments`/`body_segments` are `.optional()` arrays of `TextSegmentSchema` (which has
`accent: z.boolean()`). `CarouselSchema` wraps `slides: z.array(SlideContentSchema).min(3).max(10)`.
`src/lib/ai/generate-slides.ts`: Gemini `responseSchema` (line 57) has slide-level
`required: ['hook_text','body_text','image_query','is_cta','role']` (line 151) — `body_text`
must be dropped from this array. Top-level `required: ['title','slides']`.

### Generation chain & public-by-default
`src/app/(dashboard)/project/[id]/actions.ts`: `generateCarousel()` already imports and
calls `autoPublishOnGenerate(admin, user.id, projectId, carousel.title)` (line 324). Any
new/changed generation path MUST keep routing through this helper (regressed 6×).
`src/app/api/v1/carousel/route.ts`: `templateId` required non-empty string — `category`
must thread through here too.
`src/lib/editor/text-box-adapter.ts` `legacyToTextBoxes` reads `hook_text/body_text/
hook_segments/body_segments/style_overrides/custom_texts` — must tolerate absent
`body_text` and map the new `accessory_label` to a small top-anchored `role:'custom'` box.
`src/lib/ai/validate-slides.ts` `validateAndRepair` — body-related checks must skip when
`body_text` is absent.

### Project row
`projects.template_id text` exists (migration `002_add_template_and_topic.sql`). A new
nullable `category text` column is needed (CONTEXT: persist category on the project row).
`src/lib/types/project.ts` carries the TS type.

## Validation Architecture

Structural test suite (SPEC R10) covers:
1. **Category routing** — `category:'news'` selects the News prompt module regardless of
   `templateId`; `category:'facts'` selects Facts module. Provably category-driven.
2. **Optional body_text** — a `CarouselSchema.parse` of a payload with empty/absent
   `body_text` succeeds; Gemini `responseSchema` no longer lists `body_text` in `required`.
3. **Accent emission** — News/Facts module output yields `hook_segments` with ≥1
   `accent:true` segment per headline (assert against fixture/parsed output).
4. **Accessory label** — optional `accessory_label` validates present AND absent; maps to
   a distinct small text box, not merged into the headline.
5. **Keeper-only picker** — `pickerTemplates` (post-curation) contains only the approved
   keepers; a culled id is absent from the picker but `getTemplate(culledId)` still
   resolves a renderer (back-compat).
6. **Render-parity** — existing byte-identity snapshots: only the deliberately-polished
   keeper template's snapshot changes; all others byte-identical.

Visual sign-off (SPEC R10) is a `human_needed` verification item — generate sample News +
Facts carousels on a fixed test-topic set for the user to approve. Expected, not suppressed.

## Risks & Landmines
- **R7 silent fallback:** removing the `highlight-bar` fallback must not break
  `getTemplate()` for legacy projects — keep `getTemplate` resolving all 13; only the
  *category→template resolution* and the *picker* change. A category always yields an
  explicit template id.
- **Render-parity:** culled templates' renderers are untouched (byte-identical). Only the
  one polished keeper's snapshot is regenerated deliberately.
- **buildFromSpecPrompt** (v2.13) must stay untouched — category logic is a sibling.
- **Public-by-default:** verify `autoPublishOnGenerate` still fires on every changed path.
- **Gemini cost:** stay on `gemini-3.1-flash-lite`; add no model tier/vendor.

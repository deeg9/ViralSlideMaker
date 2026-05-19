# Phase 82: Category-driven generation — headline-first copy engine + content-category picker + template curation — Specification

**Created:** 2026-05-17
**Ambiguity score:** 0.19 (gate: ≤ 0.20)
**Requirements:** 10 locked

## Goal

Carousel generation is steered by a user-selected **content category** (a signal distinct from the visual template). News and Facts & Info ship complete headline-first copy modules — one big bold headline per slide, accent-highlighted keywords, optional body text, optional small accessory labels — and the template gallery is curated down to ~4-6 polished keepers, replacing the current state where `templateId` is the only style signal and "no deliberate template" silently falls back to a cramped `highlight-bar` render.

## Background

A user generated a carousel with no deliberate template choice and got a cramped, washed-out slide: a header + small body block on a yellow card. The cause is structural, grounded in current code:

- **`src/components/slides/generation-form.tsx`** — the creation form collects a topic + a `TemplatePicker` selection; `templateId` state defaults to `'highlight-bar'`. There is no content-category concept.
- **`src/lib/ai/prompts.ts`** — `buildSystemPrompt(templateId)` makes `templateId` the *only* style signal Gemini receives. A `NEWS_TEMPLATES` set (`news-drop`, `news-cyan`) branches a news addendum; the base `SLIDE STRUCTURE RULES` mandate "Hook text (bold) + body text (supporting detail)" on every middle slide.
- **`src/lib/ai/generate-slides.ts`** — the Gemini `responseSchema` lists `body_text` in `required`.
- **`src/lib/ai/schemas.ts`** — `SlideContentSchema` has `body_text: z.string()` (required); `hook_segments`/`body_segments` (per-word accent spans) already exist and are optional.
- **`src/lib/render/templates/index.ts`** — 12 templates registered; `getTemplate(id)` falls back to `templates[0]` = `highlight-bar` on an unknown id.
- **`src/app/api/v1/carousel/route.ts`** — `templateId` is required and must be a non-empty string.

So "how the slide looks" and "how Gemini writes" are coupled by accident through `templateId`, body text is structurally mandatory, and the unknown-template path degrades to `highlight-bar`. This phase decouples content-category from visual-template, makes headline-only slides first-class, and curates the gallery.

Reference material (on `~/Desktop`): `Screenshot 2026-05-17 at 11.14.48 AM.png` (the ugly fallback output), `Screenshot 2026-05-15 at 5.13.25 / 5.13.49 / 5.14.10 PM.png` (target news-headline style — full-bleed photo, dark gradient, one big accent-highlighted headline, small kicker label), `Screenshot 2026-05-17 at 11.26.26 AM.png` (current creation flow).

## Requirements

1. **Content category as a generation signal**: Generation accepts a `category` input that is distinct from `templateId` and is what drives Gemini's copy.
   - Current: `templateId` is the only style signal passed into `buildSystemPrompt`; no category concept exists anywhere in the data model or API
   - Target: a `category` value flows from the creation form through the generation server action / API into prompt assembly; the prompt module is selected by `category`, not by `templateId`
   - Acceptance: a generation call with `category: 'news'` and any visual template produces news-style copy; the same call with `category: 'facts'` produces facts-style copy — the copy module is provably category-driven, not template-driven

2. **News headline-first prompt module**: The News category produces headline-first slides matching the reference style.
   - Current: news copy depends on picking `news-drop`/`news-cyan`; the base prompt forces hook + body on every middle slide
   - Target: a dedicated News prompt module instructs Gemini to write one big bold headline per slide, all-caps tabloid register, accent the newsworthy proper nouns/numbers, photojournalism image queries, and omit body text
   - Acceptance: a News generation across a fixed test-topic set yields slides whose headline is the dominant text element, each with ≥1 accent-marked `hook_segment`, and no body text on the cover slide

3. **Facts & Info headline-first prompt module**: The Facts & Info category produces headline-first slides.
   - Current: no facts-specific copy mode exists
   - Target: a dedicated Facts & Info prompt module writes one punchy fact per slide as a big headline with key numbers/terms accent-highlighted, body text omitted
   - Acceptance: a Facts generation across a fixed test-topic set yields one-fact-per-slide headline slides with accent segments and no required body text

4. **Optional body text / headline-only slides**: Body text becomes optional end-to-end so headline-only slides are first-class.
   - Current: `body_text` is `required` in the Gemini `responseSchema` and non-optional in Zod `SlideContentSchema`
   - Target: `body_text` is optional in the `responseSchema`, in Zod validation, and through `validateAndRepair` / the legacy→`text_boxes` adapter; a slide with empty/absent body text validates and renders
   - Acceptance: a carousel payload with one or more slides having empty/absent `body_text` passes `CarouselSchema.parse` and renders without a body text box

5. **Optional AI-generated accessory label**: Gemini may emit one small optional accessory label per slide.
   - Current: no accessory-label field is emitted by Gemini; `custom_texts`/`text_boxes` exist in the slide model but the generation schema does not surface a small-label concept
   - Target: the generation schema supports an optional per-slide accessory label (a kicker like "TRENDING NEWS" or a one-liner like "This is crazy"); it is optional — not forced on every slide — and the headline stays dominant
   - Acceptance: a News generation can produce slides with an accessory label AND a generation with zero accessory labels still validates; the label, when present, lands as a distinct small text box, not merged into the headline

6. **Category selector in the creation form**: The creation form gains a category control.
   - Current: `generation-form.tsx` has Presentation Prompt, Copy style, Select Visual Style, Number of Slides, Background Images, Advanced — no category
   - Target: a category selector is inserted into the existing form; News and Facts & Info are selectable; not-yet-built categories (Health & Wellness, Beauty) may appear as "coming soon" or be omitted
   - Acceptance: the creation form renders a category selector; choosing News and submitting routes generation through the News module + a news template

7. **Category → template routing, no raw fallback**: A category always resolves to a curated on-style template; the silent `highlight-bar` fallback is removed.
   - Current: an unknown/undeliberate `templateId` resolves via `getTemplate` to `templates[0]` = `highlight-bar`
   - Target: selecting a category resolves to a curated template appropriate to that category; there is no path where "no deliberate template" silently degrades to `highlight-bar`
   - Acceptance: no generation path produces a `highlight-bar` carousel without `highlight-bar` being an explicit keeper choice; a News category resolves to a news-appropriate template every time

8. **Template gallery curation (cull-and-polish, hide-not-delete)**: The picker shows only ~4-6 polished keepers; culled templates are hidden, not deleted.
   - Current: the `TemplatePicker` exposes all 12 registered templates; quality is uneven
   - Target: the picker displays only the approved keeper set; culled templates are removed from the picker but their render code is retained; keeper templates (especially the news template) are polished toward the reference style
   - Acceptance: the picker lists only the approved keepers; a culled template no longer appears in the picker; the culled template's renderer still exists and a saved project using it still renders

9. **Keeper-list sign-off gate**: The keeper set is approved by the user before any culling.
   - Current: no keeper list exists
   - Target: the phase proposes a ~4-6 keeper list (with reasoning + the category each serves, covering News and Facts) and the user approves it before templates are hidden
   - Acceptance: a recorded user approval of the keeper list exists in the phase artifacts before the culling change is committed

10. **Verification: structural tests + visual sign-off**: "Done" is gated by automated structural tests AND a user visual sign-off.
    - Current: no tests cover category routing, headline-only schema, or the curated picker
    - Target: a structural test suite covers category routing, optional `body_text`, accent emission, and the keeper-only picker; the phase also generates carousels for a fixed set of News and Facts test topics for user visual approval
    - Acceptance: the structural test suite passes AND the user has signed off that the sample News + Facts generations match the reference style

## Boundaries

**In scope:**
- A `category` signal distinct from `templateId`, threaded form → server action/API → prompt assembly
- News and Facts & Info headline-first prompt modules, plus an extensible category framework other categories plug into later
- `body_text` made optional across the Gemini `responseSchema`, Zod schemas, `validateAndRepair`, and the legacy→`text_boxes` adapter
- An optional per-slide AI-generated accessory label (kicker / one-liner)
- A category selector inserted into the existing `generation-form.tsx`
- Category → curated-template routing; removal of the silent `highlight-bar` fallback path
- Template gallery cull-and-polish: hide weak templates from the picker (renderer retained), polish the kept keepers toward the references
- A keeper-list user sign-off gate
- A structural test suite + a visual sign-off verification gate

**Out of scope:**
- Health & Wellness, Beauty, and any other category copy modules — framework only this phase; their full copy systems are a later phase (keeps scope shippable and focused on the reported pain)
- Editor changes — the generic `text_box` editor already supports headline-only slides and accessory labels; no editor work needed
- A redesign of the "What shall we create?" page layout — only a category control is inserted into the existing form
- Deleting culled template render code or migrating saved projects' stored `template_id` — hide-not-delete keeps culled templates renderable, preserving back-compat with ~50 saved projects
- Net-new templates designed from scratch — keepers are polished, not rebuilt (cull-and-polish, not cull-and-build)
- v2.13 reference-image style extraction (style-from-reference) — untouched

## Constraints

- **Render-parity invariant:** v2.13's byte-identical template render-parity is preserved by hide-not-delete — culled templates' renderers are untouched. Polishing a *kept* template intentionally changes its render output; only that template's parity snapshot may change, and it must be regenerated deliberately. All non-polished templates remain byte-identical.
- **Gemini cost:** stay on the current cheapest viable text model (`gemini-3.1-flash-lite` per `gemini-model.ts`); do not add a new model tier or vendor for category routing.
- **Extensible framework:** the category system must let Health & Wellness, Beauty, etc. be added later without re-architecting prompt assembly or routing.
- **Public-by-default:** any new or changed generation path must still route newly generated carousels through the `autoPublishOnGenerate` helper (carousels default to Public).
- **Back-compat:** the ~50 existing saved projects must keep rendering; the optional-`body_text` change must not break carousels generated before this phase.

## Acceptance Criteria

- [ ] Generation accepts a `category` input distinct from `templateId`; News and Facts & Info each route to their own prompt module
- [ ] `responseSchema` + Zod accept a slide with empty/absent `body_text`; a News generation produces ≥1 slide with no body text
- [ ] News and Facts slides emit `hook_segments` with ≥1 `accent` segment per headline
- [ ] An optional accessory label can be emitted per slide; a generation with zero accessory labels still validates
- [ ] The creation form shows a category selector; selecting News routes generation to a news template + the news prompt module
- [ ] No generation path silently falls back to `highlight-bar` — a selected category always resolves to a curated template
- [ ] The template picker displays only the approved ~4-6 keepers; culled templates are absent from the picker
- [ ] A saved project referencing a culled template still renders (renderer code retained)
- [ ] Render-parity: only intentionally-polished keeper templates show snapshot changes; all other templates remain byte-identical
- [ ] The structural test suite passes AND the user has signed off that sample News + Facts generations match the reference style

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.85  | 0.75 | ✓      | News + Facts full, framework for rest; measurable per-module |
| Boundary Clarity   | 0.85  | 0.70 | ✓      | Explicit out-of-scope; editor + page-redesign excluded       |
| Constraint Clarity | 0.72  | 0.65 | ✓      | Parity preserved via hide-not-delete; cost model fixed       |
| Acceptance Criteria| 0.78  | 0.70 | ✓      | Structural tests + visual sign-off gate                      |
| **Ambiguity**      | 0.19  | ≤0.20| ✓      |                                                              |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective       | Question summary                              | Decision locked                                                        |
|-------|-------------------|-----------------------------------------------|------------------------------------------------------------------------|
| 0     | Pre-spec (/gsd-quick) | Scope of the breaking-news fix             | Three workstreams; routed whole feature to a proper phase              |
| 1     | Researcher        | Which categories ship?                        | News + Facts full headline-first modules; extensible framework for rest|
| 1     | Researcher        | What does "cull" mean?                        | Cull-and-polish — keep best ~4-6 and refine keepers toward references  |
| 1     | Researcher        | Fate of the "random/no template" path?        | Category-first entry; raw random/`highlight-bar` fallback removed      |
| 2     | Boundary Keeper   | Name keepers now or propose for sign-off?     | Phase proposes a ~4-6 keeper list; user approves before culling        |
| 2     | Simplifier        | Are accessory labels in scope?                | Yes — optional AI-generated per-slide label (kicker / one-liner)       |
| 2     | Boundary Keeper   | What happens to a culled template?            | Hide from picker, keep renderer — preserves parity, no migration       |
| 3     | Failure Analyst   | How is "looks good" verified?                 | Structural tests + user visual sign-off on fixed test-topic set        |
| 3     | Boundary Keeper   | What else does the phase touch?               | Generation + category picker only; editor untouched; no page redesign  |

---

*Phase: 82-category-driven-generation-headline-first-copy-engine-conten*
*Spec created: 2026-05-17*
*Next step: /gsd-discuss-phase 82 — implementation decisions (category data model, prompt-module structure, accessory-label schema shape, keeper selection)*

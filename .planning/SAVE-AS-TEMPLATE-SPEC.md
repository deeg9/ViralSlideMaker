# Feature Spec: Save as Template — admin-authored, DB-backed recipe templates

**Created:** 2026-05-18
**Status:** Spec — not yet routed to a milestone/phases
**Origin:** /gsd-quick 260518-jhg ("News Oracle" template) → surfaced the flat-style-vs-layout-recipe gap → this spec. Absorbs the removed placeholder Phase 83 ("template-driven layout generation").
**Recommended routing:** Its own milestone (v2.14 candidate) — ~4 phases. See "Recommended Phase Breakdown".

## Goal

Let an admin turn a polished real carousel into a reusable picker template — capturing not just its flat style but its **full layout recipe** (per-slide structure) — and publish it to every user's picker **with no code deploy**. New carousels generated on such a template come out pre-shaped like the source carousel.

The intended operating workflow: the admin (Diego, with Claude) builds high-quality reference carousels via the Viral Slide Maker API/MCP, then "Saves as Template" the good ones. The picker fills with proven, on-brand templates without an engineer hand-coding each one.

## Background

Grounded in current code:

- **Templates are flat code objects.** `src/lib/render/templates/*.ts` define `SlideTemplate` objects; `src/lib/render/templates/index.ts` registers them in a `templates[]` array (13 today). `getTemplate(id)`, `pickerTemplates`, and `TEMPLATE_IDS` read only that array.
- **A `SlideTemplate` carries flat style only** — `fontFamily`, `hookFontSize`, colors, `overlayColor/Opacity`, `accentColor`, an optional `coverLayout`, an optional picker `sample`. It has **no per-slide structure**.
- **A real carousel's distinctive look lives in per-slide `style_overrides`** — caption-card geometry (`caption_bar_*`), hook positions/sizes, accent/highlight placement, accessory text boxes. Proven by /gsd-quick 260518-jhg: the "Oracle Layoff Analysis" carousel's look came almost entirely from per-slide overrides + a `template_id_override`, none of which a `SlideTemplate` can hold.
- **So "make a template from a carousel" currently loses everything but flat style.** 260518-jhg shipped the "News Oracle" template flat-style-only and explicitly deferred the layout half.
- **Adding a template today is a code change + deploy** plus mechanical papercuts (hardcoded `templates.length` test counts, render-parity fingerprint snapshot regen). Fine occasionally; a bottleneck if templates become a regular content-ops activity.
- **Adjacent machinery already exists** and the recipe model should build on it, not reinvent it: archetype concepts (`slideArchetype`, `caption-bar-bottom`, `computeCaptionBarBottomPositions` from /gsd-quick 260515-i56), Phase 80's composition-aware "archetype classification + typed slot primitives", the `style-spec-projector`, the v2.13 `StyleSpec` system, and quick-260518-8o0's news-layout caption-card defaulting.
- **An admin surface exists** — `src/app/api/admin/seed-explore/route.ts` — to model auth/gating from.

## Locked Decisions (discussion 2026-05-18)

1. **Audience — admin-only authoring.** Only an admin saves templates; saved templates go global to every user's picker. No per-user template UI, no moderation pipeline. (End-user and community/publishable templates are explicitly deferred.)
2. **Capture — full layout recipe.** A saved template carries per-slide structure (caption-card geometry, hook positions/sizes, accent/highlight rhythm, accessory labels), not just flat style. This is what makes new carousels generate pre-shaped like the source.
3. **Storage — DB-backed.** Templates move to a database table; the code registry and DB rows merge into one picker list. Saving a template requires no code deploy.

## Requirements

1. **DB-backed template storage with code+DB registry merge.**
   - Current: 13 templates are `.ts` objects in `templates[]`; `getTemplate`/`pickerTemplates`/`TEMPLATE_IDS` read only that array.
   - Target: a `templates` DB table (id, name, category, flat-style fields, `layout_recipe` JSON, preview asset ref, created_by, timestamps); a merged registry where `getTemplate`/`pickerTemplates`/`TEMPLATE_IDS` resolve both code templates and DB rows. The 13 code templates remain in code (back-compat for ~82 existing projects).
   - Acceptance: a row inserted into the `templates` table appears in the picker with no deploy; every existing code template still resolves via `getTemplate` and renders byte-identically.

2. **`LayoutRecipe` data model.**
   - Current: `SlideTemplate` has flat style only; per-slide structure has no template-level representation.
   - Target: a typed `LayoutRecipe` — a **role-keyed set of slide archetypes** (e.g. `cover`, `body`, `cta`/last) rather than a fixed N-slide array, so it scales to variable slide counts (1–10). Each archetype describes: layout mode (cover/body/full-bleed), caption-card geometry (`enabled`, `x`, `y`, `width`, `height_pct`, `blend_pct`, `opacity`, `position`), hook placement (position band, font-size band, `text_align`), accent/highlight rhythm, and optional accessory-label slots. Closed-enum fields wherever feasible (project closed-enum invariant).
   - Acceptance: the Oracle carousel's per-slide pattern (cover = blended caption card; middle = full-bleed photo, no card; cta = caption card + follow CTA) is fully expressible as one `LayoutRecipe`.

3. **Recipe extraction from a source carousel (the "capture" half of Save as Template).**
   - Current: no path turns a project's `slide_data` into a template.
   - Target: given a source carousel, derive a `LayoutRecipe` + flat style — classify each slide into a role/archetype, extract the representative caption-card geometry / hook placement / accent rhythm per archetype, and capture flat style (fonts/colors/overlay/accent). Prefer deterministic code over a new AI call (cost).
   - Acceptance: extraction run on the Oracle project produces a recipe + style that, when applied to a fresh generation, reproduces the Oracle look.

4. **Recipe-driven generation (the "apply" half — absorbs the removed Phase 83).**
   - Current: generation emits slides via Gemini + `style-spec-projector`; templates contribute flat style only; no template-level layout recipe is applied.
   - Target: when a carousel is generated on a template carrying a `LayoutRecipe`, the generation pipeline applies the recipe — per-slide caption-card geometry, hook positions, accent placement, accessory labels — so output is pre-shaped. Touches `prompts.ts`, `style-spec-projector.ts`, `style-spec-projector-constants.ts`, `validate-slides.ts`.
   - Acceptance: a News-category generation on the News Oracle template comes out shaped like the Oracle reference — full-bleed photo, cover caption card with edge-blend, big centered condensed headline, cyan pill-highlight keywords, a small "Trending" accessory label.

5. **Admin "Save as Template" authoring flow.**
   - Current: no authoring surface; admin area is `src/app/api/admin/seed-explore/route.ts`.
   - Target: an admin-role-gated flow — pick a source carousel (an admin project, or one built via the Viral Slide Maker API) → name it + assign a content category → system extracts recipe+style, renders a picker preview, writes the `templates` row. Real auth gating (not obscurity).
   - Acceptance: an admin saves a carousel as a template and it appears in every user's picker; a non-admin cannot reach the flow or the endpoint.

6. **Picker preview for DB templates.**
   - Current: code templates render a live picker tile from `sample` and/or a `thumbnail` PNG.
   - Target: a DB template carries a preview (rendered snapshot image in storage, or a `sample`-equivalent payload) so its picker tile is visually faithful to the source carousel.
   - Acceptance: a DB template's picker tile visibly matches the source carousel.

7. **Render parity across all three paths.**
   - Current: code templates render identically across canvas preview / Satori PNG / HTML export (TPLREND-05 / PARITY-01).
   - Target: DB templates and recipe-shaped slides render identically across all three paths.
   - Acceptance: a carousel generated on a DB recipe template renders consistently in editor preview, PNG export, and HTML export.

8. **Back-compat / byte-identity for existing templates and carousels.**
   - Current: ~82 projects on code templates; render-parity invariant holds; `news-cyan` etc. byte-identical guards exist.
   - Target: the DB migration + registry merge changes how *no* existing carousel renders; the 13 code templates stay byte-identical.
   - Acceptance: `legacy-templates-byte-identical` + render-parity fingerprint suites stay green for all code templates.

## Boundaries

**In scope:** DB-backed template storage + code/DB registry merge; the `LayoutRecipe` model; recipe extraction from a carousel; recipe-driven generation (absorbs Phase 83); the admin Save-as-Template flow; DB-template picker previews; render parity; back-compat.

**Out of scope:**
- End-user (non-admin) template saving — deferred; admin-only was the locked decision.
- Community / publishable / marketplace templates + moderation — a later growth feature.
- Migrating the 13 existing code templates into the DB — they stay as code (back-compat); DB is additive.
- Deleting code-template renderers.
- Editing a DB template after save — v1 may be save-new-only (see Open Questions).
- A new AI model/vendor for extraction — stay on the cheapest viable model; prefer deterministic extraction.

## Constraints

- **Closed-enum invariant:** `LayoutRecipe` fields are closed enums wherever feasible (project-wide closed-enum rule; defends schema + injection surface).
- **Render-parity (TPLREND-05 / PARITY-01):** code templates stay byte-identical; DB templates render identically across the 3 render paths.
- **Shared Supabase project:** migrations hit the shared prod DB — follow the project's migration discipline; additive, reversible.
- **Cost:** no new Gemini model tier; recipe extraction deterministic-code-first.
- **Public-by-default:** any generation path touched still routes new carousels through `autoPublishOnGenerate`.
- **Admin gating is real auth** — server-enforced role check, mirrored on every Save-as-Template endpoint.

## Acceptance Criteria

- [ ] A `templates` DB row appears in the picker with no deploy; all 13 code templates still resolve and render byte-identically.
- [ ] A `LayoutRecipe` fully expresses the Oracle carousel's per-slide pattern.
- [ ] Extraction on the Oracle project yields a recipe+style that reproduces its look.
- [ ] A generation on a recipe-carrying template comes out pre-shaped (caption-card geometry, hook placement, accent rhythm, accessory label).
- [ ] An admin can Save-as-Template; a non-admin cannot reach the flow or endpoint.
- [ ] A DB template's picker preview is visually faithful to its source.
- [ ] Recipe-shaped carousels render consistently across editor preview / PNG export / HTML export.
- [ ] `legacy-templates-byte-identical` + render-parity fingerprint suites stay green for code templates.

## Recommended Phase Breakdown

This is milestone-sized — recommend a dedicated milestone (v2.14: "Save as Template — DB-backed recipe templates"):

- **Phase A — DB-backed template storage + registry merge** (R1, R7, R8). Foundation: schema, migration, merged registry, parity preserved. No recipe yet.
- **Phase B — `LayoutRecipe` model + extraction** (R2, R3). The recipe schema + deterministic extraction from a carousel.
- **Phase C — Recipe-driven generation** (R4). Generation pipeline applies the recipe — the absorbed Phase 83; highest blast radius, needs heavy verification.
- **Phase D — Admin Save-as-Template flow + preview** (R5, R6). The authoring surface that ties it together.

## Open Questions

1. Can a DB template be **edited or deleted** after save, or is v1 save-new-only? (Affects schema + admin UI.)
2. Recipe extraction — fully **deterministic code**, or a Gemini-assisted slide-archetype classification? (Cost vs. accuracy; deterministic preferred.)
3. Where do DB-template **preview images** live — a new Supabase storage bucket (`template-previews`?) or a regenerable live `sample` payload?
4. Does **Save-as-Template need an MCP surface** so Claude can invoke it directly, or is it a web admin UI Diego operates? (The Viral Slide Maker MCP is for *building* the source carousels; saving is likely a web admin action — confirm.)
5. Should the 13 code templates eventually **migrate into the DB** so there's one storage model, or is the code+DB hybrid permanent?

## Interview Log

| Round | Question | Decision locked |
|-------|----------|-----------------|
| 0 | /gsd-quick 260518-jhg — can a project become a template? | Flat style yes; per-slide layout no — surfaced the gap, queued the rest |
| 1 | Who can save a carousel as a template? | Admin-only authoring; saved templates go global |
| 1 | What does a saved template capture? | Full layout recipe (per-slide structure), not just flat style |
| 1 | Where do templates live architecturally? | DB-backed; code+DB registry merge; no deploy to add one |

---

*Spec created: 2026-05-18*
*Next step: route to a milestone — `/gsd-new-milestone` (v2.14), then `/gsd-spec-phase` per phase A–D — or `/gsd-phase` to add phases A–D individually.*

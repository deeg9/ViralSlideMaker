# Roadmap — TikTok Slideshow Creator

## Active Milestone — v2.14 Save as Template

**Goal:** Admin-authored, DB-backed templates that capture a real carousel's full layout recipe — so the team can mint polished picker templates from real carousels with no code deploy, and new carousels generate pre-shaped to them.

**Requirements coverage:** 9/9 v2.14 reqs mapped (100%). Source of truth: `.planning/REQUIREMENTS.md`. Feature spec: `.planning/SAVE-AS-TEMPLATE-SPEC.md` (authoritative — goal, background, 8 source requirements with Current/Target/Acceptance, boundaries, constraints, recommended phase breakdown).

**Phase numbering:** Continues from v2.13 (last shipped Phase 82) → v2.14 starts at Phase 83. (No `--reset-phase-numbers` flag passed.) The v2.13 roadmap is archived at `.planning/milestones/v2.13-ROADMAP.md`.

**Locked decisions (discussion 2026-05-18, from the spec):**
1. **Audience — admin-only authoring.** Only an admin saves templates; saved templates go global to every user's picker. No per-user template UI, no moderation pipeline. End-user and community/publishable templates are explicitly deferred.
2. **Capture — full layout recipe.** A saved template carries per-slide structure (caption-card geometry, hook positions/sizes, accent/highlight rhythm, accessory labels), not just flat style. This is what makes new carousels generate pre-shaped like the source.
3. **Storage — DB-backed.** Templates move to a database table; the code registry and DB rows merge into one picker list. Saving a template requires no code deploy.
4. **V1 is save-new-only.** No editing or deleting a DB template after save; a re-save mints a new template.

**Constraints carried into every phase (locked, non-negotiable):**
- **Closed-enum invariant:** `LayoutRecipe` fields are closed enums wherever feasible — project-wide closed-enum rule; defends schema + injection surface.
- **Render-parity (TPLREND-05 / PARITY-01):** the 13 code templates stay byte-identical; DB templates and recipe-shaped slides render identically across all 3 render paths.
- **Additive, reversible migrations on the shared Supabase project** — follow the project's migration discipline; the migration changes how *no* existing carousel renders.
- **Cost:** no new Gemini model/vendor tier; recipe extraction is deterministic code, no new AI call.
- **Admin gating is real auth** — server-enforced role check, mirrored on every Save-as-Template endpoint (model on `src/app/api/admin/seed-explore/route.ts`).
- **Public-by-default:** any generation path touched still routes new carousels through `autoPublishOnGenerate`.

---

## Phases

- [x] **Phase 83: DB-Backed Template Storage + Registry Merge** — `templates` DB table + migration + merged code/DB registry; render parity for DB templates + byte-identity for 13 code templates and ~82 existing carousels. No recipe yet. (completed 2026-05-19)
- [ ] **Phase 84: LayoutRecipe Model + Extraction** — Typed role-keyed `LayoutRecipe` schema + deterministic extraction of a recipe + flat style from a source carousel's slide_data.
- [ ] **Phase 85: Recipe-Driven Generation** — Generation pipeline applies a template's `LayoutRecipe` so new carousels come out pre-shaped. Highest blast radius. Absorbs the removed placeholder Phase 83.
- [ ] **Phase 86: Admin Save-as-Template Flow + Previews** — Admin-role-gated authoring flow that ties it together + faithful DB-template picker previews.

---

## Phase Details

### Phase 83: DB-Backed Template Storage + Registry Merge
**Goal**: Templates can live in a database row, not just code — a merged registry resolves both, so a DB template appears in the picker with no code deploy, while the 13 code templates and ~82 existing carousels keep rendering byte-identically.
**Depends on**: Nothing (first phase of milestone; builds on the existing v2.13 template system + `style-spec-projector`)
**Requirements**: TSTORE-01, TSTORE-02, TSTORE-03, TSTORE-04
**Success Criteria** (what must be TRUE):
  1. A row inserted into the new `templates` DB table (id, name, category, flat-style fields, `layout_recipe` JSON, preview reference, `created_by`, timestamps) appears in the picker for every user with no code deploy.
  2. `getTemplate`, `pickerTemplates`, and `TEMPLATE_IDS` each resolve both code templates and DB rows from one merged registry.
  3. A DB-backed template renders identically across all three render paths — canvas editor preview, Satori PNG export, and HTML export.
  4. The 13 existing code templates and all ~82 existing carousels render byte-identically after the storage change — `legacy-templates-byte-identical` + render-parity fingerprint suites stay green.
**Plans**: 3

Plans:
- [x] 83-01: Additive `templates` table migration — text PK, flat_style + nullable layout_recipe/preview, created_by FK, public-read RLS deny-by-default writes (TSTORE-01)
- [x] 83-02: Async hybrid registry merge — resolveTemplate / getPickerTemplates / isKnownTemplateId, ~60s TTL cache, code-wins collision rule, fetcher test seam (TSTORE-02)
- [x] 83-03: DB-template render parity across canvas/Satori/HTML + sync/async byte-identity guard; legacy + new-parity suites green, no fixture regen (TSTORE-03, TSTORE-04)

**Risk framing**: The migration hits the shared prod Supabase project — must be additive and reversible per the project's migration discipline. The registry merge changes how *no* existing carousel renders; byte-identity (TSTORE-04 / TPLREND-05) is the gate, not a nice-to-have. The 13 code templates stay in code for back-compat — DB storage is additive, not a migration of existing templates.

### Phase 84: LayoutRecipe Model + Extraction
**Goal**: A typed `LayoutRecipe` model exists that captures a carousel's per-slide structure as role-keyed archetypes, and a source carousel's `slide_data` can be deterministically turned into a `LayoutRecipe` + flat style — with no new AI call.
**Depends on**: Phase 83 (the `templates` table carries the `layout_recipe` JSON column the model is stored in)
**Requirements**: RECIPE-01, RECIPE-02
**Success Criteria** (what must be TRUE):
  1. A `LayoutRecipe` is a typed, role-keyed set of slide archetypes (cover / body / cta) — not a fixed slide array — each describing layout mode, caption-card geometry (`enabled`, `x`, `y`, `width`, `height_pct`, `blend_pct`, `opacity`, `position`), hook placement (position band, font-size band, `text_align`), accent/highlight rhythm, and optional accessory-label slots, with closed-enum fields wherever feasible.
  2. A `LayoutRecipe` scales to variable slide counts (1–10) and fully expresses the Oracle carousel's per-slide pattern (cover = blended caption card; middle = full-bleed photo, no card; cta = caption card + follow CTA).
  3. Running extraction on a source carousel classifies each slide into a role/archetype and extracts representative geometry / hook placement / accent rhythm per archetype, deterministically — no new Gemini call.
  4. Extraction run on the Oracle project produces a `LayoutRecipe` + flat style that, when applied to a fresh generation, reproduces the Oracle look.
**Plans**: TBD

Plans:
- [ ] 84-01: TBD

**Risk framing**: The closed-enum invariant applies to `LayoutRecipe` fields wherever feasible — it defends the schema and injection surface. Extraction is deterministic code built on existing archetype machinery (`slideArchetype`, `caption-bar-bottom`, `computeCaptionBarBottomPositions`, Phase 80 archetype classification, `style-spec-projector`) — build on it, do not reinvent. No new Gemini model tier; no new AI call.

### Phase 85: Recipe-Driven Generation
**Goal**: When a carousel is generated on a template carrying a `LayoutRecipe`, the generation pipeline applies the recipe so the output is pre-shaped — per-slide caption-card geometry, hook positions, accent placement, and accessory labels match the recipe.
**Depends on**: Phase 84 (consumes the `LayoutRecipe` model and the recipes extraction produces)
**Requirements**: RECGEN-01
**Success Criteria** (what must be TRUE):
  1. Generating a carousel on a template that carries a `LayoutRecipe` produces slides whose per-slide caption-card geometry, hook positions, accent placement, and accessory labels match the recipe.
  2. A News-category generation on the News Oracle template comes out shaped like the Oracle reference — full-bleed photo, cover caption card with edge-blend, big centered condensed headline, cyan pill-highlight keywords, a small "Trending" accessory label — verified against the Oracle reference look.
  3. A generation on a flat-style-only template (no `LayoutRecipe`) is unaffected — recipe application is additive and only fires when a recipe is present.
  4. Newly generated recipe-shaped carousels still default to Public — every touched generation path routes through `autoPublishOnGenerate`.
**Plans**: 3

Plans:
- [x] 85-01: Recipe-apply core — applyLayoutRecipe projection module + recipe semantic-hint block in buildSystemPrompt
- [x] 85-02: Wire both generateCarousel paths through recipe resolution + applyLayoutRecipe before save
- [x] 85-03: SC2 Oracle-look, SC3 byte-identical, SC4 public-by-default verification tests

**Risk framing**: Highest blast radius of the milestone — this touches the live generation pipeline (`prompts.ts`, `style-spec-projector.ts`, `style-spec-projector-constants.ts`, `validate-slides.ts`) and affects *every generated carousel for a category* on a recipe-carrying template. Needs heavy verification: a recipe-carrying generation must come out pre-shaped without regressing flat-style-only (no-recipe) generations, and the change must not breach generation-perf budgets (cf. v2.12 `template_id_override` open-string runaway). Absorbs the removed placeholder Phase 83 ("template-driven layout generation"). Recipe application is deterministic code; no new Gemini model tier.

### Phase 86: Admin Save-as-Template Flow + Previews
**Goal**: An admin can save a chosen source carousel as a new template — name it, assign a content category — through an admin-role-gated flow, and the resulting DB template carries a faithful picker preview; a non-admin cannot reach the flow or its endpoint.
**Depends on**: Phase 83 (the flow writes a `templates` DB row + preview reference); benefits from Phases 84 and 85 (the flow extracts a recipe, and the template it mints is recipe-driven at generation time)
**Requirements**: ADMIN-01, ADMIN-02
**Success Criteria** (what must be TRUE):
  1. An admin can pick a source carousel (an admin project, or one built via the Viral Slide Maker API), name it, assign a content category, and save it as a new template through the authoring flow; the new template appears in every user's picker.
  2. A non-admin cannot reach the Save-as-Template flow or its endpoint — gating is a real server-enforced role check, mirrored on every endpoint, not obscurity.
  3. A DB-backed template carries a picker preview (rendered snapshot in storage, or a `sample`-equivalent payload) so its picker tile is visually faithful to the source carousel.
  4. The saved template behaves as a normal picker template — selectable like any code template, and (because it carries a recipe) generating on it produces pre-shaped carousels.
**Plans**: TBD

Plans:
- [ ] 86-01: TBD

**UI hint**: yes

**Risk framing**: Admin gating must be real server-enforced auth, mirrored on every Save-as-Template endpoint — model on `src/app/api/admin/seed-explore/route.ts`, not obscurity. V1 is save-new-only: there is no edit/delete of a saved template (a re-save mints a new one). Save-as-Template is a web admin action; the Viral Slide Maker MCP is for *building* the source carousels, not for saving templates.

---

## Progress

**Execution Order:**
Phases execute in numeric order: 83 → 84 → 85 → 86

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 83. DB-Backed Template Storage + Registry Merge | 3/3 | Complete   | 2026-05-19 |
| 84. LayoutRecipe Model + Extraction | 0/TBD | Not started | — |
| 85. Recipe-Driven Generation | 0/TBD | Not started | — |
| 86. Admin Save-as-Template Flow + Previews | 0/TBD | Not started | — |

---

## Coverage Audit

**v2.14 requirement count:** 9 requirements across 4 categories
**Mapped:** 9/9 (100%) ✓
**Orphans:** 0
**Duplicates:** 0

| Category | Count | Phase | Requirements |
|----------|-------|-------|--------------|
| TSTORE | 4 | 83 | TSTORE-01, TSTORE-02, TSTORE-03, TSTORE-04 |
| RECIPE | 2 | 84 | RECIPE-01, RECIPE-02 |
| RECGEN | 1 | 85 | RECGEN-01 |
| ADMIN | 2 | 86 | ADMIN-01, ADMIN-02 |

---

## Milestones

- 🚧 **v2.14 Save as Template** — Phases 83–86 (planning 2026-05-18). 9 reqs across 4 categories (TSTORE / RECIPE / RECGEN / ADMIN). Admin-authored, DB-backed templates that capture a real carousel's full layout recipe: DB-backed storage + code/DB registry merge → typed `LayoutRecipe` model + deterministic extraction → recipe-driven generation (pre-shaped output) → admin Save-as-Template flow + picker previews. Closed-enum invariant + TPLREND-05 render parity + byte-identity back-compat preserved throughout. See [REQUIREMENTS.md](REQUIREMENTS.md) and [SAVE-AS-TEMPLATE-SPEC.md](SAVE-AS-TEMPLATE-SPEC.md).
- ✅ **v2.13 Style-from-Reference Generation** — Phases 73–82 (shipped 2026-05-14). Vision-LLM-driven style extraction from uploaded slideshow images + spec preview + two content paths + remix/fork/publish snapshot + legal hardening + composition-aware archetype extraction (Phase 80) + first-run onboarding (Phase 81) + category-driven headline-first generation (Phase 82). See [archive](milestones/v2.13-ROADMAP.md).
- ✅ **v2.12 Shapes & Icons (Decoration Primitives)** — Phases 67–72 (shipped 2026-05-04). Lucide icon picker (118-icon allowlist) + 8 Canva-style shapes + full v2.11 editor parity + Gemini AI emit + interactive rotation handles + rotation-aware AABB. See [archive](milestones/v2.12-ROADMAP.md).
- ✅ **v2.11 Full Editor Parity** — Phases 60–66 (shipped 2026-05-03) — Multi-select, alignment, group/ungroup, smart guides, lock/hide, z-order, layers panel, power-user differentiators. See [archive](milestones/v2.11-ROADMAP.md).
- ✅ **v2.10 Text Box Resize Handles** — Phase 59 (shipped 2026-05-02). See [archive](milestones/v2.10-ROADMAP.md).
- ✅ **v2.9 Viral Visual Quality** — Phases 54–58 (shipped 2026-05-01). See [archive](milestones/v2.9-ROADMAP.md).
- ✅ **v2.8 Text Editor Right-Rail Redesign** — Phases 49–53 (shipped 2026-04-30).
- ✅ **v2.7 Premium Templates** — Phases 44–48 (shipped 2026-04-29).
- ✅ **v2.6 MCP Server** — Phases 40–43 (shipped 2026-04-28).
- ✅ **v2.5 Public REST API Parity** — Phases 34–39 (shipped 2026-04-28).
- ✅ **v2.4 Explore + Remix** — Phases 26–33 (shipped 2026-04-27).
- ✅ **v2.2 Public REST API** — Phases 20–25 (shipped 2026-04-09). See [archive](milestones/v2.2-ROADMAP.md).
- ✅ **v2.1 Text Effects** — Phases 17–19 (shipped 2026-04-07). See [archive](milestones/v2.1-ROADMAP.md).
- ✅ **v2.0 API & MCP Platform** — Phases 14–16 (shipped 2026-04-07). See [archive](milestones/v2.0-ROADMAP.md).

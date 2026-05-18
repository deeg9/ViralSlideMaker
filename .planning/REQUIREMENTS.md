# Requirements — v2.14 Save as Template

**Milestone:** v2.14 Save as Template
**Defined:** 2026-05-18
**Source:** `.planning/SAVE-AS-TEMPLATE-SPEC.md` (feature spec, 3 locked decisions)

Goal: admin-authored, DB-backed templates that capture a real carousel's full
layout recipe — so the team can mint polished picker templates from real
carousels with no code deploy, and new carousels generate pre-shaped to them.

Prior-milestone requirements are archived at
`.planning/milestones/v2.13-REQUIREMENTS.md`.

---

## v2.14 Requirements

### Template Storage (TSTORE)

- [ ] **TSTORE-01**: Templates can be stored in a database table (id, name, category, flat-style fields, `layout_recipe` JSON, preview reference, `created_by`, timestamps) via an additive migration on the shared Supabase project.
- [ ] **TSTORE-02**: The template registry merges code templates and DB rows — `getTemplate`, `pickerTemplates`, and `TEMPLATE_IDS` resolve both, so a DB template row appears in the picker with no code deploy.
- [ ] **TSTORE-03**: A DB-backed template renders identically across all three render paths (canvas editor preview, Satori PNG export, HTML export).
- [ ] **TSTORE-04**: The 13 existing code templates and all ~82 existing carousels render byte-identically after the storage change (TPLREND-05 / legacy byte-identical + render-parity suites stay green).

### Layout Recipe (RECIPE)

- [ ] **RECIPE-01**: A typed `LayoutRecipe` model exists — role-keyed slide archetypes (cover / body / cta) rather than a fixed slide array, each describing layout mode, caption-card geometry, hook placement, accent/highlight rhythm, and optional accessory-label slots; closed-enum fields wherever feasible. It scales to variable slide counts (1–10).
- [ ] **RECIPE-02**: A source carousel's `slide_data` can be turned into a `LayoutRecipe` + flat style — each slide classified into a role/archetype, representative geometry extracted per archetype, deterministically (no new AI call).

### Recipe-Driven Generation (RECGEN)

- [ ] **RECGEN-01**: When a carousel is generated on a template carrying a `LayoutRecipe`, the generation pipeline applies the recipe so the output is pre-shaped — per-slide caption-card geometry, hook positions, accent placement, and accessory labels match the recipe (verified against the Oracle reference look).

### Admin Authoring (ADMIN)

- [ ] **ADMIN-01**: An admin can save a chosen source carousel as a new template — name it, assign a content category — through an admin-role-gated flow; the new template appears in every user's picker. A non-admin cannot reach the flow or its endpoint.
- [ ] **ADMIN-02**: A DB-backed template carries a picker preview (rendered snapshot or `sample`-equivalent payload) so its picker tile is visually faithful to the source carousel.

---

## Future Requirements (deferred)

- End-user (non-admin) template saving — any user saves their carousels as personal reusable templates.
- Community / publishable templates — users publish templates for others, with moderation/curation.
- Editing or deleting a DB template after save — V1 is save-new-only.
- Migrating the 13 code templates into the DB — they remain in code (back-compat); DB storage is additive.

---

## Out of Scope

| Excluded | Reason |
|----------|--------|
| End-user template saving | Locked decision: admin-only authoring for v2.14. |
| Community / publishable / marketplace templates + moderation | A later growth feature; not needed to mint curated templates now. |
| Editing/deleting a saved DB template | V1 is save-new-only (user-confirmed). A re-save mints a new template. |
| Migrating code templates into the DB | Code templates stay in code for back-compat; DB is additive. |
| Deleting code-template renderer code | Hide-not-delete precedent; ~82 carousels still resolve them. |
| A new Gemini model/vendor for recipe extraction | Extraction is deterministic code; stay on the cheapest viable model. |

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| TSTORE-01 | Phase 83 | Pending |
| TSTORE-02 | Phase 83 | Pending |
| TSTORE-03 | Phase 83 | Pending |
| TSTORE-04 | Phase 83 | Pending |
| RECIPE-01 | Phase 84 | Pending |
| RECIPE-02 | Phase 84 | Pending |
| RECGEN-01 | Phase 85 | Pending |
| ADMIN-01 | Phase 86 | Pending |
| ADMIN-02 | Phase 86 | Pending |

**Coverage:** 9/9 v2.14 requirements mapped to exactly one phase (100%). No orphans, no duplicates.

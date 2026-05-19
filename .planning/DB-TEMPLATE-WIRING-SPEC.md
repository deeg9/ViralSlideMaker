# Feature Spec: DB-Backed Template Consumption Wiring

**Created:** 2026-05-19
**Status:** Spec — routes to a new milestone (v2.15 candidate)
**Origin:** v2.14 dry-run (2026-05-19). After v2.14 "Save as Template" shipped and
was archived, an end-to-end dry-run found the feature is **non-functional**:
Phase 83 built the merged code+DB registry functions but the app never wired
them into the picker / generation / render paths.

## Goal

Make a DB-backed template (the v2.14 `templates` table) actually usable
end-to-end: it appears in the generation picker, a user can select it,
generation produces a carousel shaped by its `LayoutRecipe`, all three render
paths render it faithfully, and it survives publish/fork. This closes v2.14's
TSTORE-02 / TSTORE-03 — which currently pass only as isolated unit tests, not
in the running product.

## Background — the gap (verified 2026-05-19)

Phase 83 added, in `src/lib/render/templates/registry.ts`:
- `getPickerTemplates()` — async, merged code+DB picker list
- `resolveTemplate(id)` — async, resolves a code OR DB template by id
- `isKnownTemplateId(id)` — async DB-aware id check

But the wiring into the app was never done:
- **`getPickerTemplates()` has ZERO production callers** — only tests.
- **`resolveTemplate()` is called by exactly one place** — the admin
  Save-as-Template endpoint.
- The actual picker, the generation pipeline, all three render paths, per-slide
  override resolution, and fork/publish still use the **sync, code-only**
  `pickerTemplates` / `getTemplate()` / `TEMPLATE_IDS`.

A DB template therefore breaks at every consumption stage:

| Stage | Behavior with a DB template | Cause |
|-------|------|-------|
| Picker | Never appears | `template-picker.tsx` uses sync code-only `pickerTemplates`, filtered by code-only `categoryModule.templateIds` |
| Generation | Silently snapped to the category default | `generation-form.tsx`, `project/[id]/actions.ts`, `services/carousel.ts` all snap `templateId` to `categoryModule.templateIds` (code-only) |
| Render — canvas / Satori / HTML | Falls back to `highlight-bar` | `/api/render`, `projects/[id]/download`, `publish-actions.ts`, `services/publish.ts` resolve via sync `getTemplate()` → `templates[0]` on an unknown id |
| Per-slide override | Override rejected | `resolve-per-slide-template.ts` validates against code-only `TEMPLATE_IDS` |
| Fork / remix | DB `template_id` lost | `api/v1/explore/[slug]/fork/route.ts` hardcodes `template_id: 'highlight-bar'` |

The v2.14 milestone audit's "cross-phase integration verified" verified the
registry *functions*, not their wiring into the app — the integration genuinely
was not there.

**Only working path today:** admin saves a template (row + recipe + preview
land in the DB). It is then unreachable by any user.

## Requirements

1. **WIRE-01 — DB templates appear in the generation picker.**
   - Current: `TemplatePicker` shows only code templates from the sync
     `pickerTemplates`, filtered by the code-only `categoryModule.templateIds`.
   - Target: the picker shows DB templates too, filtered by the `templates.category`
     column, merged with the category's code templates. DB templates are fetched
     server-side (the project page is a server component) and threaded to the
     client `TemplatePicker`; `getPickerTemplates()` is the merge source.
   - Acceptance: a DB template with `category='news'` appears in the News picker
     with its `preview` PNG tile.

2. **WIRE-02 — generation preserves a selected DB template id.**
   - Current: `generation-form.tsx` (initial state + category-change handler),
     `project/[id]/actions.ts`, and `services/carousel.ts` snap `templateId` to
     `categoryModule.templateIds[0]` whenever the id is not in that code-only
     array — discarding any DB id.
   - Target: the snap logic accepts a DB template id whose `category` matches
     the selected category (DB-aware check, not the code-only array).
   - Acceptance: selecting a DB template and generating produces a carousel
     whose `template_id` is the DB id (not snapped away).

3. **WIRE-03 — all three render paths resolve a DB `template_id`.**
   - Current: `/api/render`, `projects/[id]/download`, `publish-actions.ts`,
     `services/publish.ts` resolve via sync `getTemplate()` → `highlight-bar`
     fallback for a DB id.
   - Target: these call sites use async `resolveTemplate()` (all the routes are
     already async). A carousel on a DB template renders identically across
     canvas preview / Satori PNG / HTML export.
   - Acceptance: a DB-template carousel renders faithfully in all three paths
     (TSTORE-03, finally true in the app).

4. **WIRE-04 — per-slide `template_id_override` accepts a DB id.**
   - Current: `resolve-per-slide-template.ts` rejects any override id not in the
     code-only `TEMPLATE_IDS`.
   - Target: a DB template id is accepted as a valid per-slide override.

5. **WIRE-05 — publish and fork preserve a DB `template_id`.**
   - Current: the fork route hardcodes `template_id: 'highlight-bar'`; publish
     render resolves via sync `getTemplate()`.
   - Target: a published carousel keeps its DB `template_id`; a fork inherits it;
     both render correctly.

6. **WIRE-06 — render parity + byte-identity stay green.**
   - The 13 code templates and the ~82 existing carousels must remain
     byte-identical; `legacy-templates-byte-identical`, `legacy-templates-regression`,
     `new-templates-parity`, and the render-parity fingerprint suites stay green.

## Boundaries

**In scope:** wiring DB templates into the picker UI, the generation pipeline,
all three render paths, per-slide override resolution, and publish/fork — plus
the supporting server-side DB-template fetch and the category-aware merge.

**Out of scope:**
- New template *authoring* capability — v2.14 already shipped the admin
  Save-as-Template flow (and the `flat_style` fix, 2026-05-19, commit `1c87c79`).
- The `LayoutRecipe` model / extraction / recipe-driven generation logic —
  shipped in v2.14 phases 84/85; this milestone only ensures a DB recipe
  template is *reachable* so that logic actually runs.
- End-user / community templates — still deferred.
- Migrating the 13 code templates into the DB — they stay in code.

## Constraints

- **Render-parity (TPLREND-05 / PARITY-01):** code templates + existing
  carousels stay byte-identical; DB templates render identically across all 3
  paths.
- **Sync→async call-site conversions** must not break the render paths — every
  converted call site is already in an async context (route handlers / server
  actions); verify each.
- **Public-by-default:** any generation path touched still routes new carousels
  through `autoPublishOnGenerate`.
- **Closed-enum invariant** holds — `templates.category` is the closed
  `CONTENT_CATEGORIES` set.
- **Shared Supabase project** — no schema migration is expected (the `templates`
  table + `category` column already exist); this is app-layer wiring only.

## Acceptance Criteria

- [ ] A DB template appears in the generation picker under its category, with
      its preview tile.
- [ ] Selecting a DB template and generating yields a carousel with the DB
      `template_id` (not snapped away).
- [ ] A DB-template carousel renders faithfully in canvas preview, Satori PNG
      export, and HTML export.
- [ ] A per-slide DB `template_id_override` resolves instead of being rejected.
- [ ] A published DB-template carousel keeps its `template_id`; a fork inherits
      and renders it.
- [ ] `legacy-templates-byte-identical` + `legacy-templates-regression` +
      `new-templates-parity` + render-parity fingerprint suites stay green.
- [ ] End-to-end dry-run: admin saves a template → it appears in the picker →
      a carousel generated on it comes out recipe-shaped and renders correctly.

## Verified Blast Radius (file-level, from the 2026-05-19 investigation)

**Picker UI**
- `src/components/slides/template-picker.tsx` — uses sync `pickerTemplates`;
  must consume merged DB+code templates filtered by category.
- `src/components/slides/generation-form.tsx` — `templateId` initial state
  (~L65–72) + category-change handler (~L156–162) snap via code-only array.
- `src/components/slides/template-tile-preview.tsx` — already DB-aware
  (renders the `preview` PNG); just needs to actually receive DB templates.

**Generation pipeline**
- `src/app/(dashboard)/project/[id]/actions.ts` — snap logic (~L48–52).
- `src/lib/services/carousel.ts` — snap logic (~L65–70).
- `src/app/api/v1/carousel/route.ts` — no `isKnownTemplateId` validation.

**Render paths (sync `getTemplate` → async `resolveTemplate`)**
- `src/app/api/render/route.ts` (~L92)
- `src/app/api/v1/projects/[id]/download/route.ts` (~L63)
- `src/app/(dashboard)/project/[id]/publish-actions.ts` (~L48, L81)
- `src/lib/services/publish.ts` (~L55)
- `src/lib/render/resolve-per-slide-template.ts` (~L43 — `TEMPLATE_IDS` gate)

**Publish / fork**
- `src/app/api/v1/explore/[slug]/fork/route.ts` (~L37 — hardcoded
  `'highlight-bar'`).

**Category system (merge point)**
- `src/lib/ai/categories/{index,news,facts,types}.ts` — `categoryModule.templateIds`
  is code-only; the picker must additionally surface DB rows by `templates.category`.

**Tests / guards**
- `src/lib/render/templates/__tests__/keeper-curation.test.ts` and
  `new-templates-parity.test.tsx` hardcode `templates.length === 13` — unaffected
  (DB templates are not in `templates[]`), but the keeper test may want
  extending to assert DB-category visibility.

## Recommended Phase Breakdown

Tight — one milestone, ~2 phases:

- **Phase 1 — Picker + generation wiring.** DB templates appear in the picker
  (server-fetch + category-merge), the generation snap logic preserves DB ids,
  the API validates via `isKnownTemplateId`. (WIRE-01, WIRE-02)
- **Phase 2 — Render + override + fork wiring.** Convert the render call sites
  to `resolveTemplate`, accept DB per-slide overrides, preserve `template_id`
  through publish/fork; render-parity + byte-identity re-verified. (WIRE-03,
  WIRE-04, WIRE-05, WIRE-06)

(Could also be a single phase if planned tightly — the two halves share no
schema work and the file sets are disjoint.)

---

*Spec created: 2026-05-19 — from the v2.14 post-ship dry-run.*
*Next step: `/gsd-new-milestone` (v2.15) — this spec is the milestone input.*

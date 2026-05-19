# Roadmap — TikTok Slideshow Creator

## Milestones

- ▶️ **v2.15 DB-Backed Template Wiring** — Phases 87–88 (active)
- ✅ **v2.14 Save as Template** — Phases 83–86 (shipped 2026-05-19)
- ✅ **v2.13 Style-from-Reference Generation** — Phases 73–82 (shipped 2026-05-14)
- ✅ **v2.12 Shapes & Icons (Decoration Primitives)** — Phases 67–72 (shipped 2026-05-04)
- ✅ **v2.11 Full Editor Parity** — Phases 60–66 (shipped 2026-05-03)
- ✅ **v2.10 Text Box Resize Handles** — Phase 59 (shipped 2026-05-02)
- ✅ **v2.9 Viral Visual Quality** — Phases 54–58 (shipped 2026-05-01)
- ✅ **v2.8 Text Editor Right-Rail Redesign** — Phases 49–53 (shipped 2026-04-30)
- ✅ **v2.7 Premium Templates** — Phases 44–48 (shipped 2026-04-29)
- ✅ **v2.6 MCP Server** — Phases 40–43 (shipped 2026-04-28)
- ✅ **v2.5 Public REST API Parity** — Phases 34–39 (shipped 2026-04-28)
- ✅ **v2.4 Explore + Remix** — Phases 26–33 (shipped 2026-04-27)
- ✅ **v2.2 Public REST API** — Phases 20–25 (shipped 2026-04-09)
- ✅ **v2.1 Text Effects** — Phases 17–19 (shipped 2026-04-07)
- ✅ **v2.0 API & MCP Platform** — Phases 14–16 (shipped 2026-04-07)

---

## ▶️ Active Milestone: v2.15 DB-Backed Template Wiring

**Goal:** Make a v2.14 DB-backed template usable end-to-end — pickable in the
generation picker, preserved through generation, rendered identically across all
three render paths, and preserved through publish/fork. This closes v2.14's
TSTORE-02 / TSTORE-03, which passed only as isolated unit tests because Phase
83's merged code+DB registry (`getPickerTemplates` / `resolveTemplate` /
`isKnownTemplateId`) was built but never wired into the app.

**Scope:** 6 requirements (WIRE-01..06), 2 phases. App-layer wiring only — **no
schema migration** (the `templates` table + `category` column already exist
from Phase 83).

**Granularity:** coarse — the spec's verified 2-phase split has disjoint file
sets and no shared schema work; honored as-is.

**Locked constraints (carried into every phase):**
- **Render-parity (TPLREND-05 / PARITY-01) + byte-identity** — the 13 code
  templates and the ~82 existing carousels must stay byte-identical; the
  `legacy-templates-byte-identical`, `legacy-templates-regression`,
  `new-templates-parity`, and render-parity fingerprint suites must stay green.
- **Sync→async call-site conversions** — every `getTemplate` (sync, code-only)
  → `resolveTemplate` (async, code+DB) call-site conversion must not break the
  render paths; each converted site is already in an async context (route
  handler / server action) — verify each individually.
- **Public-by-default** — any generation path touched must still route new
  carousels through `autoPublishOnGenerate` (this helper has regressed 6× —
  do not bypass it).
- **Closed-enum invariant** — `templates.category` is the closed
  `CONTENT_CATEGORIES` set; the category-aware merge must not widen it.
- **No schema migration** — `templates` table + `category` column already
  exist; v2.15 is app-layer wiring only.

> Note: the milestone audit baseline already carries 6 pre-existing fixture-regen
> failures from quick task `260518-jhg` (13th code template). WIRE-06 holds the
> parity/byte-identity suites at that baseline — it does not require fixing the
> pre-existing 6, only ensuring v2.15 introduces no new parity regressions.

## Phases

- [x] **Phase 87: Picker + Generation Wiring** — DB templates appear in the category-filtered picker and survive selection through generation (WIRE-01, WIRE-02) (completed 2026-05-19)
- [x] **Phase 88: Render Paths + Per-Slide Override + Publish/Fork** — all three render paths, per-slide override, and publish/fork resolve a DB `template_id`; parity re-verified (WIRE-03, WIRE-04, WIRE-05, WIRE-06) (completed 2026-05-19)

## Phase Details

### Phase 87: Picker + Generation Wiring
**Goal**: A DB-backed template is reachable — it shows up in the generation
picker under its category with its preview tile, and a user-selected DB
template id survives all the way into the generated carousel instead of being
silently snapped to the category default.
**Depends on**: Phase 86 (v2.14 — DB `templates` table, `getPickerTemplates` /
`isKnownTemplateId` registry functions, `TemplateTilePreview` DB-aware tile).
**Requirements**: WIRE-01, WIRE-02
**Success Criteria** (what must be TRUE):
  1. A DB template with `category='news'` appears in the News picker, rendered
     with its preview-PNG tile via `TemplateTilePreview` — fetched server-side
     (project page is a server component) and merged with the category's code
     templates via `getPickerTemplates()`.
  2. Selecting a DB template and generating produces a carousel whose
     `template_id` is the DB id — the category-snap logic in `generation-form.tsx`
     (initial state + category-change handler), `project/[id]/actions.ts`, and
     `services/carousel.ts` no longer discards a DB id whose `category` matches
     the selected category.
  3. The carousel API (`/api/v1/carousel`) accepts a submitted DB template id —
     validated via the DB-aware `isKnownTemplateId` instead of the code-only
     `categoryModule.templateIds` array.
  4. Switching the picker to a different category and back never discards a DB
     id that belongs to the currently-selected category (the snap fires only
     for genuinely cross-category ids).
  5. A newly generated carousel still defaults to Public — every touched
     generation path still routes through `autoPublishOnGenerate`.
**Plans**:
  - [x] 87-01: Picker wiring — `getPickerDbTemplates` registry helper, the
    `TemplatePicker` DB-first category merge, server-side fetch threaded
    through `GenerationForm` (WIRE-01)
  - [x] 87-02: Generation snap fix — DB-aware snap in `generation-form.tsx` /
    `actions.ts` / `carousel.ts`, `isKnownTemplateId` guard on
    `/api/v1/carousel`, async `resolveTemplate` backgroundMode read (WIRE-02)
**UI hint**: yes

### Phase 88: Render Paths + Per-Slide Override + Publish/Fork
**Goal**: A carousel built on a DB template renders faithfully everywhere it
can be rendered — canvas preview, Satori PNG export, HTML export — accepts a
DB id as a per-slide override, and keeps its `template_id` through publish and
fork, with the code-template / existing-carousel parity guarantees re-verified
intact.
**Depends on**: Phase 87 (a DB template id can now reach a saved carousel; this
phase makes that saved id render and survive publish/fork).
**Requirements**: WIRE-03, WIRE-04, WIRE-05, WIRE-06
**Success Criteria** (what must be TRUE):
  1. A DB-template carousel renders identically across all three render paths —
     canvas preview, Satori PNG export, and HTML export — because `/api/render`,
     `projects/[id]/download`, `publish-actions.ts`, and `services/publish.ts`
     resolve the `template_id` via async `resolveTemplate` instead of the sync
     code-only `getTemplate` (no more silent `highlight-bar` fallback). This is
     TSTORE-03 finally true in the running app, not just unit tests.
  2. A per-slide `template_id_override` set to a DB template id resolves and
     renders, instead of being rejected by the code-only `TEMPLATE_IDS`
     allowlist in `resolve-per-slide-template.ts`.
  3. Publishing a DB-template carousel keeps its DB `template_id`, and forking a
     published DB-template carousel inherits that `template_id` (the fork route
     no longer hardcodes `'highlight-bar'`) — both the published copy and the
     fork render correctly.
  4. The 13 code templates and the ~82 existing carousels stay byte-identical —
     `legacy-templates-byte-identical`, `legacy-templates-regression`,
     `new-templates-parity`, and the render-parity fingerprint suites stay green
     at the milestone baseline (no new parity regression introduced by the
     sync→async conversions).
  5. End-to-end dry-run passes: an admin saves a template → it appears in the
     picker → a carousel generated on it comes out recipe-shaped, renders
     correctly in all three paths, and survives publish + fork.
**Plans**:
  - [x] 88-01: Render-path sync→async conversion — `getTemplate` →
    `resolveTemplate` at the 5 render call sites, `prompts.ts` /
    `generate-slides.ts`, `actions.ts`, and the editor canvas (WIRE-03)
  - [x] 88-02: Per-slide DB-aware override — `getDbTemplatesMap` +
    `resolvePerSlideTemplate` optional sync map threaded through the builders;
    fork route inherits the source `template_id` (WIRE-04, WIRE-05)
  - [x] 88-03: WIRE-06 verification — sync-vs-async byte-identity guard,
    per-slide DB-override parity, fork-inheritance test; fixture suites 45/45
    (WIRE-06)
**UI hint**: no

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 87. Picker + Generation Wiring | v2.15 | 2/2 | ✅ Complete | 2026-05-19 |
| 88. Render Paths + Per-Slide Override + Publish/Fork | v2.15 | 3/3 | ✅ Complete | 2026-05-19 |

_Phases 14–86 (v2.0–v2.14) complete — see milestone archives under `.planning/milestones/`._

---

## Shipped Milestones (archived detail)

<details>
<summary>✅ v2.14 Save as Template (Phases 83–86) — SHIPPED 2026-05-19</summary>

Admin-authored, DB-backed templates that capture a real carousel's full layout recipe — so the team can mint polished picker templates from real carousels with no code deploy, and new carousels generate pre-shaped to them. Closed-enum invariant + TPLREND-05 render parity + byte-identity back-compat preserved throughout.

- [x] **Phase 83: DB-Backed Template Storage + Registry Merge** (3/3 plans) — completed 2026-05-19
- [x] **Phase 84: LayoutRecipe Model + Extraction** (3/3 plans) — completed 2026-05-19
- [x] **Phase 85: Recipe-Driven Generation** (3/3 plans) — completed 2026-05-19
- [x] **Phase 86: Admin Save-as-Template Flow + Previews** (3/3 plans) — completed 2026-05-19

Full detail: `.planning/milestones/v2.14-ROADMAP.md` · Requirements: `.planning/milestones/v2.14-REQUIREMENTS.md` · Audit: `.planning/milestones/v2.14-MILESTONE-AUDIT.md`

</details>

<details>
<summary>✅ v2.13 Style-from-Reference Generation (Phases 73–82) — SHIPPED 2026-05-14</summary>

Vision-LLM-driven style extraction from uploaded slideshow images + spec preview + two content paths + remix/fork/publish snapshot + legal hardening + composition-aware archetype extraction (Phase 80) + first-run onboarding (Phase 81) + category-driven headline-first generation (Phase 82). Full detail: `.planning/milestones/v2.13-ROADMAP.md`.

</details>

<details>
<summary>✅ v2.0–v2.12 (Phases 14–72) — SHIPPED</summary>

- **v2.12 Shapes & Icons (Decoration Primitives)** — Phases 67–72 (shipped 2026-05-04). Lucide icon picker (118-icon allowlist) + 8 Canva-style shapes + full v2.11 editor parity + Gemini AI emit + interactive rotation handles + rotation-aware AABB.
- **v2.11 Full Editor Parity** — Phases 60–66 (shipped 2026-05-03). Multi-select, alignment, group/ungroup, smart guides, lock/hide, z-order, layers panel, power-user differentiators.
- **v2.10 Text Box Resize Handles** — Phase 59 (shipped 2026-05-02).
- **v2.9 Viral Visual Quality** — Phases 54–58 (shipped 2026-05-01).
- **v2.8 Text Editor Right-Rail Redesign** — Phases 49–53 (shipped 2026-04-30).
- **v2.7 Premium Templates** — Phases 44–48 (shipped 2026-04-29).
- **v2.6 MCP Server** — Phases 40–43 (shipped 2026-04-28).
- **v2.5 Public REST API Parity** — Phases 34–39 (shipped 2026-04-28).
- **v2.4 Explore + Remix** — Phases 26–33 (shipped 2026-04-27).
- **v2.2 Public REST API** — Phases 20–25 (shipped 2026-04-09).
- **v2.1 Text Effects** — Phases 17–19 (shipped 2026-04-07).
- **v2.0 API & MCP Platform** — Phases 14–16 (shipped 2026-04-07).

Archives under `.planning/milestones/`.

</details>

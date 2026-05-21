# Roadmap — TikTok Slideshow Creator

## Milestones

- 🚧 **v2.16 Picker Polish & Brand-Kit Shelving** — Phases 89–90 (active, started 2026-05-20)
- ✅ **v2.15 DB-Backed Template Wiring** — Phases 87–88 (shipped 2026-05-19)
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

## Active Milestone: v2.16 Picker Polish & Brand-Kit Shelving

**Goal:** Make the template picker visually represent what users will actually generate (real photo backgrounds, not text-on-solid-color), and shelve the brand-kit feature that's no longer part of the near-term direction.

**Phase numbering:** Continues from v2.15 (last phase 88) → phases 89 and 90.
**Granularity:** coarse (config-driven; two-phase split honored from the milestone spec)
**Coverage:** 14/14 v2.16 requirements mapped (BKSHELVE-01..09 → Phase 89; PREVIEW-01..05 → Phase 90). No orphans, no duplicates.

### Phases

- [x] **Phase 89: Brand-Kit Shelving (Full Removal)** — Delete the brand-kit feature from the user-facing app, types, render/publish/download wiring, AI prompts, and style-from-reference flow; preserve render parity on all 13 code templates + live DB templates.
- [ ] **Phase 90: Pre-Rendered Template Preview Pipeline** — Replace the picker's live-render fallback with real photo-backed preview PNGs sourced from `buyer@example.com`'s published carousels; every code template gets a `preview` URL.

### Phase Details

#### Phase 89: Brand-Kit Shelving (Full Removal)

**Goal**: Fully remove the brand-kit feature from the user-facing app, types, render/publish/download wiring, AI prompts, and style-from-reference flow — without breaking v2.13/v2.14/v2.15 render or generation parity. DB schema is left dormant (NOT migrated).

**Depends on**: Nothing (first phase of v2.16; builds on v2.15 wiring left untouched)

**Requirements**: BKSHELVE-01, BKSHELVE-02, BKSHELVE-03, BKSHELVE-04, BKSHELVE-05, BKSHELVE-06, BKSHELVE-07, BKSHELVE-08, BKSHELVE-09

**Success Criteria** (what must be TRUE):
1. Project picker no longer shows the "Your Brand Kit" tile or the "Build your brand kit" empty-state CTA.
2. `/settings/brand-kit` returns 404 and the brand-kit row in the Settings sidebar is gone; `/api/v1/me/brand-kit/*` calls return 404 and the route is removed from the OpenAPI spec at `/docs`.
3. Existing carousels render and publish identically before and after the removal — byte-identity preserved on all 13 code templates + the live DB-backed templates currently in the `templates` table; the 3 fixture suites (`legacy-templates-byte-identical`, `-regression`, `new-templates-parity`) stay GREEN at 45/45.
4. Style-from-reference shell renders without the brand-kit remix toggle; remix flow still completes successfully via the regular state-spec path (no merge-with-brand-kit branch).
5. Carousel generation succeeds end-to-end (web form + `POST /api/v1/carousel` + MCP `create_carousel`) without any brand-kit param in request bodies; projects whose stored `template_id === 'brand-kit'` resolve to a sensible default (`news-oracle`) instead of crashing.

**Plans**: 4 plans

Plans:
**Wave 1**
- [x] 89-01-PLAN.md — Remove brand-kit UI surfaces: picker tile, Settings page, /api/v1/me/brand-kit/* routes, OpenAPI schema, nav links (BKSHELVE-01..03)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 89-02-PLAN.md — Strip brand-kit from render/publish/download + editor prop chain; add getTemplate('brand-kit') -> news-oracle fallback (BKSHELVE-05, -07)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 89-03-PLAN.md — Strip brand-kit from AI prompts, carousel service, generation form, and style-from-reference flow (BKSHELVE-04, -06, -08)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 89-04-PLAN.md — Relocate BrandKitTextPosition type, delete src/lib/brand-kit/ + types, final tsc + parity sweep (BKSHELVE-09)

**Scope notes**: ~79 files touched across `src/components/`, `src/app/(dashboard)/`, `src/app/api/`, `src/lib/brand-kit/`, `src/lib/types/`, `src/lib/ai/`, `src/lib/render/`, `src/lib/services/`, and tests. The `20260427_brand_kit_template.sql` migration is marked SHELVED but not rolled back; brand-kit DB rows stay dormant on existing accounts. Removal is forward-only — a future revival rebuilds against the same schema rather than toggling old code on. BKSHELVE-05 byte-identity check is the hard gate.

#### Phase 90: Pre-Rendered Template Preview Pipeline

**Goal**: Replace the picker's live-render `<SlidePreview>` fallback with real photo-backed preview PNGs sourced from `buyer@example.com`'s published carousels. Every code template gets a `preview` URL; the picker becomes a single-branch `<img>` component.

**Depends on**: Phase 89 (cleaner picker code surface after brand-kit removal; technically independent but ordering 89-then-90 keeps the picker component's diffs minimal)

**Requirements**: PREVIEW-01, PREVIEW-02, PREVIEW-03, PREVIEW-04, PREVIEW-05

**Success Criteria** (what must be TRUE):
1. Every code template in the project picker (16 templates in `src/lib/render/templates/*.ts`, including `y2k-pop`) renders a real photo-backed preview tile — not text on a solid color, not a `<SlidePreview>` fallback.
2. Newly added or DB-saved templates also render via the same `<img>` path; the picker's preview source is consistent for every tile (code + DB) — verified by Playwright smoke against the project picker showing the picker-visible code templates + live DB templates rendering as `<img>` with valid `src` URLs.
3. The picker no longer mounts `<SlidePreview>` for tiles — `template-tile-preview.tsx` and `template-picker.tsx` no longer import `makeSampleSlide`; the fallback branch is deleted (forcing function — a new code template can't ship without first rendering its preview).
4. Operator (Diego) can re-run `scripts/render-template-previews.ts` after a template redesign and get updated previews uploaded to the `template-previews` Supabase Storage bucket with deterministic paths (`code-templates/{slug}.png`); re-running on an unchanged set is a no-op (idempotent).

**Plans**: 3 plans

Plans:

**Wave 1**
- [x] 90-01-PLAN.md — Build `scripts/render-template-previews.ts` (pure helpers + `main()`, `--dry-run` only) + Wave-0 test scaffolding (PREVIEW-03)

**Wave 2** *(blocked on Wave 1)*
- [ ] 90-02-PLAN.md — Run the pipeline LIVE: generate gap carousels, snapshot covers, upload PNGs, wire `preview` URLs into the 16 template files (PREVIEW-01, -02)

**Wave 3** *(blocked on Wave 2)*
- [ ] 90-03-PLAN.md — Collapse `<TemplateTilePreview>` to single-branch `<img>`, rewrite picker tests, finalize Playwright smoke (PREVIEW-04, -05)

**UI hint**: yes

**Scope notes**: All 16 preview PNGs (RESEARCH.md confirmed 16 code templates, not 15 — `y2k-pop` is the 16th) are sourced from carousels on the `buyer@example.com` account (Diego's pro account = canonical "good-looking exemplar" source — sidesteps stock-photo licensing). The pipeline (or the operator) generates a new carousel on that account for any template that has no exemplar, then snapshots its cover. Uses the existing `template-previews` Supabase Storage bucket from v2.14 Phase 86 and the existing `template.preview` field. One-off render at milestone time — no scheduled refresh. Out of scope: per-slide variants, animated previews, premium-tier picker chrome redesign, picker layout changes.

### Dependencies

```
Phase 89 (Brand-Kit Shelving) ─── must complete first (parity hard-gate BKSHELVE-05)
       │
       ▼
Phase 90 (Pre-Rendered Template Preview Pipeline) ─── builds on simpler picker surface
```

Phase 89 runs first because it's a delete-heavy refactor with a strict byte-identity hard-gate (BKSHELVE-05). Phase 90 is additive and depends on the simpler picker surface left after the brand-kit tile is removed. Both phases benefit from the existing v2.14 `template-previews` Supabase Storage bucket and the v2.14 `template.preview` field already on `SlideTemplate`.

### Coverage Validation

All 14 v2.16 requirements mapped to exactly one phase:

| Requirement | Phase | Status |
|-------------|-------|--------|
| BKSHELVE-01..09 (9 reqs) | Phase 89 | Open |
| PREVIEW-01..05 (5 reqs) | Phase 90 | Open |

**Total:** 14/14 requirements mapped. Zero orphans. Zero duplicates.

### Out of Scope (v2.16)

- Custom photo per slide-in-picker (multiple sample variants) — each template gets exactly one preview.
- Animated/video previews — static PNG only matches the existing `template.preview` contract.
- Rolling preview refresh / cron — one-off render at milestone time; operator re-runs the script on template redesign.
- Rolling back the brand-kit migration — migration stays in the migrations folder marked SHELVED.
- Brand-kit feature flag instead of removal — removal is full and forward-only.
- Premium-template indicator overlay redesign — existing premium-tier marker logic stays.
- Picker layout changes (columns, sort order, category chips) — only the tile preview body changes.

---

## Phases (legacy view)

_Phases 14–88 (v2.0–v2.15) complete — see milestone archives under `.planning/milestones/`. Phases 89–90 active under v2.16._

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 89. Brand-Kit Shelving (Full Removal) | v2.16 | 4/4 | Complete    | 2026-05-21 |
| 90. Pre-Rendered Template Preview Pipeline | v2.16 | 1/3 | In Progress|  |
| 87. Picker + Generation Wiring | v2.15 | 2/2 | ✅ Complete | 2026-05-19 |
| 88. Render Paths + Per-Slide Override + Publish/Fork | v2.15 | 3/3 | ✅ Complete | 2026-05-19 |

_Phases 14–86 (v2.0–v2.14) complete — see milestone archives under `.planning/milestones/`._

---

## Shipped Milestones (archived detail)

<details>
<summary>✅ v2.15 DB-Backed Template Wiring (Phases 87–88) — SHIPPED 2026-05-19</summary>

Made a v2.14 DB-backed template usable end-to-end — pickable in the generation picker, preserved through generation, rendered identically across all three render paths, and preserved through publish/fork. Closed v2.14's TSTORE-02 / TSTORE-03, which previously passed only as isolated unit tests because Phase 83's merged code+DB registry was built but never wired into the app. App-layer wiring only — no schema migration. Verified by a live end-to-end Playwright dry-run.

- [x] **Phase 87: Picker + Generation Wiring** (2/2 plans) — completed 2026-05-19
- [x] **Phase 88: Render Paths + Per-Slide Override + Publish/Fork** (3/3 plans) — completed 2026-05-19

Full detail: `.planning/milestones/v2.15-ROADMAP.md` · Requirements: `.planning/milestones/v2.15-REQUIREMENTS.md` · Audit: `.planning/milestones/v2.15-MILESTONE-AUDIT.md`

</details>

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

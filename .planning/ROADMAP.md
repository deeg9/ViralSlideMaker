# Roadmap — TikTok Slideshow Creator

## Milestones

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

## Phases

<details>
<summary>✅ v2.14 Save as Template (Phases 83–86) — SHIPPED 2026-05-19</summary>

Admin-authored, DB-backed templates that capture a real carousel's full layout recipe — so the team can mint polished picker templates from real carousels with no code deploy, and new carousels generate pre-shaped to them. Closed-enum invariant + TPLREND-05 render parity + byte-identity back-compat preserved throughout.

- [x] **Phase 83: DB-Backed Template Storage + Registry Merge** (3/3 plans) — completed 2026-05-19
  - [x] 83-01: Additive `templates` table migration — text PK, flat_style + nullable layout_recipe/preview, created_by FK, public-read RLS deny-by-default writes (TSTORE-01)
  - [x] 83-02: Async hybrid registry merge — resolveTemplate / getPickerTemplates / isKnownTemplateId, ~60s TTL cache, code-wins collision rule, fetcher test seam (TSTORE-02)
  - [x] 83-03: DB-template render parity across canvas/Satori/HTML + sync/async byte-identity guard (TSTORE-03, TSTORE-04)
- [x] **Phase 84: LayoutRecipe Model + Extraction** (3/3 plans) — completed 2026-05-19
  - [x] 84-01: LayoutRecipe type model + closed-enum tuples — role-keyed cover/body/cta contract, 7 `as const` tuples, `schema_version: 1` (RECIPE-01)
  - [x] 84-02: parseLayoutRecipeSafe zod validator — two-phase firewall, closed-enum silent-drop, numeric range-clamp, unknown-key stripping (RECIPE-01)
  - [x] 84-03: Deterministic LayoutRecipe extraction + flat style + Oracle proof — pure `extractLayoutRecipe`, no Gemini (RECIPE-02)
- [x] **Phase 85: Recipe-Driven Generation** (3/3 plans) — completed 2026-05-19
  - [x] 85-01: Recipe-apply core — applyLayoutRecipe projection module + recipe semantic-hint block in buildSystemPrompt
  - [x] 85-02: Wire both generateCarousel paths through recipe resolution + applyLayoutRecipe before save
  - [x] 85-03: SC2 Oracle-look, SC3 byte-identical, SC4 public-by-default verification tests
- [x] **Phase 86: Admin Save-as-Template Flow + Previews** (3/3 plans) — completed 2026-05-19
  - [x] 86-01: Admin auth helper + preview-render helper + template-previews storage bucket
  - [x] 86-02: Admin Save-as-Template flow — save endpoint + (admin) route group + authoring page
  - [x] 86-03: Template picker renders DB-template cover-snapshot preview PNGs

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

### ▶ Next Milestone (planned)

No active milestone. Run `/gsd-new-milestone` to start the next cycle.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 83. DB-Backed Template Storage + Registry Merge | v2.14 | 3/3 | Complete | 2026-05-19 |
| 84. LayoutRecipe Model + Extraction | v2.14 | 3/3 | Complete | 2026-05-19 |
| 85. Recipe-Driven Generation | v2.14 | 3/3 | Complete | 2026-05-19 |
| 86. Admin Save-as-Template Flow + Previews | v2.14 | 3/3 | Complete | 2026-05-19 |

_Phases 14–82 (v2.0–v2.13) complete — see milestone archives under `.planning/milestones/`._

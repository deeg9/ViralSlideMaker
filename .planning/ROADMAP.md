# Roadmap — TikTok Slideshow Creator

## Milestones

- ✅ **v2.16 Picker Polish & Brand-Kit Shelving** — Phases 89–90 (shipped 2026-05-21)
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

## Phases (legacy view)

_Phases 14–90 (v2.0–v2.16) complete — see milestone archives under `.planning/milestones/`._

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 89. Brand-Kit Shelving (Full Removal) | v2.16 | 4/4 | ✅ Complete | 2026-05-21 |
| 90. Pre-Rendered Template Preview Pipeline | v2.16 | 3/3 | ✅ Complete | 2026-05-21 |

_Phases 14–88 (v2.0–v2.15) complete — see milestone archives under `.planning/milestones/`._

---

## Shipped Milestones (archived detail)

<details>
<summary>✅ v2.16 Picker Polish & Brand-Kit Shelving (Phases 89–90) — SHIPPED 2026-05-21</summary>

Made the template picker visually represent what users actually generate (real photo-backed preview PNGs, no more text-on-solid-color), and fully shelved the brand-kit feature.

- [x] **Phase 89: Brand-Kit Shelving (Full Removal)** (4/4 plans) — completed 2026-05-21. Removed the brand-kit feature across ~79 files (picker tile, Settings page, `/api/v1/me/brand-kit/*` routes, render/publish/download wiring, AI prompts, style-from-reference flow, `src/lib/brand-kit/` + types); added the defensive `brand-kit → news-oracle` resolver fallback. Render parity 45/45 held; DB schema left dormant.
- [x] **Phase 90: Pre-Rendered Template Preview Pipeline** (3/3 plans) — completed 2026-05-21. Built `scripts/render-template-previews.ts`, ran it live (16 code-template cover PNGs sourced from `christopherfill9@gmail.com`'s carousels, uploaded to the `template-previews` Supabase bucket, `preview` URLs wired into all 16 template files); collapsed `<TemplateTilePreview>` to a single-branch `<img>`.

Full detail: `.planning/milestones/v2.16-ROADMAP.md` · Requirements: `.planning/milestones/v2.16-REQUIREMENTS.md` · Audit: `.planning/milestones/v2.16-MILESTONE-AUDIT.md`

</details>

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

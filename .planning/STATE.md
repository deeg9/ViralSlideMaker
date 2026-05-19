---
gsd_state_version: 1.0
milestone: v2.14
milestone_name: Save as Template
status: in_progress
last_updated: "2026-05-19T00:00:00.000Z"
last_activity: 2026-05-19
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-18 — v2.14 milestone started)
Feature spec: .planning/SAVE-AS-TEMPLATE-SPEC.md (authoritative)

**Core value:** Type a topic, get ready-to-post carousel slide images — fully AI-generated, editable, downloadable.
**Current focus:** Phase 86 — Admin Save-as-Template Flow + Previews (last remaining phase)
**Milestone goal (v2.14):** Admin-authored, DB-backed templates that capture a real carousel's full layout recipe — so the team can mint polished picker templates from real carousels with no code deploy, and new carousels generate pre-shaped to them.

## Current Position

Phase: 86 of 4 (Admin Save-as-Template Flow + Previews)
Plan: — (not yet planned)
Status: Phases 83, 84, 85 complete (9/9 plans) — ready to plan Phase 86
Last activity: 2026-05-19 — Phases 83/84/85 shipped to `main`; tracking trued up (84 summaries + roadmap + state)

Progress: [███████░░░] 75%

## v2.14 Phase Map

| Phase | Name | Reqs | Depends | Status |
|-------|------|------|---------|--------|
| 83 | DB-Backed Template Storage + Registry Merge | TSTORE-01..04 | — | ✅ Complete (2026-05-19) |
| 84 | LayoutRecipe Model + Extraction | RECIPE-01, RECIPE-02 | 83 | ✅ Complete (2026-05-19) |
| 85 | Recipe-Driven Generation | RECGEN-01 | 84 | ✅ Complete (2026-05-19) |
| 86 | Admin Save-as-Template Flow + Previews | ADMIN-01, ADMIN-02 | 83 (storage); benefits from 84/85 | ⬜ Not started |

**Total:** 9 reqs across 4 categories (TSTORE / RECIPE / RECGEN / ADMIN). 100% coverage; no orphans, no duplicates.
**Execution order:** 83 → 84 → 85 → 86. **Progress:** 3 of 4 phases complete (9/9 plans); Phase 86 remaining.

## Cross-Phase Constraints (carry-forward — every plan must honor)

| Constraint | Notes |
|------------|-------|
| Closed-enum invariant | `LayoutRecipe` fields are closed enums wherever feasible — defends schema + injection surface. Phase 84 owns. |
| TPLREND-05 / render-parity | 13 code templates stay byte-identical; DB templates + recipe-shaped slides render identical across all 3 render paths (canvas / Satori PNG / HTML). |
| Additive, reversible migrations | Shared prod Supabase project — migration changes how *no* existing carousel renders; follow project migration discipline. |
| No new Gemini tier | Recipe extraction is deterministic code, no new AI call/vendor. |
| Admin gating is real auth | Server-enforced role check, mirrored on every Save-as-Template endpoint (model on `src/app/api/admin/seed-explore/route.ts`). |
| Public-by-default | Any touched generation path routes new carousels through `autoPublishOnGenerate` (this helper has regressed 6× — verify). |
| V1 save-new-only | No edit/delete of a DB template after save; a re-save mints a new one. |
| Code templates stay in code | The 13 code templates are NOT migrated into the DB — DB storage is additive (back-compat for ~82 existing carousels). |

## Performance Metrics

**Velocity (through v2.13):**
- Milestones shipped: v1.0–v2.13. Latest: v2.13 Style-from-Reference Generation (Phases 73–82, shipped 2026-05-14).
- Tests trajectory: v2.12 ended ~960; v2.13 added substantial coverage across phases 73–82.

**v2.14 Progress:** 3/4 phases complete; 9 plans complete; 7/9 reqs satisfied (TSTORE-01..04, RECIPE-01/02, RECGEN-01) — ADMIN-01/02 remain in Phase 86.

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 83. DB-Backed Template Storage + Registry Merge | 3/3 | Complete — verification passed, review clean |
| 84. LayoutRecipe Model + Extraction | 3/3 | Complete — verification passed (4/4 SC), review clean |
| 85. Recipe-Driven Generation | 3/3 | Complete — verification passed, review clean |
| 86. Admin Save-as-Template Flow + Previews | 0/TBD | Not started |

**Recent Trend:** Phases 83–85 executed and shipped to `main`; recipe-driven generation pipeline complete. Only the admin Save-as-Template flow + previews (Phase 86) remains.

*Updated after each plan completion.*

## Accumulated Context

### Decisions

Decisions logged in PROJECT.md Key Decisions table. Milestone-level decisions (from SAVE-AS-TEMPLATE-SPEC.md, locked 2026-05-18):

- [v2.14 / spec]: Admin-only authoring; saved templates go global to every user's picker. End-user and community/publishable templates explicitly deferred.
- [v2.14 / spec]: Saved templates capture the full layout recipe (per-slide caption-card geometry, hook positions/sizes, accent/highlight rhythm, accessory labels), not just flat style — this is what makes new carousels generate pre-shaped.
- [v2.14 / spec]: Templates are DB-backed; the code registry + DB rows merge into one picker list; no code deploy to add a template. The 13 code templates stay in code (back-compat).
- [v2.14 / spec]: V1 is save-new-only — no editing or deleting a saved DB template; a re-save mints a new one.
- [v2.14 / roadmap]: 4 phases (83–86), the spec's user-approved breakdown. 9 reqs mapped 1:1 — 83=TSTORE-01..04, 84=RECIPE-01/02, 85=RECGEN-01, 86=ADMIN-01/02. Dependencies 83→84→85; 86 depends on 83 (storage), benefits from 84/85.
- [v2.14 / roadmap]: Phase 85 (recipe-driven generation) absorbs the removed placeholder Phase 83 ("template-driven layout generation").

### Pending Todos

- v2.14: Run `/gsd-plan-phase 86` to plan the admin Save-as-Template flow + picker previews (last phase of the milestone).

### Blockers/Concerns

- [Phase 85] Highest blast radius of the milestone — recipe-driven generation touches the live generation pipeline (`prompts.ts`, `style-spec-projector.ts`, `style-spec-projector-constants.ts`, `validate-slides.ts`) and affects every generated carousel for a category on a recipe-carrying template. Needs heavy verification: recipe-carrying generations must come out pre-shaped without regressing flat-style-only (no-recipe) generations, and within generation-perf budgets (cf. v2.12 `template_id_override` open-string runaway, ~148s → ~2s fix).
- [Phase 83] Migration hits the shared prod Supabase project — must be additive + reversible; byte-identity for 13 code templates + ~82 existing carousels (TSTORE-04 / TPLREND-05) is the ship gate.

### Open Questions (from spec — to resolve during plan-phase)

- Recipe extraction: fully deterministic code (preferred — no new AI call) vs. Gemini-assisted classification. Roadmap assumes deterministic per the no-new-Gemini-tier constraint.
- DB-template preview images: new Supabase storage bucket (`template-previews`?) vs. regenerable live `sample` payload — decide in Phase 86.
- Save-as-Template MCP surface: spec leans web admin UI (MCP is for building source carousels, not saving) — confirm in Phase 86 planning.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Templates | End-user (non-admin) template saving | Deferred to future milestone | v2.14 spec |
| Templates | Community / publishable / marketplace templates + moderation | Deferred to future milestone | v2.14 spec |
| Templates | Editing/deleting a saved DB template | V1 is save-new-only | v2.14 spec |
| Templates | Migrating the 13 code templates into the DB | Stay in code (back-compat) | v2.14 spec |
| QA | Carry-over manual QA from v2.10/v2.12/v2.13 (iPhone Safari touch, Lucide picker perf, template visual fidelity) | Carried forward | prior milestones |

## Session Continuity

Last session: 2026-05-19 00:00
Stopped at: Phases 83, 84, 85 complete and shipped to `main` (9/9 plans; all VERIFICATION passed, REVIEW clean). Tracking trued up — Phase 84's 3 per-plan SUMMARY files written, ROADMAP checkboxes + Plans sub-lists corrected, STATE.md synced to 75%.
Resume file: None — next step is `/gsd-plan-phase 86`.

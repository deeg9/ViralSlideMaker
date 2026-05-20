---
gsd_state_version: 1.0
milestone: v2.15
milestone_name: DB-Backed Template Wiring
status: Awaiting next milestone
stopped_at: Phase 88 (Render Paths + Per-Slide Override + Publish/Fork) executed — plan → execute → code-review chain complete. The 5 render-path call sites + prompts + generation + editor canvas resolve a DB `template_id` via async `resolveTemplate` (WIRE-03); per-slide `template_id_override` is DB-aware (WIRE-04); fork inherits the source `template_id` (WIRE-05); parity re-verified (WIRE-06). Code review `clean`; verification `human_needed` (the end-to-end dry-run). v2.15 is the final milestone phase — all phases complete.
last_updated: "2026-05-20T00:22:58.776Z"
last_activity: 2026-05-19 — Completed quick task 260519-o55: Extract Photo overlay into its own portlet
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-19 — after v2.15 milestone)

**Core value:** Type a topic, get ready-to-post carousel slide images — fully AI-generated, editable, downloadable.
**Current focus:** None — v2.15 shipped. Next: `/gsd-new-milestone` to scope the next cycle.
**Latest shipped:** v2.15 DB-Backed Template Wiring (2026-05-19) — wires v2.14's DB-backed templates through the picker, generation, all three render paths, per-slide override, and publish/fork; verified by a live end-to-end Playwright dry-run.

## Current Position

Phase: Milestone v2.15 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-05-19 — Completed quick task 260519-o55: Extract Photo overlay into its own portlet

## Roadmap — v2.15 (Phases 87–88)

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 87. Picker + Generation Wiring | DB templates appear in the category-filtered picker and survive selection through generation | WIRE-01, WIRE-02 | ✅ Complete (2026-05-19) |
| 88. Render Paths + Per-Slide Override + Publish/Fork | All three render paths, per-slide override, and publish/fork resolve a DB `template_id`; parity re-verified | WIRE-03, WIRE-04, WIRE-05, WIRE-06 | ✅ Complete (2026-05-19) — verification human_needed (e2e dry-run) |

**Coverage:** 6/6 v2.15 requirements mapped (no orphans, no duplicates).

## Milestone History

15 milestones shipped (v1.0–v2.15, Phases 1–88). Latest:

| Milestone | Phases | Shipped | Notes |
|-----------|--------|---------|-------|
| v2.15 DB-Backed Template Wiring | 87–88 | 2026-05-19 | Wires v2.14 DB templates through picker / generation / render paths / per-slide override / publish-fork. passed audit (6/6 reqs, Nyquist COMPLIANT, non-critical debt only); live e2e Playwright dry-run. |
| v2.14 Save as Template | 83–86 | 2026-05-19 | DB-backed templates + LayoutRecipe + recipe-driven generation + admin Save-as-Template flow. tech_debt audit (9/9 reqs, non-critical debt only). |
| v2.13 Style-from-Reference Generation | 73–82 | 2026-05-14 | Vision-LLM style extraction + recipe preview + remix/fork. |

Full history: `.planning/MILESTONES.md`. Archives: `.planning/milestones/`.

## Performance Metrics

**Velocity (through v2.14):**

- 14 milestones shipped (v1.0–v2.14, Phases 1–86).
- v2.14: 4 phases, 12 plans, ~107 phase tests added, 53 commits, single-day execution (2026-05-18).
- v2.15 Phase 87: 2 plans, 22 new tests added (WIRE-01 + WIRE-02 coverage on both generation paths + the API guard).
- v2.15 Phase 88: 3 plans, 15 new tests added (byte-identity guard, per-slide DB-override parity, fork-inheritance). 14 source files converted sync→async / DB-aware.
- Full suite: zero new failures from Phase 88 — the failing-test-FILE set is byte-identical to clean HEAD. The 3 fixture suites (`legacy-templates-byte-identical`, `-regression`, `new-templates-parity`) stay GREEN at 45/45. The pre-existing failing baseline is unchanged Phase-87→Phase-88.

## Accumulated Context

### Decisions

- **2-phase split honored from the spec** — `.planning/DB-TEMPLATE-WIRING-SPEC.md` verified the file-level blast radius and recommended a tight 2-phase breakdown; the file sets are disjoint and there is no shared schema work, so the roadmap honors it as-is. Config granularity (`coarse`) favors the same shape.
- **No schema migration in v2.15** — the `templates` table + `category` column already exist (Phase 83); this milestone is app-layer wiring only.

Decisions logged in PROJECT.md Key Decisions table (v2.14 decisions added at milestone close). Per-milestone decision logs live in the milestone archives.

### Blockers/Concerns

No open milestone blockers. All v2.15 phase-risks resolved:

- **Sync→async conversion in Phase 88** — RESOLVED. All 5 render-path `getTemplate`→`resolveTemplate` sites verified in async contexts; `resolvePerSlideTemplate` and `buildSystemPrompt` kept SYNC via optional params (a literal asyncification would cascade into 7 client components + 40+ test files). Byte-identity guard proves the conversion is behavior-neutral for the 13 code templates.
- **`autoPublishOnGenerate` regression risk in Phase 87** — RESOLVED (Phase 87 verified).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260519-hym | Snap generated headline text into caption-card geometry | 2026-05-19 | 0db74ab | [260519-hym-snap-generated-headline-text-into-captio](./quick/260519-hym-snap-generated-headline-text-into-captio/) |
| 260519-k14 | Add Photo overlay panel to slide background controls | 2026-05-19 | 51ac805 | [260519-k14-add-photo-overlay-panel-to-slide-backgro](./quick/260519-k14-add-photo-overlay-panel-to-slide-backgro/) |
| 260519-o55 | Extract Photo overlay into its own portlet | 2026-05-19 | b090df2 | [260519-o55-extract-photo-overlay-into-its-own-portl](./quick/260519-o55-extract-photo-overlay-into-its-own-portl/) |
| 260519-pkt | Pin right-rail actions portlet + remove SAVE CHANGES button | 2026-05-19 | 5df6ce9 | [260519-pkt-pin-actions-portlet-remove-save-button](./quick/260519-pkt-pin-actions-portlet-remove-save-button/) |
| 260519-d7g | Hook drag forwards to caption-card drag | 2026-05-19 | 9a1b4fe | [260519-d7g-hook-drag-forwards-to-caption-card](./quick/260519-d7g-hook-drag-forwards-to-caption-card/) |
| 260519-hnp | Inline hint pill component + caption-card drag hint | 2026-05-19 | _pending_ | [260519-hnp-inline-hint-pill-component](./quick/260519-hnp-inline-hint-pill-component/) |

### Open Items (carried forward)

- **Phase 88 end-to-end dry-run — DONE (PASSED 2026-05-19).** The orchestrator drove the live Playwright dry-run: admin save → picker → generate → render → publish → fork — all WIRE-01..06 confirmed. The one fork failure encountered was a pre-existing prod bug (missing `_strip_locked_from_slide_data` fn + 2 unapplied migrations) — fixed by applying `20260504_fork_strip_decoration_locked` to Supabase; not a v2.15 defect. See `88-VERIFICATION.md`.
- **Pre-existing test debt:** the 3 fixture suites `legacy-templates-byte-identical` / `-regression` / `new-templates-parity` are GREEN at 45/45. The failing baseline is unrelated tests (auth / stripe / legal / api-keys / editorial-serif-name fixture-regen); v2.15 introduced ZERO new failures and added 37 new passing tests.
- **v2.14 operational user-setup:** if not already applied — set `ADMIN_USER_IDS` env var in `.env.local` + Vercel (Diego's dev user id: `ed8ca688-ec50-4c8c-834e-1b9f562eee8a`) and apply `supabase/migrations/20260519_phase86_template_previews_bucket.sql` to the shared Supabase project.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Templates | End-user / community template authoring + picker surfacing community templates | Deferred to future milestone | v2.15 requirements |
| Templates | Editing or deleting a saved DB template | V1 is save-new-only | v2.15 requirements |
| Templates | Explicit registry cache invalidation on template write | v1 accepts the ≤60s TTL | v2.15 requirements |
| Templates | Migrating the 13 code templates into the DB | Stay in code (back-compat) | v2.14 spec |
| QA | Carry-over manual QA from v2.10/v2.12/v2.13 (iPhone Safari touch, Lucide picker perf, template visual fidelity) | Carried forward | prior milestones |

## Session Continuity

Last session: 2026-05-19
Stopped at: Phase 88 (Render Paths + Per-Slide Override + Publish/Fork) executed — plan → execute → code-review chain complete. The 5 render-path call sites + prompts + generation + editor canvas resolve a DB `template_id` via async `resolveTemplate` (WIRE-03); per-slide `template_id_override` is DB-aware (WIRE-04); fork inherits the source `template_id` (WIRE-05); parity re-verified (WIRE-06). Code review `clean`; verification `human_needed` (the end-to-end dry-run). v2.15 is the final milestone phase — all phases complete.
Resume file: None — next step is the Phase 88 end-to-end dry-run, then `/gsd-complete-milestone`.

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone

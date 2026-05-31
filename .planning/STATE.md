---
gsd_state_version: 1.0
milestone: v2.17
milestone_name: Mobile Optimization
status: ready_to_plan
last_updated: "2026-05-31T18:10:00.000Z"
last_activity: 2026-05-31
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-31 — v2.17 in progress)

**Core value:** Type a topic, get ready-to-post carousel slide images — fully AI-generated, editable, downloadable.
**Current focus:** v2.17 Mobile Optimization, Phase 91 — Cross-Cutting Mobile Foundation.
**Latest shipped:** v2.16 Picker Polish & Brand-Kit Shelving (2026-05-21).

## Current Position

Phase: 91 of 95 (Cross-Cutting Mobile Foundation)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-05-31 — Roadmap created for v2.17 (Phases 91–95)

Progress: [░░░░░░░░░░] 0%

## Roadmap — v2.17 (Phases 91–95) 🚧 IN PROGRESS

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 91. Cross-Cutting Mobile Foundation | `viewport-fit=cover` + iOS safe-area insets, `dvh` shells, global 44px tap targets, input zoom/contrast fixes — the cross-cutting prerequisite for everything else | FOUND-01..04 (4 reqs) | Ready to plan |
| 92. Editor Touch-Edit Validation Gate | Verify (and repair if broken) tap-to-edit-text on a **physical iPhone** before any layout rework | EDIT-01 (1 req) | Not started — device gate |
| 93. Editor Mobile Layout Rework | Bottom-sheet primitive + canvas-dominant chrome re-host + persistent thumb action bar + safe destructive actions + filmstrip affordance | EDIT-02..06 (5 reqs) | Not started |
| 94. App-Wide Mobile Polish | Template-picker grid, settings sub-nav, swipeable public viewer, 393px typography/spacing | POLISH-01..04 (4 reqs) | Not started (parallelizable after 91) |
| 95. Logged-Out & Auth Mobile Pass | Landing + auth screens at 393px — **blocked on a login credential** | AUTH-01..02 (2 reqs) | Not started — credential-blocked |

**Coverage:** 16/16 v2.17 requirements mapped (no orphans, no duplicates). Build order is forced: 91 must land first (`env()` reads 0 without `viewport-fit=cover`); 92 (touch gate) must pass before 93; 94 may run parallel with 92–93; 95 is sequenced last (credential-blocked) but only hard-depends on 91.

## Milestone History

16 milestones shipped (v1.0–v2.16, Phases 1–90). Latest:

| Milestone | Phases | Shipped | Notes |
|-----------|--------|---------|-------|
| v2.16 Picker Polish & Brand-Kit Shelving | 89–90 | 2026-05-21 | Removed brand-kit (~79 files); real photo-backed picker previews for 16 code templates. tech_debt audit. |
| v2.15 DB-Backed Template Wiring | 87–88 | 2026-05-19 | Wires v2.14 DB templates through picker / generation / render / publish-fork. passed audit. |
| v2.14 Save as Template | 83–86 | 2026-05-19 | DB-backed templates + LayoutRecipe + recipe-driven generation + admin Save-as-Template flow. |

Full history: `.planning/MILESTONES.md`. Archives: `.planning/milestones/`.

## Accumulated Context

### Decisions (v2.17)

- **5-phase shape under coarse granularity** — phases derived from the research's forced dependency order (Foundation → Touch Gate → Editor Rework → Polish → Auth), not padded. The bottom-sheet primitive is folded into Phase 93 (its sole consumer) rather than a standalone phase — coarse compression.
- **Touch gate (Phase 92 / EDIT-01) is a hard predecessor of the editor rework (93)** — building bottom sheets around a broken tap-to-edit path wastes effort; verify/repair on the physical iPhone first.
- **Zero new heavy deps** — bottom sheet on the already-installed `@radix-ui/react-dialog`; touch via existing Pointer Events / react-rnd. `@use-gesture/react` / `vaul` explicitly out of scope (pinch-zoom deferred to v2.18+).
- **CSS + one-line-config milestone** — the `viewport` export in `layout.tsx` (`viewportFit: 'cover'`) is the single change that unlocks all safe-area work; `100vh` → `dvh` for full-height shells.
- **Auth phase (95) kept separable** — externally blocked on a login credential; sequenced last so the credential dependency can't stall the editor track.

Decisions logged in PROJECT.md Key Decisions table at milestone close.

### Blockers/Concerns

- **Login credential (Phase 95)** — AUTH-01/02 cannot be audited or round-tripped without a credential to log back in after logout. External dependency; flag before planning Phase 95.
- **Real-device validation is a hard exit criterion** — Phases 91–93 need physical-iPhone checkpoints (safe-area insets, `100vh` URL-bar collapse, keyboard overlay, real touch). Playwright cannot reproduce these. Budget a mid-Phase-93 device pass, not only an end-of-phase one.
- **Tap-to-edit-text is UNVERIFIED (Phase 92 #1 risk)** — repair scope is medium (pointer tap/drag disambiguation + synchronous `.focus()` inside the gesture handler + react-rnd drag-threshold) IF broken; must be confirmed on device before Phase 93.

## Deferred Items

Carried forward from prior milestone closes (still open):

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| QA | iPhone Safari touch QA carried from v2.10/v2.12 (corner resize handles, touch editing) | Now directly addressed by v2.17 Phase 92 | prior milestones |
| UAT | v2.16 Phase 90 — visual review of the 16 preview PNGs + authenticated Playwright picker smoke | Tracked in `90-HUMAN-UAT.md` (partial) | v2.16 close |
| UAT | v2.16 Phase 89 — 5 live-runtime confirmations | Code-level evidence verified; `89-VERIFICATION.md` | v2.16 close |
| v2.14 ops | Set `ADMIN_USER_IDS` on Vercel + apply `20260519_phase86_template_previews_bucket.sql` if not already done | Carried | v2.14 close |
| Hardening | DB template with NULL `preview` renders a broken `<img>` (no `onError` fallback) | Low risk | v2.16 close |
| Templates | End-user/community template authoring; edit/delete of a saved DB template | Deferred | v2.14/v2.15 |

## Session Continuity

Last session: 2026-05-31
Stopped at: Roadmap created for v2.17 (Phases 91–95). 16/16 requirements mapped, no orphans. Forced build order honored (Foundation → Touch Gate → Editor Rework → Polish → Auth).
Resume file: `.planning/ROADMAP.md`

## Operator Next Steps

- Plan the first phase: `/gsd-plan-phase 91`
- Before Phase 92/93: confirm the physical iPhone is on hand for the device-validation checkpoints.
- Before Phase 95: obtain a login credential to round-trip the auth flows.

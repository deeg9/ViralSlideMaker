---
gsd_state_version: 1.0
milestone: v2.16
milestone_name: Picker Polish & Brand-Kit Shelving
status: milestone_complete
stopped_at: "Roadmap created for v2.16 (Phases 89–90). Phase 89 — Brand-Kit Shelving (Full Removal, BKSHELVE-01..09); Phase 90 — Pre-Rendered Template Preview Pipeline (PREVIEW-01..05). 14/14 requirements mapped, no orphans. Next step: `/gsd-plan-phase 89` to begin planning Phase 89."
last_updated: "2026-05-21T03:26:17.561Z"
last_activity: 2026-05-21 -- Phase 90 execution started
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 7
  completed_plans: 4
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-19 — after v2.15 milestone)

**Core value:** Type a topic, get ready-to-post carousel slide images — fully AI-generated, editable, downloadable.
**Current focus:** Phase 90 — Pre-Rendered Template Preview Pipeline
**Latest shipped:** v2.15 DB-Backed Template Wiring (2026-05-19) — wires v2.14's DB-backed templates through the picker, generation, all three render paths, per-slide override, and publish/fork; verified by a live end-to-end Playwright dry-run.

## Current Position

Phase: 90
Plan: Not started
Status: Milestone complete
Last activity: 2026-05-21

## Roadmap — v2.16 (Phases 89–90)

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 89. Brand-Kit Shelving (Full Removal) | Fully remove the brand-kit feature from the user-facing app, types, render/publish/download wiring, AI prompts, and style-from-reference flow without breaking render parity on 13 code templates + live DB templates | BKSHELVE-01..09 (9 reqs) | Not started |
| 90. Pre-Rendered Template Preview Pipeline | Replace the picker's live-render `<SlidePreview>` fallback with real photo-backed preview PNGs sourced from `buyer@example.com`'s published carousels; every code template gets a `preview` URL | PREVIEW-01..05 (5 reqs) | Not started |

**Coverage:** 14/14 v2.16 requirements mapped (no orphans, no duplicates).

## Milestone History

15 milestones shipped (v1.0–v2.15, Phases 1–88). Latest:

| Milestone | Phases | Shipped | Notes |
|-----------|--------|---------|-------|
| v2.15 DB-Backed Template Wiring | 87–88 | 2026-05-19 | Wires v2.14 DB templates through picker / generation / render paths / per-slide override / publish-fork. passed audit (6/6 reqs, Nyquist COMPLIANT, non-critical debt only); live e2e Playwright dry-run. |
| v2.14 Save as Template | 83–86 | 2026-05-19 | DB-backed templates + LayoutRecipe + recipe-driven generation + admin Save-as-Template flow. tech_debt audit (9/9 reqs, non-critical debt only). |
| v2.13 Style-from-Reference Generation | 73–82 | 2026-05-14 | Vision-LLM style extraction + recipe preview + remix/fork. |

Full history: `.planning/MILESTONES.md`. Archives: `.planning/milestones/`.

## Performance Metrics

**Velocity (through v2.15):**

- 15 milestones shipped (v1.0–v2.15, Phases 1–88).
- v2.15: 2 phases, 5 plans, 37 new tests added, single-day execution (2026-05-19).
- v2.14: 4 phases, 12 plans, ~107 phase tests added, 53 commits, single-day execution (2026-05-18).
- Full suite (pre-v2.16): zero new failures from v2.15. The 3 fixture suites (`legacy-templates-byte-identical`, `-regression`, `new-templates-parity`) stay GREEN at 45/45. The pre-existing failing baseline is unrelated tests (auth / stripe / legal / api-keys / editorial-serif-name fixture-regen).

## Accumulated Context

### Decisions

- **2-phase split (89 → 90)** — Phase 89 runs first (delete-heavy refactor with parity hard-gate BKSHELVE-05). Phase 90 runs second (additive; depends on simpler picker surface after brand-kit removal). Granularity `coarse` favors this tight shape.
- **Brand-kit DB stays dormant** — no rollback of the `20260427_brand_kit_template.sql` migration; brand-kit rows survive but unused. Removal is forward-only — future revival rebuilds against the same schema rather than toggling old code on.
- **Preview source = `buyer@example.com`'s published carousels** — sidesteps stock-photo licensing, guarantees previews depict what generation actually produces today. One-off script (`scripts/render-template-previews.ts`) renders cover snapshots and uploads to the existing `template-previews` Supabase bucket from v2.14 Phase 86.
- **`<SlidePreview>` picker fallback fully deleted** — every code template MUST carry a `preview` URL after Phase 90. Acts as a forcing function: a new code template can't ship without first rendering its preview.

Decisions logged in PROJECT.md Key Decisions table (v2.14 + v2.15 decisions added at milestone close). Per-milestone decision logs live in the milestone archives.

### Blockers/Concerns

No open milestone blockers. Phase 89 risk vector identified:

- **BKSHELVE-05 byte-identity is the hard gate** — all 13 code templates + live DB templates must render byte-identical pre/post removal. The 3 fixture suites (`legacy-templates-byte-identical`, `-regression`, `new-templates-parity`) staying GREEN at 45/45 is the codified proof. Phase planning should front-load a parity snapshot baseline before any deletion.
- **`project.template_id === 'brand-kit'` legacy projects** — existing user carousels saved against the brand-kit template id need a fallback (BKSHELVE-07 specifies `news-oracle` as the resolve-time default) so they don't crash.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260519-hym | Snap generated headline text into caption-card geometry | 2026-05-19 | 0db74ab | [260519-hym-snap-generated-headline-text-into-captio](./quick/260519-hym-snap-generated-headline-text-into-captio/) |
| 260519-k14 | Add Photo overlay panel to slide background controls | 2026-05-19 | 51ac805 | [260519-k14-add-photo-overlay-panel-to-slide-backgro](./quick/260519-k14-add-photo-overlay-panel-to-slide-backgro/) |
| 260519-o55 | Extract Photo overlay into its own portlet | 2026-05-19 | b090df2 | [260519-o55-extract-photo-overlay-into-its-own-portl](./quick/260519-o55-extract-photo-overlay-into-its-own-portl/) |
| 260519-pkt | Pin right-rail actions portlet + remove SAVE CHANGES button | 2026-05-19 | 5df6ce9 | [260519-pkt-pin-actions-portlet-remove-save-button](./quick/260519-pkt-pin-actions-portlet-remove-save-button/) |
| 260519-d7g | Hook drag forwards to caption-card drag | 2026-05-19 | 9a1b4fe | [260519-d7g-hook-drag-forwards-to-caption-card](./quick/260519-d7g-hook-drag-forwards-to-caption-card/) |
| 260519-hnp | Inline hint pill component + caption-card drag hint | 2026-05-19 | 6726c60 | [260519-hnp-inline-hint-pill-component](./quick/260519-hnp-inline-hint-pill-component/) |
| 260519-cdf | news-oracle caption-card defaults (height 42% / blend 15% / opacity 80%) | 2026-05-19 | 85cdfb7 | [260519-cdf-news-oracle-caption-card-defaults](./quick/260519-cdf-news-oracle-caption-card-defaults/) |
| 260519-bkn | BREAKING NEWS badge on news-oracle cover (3-surface) | 2026-05-19 | 202fe66 | [260519-bkn-breaking-news-badge](./quick/260519-bkn-breaking-news-badge/) |
| 260519-vy2 | Mirror resolveCaptionBar in right-panel controls (Height / Opacity / Edge blend drift on captionCardDefaults templates) | 2026-05-19 | 2c15db1 | [260519-vy2-fix-three-caption-card-control-drifts-ed](./quick/260519-vy2-fix-three-caption-card-control-drifts-ed/) |
| 260520-064 | Convert BREAKING NEWS chrome → editable 'ruled' kicker (D1 adapter fallback + D2 'ruled' highlight style + D3 AI prompt + D4 live-Y pixel parity + R3 post-validator + R4 recipe-extract regression). Replaces 75-line per-renderer chrome with editable Layers-panel kicker. 5 atomic commits; Task 6 manual smoke verdict pending. | 2026-05-20 | 7e57ad3 | [260520-064-convert-breaking-news-chrome-to-accessor](./quick/260520-064-convert-breaking-news-chrome-to-accessor/) |
| 260520-ft0 | Fix tr3nding-news headline scale: pivot off Phase 45 `backgroundMode='image-with-bottom-card'` to the classic newsZone path (mirrors chrome-pulse quick-260519-bgr). Drop backgroundMode + bump hookFontSize 120→130 + add `captionCardDefaults { heightPct:42, blendPct:15, opacity:0.80 }` + remove HOOK_FIT_REGISTRY entry + add `layout:'cover'` to sample. Generated headlines now stamp at oracle-scale ~130px (was ~66px from registry's 0.55 scale on 42-char hooks). | 2026-05-20 | dc4aa05 | [260520-ft0-fix-tr3nding-news-headline-scale](./quick/260520-ft0-fix-tr3nding-news-headline-scale/) |
| 260520-gr3 | Onboarding polish: (1) blank username field + "username" placeholder (was leaking email-derived suggestion). (2) Welcome dialog: rename "TikTok Slideshow Creator" → "Viral Slide Maker", drop the references slide (pivoting away), swap the publish placeholder card+arrow+check composition for a clean globe. (3) Take-Me-There made step-aware: tries DOM scrollIntoView, else routes to user's most recent project, else auto-completes; checklist's onStepClick now DOM-aware so publish-toggle spotlights in place on /project/[id]. Drops the reference-upload step from ONBOARDING_STEPS. 4 atomic commits. | 2026-05-20 | d4735b1 | [260520-gr3-fix-onboarding-username-placeholder-welc](./quick/260520-gr3-fix-onboarding-username-placeholder-welc/) |
| 260520-hp1 | Forgot-password reset flow: `/forgot-password` request page (Supabase `resetPasswordForEmail`, generic non-enumerating success) + `/reset-password` recovery-session page (`updateUser({ password })` with mismatch + min-length guards) + "Forgot password?" link on `/login` + middleware allowlist for both routes + `reset-password` reserved username + Playwright smoke (link visible + form submit shows generic success). **Operator follow-up:** set Supabase Reset Password email template URL to `{{ .SiteURL }}/auth/callback?next=/reset-password`; manual email-click smoke pending. | 2026-05-20 | 1ab9608 | [260520-hp1-add-forgot-password-reset-flow](./quick/260520-hp1-add-forgot-password-reset-flow/) |

### Open Items (carried forward)

- **Pre-existing test debt:** the 3 fixture suites `legacy-templates-byte-identical` / `-regression` / `new-templates-parity` are GREEN at 45/45. The failing baseline is unrelated tests (auth / stripe / legal / api-keys / editorial-serif-name fixture-regen); v2.15 introduced ZERO new failures and added 37 new passing tests. v2.16 BKSHELVE-05 must keep this baseline intact.
- **v2.14 operational user-setup:** if not already applied — set `ADMIN_USER_IDS` env var in `.env.local` + Vercel (Diego's dev user id: `ed8ca688-ec50-4c8c-834e-1b9f562eee8a`) and apply `supabase/migrations/20260519_phase86_template_previews_bucket.sql` to the shared Supabase project. The `template-previews` bucket is required by Phase 90.
- **Phase 88 e2e dry-run — DONE (PASSED 2026-05-19).**

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Brand Kit | Brand-kit migration rollback (drop `brand_kit` table/columns) | DB schema stays dormant; revival rebuilds against same schema | v2.16 requirements |
| Brand Kit | Brand-kit feature flag instead of removal | Removal is forward-only | v2.16 requirements |
| Previews | Per-slide variants in picker (multiple sample photos per template) | One preview per template in v2.16 | v2.16 requirements |
| Previews | Animated/video previews in picker | Static PNG only | v2.16 requirements |
| Previews | Rolling preview refresh / cron | One-off render at milestone time; operator re-runs script on redesign | v2.16 requirements |
| Picker | Premium-template indicator overlay redesign | Picker chrome unchanged | v2.16 requirements |
| Picker | Picker layout changes (columns, sort order, category chips) | Only tile preview body changes | v2.16 requirements |
| Templates | End-user / community template authoring + picker surfacing community templates | Deferred to future milestone | v2.15 requirements |
| Templates | Editing or deleting a saved DB template | V1 is save-new-only | v2.15 requirements |
| Templates | Explicit registry cache invalidation on template write | v1 accepts the ≤60s TTL | v2.15 requirements |
| Templates | Migrating the 13 code templates into the DB | Stay in code (back-compat) | v2.14 spec |
| QA | Carry-over manual QA from v2.10/v2.12/v2.13 (iPhone Safari touch, Lucide picker perf, template visual fidelity) | Carried forward | prior milestones |

## Session Continuity

Last session: 2026-05-20
Stopped at: Roadmap created for v2.16 (Phases 89–90). Phase 89 — Brand-Kit Shelving (Full Removal, BKSHELVE-01..09); Phase 90 — Pre-Rendered Template Preview Pipeline (PREVIEW-01..05). 14/14 requirements mapped, no orphans. Next step: `/gsd-plan-phase 89` to begin planning Phase 89.
Resume file: `.planning/ROADMAP.md`

## Operator Next Steps

- Run `/gsd-plan-phase 89` to begin planning Brand-Kit Shelving (Full Removal).

# Phase 54 Discussion Log — Infrastructure Foundation

**Mode:** `--auto` (Claude-decided defaults; no interactive Q&A)
**Date:** 2026-05-01
**Inputs:** `.planning/research/SUMMARY.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 54, codebase audit (sharp dep status, Imagen call sites, premium-template fonts, existing `carousel_events` table, storage bucket migration patterns).

---

## Auto-resolved gray areas

Each gray area was resolved using a combination of research synthesis recommendations and codebase audit findings. Decisions are locked in CONTEXT.md `<decisions>` (D-01..D-21).

### Treatment library API surface
- **Q:** Ship all 4 presets (`bw`, `duotone-cream`, `duotone-cobalt`, `contrast-bump`) in v2.9 Phase 54, or just the 1-2 needed by initial wired call sites?
- **Auto-decision:** All 4 (D-01). Library cost is the same; templates in Phase 56 consume duotones without library changes.
- **Reasoning:** Research SUMMARY Top-5 #1 (photo treatment) lists all 4 presets as the unit of work; splitting them across phases creates duplicate test scaffolding.

### Palette extraction library
- **Q:** `sharp.stats()` (no new dep, dominant + 3 cluster) vs `@vibrant/node` (named roles, ~600KB dep)?
- **Auto-decision:** `sharp.stats()` for Phase 54 (D-02). `@vibrant/node` deferred to Phase 57 when templates that consume named roles ship.
- **Reasoning:** Research SUMMARY Conflict #4 ruled this exact way. Pre-PMF discipline: don't add deps before they're load-bearing.

### Schema location for treatment outputs
- **Q:** Add `slide.original_source_url` field in Phase 54, or defer to Phase 55 when other schema additions land together?
- **Auto-decision:** Defer to Phase 55 (D-08). Phase 54 generation pipeline writes treated URL to `slide.background_url` directly.
- **Reasoning:** ROADMAP architecture explicitly says Phase 55 owns schema additions. Pre-emptively adding the field in 54 violates the build-order contract and risks 2-phase migration conflicts. Acceptable trade-off: re-treating compounds in Phase 54 (no user-driven re-treat exists yet anyway).

### AI-slop guardrail injection point
- **Q:** Inject Imagen + Pexels addenda at each call site, or extract a shared module?
- **Auto-decision:** Shared module `src/lib/ai/slop-guardrails.ts` (D-09). Single source of truth.
- **Reasoning:** Mirrors v2.6's `src/lib/api/auth-core.ts` extraction pattern (Bearer auth shared across REST and MCP). Three Imagen sites + one Pexels site = enough sites to justify the abstraction.

### Pexels exclusion mechanism
- **Q:** Pexels API doesn't support negative-term exclusion. Filter post-fetch on `alt` text, or just append positive terms and accept noise?
- **Auto-decision:** Both — append positive terms to query AND filter post-fetch on `alt` text (D-11). If filtering empties the result set, fall back to unfiltered first photo (never block generation).
- **Reasoning:** Research FEATURES.md flagged "smiling diverse team" stock as the #2 AI-slop tell. Filtering post-fetch is cheap (single regex) and never blocks the user.

### Imagen 4 Fast model bump
- **Q:** Phase 54 success criterion #4 says "Imagen calls use `imagen-4.0-fast-generate-001`". Already done at all sites. Treat as code change or audit?
- **Auto-decision:** Audit-only (D-16). One task: grep for stale Imagen versions, assert clean, document.
- **Reasoning:** Code audit confirmed `imagen-4.0-fast-generate-001` already at `generate-image.ts:33`, `ai-regen.ts:67`, `stylize-image.ts:80` (parked). Nothing to swap.

### `download_zip` event storage
- **Q:** New table or extend existing `carousel_events` (v2.4 Explore)?
- **Auto-decision:** Extend `carousel_events` (D-17, D-18).
- **Reasoning:** `carousel_events` is already the project's events store. Adding a new event type is one constant + one insert site. Avoids parallel infrastructure.

### Baseline-capture process
- **Q:** Continuous tracking via existing analytics, or one-shot script at Phase 54 ship?
- **Auto-decision:** One-shot script `scripts/capture-zip-baseline.ts` writing to `.planning/milestones/v2.9-METRIC-BASELINE.md` (D-20).
- **Reasoning:** Baseline is a single-point-in-time measurement, not an ongoing query. Committing the result file to repo creates immutable audit trail.

### SLOP-05 premium-template font replacement
- **Q:** Which premium templates currently default to Inter? What replacement font?
- **Auto-decision:** `magazine-bold.ts` + `documentary.ts` → Plus Jakarta Sans (D-13, D-14). Verified via grep; only these two files match the criteria.
- **Reasoning:** Plus Jakarta Sans is in v2.9's free-Google-Fonts catalog (per REQUIREMENTS.md) and visually preserves the magazine-bold reference (Murphy Campbell carousel from v2.7).

### sharp memory configuration
- **Q:** Where to set `sharp.cache(false)` and `sharp.concurrency(1)`?
- **Auto-decision:** Module `src/lib/photo-treatment/sharp-config.ts` imported first by `treat.ts` (D-04).
- **Reasoning:** Research PITFALLS #5 (sharp memory fragmentation under serverless load) — needs to run at module import time. Single-file isolation makes it impossible to forget.

---

## Phase plan structure (rough — gsd-planner refines)

- **Plan 54-01: Treatment foundation** — sharp install + config + treat.ts + tests + bucket migration + retention pg_cron
- **Plan 54-02: Guardrails + metric** — slop-guardrails.ts + 4 call-site integrations + AI hook addendum + SLOP-05 font audit + Imagen verification + carousel_events extension + view + baseline script + baseline file

---

## Notes for downstream agents

- **gsd-phase-researcher** (Phase 54): research need is LIGHT. Standard patterns; the codebase audit already located all integration points. Researcher should focus on (a) sharp transform implementation choices for the 4 presets (gamma values, tint colors that hit the viral aesthetic vs look like CSS filters), (b) `pg_cron` retention SQL pattern verification, (c) one-shot baseline script structure.
- **gsd-planner** (Phase 54): respect D-21's 2-plan boundary unless plan-checker surfaces a complexity that demands a third plan. Lock the SLOP-05 font swap to a single task within Plan 54-02 (atomic commit) so it can be reverted in isolation if v2.7 audit regresses.
- **gsd-executor**: hard rule — do NOT add `slide.original_source_url` to the slide type in Phase 54. That's Phase 55's contract.

---

*Phase: 54-Infrastructure Foundation*
*Discussion logged: 2026-05-01*

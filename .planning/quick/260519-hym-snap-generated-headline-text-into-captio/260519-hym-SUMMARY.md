---
phase: quick-260519-hym
plan: 01
subsystem: ai-generation
tags: [caption-card, generation, text-positioning, news-template]
requires:
  - "resolveCaptionBar caption-card geometry contract (resolve-overlay.ts)"
  - "computeCaptionBarBottomPositions + CAPTION_BAR_BOTTOM_* constants (style-spec-projector-constants.ts)"
  - "legacyToTextBoxes hook_position -> anchor:'custom' adapter (text-box-adapter.ts)"
provides:
  - "computeCaptionCardTextPositions — pure caption-card geometry -> hook/body positions"
  - "snapHeadlineToCaptionCard — slide-level snap pass with opt-in news stamp"
  - "post-generation caption-card snap wired into generateSlideContent"
affects:
  - "src/lib/ai/generate-slides.ts (code-template generation path)"
tech-stack:
  added: []
  patterns:
    - "deterministic post-process snap (code owns geometry, AI owns words)"
    - "extraction-ready pure helper (Phase 85 LayoutRecipe can adopt without rewrite)"
key-files:
  created:
    - src/lib/ai/caption-card-text-snap.ts
    - src/lib/ai/__tests__/caption-card-text-snap.test.ts
  modified:
    - src/lib/ai/generate-slides.ts
decisions:
  - "Template-agnostic trigger: snap fires on caption_bar_enabled === true only — no per-template allowlist, no news-layout auto-seed replication"
  - "News generations stamp caption_bar_enabled: true (stampNewsDefault) so the renderer's auto-seeded news card becomes explicit and snappable"
  - "applyLayoutRecipe / style-spec-projector path left untouched (CONTEXT.md locked) — DB recipe already carries caption-card geometry"
metrics:
  duration: ~3 min
  completed: 2026-05-19
  tasks: 3
  files: 3
---

# Quick Task 260519-hym: Snap generated headline text into caption-card geometry Summary

Deterministic post-generation snap that positions the headline (hook) and body text boxes inside an enabled caption card's geometry, fixing generated news slides where the headline floated at the top of the slide while the caption card sat at the bottom.

## What Was Done

**Task 1 — pure caption-card geometry helper.** Created `src/lib/ai/caption-card-text-snap.ts` with `computeCaptionCardTextPositions(geom)`. Given `{ heightPct, cardTopY, position }` it returns in-card hook/body positions: `hookY = round1(cardTopY + heightPct * 0.25)` (headline 25% into the card), `bodyY = round1(cardTopY + heightPct * 0.60)` (body 60% into the card, below the headline). `x` / `width` reuse `CAPTION_BAR_BOTTOM_X` (11) / `CAPTION_BAR_BOTTOM_WIDTH` (78) from the projector constants — no redeclared numbers. The math is `cardTopY`-driven (not `100 - heightPct`), so an explicit `caption_bar_y` is honored verbatim and a `'top'` card gets headline-on-top with no per-position branch. Test 2 asserts byte-equality against `computeCaptionBarBottomPositions` for height fractions 0.38 and 0.40, proving zero drift from the projector's source of truth.

**Task 2 — slide-level snap pass + generation wiring.** Added `snapHeadlineToCaptionCard(slides, options?)` to the same file. It triggers on `caption_bar_enabled === true` only (template-agnostic, strict equality); non-caption-card slides are returned unchanged (byte-identity preserved — no `hook_position`/`body_position` injected). It derives card geometry exactly as the renderer's `resolveCaptionBar` does (`heightPct ?? 38`, `position ?? 'bottom'`, `cardTopY = caption_bar_y ?? position default`), then writes `hook_position` / `body_position` / `hook_width` / `body_width` into a new `style_overrides` object on a new slide object (input never mutated). The `stampNewsDefault` option stamps `caption_bar_enabled: true` on news slides whose key is absent — making the renderer's auto-seeded news card (quick-260518-8o0) explicit so the snap can fire. Wired into `generateSlideContent` after `promoteNewsHeadline` and before the decorations/`legacyToTextBoxes` mapping, with `stampNewsDefault: category === 'news'`, so the computed positions flow through the adapter into `text_boxes` as `anchor: 'custom'`.

**Task 3 — regression check.** Ran the four existing caption/generation suites plus the new suite (`caption-bar-overrides`, `promote-news-headline`, `style-spec-projector-caption-bar-bottom`, `style-spec-projector`, `caption-card-text-snap`): 64/64 passing, zero new failures. The projector caption-bar-bottom suite is unchanged, confirming the projector path was not modified. Also ran `category-generation` + `optional-body-accessory-label` (18/18) as extra coverage of the generation path.

## Verification

- `npx vitest run src/lib/ai/__tests__/caption-card-text-snap.test.ts` — 14/14 pass (Tests 1-12 plus the news-stamp case and the `legacyToTextBoxes` adapter-integration assertion).
- `npx tsc --noEmit -p tsconfig.json` — clean for all three plan files (`caption-card-text-snap.ts`, `caption-card-text-snap.test.ts`, `generate-slides.ts`).
- Regression suites: 64/64 pass across the five caption/generation suites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Over-narrow type cast in the new test file**
- **Found during:** Task 2 (`tsc --noEmit` verification step)
- **Issue:** Three test assertions cast `style_overrides` to `Record<string, { x: number; y: number }>`, but that object also carries booleans/numbers (`caption_bar_enabled`, `caption_bar_height_pct`), so `tsc` rejected the cast (TS2352 — index signature incompatible with `boolean`).
- **Fix:** Cast to `Record<string, unknown>` instead and added a typed `pos(so, key)` accessor that narrows only the position fields. Behavior of the assertions is unchanged.
- **Files modified:** src/lib/ai/__tests__/caption-card-text-snap.test.ts
- **Commit:** 0db74ab

## Deferred / Out-of-Scope Issues

Pre-existing baseline `tsc` errors in `src/lib/legal/__tests__/audit-log.test.ts` and `src/lib/services/__tests__/projects-delete.test.ts` were observed during the Task 2 `tsc` run. Confirmed present on the clean base commit (`66aa33e`) — these are part of the project's known unrelated failing baseline (STATE.md notes auth/stripe/legal/api-keys). Not touched; not attributable to this plan.

## TDD Gate Compliance

RED/GREEN gate sequence honored:
- `3ed341f` — `test(...)`: failing test committed before any implementation (RED).
- `0b2ac01` — `feat(...)`: helper added, suite goes green (GREEN).
- `0db74ab` — `feat(...)`: generation wiring + test cast fix.

No REFACTOR commit — the implementation needed no cleanup pass.

## Self-Check: PASSED

- `src/lib/ai/caption-card-text-snap.ts` — FOUND
- `src/lib/ai/__tests__/caption-card-text-snap.test.ts` — FOUND
- `src/lib/ai/generate-slides.ts` — FOUND (modified)
- Commit `3ed341f` — FOUND
- Commit `0b2ac01` — FOUND
- Commit `0db74ab` — FOUND

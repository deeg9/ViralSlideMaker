# Phase 94 — App-Wide Mobile Polish · CONTEXT

**Milestone:** v2.17 Mobile Optimization
**Depends on:** Phase 91 (foundation: `tap-44`, safe-area, `dvh`, `viewport-fit`). Runs parallel to editor track (92–93); does not touch editor internals.
**Branch:** `feat/carousel-output-format`
**Requirements:** POLISH-01..04

## Surfaces & source of truth (from AUDIT.md)

| Item | Surface | File | Audit finding |
|------|---------|------|---------------|
| POLISH-01 | Template picker (inline on dashboard `Visual Style` expander + `/project/[id]` empty state) | `src/components/slides/template-picker.tsx` | Horizontal-scroll row of 160px tiles → 16 templates undiscoverable on phone |
| POLISH-02 | Settings sub-nav | `src/app/(dashboard)/settings/layout.tsx` | `flex gap-2 min-w-max` strip (~564px) scrolls tabs off-screen, no affordance |
| POLISH-03 | Public carousel viewer | `src/app/explore/[slug]/carousel-slideshow.tsx` | Chevron-only; FEATURES.md prescribes swipe for the public viewer |
| POLISH-04 | Typography/spacing @393px | `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/project/[id]/page.tsx` | `text-[3.5rem]` (56px) heroes eat ~⅓ of the fold |

## Constraints honored
- Desktop (≥md/lg) must not visibly regress → every change gated behind mobile breakpoints (`md:` restores original).
- Zero new dependencies (POLISH-03 uses native Pointer Events).
- Reuse existing handlers (POLISH-03 refactors chevrons onto shared `goPrev`/`goNext`).
- FEATURES.md anti-feature respected: no horizontal-carousel picker (POLISH-01 is a wrap grid).

## Out of scope (deliberately not touched)
- Editor canvas/chrome internals (owned by Phases 92–93).
- Subscription price `text-5xl` — audit rated subscription "Good"; left to avoid restyling a blessed surface.
- Logged-out landing/auth headings (`/`, `/privacy`, `/terms`) — Phase 95.

## Test baseline
- `npx tsc --noEmit`: 20 errors, **all in test files** (pre-existing). Phase 94 adds 0.
- `npx vitest run`: 62 failed / 3367 passed pre-existing baseline (ToS-mock suites, snapshot drift, mis-collected Playwright `tests/e2e/*.spec.ts`). Phase 94 adds 0 failures; touched `template-picker.test.tsx` = 7/7 green.

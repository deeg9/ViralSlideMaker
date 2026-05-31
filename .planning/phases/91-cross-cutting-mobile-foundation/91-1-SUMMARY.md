---
phase: 91-cross-cutting-mobile-foundation
plan: 91-1
subsystem: mobile-foundation
tags: [nextjs-viewport, ios-safe-area, tailwind-v4, dvh, wcag-contrast]
provides:
  - viewport-fit=cover viewport export (populates env(safe-area-inset-*) app-wide)
  - safe-area padding on the fixed bottom navbar + fixed editor shell
  - reusable @utility tap-44 (≥44×44 hit area) + global -webkit-tap-highlight-color reset
  - WCAG-AA placeholder-contrast fix on 3 inputs; ≥16px mobile font on 2 editor inputs
affects: [editor-touch-validation, editor-mobile-layout, app-wide-polish, auth-mobile-pass]
tech-stack:
  added: []
  patterns: [Next App-Router viewport export, Tailwind v4 arbitrary env() values, Tailwind v4 @utility]
key-files:
  created: []
  modified:
    - src/app/layout.tsx
    - src/components/layout/bottom-navbar.tsx
    - src/components/layout/dashboard-shell.tsx
    - src/app/globals.css
    - src/components/slides/generation-form.tsx
    - src/components/editor/ai-generate-tab.tsx
    - src/components/editor/image-picker-panel.tsx
key-decisions:
  - "viewport-fit set via Next viewport export, not a <meta> tag (App Router owns it)"
  - "Safe-area via arbitrary env() values + max() floor; no plugin, no global AppFrame wrapper"
  - "interactiveWidget deferred to the editor/keyboard phase (93)"
  - "Placeholder token = placeholder:text-[#7d6161]/60 (the app's existing readable convention)"
duration: ~8min
completed: 2026-05-31
---

# Phase 91 Plan 91-1: Global Mobile Foundation Summary

**Shipped the global iOS-Safari correctness primitives — `viewport-fit=cover` (the one line that makes every `env(safe-area-inset-*)` non-zero on device), safe-area padding on the two fixed bars, the reusable `tap-44` utility, and the WCAG-AA placeholder/contrast fix.**

## Performance
- **Tasks:** 5/5 completed
- **Files modified:** 7

## Accomplishments
- `viewport: Viewport = { viewportFit: 'cover', … }` exported from `layout.tsx` — unblocks all safe-area work in the milestone.
- Bottom navbar + editor shell now consume `env(safe-area-inset-*)`.
- `@utility tap-44` added (compiles under Tailwind v4 PostCSS) + `-webkit-tap-highlight-color: transparent`.
- 3 faint `#dbc1bc` placeholders → readable `#7d6161/60`; 2 editor inputs bumped to `text-base md:text-sm` (no iOS zoom).

## Task Commits
All five tasks committed together (atomic foundation) in `feat(91)` — `8d37cd7`. Plan docs: `3da410a`.

## Files Created/Modified
- `src/app/layout.tsx` — viewport export (FOUND-01 enabler)
- `src/components/layout/bottom-navbar.tsx` — safe-area pb (FOUND-01)
- `src/components/layout/dashboard-shell.tsx` — safe-area on fixed editor shell (FOUND-01)
- `src/app/globals.css` — `@utility tap-44` + tap-highlight reset (FOUND-03)
- `src/components/slides/generation-form.tsx`, `ai-generate-tab.tsx`, `image-picker-panel.tsx` — placeholder contrast + ≥16px font (FOUND-04)

## Decisions & Deviations
- Minor scope addition: bumped two raw editor inputs (`ai-generate-tab`, `image-picker-panel`) from `text-sm` to `text-base md:text-sm` to satisfy FOUND-04's ≥16px app-wide requirement (they were 14px → would zoom on iOS). Trivial, safe, matches the `Input` primitive convention.
- Otherwise followed plan as specified.

## Next Phase Readiness
- `tap-44` utility ready for the Plan 91-2 editor sweep and later-phase sweeps.
- `env()` vars now populate on device — Phases 92/93 sheet + bar placements are now correct.

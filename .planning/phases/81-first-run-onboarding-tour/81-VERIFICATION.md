# Phase 81: First-Run Onboarding Tour — Verification

**Verified:** 2026-05-15
**Phase status:** complete
**status:** complete

## Executed plans

| Plan | Description | Commit |
|------|-------------|--------|
| 81-01 | Supabase migration: profiles.onboarding_completed_at + atomic backfill | `1e0f6d6` |
| 81-02 | onboarding-steps + React Context provider | `9bbae53` |
| 81-03 | Dialog primitive + FirstRunWelcomeDialog (4-slide Embla carousel) | `b4c15ef` (deps) + `42c6f88` (components) |
| 81-04 | InteractiveOnboardingChecklist + coachmark overlay | `395ec2e` |
| 81-05 | Server actions + layout/page integration | `219f798` |
| 81-06 | Settings restart button | `290962e` |
| 81-07 | data-onboarding-id attributes on 4 spotlight targets | `3e593d4` |

## Sanity checks

| Check | Result | Notes |
|-------|--------|-------|
| `npx tsc --noEmit` (Phase 81 files only) | PASS | Zero new TS errors introduced. Baseline at 55f4259 was 27 pre-existing errors (all in `__tests__/*`); post-Phase-81 is also 27. |
| `npm run build` | PASS | Build completed; `/dashboard` route bundle 29.5 kB. Zero Phase 81 lint warnings. |
| `data-onboarding-id` grep gate | PASS | Exactly 4 production matches: `reference-upload` (reference-image-uploader.tsx), `topic-input` + `generate-button` (generation-form.tsx), `publish-toggle` (visibility-dropdown.tsx). |
| framer-motion guard | PASS | Zero `framer-motion` imports across all Phase 81 files (only doc comments mentioning it as forbidden). All animation imports come from `motion/react`. |
| zustand guard | PASS | Zero `zustand` / `jotai` / `redux` imports. State management is React Context per D-01. |
| vitest | PRE-EXISTING FAILURES | Phase 81 added no new tests. Project-wide tsuite has ~1781 pre-existing test failures (mostly snapshot drift in style-references, audit-log, slide-editor mocks) — unrelated to Phase 81. None of the failing test files touch onboarding code. |

## Acceptance criteria

- [x] Migration adds `profiles.onboarding_completed_at timestamptz` with atomic backfill (Plan 81-01).
- [x] `<OnboardingProvider>` mounted in `(dashboard)/layout.tsx` survives client-side navigation (Plan 81-02, 81-05).
- [x] Welcome modal has exactly 4 slides with locked TikTok-Slideshow copy from CONTEXT.md `<specifics>` (Plan 81-03).
- [x] Back hidden on slide 1; Get Started replaces Next on slide 4 (Plan 81-03).
- [x] Skip on welcome OR completion of 4 checklist steps triggers `markOnboardingComplete` server action (Plans 81-02, 81-05).
- [x] `git grep "data-onboarding-id="` returns exactly 4 production-source matches (Plan 81-07).
- [x] Coachmark queries only via `[data-onboarding-id="<id>"]` selector — D-07 contract (Plan 81-04).
- [x] Coachmark fallback to centered "Take me there" modal when target not in DOM — D-09 (Plan 81-04).
- [x] Restart button on `/settings/profile` nulls `onboarding_completed_at` + redirects to `/dashboard` (Plan 81-06).

## Deviations from SPEC/CONTEXT

1. **D-11 route map adjusted to live codebase.** CONTEXT.md D-11 specified `reference-upload` and `generate-button` routes as `/style-from-reference`, but the codebase currently has the style-from-reference flow inlined onto `/dashboard` via `<StyleFromReferenceShell>` embedded in `GenerationForm` (a "Copy style" collapsible). All 4 step routes were set to `/dashboard`. Documented in the header comment of `src/components/onboarding/onboarding-steps.ts`. If a dedicated `/style-from-reference` route returns later, only that file changes.

2. **publish-toggle route stays `/dashboard`.** Same reason — the `<VisibilityDropdown>` only renders inside `/project/[id]`. When the checklist reaches the `publish-toggle` step on `/dashboard`, the coachmark's missing-target fallback (D-09 centered modal with "Take me there") will fire, directing the user to open a project. Acceptable v1 per CONTEXT.md.

## Out-of-scope items deferred

- Real product screenshots in welcome modal (placeholder SVGs ship in this phase per SPEC).
- Action-based step completion (acknowledgement-based only per SPEC R6).
- Telemetry / activation events.
- A/B testing infra.
- iOS / React Native onboarding.
- Localization.

## npm packages installed

- `@radix-ui/react-dialog@^1.1.15` (new — dialog primitive)
- `embla-carousel-react@^8.6.0` (new — welcome modal carousel)
- No `framer-motion` installed (D-06 — `motion@^12` already present supplies `motion/react`).

## Files added (10)

- `supabase/migrations/20260515_v213_phase81_profiles_onboarding_completed_at.sql`
- `src/components/onboarding/onboarding-steps.ts`
- `src/components/onboarding/onboarding-provider.tsx`
- `src/components/onboarding/first-run-welcome-dialog.tsx`
- `src/components/onboarding/interactive-onboarding-checklist.tsx`
- `src/components/ui/dialog.tsx`
- `src/lib/onboarding/actions.ts`
- `.planning/phases/81-first-run-onboarding-tour/81-01-PLAN.md` through `81-07-PLAN.md` (7 plan files)

## Files modified (5)

- `package.json` + `package-lock.json` (deps)
- `src/app/(dashboard)/layout.tsx` (provider mount + extended profile select)
- `src/app/(dashboard)/dashboard/page.tsx` (welcome dialog mount)
- `src/app/(dashboard)/settings/profile/page.tsx` (restart button)
- `src/components/dashboard/reference-image-uploader.tsx`, `src/components/slides/generation-form.tsx`, `src/components/editor/visibility-dropdown.tsx` (data-onboarding-id attributes)

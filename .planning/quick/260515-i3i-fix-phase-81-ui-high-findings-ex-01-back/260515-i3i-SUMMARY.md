---
quick_id: 260515-i3i
slug: fix-phase-81-ui-high-findings-ex-01-back
date: 2026-05-15
status: complete
description: Fix Phase 81 UI HIGH findings — EX-01 backdrop/Esc as Skip + EX-02 coachmark a11y
source: .planning/phases/81-first-run-onboarding-tour/81-UI-REVIEW.md
---

# Quick Task 260515-i3i — Summary

Two HIGH-severity UI findings from `81-UI-REVIEW.md` fixed in a single atomic commit per finding.

## EX-01 — Welcome modal: ephemeral dismiss split from persistent Skip

**File:** `src/components/onboarding/first-run-welcome-dialog.tsx`

`handleOpenChange` no longer calls `skipTour()`. Backdrop click / Esc / X-button now call `markWelcomeSeen()` only — modal closes for the session (localStorage flag) but `onboarding_completed_at` stays NULL. The persistent DB write is reserved for the labeled text "Skip" button and the slide-4 "Get Started" completion.

This mirrors the pattern from CR-01/CR-02: don't let accidental or ambiguous gestures write persistent state.

## EX-02 — Coachmark a11y: FocusScope + aria-labelledby + initial focus

**File:** `src/components/onboarding/interactive-onboarding-checklist.tsx`

Three changes inside both the positioned `CoachmarkOverlay` and the `CenteredFallbackCoachmark`:

1. Wrapped `CoachmarkBody` in `<FocusScope trapped loop>` from `@radix-ui/react-focus-scope` (already a transitive dep via `@radix-ui/react-dialog`). Gives focus trap, initial-focus-on-mount, and focus-restoration-on-unmount for free.
2. Added stable id `coachmark-title-${step.id}` to the `<h3>{step.title}` inside `CoachmarkBody`.
3. Switched `aria-label={step.title}` → `aria-labelledby={\`coachmark-title-${step.id}\`}` on the root tooltip and fallback `motion.div`. Added `tabIndex={-1}` so the root can receive initial focus.

## Sanity checks

| Check | Result |
|-------|--------|
| `aria-label={step.title}` removed (grep) | 0 matches (was 2) ✓ |
| `aria-labelledby` present (grep) | 2 matches (tooltip + fallback) ✓ |
| `FocusScope` references | 5 (import + 2 open + 2 close tags) ✓ |
| `skipTour` only in `handleSkip` | confirmed at line 71 ✓ |
| `markWelcomeSeen` called from both `handleGetStarted` and `handleOpenChange` | confirmed at lines 75 + 86 ✓ |
| `npx tsc --noEmit` | 19 pre-existing test-mock errors only; zero in onboarding files ✓ |
| `npm run build` | PASS ✓ |
| New deps installed | none — `@radix-ui/react-focus-scope` already present as transitive dep |

## Acceptance criteria

- ✓ Esc / backdrop / X-button on welcome modal does NOT write `onboarding_completed_at`.
- ✓ Coachmark tooltip + centered fallback both wrapped in Radix `FocusScope`.
- ✓ `aria-labelledby` references a stable id on the h3 in `CoachmarkBody`.
- ✓ tsc + build pass post-fix.

## Out of scope (per PLAN)

- EX-03 / EX-04 / EX-05 (medium UI polish) — separate quick tasks.
- EX-07 (publish-toggle deep-link) — needs separate decision on "most recent project" lookup.
- C-01 (raw hex → Tailwind tokens) — broader refactor.
- T-03 (per-slide sr-only DialogTitle) — separate medium fix; user requested HIGH only.

## Manual smoke test (deferred — user task)

- Set a test profile's `onboarding_completed_at` to NULL via Supabase SQL editor.
- Hit `/dashboard`, see welcome modal.
- Press Esc. Modal closes. Reload `/dashboard` — modal should NOT re-appear THIS session (welcomeSeen localStorage) BUT `onboarding_completed_at` is still NULL in DB.
- Open in incognito or clear localStorage, repeat. Modal should appear again because welcomeSeen got cleared.
- With tour active and a coachmark spotlight visible, press Tab repeatedly. Focus should cycle within the tooltip (Prev / Skip tour / Back / Next / X-icon) and not escape to the underlying page.

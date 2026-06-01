# Phase 95 — Summary: Logged-Out & Auth Mobile Pass

**Milestone:** v2.17 Mobile Optimization · **Requirements:** AUTH-01, AUTH-02
**Branch:** `feat/carousel-output-format` · **Date:** 2026-05-31
**Status:** Code-complete (mobile layout & ergonomics); awaiting orchestrator 393px logged-out
visual check + a credential-gated live auth round-trip smoke.

## What shipped
A CSS-first, mobile-breakpoint-gated retrofit of the six logged-out surfaces the original mobile
audit never captured (it ran authed). Reused Phase 91 primitives (`dvh`, safe-area `env()`,
`tap-44` height convention, `Input`/`Button`). Zero new deps. No auth-logic changes. Atomic commit
per surface.

## Commits
| Hash | Surface | Files |
|------|---------|-------|
| `bc9cebc` | AUTH-01 landing | `src/app/page.tsx`, `footer.tsx`, `top-navbar.tsx` (marketing branch) |
| `8680527` | AUTH-02 login + signup | `(auth)/login/page.tsx`, `(auth)/signup/page.tsx` |
| `f7929aa` | AUTH-02 forgot + reset | `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx` |
| `17d791e` | AUTH-02 onboarding username | `(auth)/onboarding/username/page.tsx` + `claim-username-form.tsx` |

## Input-ergonomics changes (AUTH-02)
| Field | type | inputMode | autoComplete | autoCapitalize | other | ≥16px mobile |
|-------|------|-----------|--------------|----------------|-------|--------------|
| login email | email | email | email | none | autoCorrect off, spellCheck false | yes (`Input` text-base) |
| login password | password | — | current-password | none | — | yes |
| signup email | email | email | email | none | autoCorrect off, spellCheck false | yes |
| signup password | password | — | new-password | none | — | yes |
| signup confirm | password | — | new-password | none | — | yes |
| forgot email | email | email | email | none | autoCorrect off, spellCheck false | yes |
| reset password | password | — | new-password | none | — | yes |
| reset confirm | password | — | new-password | none | — | yes |
| onboarding username | text | text | off | none | autoCorrect off, spellCheck false | **fixed**: was `text-sm` (14px → zoomed), now `text-base md:text-sm` |

**≥16px guarantee:** the `Input` primitive (`src/components/ui/input.tsx`) is `text-base` (16px) on
mobile, `md:text-sm` on desktop — so all primitive-based fields never trigger iOS zoom. The only
non-primitive input was the custom username field; it was the lone `<16px` offender and is now
`text-base md:text-sm`.

**Tap targets:** every auth `Input` and `Button` (submit + Google OAuth) got `h-12 md:h-8` → 48px on
mobile, original 32px on desktop. Username submit was already ~46px (`py-3`).

## Desktop-regression guard
Every mobile change is a base utility paired with a `md:` (or `lg:`) restore of the existing
desktop value (`h-12 md:h-8`, `min-h-dvh` [equivalent at desktop], `px-5 md:px-8`,
`p-6 md:p-10`, `py-3 md:py-2.5`, `text-3xl md:text-4xl`, etc.). `twMerge` resolves the
page-level `h-12 md:h-8` over the primitive's built-in `h-8` (mobile wins at base, `md:` wins at
desktop). Verified no orphan base-only edits and no `min-h-screen` left behind. The Spline robot
stays `hidden md:flex`. Only the marketing branch of `top-navbar.tsx` was touched (app branch
untouched).

## Tests
- `npx tsc --noEmit`: 20 errors (baseline, all in test files) — **0 new**.
- `npx vitest run src/__tests__/auth`: **10/10 pass** (no auth-logic regression).

## Credential-blocked residual (deferred, non-blocking)
Live end-to-end auth round-trip smoke (real signup/login + redirect chain + reset-link email).
Needs a test credential + mail inbox this subagent lacks. `/reset-password` and
`/onboarding/username` also require an authed/recovery session to render, so their visual pass is
best folded into the credentialed human's smoke. AUTH-01/02 as written (mobile layout/ergonomics)
are fully delivered as code.

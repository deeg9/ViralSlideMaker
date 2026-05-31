# Phase 95 — Context: Logged-Out & Auth Mobile Pass

**Milestone:** v2.17 Mobile Optimization
**Requirements:** AUTH-01 (landing `/`), AUTH-02 (auth screens)
**Branch:** `feat/carousel-output-format`
**Date:** 2026-05-31

## Why this phase
The mobile audit (`.planning/mobile-audit/AUDIT.md`) ran on an authenticated session, so the
logged-out landing page and the five auth screens were **never captured**. They must be inspected
fresh from code and made mobile-first at 393px (iPhone 15). This is a layout/ergonomics retrofit,
not a redesign and not an auth-logic change.

## Surfaces (found in code)
- `src/app/page.tsx` — logged-out marketing landing (authed users `redirect('/dashboard')`).
  Uses `TopNavbar variant="marketing"`, `Footer`, hero with prompt textarea + template picker +
  CTA, showcase, bento grid. 3D Spline robot already `hidden md:flex`.
- `src/app/(auth)/login/page.tsx` — email/password + Google OAuth. Inputs already have
  `type`/`autoComplete`. Uses `Card`, `Input`, `Button`, `Label` primitives.
- `src/app/(auth)/signup/page.tsx` — email + password + confirm + Google OAuth.
- `src/app/(auth)/forgot-password/page.tsx` — email only.
- `src/app/(auth)/reset-password/page.tsx` — new password + confirm.
- `src/app/(auth)/onboarding/username/page.tsx` + `claim-username-form.tsx` — client form, custom
  `<input>` (not the `Input` primitive), already `py-3`.
- No shared `(auth)/layout.tsx` exists — each page owns its `min-h-screen` centered shell.

## Existing conventions to reuse (do NOT reinvent)
- **Phase 91 foundation already shipped:** `viewport-fit=cover` viewport export
  (`src/app/layout.tsx`), `tap-44` utility (`globals.css`), safe-area inset pattern
  `pb-[max(1.5rem,env(safe-area-inset-bottom))]`, `dvh` shells, and the `Input` primitive
  convention (`text-base` = 16px on mobile, `md:text-sm`).
- **POLISH-04 heading pattern (commit 604ce49):** scale mega headings down on mobile, e.g.
  `text-[2.25rem] md:text-[3.5rem]`, and tighten vertical rhythm below `md`. Desktop unchanged.

## Key findings (the actual work)
1. **Tap-target gap:** the `Input` primitive is `h-8` (32px) and the `Button` primitive default
   size is `h-8` (32px). Auth inputs + submit buttons are therefore **below the 44px minimum on
   mobile**. The Google OAuth button is also h-8. Fix: bump to ≥44px **on mobile only** (`h-12`/
   `h-11` below `md`, restore `md:h-8`) so desktop does not regress.
2. **Input font ≥16px:** already satisfied by `Input` (`text-base` on mobile). The username form's
   custom `<input>` is `text-sm` (14px) → **will zoom on iOS**. Fix to `text-base md:text-sm`.
3. **Input attributes:** login/signup/forgot/reset already have correct `type`/`autoComplete`.
   Add `inputMode="email"` + `autoCapitalize="none"` + `autoCorrect="off"` to email fields and
   `autoCapitalize="none"` to password/username for iOS keyboard correctness.
4. **Centered shells use `min-h-screen`** (`100vh` overshoot on iOS). Switch to `min-h-dvh`
   (FOUND-02 parity) and add safe-area padding so a sticky/in-flow submit clears the home indicator.
5. **Landing horizontal padding:** hero/sections use `px-8` (32px) and footer `px-12` (48px) — too
   wide at 393px. Reduce to `px-5`/`px-6` on mobile, restore `md:px-8`/`md:px-12`.
6. **Landing heavy card padding** `p-8`/`p-10`/`p-12` on mobile — soften to `p-5`/`p-6` below `md`.

## Constraints
- Desktop (≥`md`/`lg`) must NOT visibly regress — every change gated behind a mobile breakpoint.
- Zero new dependencies. Reuse `Input`/`Button`/`Card`. No auth-LOGIC changes (server actions
  untouched).
- tsc baseline = 20 errors, **all in `src/__tests__` / `__tests__`** (mock-typing + legal-result
  drift) — pre-existing, unrelated. Report new-vs-baseline.

## Credential-blocked residual (explicit)
A live end-to-end login/signup round-trip smoke (auth actually authenticating + redirecting
through onboarding/reset) needs a test credential this subagent does not have. AUTH-01/02 as
written are about **mobile layout/ergonomics**, which are fully deliverable as code; only the live
auth round-trip is deferred to a human with a credential.

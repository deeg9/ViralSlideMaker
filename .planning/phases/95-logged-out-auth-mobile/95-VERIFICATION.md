# Phase 95 — Verification

**Requirements:** AUTH-01 (landing), AUTH-02 (auth screens) · **Branch:** `feat/carousel-output-format`
**Date:** 2026-05-31

## Automated / code checks (this subagent)
- `npx tsc --noEmit`: **20 errors, all pre-existing in test files** (`src/__tests__/*`, `*.test.*`) —
  mock-typing + legal-result drift unrelated to this phase. **0 new errors** from any of the 6 surface edits.
- `npx vitest run src/__tests__/auth`: **10/10 pass** (login/logout/middleware/signup server-action
  suites) — confirms no auth-logic regression (logic was untouched).
- Self code-review: every mobile utility paired with a `md:` desktop restore; no `min-h-screen`
  left behind; no server-action / route / middleware files touched; `twMerge` correctly resolves
  page-level `h-12 md:h-8` over the primitive's `h-8` (mobile 48px, desktop 32px).

## Code-complete (layout & ergonomics) — awaiting orchestrator 393px visual check

### Orchestrator 393px logged-out visual check (do each at 393×852, logged OUT)
| Route | What to confirm |
|-------|-----------------|
| `/` (landing) | No horizontal overflow; hero h1 readable & not eating the fold; prompt card + 2-up template grid fit within `px-5`; CTA & nav buttons comfortably tappable; 3D robot hidden on mobile; footer links wrap, no overflow. |
| `/login` | Card centered, fits with no overflow; email + password inputs ~48px tall; Sign in + Google buttons ~48px; tapping a field does NOT zoom the page (≥16px); submit visible with keyboard up. |
| `/signup` | Same as login + the confirm-password field; whole card reachable above keyboard. |
| `/forgot-password` | Email field + Send-reset button ~48px; no zoom; "sent" success state also reflows. |
| `/reset-password` | (Needs a recovery session to render — see deferred.) New + confirm password fields ~48px; no zoom. |
| `/onboarding/username` | (Needs an authed session.) Username input no longer zooms on focus (now 16px on mobile); Claim button ~46px; safe-area bottom clearance. |

### AUTH-01 layout checklist (code-complete)
- [x] No horizontal overflow at 393px (mobile padding `px-5`/`px-6`, 3D robot `hidden md:flex`,
      template grid `grid-cols-2`).
- [x] Readable type scale (hero h1 `2.75rem` mobile / `7xl` desktop; section headings scaled down).
- [x] Tap targets ≥44px (marketing nav Get Started `py-3` mobile; CTA `py-5`).
- [x] Tightened mobile vertical rhythm; heavy card padding softened below `md`.

### AUTH-02 layout + ergonomics checklist (code-complete)
- [x] Inputs ≥16px on mobile (no iOS zoom): `Input` primitive is `text-base`; the one custom input
      (username) fixed `text-sm`→`text-base md:text-sm`.
- [x] Correct input attributes — see 95-SUMMARY "Input-ergonomics" table.
- [x] Tap targets ≥44px on mobile (`h-12 md:h-8` on every auth input + submit + Google button;
      username submit already `py-3`).
- [x] Submit reachable with keyboard up: forms are short; `min-h-dvh` + safe-area bottom pad keep
      the in-flow submit above the home indicator. Card stays `max-w-sm` (fits 393px).
- [x] No desktop regression (all heights/paddings gated `md:`).

## Deferred — human_needed (credential-blocked, NOT blocking AUTH-01/02 as written)
- **Live end-to-end auth round-trip smoke:** actually signing up / logging in and confirming the
  redirect chain (`/login`→`/dashboard`, `/signup`→`/onboarding/username`→`/dashboard`,
  `/forgot-password`→email→`/reset-password`→`/login`). Requires a real test credential + a mail
  inbox for the reset link. This subagent has no credentials. `/reset-password` and
  `/onboarding/username` also need an authed/recovery session to even render, so their *visual*
  check is best done by the credentialed human in the same pass.
- AUTH-01/02 as specified are **mobile layout/ergonomics**, which are fully delivered as code; the
  auth-logic round-trip is a separate, deferrable smoke and does not gate this phase.

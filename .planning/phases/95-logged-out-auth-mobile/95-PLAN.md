# Phase 95 — Plan (Logged-Out & Auth Mobile Pass)

**Requirements:** AUTH-01, AUTH-02 · **Branch:** `feat/carousel-output-format`

## Approach
CSS-first, mobile-breakpoint-gated retrofit of six surfaces. Reuse Phase 91 primitives
(`tap-44`, `dvh`, safe-area `env()` pattern, `Input`/`Button`). No auth-logic changes. One atomic
commit per surface.

## Tasks (atomic commits)

### T1 — Landing page (AUTH-01) — `src/app/page.tsx` + `footer.tsx` + marketing nav in `top-navbar.tsx`
- Reduce mobile horizontal padding (`px-8`→`px-5 md:px-8`, footer `px-12`→`px-6 md:px-12`).
- Tighten mobile vertical rhythm (section `py`/`mb`, `main` `pt-32`→`pt-24 md:pt-32`).
- Soften heavy card padding on mobile (`p-10`/`p-12`→`p-6`/`p-5` + `md:` restore).
- Marketing-nav Get Started → 44px on mobile (`py-3 md:py-2.5`), Log In link block padding.
- Verify no horizontal overflow at 393px; 3D robot stays `hidden md:flex`.
- **Verify:** desktop classes preserved behind `md:`; `npx tsc --noEmit` no new errors.

### T2 — Login + Signup (AUTH-02) — `login/page.tsx`, `signup/page.tsx`
- Wrapper `min-h-screen`→`min-h-dvh` + safe-area bottom pad.
- Email Input: `inputMode="email"` `autoCapitalize="none"` `autoCorrect="off"` `spellCheck={false}` `className="h-12 md:h-8"`.
- Password Input(s): `autoCapitalize="none"` `className="h-12 md:h-8"`.
- Submit + Google buttons: append `h-12 md:h-8`.

### T3 — Forgot + Reset password (AUTH-02) — `forgot-password/page.tsx`, `reset-password/page.tsx`
- Same wrapper + input/button mobile-height + attribute treatment (email / new-password fields).

### T4 — Onboarding username (AUTH-02) — `onboarding/username/page.tsx` + `claim-username-form.tsx`
- Wrapper `min-h-screen`→`min-h-dvh` + safe-area pad.
- Custom input `text-sm`→`text-base md:text-sm` (iOS zoom fix) + `autoCapitalize="none"`
  `autoCorrect="off"` `spellCheck={false}` `inputMode="text"`.
- Submit button already ~46px — leave height.

## Verification loop
- `npx tsc --noEmit` → must stay at 20 baseline errors (all in test files); 0 new.
- Targeted vitest for any touched component with tests (auth pages are RSC/no component tests;
  `claim-username-form` has none — run the auth-adjacent suites that exist).
- Self code-review: confirm every mobile change has a `md:` (or `lg:`) desktop restore; no
  server-action/logic edits; no overflow-causing fixed widths added.
- Orchestrator does the live 393px logged-out visual check + the credential-gated auth round-trip.

## Risks
- Touching the wrong class and regressing desktop → mitigated by always pairing with `md:`.
- `Input` `h-12 md:h-8` could fight the primitive's own `h-8` → Tailwind class order: the page-level
  `className` is merged last via `cn`, so `h-12 md:h-8` wins. Verify visually.

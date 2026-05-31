# Phase 95 — UI Spec (brief decisions)

393px iPhone-15 logged-out. Mobile-correct the existing design; no redesign.

## Global decisions
- **Mobile breakpoint gate:** all changes use base (mobile) utilities with `md:` (or `lg:`) to
  restore the current desktop value. Nothing changes at ≥`md` unless noted.
- **Tap targets ≥44px (mobile only):** auth `Input` → `h-12 md:h-8`; auth `Button` (submit +
  Google OAuth) → `h-12 md:h-8`. Username form input/button already ~44px (`py-3`); only its font
  needs the zoom fix.
- **No iOS zoom-on-focus:** every focusable input ≥16px on mobile. `Input` primitive already
  `text-base`. Username custom input → `text-base md:text-sm`.
- **dvh shells + safe area:** auth centered wrappers `min-h-screen` → `min-h-dvh`, with
  `py-[max(1rem,env(safe-area-inset-top))]`-style padding via `px-4 py-8` + `pb-[max(2rem,env(safe-area-inset-bottom))]`
  so the in-flow submit clears the home indicator. Submit stays in-flow (forms are short — the whole
  card fits above the keyboard at 393×852; a sticky bar is unnecessary and would fight the keyboard).

## AUTH-01 landing `/`
- Hero `<h1>` `text-5xl md:text-7xl` (keep — 48px reads fine and is intentional brand size; the
  container is `text-center` and wraps). Reduce hero horizontal pad `px-8` → `px-5 md:px-8`.
- Section paddings `px-8` → `px-5 md:px-8`; bento section `px-8 py-20` → `px-5 py-14 md:px-8 md:py-20`.
- Showcase section `px-8 py-24` → `px-5 py-16 md:px-8 md:py-24`.
- Cards: prompt card `p-8 md:p-12` → `p-5 md:p-12`; bento cards `p-10`/`p-8` → `p-6 md:p-10` / `p-6 md:p-8`.
- Section bottom margins `mb-32`/`mb-16` → `mb-20 md:mb-32` / `mb-10 md:mb-16` (tighten fold).
- `main` top pad `pt-32` → `pt-24 md:pt-32` (the marketing nav is ~64px tall on mobile).
- Footer `px-12` → `px-6 md:px-12`; `py-16` → `py-10 md:py-16`.
- Marketing nav already responsive (`px-4 md:px-8`, `gap-3 md:gap-6`); add `tap-44`-equivalent
  vertical padding is already met by `py-2.5` CTA + `py-4` nav row. Leave logic; ensure links are
  comfortably tappable (the Get Started button is `py-2.5 px-4` ≈ 40px tall → bump to `py-3` on
  mobile for 44px, `md:py-2.5`). Log In text link gets `py-2` block padding for hit area.
- No horizontal overflow: the prompt template picker is `grid-cols-2 md:grid-cols-4` (already
  stacks 2-up on mobile — good). Verify the textarea/CTA fit within `px-5`.

## AUTH-02 auth screens
- login/signup/forgot/reset: `min-h-screen` → `min-h-dvh`; wrapper gets safe-area bottom pad.
- Email `Input`: add `inputMode="email"` `autoCapitalize="none"` `autoCorrect="off"` `spellCheck={false}`.
- Password `Input`: add `autoCapitalize="none"` (keep `type=password`, `autoComplete` as-is:
  login→`current-password`, signup/reset→`new-password`).
- All auth `Input`s: add `className="h-12 md:h-8"`.
- All auth submit + Google buttons: add `className="… h-12 md:h-8"` (append, preserve `w-full`/flex).
- Card stays `max-w-sm` (fits 393px with `px-4`). Logo + titles unchanged.
- Onboarding username: input `text-sm` → `text-base md:text-sm` (zoom fix) + `autoCapitalize="none"`
  `autoCorrect="off"` `spellCheck={false}` `inputMode="text"`; submit button already `py-3` (~46px) —
  leave. Wrapper `min-h-screen` → `min-h-dvh` + safe-area pad.

## Non-goals
- No change to auth server actions, redirects, validation, or the Spline scene.
- No new shared `(auth)/layout.tsx` (out of scope; each page edit is atomic and lower-risk).

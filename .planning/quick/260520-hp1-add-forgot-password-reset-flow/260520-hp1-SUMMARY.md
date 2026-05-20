---
task_id: 260520-hp1
slug: add-forgot-password-reset-flow
date: 2026-05-20
status: complete
---

# 260520-hp1 — Add Forgot Password reset flow

Adds the standard Supabase password-recovery loop: a "Forgot password?" link on `/login`, a `/forgot-password` page that emails the reset link, and a `/reset-password` page where a recovery session can set a new password and land on `/dashboard`. No changes to `/auth/callback` — the existing `?code=…` exchange handles the email-link redirect.

## What changed

**New files**

- `src/app/(auth)/forgot-password/page.tsx` — request card. Mirrors the `/login` Card shell (logo, `max-w-sm`, centered). Renders the generic success copy when `?sent=1`, otherwise an email field + "Send reset link" button + a "Back to sign in" link. The success state intentionally does NOT depend on whether the email exists (anti-enumeration).
- `src/app/(auth)/forgot-password/actions.ts` — `requestPasswordReset` server action. Derives `origin` from request headers (or `host`, or `http://localhost:3000` fallback), calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/auth/callback?next=/reset-password })`, and always redirects to `?sent=1` unless Supabase returns a 5xx-class error (in which case `?error=…`).
- `src/app/(auth)/reset-password/page.tsx` — server component. Calls `supabase.auth.getUser()` up front and bounces unauthenticated visitors to `/login?error=Reset link expired or invalid`. Renders the Card shell with two password fields (new + confirm, `minLength=6`, `autoComplete="new-password"`) and an "Update password" submit button. Shows the `?error=…` banner when the action redirects back with a validation failure.
- `src/app/(auth)/reset-password/actions.ts` — `updatePassword` server action. Validates length (≥6) + match (`password === confirmPassword`), re-asserts the recovery session, calls `supabase.auth.updateUser({ password })`, revalidates `/` layout, redirects to `/dashboard` on success.
- `tests/e2e/forgot-password.spec.ts` — Playwright smoke (2 cases, both PASS — see "Test results" below).

**Modified**

- `src/app/(auth)/login/page.tsx` — added a right-aligned "Forgot password?" link inside the password row (flex-row label + link pattern).
- `src/lib/profile/reserved-usernames.ts` — added `'reset-password'` to `RESERVED_USERNAMES` (the existing `'forgot-password'` entry was already present).
- `src/lib/supabase/middleware.ts` — **deviation, see below** — allowlisted `/forgot-password` and `/reset-password` so unauthenticated visitors aren't bounced to `/login` before the page-level guards can run.
- `.gitignore` — added `/test-results` and `/playwright-report` so the new spec's artifact dirs don't pollute git status.

## Commits

| Hash      | Type    | Summary                                                                 |
| --------- | ------- | ----------------------------------------------------------------------- |
| `ffc5b4a` | feat    | /forgot-password page+action, login link, reserved username (Task 1)    |
| `0e753e7` | feat    | /reset-password page+action (recovery-session password update) (Task 2) |
| `c559939` | fix     | allow /forgot-password + /reset-password through auth middleware (deviation, Rule 2) |
| `c4ff29c` | test    | Playwright smoke for /forgot-password link + form (Task 3)              |

## Deviations from plan

**[Rule 2 — missing critical functionality] Middleware allowlist** *(commit `c559939`)*

- **Discovered during:** Task 3 Playwright smoke (the spec failed because `/forgot-password` returned a 307 to `/login`).
- **Issue:** `src/lib/supabase/middleware.ts` redirects every non-allowlisted path to `/login` for unauthenticated visitors. The allowlist contains `/`, `/login`, `/signup`, `/privacy`, `/terms`, `/auth` — but NOT `/forgot-password` (or the new `/reset-password`). Without the fix, the entire feature is unreachable end-to-end: a user who can't remember their password can't reach the page that lets them recover it.
- **Fix:** Added `/forgot-password` and `/reset-password` to the allowlist. `/reset-password` is also allowlisted so the page-level `getUser()` redirect (with the friendly `?error=Reset link expired or invalid`) gets to run instead of a silent middleware bounce.
- **Files modified:** `src/lib/supabase/middleware.ts`, `.gitignore`.

## Supabase dashboard setup (REQUIRED — user must do this)

In the Supabase project's **Authentication → Email Templates → Reset Password** template, the action-link URL must be set to:

```
{{ .SiteURL }}/auth/callback?next=/reset-password
```

Without this, the email link will land on a route that does not exchange the `?code=…` for a session, and the user will arrive at `/reset-password` without a recovery session — bouncing them straight back to `/login?error=Reset link expired or invalid`. The application code is correct; the dashboard template is the missing piece.

`SiteURL` should already be set to the production origin (and to `http://localhost:3000` in local Supabase, if applicable) — no change there.

## Manual smoke remaining

The one path the Playwright spec cannot exercise locally:

1. From `/forgot-password`, submit a real registered email.
2. Open the inbox, click the link from "Supabase Auth" / "Reset your password".
3. Browser navigates to `{SiteURL}/auth/callback?code=…&next=/reset-password`, which exchanges the code and redirects to `/reset-password`.
4. Set a new password (≥6 chars, both fields matching).
5. Land on `/dashboard`.
6. Sign out and confirm you can sign back in with the new password.

This step depends on a real inbox + a configured Supabase project + the dashboard email-template redirect URL from the section above. Once those are in place, smoke once against prod (and once against local Supabase if it's wired up).

## Type-check

`npx tsc --noEmit` — **PASS** on all touched files (`forgot-password/page.tsx`, `forgot-password/actions.ts`, `reset-password/page.tsx`, `reset-password/actions.ts`, `login/page.tsx`, `reserved-usernames.ts`, `supabase/middleware.ts`).

The full repo `tsc --noEmit` still shows the pre-existing test-file errors (`__tests__/auth/*`, `__tests__/stripe/sync-subscription.test.ts`, `__tests__/projects/crud.test.ts`, etc.) that are present on the base commit `0442b1b` — out of scope for this task, unchanged by this work.

## Playwright smoke

**Written:** yes (`tests/e2e/forgot-password.spec.ts`).
**Cases:**
  1. "Forgot password link is visible on /login" — verifies the link is visible and `href="/forgot-password"`.
  2. "Submitting forgot-password form shows generic success" — submits a non-existent email and asserts the URL becomes `…/forgot-password?sent=1` and the generic copy renders.
**Result:** `2 passed (2.5s)` against a dev server running this worktree on port 3055 (`E2E_BASE_URL=http://localhost:3055`).
**Run command:** `npx playwright test tests/e2e/forgot-password.spec.ts --reporter=line` (the spec honors `E2E_BASE_URL` and defaults to `http://localhost:3000`).

**Note on infrastructure:** The repo has `@playwright/test` and `playwright` in dependencies, but no `playwright.config.ts` and no other `tests/e2e/*.spec.ts` files yet — this is the first end-to-end spec. The spec is self-contained (no helpers, no setup file required) and runs fine against Playwright's defaults. If a future task adds a `playwright.config.ts` with a `webServer` block, the spec will pick it up automatically.

## STATE.md row (operator-applied during docs commit)

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260520-hp1 | Add Forgot Password reset flow (request + reset pages, login link, reserved username, middleware allowlist, Playwright smoke). 4 atomic commits. Operator must set Supabase Reset Password template redirect URL to `{{ .SiteURL }}/auth/callback?next=/reset-password`; one manual smoke step remains (email click → reset → dashboard). | 2026-05-20 | c4ff29c | [260520-hp1-add-forgot-password-reset-flow](./quick/260520-hp1-add-forgot-password-reset-flow/) |

## Self-Check: PASSED

Verified after writing this SUMMARY:

- Files created:
  - `src/app/(auth)/forgot-password/page.tsx` — FOUND
  - `src/app/(auth)/forgot-password/actions.ts` — FOUND
  - `src/app/(auth)/reset-password/page.tsx` — FOUND
  - `src/app/(auth)/reset-password/actions.ts` — FOUND
  - `tests/e2e/forgot-password.spec.ts` — FOUND
- Files modified:
  - `src/app/(auth)/login/page.tsx` — contains "Forgot password?"
  - `src/lib/profile/reserved-usernames.ts` — contains `'reset-password'`
  - `src/lib/supabase/middleware.ts` — contains `/forgot-password` and `/reset-password` allowlist entries
- Commits in `git log`: `ffc5b4a`, `0e753e7`, `c559939`, `c4ff29c` — all FOUND.
- Playwright spec last run: 2 passed (2.5s).
- `tsc --noEmit` on touched files: clean.

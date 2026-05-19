---
phase: 86-admin-save-as-template-flow-previews
plan: 01
status: complete
date: 2026-05-19
requirements-completed: [ADMIN-01, ADMIN-02]
---

# Plan 86-01 Summary — Admin Auth Helper + Preview-Render Helper + Storage Bucket

## What was built
- **NEW `src/lib/auth/admin.ts`** — the single reusable server-side admin
  gate. `isAdminUser(userId)` checks the `ADMIN_USER_IDS` comma-separated env
  allowlist (trimmed entries); `requireAdmin(supabase)` reads the logged-in
  Supabase session via `auth.getUser()` and returns `{ id, email }` or `null`.
  - FAIL-SAFE-CLOSED: an unset/empty `ADMIN_USER_IDS` returns `false` for
    everyone — the admin surface is fully closed, never accidentally open.
  - Session-cookie check only — no bearer token. Never throws.
  - The client is passed in (not constructed), so the same helper serves both
    a Server Component loader and a Route Handler.
- **NEW `src/lib/render/preview-render.ts`** — `renderCoverPreviewPng(slide,
  template, ctx, origin?)`, the reusable form of the `/api/render`
  single-slide Satori pipeline. Calls `buildSlideElement` +
  `loadFontBuffersForSlide`, builds an `ImageResponse` at 1080x1920, returns a
  PNG `Buffer`. Render parity (TPLREND-05) preserved — reuses
  `buildSlideElement` unchanged, no new render fields, no new Satori options.
  `/api/render/route.ts` and `seed-explore/route.ts` were NOT modified
  (refactoring the existing callsites was out of scope).
- **NEW `supabase/migrations/20260519_phase86_template_previews_bucket.sql`** —
  additive + reversible migration creating ONE new public storage bucket
  `template-previews`. Public SELECT policy only; NO authenticated
  INSERT/UPDATE/DELETE policy (deny-by-default — service-role-only writes,
  mirroring the Phase 83 `templates` table write posture). Reversal note in
  the header.
- **NEW `src/lib/auth/__tests__/admin.test.ts`** — 9 tests, all pass.
- **NEW `src/lib/render/__tests__/preview-render.test.ts`** — 3 tests, all pass.

## Verification
- `npx tsc --noEmit` — no errors in the new files.
- `admin.test.ts` — 9/9 pass (allowlist match, fail-safe-closed, whitespace
  trim, null/undefined ids, session resolution, no-throw on getUser error).
- `preview-render.test.ts` — 3/3 pass (returns a Buffer, 1080x1920
  ImageResponse, slide/template/ctx forwarded to buildSlideElement).
- Migration file present; creates only the `template-previews` bucket.
- No existing file was modified.

## Deviations
None — plan executed exactly as written.

## User setup required
- Set `ADMIN_USER_IDS` (comma-separated Supabase user ids) in `.env.local` and
  Vercel — Diego's dev user id is `ed8ca688-ec50-4c8c-834e-1b9f562eee8a`.
  Without it the admin page and endpoint are fully closed (fail-safe).
- Apply `supabase/migrations/20260519_phase86_template_previews_bucket.sql` to
  the shared Supabase project.

## Self-Check: PASSED

---
phase: 86-admin-save-as-template-flow-previews
plan: 02
status: complete
date: 2026-05-19
requirements-completed: [ADMIN-01, ADMIN-02]
---

# Plan 86-02 Summary — Admin Save-as-Template Flow

## What was built
- **NEW `src/lib/templates/slug.ts`** — `templateSlug(name)` (pure: lowercases,
  collapses non-alphanumerics to `-`, strips edge dashes, caps at 60, falls
  back to `'template'`) + `withSuffix(slug)` (appends a `-` + 6-char random
  suffix; kept separate so `templateSlug` stays deterministic).
- **NEW `src/app/api/admin/templates/route.ts`** — `POST` Save-as-Template
  endpoint, `maxDuration = 60`:
  1. Admin gate (ADMIN-01) — `requireAdmin` on the session cookie → 403 for a
     non-admin or no-session request. Mirrors the `(admin)` layout gate.
  2. Validates `projectId` / `name` / `category` (`category` must be a
     `CONTENT_CATEGORIES` value — closed-enum invariant → 400 otherwise).
  3. Loads the admin's OWN source carousel via `getProject(supabase, admin.id,
     projectId)` (own-projects only — `getProject` filters `user_id`).
  4. `extractLayoutRecipe(slides)` (Phase 84) → `{ recipe, flatStyle }`.
  5. `renderCoverPreviewPng(slides[0], sourceTemplate, ctx, origin)` (the
     Plan 86-01 helper) → cover PNG.
  6. Collision-safe id: `templateSlug(name)`, suffixed via `withSuffix` if it
     collides with a code-template id (`TEMPLATE_IDS`) or an existing DB row —
     never shadows a code template (code wins per Phase 83).
  7. Uploads the PNG to the `template-previews` bucket via the service-role
     client; ONE service-role `.insert` of the FULL row (`id`, `name`,
     `category`, `flat_style`, `layout_recipe`, `created_by`, `preview`).
  8. Returns 201 `{ id, name, previewUrl }`. Orphan-preview cleanup on insert
     failure.
- **NEW `src/app/(admin)/layout.tsx`** — the `(admin)` route-group layout;
  `requireAdmin` → server-side `redirect('/dashboard')` for non-admins (not a
  hidden link). Centered `max-w-2xl` `bg-[#fff8f7]` container — NOT the full
  DashboardShell.
- **NEW `src/app/(admin)/templates/save/page.tsx`** — async Server Component;
  loads the admin's own carousels via `listProjects` and renders the form.
- **NEW `src/app/(admin)/templates/save/save-template-form.tsx`** — `'use
  client'` form: source-carousel `<select>`, `name` `<input>`, `category`
  `<select>` (options derived from `CONTENT_CATEGORIES` — no hardcoded third
  option), a 9:16 cover-preview frame, `useTransition` submit POSTing to
  `/api/admin/templates`, distinct success/error blocks, and a `No carousels
  yet` empty state. Form idiom mirrors `claim-username-form.tsx`.
- **NEW `src/lib/templates/__tests__/slug.test.ts`** — 7 tests, all pass.
- **NEW `src/app/api/admin/templates/__tests__/route.test.ts`** — 6 tests, all
  pass.

## Verification
- `npx tsc --noEmit` — no errors in the new files.
- `slug.test.ts` — 7/7 pass.
- `route.test.ts` — 6/6 pass: non-admin → 403, no-session → 403 (ADMIN-01),
  out-of-enum category → 400, empty name → 400, happy path → 201 with
  `layout_recipe` + `flat_style` + `created_by` + `preview` in one insert,
  slug collision → suffixed id.
- `npm run build` — succeeds; `/templates/save` and `/api/admin/templates`
  compile.

## Deviations
**[Rule 1 - Bug] extractLayoutRecipe second-arg type** — Found during: Task 3.
The plan said to pass the resolved `SlideTemplate` as `extractLayoutRecipe`'s
2nd arg, but the Phase 84 signature's 2nd arg is `Partial<SlideStyleOverrides>`
(a style-overrides fallback), not a `SlideTemplate` — tsc error TS2559. Fix:
call `extractLayoutRecipe(slides)` with no 2nd arg. This is correct — the
source carousel's slides already carry their own `style_overrides`, so the
recipe extracts from the slides directly; the template fallback is optional.
Files modified: `src/app/api/admin/templates/route.ts`. Verified: `tsc`
clean. Commit: d37b21c.

**Total deviations:** 1 auto-fixed (1 bug). **Impact:** none on behavior —
the recipe extraction is correct from the slides; only the unnecessary
template-as-fallback arg was dropped.

## Self-Check: PASSED

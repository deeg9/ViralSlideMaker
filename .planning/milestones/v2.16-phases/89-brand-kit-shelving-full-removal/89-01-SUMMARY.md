---
phase: 89-brand-kit-shelving-full-removal
plan: 01
subsystem: ui
tags: [brand-kit, template-picker, openapi, next-app-router, removal]

# Dependency graph
requires:
  - phase: 87-88
    provides: merged template registry (getPickerDbTemplates / TemplateTilePreview) that the picker tile renders through
provides:
  - Template picker free of the "Your Brand Kit" tile and the "Build your brand kit" empty-state CTA
  - Settings -> Brand Kit page directory deleted (route 404s)
  - /api/v1/me/brand-kit/* route directories deleted (endpoints 404)
  - OpenAPI spec free of the BrandKit schema and both /me/brand-kit path objects (no dangling $ref)
  - App header, settings sidebar, and resources page carry no brand-kit nav link or CTA
affects: [89-02, 89-03, 89-04, phase-90, generation-form, slide-editor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Leaf-first removal: gut UI/API consumers before the shared brand-kit library (deleted in Plan 04)"
    - "App Router route deletion = automatic 404 (no central route table)"

key-files:
  created:
    - .planning/phases/89-brand-kit-shelving-full-removal/deferred-items.md
  modified:
    - src/components/slides/template-picker.tsx
    - src/components/slides/template-tile-preview.tsx
    - src/app/(dashboard)/settings/layout.tsx
    - src/components/layout/app-header.tsx
    - src/app/(dashboard)/resources/page.tsx
    - src/lib/api/openapi.ts
    - src/app/(dashboard)/project/[id]/page.tsx
    - src/components/slides/generation-form.tsx
    - src/__tests__/components/template-picker.test.tsx

key-decisions:
  - "Removed the whole brand-kit AppStep from resources/page.tsx (not just its CTA) — the step body describes a deleted feature"
  - "Dropped the dangling brandKit prop from the <TemplatePicker> call in generation-form.tsx (Rule 3) to hold the 20-error tsc baseline; the rest of generation-form's brand-kit footprint stays for Plan 03"

patterns-established:
  - "Brand-kit removal strips imports/props from a file but leaves importing modules outside the plan's scope untouched"

requirements-completed: [BKSHELVE-01, BKSHELVE-02, BKSHELVE-03]

# Metrics
duration: 12min
completed: 2026-05-21
---

# Phase 89 Plan 01: Brand-Kit UI Surfaces & API Removal Summary

**Removed every user-facing brand-kit surface — picker tile, Settings page, `/api/v1/me/brand-kit/*` routes, OpenAPI schema/paths, and nav links/CTAs — deleting three leaf brand-kit directories outright.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-21T01:47:00Z
- **Completed:** 2026-05-21T01:59:00Z
- **Tasks:** 3
- **Files modified:** 9 (8 edited, 1 created); 5 files deleted via 3 directory removals

## Accomplishments

- Stripped the configured "Your Brand Kit" tile and the "Build your brand kit" empty-state CTA from the template picker; registry-template tiles still render.
- Deleted the `settings/brand-kit/`, `api/v1/me/brand-kit/`, and `components/brand-kit/` directories — Settings page and both API endpoints now 404 via App Router auto-discovery.
- Removed the `BrandKit` schema and both `/me/brand-kit` path objects from `openapi.ts`, including every `$ref: '#/components/schemas/BrandKit'` — no dangling `$ref` (threat T-89-01 mitigated).
- Removed brand-kit nav links/CTAs from the app header, settings sidebar (dead comment), and resources page.
- Stripped brand-kit assertions from the picker test; the 3 render-parity suites stay GREEN at 45/45 (BKSHELVE-05 gate intact).

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the brand-kit tile from the template picker** — `74cb517` (refactor)
2. **Task 2: Delete the Settings -> Brand Kit page, API routes, and form component** — `ec7bb29` (refactor, directory deletions) + `221fcbf` (refactor, file edits — see Issues Encountered)
3. **Task 3: Strip brand-kit assertions from the template-picker test** — `131c958` (test)

## Files Created/Modified

- `src/components/slides/template-picker.tsx` — Removed the configured/empty-state brand-kit tiles, the `brandKit` prop, the `isBrandKitConfigured` guard, and the synthesize/sentinel imports.
- `src/components/slides/template-tile-preview.tsx` — Dropped the `brandKit` prop and its pass-through to `<SlidePreview>`.
- `src/app/(dashboard)/settings/brand-kit/` — DELETED (`page.tsx` + `actions.ts`).
- `src/app/api/v1/me/brand-kit/` — DELETED (`route.ts` + `logo-upload-url/route.ts`).
- `src/components/brand-kit/` — DELETED (`brand-kit-form.tsx`).
- `src/app/(dashboard)/settings/layout.tsx` — Removed the dead commented-out brand-kit nav entry.
- `src/components/layout/app-header.tsx` — Removed the emptied nav block containing the brand-kit link.
- `src/app/(dashboard)/resources/page.tsx` — Removed the "Set up Brand Kit" `AppStep` + CTA; trimmed brand-kit from the page metadata description.
- `src/lib/api/openapi.ts` — Removed the `BrandKit` schema and both `/me/brand-kit` path objects (with every `$ref`).
- `src/app/(dashboard)/project/[id]/page.tsx` — Removed the now-dangling `getBrandKit` import, the `brandKit` const, and both `brandKit` prop pass-throughs.
- `src/components/slides/generation-form.tsx` — Rule 3 fix: dropped the `brandKit` prop from the `<TemplatePicker>` call (caller breakage from Task 1).
- `src/__tests__/components/template-picker.test.tsx` — Removed the `BrandKit` import, the `brandKit` prop from every render, and the two brand-kit-only `it()` blocks.
- `.planning/phases/89-brand-kit-shelving-full-removal/deferred-items.md` — CREATED to log a pre-existing out-of-scope test failure.

## Decisions Made

- **Removed the whole brand-kit `AppStep` from `resources/page.tsx`**, not just its CTA — the step body ("Lock in your Brand Kit once") describes a deleted feature, so leaving it would document a 404 destination.
- **`SlideEditor` and `GenerationForm` keep their optional `brandKit?` props** for now — `project/[id]/page.tsx` simply omits the prop. Those component props are stripped in Plans 02/03 per the strictly-linear removal order.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped the dangling `brandKit` prop from `generation-form.tsx`**
- **Found during:** Task 3 (tsc verification)
- **Issue:** Task 1 removed the `brandKit` prop from `TemplatePicker`, but `generation-form.tsx` L530 still passed `brandKit={brandKit}` to `<TemplatePicker>` — a hard `error TS2322`, pushing the tsc count to 21 (over the 20 baseline / over the plan's success criterion).
- **Fix:** Removed the single `brandKit={brandKit}` line from the `<TemplatePicker>` render call. The remaining 5 `brandKit` references in `generation-form.tsx` (prop declaration, request-body fields, child props) are Plan 03 (BKSHELVE-04) scope and cause no errors.
- **Files modified:** `src/components/slides/generation-form.tsx`
- **Verification:** `npx tsc --noEmit | grep -cE 'error TS'` → 20 (baseline restored); no error names any plan-touched file.
- **Committed in:** `131c958` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The fix was a one-line caller cleanup forced by Task 1's prop removal — necessary to hold the tsc baseline. No scope creep; the broader `generation-form.tsx` brand-kit removal remains Plan 03's job.

## Issues Encountered

- **Task 2 staging split across two commits.** `git rm -r` on the three directories staged the deletions; the follow-up `git add` for the five edited files used the (now-nonexistent) deleted-directory pathspecs first, which aborted staging before reaching the edits. The directory-deletion commit (`ec7bb29`) and the file-edit commit (`221fcbf`) together constitute Task 2's atomic work. No content was lost — `git status` was verified clean after the second commit.
- **Pre-existing picker test failure (out of scope).** `template-picker.test.tsx` has one failing test — the Phase-56 templates assertion (`Unable to find an element with the text: Notes App Chic`). Verified PRE-EXISTING on the plan base SHA `7bda938` (`1 failed | 8 passed (9)` with the identical error). It is unrelated to brand-kit removal — the `notes-app-chic` template no longer renders as a default picker tile, likely from a recent quick task's keeper-set change. Logged to `deferred-items.md`; NOT fixed (SCOPE BOUNDARY rule). After the brand-kit strip the suite is `6 passed | 1 failed (7)` — all 3 brand-kit-related failures resolved.

## Deferred Issues

- The pre-existing `template-picker.test.tsx` "Notes App Chic" failure — see `deferred-items.md`. Recommend a follow-up quick task to either re-add `notes-app-chic` to `pickerTemplates` or update the test to the current keeper set.

## User Setup Required

None — no external service configuration required. (Manual smoke checks `/settings/brand-kit` → 404 and `curl /api/v1/me/brand-kit` → 404 are deferred to phase verification.)

## Next Phase Readiness

- Picker, settings, API, and nav are brand-kit-free. The shared library `src/lib/brand-kit/` is still alive (deleted in Plan 04).
- Plan 02 (render/publish/download + resolver fallback) can proceed — its files were untouched here.
- `generation-form.tsx`, `slide-editor.tsx`, and other consumers still carry `brandKit` props/imports for Plans 02/03 to strip; the shared library deletion is Plan 04.

## Verification Results

- `npx tsc --noEmit` error count: **20** (≤ 20 baseline; no new error in any plan-touched file).
- 3 render-parity suites (`legacy-templates-byte-identical`, `legacy-templates-regression`, `new-templates-parity`): **45/45 GREEN** (BKSHELVE-05 gate intact).
- `template-picker.test.tsx`: **6 passed, 1 pre-existing out-of-scope fail** (documented).
- Brand-kit footprint grep across all plan files: **zero** brand-kit references remain.
- Three brand-kit directories confirmed deleted; OpenAPI spec has no `schemas/BrandKit` `$ref`.

## Self-Check: PASSED

- `src/components/slides/template-picker.tsx` — FOUND, brand-kit-free
- `src/lib/api/openapi.ts` — FOUND, no BrandKit schema or `$ref`
- `.planning/phases/89-brand-kit-shelving-full-removal/deferred-items.md` — FOUND
- `src/app/(dashboard)/settings/brand-kit/` — confirmed DELETED
- `src/app/api/v1/me/brand-kit/` — confirmed DELETED
- `src/components/brand-kit/` — confirmed DELETED
- Commits `74cb517`, `ec7bb29`, `221fcbf`, `131c958` — all present in `git log`

---
*Phase: 89-brand-kit-shelving-full-removal*
*Completed: 2026-05-21*

---
phase: 88-render-paths-per-slide-override-publish-fork
plan: 01
status: complete
date: 2026-05-19
requirements-completed: [WIRE-03]
---

# Plan 88-01 Summary — Render-Path Sync→Async Template Resolution (WIRE-03)

## What was built
- **`src/app/api/render/route.ts`** — the Satori PNG single-slide render route
  resolves the project template via `await resolveTemplate(p.template_id ?? 'highlight-bar')`
  (was sync `getTemplate`). Import switched to `@/lib/render/templates/registry`.
- **`src/app/api/v1/projects/[id]/download/route.ts`** — the ZIP download route
  resolves the project template via `await resolveTemplate(...)`.
- **`src/app/(dashboard)/project/[id]/publish-actions.ts`** — both
  `renderHero` and `renderMinimalHero` resolve via `await resolveTemplate(...)`.
- **`src/lib/services/publish.ts`** — `renderHeroBuffer` resolves via
  `await resolveTemplate(...)`.
- **`src/lib/ai/prompts.ts`** — `buildSystemPrompt` gains an optional 4th
  parameter `resolvedTemplate?: SlideTemplate`. The template lookup is now
  `resolvedTemplate ?? (templateId ? getTemplate(templateId) : undefined)`.
  `buildSystemPrompt` STAYS a sync function — when no resolved template is
  passed it falls back to the sync code-only `getTemplate`, byte-identical for
  every existing caller and the 40+ unit tests.
- **`src/lib/ai/generate-slides.ts`** — pre-resolves the template DB-aware via
  `await resolveTemplate(templateId)` (the enclosing generation function is
  already async) and passes it to `buildSystemPrompt` as the 4th argument, so a
  DB template's `aiVoiceNote` / `accentColor` reach the system prompt.
- **`src/app/(dashboard)/project/[id]/actions.ts`** — `generateCarousel`
  resolves the template via `await resolveTemplate(effectiveTemplateId)` at the
  photo-treatment site and the color-only-template check (both in the async
  body). Import folded into the existing registry import line.
- **`src/components/editor/slide-editor.tsx`** — `SlideEditor` (a `'use client'`
  component) gains an optional `dbTemplates?: PickerDbTemplate[]` prop. The
  render-body resolution resolves `currentTemplateId` code-first
  (`TEMPLATE_IDS.includes` → `getTemplate`), and for a DB id resolves from the
  server-fetched `dbTemplates` list. No async added to the client render body.
- **`src/app/(dashboard)/project/[id]/page.tsx`** — the async server component
  fetches `await getPickerDbTemplates()` in the `hasSlides` editor branch and
  threads the result into `<SlideEditor dbTemplates=...>`.

## Verification
- `npx tsc --noEmit` — zero errors in all 9 Phase 88-01 touched files.
  (One pre-existing error in `slide-editor.treatment-sync.test.tsx` —
  confirmed present on clean HEAD before Phase 88, part of the documented
  41-test baseline; not in scope.)
- All 5 render-path files have zero remaining `getTemplate(` calls.
- `buildSystemPrompt` is still a non-async function returning `string`.
- `prompts.test.ts` / `prompts.test.ts` (lib) / `category-routing.test.ts` —
  36/37 pass; the single failure (`buildSystemPrompt returns string containing
  all 6 hook patterns`) is pre-existing on clean HEAD (the documented
  `editorial-serif-name` baseline failure) — Phase 88 added zero new failures.
- The 3 fixture suites `legacy-templates-byte-identical`,
  `legacy-templates-regression`, `new-templates-parity` confirmed green at
  45/45 before execution started.

## Deviations from Plan
- **[Design — flagged in plan] buildSystemPrompt stays sync.** CONTEXT.md said
  "convert prompts.ts buildSystemPrompt's getTemplate to async". A literal
  asyncification breaks 40+ sync test callers + `generate-slides.ts`. The plan
  (88-01) already resolved this with the optional-param design — caller
  pre-resolves, `buildSystemPrompt` stays sync. Executed as planned.
- The editor canvas path (CONTEXT: "include the editor canvas path") could not
  async-resolve inside a `'use client'` render body — solved by server-side
  pre-fetch + prop threading, executed as planned in 88-01 Task 8.

**Total deviations:** 0 unplanned (both design choices were already captured in
the committed plan; no architectural surprise during execution).

## Ready for
Plan 88-02 — per-slide DB-aware override + fork inherits template_id.

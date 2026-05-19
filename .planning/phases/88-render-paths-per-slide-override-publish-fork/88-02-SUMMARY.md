---
phase: 88-render-paths-per-slide-override-publish-fork
plan: 02
status: complete
date: 2026-05-19
requirements-completed: [WIRE-04, WIRE-05]
---

# Plan 88-02 Summary — Per-Slide DB Override + Fork Inheritance (WIRE-04, WIRE-05)

## What was built

### WIRE-04 — per-slide DB-aware override
- **`src/lib/render/templates/registry.ts`** — new exported async function
  `getDbTemplatesMap()` returns ALL DB templates as a synchronous-lookup
  `Map<string, SlideTemplate>` keyed by id. Code-collision rows are dropped
  (code wins). Never throws — a DB read failure degrades to an empty map.
- **`src/lib/render/resolve-per-slide-template.ts`** — `resolvePerSlideTemplate`
  gains an optional 3rd parameter `dbTemplates?: ReadonlyMap<string, SlideTemplate>`.
  The function STAYS synchronous. Resolution order: a code-id override →
  `getTemplate`; a DB-id override + map supplied + id present → that DB
  template; any other override → `projectTemplate` (STYLESPEC-10 silent
  fallback). No override → exact `projectTemplate` reference (TPLREND-05).
  JSDoc updated to document the new order and the sync-keeping rationale.
- **`src/lib/render/render-slide-satori.tsx`** — `buildSlideElement` gains a
  7th optional parameter `dbTemplates` forwarded as the 3rd arg to
  `resolvePerSlideTemplate`.
- **`src/lib/render/render-slide.ts`** — `buildSlideHtml` gains a 5th optional
  parameter `dbTemplates` forwarded likewise.
- **`src/app/api/render/route.ts`**, **`src/app/api/v1/projects/[id]/download/route.ts`**,
  **`src/lib/services/publish.ts`** (`renderHeroBuffer`),
  **`src/app/(dashboard)/project/[id]/publish-actions.ts`** (`renderHero`) —
  each pre-fetches `await getDbTemplatesMap()` and threads it as the 7th
  `buildSlideElement` arg. The download route fetches the map ONCE before the
  ZIP loop. `renderMinimalHero` (no `buildSlideElement`, no per-slide path)
  is unchanged.

### WIRE-05 — fork inherits template_id
- **`src/app/api/v1/explore/[slug]/fork/route.ts`** — the `.select(...)` now
  fetches `template_id`; the `projects` insert uses
  `(published.template_id as string | null) ?? 'bold-minimal'` instead of the
  hardcoded `'highlight-bar'`. The `'bold-minimal'` fallback matches the
  `fork_published_carousel` RPC's `COALESCE(pub.template_id,'bold-minimal')`
  exactly. The stale "default to highlight-bar" comment was replaced.
- The `fork_published_carousel` Postgres RPC was NOT changed — it already
  inherits `template_id` correctly via `COALESCE` (migration
  `20260512_v213_fork_inherits_template_id.sql`). The bug was solely the TS
  route's stale hardcode. No migration file was modified.

## Verification
- `npx tsc --noEmit` — zero errors in all 9 Phase 88-02 touched files.
- `resolve-per-slide-template.test.ts` + `per-slide-template-override.test.tsx`
  + `db-template-parity.test.tsx` — 19/19 pass (pre-existing tests unchanged;
  the new optional param is fully backward-compatible).
- The 3 fixture suites + `render-slide-satori.test.tsx` + `render-slide.test.ts`
  — 56/56 pass; the builder signature changes broke nothing.
- `git status supabase/` is clean — no migration touched.
- `resolvePerSlideTemplate` is still a synchronous function.

## Deviations from Plan
- **[Design — flagged in plan] resolvePerSlideTemplate stays sync.** CONTEXT.md
  said "make resolvePerSlideTemplate async". A literal asyncification cascades
  into 7 `'use client'` callers (slide-canvas, sortable-slide, elements-panel,
  explore-card, project-card, slide-grid, carousel-slideshow) + ~40 parity
  test files. The plan (88-02) already resolved this with the optional-sync-map
  design — server routes pre-fetch the map, the helper stays sync. Executed as
  planned.
- **[Discovery] The fork RPC was already correct.** CONTEXT.md said "verify the
  fork_published_carousel RPC doesn't also override template_id; fix wherever
  the hardcode lives." Investigation confirmed the RPC already inherits via
  `COALESCE` (migration 20260512). The hardcode was ONLY in the TS route —
  fixed there; the RPC was correctly left untouched.

**Total deviations:** 0 unplanned. Both items above were anticipated in the
committed plan / CONTEXT.md.

## Ready for
Plan 88-03 — WIRE-06 verification tests.

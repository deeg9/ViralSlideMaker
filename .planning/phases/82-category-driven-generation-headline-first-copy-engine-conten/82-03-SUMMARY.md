---
phase: 82-category-driven-generation-headline-first-copy-engine-conten
plan: 03
subsystem: ai
tags: [generation-wiring, category-selector, prompt-assembly, supabase, public-by-default]

requires:
  - phase: 82-01
    provides: "optional body_text + accessory_label schema"
  - phase: 82-02
    provides: "category registry + News/Facts prompt modules"
provides:
  - "category threads form -> generateCarousel -> generateSlideContent -> buildSystemPrompt"
  - "buildSystemPrompt selects the copy module by category, not templateId"
  - "projects.category column + Project type field"
  - "CategorySelector component inserted into the creation form"
  - "no silent highlight-bar fallback — a category always resolves a curated template"
affects: [82-04, 82-05]

tech-stack:
  added: []
  patterns:
    - "Effective-template resolution: snap an uncurated templateId to the category default"

key-files:
  created:
    - supabase/migrations/20260517_phase82_projects_category.sql
    - src/components/slides/category-selector.tsx
    - src/lib/ai/categories/__tests__/category-routing.test.ts
  modified:
    - src/lib/ai/prompts.ts
    - src/lib/ai/generate-slides.ts
    - src/app/(dashboard)/project/[id]/actions.ts
    - src/lib/services/carousel.ts
    - src/app/api/v1/carousel/route.ts
    - src/lib/types/project.ts
    - src/components/slides/generation-form.tsx
    - src/components/slides/template-picker.tsx
    - src/app/(dashboard)/project/[id]/page.tsx
    - src/lib/ai/__tests__/slides-with-text-boxes.test.ts

key-decisions:
  - "Two generateCarousel functions exist (project action + lib/services) — BOTH threaded with category for parity; the v1 API uses the service one"
  - "TemplatePicker category prop added here (Plan 04 Task 3 scope) to keep Plan 03 self-consistent and committable; all 5 category templateIds were already picker-visible"
  - "slides-with-text-boxes fuzz test updated for the Plan 01 R4 conditional-body-box contract (hook always, body only when non-empty)"

patterns-established:
  - "Category prompt block is AUTHORITATIVE — overrides base SLIDE STRUCTURE RULES"
  - "No silent fallback: an empty/uncurated templateId snaps to the category default"
---

# Plan 82-03 Summary — Category-driven generation wiring

## What was built

`category` now threads end-to-end and drives Gemini's copy (R1); the creation form has a
category selector (R6); the silent `highlight-bar` fallback is gone (R7).

- **`buildSystemPrompt(templateId, category)`** — when a category resolves, its
  headline-first prompt module is prepended as an AUTHORITATIVE block that overrides the
  base `SLIDE STRUCTURE RULES`. Category-absent callers get the unchanged legacy path.
- **`generateSlideContent`** — new trailing `category` param, passed to `buildSystemPrompt`.
- **`generateCarousel`** — BOTH implementations (the project server action and the
  `lib/services/carousel.ts` service used by the v1 API) accept `category`, resolve an
  effective category-curated template (`templateIds[0]` if the requested one is empty or
  not in the category's set), and persist `category` on the projects row.
- **v1 API** (`/api/v1/carousel`) — accepts + validates an optional `category` against
  the known set; passes it through.
- **`projects.category`** — additive nullable migration + `Project.category?` field.
- **`CategorySelector`** — 3-up card grid per 82-UI-SPEC.md, inserted into
  `generation-form.tsx` as a default-open "Content Category" collapsible above "Select
  Visual Style". Changing the category snaps the picker to a category-appropriate
  template. `TemplatePicker` gained a `category` prop and filters to the category's
  `templateIds` subset.
- **public-by-default** — `autoPublishOnGenerate` confirmed still firing on both paths.

## Verification

- `category-routing.test.ts` — 5 tests passing (news/facts category yields the right
  copy module regardless of template; legacy + unknown-category paths preserved).
- tsc — back to the 19-error pre-existing baseline (test-mock noise only).
- `npm run lint:gates` — passes (prompt-token-budget 1371/12000).
- Full vitest suite — 55 failed (all pre-existing test-mock/snapshot drift; baseline was
  59 — net 4 fewer failures, no regression). New Phase-82 tests all pass.
- `slides-with-text-boxes` fuzz test updated for the R4 conditional-body-box contract.

## Unblocks

Plan 04 (template curation — keeper sign-off + HIDDEN_FROM_PICKER) and Plan 05 (tests).

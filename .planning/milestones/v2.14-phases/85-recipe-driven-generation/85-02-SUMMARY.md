---
phase: 85-recipe-driven-generation
plan: 02
status: complete
date: 2026-05-18
---

# Plan 85-02 Summary — Wire Both generateCarousel Paths

## What was built
- **NEW `src/lib/ai/layout-recipe-resolve.ts`** — `resolveLayoutRecipe(supabase, templateId)`:
  - Code-template id (in `TEMPLATE_IDS`) → `null`, no DB round-trip.
  - Else `supabase.from('templates').select('layout_recipe').eq('id',...).maybeSingle()`.
  - Missing row / null column / DB error / `parseLayoutRecipeSafe` ok:false
    → all `null`. Never throws.
- **`src/lib/services/carousel.ts` `generateCarousel`** (API service path):
  inserted step "2d" — `resolveLayoutRecipe` + `applyLayoutRecipe(slides, …)`
  AFTER the font/effects steps, immediately BEFORE the "3. Save to database"
  `.from('projects').update`. `autoPublishOnGenerate` call unchanged.
- **`src/app/(dashboard)/project/[id]/actions.ts` `generateCarousel`**
  (dashboard server action): symmetric step "2d" inserted before the
  "3. Save to database" update. `autoPublishOnGenerate` (admin client)
  unchanged.
- `generateCarouselFromReferences` (StyleSpec/reference path) untouched.

## Verification
- `npx tsc --noEmit` — no errors in modified files.
- grep confirms on BOTH paths: `applyLayoutRecipe` runs before the
  `slide_data` save, `autoPublishOnGenerate` runs after.
- auto-publish-on-generate + carousel-from-references tests — pass.
- generate-slides test — 10/11 pass; the 1 failure (`Pexels orientation`)
  is PRE-EXISTING (verified with changes stashed).

## Deviations
None. (CONTEXT.md mentions `resolveTemplate`; the recipe lives in the
`templates.layout_recipe` DB column which `dbRowToSlideTemplate`
deliberately does NOT surface on `SlideTemplate` — so a dedicated
`resolveLayoutRecipe` DB query is the correct resolution path. This is an
implementation detail consistent with CONTEXT.md intent, not a deviation
from a decision.)

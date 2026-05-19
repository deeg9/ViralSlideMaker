# Phase 85: Recipe-Driven Generation - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

When a carousel is generated on a template carrying a `LayoutRecipe`, the
generation pipeline applies the recipe so the output is pre-shaped — per-slide
caption-card geometry, hook positions, accent placement, and accessory labels
match the recipe.

**In scope:** a deterministic recipe-application step in the generation
pipeline; recipe semantic hints in the Gemini prompt; recipe → `style_overrides`
field mapping; back-compat for flat-style-only (no-recipe) generation;
public-by-default preservation; SC2 Oracle-look verification (RECGEN-01).

**Out of scope (other phases):** the `LayoutRecipe` model + extraction (done in
Phase 84); the admin Save-as-Template authoring flow + picker previews
(Phase 86). Phase 85 consumes the `LayoutRecipe` model from Phase 84 and the
`layout_recipe` column / `resolveTemplate` registry from Phase 83 — it does not
add storage or authoring UI.

**Highest blast radius of the milestone** — this touches the live generation
pipeline (`prompts.ts`, the projector/projection layer, `validate-slides.ts`,
`carousel.ts`). Every generated carousel for a category on a recipe-carrying
template is affected; flat-style-only generation must be byte-identically
unaffected.

</domain>

<decisions>
## Implementation Decisions

### Recipe Application Mechanism
- Recipe shaping is SPLIT: deterministic geometry (caption-card geometry, hook
  position/size bands, accent placement) is applied as a post-process
  projection step; semantic hints (accent cadence, accessory-label intent) are
  injected into the Gemini prompt. Geometry is deterministic code — never
  LLM-guessed.
- A NEW projection module (`applyLayoutRecipe`, e.g.
  `src/lib/ai/layout-recipe-apply.ts`) — the recipe path stays separable;
  `style-spec-projector` is left as the StyleSpec/reference path.
- Recipe role → generated slide mapping uses the SAME position + `is_cta` logic
  as Phase 84 extraction: slide 0 → `cover` archetype, any `is_cta: true` slide
  → `cta` archetype, the rest → `body` archetype. Symmetric with extraction.
- Order of operations: recipe application runs AFTER `validateAndRepair` (so
  recipe geometry is not clobbered by normalization) and BEFORE save +
  `autoPublishOnGenerate`.

### Back-Compat — No-Recipe Path (SC3)
- Recipe-present detection: the resolved template's `layout_recipe` is non-null
  AND parses cleanly via `parseLayoutRecipeSafe` → apply the recipe; otherwise
  skip entirely.
- Recipe application is a no-op early-return when no recipe is present. A test
  asserts a no-recipe (flat-style-only) generation's `slide_data` is
  byte-identical to the pre-Phase-85 baseline.
- The 13 code templates stay flat-style-only — they carry no `layout_recipe`;
  only DB templates can. Recipe-driven shaping is additive and DB-template-only.
- Both `generateCarousel` paths are routed through the same recipe-apply
  function AND through `autoPublishOnGenerate`: the API service
  (`src/lib/services/carousel.ts`) and the dashboard server action
  (`src/app/(dashboard)/project/[id]/actions.ts`).

### Public-by-Default + Verification
- `autoPublishOnGenerate` coverage is verified explicitly across all generation
  paths (`generateCarousel` service, `generateCarouselFromReferences`, the
  server-action `generateCarousel`) — with a regression test per path. This
  helper has regressed 6× — it is a hard gate, not a nice-to-have.
- SC2 is proven by a test that mocks Gemini, runs generation on a
  recipe-carrying News Oracle template fixture, and asserts Oracle-shaped output:
  full-bleed photo, cover caption card with edge-blend, big centered condensed
  headline, cyan pill-highlight keywords, a small "Trending" accessory label.
- Performance: recipe application adds ZERO Gemini calls — it is O(slides) pure
  deterministic code. No new perf budget concern; no perf test needed (noted,
  not gated).
- Render parity: recipe application writes ONLY into existing `style_overrides`
  fields — no new render fields — so the existing 3-path render parity holds.
  A parity assertion is added on a recipe-shaped slide.

### Recipe → slide_data Field Mapping
- Caption-card geometry maps 1:1 to the existing `caption_bar_*`
  `style_overrides` fields (`enabled`, `x`, `y`, `width`, `height_pct`,
  `blend_pct`, `opacity`, `position`).
- Hook placement bands resolve to numeric values via a deterministic
  band→numeric resolver (bands map to representative numeric values; reuse
  `computeCaptionBarBottomPositions` where applicable).
- Accessory label: the recipe sets the INTENT only — a prompt hint asks Gemini
  to populate `accessory_label`, and the post-process ensures the slot exists
  per the recipe; the label text stays Gemini's (Phase 82 R5 `accessory_label`).
- Accent rhythm: the closed-enum cadence becomes a prompt hint guiding
  `hook_segments` highlight frequency, and the accent color flows to
  `style_overrides`; segment positions are NOT deterministically forced.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/services/carousel.ts` — `generateCarousel()` (the API service path):
  resolves `effectiveTemplateId`, calls `generateSlideContent`, applies
  font/color overrides, saves `slide_data`, calls `autoPublishOnGenerate()`.
  Also `generateCarouselFromReferences()`.
- `src/app/(dashboard)/project/[id]/actions.ts` — a SECOND `generateCarousel()`
  server action (duplicate path — both must be routed).
- `src/app/api/v1/carousel/route.ts` — the POST entry (`maxDuration = 60`).
- `src/lib/ai/prompts.ts` — `buildSystemPrompt(templateId?, category?)`; recipe
  semantic-hint block injects after the category block, before the template
  addendum.
- `src/lib/ai/style-spec-projector.ts` / `-constants.ts` — the existing
  deterministic projection precedent (`projectStyleSpecToSlideOverrides`),
  `computeCaptionBarBottomPositions()`, `CAPTION_BAR_BOTTOM_*` constants.
- `src/lib/ai/validate-slides.ts` — `validateAndRepair()`; recipe-apply runs
  after this.
- `src/lib/services/auto-publish-on-generate.ts` — `autoPublishOnGenerate()`
  (best-effort; called by 3 generation paths).
- `src/lib/ai/role-distribution.ts` — `assignSlideRoles(n)` (deterministic role
  table for slide counts 3–10).
- `src/lib/render/templates/registry.ts` — `resolveTemplate(id)` async resolver
  (Phase 83) that loads a DB template + its `layout_recipe`.
- `src/lib/types/layout-recipe.ts` + `src/lib/validators/layout-recipe.ts`
  (Phase 84) — the `LayoutRecipe` model + `parseLayoutRecipeSafe`.
- `SlideStyleOverrides` (`src/lib/types/slide.ts`) — `caption_bar_*` fields,
  `hook_position`, `body_position`, `accessory_label`, `hook_segments`.

### Established Patterns
- Deterministic projection: a pure function emitting into `style_overrides`,
  skip-emit when a field is absent.
- Closed-enum invariant; no new slide fields (the slide schema is frozen —
  `slide-zero-new-fields` test).
- Generation routes timeout at `maxDuration = 60`; no formal perf budget tests.
- `autoPublishOnGenerate` regression history (≈quick-260514-k3j) — recurring
  miss when new generation paths ship.

### Integration Points
- New file: `src/lib/ai/layout-recipe-apply.ts` (recipe → `style_overrides`
  projection).
- `src/lib/services/carousel.ts` `generateCarousel` + `generateCarouselFromReferences`,
  and `src/app/(dashboard)/project/[id]/actions.ts` `generateCarousel` — call
  `resolveTemplate`, load `layout_recipe`, run `applyLayoutRecipe` after
  `validateAndRepair`, before save.
- `src/lib/ai/prompts.ts` — recipe semantic-hint block.
- Generation tests: `src/__tests__/ai/generate-slides.test.ts`,
  `src/lib/ai/__tests__/generate-from-style-spec.test.ts`,
  `src/lib/services/__tests__/auto-publish-on-generate.test.ts`.

</code_context>

<specifics>
## Specific Ideas

- SC2 acceptance: a News-category generation on the News Oracle template comes
  out shaped like the Oracle reference — full-bleed photo, cover caption card
  with edge-blend, big centered condensed headline, cyan pill-highlight
  keywords, a small "Trending" accessory label.
- SC3: a generation on a flat-style-only template (no `LayoutRecipe`) is
  unaffected — recipe application is additive and only fires when a recipe is
  present.
- SC4 / public-by-default: newly generated recipe-shaped carousels still default
  to Public — every touched generation path routes through
  `autoPublishOnGenerate` (this helper has regressed 6× — verify).
- Watch generation-perf: recipe application must add no Gemini call and stay
  within the existing budget (cf. v2.12 `template_id_override` runaway).

</specifics>

<deferred>
## Deferred Ideas

- The admin Save-as-Template authoring flow + DB-template picker previews —
  Phase 86.
- A non-admin / end-user recipe authoring surface — deferred for the milestone.
- Editing/deleting a stored recipe — V1 is save-new-only.

</deferred>

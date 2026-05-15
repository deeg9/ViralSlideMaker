---
phase: quick-260515-dwu
plan: 01
subsystem: style-from-reference
tags:
  - copy-style-routing
  - persistence
  - public-by-default
  - REMIX-04
requires:
  - generateCarouselFromReferences (existing)
  - regenerateAction (existing)
  - SpecPreviewState reducer (existing)
provides:
  - "carousel.ts: style_spec + reference_assets persisted on Copy Style generation"
  - "generation-form.tsx: prompt-arrow routes through regenerateAction with full references[]"
  - "spec-preview-panel.tsx: hideGenerateCta helper points at the prompt-arrow, not a phantom button"
affects:
  - "public.projects rows produced by the Copy Style flow now carry non-null style_spec + reference_assets"
  - "REMIX-04 fork-inheritance has the columns it expects on freshly-generated Copy Style projects"
tech-stack:
  added: []
  patterns:
    - "Conditional UPDATE payload — write reference_assets only when caller forwards a non-empty array"
    - "Belt-and-braces predicate hardening — useReferenceSpec gates on (spec + status==='preview' + references.length > 0)"
key-files:
  created:
    - src/components/slides/__tests__/generation-form-routing.test.tsx
  modified:
    - src/lib/services/carousel.ts
    - src/lib/services/__tests__/carousel-from-references.test.ts
    - src/components/slides/generation-form.tsx
    - src/components/style-from-reference/spec-preview-panel.tsx
    - src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx
    - src/app/(dashboard)/style-from-reference/actions.ts
decisions:
  - "useReferenceSpec predicate now requires references.length > 0 (belt-and-braces against the DB-evidence routing leak)"
  - "style_spec written unconditionally in the Copy Style branch (function is only reachable with a non-null spec); reference_assets written only when forwarded (preserves legacy/sibling-create callers that compose refs separately)"
  - "Replacement copy: 'Style ready. Send your prompt above to apply it.' — points at the actual entry point (the prompt-arrow above the textarea) instead of inventing a button below"
metrics:
  duration_seconds: 417
  completed: "2026-05-15"
  tasks_completed: 2
  files_created: 1
  files_modified: 6
  commits: 4
  new_tests: 4
---

# quick-260515-dwu: Wire prompt-arrow to use extracted Copy Style

Diego's bug report pinpointed two coupled defects in the Copy Style path: generated projects landed with `style_spec=NULL` and `reference_assets=NULL` despite a successful extraction, and the helper copy in the inline-collapsible Spec Preview pointed users at a "Generate Carousel below" button that doesn't exist in that layout. Both shipped in this plan as one cohesive fix.

## What changed

### Persistence — `src/lib/services/carousel.ts`

`generateCarouselFromReferences` UPDATE payload now writes `style_spec` (always — the Copy Style branch only fires with a non-null spec) and `reference_assets` (when the caller forwards a non-empty `references` array). `CarouselFromReferencesInput` gained an optional `references: ReferenceAssetRow[]` field; existing callers without references (sibling-create / REMIX-05) are unaffected.

### Routing — `src/components/slides/generation-form.tsx` + `src/app/(dashboard)/style-from-reference/actions.ts`

`handleSubmit` now forwards `inlineSpec.references` to `regenerateAction`, which spreads it through to `generateCarouselFromReferences`. The `useReferenceSpec` predicate gained a third clause — `inlineSpec.references.length > 0` — so a Copy Style extraction state with an empty references array (the DB-evidence anomaly) falls back to the topic flow instead of generating with no references to persist.

`RegenerateActionInput` interface added optional `references: ReferenceAssetRow[]`. The action body already spreads `input` into `generateCarouselFromReferences`, so the field flows through with no further wiring.

### Copy — `src/components/style-from-reference/spec-preview-panel.tsx`

`hideGenerateCta` helper line changed from "Style ready. Use Generate Carousel below to render." (phantom button — there is no button below in inline-collapsible mode) to "Style ready. Send your prompt above to apply it." (the prompt-arrow above the textarea IS the entry point).

## DB row shape after a Copy Style generation

| Column | Before fix | After fix |
| ------ | ---------- | --------- |
| `slide_data` | populated | populated |
| `generation_status` | `'complete'` | `'complete'` |
| `title` | populated | populated |
| `style_spec` | **NULL** | **populated** (the spec used for the emit) |
| `reference_assets` | **NULL** | **populated** (the `ReferenceAssetRow[]` from the reducer) |
| `template_id` | `'bold-minimal'` (default) | `'bold-minimal'` (default — unchanged; Copy Style is spec-driven, the template column is residual) |

## Test count delta

| File | New tests |
| ---- | --------- |
| `src/lib/services/__tests__/carousel-from-references.test.ts` | +3 (Tests 6, 7, 8) |
| `src/components/slides/__tests__/generation-form-routing.test.tsx` | +3 (Tests 1, 2, 3 — new file) |
| `src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx` | +1 (Test 8) |
| **Total** | **+7** |

Plan called for +4 — count came in higher because the routing test file naturally needed three cases (Copy Style branch, topic fallback, empty-references fallback) and the carousel-persistence test needed three cases (write happens, omits when absent, auto-publish invariant) to fully pin the contract.

## Commits

| Commit | Type | Subject |
| ------ | ---- | ------- |
| `07be2ef` | test | RED: failing tests for style_spec + reference_assets persistence |
| `53b78bf` | feat | GREEN: persist style_spec + reference_assets on Copy Style generation |
| `8cb7cf4` | test | RED: failing tests for prompt-arrow routing + panel copy |
| `66fe5b9` | feat | GREEN: wire prompt-arrow to extracted Copy Style + fix misleading panel copy |

## Invariants preserved

- **Public-by-default** — `autoPublishOnGenerate` call count in `carousel.ts` unchanged (3 occurrences: 1 import + 1 call in `generateCarousel` + 1 call in `generateCarouselFromReferences`). Test 8 of the carousel-from-references suite asserts exactly one call per Copy Style generation.
- **PREVIEW-01 source-grep firewall** — `style-from-reference-shell.test.tsx` Test 5 (Generate CTA must live inside SpecPreviewPanel's `status==='preview'` guard) still passes — we did NOT hoist the inner Generate CTA.
- **LEGAL-03 forward-compat** — zero forbidden tokens (`exactly like`, `clone`, `copy this style`, `duplicate`) introduced; Test 7 of the spec-preview-panel integration suite remains green.
- **`separateOverlappingTextBoxes`** — untouched per plan constraints; the recently-shipped quick-260515-8xx wiring is not affected by this plan.
- **Closed-enum + LEGAL-03 grep on changed source files** — `magazine-bold|reference_artist|reference_brand|copy_exactly|style_freetext` count = 0 across `generation-form.tsx`, `carousel.ts`, `actions.ts`.

## Verification commands run

```bash
# All 33 plan-touched + adjacent regression tests pass
npx vitest run \
  src/lib/services/__tests__/carousel-from-references.test.ts \
  src/components/slides/__tests__/generation-form-routing.test.tsx \
  src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx \
  src/components/style-from-reference/__tests__/style-from-reference-shell.test.tsx \
  src/components/style-from-reference/__tests__/recovery-integration.test.tsx
# → 5 files, 33 tests, all green

# Lint on plan-modified files: 0 new errors
npx eslint \
  src/lib/services/carousel.ts \
  src/lib/services/__tests__/carousel-from-references.test.ts \
  src/components/slides/generation-form.tsx \
  src/components/slides/__tests__/generation-form-routing.test.tsx \
  src/components/style-from-reference/spec-preview-panel.tsx \
  src/components/style-from-reference/__tests__/spec-preview-panel-integration.test.tsx \
  'src/app/(dashboard)/style-from-reference/actions.ts'
# → 2 warnings (both pre-existing unused imports; out of scope)

# Project-wide lint
npm run lint
# → 4 errors, all pre-existing in scripts/grep-gates/prompt-token-budget.cjs (untouched by this plan)
```

## Deviations from Plan

None — plan executed exactly as written. Two minor structural notes (not deviations):

- `src/lib/services/__tests__/carousel-from-references.test.ts` already existed (from Phase 77 Plan 02 Task 4); the plan-listed tests were ADDED rather than the file CREATED. This matches the plan's intent (the plan lists this file under `files_modified` in the task `<files>` block and Test numbering 6/7/8 continues from the existing five-test suite).
- The routing test had to disambiguate two buttons matching `/Generate carousel/i` (the prompt-arrow with `aria-label="Generate carousel"` AND the lower submit button whose accessible name comes from its `Generate Carousel` text content). Used `screen.getByLabelText('Generate carousel')` — only the arrow has an `aria-label`, the lower button has none. Same DOM tree, simpler selector.

## Follow-ups (out of scope)

- Deprecated `template_id_override: 'magazine-bold'` emitted by the AI in some Copy Style runs — separate medium-severity bug. The `template_id` column staying as `'bold-minimal'` (default) is intentional in the Copy Style flow: the spec drives rendering, not the template.
- `scripts/grep-gates/prompt-token-budget.cjs` has 4 pre-existing `@typescript-eslint/no-require-imports` errors. Untouched by this plan; would be a chore-typed fix in a follow-up.

## Known Stubs

None introduced by this plan. The pre-fix "Generate Carousel below" copy could have been classified as a placeholder; it is now removed and replaced with accurate, working copy.

## Self-Check: PASSED

- All 4 commit hashes (`07be2ef`, `53b78bf`, `8cb7cf4`, `66fe5b9`) verified in `git log`.
- All 6 modified source files + 1 new test file verified present on disk.
- All 33 vitest assertions across the plan + adjacent regression suites pass.
- Source-grep invariants (PREVIEW-01, LEGAL-03, closed-enum, public-by-default, "Generate Carousel below" removed) all confirmed via `grep`.

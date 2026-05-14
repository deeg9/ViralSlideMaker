---
phase: 80-composition-aware-style-extraction-replace-flat-stylespec-ta
plan: 01
subsystem: schema
tags: [v2.13, phase-80, schema, archetypes, closed-enum, type-contract]
requires:
  - "Phase 74 closed-enum StyleSpec contract (src/lib/types/style-spec.ts)"
  - "PARITY-05 grep gate (scripts/grep-gates/closed-enum-styleSpec.sh)"
provides:
  - "src/lib/types/style-spec-archetypes.ts (SLIDE_ARCHETYPES + ArchetypeSlots + DEFAULT_FALLBACK_ARCHETYPE)"
  - "STYLE_SPEC_VERSION = 2 contract for downstream validators/extractors/projectors"
affects:
  - "src/lib/validators/style-spec.ts (Plan 02 — Zod discriminated union + v1 rejection)"
  - "src/lib/ai/extract-style-spec.ts (Plan 03 — Gemini responseSchema + archetype prompt)"
  - "src/lib/ai/style-spec-projector.ts (Plan 04 — template_id_override emission)"
  - "src/lib/ai/generate-from-style-spec.ts (Plan 05 — archetype-aware generation prompt)"
  - "supabase/migrations/ (Plan 06 — schema_version != 2 cache purge)"
tech-stack:
  added: []
  patterns:
    - "TypeScript discriminated union with type-level discriminator key matching the parent type's field"
    - "Closed-enum readonly tuples (`as const`) as single source of truth, derived type aliases via `typeof tuple[number]`"
key-files:
  created:
    - "src/lib/types/style-spec-archetypes.ts"
  modified:
    - "src/lib/types/style-spec.ts"
    - "src/lib/types/__tests__/style-spec.test.ts"
decisions:
  - "Archetype discriminator field is `slideArchetype` (not `archetype`) so the discriminated union composes with the top-level StyleSpec field — Zod's `z.discriminatedUnion('slideArchetype', ...)` keys cleanly in Plan 02."
  - "`StyleSpec` changed from `interface` to `type` (intersected with `ArchetypeSlots`); TypeScript `interface` cannot extend a discriminated union. Wire-compatible — all `import type { StyleSpec }` usage continues to work."
  - "`DEFAULT_FALLBACK_ARCHETYPE = 'full-bleed-text-overlay'` exported from the archetypes module so Plan 02 validator + Plan 04 projector share the same fallback constant."
  - "`CAPTION_HEIGHT_FRACTIONS` is a numeric tuple (`[0.3, 0.4, 0.5]`) rather than strings — downstream renderer math operates directly on the literal. Open numeric ranges explicitly rejected per 80-CONTEXT.md §Slot Param Value Spaces."
metrics:
  duration_minutes: 3
  completed: "2026-05-14"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  commits: 2
---

# Phase 80 Plan 01: Schema Foundation — Archetypes Module + StyleSpec v2 Summary

One-liner: New `style-spec-archetypes` module lands the closed 8-value `SLIDE_ARCHETYPES` enum + per-archetype slot-param types as a TypeScript discriminated union; `StyleSpec` intersects with `ArchetypeSlots` and `STYLE_SPEC_VERSION` bumps 1 → 2.

## What Was Built

### (a) The 8 archetypes + slot-param value spaces locked

The canonical archetype taxonomy is locked into `src/lib/types/style-spec-archetypes.ts` as the `SLIDE_ARCHETYPES` readonly tuple, in this exact order (matching 80-CONTEXT.md decisions):

1. `full-bleed-text-overlay`
2. `caption-bar-bottom`
3. `caption-bar-top`
4. `photo-collage-2up`
5. `photo-collage-grid`
6. `flat-color-background`
7. `editorial-serif`
8. `notes-sticker`

Slot-param closed-enum tuples (single source of truth for downstream Zod + extraction):

- `CAPTION_HEIGHT_FRACTIONS = [0.3, 0.4, 0.5] as const` — three caption-bar sizes covering observed reference variance.
- `CAPTION_BACKGROUNDS = ['solid', 'gradient-dark', 'translucent'] as const` — magazine-bold solid cards, documentary gradient overlays, translucent variants.
- `SPLIT_DIRECTIONS = ['horizontal', 'vertical'] as const`.
- `SPLIT_RATIOS = ['50-50', '60-40', '70-30'] as const` — readable string literals, not numeric tuples.

Per-archetype slot-param shapes:

- `CaptionBarSlots` — used by BOTH `caption-bar-bottom` AND `caption-bar-top` (`{ caption: { heightFraction?, background? } }`).
- `PhotoCollage2upSlots` — used by `photo-collage-2up` (`{ split: { direction?, ratio? } }`).
- `EmptySlots` — placeholder for archetypes with no v1 slot params (`full-bleed-text-overlay`, `photo-collage-grid`, `flat-color-background`, `editorial-serif`, `notes-sticker`).

`ArchetypeSlots` discriminated union members carry their slot block via intersection — when a downstream consumer narrows on `spec.slideArchetype === 'caption-bar-bottom'`, TypeScript grants typed access to `spec.caption.heightFraction` and `spec.caption.background`.

`DEFAULT_FALLBACK_ARCHETYPE: SlideArchetype = 'full-bleed-text-overlay'` exported as the shared fallback constant.

### (b) STYLE_SPEC_VERSION bump 1 → 2

- `export type StyleSpecVersion = 2` (was `1`).
- `export const STYLE_SPEC_VERSION: StyleSpecVersion = 2` (was `1`).
- Header comment block re-cites Phase 80, downstream consumers, PARITY-05 invariant.
- `StyleSpec` declaration changed from `interface` to `type` and intersected with `ArchetypeSlots` (TypeScript `interface` cannot extend a discriminated union).
- Test fixture (`style-spec.test.ts`) updated: `schema_version: 2`, `slideArchetype: 'full-bleed-text-overlay'` added, T1 assertions updated, compile-time `StyleSpecVersion` literal check now asserts `2`. All 10 tests pass.

### (c) Downstream consumers blocked-on-this unblocked

| Plan      | Module                                      | What it consumes from this plan                                                                                                                          |
| --------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plan 02   | `src/lib/validators/style-spec.ts`          | `SLIDE_ARCHETYPES` (Zod enum), `ArchetypeSlots` (z.discriminatedUnion key), `DEFAULT_FALLBACK_ARCHETYPE` (fallback emit), `STYLE_SPEC_VERSION = 2` (v1 reject) |
| Plan 03   | `src/lib/ai/extract-style-spec.ts`          | `SLIDE_ARCHETYPES` tuple (Gemini system-prompt taxonomy), updated StyleSpec shape                                                                        |
| Plan 04   | `src/lib/ai/style-spec-projector.ts`        | `SlideArchetype` (ARCHETYPE_TO_TEMPLATE keys), `DEFAULT_FALLBACK_ARCHETYPE` (fallback path)                                                               |
| Plan 05   | `src/lib/ai/generate-from-style-spec.ts`    | StyleSpec.slideArchetype + slot blocks for prompt context                                                                                                  |
| Plan 06   | `supabase/migrations/`                      | `STYLE_SPEC_VERSION = 2` literal for the purge predicate                                                                                                  |

All five downstream plans are now unblocked at the type/contract level.

## Deviations from Plan

None of substance — plan executed exactly as written.

One small architectural clarification adopted (consistent with the plan's letter):

- `slideArchetype` discriminator on `ArchetypeSlots` was added as `(typeof CAPTION_HEIGHT_FRACTIONS)[number]` style indexed access throughout, rather than re-stating each literal. This is purely the standard derived-type idiom recommended in the plan body (`SlideArchetype = typeof SLIDE_ARCHETYPES[number]`); it kept the slot-param interfaces tightly coupled to their constants tuples as the single source of truth.

No deviations triggered the auto-fix rules (Rules 1–3); no architectural decision (Rule 4) required.

## Authentication Gates

None.

## TypeScript Downstream Cascade (Expected)

Per the plan's `<acceptance_criteria>` ("the validator + extractor + projector will not compile until those plans land — that is expected at Wave-1 boundary"), the schema bump produces ~18 downstream TypeScript errors in modules that still emit `schema_version: 1` fixtures or call sites missing the new `slideArchetype` discriminator:

- `src/lib/validators/style-spec.ts` + tests (Plan 02 fixes)
- `src/lib/ai/extract-style-spec.ts` + tests (Plan 03 fixes)
- `src/lib/ai/style-spec-projector.ts` + tests (Plan 04 fixes)
- `src/lib/ai/generate-from-style-spec.ts` + tests (Plan 05 fixes)
- `src/lib/ai/style-spec-aspect-filter.ts` + tests
- `src/lib/ai/style-spec-brand-kit-merge.ts` + tests
- `src/lib/services/__tests__/carousel-from-references.test.ts`
- `src/lib/services/__tests__/publish-style-spec-snapshot.test.ts`
- `src/lib/render/__tests__/parity.style-spec-roundtrip.test.tsx`
- `src/components/style-from-reference/__tests__/*` (state machine, recovery integration, spec preview panel, shell)
- `src/components/projects/__tests__/project-card-from-references-badge.test.tsx`
- `src/app/(dashboard)/style-from-reference/__tests__/{actions,regenerate-action}.test.ts`
- `scripts/grep-gates/prompt-token-budget-helper.ts`
- `src/lib/types/__tests__/slide-zero-new-fields.test.ts`
- `src/lib/validators/__tests__/silent-drop-counter.test.ts`

All errors are of the form `Type '1' is not assignable to type '2'` (schema_version literal) or `Property 'slideArchetype' is missing` (discriminator). These resolve as Plans 02–06 update each consumer in turn. Pre-existing test errors unrelated to this change (e.g. `Mock<Procedure | Constructable>` issues in `__tests__/auth/*`) were not touched per Rule scope-boundary.

## Verification Summary

| Check                                                                                | Result |
| ------------------------------------------------------------------------------------ | ------ |
| `grep -c "STYLE_SPEC_VERSION: StyleSpecVersion = 2" src/lib/types/style-spec.ts`     | `1` ✓ |
| `bash scripts/grep-gates/closed-enum-styleSpec.sh` (PARITY-05)                       | PASS ✓ |
| 8 archetype string literals in `style-spec-archetypes.ts`                             | `19` (tuple + discriminated-union members) ✓ |
| `DEFAULT_FALLBACK_ARCHETYPE` exported                                                | ✓ |
| `npx vitest run src/lib/types/__tests__/style-spec.test.ts`                          | 10/10 PASS ✓ |
| `grep -c "ArchetypeSlots" src/lib/types/style-spec.ts`                               | `5` (import + intersection + comment refs) ✓ |
| `grep -c "from '@/lib/types/style-spec-archetypes'" src/lib/types/style-spec.ts`     | `1` ✓ |
| `grep -E "reference_artist\|reference_brand\|copy_exactly\|style_freetext"` (non-comment)  | `0` ✓ |

## Commits

| Hash      | Message                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------ |
| `cc20358` | feat(80-01): add canonical archetypes module with 8-value enum + discriminated-union slot types  |
| `07f7c13` | feat(80-01): extend StyleSpec with slideArchetype + ArchetypeSlots; bump STYLE_SPEC_VERSION 1→2  |

## Self-Check: PASSED

- `src/lib/types/style-spec-archetypes.ts`: FOUND
- `src/lib/types/style-spec.ts`: FOUND (modified)
- `src/lib/types/__tests__/style-spec.test.ts`: FOUND (modified)
- Commit `cc20358`: FOUND in `git log`
- Commit `07f7c13`: FOUND in `git log`

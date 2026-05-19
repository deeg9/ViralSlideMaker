---
phase: 84-layoutrecipe-model-extraction
status: clean
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/types/layout-recipe.ts
  - src/lib/validators/layout-recipe.ts
  - src/lib/validators/silent-drop-counter.ts
  - src/lib/ai/layout-recipe-extract.ts
reviewed_at: 2026-05-18
findings_count: 0
---

# Phase 84: LayoutRecipe Model + Extraction — Code Review

**Status:** clean — no blocking or warning findings.

## Scope

4 source files changed (1663 insertions incl. tests). Reviewed the 4
non-test source modules for bugs, security issues, purity violations, and
faithfulness to the 84-CONTEXT.md decisions.

## Checks performed

- **Purity / determinism** (`layout-recipe-extract.ts`): no `Date.now`,
  `Math.random`, `console.*`, no AI SDK / Supabase / React / `fetch`
  imports. The only matches for those tokens are inside the contract
  header comment. Extraction is a synchronous pure function — confirmed by
  a unit test asserting the return value is not a Promise. PASS.
- **No AI call:** `grep` for `@google` / `GoogleGenerativeAI` /
  `generateContent` returns nothing — the locked cost constraint (no new
  Gemini tier) is honored. PASS.
- **Closed-enum invariant:** every recipe enum is an `as const` tuple
  defined once in `layout-recipe.ts`; `layout_mode` reuses the existing
  8-value `SlideArchetype` enum (no new archetype set). `npm run lint:gates`
  (PARITY-05 closed-enum grep gate) passes green. PASS.
- **Validator firewall:** `parseLayoutRecipeSafe` mirrors
  `parseStyleSpecSafe` — pre-clean walker strips unknown keys (emits
  `unknown_field`), silent-drops bad closed-enum values, clamps numeric
  geometry to validated ranges (emits the new `range_clamp` reason). Every
  `z.object(...)` is terminated with `.catchall(z.never())`. PASS.
- **Skip-emit / never-error:** a role with zero matching slides is omitted
  from `recipe.roles`; an empty slide array yields an empty-roles recipe;
  extraction never throws. Verified by unit tests. PASS.
- **eslint:** clean on all 4 changed source files. PASS.
- **tsc:** zero type errors introduced in any Phase 84 file (the 20
  pre-existing `tsc` errors are all in unrelated auth/stripe/legal test
  files — the pre-existing baseline).

## Notes (non-blocking)

- **Validator construct — minor wording deviation, no fix needed.**
  84-CONTEXT.md describes the validator as "a zod `discriminatedUnion`".
  The implementation uses `z.enum(SLIDE_ARCHETYPES)` for the `layout_mode`
  field rather than a `z.discriminatedUnion`. This is the architecturally
  correct choice: the StyleSpec validator needs a discriminated union
  because each archetype carries a *different* slot block (`caption` /
  `split` / `EmptySlots`) and the discriminator selects which slot shape
  is valid. `RoleLayout` is deliberately uniform — every role has the same
  optional `caption_card` / `hook` / `accessory_label` fields regardless of
  `layout_mode`. A `discriminatedUnion` here would produce 8 byte-identical
  branches with no narrowing benefit. The CONTEXT requirements that the
  wording was protecting — closed-enum silent-drop + numeric range
  clamping — are both fully met. No remediation required.
</content>

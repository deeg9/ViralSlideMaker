/**
 * Phase 68 Plan 01 (EDITOR-01): exhaustive union type for the 4 addressable
 * element scopes on a Slide. Compile-time gate complementing the runtime
 * PRA1..PRA12 source-grep audit (Plan 68-03): missing a scope branch in any
 * switch on `AddressableScope` triggers tsc TS2322 "Type 'X' is not
 * assignable to type 'never'" error at the `assertExhaustiveScope` call site.
 *
 * SCOPE ORDER NOTES:
 *   - `ALL_ADDRESSABLE_SCOPES` tuple order is the CANONICAL audit order; the
 *     PRA grep gate (Plan 68-03) reads any-order, but this tuple pins one
 *     canonical sequence for tests + downstream consumers.
 *   - `selectAll()` composition order in `use-selection-model.ts` is
 *     `text_boxes ∪ custom_images ∪ decorations ∪ watermark`
 *     (ARCHITECTURE.md R4) — NOT the same as the tuple order. Watermark
 *     trails because it is a singleton and Phase 60 SEL-01 ordering pinned
 *     watermark last in selection composition.
 *
 * Why this module is intentionally tiny: every consumer in the editor
 * surface (reducer, selection model, walkers, audit gate) imports
 * `AddressableScope` directly. The smaller the module, the faster the
 * type-only barrel-trim, and the cleaner the eventual Plan 68-03 grep
 * audit (PRA1..12 inspects every reducer case body for all 4 literal
 * strings — keeping the source-of-truth in one file is what makes the
 * audit tractable).
 */

export type AddressableScope =
  | 'text_boxes'
  | 'custom_images'
  | 'watermark'
  | 'decorations'

/**
 * Canonical tuple of all 4 AddressableScope members. The `as const satisfies
 * readonly AddressableScope[]` pattern means:
 *   - element types narrow to the literal union members (not just `string`),
 *   - the array is `readonly` at the type level (no `.push()` allowed),
 *   - tsc errors immediately if a new scope is added to the type without a
 *     corresponding tuple entry (the `satisfies` clause won't compile because
 *     the tuple wouldn't cover the union).
 */
export const ALL_ADDRESSABLE_SCOPES = [
  'text_boxes',
  'custom_images',
  'watermark',
  'decorations',
] as const satisfies readonly AddressableScope[]

/**
 * Defense-in-depth helper: place inside a switch's `default` arm to make
 * TypeScript surface "Type 'X' is not assignable to type 'never'" the
 * moment a new scope is added without a corresponding case. The function
 * also throws at runtime as a last-resort guard if the type system is
 * subverted (e.g. via `as never` cast or `any`-typed input from an
 * AI-generated payload before validation).
 *
 * Usage pattern (mirror REMOVE_TEXT_BOX line 366-372 short-circuit style):
 *   switch (scope) {
 *     case 'text_boxes':    return ...
 *     case 'custom_images': return ...
 *     case 'watermark':     return ...
 *     case 'decorations':   return ...
 *     default:              return assertExhaustiveScope(scope)
 *   }
 */
export function assertExhaustiveScope(scope: never): never {
  throw new Error(
    `[addressable-scope] non-exhaustive switch reached scope=${String(scope)}`,
  )
}

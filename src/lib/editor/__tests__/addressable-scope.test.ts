import { describe, test, expect } from 'vitest'
import {
  ALL_ADDRESSABLE_SCOPES,
  assertExhaustiveScope,
  type AddressableScope,
} from '../addressable-scope'

// Phase 68 Plan 01 (EDITOR-01): AddressableScope exhaustive type tests.
//
// These tests pin:
//   - The 4-member union (text_boxes / custom_images / watermark / decorations).
//   - The canonical tuple ordering (used by PRA1..12 grep audit in Plan 68-03).
//   - The runtime defense via assertExhaustiveScope().
//   - The compile-time gate: a switch missing a scope branch fails tsc with
//     "Type 'X' is not assignable to type 'never'" (TS2322).
//
// The compile-time gate works in conjunction with the runtime PRA grep gate
// (Plan 68-03) — double protection against missing-scope drift across the 13
// reducer cases that touch addressable elements.

describe('Phase 68 Plan 01 (EDITOR-01): AddressableScope exhaustive type', () => {
  test('Test 1: ALL_ADDRESSABLE_SCOPES has length 4 with the canonical members', () => {
    expect(ALL_ADDRESSABLE_SCOPES.length).toBe(4)
    expect(ALL_ADDRESSABLE_SCOPES).toEqual([
      'text_boxes',
      'custom_images',
      'watermark',
      'decorations',
    ])
  })

  test('Test 2: assigning the literal "text_boxes" to AddressableScope compiles; "foo" fails tsc', () => {
    // POSITIVE: literals matching the union compile.
    const scope: AddressableScope = 'text_boxes'
    expect(scope).toBe('text_boxes')

    // NEGATIVE: a string outside the union must fail compile. The
    // `// @ts-expect-error` directive itself fails compilation if the next
    // line WOULD HAVE compiled — so the absence of a build-time error here
    // is what proves the compile-time gate works.
    // @ts-expect-error - 'foo' is not assignable to AddressableScope
    const bad: AddressableScope = 'foo'
    expect(bad).toBe('foo')
  })

  test('Test 3: assertExhaustiveScope throws at runtime (defensive — never reached in well-typed code)', () => {
    // The function's parameter type is `never`, so we cast to exercise the
    // runtime defense. The thrown message includes the offending value.
    expect(() =>
      assertExhaustiveScope('not-a-real-scope' as never),
    ).toThrow(/non-exhaustive switch/)
    expect(() =>
      assertExhaustiveScope('not-a-real-scope' as never),
    ).toThrow(/not-a-real-scope/)
  })

  test('Test 4: a switch on AddressableScope handling all 4 cases compiles cleanly', () => {
    // This function exercises a full-coverage switch. If any case is missing,
    // the assertExhaustiveScope(scope) call below would fail tsc — but with
    // all 4 cases handled, the default arm is unreachable.
    function describeScope(scope: AddressableScope): string {
      switch (scope) {
        case 'text_boxes':
          return 'tb'
        case 'custom_images':
          return 'ci'
        case 'watermark':
          return 'w'
        case 'decorations':
          return 'd'
        default:
          return assertExhaustiveScope(scope)
      }
    }
    expect(describeScope('text_boxes')).toBe('tb')
    expect(describeScope('custom_images')).toBe('ci')
    expect(describeScope('watermark')).toBe('w')
    expect(describeScope('decorations')).toBe('d')
  })

  test('Test 5: a switch missing the "decorations" case fails the compile-time gate (negative test)', () => {
    // We construct a deliberately-broken switch that omits 'decorations'.
    // The `// @ts-expect-error` on the assertExhaustiveScope call proves the
    // compile-time gate is active: tsc surfaces "Argument of type
    // 'decorations' is not assignable to parameter of type 'never'" because
    // the un-handled case keeps `scope` narrowed to 'decorations'.
    function brokenSwitch(scope: AddressableScope): string {
      switch (scope) {
        case 'text_boxes':
          return 'tb'
        case 'custom_images':
          return 'ci'
        case 'watermark':
          return 'w'
        // 'decorations' DELIBERATELY MISSING
        default:
          // @ts-expect-error - 'decorations' is not assignable to type 'never'
          return assertExhaustiveScope(scope)
      }
    }
    // Runtime: feeding 'decorations' falls through to the throw.
    expect(() => brokenSwitch('decorations')).toThrow(/non-exhaustive/)
  })

  test('Test 6: ALL_ADDRESSABLE_SCOPES is a frozen-at-type-level readonly tuple', () => {
    // The `as const satisfies readonly AddressableScope[]` pattern means the
    // array element types are the literal union members, not just `string`.
    // We assert this via a value-level round-trip: assigning every element
    // back into AddressableScope must succeed without a cast.
    for (const scope of ALL_ADDRESSABLE_SCOPES) {
      const roundTrip: AddressableScope = scope
      expect(roundTrip).toBe(scope)
    }
    // And the array is a real tuple at runtime (not Object.frozen — but
    // immutable in TypeScript via `readonly`).
    expect(Array.isArray(ALL_ADDRESSABLE_SCOPES)).toBe(true)
  })

  test('Test 7: SCOPE_ORDER notes — tuple is canonical AUDIT order, NOT selection order', () => {
    // The tuple is the order PRA1..12 grep gate reads (any-order; tuple just
    // pins one canonical sequence for tests). Selection-composition order in
    // useSelectionModel.selectAll is text_boxes ∪ custom_images ∪ decorations
    // ∪ watermark (ARCHITECTURE.md R4) — DIFFERENT from this tuple. This test
    // pins the tuple to its expected sequence so future drift is caught.
    expect(ALL_ADDRESSABLE_SCOPES[0]).toBe('text_boxes')
    expect(ALL_ADDRESSABLE_SCOPES[1]).toBe('custom_images')
    expect(ALL_ADDRESSABLE_SCOPES[2]).toBe('watermark')
    expect(ALL_ADDRESSABLE_SCOPES[3]).toBe('decorations')
  })

  test('Test 8: every member of ALL_ADDRESSABLE_SCOPES is a valid AddressableScope', () => {
    // This is the type-level "no rogue strings" check — combined with Test 1's
    // length===4 + Test 2's literal-assignability check, we have full coverage
    // that the tuple and the type are in lock-step.
    const set = new Set<AddressableScope>(ALL_ADDRESSABLE_SCOPES)
    expect(set.has('text_boxes')).toBe(true)
    expect(set.has('custom_images')).toBe(true)
    expect(set.has('watermark')).toBe(true)
    expect(set.has('decorations')).toBe(true)
    expect(set.size).toBe(4)
  })
})

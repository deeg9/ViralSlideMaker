---
phase: 68
plan: 01
subsystem: editor
tags: [decorations, reducer, selection, addressable-scope, exhaustive-type, editor-01, editor-03, editor-14]
requires:
  - Phase 67 Decoration types + slide.decorations slot
provides:
  - AddressableScope exhaustive type + ALL_ADDRESSABLE_SCOPES tuple + assertExhaustiveScope helper
  - 3 NEW reducer actions: ADD_DECORATION / UPDATE_DECORATION / REMOVE_DECORATION
  - useSelectionModel walks 4 AddressableScopes (selectAll + stale-id prune + enterGroup)
affects:
  - src/lib/editor/editor-reducer.ts
  - src/lib/editor/editor-actions.ts
  - src/lib/editor/use-selection-model.ts
tech-stack:
  added:
    - src/lib/editor/addressable-scope.ts (NEW module)
  patterns:
    - compile-time exhaustive `never` gate on AddressableScope switches
    - lock-honor short-circuit (mirror REMOVE_TEXT_BOX / REMOVE_CUSTOM_IMAGE pattern)
    - cross-scope isolation (text_boxes / custom_images / watermark refs ref-equal pre/post decoration mutations)
key-files:
  created:
    - src/lib/editor/addressable-scope.ts
    - src/lib/editor/__tests__/addressable-scope.test.ts
  modified:
    - src/lib/editor/editor-reducer.ts (added scopeIdSet helper + 3 new cases)
    - src/lib/editor/editor-actions.ts (extended EditorAction union with 3 actions)
    - src/lib/editor/__tests__/editor-reducer.test.ts (+21 tests under "Phase 68 Plan 01" describe)
    - src/lib/editor/use-selection-model.ts (selectAll + validIds + validGroupIds + enterGroup all walk decorations)
    - src/lib/editor/__tests__/use-selection-model.test.ts (+11 tests under "Phase 68 Plan 01: decoration scope extension" describe)
decisions:
  - AddressableScope module path: `src/lib/editor/addressable-scope.ts` (separate file, not inlined)
  - Tuple order in ALL_ADDRESSABLE_SCOPES: text_boxes → custom_images → watermark → decorations (canonical AUDIT order; differs from selection composition order on purpose)
  - selectAll composition order: text_boxes ∪ custom_images ∪ decorations ∪ watermark (ARCHITECTURE.md R4 pin — watermark trails)
  - Lock gate guards CONTENT updates only — UPDATE_DECORATION on a locked decoration short-circuits even when the payload would clear the lock; toggling locked is SET_LOCKED's job (Plan 68-02)
  - Decoration ids: caller generates via crypto.randomUUID() before dispatch; reducer trusts the id and does NOT regenerate (mirror ADD_CUSTOM_IMAGE / ADD_TEXT_BOX defaults.id pattern)
  - REMOVE_DECORATION on the last element leaves `slide.decorations === []` (realized-but-empty); Phase 67 PTF16 idempotent-absence pertains only to `decorations === undefined`
metrics:
  duration: 7m
  completed: 2026-05-03
---

# Phase 68 Plan 01: Reducer Extensions Foundation Summary

**One-liner:** AddressableScope exhaustive `never` gate + 3 NEW decoration reducer actions (ADD/UPDATE/REMOVE) + 4-scope walks in `useSelectionModel` (selectAll, stale-id prune, enterGroup), pinning the EDITOR-14 click-to-select id-only contract for decoration ids.

## Tasks Completed

| Task | Name                                                                | Commit  |
| ---- | ------------------------------------------------------------------- | ------- |
| 1    | AddressableScope exhaustive type + 8 unit tests                     | 6a8ec04 |
| 2    | ADD/UPDATE/REMOVE_DECORATION reducer actions + 21 reducer tests     | 2b3772a |
| 3    | Selection model 4-scope walks (selectAll + prune + enterGroup) + 11 | 8ad2988 |

## Test Count Delta

| File                                          | Before | After | Delta |
| --------------------------------------------- | ------ | ----- | ----- |
| `__tests__/addressable-scope.test.ts` (NEW)   | 0      | 8     | +8    |
| `__tests__/editor-reducer.test.ts`            | 97     | 118   | +21   |
| `__tests__/use-selection-model.test.ts`       | 29     | 40    | +11   |
| **Total new tests this plan**                 |        |       | **+40** |

Full editor-suite (`src/lib/editor/`): **384 tests GREEN** across 19 files. Zero regressions.

## AddressableScope Module Contract

```ts
// src/lib/editor/addressable-scope.ts
export type AddressableScope =
  | 'text_boxes'
  | 'custom_images'
  | 'watermark'
  | 'decorations'

export const ALL_ADDRESSABLE_SCOPES = [
  'text_boxes',
  'custom_images',
  'watermark',
  'decorations',
] as const satisfies readonly AddressableScope[]

export function assertExhaustiveScope(scope: never): never { /* throws */ }
```

**Tuple ordering note (critical):** the tuple is the **canonical AUDIT order** — what PRA1..12 grep gate (Plan 68-03) reads any-order against reducer case bodies. The **selection composition order** in `useSelectionModel.selectAll` is DIFFERENT (text_boxes → custom_images → decorations → watermark) because watermark trails as a singleton per Phase 60 SEL-01. JSDoc on the module pins both contracts so future drift is caught.

**Compile-time gate:** the `assertExhaustiveScope(scope)` call inside the `scopeIdSet` helper in `editor-reducer.ts` is the gate-with-teeth. When Plan 68-02 lands a 5th scope or any future addressable element, tsc surfaces "Argument of type 'X' is not assignable to parameter of type 'never'" at that call site until a new case is added. Test EXH-2 in both `addressable-scope.test.ts` and the reducer test file proves the gate works for missing-case detection via `// @ts-expect-error`.

## 3 NEW Reducer Actions — Case-Body Shapes

### ADD_DECORATION
```ts
case 'ADD_DECORATION': {
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    const next = [...(slide.decorations ?? []), action.decoration]
    return { ...slide, decorations: next }
  })
  return pushHistory(state, slides)
}
```
- Append at END (mirror ADD_CUSTOM_IMAGE precedent)
- Single pushHistory per dispatch
- Caller-supplied id preserved verbatim

### UPDATE_DECORATION
```ts
case 'UPDATE_DECORATION': {
  let mutated = false
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    if (!slide.decorations) return slide
    const idx = slide.decorations.findIndex((d) => d.id === action.id)
    if (idx === -1) return slide
    const existing = slide.decorations[idx]
    if (existing.locked === true) return slide
    const merged = { ...existing, ...action.updates } as typeof existing
    const nextDecorations = slide.decorations.slice()
    nextDecorations[idx] = merged
    mutated = true
    return { ...slide, decorations: nextDecorations }
  })
  if (!mutated) return state
  return pushHistory(state, slides)
}
```
- Lock-content-only contract: `locked === true` short-circuits (mirror REMOVE_TEXT_BOX gate)
- Unknown id / undefined decorations array → silent no-op (state ref-equal)

### REMOVE_DECORATION
```ts
case 'REMOVE_DECORATION': {
  let mutated = false
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    if (!slide.decorations) return slide
    const idx = slide.decorations.findIndex((d) => d.id === action.id)
    if (idx === -1) return slide
    if (slide.decorations[idx].locked === true) return slide
    const nextDecorations = slide.decorations.filter((d) => d.id !== action.id)
    mutated = true
    return { ...slide, decorations: nextDecorations }
  })
  if (!mutated) return state
  return pushHistory(state, slides)
}
```
- Lock-honor short-circuit (mirror REMOVE_CUSTOM_IMAGE gate)
- Last-element removal leaves `slide.decorations === []` (realized-but-empty)

## Selection Model — 4-Scope Walk Sites

| Site                  | Walks decorations? | Notes                                                                           |
| --------------------- | ------------------ | ------------------------------------------------------------------------------- |
| `selectAll`           | Yes (3rd position) | Composition: text_boxes → custom_images → decorations → watermark               |
| `validIds` (prune)    | Yes                | `(slide.decorations ?? []).map((d) => d.id)` joined into the union              |
| `validGroupIds`       | Yes                | new `for (const d of slide.decorations ?? [])` loop adds groupIds to set        |
| `enterGroup`          | Yes (3rd branch)   | Walked between `custom_images.find` and the watermark id-match arm             |
| `replaceWith` etc.    | Transparent        | id-only contract — no scope flag (EDITOR-14 click-to-select pin)                |

Verification gate: `grep -c "slide\.decorations ?? \[\]" src/lib/editor/use-selection-model.ts` → **4** (≥3 required).

## Deviations from Plan

**None — plan executed exactly as written.**

The plan's "Claude's Discretion" notes called out three open choices:
1. AddressableScope module path → chose `src/lib/editor/addressable-scope.ts` (separate file)
2. Decoration id namespacing → chose pure UUID (caller-supplied, mirrors ADD_TEXT_BOX defaults.id pattern)
3. Whether new decoration actions live alongside ADD_TEXT_BOX siblings → chose alongside (alphabetical-by-scope-group case order, same v2.11 audit-friendly pattern)

All three were called out in the plan as acceptable; no surprise architectural moves.

## Verification — Plan-Level Success Criteria

| Criterion | Status |
|-----------|--------|
| `addressable-scope.ts` exports the 4-member union + tuple + helper | PASS |
| Reducer has 3 NEW cases (ADD/UPDATE/REMOVE_DECORATION) | PASS (`grep -c "case 'ADD_DECORATION'\|case 'UPDATE_DECORATION'\|case 'REMOVE_DECORATION'"` → 3) |
| Each case calls pushHistory exactly once on non-no-op paths | PASS (test "pushHistory invariant" in editor-reducer.test.ts) |
| Locked-honor short-circuit on UPDATE/REMOVE | PASS (Test UPD-2, UPD-4, REM-2) |
| selectAll, stale-id prune effect, enterGroup all walk decorations | PASS (4 walk sites) |
| ~38 new tests GREEN | EXCEEDED — 40 new tests (8 + 21 + 11) |
| tsc baseline preserved at 17 errors | PASS |
| No new files outside the 2 listed | PASS — only `addressable-scope.ts` + its test file are new |
| Compile-time gate proven via `@ts-expect-error` | PASS (Test 5 in addressable-scope.test.ts; Test EXH-2 in editor-reducer.test.ts) |

## Plan 68-02 Foundation Confirmation

Plan 68-02 (extended cases + canonical walkers) can extend the 10 existing reducer cases AND can refactor `synthesizeRows` / `getGroupMembers` / `align` / `element-rect-intersect` into the canonical `addressable-element-walkers.ts` module **without re-touching this plan's foundations**:

- AddressableScope type is stable and exhaustively gated.
- The internal `scopeIdSet(scope, slide)` helper inside `editor-reducer.ts` is consumable as-is by the 10 extended cases — it switches on AddressableScope with all 4 cases handled.
- Decoration CRUD baseline is locked in (21 reducer tests + 8 scope tests + 11 selection tests = 40 GREEN regression nets).
- `useSelectionModel` already walks all 4 scopes — Plan 68-02 only needs to extend the 10 reducer cases (BULK_TRANSLATE, BULK_DELETE, ALIGN, DISTRIBUTE, GROUP, UNGROUP, SET_LOCKED, SET_HIDDEN, Z_ORDER, DUPLICATE_ELEMENTS_AT) and the canonical walker module.

## Self-Check: PASSED

**Files exist:**
- `src/lib/editor/addressable-scope.ts` FOUND
- `src/lib/editor/__tests__/addressable-scope.test.ts` FOUND
- `.planning/phases/68-reducer-extensions-selection-model/68-01-SUMMARY.md` FOUND (this file)

**Commits exist:**
- 6a8ec04 (Task 1) FOUND
- 2b3772a (Task 2) FOUND
- 8ad2988 (Task 3) FOUND

**Tests pass (final state):**
- 384 editor tests GREEN (19 files)
- tsc baseline: 17 errors preserved

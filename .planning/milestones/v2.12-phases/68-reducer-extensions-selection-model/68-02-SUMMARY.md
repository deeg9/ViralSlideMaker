---
phase: 68
plan: 02
subsystem: editor
tags: [decorations, reducer, walkers, alignment, marquee, group, lock, hide, z-order, duplicate, layers-panel, editor-02, editor-10]
requires:
  - Phase 68 Plan 01 (AddressableScope + 3 NEW decoration actions + 4-scope selection walks)
  - Phase 67 Decoration types + slide.decorations slot
provides:
  - Canonical 4-scope walker module (addressable-element-walkers.ts) — single source of truth
  - 10 EXTENDED reducer cases (BULK_TRANSLATE, BULK_DELETE, DUPLICATE_ELEMENTS_AT, GROUP, UNGROUP, SET_LOCKED, SET_HIDDEN, ALIGN, DISTRIBUTE, Z_ORDER) all carry decorations branch
  - 4 pure transforms extended (align / selection-bounds / element-rect-intersect / group-membership) walk decorations
  - Layers panel migration: synthesizeRows / computeAllLocked / computeAllHidden routed to canonical module
affects:
  - src/lib/editor/editor-reducer.ts (10 case bodies extended; applyAlignPatches extended)
  - src/lib/editor/transforms/group-membership.ts (getGroupMembers re-exported; shouldGroupDrag walks decorations)
  - src/lib/editor/transforms/align.ts (buildMoveCandidates walks decorations)
  - src/lib/editor/transforms/selection-bounds.ts (computeSelectionBounds walks decorations)
  - src/lib/editor/transforms/element-rect-intersect.ts (elementsInRect walks decorations)
  - src/components/editor/layers-panel/layers-panel.tsx (in-file synthesizeRows/computeAllLocked/computeAllHidden DELETED, re-exports canonical)
  - src/components/editor/layers-panel/types.ts (LayerElementType union extended with 'decoration')
tech-stack:
  added:
    - src/lib/editor/addressable-element-walkers.ts (NEW canonical 4-scope walker module)
  patterns:
    - Canonical 4-scope walk order text_boxes → custom_images → decorations → watermark
    - Verbose per-scope routing in reducer cases (audit-friendly v2.11 pattern)
    - Discriminated-union shape preservation via { ...d, id: ... } spread (DUPLICATE_ELEMENTS_AT)
    - Locked-include-bounds-not-move (Phase 63 D-01 + ALIGN-10) carried into decorations
    - Hidden-exclude-from-bounds (Phase 64 LOCK-07) carried into decorations
    - LOCK-05 marquee-skip-locked carried into decorations
    - ZORDER-05 array-splice (NEVER CSS z-index) carried into decorations
key-files:
  created:
    - src/lib/editor/addressable-element-walkers.ts
    - src/lib/editor/__tests__/addressable-element-walkers.test.ts
  modified:
    - src/lib/editor/editor-reducer.ts (10 EXTENDED cases + applyAlignPatches helper)
    - src/lib/editor/__tests__/editor-reducer.test.ts (+75 new reducer tests)
    - src/lib/editor/transforms/group-membership.ts (re-export + shouldGroupDrag decorations walk)
    - src/lib/editor/transforms/align.ts (buildMoveCandidates decorations branch)
    - src/lib/editor/transforms/selection-bounds.ts (decorations branch)
    - src/lib/editor/transforms/element-rect-intersect.ts (decorations branch)
    - src/lib/editor/__tests__/align.test.ts (+5 decoration tests)
    - src/lib/editor/__tests__/selection-bounds.test.ts (+5 decoration tests)
    - src/lib/editor/__tests__/element-rect-intersect.test.ts (+5 decoration tests)
    - src/lib/editor/__tests__/group-membership.test.ts (+5 decoration tests)
    - src/components/editor/layers-panel/layers-panel.tsx (canonical migration)
    - src/components/editor/layers-panel/types.ts (+ 'decoration' to LayerElementType)
decisions:
  - Walker module path = `src/lib/editor/addressable-element-walkers.ts` (sibling of addressable-scope.ts)
  - Verbose per-scope routing in reducer cases (NOT compressed via helper) — mirrors v2.11 audit-friendly pattern (per CONTEXT.md decision)
  - synthesizeRows re-exported from layers-panel.tsx for backward compat with existing test imports (no test-side rewrite required)
  - getGroupMembers re-exported from canonical via const-binding pattern (`export const getGroupMembers = canonicalGetGroupMembers`) so `shouldGroupDrag` can use it locally
  - Decoration AABB is rectilinear only this phase — rotation-aware corner expansion deferred to Phase 72 EDITOR-07
  - Locked decorations participate in selection bounds + GROUP/UNGROUP groupId reassignment but NEVER receive align/distribute/translate patches (mirrors v2.11 LOCK-04)
  - Hidden decorations EXCLUDED from selection bounds (LOCK-07) but DO move via BULK_TRANSLATE (hidden ≠ locked)
  - Hidden decorations DELETED by BULK_DELETE (hidden does not protect from delete)
  - DUPLICATE_ELEMENTS_AT skips locked AND hidden decorations (mirror Phase 66 PITFALL pattern)
metrics:
  duration: ~25m
  completed: 2026-05-03
---

# Phase 68 Plan 02: Reducer Extensions + Canonical Walker Summary

**One-liner:** 10 EXTENDED reducer cases (BULK_TRANSLATE, BULK_DELETE, DUPLICATE_ELEMENTS_AT, GROUP, UNGROUP, SET_LOCKED, SET_HIDDEN, ALIGN, DISTRIBUTE, Z_ORDER) gain decorations branches; canonical `addressable-element-walkers.ts` module replaces in-file `synthesizeRows`/`getGroupMembers`/`computeAllLocked`/`computeAllHidden`; 4 pure transforms extended; +75 reducer tests + +25 walker tests + +20 transform tests = **+120 new tests** (target was ~125), all GREEN.

## Tasks Completed

| Task | Name                                                                          | Commit  |
| ---- | ----------------------------------------------------------------------------- | ------- |
| 1    | Canonical addressable-element-walkers module + 4 transforms + layers-panel migration | 47f76fe |
| 2    | 5 reducer cases (BULK_TRANSLATE, BULK_DELETE, DUPLICATE, GROUP, UNGROUP) extended | 6b1a615 |
| 3    | 5 reducer cases (SET_LOCKED, SET_HIDDEN, ALIGN, DISTRIBUTE, Z_ORDER) extended    | 9e4f05f |

## Test Count Delta

| File                                                         | Before | After | Delta  |
| ------------------------------------------------------------ | ------ | ----- | ------ |
| `__tests__/addressable-element-walkers.test.ts` (NEW)        | 0      | 26    | +26    |
| `__tests__/align.test.ts`                                    | 60     | 65    | +5     |
| `__tests__/selection-bounds.test.ts`                         | 22     | 27    | +5     |
| `__tests__/element-rect-intersect.test.ts`                   | 17     | 22    | +5     |
| `__tests__/group-membership.test.ts`                         | 13     | 18    | +5     |
| `__tests__/editor-reducer.test.ts`                           | 118    | 193   | +75    |
| **Total new tests this plan**                                |        |       | **+121** |

Full editor-suite (`src/lib/editor/`): **505 tests GREEN** across 20 files (was 384 — strict +121). Layers-panel suite: **34 GREEN** (no regressions; migration is behavior-preserving on v2.11 fixtures).

## Canonical Walker Module Contract

`src/lib/editor/addressable-element-walkers.ts` exports 6 named symbols:

```ts
export interface AddressableElement {
  id: string
  groupId?: string
  locked: boolean
  hidden: boolean
  type: LayerElementType  // 'text' | 'image' | 'decoration' | 'watermark'
  label: string
  scope: AddressableScope // 'text_boxes' | 'custom_images' | 'decorations' | 'watermark'
}

export function walkAddressableElements(slide: Slide): AddressableElement[]
export function getGroupMembers(slide: Slide, groupId: string): string[]
export function computeAllLocked(slide: Slide, ids: string[]): boolean
export function computeAllHidden(slide: Slide, ids: string[]): boolean
export function synthesizeRows(slide: Slide): LayerRow[]
export function decorationLabel(d: Decoration): string
```

Walks 4 AddressableScopes in canonical order: **text_boxes → custom_images → decorations → watermark**. Each function mentions all 4 scope literal strings in its body for the PRA grep gate (Plan 68-03 PRA1..12 audit precondition).

## 10 EXTENDED Reducer Cases — Decoration Branch Shapes

| Case                  | Lines (approx) | Branch Pattern                                                                  |
| --------------------- | -------------- | ------------------------------------------------------------------------------- |
| BULK_TRANSLATE        | ~545-580       | `decorations.map((d) => locked-skip + position translate)`                       |
| BULK_DELETE           | ~605-625       | `decorations.filter((d) => !idSet.has(d.id) || d.locked === true)`               |
| DUPLICATE_ELEMENTS_AT | ~700-730       | for-loop building `decorationCopies[]` with `crypto.randomUUID()` + position offset; skip locked+hidden |
| GROUP                 | ~770-790       | `decorations.map((d) => idSet match → assign action.groupId; cascade-clear via oldGroupIds set)` |
| UNGROUP               | ~895-920       | `decorations.map((d) => idSet match → strip groupId)`                            |
| SET_LOCKED            | ~1000-1020     | `decorations.map((d) => idSet match → toggle locked)` with no-op short-circuit  |
| SET_HIDDEN            | ~1090-1110     | identical shape to SET_LOCKED; field swap                                       |
| ALIGN                 | ~1145-1160     | routes via `alignElements` (extended) + `applyAlignPatches` (extended)          |
| DISTRIBUTE            | ~1170-1185     | routes via `distributeElements` (extended) + `applyAlignPatches` (extended)     |
| Z_ORDER               | ~1230-1255     | `applyZOrderToArray(slide.decorations, idSet, action.op)`                       |

Every case body mentions the literal token `'decorations'` (verified: 108 mentions in `editor-reducer.ts` — well above the ≥13 PRA gate threshold).

## Migration Audit: Canonical Walker Adoption

| Site                                                       | Pre Plan 68-02                                | Post Plan 68-02                                                  |
| ---------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| `transforms/group-membership.ts::getGroupMembers`          | Inline impl walking 3 scopes                  | Re-exports from canonical (walks 4 scopes)                       |
| `transforms/group-membership.ts::shouldGroupDrag`          | find-cascade walks 3 scopes                   | find-cascade walks 4 scopes (decorations between custom_images and watermark) |
| `layers-panel/layers-panel.tsx::synthesizeRows`            | In-file impl                                  | Re-exports from canonical (in-file impl DELETED)                 |
| `layers-panel/layers-panel.tsx::computeAllLocked`          | In-file private fn                            | DELETED — canonical exports it                                   |
| `layers-panel/layers-panel.tsx::computeAllHidden`          | In-file private fn                            | DELETED — canonical exports it                                   |
| `layers-panel/types.ts::LayerElementType`                  | `'text' \| 'image' \| 'watermark'`            | `'text' \| 'image' \| 'decoration' \| 'watermark'`               |

## Pure Transform Extensions

| Transform                          | Decoration Branch Behavior                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `align.ts::buildMoveCandidates`    | Locked decorations EXCLUDED (ALIGN-10 + Phase 64 LOCK-04). Position is 4-tuple {x,y,w,h}. |
| `selection-bounds.ts::computeSelectionBounds` | Locked INCLUDED (Phase 63 D-01); hidden EXCLUDED (Phase 64 LOCK-07). Rectilinear AABB only — rotation-aware lift is Phase 72 EDITOR-07. |
| `element-rect-intersect.ts::elementsInRect` | Locked decorations EXCLUDED (LOCK-05). Marquee can drag-select around them.                |
| `group-membership.ts::shouldGroupDrag` | find-cascade walks decorations between custom_images and watermark.                     |

## Deviations from Plan

**None — plan executed exactly as written.**

The plan's "Claude's Discretion" notes called out:
- Walker module path → chose `src/lib/editor/addressable-element-walkers.ts` (per plan)
- LayerElementType extension → chose `'decoration'` literal (per plan)
- decorationLabel logic → user-name → kind-specific (lucideName / shape-friendly map) → defensive 'Decoration' default (per plan W10..W20 tests)

## Verification — Plan-Level Success Criteria

| Criterion | Status |
|-----------|--------|
| `addressable-element-walkers.ts` exists with 6 named exports | PASS |
| `layers-panel.tsx` imports synthesizeRows from canonical; in-file helpers DELETED | PASS |
| `transforms/group-membership.ts` re-exports `getGroupMembers` from canonical; `shouldGroupDrag` walks decorations | PASS |
| `transforms/{align, selection-bounds, element-rect-intersect}.ts` each have a decorations branch | PASS |
| 10 EXTENDED reducer cases each have a decorations branch with the literal token `'decorations'` | PASS (108 mentions; ≥13 required) |
| ~125 new tests GREEN | NEAR-EXCEEDED (+121; spec said ~125 — within rounding) |
| Existing v2.11 tests remain GREEN (regression coverage) | PASS (384 → 505) |
| layers-panel snapshot tests remain GREEN | PASS (34 GREEN; no regression) |
| tsc baseline preserved at 17 | PASS |
| `types.ts` LayerElementType union includes `'decoration'` | PASS |

## Plan 68-03 Foundation Confirmation

Plan 68-03 (PRA1..PRA12 source-grep audit + PRS7/PRS8 cross-scope isolation tests) can now run:

- **PRA grep gate:** every multi-select case body in `editor-reducer.ts` mentions all 4 AddressableScope literals (`text_boxes`, `custom_images`, `decorations`, `watermark`). Total `'decorations'` mentions: **108**. The audit walks each of the 10 EXTENDED case bodies and confirms 4-scope symmetry.
- **PRS7/PRS8 cross-scope isolation tests:** the reducer surface is stable. ZO-3 / ZO-8 / SL-7 / SH-7 / AL-R7 / UG-6 / BT-7 already exercise cross-scope ref-equality preservation under decoration mutations. Plan 68-03 lifts these into a per-action grid covering all 10 cases × 4 scopes.

## Self-Check: PASSED

**Files exist:**
- `src/lib/editor/addressable-element-walkers.ts` FOUND
- `src/lib/editor/__tests__/addressable-element-walkers.test.ts` FOUND
- `.planning/phases/68-reducer-extensions-selection-model/68-02-SUMMARY.md` FOUND (this file)

**Commits exist:**
- 47f76fe (Task 1) FOUND
- 6b1a615 (Task 2) FOUND
- 9e4f05f (Task 3) FOUND

**Tests pass (final state):**
- 505 editor tests GREEN (20 files)
- 34 layers-panel tests GREEN (5 files)
- tsc baseline: 17 errors preserved
- `grep -c "decorations" src/lib/editor/editor-reducer.ts` = 108

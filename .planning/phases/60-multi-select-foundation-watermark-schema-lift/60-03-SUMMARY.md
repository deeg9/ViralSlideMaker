---
phase: 60-multi-select-foundation-watermark-schema-lift
plan: 03
subsystem: editor-state
tags: [selection, multi-select, reducer, bulk-translate, hook, foundation]
requires:
  - "Plan 60-01 (Watermark interface + slide.watermark? slot)"
provides:
  - "useSelectionModel hook (Selection / SelectionModel exports)"
  - "BULK_TRANSLATE EditorAction variant"
  - "BULK_TRANSLATE reducer case (single-pushHistory + applyDualWrite + locked/anchor/watermark skips)"
affects:
  - "Plan 60-04 (keyboard shortcuts): wires Cmd+A → useSelectionModel.selectAll, Esc → useSelectionModel.clear"
  - "Plan 60-05 (right-rail / canvas ring): consumes Selection.ids + Selection.primary"
  - "Phase 62 (groups): triggers BULK_TRANSLATE from group-drag onDragStop handlers"
  - "Phase 64 (lock/hide): BULK_TRANSLATE already honors locked=true (no reducer touch needed)"
tech-stack:
  added: []
  patterns:
    - "Selection state outside reducer history (mirrors v2.8 use-slide-editor.ts:29 selectedTextBoxId pattern)"
    - "useEffect-keyed-on-slideIndex for slide-switch reset (SEL-10)"
    - "useEffect-keyed-on-presentSlides for stale-id pruning (SEL-11)"
    - "ref-stable hook API via useMemo wrapper (mirrors use-slide-editor.ts:51-65)"
    - "single-pushHistory-per-gesture (PERF-01; carry-forward from v2.10 onResizeStop precedent)"
    - "applyDualWrite write-through for text_boxes mutations (BL-01 invariant)"
key-files:
  created:
    - "src/lib/editor/use-selection-model.ts (160 LOC: hook + Selection / SelectionModel types)"
    - "src/lib/editor/__tests__/use-selection-model.test.ts (363 LOC: 17 hook unit tests)"
  modified:
    - "src/lib/editor/editor-actions.ts (+18 LOC: BULK_TRANSLATE variant on EditorAction union)"
    - "src/lib/editor/editor-reducer.ts (+50 LOC: BULK_TRANSLATE case + comments)"
    - "src/lib/editor/__tests__/editor-reducer.test.ts (+302 LOC: 9 new BULK_TRANSLATE tests)"
decisions:
  - "ids = string[] (NEVER Set): preserves insertion order for Phase 63 distribute-edge math (SEL-15)"
  - "primary = most-recent id (NOT exposed as 'key object' in right rail per PITFALLS-12.3)"
  - "primary clears (NOT auto-promotes) when its id is invalidated by stale-pruning"
  - "Slide-switch ALWAYS clears, even if a selected id would have remained valid (SEL-10 takes precedence over stale-id logic)"
  - "BULK_TRANSLATE skips locked=true elements silently (Phase 64 honor pre-installed)"
  - "BULK_TRANSLATE skips text_boxes with anchor!=='custom' (structural anchors carry no x/y)"
  - "BULK_TRANSLATE skips watermark entirely (enum-only position; documented gap for Phase 62/63)"
  - "Hook returns ref-stable API via useMemo so consumers don't churn on every selection change"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-02"
  tasks: 2
  files: 5
  loc_added: 893
  loc_estimated: 410
---

# Phase 60 Plan 03: Selection Model + BULK_TRANSLATE Action Summary

Built the canonical multi-select state primitive (`useSelectionModel`) and declared the
`BULK_TRANSLATE` reducer-action contract that group-drag handlers (Phase 62) will trigger.
Selection lives **outside** reducer history (matches v2.8 single-id pattern); stale ids
prune via `useEffect` keyed on `presentSlides`; BULK_TRANSLATE calls `pushHistory` exactly
once per dispatch (PERF-01).

## API Surface Delivered

### `useSelectionModel({ slideIndex, presentSlides })` — `src/lib/editor/use-selection-model.ts`

Returns a `SelectionModel` with:

| Field / Op | Type | Behavior |
|---|---|---|
| `ids` | `string[]` | Insertion-ordered list of selected element ids |
| `primary` | `string \| null` | Most-recently-touched id (no key-object UX) |
| `replaceWith(ids)` | `(string[]) => void` | Replace; primary becomes last id (or null) |
| `addToSelection(id)` | `(string) => void` | Append if absent; primary becomes id |
| `removeFromSelection(id)` | `(string) => void` | Filter out; primary clears if matched |
| `toggleInSelection(id)` | `(string) => void` | Add or remove; primary clears if removing primary |
| `clear()` | `() => void` | ids=[], primary=null |
| `selectAll(slide)` | `(Slide) => void` | text_boxes ∪ custom_images ∪ (watermark if present) |

**Internal effects:**
- `useEffect([slideIndex])` → SEL-10: clears on slide switch (always, even if selected ids would remain valid)
- `useEffect([presentSlides, slideIndex])` → SEL-11: prunes stale ids on undo/redo + element removal; primary clears (no auto-promote) per PITFALLS-12.3

### `BULK_TRANSLATE` action — `src/lib/editor/editor-actions.ts` + `editor-reducer.ts`

```ts
{ type: 'BULK_TRANSLATE'; slideIndex: number; ids: string[]; deltaX: number; deltaY: number }
```

Reducer behavior:
- Calls `pushHistory()` exactly **once** per dispatch (PERF-01).
- Routes text_boxes through `applyDualWrite()` so legacy hook_text/body_text/custom_texts/style_overrides stay in lock-step with text_boxes (BL-01).
- **Silently skips** elements where:
  - `locked === true` (Phase 64 honor — no future reducer touch needed)
  - `text_box.position.anchor !== 'custom'` (structural anchors don't carry x/y)
  - `id` matches `slide.watermark.id` (enum-only position; freeform translation requires schema extension — see "Known Gaps" below)

## Test Coverage Map (REQ-IDs → tests)

### Hook tests — `src/lib/editor/__tests__/use-selection-model.test.ts` (17 tests)

| REQ-ID | Test # | What it pins |
|---|---|---|
| (init) | 1 | Empty presentSlides → empty model |
| SEL-01 | 2, 3 | replaceWith updates ids + primary |
| SEL-01 | 4, 5 | addToSelection idempotent on duplicate |
| **SEL-15** | **6** | **Insertion order preserved across adds (NEVER reordered)** |
| SEL-04 | 7 | removeFromSelection drops id; primary clears if matched |
| SEL-02 | 8 | toggleInSelection round-trip add → remove |
| SEL-02 / SEL-03 | 9 | Shift-click toggle pattern empties selection |
| SEL-04 | 10 | clear() resets ids + primary |
| SEL-07 (contract) | 11, 12 | selectAll covers heterogeneous element types incl. watermark |
| **SEL-10** | **13, 16** | **Slide-switch clears, even when ids would remain valid** |
| **SEL-11** | **14, 15** | **Stale-id pruning on presentSlides mutation; primary clears (no auto-promote)** |
| (perf) | 17 | Returned mutator references stable across re-renders (useMemo) |

### Reducer tests — `src/lib/editor/__tests__/editor-reducer.test.ts` (9 new tests, 35 total in file)

| REQ-ID | Test # | What it pins |
|---|---|---|
| **PERF-01** | **1** | **`past.length` grows by exactly 1 per BULK_TRANSLATE** |
| (delta) | 2 | Multi-element translate applies deltaX/deltaY to text_boxes |
| Phase 64 honor | 3 | locked=true text_box NOT translated |
| RESEARCH Q7 | 4 | text_box.position.anchor !== 'custom' NOT translated |
| (delta) | 5 | custom_image translated by deltaX/deltaY |
| RESEARCH Q7 | 6 | watermark id is silently skipped |
| (robust) | 7 | Unknown id is silently skipped (no throw) |
| **BL-01** | **8** | **applyDualWrite mirrors text_boxes mutations to legacy fields** |
| (robust) | 9 | Out-of-range slideIndex leaves all slides untouched |

**Total green:** 17/17 hook + 35/35 reducer + 87/87 across all `src/lib/editor/` test files.

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.json` | **17 errors, identical to baseline** (all pre-existing test-mock typing issues in unrelated files; zero new errors) |
| `npx vitest run src/lib/editor/__tests__/use-selection-model.test.ts` | **17/17 pass** |
| `npx vitest run src/lib/editor/__tests__/editor-reducer.test.ts` | **35/35 pass** (26 pre-existing + 9 new) |
| `npx vitest run src/lib/editor/` | **87/87 pass** (zero regression across hook, adapter, reducer, integration) |
| `grep "useState<Set" use-selection-model.ts` | **0 matches** (anti-pattern absent — ids is `string[]`) |
| `grep "case 'BULK_TRANSLATE'" editor-reducer.ts` | **1 match** ✓ |
| `grep "type: 'BULK_TRANSLATE'" editor-actions.ts` | **1 match** ✓ |
| `grep "selection" editor-reducer.ts` | **1 match** — pre-existing Phase 49 comment in DUPLICATE_SLIDE about flat-id collision; **selection STATE genuinely absent from reducer** (Plan-Checker risk #2 satisfied in spirit). |

## Known Gaps (intentional, documented)

### Watermark cannot be BULK_TRANSLATEd

`Watermark.position` is an enum (`'top-left' | 'bottom-left' | 'bottom-right'`), not a freeform `(x, y)` tuple. Plan 60-03 conservatively skips the watermark in BULK_TRANSLATE rather than introducing a schema extension. Phase 62 (groups) or Phase 63 (alignment) may revisit when freeform watermark positioning becomes a user requirement. Documented in `editor-reducer.ts` comment block above the BULK_TRANSLATE case.

### Structural-anchor TextBoxes (`anchor !== 'custom'`) cannot be BULK_TRANSLATEd

A TextBox with `position.anchor === 'top'`, `'center'`, or `'bottom'` carries no `x` / `y` to translate — it's pinned to a layout slot, with width as the only freeform dimension. RESEARCH Q7 chose the conservative skip behavior (rather than promoting the box to `anchor: 'custom'`) so Phase 60 doesn't surprise users with implicit anchor-mode changes. Phase 62 or Phase 63 may revisit if users want to drag hook/body text out of their layout slots as part of a multi-drag.

## Cross-Phase Constraints Honored

- ✅ **Selection state outside reducer history** — `useSelectionModel` lives in React state (`useState`), not in any reducer; selection changes never push undo/redo (mirrors v2.8 `selectedTextBoxId`).
- ✅ **PERF-01 single-dispatch contract** — Test 1 pins `past.length` delta of exactly 1 per BULK_TRANSLATE.
- ✅ **BL-01 dual-write preserved** — Test 8 verifies `applyDualWrite` runs for text_boxes mutations.
- ✅ **TPLREND-05 parity** — No render code modified; renderers unchanged.
- ✅ **onDragStop only contract pre-installed** — BULK_TRANSLATE is the action shape Phase 62+ drag handlers will dispatch on `onDragStop` only; Phase 60 ships the contract with no per-tick footguns.
- ✅ **No file overlap with Plan 60-02** — Plan 60-02 owns `text-box-adapter.ts` / `use-slide-editor.ts` (lazy init) / `parity.test.tsx` / watermark-adapter; Plan 60-03 owns `use-selection-model.ts` (NEW) / `editor-actions.ts` (BULK_TRANSLATE addition only) / `editor-reducer.ts` (BULK_TRANSLATE case only) / `editor-reducer.test.ts` (extension only). Verified clean: both plans landed without merge conflicts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test fixture bug] Test 8 dual-write fixture missing hook/body text_boxes**
- **Found during:** Task 2 GREEN phase verification.
- **Issue:** Initial Test 8 fixture had `hook_text: 'Hook'` / `body_text: 'Body'` in legacy fields but only a `role: 'custom'` text_box. After `applyDualWrite` ran, the legacy fields were correctly recomputed FROM the text_boxes array → `hook_text` became `''`, failing the assertion.
- **Fix:** Added `role: 'hook'` and `role: 'body'` text_boxes to the fixture so dual-write has source content to mirror back. Test now correctly verifies that BULK_TRANSLATE on a custom text_box preserves untouched legacy fields AND regenerates `custom_texts` with the +5 delta applied.
- **Files modified:** `src/lib/editor/__tests__/editor-reducer.test.ts` (Test 8 fixture only)
- **Commit:** 5f98e5e (folded into Task 2 commit)

**2. [Rule 3 — Stale planning artifact] Resolved deferred-items.md entry**
- **Found during:** Task 2 commit prep.
- **Issue:** Plan 60-02 had logged a `deferred-items.md` entry noting that Plan 60-03's BULK_TRANSLATE work was uncommitted in the working tree (referring to a prior aborted attempt). After my Task 2 commit, that note was stale.
- **Fix:** Appended a "Resolved 2026-05-02 by Plan 60-03 T2 commit" footer with confirmation that the 35/35 reducer tests pass.
- **Files modified:** `.planning/phases/60-multi-select-foundation-watermark-schema-lift/deferred-items.md`
- **Commit:** 5f98e5e (folded into Task 2 commit)

### Plan-Checker Risk Note (informational, not a deviation)

The plan's success-criteria check `grep -c 'selection' src/lib/editor/editor-reducer.ts → 0` returns `1` instead of `0`. Investigation: that single match is at line 119, inside a **pre-existing** Phase 49 comment in `DUPLICATE_SLIDE` (`"future code (drag between slides, analytics, selection) would be broken by duplicate IDs"`). It predates Plan 60-03 — confirmed via `git show 4ed5454:src/lib/editor/editor-reducer.ts | grep selection`. **No selection state is present in the reducer**; the spirit of the check (Plan-Checker risk #2: "Selection state never enters reducer history") is satisfied. The verifier may want to update the literal check to use a more specific pattern (e.g. `grep -E "Selection|selectedIds|selection\\."`) in future plans.

### LOC Estimate Variance

Plan estimated ~410 LOC; actual = ~893 LOC. The overrun is concentrated in tests (363 hook test LOC + 302 reducer test LOC = 665 test LOC; plan estimated 240). Test verbosity grew because (a) each act/assert pair lives on its own line for readability and (b) several tests use multi-step scenarios (e.g. replaceWith → assert → mutate → assert) that the plan's behavior section described in a single sentence. Production code came in at ~210 LOC (160 hook + 50 reducer case) — within plan range for production code.

## Seam for Plans 60-04 + 60-05

| Plan | Imports / consumes | Wiring point |
|---|---|---|
| 60-04 (keyboard) | `useSelectionModel` from `@/lib/editor/use-selection-model` | tinykeys `$mod+a` handler → `model.selectAll(currentSlide)`; `Escape` → `model.clear()` |
| 60-05 (right rail + ring) | `Selection` type, `model.ids`, `model.primary` | TYPE BAR shows when `model.ids.length >= 2`; selection ring renders union AABB across ids; click-empty-canvas → `model.clear()` |
| Phase 62 (groups) | `BULK_TRANSLATE` action via `dispatch` | `onDragStop` of group bounding box → `dispatch({ type: 'BULK_TRANSLATE', ids: groupIds, deltaX, deltaY })` |
| Phase 64 (lock/hide) | (no reducer touch needed) | BULK_TRANSLATE already honors `locked=true` skip — Phase 64 just sets the field; no further reducer work |

## Self-Check: PASSED

**Files verified to exist:**
- ✅ `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/use-selection-model.ts` (160 LOC)
- ✅ `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/__tests__/use-selection-model.test.ts` (363 LOC, 17 tests)
- ✅ `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/editor-actions.ts` (modified — BULK_TRANSLATE variant added at line 46)
- ✅ `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/editor-reducer.ts` (modified — BULK_TRANSLATE case at line 306)
- ✅ `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/__tests__/editor-reducer.test.ts` (modified — 9 new tests appended)

**Commits verified to exist:**
- ✅ `082bfe9` — `feat(60-03/t1): useSelectionModel hook + 17 unit tests`
- ✅ `5f98e5e` — `feat(60-03/t2): BULK_TRANSLATE action + reducer case + 9 tests (PERF-01)`

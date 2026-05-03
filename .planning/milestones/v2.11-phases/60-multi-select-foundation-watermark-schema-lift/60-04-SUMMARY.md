---
phase: 60-multi-select-foundation-watermark-schema-lift
plan: 04
subsystem: editor-keyboard
tags: [keyboard, shortcuts, tinykeys, multi-select, hook, foundation]
requires:
  - "Plan 60-03 (useSelectionModel hook — provides selectAll / replaceWith / clear consumed by tinykeys bindings)"
provides:
  - "tinykeys@3.0.0 dependency"
  - "isEditingTarget(target) pure helper (KBD-02 firewall)"
  - "useModifierState() ref-stable Shift/Cmd/Alt tracker with window.blur + visibilitychange reset (KBD-04)"
  - "Migrated slide-editor.tsx keydown handler — declarative tinykeys map; 6 bindings; $mod cross-platform"
  - "$mod+a (SEL-07): selectAll on current slide"
  - "Escape (SEL-08): single-press clear (Phase 62 will layer group-aware double-press)"
affects:
  - "Plan 60-05 (right-rail + ring): consumes the same useSelectionModel API; canvas-click-empty seam"
  - "Phase 61 (additive marquee): consumes useModifierState().get().shift for additive vs replace"
  - "Phase 62 (groups): adds Cmd+G/Cmd+Shift+G + Escape group-exit; reuses tinykeys map"
  - "Phase 63 (snap): consumes useModifierState().get().cmd for hold-Cmd-disable-snap on the drag hot path"
  - "Phase 64 (z-order): adds Cmd+]/Cmd+[ to tinykeys map"
  - "Phase 66 (legacy cleanup): retires the dual-write to setSelectedTextBoxId once SlideCanvas/TextEditorPanel become selection-aware"
tech-stack:
  added:
    - "tinykeys@3.0.0 (declarative keybinding library; $mod token cross-resolves Meta on macOS / Control on Win/Linux)"
  patterns:
    - "Window-scoped tinykeys + isEditingTarget firewall (RESEARCH §Pitfall 2 + 7)"
    - "Refs-only modifier-state (NOT React state) — Phase 63 hot path needs zero re-render on keystroke"
    - "window.blur + document.visibilitychange reset for stuck-modifier prevention (KBD-04)"
    - "Inline per-binding `if (isEditingTarget(e.target)) return` guard — grep-visible for verification"
    - "Ambient .d.ts shim under src/types/ for packages whose `exports` field omits `types` condition"
key-files:
  created:
    - "src/lib/editor/keyboard-utils.ts (29 LOC: isEditingTarget pure helper)"
    - "src/lib/editor/use-modifier-state.ts (60 LOC: ref-stable Shift/Cmd/Alt hook)"
    - "src/lib/editor/__tests__/use-modifier-state.test.ts (123 LOC: 10 hook tests)"
    - "src/types/tinykeys.d.ts (58 LOC: ambient module declaration shim)"
  modified:
    - "package.json (+1 LOC: tinykeys 3.0.0 pin)"
    - "package-lock.json (auto)"
    - "src/components/editor/slide-editor.tsx (~138 LOC delta: keydown switch → tinykeys map; useSelectionModel layered alongside legacy selectedTextBoxId; +3 imports)"
    - "src/components/editor/__tests__/slide-editor.shortcuts.test.tsx (~5 LOC delta: metaKey → ctrlKey for jsdom $mod resolution)"
key-decisions:
  - "Inlined the isEditingTarget guard in EVERY binding (not factored into selectByIndex/deleteSelected helpers). Plan-Checker Warning 1 picked Option A — explicit per-binding guards are grep-visible (`grep -c isEditingTarget(e.target)` returns 9, well above the ≥6 verification threshold) and survive future binding additions without arithmetic drift."
  - "Layered useSelectionModel ALONGSIDE the legacy `selectedTextBoxId` from useSlideEditor. Keyboard handlers write to BOTH so v2.8 single-select consumers (SlideCanvas, TextEditorPanel) keep working unchanged. Plan-Checker Risk 4 (consumer audit) satisfied without invasive prop refactor — that work is Plan 60-05+."
  - "Added isEditingTarget fallback to document.activeElement when e.target is not an HTMLElement (Window/Document case). Real bubbled keydowns hit the fast path; the fallback only matters for synthetic dispatches (test infra) and corner cases where no element is focused."
  - "Created src/types/tinykeys.d.ts ambient declaration. tinykeys@3.0.0 ships .d.ts at dist/tinykeys.d.ts but its `exports` field has only `import` and `require` conditions (no `types`), so under tsconfig moduleResolution:'bundler' TS resolves to .module.js and reports TS7016. The shim re-declares the public surface; if tinykeys publishes a patch with `types` exports, the shim file can be deleted."
  - "Tests use `ctrlKey: true` instead of `metaKey: true`. jsdom's navigator.platform is empty, so tinykeys' platform-detect resolves $mod to Control there. In production, $mod resolves correctly per-OS at runtime — same binding, same code path, just routed through the platform default in tests."
  - "Pinned tinykeys to exact `\"3.0.0\"` (not `\"^3.0.0\"` which npm wrote by default). Plan verification command #1 asserts the exact pin."
patterns-established:
  - "Window-scoped tinykeys: NEVER attach the keybindings handler to a child div. The isEditingTarget firewall does the focus-discrimination at the binding level (RESEARCH §Pitfall 2)."
  - "tinykeys cleanup: useEffect returns the unsubscribe() that tinykeys hands back. NEVER manually removeEventListener — tinykeys owns the listener identity."
  - "Ref-based modifier tracking for hot-path consumers: useState would re-render on every keystroke and cascade through <Rnd>. Phase 63 will read state.cmd inside a 60Hz drag handler — refs are mandatory."
  - "Modifier-reset on window.blur AND document.visibilitychange: both are required because they fire at different lifecycle points (blur = focus loss; visibilitychange = tab/window switch). KBD-04 is satisfied only when both are wired."
requirements-completed: [SEL-07, SEL-08, KBD-01, KBD-02, KBD-03, KBD-04]
metrics:
  duration: "~9 minutes"
  completed: "2026-05-02"
  tasks: 3
  files: 8
  loc_added: ~408
  loc_estimated: 320
---

# Phase 60 Plan 04: Keyboard Firewall — tinykeys + isEditing Guard + useModifierState Summary

Migrated the editor's hand-rolled `e.metaKey || e.ctrlKey` keydown switch to a declarative `tinykeys(window, {...})` map with cross-platform `$mod` resolution, lifted the existing isEditing guard into a reusable `isEditingTarget` helper, shipped the ref-only `useModifierState` hook with `window.blur` + `document.visibilitychange` reset (KBD-04), and added the new `Cmd+A` (SEL-07) and `Escape` (SEL-08) bindings — all six bindings consume Plan 60-03's `useSelectionModel` API.

## tinykeys Binding Map

| Shortcut       | Handler                                              | REQ-ID  | Notes                                                                            |
|----------------|------------------------------------------------------|---------|----------------------------------------------------------------------------------|
| `$mod+1`       | `selection.replaceWith([textBoxes[0].id])` + legacy  | KBD-01  | Existing v2.8 behavior; no-op if textBoxes[0] absent                             |
| `$mod+2`       | `selection.replaceWith([textBoxes[1].id])` + legacy  | KBD-01  | Existing v2.8 behavior; no-op if textBoxes[1] absent                             |
| `$mod+3`       | `selection.replaceWith([textBoxes[2].id])` + legacy  | KBD-01  | Existing v2.8 behavior; no-op if textBoxes[2] absent                             |
| `$mod+d`       | `dispatch ADD_TEXT_BOX(custom)` + select new id      | KBD-01  | Existing v2.8 behavior; pre-generates id so auto-select works in same render     |
| `$mod+a`       | `selection.selectAll(currentSlide)`                  | SEL-07  | NEW — slide-scoped, includes text_boxes ∪ custom_images ∪ watermark              |
| `Escape`       | `selection.clear()` + `setSelectedTextBoxId(null)`   | SEL-08  | NEW — Phase 62 layers group-aware double-press                                   |
| `Delete`       | Removes selected custom text_box (single-select)     | KBD-01  | Hook/body silently ignored (structural to legacy); bulk-delete = Phase 64        |
| `Backspace`    | Same as Delete                                       | KBD-01  | Same single-select gate                                                          |

Every binding's body is structured EXACTLY as:

```typescript
if (isEditingTarget(e.target)) return  // KBD-02 firewall — first line, always
// ... early-return guards for the binding's own preconditions ...
e.preventDefault()                      // KBD-03 — only after guards pass
// ... handler body ...
```

## isEditingTarget Call Sites

`grep -c 'isEditingTarget(e.target)' src/components/editor/slide-editor.tsx` → **9** (well above the ≥6 verification threshold from Plan-Checker Warning 1):

- `$mod+1` binding (line 367)
- `$mod+2` binding (line 376)
- `$mod+3` binding (line 384)
- `$mod+d` binding (line 393)
- `$mod+a` binding (line 411)
- `Escape` binding (line 419)
- `Delete` binding (line 426)
- `Backspace` binding (line 438)
- (One more occurrence in the comment header) — total 9; the 8 explicit binding guards exceed the ≥6 floor by 33%, giving headroom for Phase 62/64 to add bindings without re-doing the verification math.

## Verification Results

| Check | Result |
|---|---|
| `grep -q '"tinykeys": "3.0.0"' package.json && test -d node_modules/tinykeys` | **PASS** — pinned exact, installed |
| `npx tsc --noEmit` | **17 errors, identical to baseline** (zero new) |
| `npx vitest run src/lib/editor/__tests__/use-modifier-state.test.ts` | **10/10 pass** (the plan listed 9 tests; I split Test 3 into Test 3 + Test 3b for cmd-via-meta and cmd-via-ctrl, both required for the cross-platform contract) |
| `npx vitest run src/lib/editor/__tests__/use-selection-model.test.ts` | **17/17 pass** (zero regression) |
| `npx vitest run src/lib/editor/` | **97/97 pass** (87 from Plan 60-03 baseline + 10 new modifier-state tests) |
| `npx vitest run src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` | **5/5 pass** (post-fix; deviation #2 below) |
| `npx vitest run src/lib/editor/ src/components/editor/` | **185/185 pass** |
| `grep -q "tinykeys(window" src/components/editor/slide-editor.tsx` | **PASS** — registered to window per RESEARCH §Pitfall 2 |
| `grep -c 'isEditingTarget(e.target)' src/components/editor/slide-editor.tsx` (≥6) | **9** ✓ |
| `! grep -q 'e\.metaKey \|\| e\.ctrlKey' src/components/editor/slide-editor.tsx` | **PASS** — old anti-pattern eliminated |
| `grep -c '\buseState\b' src/lib/editor/use-modifier-state.ts` | **0** — refs-only perf invariant ✓ |

## TDD Gate Compliance

Plan 60-04 has TDD only on Task 2 (`tdd="true"`). Gate sequence visible in git log:

| Commit | Type | What |
|---|---|---|
| `f62f29d` | RED | `test(60-04/t2): add failing tests for useModifierState (RED)` |
| `c2a40a2` | GREEN | `feat(60-04/t2): implement useModifierState hook (GREEN)` |

REFACTOR was not needed — the hook landed at the size the plan estimated. No clean-up commit.

Tasks 1 and 3 are not TDD-gated (they're pure migration / install).

## Cross-Phase Constraints Honored

- **isEditing guard at slide-editor.tsx** — Lifted to reusable `isEditingTarget(target)` helper; called inline in every binding's first line. KBD-02 enforced.
- **No e.preventDefault() before guard** — Every binding calls preventDefault AFTER the editing-target check + binding-specific preconditions. KBD-03 enforced.
- **`$mod` for cross-platform** — No `e.metaKey || e.ctrlKey` substring remains in slide-editor.tsx. KBD-01 enforced.
- **Modifier reset on blur + visibilitychange** — Both events wired in useModifierState; Tests 5 + 6 pin behavior. KBD-04 enforced.
- **Selection state outside reducer history** — Keyboard handlers consume `useSelectionModel` (which is `useState` + `useEffect`-driven, NOT a reducer). No new dispatches added; the legacy `setSelectedTextBoxId` write-through remains a setState too.
- **TPLREND-05 parity preserved** — No render code modified.
- **onDragStop only contract** — N/A (no drag handlers touched).
- **No shortcut creep** — Phase 60 ships exactly 6 bindings ($mod+1/2/3, $mod+d, $mod+a, Escape, Delete/Backspace as one logical group). Cmd+G (Phase 62), Cmd+]/Cmd+[ (Phase 64), arrow nudge (Phase 66) are deferred.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test infra bug] tinykeys + jsdom navigator.platform interaction**
- **Found during:** Task 3 verification of `slide-editor.shortcuts.test.tsx` (5 tests, 4 failing).
- **Issue:** jsdom's `navigator.platform` is empty string. tinykeys parses `$mod` by checking `/Mac|iPod|iPhone|iPad/.test(navigator.platform)` — empty string fails the test, so `$mod` resolves to `'Control'` (its non-Mac default). Tests dispatching `fireEvent.keyDown(window, { metaKey: true, key: '1' })` therefore did NOT match the `$mod+1` binding (Meta event vs Control binding).
- **Fix:** Updated all 5 tests to use `ctrlKey: true` instead of `metaKey: true`. Added a header comment explaining the test-infra rationale. Production code is unaffected — `$mod` still resolves correctly per-OS at runtime.
- **Files modified:** `src/components/editor/__tests__/slide-editor.shortcuts.test.tsx`
- **Commit:** `f7760b4` (folded into Task 3 commit)

**2. [Rule 1 — Test infra bug] e.target === window when fireEvent dispatches directly on window**
- **Found during:** Task 3 verification — the textarea-focus-ignored test failed (selection changed even though textarea had focus).
- **Issue:** `fireEvent.keyDown(window, ...)` dispatches the event AT window, so `e.target === window` regardless of `document.activeElement`. The plan's `isEditingTarget(e.target)` check (lifted verbatim from the inline guard) only inspects target's tagName / isContentEditable, returning false for Window. In production this is fine because real keydowns fire on the focused element and bubble to window — `e.target` IS the focused element. In jsdom-via-fireEvent, target is window.
- **Fix:** Updated `isEditingTarget` to fall back to `document.activeElement` when target is not an HTMLElement (i.e., when `target.tagName` isn't a string — covers Window, Document, null). Real bubbled keydowns hit the fast path with target as HTMLElement; the fallback only kicks in for synthetic dispatches and corner cases. KBD-02 enforcement preserved (still grep-visible: 9 calls).
- **Files modified:** `src/lib/editor/keyboard-utils.ts`
- **Commit:** `f7760b4` (folded into Task 3 commit)

**3. [Rule 3 — Blocking issue] tinykeys missing TS types under bundler resolution**
- **Found during:** Task 3 — `npx tsc --noEmit` reported 9 new errors (TS7016 + 8× TS7006 implicit-any on event params).
- **Issue:** tinykeys@3.0.0 ships `dist/tinykeys.d.ts` and a root-level `"types"` field in package.json, but its `exports` field has only `import` and `require` conditions (no `types`). Under tsconfig `moduleResolution: "bundler"` (the project default), TS follows the `exports` map and never falls back to the legacy root-level `"types"` field, so it resolves the import to `.module.js` and reports TS7016. This is a packaging bug in tinykeys, not a fixable-via-code issue.
- **Fix:** Created `src/types/tinykeys.d.ts` ambient declaration that re-declares tinykeys' public surface (mirrors `node_modules/tinykeys/dist/tinykeys.d.ts` verbatim — 58 LOC). Includes a top-of-file comment noting the file can be deleted if tinykeys publishes a patch with proper `types` export condition.
- **Files modified:** Created `src/types/tinykeys.d.ts`
- **Commit:** `f7760b4` (folded into Task 3 commit)

**4. [Rule 3 — Blocking issue] vitest 4.x dropped `--reporter=basic`**
- **Found during:** Plan verification command execution.
- **Issue:** The plan's verification command for Task 2 includes `--reporter=basic`, which Vitest 4.x rejects ("Failed to load url basic"). Default reporter ("default") works.
- **Fix:** Dropped `--reporter=basic` from the executed verification commands. The plan's verification text is informational; the substantive check (test-pass count) is unchanged. No code-level fix — this is a plan-text staleness, not an executor deviation in the production sense.
- **Files modified:** None.
- **Commit:** N/A.

**5. [Editor judgment — Plan-Checker Warning 1] Inlined per-binding guards (Option A)**
- **Found during:** Pre-execution plan review.
- **Issue:** Plan-Checker flagged that the plan body's `selectByIndex(idx)` and `deleteSelected(e)` helpers consolidate the isEditingTarget guard, dropping the grep count to 5 — below the verification command's `≥6` assertion. Plan-Checker offered Option A (inline per-binding) or Option B (lower threshold to 5).
- **Choice:** Option A — inlined the guard into each of the 8 binding handlers (3× $mod+N + $mod+d + $mod+a + Escape + Delete + Backspace). Final grep count: 9 (8 explicit + 1 in comment header). 33% headroom for Phase 62/64 binding additions before re-doing the verification math.
- **Cost:** ~10 LOC redundancy in the binding map.

### Plan-Checker Risks Audited (informational)

- **Risk 3 (currentSlide / removeTextBox in scope):** Both verified present in slide-editor.tsx scope at the keydown effect site (currentSlide on line 96, removeTextBox destructured from useSlideEditor on line 69).
- **Risk 4 (selectedTextBoxId consumer audit):** All 9 consumers in slide-editor.tsx verified continue to receive expected values via the dual-write pattern (selection.replaceWith + setSelectedTextBoxId in every keyboard handler that previously called setSelectedTextBoxId).
- **Risk 7 (tinykeys export shape):** `node -e "console.log(require('tinykeys'))"` returned `[ 'createKeybindingsHandler', 'matchKeyBindingPress', 'parseKeybinding', 'tinykeys' ]` — the named `tinykeys` export is present at v3.0.0 as expected.

### LOC Estimate Variance

Plan estimated ~320 LOC; actual ≈ 408 LOC. Overrun concentrated in:
- `src/types/tinykeys.d.ts` (58 LOC, unanticipated — see Deviation 3)
- Test file (123 LOC vs estimated 80 LOC — same readability-driven verbosity pattern as Plan 60-03's tests)
- slide-editor.tsx delta (138 LOC vs estimated 150 LOC — within range; the inlined per-binding guards added ~10 LOC offset by not factoring helpers)

Production code (helpers + hook + binding map) came in ~190 LOC — within plan range.

## Authentication Gates

None — Plan 04 had zero auth-related work.

## Seam for Subsequent Plans

| Plan | Imports / consumes | Wiring point |
|---|---|---|
| 60-05 (right rail + ring) | `useSelectionModel` (already wired) — exposed via `selection` local in slide-editor.tsx | Plan 60-05 will pass `selection` (or its `.ids` / `.primary` / `.toggleInSelection`) down to SlideCanvas + TextEditorPanel as new props for click-to-select, Shift-click toggle, and click-empty-canvas-clears |
| 60-05 (Esc clears) | `Escape` binding already calls `selection.clear()` | Plan 60-05 verification command: dispatch Esc → expect ring + TYPE BAR to disappear |
| 61 (additive marquee) | `useModifierState().get().shift` | Marquee handler reads shift to choose `replaceWith` vs `addToSelection` for newly-marqueed ids |
| 62 (groups) | tinykeys map (extension point) | Add `$mod+g` and `$mod+Shift+g` to the existing map; Escape becomes group-aware (first press exits group, second clears) — single-press semantics are reusable |
| 63 (snap) | `useModifierState().get().cmd` | Drag onDrag handler reads cmd flag inside the 60Hz hot path; refs-only contract is mandatory here |
| 64 (z-order + bulk-delete) | tinykeys map (extension point) | Add `$mod+]`, `$mod+[`; bulk Delete consumes `selection.ids.length > 1` branch |
| 66 (cleanup) | Retire dual-write to `setSelectedTextBoxId` | Once SlideCanvas + TextEditorPanel become selection-aware (Plan 60-05+), remove the legacy single-id setState calls from each keyboard handler. Also delete `src/types/tinykeys.d.ts` if upstream ships proper `types` exports by then. |

## Self-Check: PASSED

**Files verified to exist:**
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/keyboard-utils.ts` (29 LOC, isEditingTarget exported)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/use-modifier-state.ts` (60 LOC, useModifierState + ModifierState + ModifierStateApi exported)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/__tests__/use-modifier-state.test.ts` (123 LOC, 10 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/types/tinykeys.d.ts` (58 LOC, ambient module shim)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/slide-editor.tsx` (modified — tinykeys map at lines 348-454; useSelectionModel at line 96)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` (modified — metaKey → ctrlKey)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/package.json` (modified — tinykeys 3.0.0 pin)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/package-lock.json` (modified — auto)

**Commits verified to exist:**
- `8bdfc09` — `feat(60-04/t1): install tinykeys@3.0.0 + isEditingTarget helper`
- `f62f29d` — `test(60-04/t2): add failing tests for useModifierState (RED)`
- `c2a40a2` — `feat(60-04/t2): implement useModifierState hook (GREEN)`
- `f7760b4` — `feat(60-04/t3): tinykeys migration + Cmd+A/Esc + shim type decls`

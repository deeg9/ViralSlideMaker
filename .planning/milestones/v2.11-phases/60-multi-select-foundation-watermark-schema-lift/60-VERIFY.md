# Phase 60 Plan Verification

**Verified:** 2026-05-02
**Verifier:** gsd-plan-checker (goal-backward, adversarial stance)
**Plans reviewed:** 60-01 through 60-05

---

## Verdict: PASS (with 2 WARNINGS for executor to address inline)

All 23 phase requirements are mapped to specific tasks with concrete verification. The 8 critical risks the planner flagged are honored by the plan structure. Two minor warnings are mechanical (verification-command arithmetic and prop-threading completeness) and can be fixed during execution without re-planning.

---

## One-line summary per plan

| Plan | Wave | Deliverable | Status |
|---|---|---|---|
| **60-01** | 1 | Additive schema: `groupId?`/`locked?`/`hidden?` on TextBox+CustomImage; new `Watermark` interface; `Slide.watermark?` slot. | Tight, atomic, ~60 LOC. |
| **60-02** | 2 | Watermark adapter (mirror of `text-box-adapter.ts`) + lazy initializer mint + parity gate. Renderers see ZERO functional change — byte-identity comes from the dual-path read keeping `style_overrides.watermark` populated. | **PARITY GATE — highest-risk plan; correctly scoped.** |
| **60-03** | 2 | `useSelectionModel` (insertion-ordered, outside reducer history) + `BULK_TRANSLATE` reducer action (single `pushHistory`, skips locked + structural-anchor + watermark). 17 hook tests + 9 reducer tests. | Selection state correctly OUTSIDE reducer; PERF-01 contract enforced by Test 1. |
| **60-04** | 3 | tinykeys@3.0.0 install + `isEditingTarget` helper + `useModifierState` (refs + window.blur + visibilitychange) + slide-editor.tsx migration. 6 bindings + legacy compatibility shim. | Foundation correct; one verification-command count is brittle (see warning 1). |
| **60-05** | 4 | `computeSelectionBounds` pure helper + `MultiSelectTypeBar` (Phase 60 minimal: count + breakdown + Delete) + union-AABB ring inside editable={true} branch + click-empty-canvas-clears + Shift-click toggle + PARITY-01 ring scan with teeth. | TPLREND-05 invariant honored structurally; bulk-delete UX is partial (see warning 2). |

---

## Critical-risk verification (all 8 PASS as planned)

1. **PARITY GATE (Plan 02)** — PASS. Plan 02 keeps `render-slide-satori.tsx:273-275` and `slide-preview.tsx:746-768` byte-untouched (only comment additions). The lazy initializer mints `slide.watermark` from legacy WITHOUT deleting `style_overrides.watermark`. Both legacy resolvers (`resolveWatermark` reads `style_overrides.hide_watermark`; `resolveForcedWatermark` reads `style_overrides.watermark`) continue to produce identical output. Free-tier `enabled=false STILL renders` round-trip is explicitly tested (Test 8 of adapter, Test 5 of parity).

2. **Selection state outside reducer history** — PASS. `useSelectionModel` uses `useState<string[]>` + `useState<string | null>`. Plan 04 wires keyboard handlers to `selection.replaceWith()`/`selection.clear()`/`selection.selectAll()` (setState calls). `editor-reducer.ts` contains zero selection references (the only "selection" hit in the reducer is an unrelated comment about future drag-between-slides analytics).

3. **TPLREND-05 invariant on Plan 05 ring** — PASS. Plan 05 explicitly places the ring "STRICTLY inside the editable=true branch (after line 946 `if (!editable)` check)". PARITY-01 Test in Plan 05 asserts `containerLocked.querySelector('[data-testid="multi-selection-ring"]')` is null when editable={false}. Defense-in-depth grep at verification step #6 also enforces source-level gating.

4. **Plan 04 isEditing guard on every binding** — PASS in spirit, **WARNING on count assertion**. Every binding's handler is guarded; the `≥6` count assertion is arithmetic-fragile (see Warning 1).

5. **PERF-01 single-dispatch contract** — PASS. `BULK_TRANSLATE` reducer case ends with one `return pushHistory(state, slides)`. Test 1 of Plan 03 Task 2 verifies past-array length delta is exactly 1.

6. **Plan 04 compatibility shim** — PASS. `legacySelectedTextBoxId` is derived from `selection.ids`; Plan 04 explicitly states "Other consumers keep their existing prop interface — Plan 04 only touches slide-editor.tsx." Plan 05 owns prop extensions for SlidePreview/TextEditorPanel.

7. **Watermark known-gaps documented** — PASS. Plan 03 reducer code: "Watermark: SKIPPED in Phase 60. Watermark.position is enum-only; freeform translation requires a future schema extension. Phase 62 (groups) or Phase 63 (alignment) will revisit. Known gap." Plan 05 `selection-bounds.ts` header: "Watermarks are SKIPPED — size is computed by resolveWatermark / resolveForcedWatermark at render time. Phase 62/63 revisit." Both plans' SUMMARY outputs propagate the gaps to Phase 62/63.

8. **No shortcut creep** — PASS. Plan 04 tinykeys map: `$mod+1/2/3`, `$mod+d`, `$mod+a`, `Escape`, `Delete`, `Backspace`. No Cmd+G (Phase 62), no z-order (Phase 64), no arrow nudge (Phase 66). The `e.metaKey || e.ctrlKey` substring removal is enforced by verification step #6.

---

## Verification dimensions (all 7 pass)

1. **Coverage** — 23/23 requirements mapped (PARITY-01 appears in both 60-02 seed and 60-05 teeth; this is intentional and correct).
2. **Atomicity** — Each plan = one logical commit. Each has an atomic commit message template.
3. **Dependency soundness** — DAG is acyclic. Wave 2 (Plan 02 || Plan 03) parallel-safe: ZERO file overlap (Plan 02 touches `watermark-adapter*`, `use-slide-editor.ts`, `render-slide-satori.tsx`, `slide-preview.tsx`, `parity.test.tsx`; Plan 03 touches `use-selection-model*`, `editor-actions.ts`, `editor-reducer.ts`, `editor-reducer.test.ts`).
4. **Test hooks** — Every plan has executable `<verify>` blocks; verification commands listed at plan-level. PARITY GATE has its own dedicated test file extension.
5. **Cross-phase constraints** — onDragStop only (no per-tick dispatches added); isEditing guard preserved + lifted to `keyboard-utils.ts` helper; `pushHistory` once per BULK_TRANSLATE; editable={true} gate honored; selection outside reducer; window.blur + visibilitychange wired; CSS uses `outline` not z-index for ring.
6. **No scope creep** — No marquee (Plan 05 keeps `onClick` not `onPointerDown`; explicit comment defers to Phase 61). No group ops (CONTEXT.md decisions §multi-drag dispatch line: "Phase 60 wires the action shape but does NOT trigger it from drag handlers yet"). No align/distribute behavior. No bulk-edit handlers in TYPE BAR (Phase 63).
7. **No scope shortfall** — Selection model exists (`Selection { ids, primary }` shape, ref-stable via `useMemo`). Schema fields exist (3 fields × 3 interfaces + Watermark + `Slide.watermark?`). Watermark unification: adapter ships, lazy initializer mints, both renderers see the unified slot present (read still goes through legacy slot for byte-identity — correct conservative choice).

---

## Warnings (must fix during execution; no re-planning needed)

### WARNING 1 — Plan 04 verification command #5 arithmetic
**File:** `60-04-PLAN.md` line 399 — `test "$(grep -c 'isEditingTarget(e.target)' src/components/editor/slide-editor.tsx)" -ge 6`

**Problem:** The plan body uses a `selectByIndex(idx)` helper that contains ONE `isEditingTarget` call covering 3 bindings ($mod+1/2/3). Combined with explicit guards in $mod+d, $mod+a, Escape, and `deleteSelected` (one helper covering Delete + Backspace), the actual grep count is 5, not ≥6. The behavior is correct (all bindings are guarded) but the assertion will fail.

**Fix during execution (executor's choice):**
- Option A: Inline the guard into each of the 6 bindings explicitly (drop the `selectByIndex` and `deleteSelected` helpers, accept ~10 LOC redundancy for verifiability).
- Option B: Change the verification command to `-ge 5` and update the success-criteria language.

Either path preserves KBD-02. Recommend Option A — explicit per-binding guards make the intent grep-visible and survive future binding additions without arithmetic drift.

### WARNING 2 — Plan 05 onBulkDelete is partial UX
**File:** `60-05-PLAN.md` Task 3 Step A (TextEditorPanel ternary)

**Problem:** The inline `onBulkDelete` handler iterates `ids` and only calls `onRemoveTextBox(id)` for `tb.role === 'custom'`. Hook/body text_boxes and custom_images are silently skipped. The Delete button still shows "Delete N elements" even when partial deletion will occur. The component test (Test 4 in Task 2) only verifies the callback receives the ids — not that all elements are actually deleted.

**Why it's a warning, not a blocker:** Phase 64 explicitly owns bulk-delete reducer wiring. Phase 60's TYPE BAR is intentionally minimal. But the button label is misleading.

**Fix during execution (executor's choice):**
- Option A: Hide the Delete button when selection includes non-custom text_boxes or custom_images (Phase 60 minimal — Delete only when N==N_custom_text_boxes).
- Option B: Wire `custom_images` deletion via the existing `onRemoveCustomImage` handler (likely already in TextEditorPanel's prop set). Hook/body skipped silently is fine (those don't have a deletion path in any phase).
- Option C: Rename label to "Delete custom text" when only custom-text-boxes will be removed; restore "Delete N elements" only when all N are deletable.

Recommend Option A — minimal-surface principle for Phase 60; full bulk-delete behavior lands in Phase 64.

---

## Risks the executor should watch for

1. **Plan 02 lazy-initializer ordering** — `migrateLegacySlides` must mint `slide.watermark` AFTER `legacyToTextBoxes` (which is unaffected by watermark). The plan's code uses `slideIndex` from `slides.map((slide, slideIndex) => ...)`. Verify the index passed to `legacyWatermarkToElement` is the array index of the post-migration array, not the pre-migration array. Both should be identical (additive migration), but worth a sanity check during execution.

2. **Plan 03 stale-id useEffect infinite loop risk** — The `useEffect` keyed on `[opts.presentSlides, opts.slideIndex]` calls `setIds(prev => filtered)` and `setPrimary(prev => ...)`. The `setIds` guard `return filtered.length === prev.length ? prev : filtered` prevents reference change when ids match. Verify the same guard is implicit in the setPrimary callback (it is — the lambda returns `prev` when valid). React will bail out of the second render. No loop expected, but Test 14 should pin this with a render counter.

3. **Plan 04 `currentSlide`/`removeTextBox` symbol availability** — The tinykeys handler closure assumes these symbols exist in scope at the existing useEffect site (lines 340-385 of slide-editor.tsx). The plan does not enumerate the existing local-binding context. If `removeTextBox` is not currently in scope at that exact line, the executor must hoist it or import it explicitly.

4. **Plan 04 `setLegacySelectedTextBoxId` shim consumer audit** — The shim exists for one-milestone bridge. `slide-editor.tsx:67` is mentioned as a current consumer. Executor should grep all consumers of `selectedTextBoxId` / `setSelectedTextBoxId` in `slide-editor.tsx` BEFORE removing the original `useState` call, and ensure each consumer continues to receive the same value via the shim.

5. **Plan 05 SlidePreview prop threading** — Plan 05 implicitly adds `selection?: Selection` and `onSelectionChange?` to SlidePreview's props. The executor must:
   - Update the SlidePreview props interface declaration.
   - Update slide-editor.tsx's `<SlidePreview ...>` JSX to pass the new props.
   - Ensure the props are optional so any other render sites of SlidePreview (e.g. in `parity.test.tsx`) don't fail TS.
   The plan calls this out at Step B but doesn't list slide-editor.tsx in `files_modified`. Add it during execution if the JSX site needs the prop pass-through.

6. **Plan 05 Shift-click handler signature** — The plan example uses `onSelectionChange((s: Selection) => ...)` (functional setter form). Plan 03's `useSelectionModel` exposes `replaceWith/addToSelection/removeFromSelection/toggleInSelection` as discrete methods, NOT a generic functional setter. Either:
   - Add a `setSelection` functional-setter prop alongside the discrete methods (extend `SelectionModel`), OR
   - Rewrite Plan 05's per-element click handler to use `selection.toggleInSelection(id)` for the Shift branch and `selection.replaceWith([id])` for the non-Shift branch.
   Recommend the second approach — the discrete API is the canonical one per Plan 03.

7. **`tinykeys` import path** — `import { tinykeys } from 'tinykeys'`. Verify this matches the package's actual export shape (named export vs default). Per RESEARCH `[VERIFIED: jamiebuilds/tinykeys README]`, tinykeys 3.0.0 ships a named export. Sanity-check at install time: `node -e "console.log(require('tinykeys'))"`.

8. **Plan 02 Test 8 `resolveForcedWatermark` import path** — The plan references `@/lib/render/resolve-forced-watermark`. Verify the alias is resolvable in the test environment (tsconfig.json paths). The test file is the first to import this module from a unit test; if the alias fails, fall back to a relative import.

9. **Plan 03 `validIds` set creation cost** — The prune effect creates a `Set` over text_boxes ∪ custom_images ∪ watermark on every `presentSlides` change. At v2.11's realistic ≤30 elements per slide, this is trivial, but every undo/redo dispatch retriggers the effect. No memo needed for Phase 60; flag for Phase 65 if profile shows it hot.

---

## Summary

The plan set is internally consistent, requirement-complete, dependency-sound, and respects every cross-phase constraint. The two warnings are surface-level mechanical issues that the executor can resolve in-flight without re-planning. Phase 60 is approved for execution.

**Proceed:** `/gsd-execute-phase 60`


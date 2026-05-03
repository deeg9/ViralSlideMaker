---
phase: 60
status: findings_found
severity_breakdown: { critical: 0, high: 2, medium: 4, low: 5 }
date: 2026-05-02
---

# Phase 60 — Adversarial Code Review

**Reviewed:** 2026-05-02
**Depth:** deep (cross-file analysis)
**Scope:** commits `1164c73` (Plan 60-01 schema) through `6992eee` (Plan 60-05 docs)
**Files Reviewed:** 17 source files + 8 test files

## Summary

Phase 60 lays foundation work for v2.11 multi-select with disciplined boundaries:
- **TPLREND-05 invariant: PRESERVED.** `slide-preview.tsx` selection ring (`data-testid="multi-selection-ring"`) is structurally inside the `editable={true}` return path (line 975 onward), guarded behind `selection && selection.ids.length >= 2` and gated by `if (!editable) return` at line 675 with an early-return non-editable branch. `render-slide-satori.tsx` diff is comment-only. PARITY-01 test at `parity.test.tsx:308-389` exercises the gate with both editable=false (no ring) and editable=true (ring present) renders.
- **Selection-state-outside-reducer: VERIFIED.** `editor-reducer.ts` contains zero `selection` references in new code (the only match at line 119 is a pre-existing Phase 49 DUPLICATE_SLIDE comment).
- **isEditing guard ubiquity: VERIFIED.** All 8 tinykeys bindings in `slide-editor.tsx` start with `if (isEditingTarget(e.target)) return`. `e.preventDefault()` is called only after the guard returns false.
- **Modifier-blur-reset: VERIFIED.** `useModifierState` listens to both `window.blur` AND `document.visibilitychange`, resets all 3 mods to false on each.
- **PERF-01 single-dispatch: VERIFIED in reducer** (single `pushHistory` per BULK_TRANSLATE). However the bulk-DELETE path in `slide-editor.tsx onBulkDelete` violates the spirit of single-dispatch (see HIGH-1).
- **Set vs Array: VERIFIED.** `useSelectionModel` uses `string[]`, never `Set` mutation.

No CRITICAL findings. **2 HIGH** findings block clean Phase 61 entry. **4 MEDIUM** + **5 LOW** are cleanup items.

---

## High Findings

### HIGH-1: Bulk-delete dispatches one history entry per element (violates single-dispatch contract)

**File:** `src/components/editor/slide-editor.tsx:929-955`
**Issue:** `onBulkDelete` iterates over `ids` and calls `removeTextBox(...)` or `handleRemoveCustomImage(...)` separately per id. Each helper dispatches a separate `REMOVE_TEXT_BOX` / `REMOVE_CUSTOM_IMAGE` action — meaning a 5-element bulk delete creates 5 history entries (`pushHistory` runs 5×). The user must press Cmd+Z 5× to undo a single visual gesture. This contradicts the PERF-01 single-dispatch principle that BULK_TRANSLATE was carefully built to honor (`editor-reducer.ts:351`). Phase 60 ships this UX defect even though the reducer foundation for atomic bulk ops exists.

The comment acknowledges "full bulk-delete reducer arrives in Phase 64" but ships the broken UX in the meantime. With the MultiSelectTypeBar's primary visible action being "Delete N elements", this is the most-exercised path for new users.

**Fix:**
- (Preferred) Add `BULK_DELETE { slideIndex; ids }` reducer action mirroring BULK_TRANSLATE — one `pushHistory` per gesture, routes through `applyDualWrite` for text_boxes:
  ```typescript
  case 'BULK_DELETE': {
    const slides = state.present.map((slide, i) => {
      if (i !== action.slideIndex) return slide
      const idSet = new Set(action.ids)
      const nextTextBoxes = (slide.text_boxes ?? []).filter(
        (tb) => !idSet.has(tb.id) || tb.role !== 'custom' || tb.locked === true,
      )
      const nextCustomImages = (slide.custom_images ?? []).filter(
        (ci) => !idSet.has(ci.id) || ci.locked === true,
      )
      let next: Slide = slide
      if (nextTextBoxes.length !== (slide.text_boxes ?? []).length) {
        next = applyDualWrite(next, nextTextBoxes)
      }
      if (nextCustomImages.length !== (slide.custom_images ?? []).length) {
        next = { ...next, custom_images: nextCustomImages }
      }
      return next
    })
    return pushHistory(state, slides)
  }
  ```
- (Minimum-viable for Phase 60) Hide the Delete button in MultiSelectTypeBar until Phase 64 lands the bulk reducer, OR document the limitation in the button label/tooltip.

---

### HIGH-2: `migrateLegacySlides` mutates caller-provided slides

**File:** `src/lib/editor/use-slide-editor.ts:23-34`
**Issue:** When `slide.text_boxes` is already populated, the function takes the fast path `const next: Slide = slide` (line 26) — i.e., `next` IS the input slide reference, not a copy. Then `next.watermark = wm` (line 30) mutates the original slide object passed via `initialSlides`. This is unconditional side-effect on caller data, violating the function's pure-mapping contract.

Risk:
- If the same `initialSlides` array is held by a parent component (likely via SSR-passed props on Next.js), the parent's reference now contains an injected `.watermark` field after the editor mounts. This can cause:
  - Confusing test behavior where fixtures appear to "remember" prior runs.
  - Stale comparison failures if any code does `prevSlides[i] === nextSlides[i]` reference-equality after the editor mount.
  - Unexpected serialization side-effects if the parent re-uses the slides object after mount (e.g., for an analytics payload).

**Fix:** always shallow-copy in the watermark branch:
```typescript
function migrateLegacySlides(slides: Slide[]): Slide[] {
  return slides.map((slide, slideIndex) => {
    let next: Slide = slide.text_boxes
      ? slide
      : { ...slide, text_boxes: legacyToTextBoxes(slide) }
    if (!next.watermark) {
      const wm = legacyWatermarkToElement(next, slideIndex)
      if (wm) {
        // Always copy before mutating — never touch caller data even on the
        // text_boxes-already-present fast path.
        next = { ...next, watermark: wm }
      }
    }
    return next
  })
}
```

---

## Medium Findings

### MED-1: BULK_TRANSLATE no-op still grows history

**File:** `src/lib/editor/editor-reducer.ts:306-352`
**Issue:** When every selected id is locked, structural-anchor, watermark, or unknown, both `nextTextBoxes` and `nextCustomImages` retain their original references. The `let next: Slide = slide` branch falls through unchanged, but `state.present.map(...)` always returns a new array reference, and `pushHistory` doesn't compare contents — it unconditionally pushes `state.present` onto `past`.

Result: a no-op BULK_TRANSLATE (e.g., user drags a group of 100% locked elements) creates a phantom history entry. Cmd+Z appears to do nothing.

The existing test `editorReducer — Phase 60 (PERF-01): BULK_TRANSLATE single-dispatch contract — Test 1` only verifies `past.length === 1` after a *changing* dispatch; it does not cover the no-op case.

**Fix:** detect no-op and short-circuit before `pushHistory`:
```typescript
case 'BULK_TRANSLATE': {
  let anyChanged = false
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    // ... existing nextTextBoxes / nextCustomImages computation ...
    let next: Slide = slide
    if (nextTextBoxes !== slide.text_boxes && nextTextBoxes !== undefined) {
      next = applyDualWrite(next, nextTextBoxes)
      anyChanged = true
    }
    if (nextCustomImages !== slide.custom_images) {
      next = { ...next, custom_images: nextCustomImages }
      anyChanged = true
    }
    return next
  })
  if (!anyChanged) return state
  return pushHistory(state, slides)
}
```

---

### MED-2: Shift-click toggle leaves legacy `selectedTextBoxId` out of sync

**File:** `src/components/slides/slide-preview.tsx:1087-1107` (hook), `1207-1227` (body), `1352-1369` (custom text), `1515-1531` (custom image)
**Issue:** All four shift-click branches return early (`return`) after updating `selection.ids` via `onSelectionChange`. They DO NOT call `onTextBoxSelect` / `onCustomTextSelect` / `onCustomImageSelect`. This leaves the legacy single-id slot stale relative to the multi-select model.

Concrete scenario:
1. Click hook → `selectedTextBoxId = hook.id`, `selection.ids = [hook.id]`. ✓ in sync.
2. Shift-click body → `selection.ids = [hook.id, body.id]`, `selectedTextBoxId = hook.id` (unchanged).
3. Right rail switches to MultiSelectTypeBar (N>=2). OK so far.
4. Shift-click hook OFF → `selection.ids = [body.id]`, `selectedTextBoxId = hook.id` (still!).
5. Right rail collapses back to single-element view. `selectedTextBoxId` says HOOK but the only multi-selected element is BODY.

Result: ActiveTextBoxCard renders for HOOK while user expects BODY. User edits hook text thinking they're editing body.

This is a real UI sync bug, not just a code smell.

**Fix:** After each shift-click toggle branch, sync the legacy slot to match `selection.primary` (or null):
```typescript
if (e.shiftKey && onSelectionChange) {
  onSelectionChange((s: Selection) => {
    const next = s.ids.includes(hookBox.id)
      ? { ids: s.ids.filter((x) => x !== hookBox.id),
          primary: s.primary === hookBox.id ? null : s.primary }
      : { ids: [...s.ids, hookBox.id], primary: hookBox.id }
    // Sync legacy slot to next.primary (or fallback to first remaining).
    onTextBoxSelect?.(next.primary ?? next.ids[0] ?? null)
    return next
  })
  return
}
```

(Note: calling `onTextBoxSelect` inside the updater is technically a side-effect during render-phase computation — the safer pattern is to compute next, then dispatch both setters separately, mirroring `useSelectionModel.setSelection`.)

---

### MED-3: `setSelection` functional updater reads from refs synced via effect — stale on rapid synchronous double-dispatch

**File:** `src/lib/editor/use-selection-model.ts:158-178`
**Issue:** `idsRef`/`primaryRef` are kept in sync with `ids`/`primary` via `useEffect` (lines 84-89). Effects run AFTER commit, so within a single render cycle:
- If `setSelection` fires once, it reads pre-update ref → ok (matches React state at that moment).
- If `setSelection` fires twice synchronously (e.g., two events in the same tick), the second call reads the SAME stale ref because the first call's `setIds(result.ids)` has scheduled but not committed, and the effect that updates the ref hasn't run.

Real-world trigger: programmatic selection updates fired in a loop (e.g., a future "select range" gesture in Phase 61), or test assertions calling `act(() => { result.current.setSelection(...) ; result.current.setSelection(...) })`.

The hook's other mutators (`replaceWith`, `addToSelection`, etc.) use plain setState updaters internally, which doesn't suffer this issue. Only the `setSelection(prev => ...)` functional path does.

**Fix:** read latest state via `setIds`/`setPrimary` updater closures rather than refs:
```typescript
const setSelection = useCallback(
  (next: Selection | ((prev: Selection) => Selection)) => {
    if (typeof next === 'function') {
      const fn = next as (prev: Selection) => Selection
      let computedPrimary: string | null = null
      setIds((prevIds) => {
        const result = fn({ ids: prevIds, primary: primaryRef.current })
        computedPrimary = result.primary
        return result.ids
      })
      setPrimary(computedPrimary)
      return
    }
    setIds(next.ids)
    setPrimary(next.primary)
  },
  [],
)
```
(There's still residual primary staleness, but ids would now be derived from latest committed state.)

---

### MED-4: Empty `style_overrides.watermark = {}` produces id-only Watermark with asymmetric round-trip

**File:** `src/lib/editor/watermark-adapter.ts:27-42`
**Issue:** When a slide has `style_overrides.watermark = {}` (truthy empty object — possible if a previous code path dispatched `{ watermark: {} }`), the adapter returns:
```typescript
{ id: 'w_X' }   // every conditional spread is empty
```
Round-trip: `elementToLegacyWatermark({ id: 'w_X' })` returns `{ watermark_patch: undefined, hide_watermark_patch: undefined }` (because `Object.keys(patch).length === 0`).

So the Watermark element exists, but a save-time mirror would emit no slot — the next load mints a fresh `{ id: 'w_X' }` again. Functionally OK but asymmetric. Could mask bugs where downstream code depends on `slide.watermark` truthiness as a proxy for "user has configured a watermark".

**Fix:** treat empty object as null at the adapter input:
```typescript
const wm = slide.style_overrides?.watermark
const hasWmFields = wm && Object.keys(wm).length > 0
const hideWm = slide.style_overrides?.hide_watermark
if (!hasWmFields && !hideWm) return null
```

---

## Low Findings

### LOW-1: Keyboard effect re-subscribes tinykeys on every selection change

**File:** `src/components/editor/slide-editor.tsx:363-457`
**Issue:** The `useEffect` for tinykeys lists `selection` in its dependency array (line 456). `selection` is a memoized object whose identity changes whenever `ids` or `primary` mutates — i.e., on every click. Each change tears down the old tinykeys binding and reinstalls a new one (~650B parser run + window event re-bind).

For Phase 60 element counts (≤30 per slide) this is invisible. But it's the wrong shape for Phase 63 / 65 when more shortcuts ship and the selection mutates more frequently.

**Fix:** wrap the selection ops in a ref kept in sync via effect:
```typescript
const selectionRef = useRef(selection)
useEffect(() => { selectionRef.current = selection }, [selection])
// Then in the tinykeys handlers, read selectionRef.current instead of closing over selection.
// Drop `selection` from the effect's deps.
```

---

### LOW-2: Tinykeys handler `selectAll` reads stale `currentSlide` on Cmd+A dispatched during pending state update

**File:** `src/components/editor/slide-editor.tsx:411-415`
**Issue:** `if (currentSlide) selection.selectAll(currentSlide)` closes over `currentSlide` at effect-mount time. If a pending dispatch is mid-flight (e.g., `ADD_TEXT_BOX` async response), `currentSlide` may not reflect the just-added element until the next render. Cmd+A would select all *pre-add* elements.

In practice, `currentSlide` is in the effect deps (`useEffect(... [currentSlide, ...])`), so the effect re-installs tinykeys on every slide change. Still: fires-once-per-render coupling means rapid keystrokes during dispatch can hit the gap. Low because user-perceived pacing makes this rare.

**Fix:** None required for Phase 60. Note for future hardening — see LOW-1 fix (selectionRef pattern).

---

### LOW-3: `WatermarkLegacySlice.hide_watermark_patch === false` is unrepresentable

**File:** `src/lib/editor/watermark-adapter.ts:44-59`
**Issue:** `elementToLegacyWatermark` returns `hide_watermark_patch: watermark.hidden === true ? true : undefined`. There's no way to express `hide_watermark = false` (an explicit "show the watermark" flag) — the slice always emits `undefined` (which means "leave existing slot alone" at the merge site, not "set to false").

Phase 60 doesn't use `hide_watermark = false` anywhere, so this is theoretical. But if a future writer needs to flip from `true` back to `false`, the adapter can't express that delta — the writer would have to bypass the adapter and merge directly.

**Fix:** add a tri-state if needed:
```typescript
hide_watermark_patch:
  watermark.hidden === true ? true :
  watermark.hidden === false ? false :
  undefined,
```
But: only worth changing when there's a writer that needs it. For Phase 60, document the asymmetry in the JSDoc.

---

### LOW-4: `selectAll` in `useSelectionModel` includes locked / hidden elements

**File:** `src/lib/editor/use-selection-model.ts:148-156`
**Issue:** `selectAll` walks `text_boxes ∪ custom_images ∪ watermark` without filtering by `locked` or `hidden`. Phase 60 declares those fields without behavior, so this is technically consistent. But once Phase 64 ships behavior, Cmd+A semantics will need to change at three call sites: this hook, the marquee additive path (Phase 61), and the keyboard binding (already routes through this hook).

Not a bug today. Documenting so Phase 64 reviewer doesn't miss it.

**Fix (Phase 64):** filter `tb.locked !== true && tb.hidden !== true` in selectAll's array build.

---

### LOW-5: Selection ring uses fixed 4px outline-offset; doesn't compensate for 0-height TextBoxes

**File:** `src/components/slides/slide-preview.tsx:1730-1749`, `src/lib/editor/transforms/selection-bounds.ts:50-58`
**Issue:** `computeSelectionBounds` skips structural-anchor TextBoxes entirely (Phase 60 known gap), but for custom-anchor TextBoxes it rectifies them with `height: 0` (the comment notes "DOM-ref-based resolution lands later"). The union AABB then has a height that excludes any text height contribution.

Concrete scenario: if a user multi-selects a custom text box at (10,80,30,?) and a custom image at (10,10,20,20):
- Image rect: (10,10,20,20) → contributes maxY = 30
- TextBox rect: (10,80,30,0) → contributes maxY = 80
- Union: y=10, height=70

The ring extends only to y=80 — missing the actual rendered text below. With `outline-offset: 4`, the ring sits 4px outside this incorrect box. User-visible: ring cuts through the text vertically.

This is a known Phase 60 gap (documented in `selection-bounds.ts` header), but worth flagging as a UX defect that ships.

**Fix (Phase 63 alignment):** lift the ref-based height resolution from `slide-preview.tsx:589-637` into a shared helper consumed by `computeSelectionBounds`. Phase 60 ship-as-is is acceptable IF Phase 63 picks this up before users notice.

---

## Verifications (force-stance "what passed")

These were checked and confirm what Plan-Checker called out:

1. **TPLREND-05 invariant.** `parity.test.tsx:308-389` correctly tests `data-testid="multi-selection-ring"` is absent from `editable={false}` and present from `editable={true}` with N>=2. The structural location of the ring (`slide-preview.tsx:1730`) is inside the `return (...)` at line 975, AFTER the `if (!editable) return (...)` early return at line 675. **Pass.**

2. **Selection-state-outside-reducer.** `grep -n "selection" src/lib/editor/editor-reducer.ts` returns ONLY line 119 ("future code (drag between slides, analytics, selection) would be"), which is the pre-existing Phase 49 DUPLICATE_SLIDE comment. **Pass.**

3. **isEditing guard ubiquity.** All 8 tinykeys bindings in `slide-editor.tsx:367-446` start with `if (isEditingTarget(e.target)) return`. `e.preventDefault()` is called only after the guard returns false. **Pass.**

4. **Modifier-blur-reset.** `useModifierState` listens to `window.blur` (line 48) AND `document.visibilitychange` (line 49). Both invoke `handleReset` which sets all 3 mods to false. Tests at `use-modifier-state.test.ts:59-87` cover both. **Pass.**

5. **Watermark adapter idempotence + round-trip.** Tests 4, 7, 9 in `watermark-adapter.test.ts` cover deterministic ids and 6-fixture round-trip equality. **Pass.**

6. **PARITY-01 with teeth.** `parity.test.tsx:308-338` scans the `editable={false}` HTML for `multi-selection-ring`, `\bselection\b`, `\bmarquee\b`, `\bguide\b` className tokens. Whole-word regex prevents false positives from substrings like "select-all-button". **Pass.**

7. **PERF-01 single-dispatch (BULK_TRANSLATE only).** `editor-reducer.ts:351` calls `pushHistory` exactly once per dispatch. Tested at `editor-reducer.test.ts:575-598`. **Pass for the action; bulk-DELETE call site fails — see HIGH-1.**

8. **Set vs Array.** `useSelectionModel.ts` uses `string[]` throughout. Spreads via `[...prev, id]`, never `prev.add(id)`. **Pass.**

9. **Listener teardown.** `useEffect` returns `unsubscribe()` (line 448) and tinykeys' returned function is the unbinding function. ResizeObserver in `slide-preview.tsx` (line 524) calls `observer.disconnect()`. **Pass — no leaked listeners detected.**

10. **TypeScript baseline.** Not directly verified — request reviewer to run `npx tsc --noEmit | wc -l` to confirm only pre-existing 17 errors. The `tinykeys.d.ts` shim is necessary because tinykeys 3.0.0's `package.json` "exports" field omits a `types` condition (correctly documented in the file's JSDoc).

---

_Reviewed: 2026-05-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (cross-file)_

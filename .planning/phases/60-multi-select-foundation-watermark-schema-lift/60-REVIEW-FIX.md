---
phase: 60
fixed_at: 2026-05-03T02:08:16Z
review_path: .planning/phases/60-multi-select-foundation-watermark-schema-lift/60-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 60: Code Review Fix Report

**Fixed at:** 2026-05-03T02:08:16Z
**Source review:** `.planning/phases/60-multi-select-foundation-watermark-schema-lift/60-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (HIGH-1, HIGH-2, MED-2)
- Fixed: 3
- Skipped: 0
- Phase 60 test suite: **22 files, 225 tests, all green** (no regressions)
- Baseline tsc errors: **17** (unchanged — pre-existing, unrelated to Phase 60)

Out-of-scope findings (MED-1, MED-3, MED-4, LOW-1..LOW-5) deferred to Phase 61
per fix scope. None were trivial 1-2 line free-fixes — each requires a
non-trivial code-shape change or schema decision.

## Fixed Issues

### HIGH-2: `migrateLegacySlides` mutates caller-provided slides

**Files modified:** `src/lib/editor/use-slide-editor.ts`
**Commit:** `01e1e51`
**Applied fix:** Switched `next` from `const` to `let`; in the watermark branch,
replaced the in-place `next.watermark = wm` assignment with a shallow copy
`next = { ...next, watermark: wm }`. Now the fast path (slide.text_boxes
already populated) no longer mutates caller data — `initialSlides` references
held by parent components stay pristine across editor mount.

### MED-2: Shift-click toggle leaves legacy `selectedTextBoxId` out of sync

**Files modified:** `src/components/slides/slide-preview.tsx`
**Commit:** `5970a90`
**Applied fix:** All four shift-click branches (hook, body, custom text,
custom image) now use a compute-then-dispatch pattern: compute the next
Selection from `prev`, call `onTextBoxSelect(next.primary ?? next.ids[0] ?? null)`
to keep the legacy single-id slot in sync with the multi-select model, then
return `next`. Right rail's ActiveTextBoxCard now tracks correctly when N
transitions 2→1 — no more "user edits hook thinking they're editing body"
scenario described in the review.

Custom-text and custom-image branches deliberately skip `onCustomTextSelect`
and `onCustomImageSelect` (the two type-specific legacy slots) because the
post-toggle primary may be a different element type. Touching only the
unified `selectedTextBoxId` (which is what drives the right-rail card)
is the minimal correct fix.

### HIGH-1: Bulk-delete creates N history entries

**Files modified:**
- `src/lib/editor/editor-actions.ts`
- `src/lib/editor/editor-reducer.ts`
- `src/components/editor/slide-editor.tsx`

**Commit:** `a4d7cae`
**Applied fix:** Added a new `BULK_DELETE { slideIndex; ids }` action mirroring
`BULK_TRANSLATE` shape. New reducer case calls `pushHistory` exactly once per
gesture and routes text_boxes through `applyDualWrite` so legacy slide fields
stay in lock-step (BL-01). Reducer preserves the prior loop's policy:
- text_boxes with `role !== 'custom'` are kept (hook/body non-deletable),
- elements with `locked === true` are kept (Phase 64 honor; matches
  BULK_TRANSLATE precedent),
- watermark is never touched (lives on `slide.watermark`, separate slot).

`slide-editor.tsx onBulkDelete` now dispatches one `BULK_DELETE` and clears
the legacy single-id slots (`selectedTextBoxId` / `selectedCustomTextId` /
`selectedCustomImageId`) at the call site if any of them pointed at a deleted
element — replicating the cleanup the per-id `removeTextBox` helper used to
perform internally. A 5-element bulk delete is now one Cmd+Z, not five.

## Skipped Issues

None.

## Verification

- `npx vitest run src/lib/editor/ src/components/editor/ src/lib/render/__tests__/parity.test.tsx` → **22 files, 225 tests passing** (baseline preserved).
- `npx tsc --noEmit | grep -c 'error TS'` → **17** (baseline preserved; none of the 17 are in files I touched).
- All three commits build cleanly atop `main` (commits in order: `01e1e51`, `5970a90`, `a4d7cae`).
- Logic-bug surface: HIGH-1 introduces a new reducer action; semantic
  correctness was verified by reading the existing per-id loop policy and
  matching it field-for-field. The existing `BULK_TRANSLATE` test pattern
  (Test 1 — `past.length === 1` after one dispatch) would naturally extend
  to BULK_DELETE in a Phase 61 follow-up; no test was added in this phase
  because the user-visible behavior of the deletion itself (which elements
  get removed) is unchanged from pre-fix, only the history depth differs.

---

_Fixed: 2026-05-03T02:08:16Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

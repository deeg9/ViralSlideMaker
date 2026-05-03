# Phase 60 — Deferred Items

Out-of-scope discoveries logged during plan execution. Each item lists the
discovering plan, the file/area, what was found, and which downstream plan
should pick it up.

## During Plan 60-02 execution (2026-05-03)

### Pre-existing uncommitted Plan 60-03 BULK_TRANSLATE work in working tree

- **Files modified (uncommitted):** `src/lib/editor/__tests__/editor-reducer.test.ts`,
  `src/lib/editor/editor-actions.ts`, `src/lib/editor/editor-reducer.ts`
- **State at plan-02 start:** Working tree had 4 staged-but-uncommitted diffs
  pre-existing from a prior aborted Plan 60-03 attempt. Plan 60-03 already
  shipped its T1 (commit `082bfe9 feat(60-03/t1): useSelectionModel hook + 17
  unit tests`); these uncommitted diffs appear to be a partial Plan 60-03 T2
  (BULK_TRANSLATE reducer case) that was not finished.
- **Test failures observed:** Running `vitest src/lib/editor/` shows 4 failing
  BULK_TRANSLATE tests in editor-reducer.test.ts — these failures stem from
  the partial implementation, NOT from any Plan 60-02 change. Confirmed via
  `git stash` baseline comparison: with the orphaned diffs stashed, the
  editor-reducer test suite passes 26/26.
- **Resolution path:** Plan 60-03 owner should either (a) finish the BULK_TRANSLATE
  reducer implementation to make the tests pass, or (b) reset the working tree
  to drop these orphaned diffs and re-implement under Plan 60-03's owned scope.
- **Plan 60-02 impact:** ZERO. Plan 60-02 changes are isolated to
  `watermark-adapter.ts`, `watermark-adapter.test.ts`, `use-slide-editor.ts`
  (lazy init), `render-slide-satori.tsx` (comment only), `slide-preview.tsx`
  (comment only), and `parity.test.tsx` (5 new tests). All Plan 60-02 commits
  pass clean verification.
- **Resolved 2026-05-02 by Plan 60-03 T2 commit:** BULK_TRANSLATE reducer case +
  EditorAction variant + 9 reducer tests all green (35/35 reducer tests pass).
  No further action required.

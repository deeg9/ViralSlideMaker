# Deferred Items — quick-260515-k54

Out-of-scope discoveries logged during execution. NOT fixed (pre-existing,
unrelated to this task's changes).

## Pre-existing test failures (slide-number badge)

Two slide-preview test files contain stale assertions for the per-slide
"Slide N of M" corner badge that was removed by quick task 260515-k35
(commit ab2841b). They fail at this task's base commit (9d4469d) WITHOUT
any of this task's changes — confirmed via `git stash` baseline check.

- `src/__tests__/components/slide-preview.test.tsx` — 1 failing test
- `src/__tests__/editor/slide-preview.test.tsx:77` — `getByText('Slide 2 of 3')`

These belong to the 260515-k35 cleanup scope (its SUMMARY claimed
`slide-preview.test.tsx` passes — but the `src/__tests__/...` copies were
not updated). A follow-up quick task should delete/invert these stale
badge assertions.

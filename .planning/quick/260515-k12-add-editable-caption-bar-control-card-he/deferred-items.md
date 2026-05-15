# Deferred Items — quick-260515-k12

Out-of-scope discoveries logged during execution. NOT fixed by this task
(SCOPE BOUNDARY rule — only auto-fix issues directly caused by this task's changes).

## Pre-existing stale render snapshots (124 failures)

**Discovered during:** Task 1 verification.

**Affected suites:**
- `src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx` — 48 snapshot failures
- `src/lib/render/__tests__/parity.template-fingerprint.test.tsx` — ~52 snapshot failures
- `src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx` — ~24 snapshot failures

**Root cause:** quick-260514-l9q (`de338e2`) added a `justify-content` property to
the hook/body flex wrappers via `alignToJustifyContent`, but the committed `.snap`
fixtures were never regenerated. The stored snapshots pre-date l9q and lack
`justify-content: flex-start;` on the hook `<div>`.

**Proof it is pre-existing (NOT caused by k12):** Running these suites against the
clean base commit `586a2d0` with all k12 changes stashed produces the EXACT same
124 failures. The `data-testid="bottom-card"` div — the only element k12 touches —
renders byte-identical (`position: absolute; left: 0px; right: 0px; bottom: 0px;
height: 38%; padding: 80px; background-color: rgba(0, 0, 0, 0.85); z-index: 2;`)
in Expected vs Received. The only diff is the `justify-content` line on the hook
text wrapper.

**Why not fixed here:** Regenerating the snapshots is a separate concern from the
caption-bar control card; doing so would conflate an unrelated l9q snapshot-debt
cleanup with this task and obscure the k12 diff in review. The TPLREND-05 invariant
for the caption bar is independently proven by the new
`caption-bar-overrides.test.ts` byte-identity case.

**Recommended follow-up:** A standalone quick task to run
`npx vitest run src/lib/render/__tests__/parity.template-fingerprint.test.tsx
src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx
src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx -u`
and commit the regenerated `.snap` files, after a visual check that the only delta
is the `justify-content` addition from l9q.

## Pre-existing lint errors (4)

**Discovered during:** Task 2 `npm run lint` verification.

**Affected file:** `src/lib/validators/__tests__/style-spec.test.ts` (lines 29, 30, 43, 56)

**Errors:** `@typescript-eslint/no-require-imports` — 4 `require()`-style imports.

**Proof it is pre-existing (NOT caused by k12):** `npm run lint` reports the
identical `119 problems (4 errors, 115 warnings)` on the clean base commit
`73a0173` with k12 changes stashed. The k12-touched files
(`caption-bar-controls.tsx`, both new test files, `resolve-overlay.ts`,
`elements-panel.tsx`, `editor-reducer.ts`, `editor-actions.ts`, `slide.ts`)
introduce 0 errors and 0 new warnings — the 3 brand-new files are entirely
lint-clean.

**Why not fixed here:** `style-spec.test.ts` is a v2.13 schema-validator test
file unrelated to the editor caption-bar surface. Out of scope.

**Recommended follow-up:** Convert the 4 `require()` calls to ESM `import`
statements in a standalone cleanup task.

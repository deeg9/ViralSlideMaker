# Deferred Items — quick-260515-nhf

Out-of-scope discoveries logged during execution. NOT fixed by this quick task.

## Pre-existing stale parity snapshots (124 failing snapshots, 3 files)

**Discovered during:** Task 2 verification run.

**Files:**
- `src/lib/render/__tests__/parity.template-fingerprint.test.tsx` (28 snapshots)
- `src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx`
- `src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx`

**Root cause (NOT this task):** The committed snapshots predate quick task
`260514-l9q` (commit `de338e2`), which added `justify-content: <align>` to the
Satori hook/body styles via the `alignToJustifyContent` helper. That code change
shipped but the affected `parity.*` fingerprint/baseline snapshots were never
regenerated. The snapshot diff is a single added token `justify-content:flex-start;`
on the hook + body `<div>` styles.

**Proof this is pre-existing, not caused by quick-260515-nhf:** Running the
exact same test set with the nhf changes `git stash`ed produces the IDENTICAL
failure count — 124 failed / 496 passed / 3 test files — before and after the
nhf changes. The nhf hook-typography rewiring introduces ZERO new snapshot
divergence (the 124→124 invariant is itself the TPLREND-05 byte-identity proof
for legacy no-override slides).

**Why not fixed here (SCOPE BOUNDARY):** These failures are not caused by the
current task's changes. Regenerating them would bless a `justify-content` diff
that belongs to `260514-l9q`, conflating two quick tasks' histories.

**Recommended follow-up:** A standalone quick task to run
`npx vitest run src/lib/render/__tests__/parity.template-fingerprint.test.tsx \
 src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx \
 src/lib/render/__tests__/parity.style-spec-absent-baseline.test.tsx -u`
and commit the regenerated snapshots, attributed to closing the l9q snapshot gap.

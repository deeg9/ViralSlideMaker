# Deferred Items — quick-260518-8o0

Out-of-scope discoveries logged during execution. NOT fixed by this task
(Scope Boundary: only auto-fix issues directly caused by this task's changes).

## Pre-existing `tsc --noEmit` errors (19 total)

Present on the clean base commit `f3a614c` BEFORE any quick-260518-8o0 change.
All in test files unrelated to the render/caption-card paths this task touches:

- `src/__tests__/auth/signup.test.ts` — Mock-typing (`Mock<Procedure | Constructable>` not callable)
- `src/__tests__/projects/crud.test.ts` — same Mock-typing issue
- `src/__tests__/stripe/sync-subscription.test.ts` — `upsert` not on mock type
- `src/components/editor/__tests__/slide-editor.treatment-sync.test.tsx` — spread-arg tuple
- `src/lib/legal/__tests__/audit-log.test.ts` — `error` not on `RecordTosAcceptanceResult`
- `src/lib/services/__tests__/projects-delete.test.ts` — Mock generic variance

Verified: `git stash` → `tsc` → 19 errors; restored → `tsc` → 19 errors.
This task adds ZERO new type errors. Out of scope — not fixed here.

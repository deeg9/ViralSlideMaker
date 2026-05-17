# Deferred Items — quick-260517-jfg

## Pre-existing baseline (NOT introduced by this task)

The plan documents a known baseline of ~19 tsc errors + ~18 stale render-snapshot
+ ~16 stale editor-fixture failures, all unrelated to this task.

Observed during execution:

- `npx tsc --noEmit` → exactly **19** `error TS` lines — matches the documented
  baseline. **0 new errors** introduced by this plan.
- `npm run lint:gates` → green (PARITY-05 closed-enum, token-budget, framing).
- Stale render-snapshot / editor-fixture suites were not run (the plan only
  requires the targeted unit suite); not chased per the task constraints.

No new failures attributable to this task. Nothing to fix here.

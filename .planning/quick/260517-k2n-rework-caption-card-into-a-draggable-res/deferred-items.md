# Deferred Items — quick-260517-k2n

Out-of-scope, pre-existing failures discovered during execution. NOT fixed —
all verified to exist at the plan base commit `d10bb44` and unrelated to the
caption-card rework. Recorded per the plan's known-baseline constraint.

## Pre-existing tsc errors (~19, baseline)

`npx tsc --noEmit` reports 19 `error TS` entries at the plan base commit and
still 19 after this task — ZERO new tsc errors introduced. Not investigated;
unrelated to caption-card files.

## Pre-existing editor-suite test failures (16)

Verified to fail identically at the plan base commit `d10bb44` (ran the four
files against the untouched base — 16 failed there too). Unrelated to this
task; not fixed.

- `src/components/editor/__tests__/phase-70-final-regression-sweep.test.ts`
  — 5 failures (tsc-baseline assertion, missing Phase 70 SUMMARY/REQUIREMENTS
  doc references).
- `src/components/editor/__tests__/slide-editor.treatment-sync.test.tsx`
  — 3 failures (treatment dispatch sync).
- `src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx`
  — 4 failures (watermark broadcast).
- `src/components/editor/__tests__/text-editor-panel.regression.test.tsx`
  — 4 failures (LayerStrip DOM-signature regression).

## NOT deferred — render-snapshot failures were IN-SCOPE and fixed

The plan's constraint mentioned "~18 stale render-snapshot" failures as a
pre-existing baseline. On investigation those snapshot files (`parity.
style-spec-absent-baseline`, `parity.template-fingerprint-decorations-undefined`,
`parity.template-fingerprint`) actually PASSED at the plan base commit — they
became stale ONLY because this rework intentionally removed the always-on k12
bottom-card on `magazine-bold` / `tr3nding-news` (key_decision 2: the caption
card is now gated on `caption_bar_enabled`). The 20 affected snapshots were
regenerated as part of Task 4 (commits `37a389b`, `84f3c15`); the diff is
exclusively the removed `bottom-card` div, no other template fingerprint
changed. The full render suite is 569/569 green after this task.

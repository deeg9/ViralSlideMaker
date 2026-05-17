# Deferred items — quick-260517-iiy

These are PRE-EXISTING failures unrelated to this task. The plan explicitly
documented a baseline of ~19 tsc errors + stale render-snapshot / editor-fixture
failures. They were confirmed present on the clean base commit
(`b2bdf1313e67ea23da088e29b6009b0cb04f1863`) BEFORE any iiy change. Not fixed
here — out of scope.

## Pre-existing tsc errors (19, baseline held)

19 errors in test files (vitest `Mock` typing, Supabase fake-builder shapes,
legal audit-log result types). None in `src/` runtime code touched by this task.
Confirmed: `npx tsc --noEmit | grep -c 'error TS'` == 19 both before and after.

## Pre-existing render-snapshot / regression failures (18)

Verified pre-existing — clean base run produced 24 failures (18 of these + the
6 RED tests from this task's d426d8f commit, which are now GREEN). After this
task's GREEN implementation the count is 18 — i.e. ZERO new failures introduced.

Failing files:
- `src/__tests__/render/legacy-templates-byte-identical.test.ts` — news-drop / news-cyan JSON hash drift
- `src/__tests__/render/legacy-templates-regression.test.tsx` — highlight-bar / news-drop / news-cyan / y2k-pop / bold-yellow v2.6 baseline
- `src/__tests__/render/premium-templates.test.tsx` — magazine-bold / tr3nding-news Satori snapshots
- `src/__tests__/render/render-slide-satori.test.tsx` — 9 Phase-45 overlay-composition snapshots

Root cause (per STATE.md): the quick-260515-o75 hook-casing WYSIWYG change
flipped the default hook `textTransform` from the template's `hookStyle` to
`'none'`, intentionally changing legacy hook CASING. The committed snapshots /
byte-identity fixtures still carry the old `textTransform: 'uppercase'` and were
never regenerated. TPLREND-05 byte-identity is explicitly NOT claimed for hook
casing post-o75. These snapshots need a separate regeneration pass — out of
scope for iiy.

## Pre-existing editor-suite failures (16)

Verified identical (16 failed / 11 passed) on the clean base commit
`b2bdf13` for the four files below — ZERO new failures from this task.

- `src/components/editor/__tests__/phase-70-final-regression-sweep.test.ts` —
  5 tests asserting Phase 70 SUMMARY/BUNDLE-DELTA docs + a ≤17 tsc-error
  ceiling. Stale meta-checks (current tsc baseline is 19, not ≤17). Doc/meta
  drift, not runtime.
- `src/components/editor/__tests__/slide-editor.treatment-sync.test.tsx` —
  3 tests; the file also carries a pre-existing tsc error TS2556 (spread arg).
- `src/components/editor/__tests__/slide-editor.watermark-sync.test.tsx` —
  4 watermark-broadcast tests.
- `src/components/editor/__tests__/text-editor-panel.regression.test.tsx` —
  4 Phase-50 LayerStrip DOM-signature tests.

All pre-date iiy and are unrelated to its 4 changes. Out of scope.

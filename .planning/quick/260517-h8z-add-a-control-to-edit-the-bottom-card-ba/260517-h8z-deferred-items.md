# Deferred items — discovered during quick-260517-h8z execution

## Pre-existing render snapshot failures (NOT caused by this task)

18 render snapshot tests fail on the clean base commit `f1184fe` (verified by
stashing the h8z changes and re-running). The diff is the removal of
`textTransform: "uppercase"` from Satori element-tree snapshots — a side effect
of the recent WYSIWYG hook-casing change (`quick-260515-o75`, commits
`b2184d8` / `a485885` / `4405047`). The committed `.snap` fixtures and the
`legacy-templates-byte-identical` JSON hash fixtures were not regenerated.

Affected suites:
- `src/__tests__/render/render-slide-satori.test.tsx` (9)
- `src/__tests__/render/legacy-templates-regression.test.tsx` (5)
- `src/__tests__/render/legacy-templates-byte-identical.test.ts` (2)
- `src/__tests__/render/premium-templates.test.tsx` (2)

These are OUT OF SCOPE for h8z (SCOPE BOUNDARY — pre-existing failures in
unrelated files). The h8z `background_color` override changes do NOT touch hook
casing and do NOT alter these snapshots. Resolution: regenerate the stale
snapshot/hash fixtures in a follow-up tied to `quick-260515-o75`.

## Pre-existing editor test failures (NOT caused by this task)

16 editor tests fail on the clean base commit `f1184fe` (verified by stashing
the h8z changes and re-running). They are unrelated doc-fixture / regression /
treatment-sync / watermark-sync failures:

- `phase-70-final-regression-sweep.test.ts` (5) — stale SUMMARY/REQUIREMENTS
  fixtures + a `tsc baseline ≤ 17 errors` assertion that the project has
  drifted past (baseline is now 19, documented in the h8z PLAN.md).
- `slide-editor.treatment-sync.test.tsx` (3) — pre-existing tsc spread-arg type
  break (`slide-editor.treatment-sync.test.tsx(46,74)`).
- `slide-editor.watermark-sync.test.tsx` (4).
- `text-editor-panel.regression.test.tsx` (4) — LayerStrip DOM-signature drift.

The h8z `SlideBackgroundControls` + `elements-panel.tsx` mount changes do NOT
touch any of these surfaces. The new `slide-background-controls.test.tsx` suite
(7 tests) is fully green. Resolution: separate fixture-refresh task.

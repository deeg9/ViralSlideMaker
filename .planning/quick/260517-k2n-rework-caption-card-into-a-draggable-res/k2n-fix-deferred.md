# k2n-fix — Deferred Items

Pre-existing test failures deliberately left untouched by the
`test(quick-260517-k2n-fix)` pass. Each was verified to fail identically at the
clean base commit `513d0b1` (i.e. NOT caused by the k2n caption-card rework).
Per the FIX-pass scope, these are out of scope for this task.

## Stale quick-260515-o75 hook-casing render snapshots (4 failures)

`src/__tests__/render/legacy-templates-regression.test.tsx`
- `bold-yellow: renders byte-identical to v2.6 baseline`
- `highlight-bar: renders byte-identical to v2.6 baseline`
- `news-drop: renders byte-identical to v2.6 baseline`
- `y2k-pop: renders byte-identical to v2.6 baseline`

Cause: quick-260515-o75 flipped the runtime `textTransform` default to WYSIWYG
(no forced uppercase) but did not regenerate
`__snapshots__/legacy-templates-regression.test.tsx.snap`. The committed
snapshot still expects `"textTransform": "uppercase"`. The diff is EXCLUSIVELY
the `textTransform` line — no caption-card / bottom-card content. This snapshot
file has zero k2n-attributable change, so it was reverted and left stale.

Resolution: a future o75 snapshot-cleanup pass should run
`vitest -u src/__tests__/render/legacy-templates-regression.test.tsx`.

## Pre-existing baseline failures unrelated to k2n (3 failures)

- `src/__tests__/components/slide-preview.test.tsx`
  > SlidePreview > applies template textColor and fontFamily as inline styles
- `src/__tests__/components/template-picker.test.tsx`
  > <TemplatePicker> TPLTHUMB-02 parity > renders visible Phase 56 templates
    (editorial-serif, notes-app-chic) as SlidePreview tiles, not swatch fallback
- `src/__tests__/render/legacy-templates-byte-identical.test.ts`
  > legacy 5 templates remain byte-identical (Phase 55 regression guard)
    > news-drop: JSON.stringify hash matches committed fixture

All three fail identically at clean base `513d0b1` (verified by stashing the
k2n-fix changes and re-running). These belong to the documented baseline of
~16 stale editor-fixture / hook-casing failures and the ~19 tsc-error baseline
that the FIX-pass scope explicitly excludes.

## tsc baseline

`npx tsc --noEmit` reports 19 errors — unchanged from the base. None are in any
file touched by this FIX pass. No new type errors were introduced.

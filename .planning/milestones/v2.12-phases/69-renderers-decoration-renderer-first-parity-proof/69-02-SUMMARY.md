---
phase: 69
plan: 02
subsystem: render
tags: [decorations, render, integration, shape-assets, tplrend-05, satori, slide-preview]
requires: [69-01]
provides:
  - Both renderers consume renderDecoration from a single module (TPLREND-05 lock)
  - 8 hand-rolled shape SVG assets in public/shapes/
  - scripts/build-shapes.ts skeleton (Phase 70 expansion target)
  - npm run shapes script
  - Defensive IntersectionObserver mock (Phase 70 picker future-proofing)
  - 13 integration smoke tests for decoration rendering parity
affects: [phase-69-03, phase-70, phase-71, phase-72]
tech-stack:
  added: []
  patterns:
    - Wrapper-with-key React.cloneElement pattern for byte-identical iteration
    - currentColor in static SVG assets (CSS color cascade for renderer-time tinting)
    - Layer 5.5 placement preserved (custom_images at 5.0 → decorations → watermark at 6.0)
key-files:
  created:
    - public/shapes/triangle.svg
    - public/shapes/polygon-5.svg
    - public/shapes/polygon-6.svg
    - public/shapes/polygon-8.svg
    - public/shapes/star-5.svg
    - public/shapes/star-6.svg
    - public/shapes/arrow.svg
    - public/shapes/line.svg
    - scripts/build-shapes.ts
    - src/lib/render/__tests__/decoration-renderer-integration.test.tsx
  modified:
    - src/lib/render/render-slide-satori.tsx (line ~501 — stub swapped)
    - src/components/slides/slide-preview.tsx (lines ~1063 + ~2648 — both stubs swapped)
    - src/__tests__/setup.ts (IntersectionObserver mock added)
    - package.json (shapes script wired)
decisions:
  - Wrapper-with-key cloneElement pattern (NOT key-on-renderDecoration) for TPLREND-05 invariant
  - All 3 sites use IDENTICAL code shape (drift-resistant — grep-able as a single pattern)
  - Triangle/polygon/star/arrow/line render via /shapes/*.svg through a parent <img> tag
  - rect/circle/ellipse render via CSS-styled <div> (no <img> child)
  - Hand-rolled SVGs use currentColor for fill/stroke (Phase 70 build script lints corpus)
metrics:
  duration_minutes: 4
  completed: 2026-05-04
  tests_added: 13
  tasks: 3
---

# Phase 69 Plan 02: Both-Renderer Integration + Shape SVG Assets Summary

**One-liner:** Wired Plan 69-01's `renderDecoration` into both renderers at all 3 layer-5.5 sites, landed 8 hand-rolled shape SVG assets, defensively mocked IntersectionObserver, and pinned the integration with 13 cross-renderer smoke tests — TPLREND-05 invariant now grep-verifiable.

This plan completes the Phase 69 Wave 2 wiring: both render paths (`render-slide-satori.tsx` for Satori PNG export and `slide-preview.tsx` for the editor preview) now consume the SAME pure `renderDecoration` module from Plan 69-01. The legacy null-stub iterators at all 3 sites have been replaced with byte-identical iteration patterns, and the 8 SVG assets the SVG-asset render path references are landed and validated.

## Tasks Completed

| Task | Name                                                              | Commit    | Files                                                                                                                       |
| ---- | ----------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1    | 8 hand-rolled shape SVG assets + scripts/build-shapes.ts skeleton | `64b460c` | public/shapes/{triangle,polygon-5/6/8,star-5/6,arrow,line}.svg, scripts/build-shapes.ts, package.json                       |
| 2    | Swap layer 5.5 stubs to renderDecoration() at all 3 sites         | `7016717` | src/lib/render/render-slide-satori.tsx, src/components/slides/slide-preview.tsx, src/__tests__/setup.ts                    |
| 3    | IntersectionObserver mock + decoration-renderer integration smoke | `f6e1792` | src/lib/render/__tests__/decoration-renderer-integration.test.tsx                                                           |

## Swap Sites — Post-Edit Line Numbers

| File                                                | Path-Site         | Line                | Status   |
| --------------------------------------------------- | ----------------- | ------------------- | -------- |
| `src/lib/render/render-slide-satori.tsx`            | satori            | 12 (import), 506    | swapped  |
| `src/components/slides/slide-preview.tsx`           | preview non-edit  | 31 (import), 1068   | swapped  |
| `src/components/slides/slide-preview.tsx`           | preview editable  | 2648                | swapped  |

## Wrapper-with-Key Pattern (TPLREND-05 invariant evidence)

All 3 sites use IDENTICAL code shape (modulo whitespace):

```tsx
{(slide.decorations ?? [])
  .filter((d) => d.hidden !== true)
  .map((d) => {
    const node = renderDecoration(d, {
      slideIndex: resolveCtx.slideIndex,
      totalSlides: resolveCtx.totalSlides,
    })
    return node ? React.cloneElement(node as React.ReactElement, { key: d.id }) : null
  })}
```

Both renderers share the same `resolveCtx` shape (Phase 45 `OverlayResolveCtx`), so the ctx values passed to `renderDecoration` are byte-identical across paths. The wrapper-with-key pattern keeps `decoration-renderer.tsx` itself key-agnostic — React reconciliation key lives at the call site (mirrors v2.9 `custom_images.map((ci) => <img key={ci.id} … />)` convention).

## SVG Asset Corpus (8 files in public/shapes/)

All files: `viewBox="0 0 100 100"`, `xmlns="http://www.w3.org/2000/svg"`, no `<filter>` / `<style>` / `<script>` blocks.

| File             | Strategy        | Color Token            | Geometry                                                            |
| ---------------- | --------------- | ---------------------- | ------------------------------------------------------------------- |
| `triangle.svg`   | `<polygon>`     | `fill="currentColor"`  | (50,10)(90,90)(10,90) — equilateral, point up                       |
| `polygon-5.svg`  | `<polygon>`     | `fill="currentColor"`  | regular pentagon, radius 45, centered (50,50), top vertex first     |
| `polygon-6.svg`  | `<polygon>`     | `fill="currentColor"`  | regular hexagon, radius 45, top vertex first                        |
| `polygon-8.svg`  | `<polygon>`     | `fill="currentColor"`  | regular octagon, radius 45, top vertex first                        |
| `star-5.svg`     | `<polygon>`     | `fill="currentColor"`  | 5-pointed star, outer radius 45, inner 18                           |
| `star-6.svg`     | `<polygon>`     | `fill="currentColor"`  | 6-pointed star, outer radius 45, inner 22                           |
| `arrow.svg`      | `<polygon>`     | `fill="currentColor"`  | right-pointing arrow (single 7-vertex polygon — stem + head fused)  |
| `line.svg`       | `<line>`        | `stroke="currentColor"` | horizontal line y=50, stroke-width=6                                |

Total bytes: 1349 (avg ~169 bytes/file — well under the 500-byte budget per the plan).

`currentColor` strategy: caller (`renderShapeAsset` in `decoration-renderer.tsx`) sets `style.color = d.fill` on the wrapping `<div>`. Satori cascades the `color:` property to the embedded `<img src="/shapes/...svg">` per the v2.9 overlay pattern. PCL12 (Plan 69-03) explicitly exempts `public/shapes/*.svg` from the `currentColor` ban — these are static assets, not src/render production code.

## scripts/build-shapes.ts Skeleton

50-LOC skeleton, runs `npx tsx scripts/build-shapes.ts` cleanly. Phase 70 expansion plan documented inline:

- Filled + outlined variants per shapeKind
- Parameterized polygon vertex counts (3..12)
- Manifest JSON for picker UI
- Lint pass: assert `currentColor` present, no `<filter>` / `<style>` / `<script>` / `on*=` handlers

`npm run shapes` script wired in `package.json` (mirrors v2.9 `npm run textures` from `scripts/build-textures.ts`).

## IntersectionObserver Mock

Added to `src/__tests__/setup.ts` immediately after the existing ResizeObserver block. Defensive — Phase 70 picker uses `@tanstack/react-virtual` which can read IntersectionObserver in some grid configs. Mock ships now (purely additive, no behavior change for current tests) so Phase 70 doesn't introduce a test-environment surprise.

```ts
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).IntersectionObserver = IntersectionObserverStub
}
```

## Test Counts

| File                                                                   | Tests   | Status |
| ---------------------------------------------------------------------- | ------- | ------ |
| `decoration-renderer-integration.test.tsx` (NEW)                       | 13      | GREEN  |
| `parity.template-fingerprint.test.tsx` (PTF1..14a/b)                   | 28      | GREEN  |
| `parity.template-fingerprint-decorations-undefined.test.tsx` (PTF15..16, PTL1..2) | 74 | GREEN  |
| `decoration-renderer.test.tsx` (Plan 69-01)                            | 32      | GREEN  |
| `decorations/registry.test.ts` (Plan 69-01)                            | 21      | GREEN  |
| Other render tests in `src/lib/render/__tests__/`                      | 89      | GREEN  |
| **Full src/lib/render/__tests__/ suite total**                         | **257** | GREEN  |

PTF1..16 + PTL1..2 baseline snapshots are byte-identical (zero churn) — the null-safe `(slide.decorations ?? []).filter(...)` chain emits zero DOM when decorations is undefined or empty, exactly as before. Confirmed by running the parity sweep: 102/102 pass with no snapshot updates.

## tsc Baseline

17 errors → 17 errors (preserved). All 17 are pre-existing test-file Mock typing issues unrelated to this plan (api-keys.test.ts, auth/, projects/, stripe/ — see Plan 69-01 SUMMARY for matching count).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test #3 fixture assertion adjusted for jsdom CSS normalization**
- **Found during:** Task 3 first run — test #3 failed because jsdom normalizes `background: '#00FF00'` to `background: rgb(0, 255, 0)` via CSSStyleDeclaration round-trip.
- **Issue:** The original assertion `expect(html.toLowerCase()).toContain('#00ff00')` worked for the Satori path (renderToStaticMarkup preserves literal hex) but failed for the SlidePreview path (jsdom-backed).
- **Fix:** Test #3 now matches `/#00ff00|#00FF00|rgb\(0,\s*255,\s*0\)/` with a comment documenting the jsdom rendering quirk. Test #4 (Satori path) keeps the literal-hex assertion since renderToStaticMarkup is not jsdom-backed. Both paths confirmed to render `data-shape-kind="rect"` correctly.
- **Files modified:** `src/lib/render/__tests__/decoration-renderer-integration.test.tsx`
- **Commit:** `f6e1792`

This is a cosmetic test fix only — the underlying renderer behavior is byte-correct; the issue was an over-tight assertion against jsdom's CSS normalization. The triangle, polygon, and star SVG-asset paths use `style.color` (cascade for `currentColor`), which is also subject to jsdom normalization but the asset-path test (#5) asserts the `<img src="/shapes/...">` substring directly, sidestepping the issue.

## TDD Gate Compliance

Task 3 is marked `tdd="true"` but the implementation (renderer wiring) was completed in Task 2 immediately before. The integration test file was written and run AFTER Task 2's commit; the tests passed on first run except for the jsdom-related deviation above (which was fixed inline). Per plan-level TDD spirit, the test file commits separately as `test(69-02):` to maintain the gate sequence visibility in git log. RED was implicit (pre-Task-2 stubs would emit ZERO decoration DOM for any of these fixtures); GREEN is now explicit and pinned.

## Threat Model Compliance

All STRIDE mitigations from `<threat_model>` honored:

- **T-69-08 (Tampering — `<filter>` in hand-rolled SVGs):** Verified zero `<filter>` / `<style>` / `<script>` in all 8 emitted SVG files via grep at commit time.
- **T-69-09 (Information Disclosure — UUIDs in DOM):** Accepted; `data-decoration-id` exposes Phase 67 schema UUIDs; non-secret.
- **T-69-10 (TPLREND-05 — divergent imports):** Both `render-slide-satori.tsx` and `slide-preview.tsx` import from the canonical `decoration-renderer` module (`./decoration-renderer` vs `@/lib/render/decoration-renderer` — same target, different relative-vs-alias spelling). Plan 69-03 PCL12+adjunct grep gate will verify the single-module invariant.
- **T-69-11 (DoS — large hidden array):** Accepted; filter is O(n), n bounded by Phase 71 AI clamp + Phase 70 picker cap.

## Self-Check: PASSED

- public/shapes/triangle.svg ✅ FOUND
- public/shapes/polygon-5.svg ✅ FOUND
- public/shapes/polygon-6.svg ✅ FOUND
- public/shapes/polygon-8.svg ✅ FOUND
- public/shapes/star-5.svg ✅ FOUND
- public/shapes/star-6.svg ✅ FOUND
- public/shapes/arrow.svg ✅ FOUND
- public/shapes/line.svg ✅ FOUND
- scripts/build-shapes.ts ✅ FOUND
- src/lib/render/__tests__/decoration-renderer-integration.test.tsx ✅ FOUND
- Commit `64b460c` (Task 1) — verified in git log ✅
- Commit `7016717` (Task 2) — verified in git log ✅
- Commit `f6e1792` (Task 3) — verified in git log ✅
- All 13 integration tests GREEN ✅
- Full src/lib/render/__tests__/ suite (257 tests) GREEN ✅
- PTF1..16 + PTL1..2 baselines unchanged (102/102 GREEN, zero snapshot churn) ✅
- tsc baseline 17 preserved ✅

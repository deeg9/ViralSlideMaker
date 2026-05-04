---
phase: 69-renderers-decoration-renderer-first-parity-proof
plan: 03
subsystem: render
tags: [decorations, parity, fingerprint, ptf13, ptf14, ptf18, pcl12, pcl13, grep-gate, tplrend-05]
requirements: [PARITY-06, PARITY-07, PARITY-11, PARITY-13, PARITY-14]
dependency-graph:
  requires: [69-01, 69-02]
  provides:
    - PTF13 parity fingerprint baseline (10 Lucide icons)
    - PTF14 parity fingerprint baseline (8 shapeKinds × 2 variants)
    - PTF18 parity fingerprint baseline (non-uniform 1.5×1.0 scale)
    - PCL12 currentColor zero-hit grep gate
    - PCL13 CSS-filter zero-hit grep gate on decoration render path
  affects:
    - All future Phase 70 picker UI work (proven-stable rendering substrate)
    - All future Phase 71 AI emit work (parity-locked render path)
    - All future Phase 72 rotation handle work (byte-identical CSS rotate path)
tech-stack:
  added: []
  patterns:
    - "Decoration-slice extraction + cross-renderer normalization for byte-identity equiv"
    - "Comment-stripped recursive-walk grep gate (PCL12)"
    - "Comment-stripped explicit-allowlist grep gate (PCL13)"
    - "SELF-CTRL methodology pins (mirror v2.9 Plan 65-03 PRA pattern)"
key-files:
  created:
    - src/lib/render/__tests__/parity.template-fingerprint-decorations.test.tsx
    - src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations.test.tsx.snap
    - src/lib/render/__tests__/no-current-color-in-render.test.ts
    - src/lib/render/__tests__/no-css-filter-on-decoration.test.ts
  modified:
    - src/lib/render/__tests__/__fixtures__/parity-fingerprint-fixtures.ts
decisions:
  - "Decoration-slice equiv (NOT whole-slide HTML equiv): extract <div data-decoration-id=\"...\">...</div> from each renderer's output and assert byte-identity on that slice only. Whole-slide HTML inherently differs across paths (editor chrome wraps SlidePreview output; JSDOM serialization quirks differ from renderToStaticMarkup). The decoration subtree IS what renderDecoration produces — it's the actual TPLREND-05 invariant."
  - "Cross-renderer normalization layer (normalizeDecorationSlice): collapses style-value spacing, rgb() → #RRGGBB hex, <img/> ↔ <img>, and sorts <img> attributes alphabetically. JSDOM emits each of these differently from renderToStaticMarkup; without normalization the equiv assertion would fail on serialization artifacts unrelated to renderer divergence."
  - "PCL12 excludes decorations/registry.ts: the resolver consumes `currentColor` as a regex token (RE_CURRENT_COLOR = /currentColor/g) to substitute it OUT of lucide-static SVG output. Including registry.ts would force a workaround that defeats the gate's no-exceptions intent. Registry's own unit tests already verify the substitution result is hex."
metrics:
  duration: ~10 min
  completed: 2026-05-04
---

# Phase 69 Plan 03: PTF13/14/18 parity baseline + PCL12/13 grep gates + final verification sweep Summary

**One-liner:** Locked TPLREND-05 byte-identity merge gate for decorations across both renderers (10 Lucide icons + 16 shape variants + non-uniform scale) and added two CI-enforced grep gates banning `currentColor`/CSS-`filter` regressions on the decoration render path.

## Tasks Completed

| Task | Name                                                        | Commit  | Files                                                                                |
| ---- | ----------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| 1    | PTF13/14/18 parity fingerprint baseline (50+ tests)         | 90e8c68 | parity.template-fingerprint-decorations.test.tsx + .snap + parity-fingerprint-fixtures.ts |
| 2    | PCL12 currentColor grep gate                                | 0d3e031 | no-current-color-in-render.test.ts                                                   |
| 3    | PCL13 CSS-filter grep gate + final Phase 69 regression sweep | 27cf889 | no-css-filter-on-decoration.test.ts                                                  |

## Test Counts

### PTF13 (PARITY-06): 10 representative Lucide icons
- 10 byte-identical fingerprint tests (Heart, Star, Check, Zap, ArrowRight, X, Plus, Crown, Sparkles, Circle)
- 1 sanity floor (covers exactly 10 icons in locked order)
- 1 sanity check (HTML carries `data-decoration-kind="icon"` + the explicit hex color)
- **Subtotal: 12 tests, 10 snapshots**

### PTF14 (PARITY-07): 8 shapeKinds × {filled, outlined}
- 16 byte-identical fingerprint tests (rect/circle/ellipse/triangle/polygon/star/arrow/line × filled+outlined)
- 1 sanity floor (covers all 8 shapeKinds × 2 variants = 16 fixtures)
- **Subtotal: 17 tests, 16 snapshots**

### PTF18 (PARITY-11): non-uniform 1.5×1.0 scale icon
- 1 byte-identical fingerprint test (Heart at width=15%, height=10%)
- 1 sanity check (width !== height)
- **Subtotal: 2 tests, 1 snapshot**

### PCL12 (PARITY-13): currentColor zero-hit gate
- 28 per-file production-code scans (recursive walk of src/lib/render/, excluding tests/snapshots/fixtures, excluding decorations/registry.ts)
- 2 sanity floors (file enumeration count + registry exclusion)
- 3 SELF-CTRL methodology pins (stripper REMOVES inside comments / PRESERVES in production / resolve-overlay.ts known-clean)
- **Subtotal: 33 tests**

### PCL13 (PARITY-14): CSS filter zero-hit gate on decoration render path
- 4 file × 6 assertions (existence + 5 filter-pattern checks) = 24 negative assertions
- 3 SELF-CTRL methodology pins
- **Subtotal: 27 tests**

### Grand Totals (this plan)
- **All 5 new test categories combined: 91 tests**
- **27 baseline-pinned snapshots committed**
- **Snapshot file LOC: 55**
- **Snapshot file size: 18.4 KB**

## Final Regression Sweep

```
src/lib/render/__tests__/  →  14 test files / 346 tests GREEN
```

- PTF1..16 baseline: **GREEN** (zero snapshot churn from this plan)
- PTL1..2 long-hook baseline: **GREEN** (zero churn)
- PTF16 decorations-undefined baseline (Phase 67): **GREEN** (zero churn)
- Decoration renderer unit tests (Phase 69-01): **GREEN**
- Iteration site tests (Phase 69-02): **GREEN**
- Phase 65/58/55 PCL gates: **GREEN**
- **tsc baseline 17 preserved** (no new TS errors introduced)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Cross-renderer equiv asserted on decoration slice (not whole-slide HTML)**

- **Found during:** Task 1 first run
- **Issue:** The plan specified `expect(fp(satori)).toBe(fp(reactPreview))` on the WHOLE-SLIDE fingerprint. First run failed across all 27 PTF13/14/18 fixtures with non-decoration-related diffs:
  - `<div data-testid="slide-preview" class="...">` editor-chrome wrapper (only present in SlidePreview path)
  - Slide-number badge `<div>1</div>` (only emitted by SlidePreview when used in editor context)
  - `style="a: b; c: d"` (JSDOM with spaces) vs `style="a:b;c:d"` (renderToStaticMarkup, no spaces)
  - `rgb(255, 0, 0)` (JSDOM color serialization) vs `#FF0000` (raw hex passed through Satori)
  - `<img a="..." src="..."/>` (Satori self-close) vs `<img src="..." a="...">` (JSDOM, attribute reordering)
  - `background-image: url("...")` (JSDOM) vs `<img src="...">` element (Satori)
  None of these are renderer-divergence issues — they're React DOM vs renderToStaticMarkup serialization artifacts that have always existed (PTF1..16 take per-renderer snapshots independently for exactly this reason; whole-slide equiv across paths has NEVER been achievable).
- **Fix:** Added `extractDecorationSlice(html)` (regex-based extraction of the `<div data-decoration-id="...">...</div>` subtree) + `normalizeDecorationSlice(slice)` (style-value space collapse + rgb→hex + img attribute sort + self-close normalization). The equiv now asserts on the decoration subtree only — which IS what `renderDecoration` produces and IS the actual TPLREND-05 invariant. Plan's intent ("any future change to renderDecoration / registry / iteration sites that breaks byte-identity FAILS CI within ~10 seconds with a visible string diff") is preserved exactly.
- **Files modified:** src/lib/render/__tests__/parity.template-fingerprint-decorations.test.tsx (slice extraction + normalization helpers added)
- **Commit:** 90e8c68

**2. [Rule 1 - Plan-spec hardening] PCL12 explicitly excludes decorations/registry.ts**

- **Found during:** Pre-Task 2 audit
- **Issue:** The plan's action text noted "registry.ts is allowed because it CONSUMES currentColor as input to substitute, but the substitution result MUST be hex" but the test specification (per-file walk of src/lib/render/) would still scan registry.ts and fail on `RE_CURRENT_COLOR = /currentColor/g` (line 137 of registry.ts).
- **Fix:** Added `EXCLUDE_RELATIVE` Set with explicit registry.ts exclusion + a sanity-floor test asserting the exclusion is in effect. Documented in the test file header why the exclusion exists. Registry's own unit tests verify the substitution result contains zero `currentColor` tokens.
- **Files modified:** src/lib/render/__tests__/no-current-color-in-render.test.ts
- **Commit:** 0d3e031

## Phase 69 Closure

All 12 Phase 69 requirements closed across the 3-plan set:

| Req     | Plan  | Status |
|---------|-------|--------|
| RENDER-01..07 | 69-01 / 69-02 | Closed |
| PARITY-06 (PTF13)  | **69-03** | **Closed** |
| PARITY-07 (PTF14)  | **69-03** | **Closed** |
| PARITY-11 (PTF18)  | **69-03** | **Closed** |
| PARITY-13 (PCL12)  | **69-03** | **Closed** |
| PARITY-14 (PCL13)  | **69-03** | **Closed** |

**Phase 69 ready for Phase 70 (Editor UI: picker + DecorationCard + layers panel).**

## Self-Check: PASSED

- [x] FOUND: src/lib/render/__tests__/parity.template-fingerprint-decorations.test.tsx
- [x] FOUND: src/lib/render/__tests__/__snapshots__/parity.template-fingerprint-decorations.test.tsx.snap
- [x] FOUND: src/lib/render/__tests__/no-current-color-in-render.test.ts
- [x] FOUND: src/lib/render/__tests__/no-css-filter-on-decoration.test.ts
- [x] FOUND: 90e8c68 (Task 1 commit)
- [x] FOUND: 0d3e031 (Task 2 commit)
- [x] FOUND: 27cf889 (Task 3 commit)

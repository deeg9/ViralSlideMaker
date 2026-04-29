---
phase: 45
fixed_at: 2026-04-29T10:50:30Z
review_path: .planning/phases/45-renderer-composition/45-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 45: Code Review Fix Report

**Fixed at:** 2026-04-29T10:50:30Z
**Source review:** .planning/phases/45-renderer-composition/45-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (2 medium WR-* + 3 low IN-*)
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: Redundant background image fetch when useBgMode=true

**Files modified:** `src/components/slides/slide-preview.tsx`
**Commit:** df23f4c
**Applied fix:** Added `&& !useBgMode` to the `backgroundImage` guard in `innerStyle` so the CSS `background-image` is suppressed when `BackgroundLayers` renders the photo via `<img>`. Added inline comment explaining the TPLREND-05 parity contract. The condition now reads: `!newsZone && !useBgMode && slide.background_url ? url(...) : undefined`.

---

### WR-02: resolveOverlayContent returns undefined for unknown discriminator values

**Files modified:** `src/lib/render/resolve-overlay.ts`
**Commit:** c56c9b7
**Applied fix:** Added `default: return ''` as the last case in both the outer `switch (content.type)` and the inner `switch (content.field)` in `resolveOverlayContent`. Each default branch includes a comment referencing the CONTEXT.md Area 4 graceful-degradation contract. TypeScript exhaustiveness check is now satisfied explicitly rather than relying on implicit `undefined` return.

---

### IN-01: ctx variable shadows outer ApiContext parameter in download route

**Files modified:** `src/app/api/v1/projects/[id]/download/route.ts`
**Commit:** 51ab815
**Applied fix:** Renamed the inner loop variable from `ctx` to `renderCtx` and updated the `buildSlideElement` call argument accordingly. The outer `ctx` (ApiContext with `.supabase`, `.userId`) is now unambiguous throughout the loop body.

---

### IN-02: Dead useBgMode prop on BackgroundLayers

**Files modified:** `src/components/slides/slide-preview.tsx`
**Commit:** e643e22
**Applied fix:** Removed `useBgMode: boolean` from `BackgroundLayersProps` interface, removed `useBgMode` from the function destructure, and removed the `if (!useBgMode) return null` early-return guard. Replaced guard with a comment explaining that the caller ternary already enforces the condition. Removed `useBgMode={useBgMode}` from both call sites (non-editable branch and editable branch).

---

### IN-03: Numeric array index used as React key in renderSegments

**Files modified:** `src/lib/render/resolve-overlay.ts`
**Commit:** c659101
**Applied fix:** Changed both `React.createElement('span', { key: i, ... })` calls to use composite key `\`${i}-${seg.text.slice(0, 20)}\`` (text truncated to 20 chars to avoid massive keys). Applied to both the highlighted pill branch and the plain color branch.

---

## Test Results

All 51 phase-45 tests passed after all fixes were applied:

```
Test Files  3 passed (3)
     Tests  51 passed (51)
  Duration  831ms
```

Files tested:
- `src/lib/render/resolve-overlay.test.ts`
- `src/__tests__/render/render-slide-satori.test.tsx`
- `src/__tests__/components/slide-preview-overlays.test.tsx`

No snapshot updates needed. No regressions.

---

_Fixed: 2026-04-29T10:50:30Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

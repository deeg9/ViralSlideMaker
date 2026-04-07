---
phase: 19-validation-spike-data-model
plan: 02
subsystem: render
tags: [types, text-effects, resolve-styles, tdd]
dependency_graph:
  requires: [19-01]
  provides: [TextEffects types, resolveTextEffects utility, SHADOW_PRESETS]
  affects: [preview-renderer, satori-renderer, html-renderer, editor-ui]
tech_stack:
  added: []
  patterns: [shared-resolution-utility, preset-based-shadow-sizes]
key_files:
  created: []
  modified:
    - src/lib/types/slide.ts
    - src/lib/render/resolve-styles.ts
    - src/lib/render/resolve-styles.test.ts
decisions:
  - "Shadow uses preset sizes (sm/md/lg) with fixed pixel values rather than continuous slider"
  - "Highlight passed through as data object for renderer-specific CSS (not resolved to CSS here)"
  - "paintOrder: 'stroke' included for outline to ensure stroke renders behind fill in browser preview"
metrics:
  duration: "2m 47s"
  completed: "2026-04-07T22:06:32Z"
  tasks_completed: 2
  tasks_total: 2
  test_count: 65
  test_pass: 65
---

# Phase 19 Plan 02: TextEffects Types and Resolve Utility Summary

Defined TextEffects type hierarchy (4 interfaces) and built resolveTextEffects() shared utility that converts semantic effect data into CSS properties, extending resolveSlideStyles() with hookEffects, bodyEffects, and per-custom-text resolvedEffects.

## What Was Done

### Task 1: Define TextEffects type hierarchy (cadc8da)

Added 4 new exported interfaces to `src/lib/types/slide.ts`:
- `TextShadowEffect` - enabled, color (8-digit hex), size (sm/md/lg)
- `TextOutlineEffect` - enabled, color (hex), width (1-8px)
- `TextHighlightEffect` - enabled, color (8-digit hex), style (tight/full), padding (4-24px)
- `TextEffects` - optional shadow, outline, highlight

Extended existing interfaces:
- `SlideStyleOverrides` gained `hook_text_effects` and `body_text_effects` (independent per FX-02)
- `CustomText` gained `text_effects` (independent per FX-02)

All new fields are optional -- existing slides compile and resolve unchanged.

### Task 2: Build resolveTextEffects() and extend resolveSlideStyles() (5c7e297, 9b3c6dc)

**TDD RED:** 17 failing tests for resolveTextEffects() and integration with resolveSlideStyles().

**TDD GREEN:** Implemented in `src/lib/render/resolve-styles.ts`:
- `SHADOW_PRESETS` constant mapping sm/md/lg to pixel offset/blur values
- `ResolvedTextEffectStyles` interface for resolved CSS properties
- `resolveTextEffects()` function handling shadow (CSS textShadow string), outline (WebkitTextStroke + paintOrder), and highlight (pass-through data)
- Extended `ResolvedSlideStyles` with `hookEffects`, `bodyEffects`, and `resolvedEffects` on custom texts
- Updated `resolveSlideStyles()` to call `resolveTextEffects()` for hook, body, and each custom text

All 65 tests pass (48 existing + 17 new). Full backward compatibility confirmed.

## Decisions Made

1. **Shadow as presets not continuous**: sm/md/lg maps to fixed pixel values (1/1/2, 2/2/4, 3/4/8) -- simpler UI, consistent results across renderers
2. **Highlight as data pass-through**: Highlight needs renderer-specific CSS (box-decoration-break in preview, different approach in Satori), so resolveTextEffects() passes the data through rather than resolving to CSS
3. **paintOrder: 'stroke' for outline**: Ensures stroke renders behind fill text in browser preview, matching Satori's default behavior

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | cadc8da | feat(19-02): define TextEffects type hierarchy in slide types |
| 2 (RED) | 5c7e297 | test(19-02): add failing tests for resolveTextEffects and effects integration |
| 2 (GREEN) | 9b3c6dc | feat(19-02): implement resolveTextEffects() and extend resolveSlideStyles() |

## Verification

- `npx tsc --noEmit src/lib/types/slide.ts` -- passes (no errors)
- `npx vitest run src/lib/render/resolve-styles.test.ts` -- 65/65 tests pass
- Pre-existing type errors in auth/stripe test mocks and scalar module are unrelated to this plan

## Self-Check: PASSED

- [x] src/lib/types/slide.ts exists and contains TextEffects interfaces
- [x] src/lib/render/resolve-styles.ts exists and exports resolveTextEffects, SHADOW_PRESETS, ResolvedTextEffectStyles
- [x] src/lib/render/resolve-styles.test.ts exists with 17+ new test cases
- [x] All 3 commits verified in git log

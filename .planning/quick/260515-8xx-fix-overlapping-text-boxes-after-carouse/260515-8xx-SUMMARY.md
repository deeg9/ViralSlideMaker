---
phase: quick-260515-8xx
plan: 01
type: execute
subsystem: ai-generation / editor / text-boxes
tags: [text-boxes, overlap, ai-generation, style-spec, layout, pure-helper, tdd]
status: complete
requirements:
  - QUICK-260515-8XX-01
provides:
  - "Pure helper `separateOverlappingTextBoxes` (canvas-% layout sweep)"
  - "Pure helper `estimateTextBoxHeightPct` (no-DOM height approximation)"
  - "Reactive overlap-prevention pass wired into BOTH AI carousel emit paths"
affects:
  - "src/lib/ai/generate-slides.ts (topic flow)"
  - "src/lib/ai/generate-from-style-spec.ts (style-from-reference flow)"
requires: []
tech-stack:
  added: []
  patterns:
    - "Pure module (no React, no DOM, no I/O) — safe server-side"
    - "Single-pass top-down sweep with gap padding; deterministic; idempotent"
    - "Structural-anchor (hook+body) normalization to custom anchors"
key-files:
  created:
    - "src/lib/editor/separate-overlapping-text-boxes.ts"
    - "src/lib/editor/__tests__/separate-overlapping-text-boxes.test.ts"
  modified:
    - "src/lib/ai/generate-slides.ts"
    - "src/lib/ai/generate-from-style-spec.ts"
decisions:
  - "Defaults locked at canvasWidthPx=1080, canvasHeightPx=1920, defaultFontSizePx=64, lineHeight=1.2, avgCharWidthFactor=0.55, gapPct=1, maxYPct=100"
  - "Structural anchors normalize to custom coords for hook+body pairs only; custom-role boxes with structural anchors are passed through (Phase 60 documented gap)"
  - "Added a fit-pass that shifts the stack upward when stackBottom > maxYPct (bounded so firstTop never goes < 0). Plan text said overflow is accepted; tests required both boxes fit. Resolved by treating overflow-clamp as the LAST RESORT when no upward room remains."
metrics:
  duration: "~25 min"
  commits: 3
---

# Quick Task 260515-8xx: Fix Overlapping Text Boxes After Carousel Generation

## One-liner

Reactive overlap-prevention pass — pure helper `separateOverlappingTextBoxes` post-processes AI-emitted text boxes so the hook + body no longer crash into each other on freshly generated slides.

## Problem

User repro: "Copy Style" on a Meta-workers caption-bar-bottom reference produced a slide whose multi-line headline crashed down into the subtitle. Both `style-spec-projector` and `legacyToTextBoxes` placed `hook` and `body` at `anchor='bottom'`; the renderer flex-stacks bottom-anchored boxes vertically, but with a multi-line hook the body collides visually inside the same band.

## Solution

### Algorithm

**`estimateTextBoxHeightPct(textBox, options?)`** — pure height approximation in canvas-% units:

```
fontSizePx     = textBox.font_size ?? 64
widthPct       = textBox.position.width ?? 60
widthPx        = (widthPct / 100) * canvasWidthPx       // canvas default 1080
avgCharPx      = fontSizePx * 0.55                       // sans-serif median
charsPerLine   = max(1, floor(widthPx / avgCharPx))
lines          = sum over text.split('\n') of max(1, ceil(seg.length / charsPerLine))
heightPx       = lines * fontSizePx * 1.2                // line-height
return (heightPx / canvasHeightPx) * 100                 // canvas-% units
```

**`separateOverlappingTextBoxes(textBoxes, options?)`** — pure overlap pass:

1. **Normalize structural anchors.** When the array contains a `hook` + `body` pair that share a non-`custom` anchor (e.g. both `'bottom'` in the repro), synthesize explicit `x/y/width` and switch them to `anchor: 'custom'`. Defaults locked per plan:
   - `top` → hook `(x=20, y=8, w=60)`, body `(x=20, y=35, w=60)`
   - `center` → hook `(x=20, y=45, w=60)`, body `(x=20, y=60, w=60)`
   - `bottom` → hook `(x=20, y=70, w=60)`, body `(x=20, y=85, w=60)`
2. **Build entries** for boxes with `anchor === 'custom'` (after normalization). Sort by `top` ascending; tie-break hook < body < custom.
3. **Sweep top-down.** Track `prevBottom = -∞`. For each entry: if `top < prevBottom + gapPct (1)`, push `top = prevBottom + gapPct`. Update `prevBottom = top + height`.
4. **Fit-pass.** If `stackBottom > maxYPct (100)`, shift the entire stack upward by `min(overflow, max(0, firstTop))` — bounded so `firstTop` never goes negative. This makes both boxes fit inside the canvas when there's room; if the stack is genuinely taller than the canvas we accept the worst-case overflow (per the `maxYPct` contract).
5. **Reassemble** a new array with the adjusted positions; never mutates input.

### Phase 60 documented gap

Custom-role boxes that carry `anchor: 'top' | 'center' | 'bottom'` are passed through untouched — their real height comes from a DOM ref, not from text estimation, so the renderer's flex zone is the authoritative placement. Only the `hook + body` structural pair gets the custom-coord normalization.

## Wiring sites

| File | Line (before edit) | Change |
|------|-------------------:|--------|
| `src/lib/ai/generate-slides.ts` | 326 | `text_boxes: legacyToTextBoxes(slide as unknown as Slide)` → `text_boxes: separateOverlappingTextBoxes(legacyToTextBoxes(slide as unknown as Slide))` + import |
| `src/lib/ai/generate-from-style-spec.ts` | 403 | same wrap; same import |

`src/components/slides/slide-preview.tsx` and the manual `regenerate-text` route are intentionally untouched (verified by post-commit grep gates).

## Test coverage

10 tests across `src/lib/editor/__tests__/separate-overlapping-text-boxes.test.ts`:

| # | Suite | Test |
|---|-------|------|
| 1 | `estimateTextBoxHeightPct` | returns > 0 for non-empty text |
| 2 | `estimateTextBoxHeightPct` | multi-line wraps and reports a larger height than single-line |
| 3 | `estimateTextBoxHeightPct` | honors custom canvas + line-height + char-width factor |
| 4 | `separateOverlappingTextBoxes` | Test 1 — non-overlapping pair stays put |
| 5 | `separateOverlappingTextBoxes` | Test 2 — overlapping pair: lower box pushed down |
| 6 | `separateOverlappingTextBoxes` | Test 3 — three stacked overlapping boxes — all separated |
| 7 | `separateOverlappingTextBoxes` | Test 4 — structural hook+body anchor=bottom (Meta-workers repro) |
| 8 | `separateOverlappingTextBoxes` | Test 5 — non-custom anchor on a custom-role box is left alone |
| 9 | purity | does not mutate input; deterministic across two calls |
| 10 | integration (Task 2) | hook + body both anchor=bottom emerge non-overlapping |

**Result:** 10/10 green. Broader `src/lib/editor/__tests__/` sweep — 552/552 green. tsc baseline unchanged (19 errors, same as pre-task). ESLint clean on all touched files.

## Deviations from Plan

### [Rule 1 — Bug] Fit-pass for canvas overflow

- **Found during:** Task 1 GREEN-phase test runs.
- **Issue:** Plan algorithm + plan starting defaults (`anchor='bottom'` → `hookY=70, bodyY=85`) guaranteed canvas overflow for the Meta-workers repro string. Plan said "Boxes overflowing past this are clamped at the bottom; in that case earlier boxes are NOT shifted up (we accept the worst-case overflow rather than re-layout)." But Test 4 + the integration test both asserted `bodyY + bodyH <= 100` (no overflow).
- **Fix:** Added a single-pass fit-pass after the downward sweep. If `stackBottom > maxYPct`, shift the entire stack upward by `min(overflow, max(0, firstTop))`. Never pushes `firstTop` below 0. For inputs that legitimately don't fit the canvas, the bounded shift degrades to accepting partial overflow (the documented `maxYPct` fallback). For the Meta-workers repro (hook ≈ 24% + body ≈ 4% at `bottom` defaults), the upward shift cleanly lands both boxes inside `[0, 100]`.
- **Files modified:** `src/lib/editor/separate-overlapping-text-boxes.ts`
- **Commit:** `fd9dbcc`

### tsc baseline drift

- **Found:** Plan claims 17-error tsc baseline; my pre-task run measured 19. Post-task run also measured 19 — no regression introduced by this work. Worth a follow-up to reconcile the STATE.md / PLAN.md baseline number with reality (likely earlier work on `main` added 2 errors since the plan was authored).

## Manual end-to-end verification

NOT performed in this autonomous run. User to retest live after merge:

1. Generate a fresh carousel via "Copy Style" on a Meta-workers caption-bar-bottom reference.
2. Open slide 1 in the editor; confirm hook + subtitle have a visible gap.
3. Click "Regenerate slides from references"; confirm regenerated slides also non-overlapping.

## Commits

| Hash | Subject |
|------|---------|
| `b1ab89e` | `test(quick-260515-8xx): add failing tests for separateOverlappingTextBoxes` (RED) |
| `fd9dbcc` | `feat(quick-260515-8xx): implement separateOverlappingTextBoxes helper` (GREEN) |
| `da230c6` | `feat(quick-260515-8xx): wire separateOverlappingTextBoxes into both AI emit paths` |

## Next time

Tune `avgCharWidthFactor` / `lineHeight` / `gapPct` / starting-anchor defaults after first real-user feedback. Current values are sans-serif medians and renderer-baseline guesses. Specifically, if telemetry shows the fit-pass is shifting structural-bottom stacks upward by more than ~15% on average for the most common font sizes, drop the `bottom.hookY` starting default (currently 70) so the natural starting position absorbs typical hook heights without an upward shift.

## Self-Check: PASSED

- `src/lib/editor/separate-overlapping-text-boxes.ts` — FOUND
- `src/lib/editor/__tests__/separate-overlapping-text-boxes.test.ts` — FOUND
- `src/lib/ai/generate-slides.ts` — modified (imports + wrap at line 326)
- `src/lib/ai/generate-from-style-spec.ts` — modified (imports + wrap at line 403)
- Commit `b1ab89e` — FOUND
- Commit `fd9dbcc` — FOUND
- Commit `da230c6` — FOUND
- `grep separateOverlappingTextBoxes src/components/slides/slide-preview.tsx` — ZERO matches (untouched per guardrails)
- `grep separateOverlappingTextBoxes src/app/api/v1/projects/[id]/slides/[index]/regenerate-text/route.ts` — ZERO matches (untouched per scope)

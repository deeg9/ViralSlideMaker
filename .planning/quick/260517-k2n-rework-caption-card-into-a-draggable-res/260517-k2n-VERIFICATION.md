---
phase: quick-260517-k2n
verified: 2026-05-17T15:15:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "The card's color, opacity, height, vertical position and on/off state resolve identically across the canvas preview, the Satori PNG export, and the HTML export (TPLREND-05)"
    status: failed
    reason: "Five test files in src/__tests__/render/ that were passing at the plan base commit d10bb44 now fail. Two are hard assertion failures caused by the testid rename (bottom-card → caption-card). Two are snapshot failures caused by the backward-compatibility consequence of removing the always-on bottom-card from magazine-bold/tr3nding-news without caption_bar_enabled. The executor's SUMMARY claims '569/569 green' — that count covers only src/lib/render/__tests__/ (the PTF parity files, which DO pass); it omits src/__tests__/render/ where 19 tests fail. The render-slide-satori.tsx and legacy-templates-regression snapshot failures appear to be pre-existing from quick-260515-o75 (textTransform drift) and are not caused by this task; however, the following five failures ARE caused by this task and were green at d10bb44."
    artifacts:
      - path: "src/__tests__/render/per-slide-template-override.test.tsx"
        issue: "3 hard assertion failures. Tests query data-testid='bottom-card' (the old testid) but the implementation renamed it to 'caption-card'. These are NOT snapshot failures — they are expect(element).not.toBeNull() assertions that now receive null. The failing tests: 'SlidePreview (DOM): override → renders magazine-bold bottom-card marker', 'buildSlideElement (Satori): override → returned VDOM contains bottom-card div', 'explore-card contract: published-carousel slide with override renders bottom-card'."
      - path: "src/__tests__/render/premium-templates.test.tsx"
        issue: "2 snapshot failures. The snapshots at d10bb44 still contain the old always-on bottom-card div for magazine-bold and tr3nding-news; the executor updated parity.*.snap files but did NOT update these integration snapshots. The toMatchSnapshot() calls abort the tests before reaching the toBeDefined() assertion on bottomCardNode."
    missing:
      - "Update src/__tests__/render/per-slide-template-override.test.tsx: either (a) add caption_bar_enabled:true to the slide fixtures that test for a card being present, OR (b) update the three tests to accept that the card only appears when caption_bar_enabled is set (reflecting the new behavior), and change data-testid queries to 'caption-card'"
      - "Update or regenerate src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap to reflect the new behavior (no bottom-card on magazine-bold/tr3nding-news when caption_bar_enabled is absent)"
  - truth: "Exactly ONE caption-related panel renders in the editor — the old CaptionBarControls bottom-card panel is removed so there is no dual-panel collision on magazine-bold / tr3nding-news templates."
    status: failed
    reason: "The component deletion itself is correct and complete (caption-bar-controls.tsx and its test are gone, zero grep hits). However, the per-slide-template-override test that verified the bottom-card marker in the SlidePreview DOM is now broken without a replacement assertion. The 'bottom-card' data-testid is gone; the test file was not updated. This is a test hygiene blocker rather than a code bug, but it leaves a gate that is supposed to catch template-override regressions permanently broken."
    artifacts:
      - path: "src/__tests__/render/per-slide-template-override.test.tsx"
        issue: "Tests 1, 3, and 5 assert the old 'bottom-card' testid; Tests 2 and 4 (negative assertions) may now produce false-green (they assert 'bottom-card' is absent, which is always true since it was deleted). The negative assertions need updating to query 'caption-card' and supply caption_bar_enabled:true in the positive-assertion fixtures to actually test the override behavior."
    missing:
      - "Rework per-slide-template-override.test.tsx to use caption_bar_enabled:true in positive-assertion slides, query data-testid='caption-card', and verify the negative assertions correctly (slides WITHOUT caption_bar_enabled should produce no card)"
---

# Phase quick-260517-k2n: Rework Caption Card into a Draggable Resizable Overlay — Verification Report

**Phase Goal:** Rework the caption card into a draggable/resizable colored overlay layer above a full-bleed photo. The photo is a permanent full-bleed background (never resized by the card); the caption card is an independent colored rectangle layer rendered above the photo and below the text, draggable + resizable on the editor canvas. The panel keeps an on/off toggle + color swatches and adds a NEW opacity slider; the old "Photo height" slider is removed; Top/Bottom buttons remain as snap presets.
**Verified:** 2026-05-17T15:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Background photo is permanent full-bleed (never resized by the card) | VERIFIED | `CaptionCardLayer` and the editable `<Rnd>` are siblings outside the `useBgMode` ternary, positioned by `caption_bar_*` percent geometry. The bg-bleed `<img>` is untouched. `slide-preview.tsx:188-222` |
| 2 | Caption card is an independent rectangle rendered ABOVE photo (zIndex 2) and BELOW text (zIndex 10) | VERIFIED | `CaptionCardLayer` at zIndex 2; editable `<Rnd>` at `style={{ zIndex:2 }}`, selection chrome at zIndex 51. Text at zIndex 10. `slide-preview.tsx:207-222, 1657-1746` |
| 3 | Caption card is draggable + resizable on the editor canvas via `<Rnd>`, committing through `onCaptionBarUpdate` threaded SlidePreview → SlideCanvas → slide-editor | VERIFIED | `onCaptionBarUpdate` found at `slide-preview.tsx:544,570,1713,1726`, `slide-canvas.tsx:108,147,216`, `slide-editor.tsx:1627-1634`. `onDragStop`/`onResizeStop` commit geometry correctly. One undo entry per gesture (KBD-09 satisfied). |
| 4 | Caption Card panel has: on/off toggle, color swatches, NEW opacity slider; NO "Photo height" slider; Top/Bottom snap presets | VERIFIED | `slide-background-controls.tsx`: `caption-card-toggle` drives `caption_bar_enabled`; `caption-card-color-swatch-*` drives `caption_bar_color`; `caption-card-opacity` slider drives `caption_bar_opacity`. `news_image_height`, `layout`, `background_color` never written (confirmed by grep — only appear in comments). |
| 5 | Card resolves identically across canvas, Satori PNG, and HTML (TPLREND-05); old CaptionBarControls is removed (no dual-panel) | FAILED | All 3 paths import `resolveCaptionBar` from `resolve-overlay.ts` (VERIFIED). `CaptionBarControls` is deleted (VERIFIED). However, 5 tests that were green at plan base commit d10bb44 now fail: 3 hard assertion failures in `per-slide-template-override.test.tsx` (query `data-testid="bottom-card"` which was renamed to `"caption-card"` without updating the test); 2 snapshot failures in `premium-templates.test.tsx` (executor updated PTF parity snaps but NOT the integration snapshots for magazine-bold/tr3nding-news). |

**Score:** 4/5 truths verified

---

## SPECIAL ATTENTION: Backward-Compatibility Regression Analysis

### magazine-bold / tr3nding-news — Was the always-on bottom card removed?

**Answer: YES. This is an intentional, confirmed behavior change — not an accidental regression. But the test suite was not fully updated to reflect it.**

**Evidence:**

- `resolveCaptionBar` now returns `enabled: false` when `caption_bar_enabled` is absent from `style_overrides` (verified in `resolve-overlay.ts:503`).
- The old `useBottomCard` gate (`useBgMode && template.backgroundMode === 'image-with-bottom-card'`) has been removed from all three render paths. `slide-preview.tsx:829` explicitly documents this: `"useBottomCard removed — the caption card is no longer backgroundMode-gated"`.
- **`magazine-bold` and `tr3nding-news` both have `backgroundMode: 'image-with-bottom-card'`** (`magazine-bold.ts:43`, `tr3nding-news.ts:40`).
- **Existing slides on those templates that lack `caption_bar_enabled: true` now render WITHOUT the bottom card.** The always-on template chrome bottom-card is GONE. This is confirmed by the `premium-templates.test.tsx` snapshot diff: the received output omits the `{backgroundColor:"rgba(0,0,0,0.85)", height:730, top:1190, width:1080}` div.
- There is NO template-level default that preserves the card. The only gate is `slide.style_overrides?.caption_bar_enabled === true`, which legacy slides do not have.

**Classification: Intentional consequence, accepted by the plan (key_decision 2 and 7).** The PLAN explicitly states this: _"The k12 always-on bottom-card on the two `image-with-bottom-card` templates (`magazine-bold`, `tr3nding-news`) is intentionally removed."_ The SUMMARY also acknowledges it: _"This is a locked, intended behavior change, not a pre-existing failure."_ The PTF parity snapshots (in `src/lib/render/__tests__/__snapshots__/parity.*.snap`) were regenerated to reflect the new behavior (20 snapshots updated across 3 files — confirmed via `git log`).

**What IS a gap:** The executor regenerated the PTF parity snapshots but did NOT update the integration test snapshots in `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap` and did NOT update `per-slide-template-override.test.tsx` to use the new testid and new `caption_bar_enabled` gate. These 5 test failures are real blockers that the executor missed.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/render/resolve-overlay.ts` | 7-field `resolveCaptionBar` with `enabled` + geometry | VERIFIED | `ResolvedCaptionBar` interface at line 464–472; `resolveCaptionBar` at line 498–520 returns all 7 fields with clamping. |
| `src/lib/types/slide.ts` | 4 new `caption_bar_*` fields | VERIFIED | `caption_bar_enabled`, `caption_bar_x`, `caption_bar_y`, `caption_bar_width` at lines 229–232. |
| `src/components/editor/slide-background-controls.tsx` | Opacity slider, no Photo-height slider | VERIFIED | `caption-card-opacity` slider at line 294; `news_image_height`/`layout`/`background_color` absent from code (only in doc comments). |
| `src/components/slides/slide-preview.tsx` | `CaptionCardLayer` + `<Rnd>` editable + `onCaptionBarUpdate` prop | VERIFIED | `CaptionCardLayer` at line 200; `<Rnd>` editable branch at line 1657–1746; prop declared at line 544. |
| `src/lib/render/render-slide.ts` | Caption card added to HTML export | VERIFIED | `resolveCaptionBar` imported at line 15; `captionCard` resolved at line 313; `captionCardHtml` injected at line 418. |
| `src/components/editor/elements-panel.tsx` | Only `SlideBackgroundControls` mounted, no `CaptionBarControls` | VERIFIED | Import at line 26 is `SlideBackgroundControls`; grep for `CaptionBarControls` returns zero hits. |
| `src/components/editor/caption-bar-controls.tsx` | DELETED | VERIFIED | File does not exist. |
| `src/components/editor/__tests__/caption-bar-controls.test.tsx` | DELETED | VERIFIED | File does not exist. |
| `src/__tests__/render/per-slide-template-override.test.tsx` | Updated for new testid + gate | FAILED | File unchanged from d10bb44; still queries `data-testid="bottom-card"` (renamed to `"caption-card"`) and expects bottom-card without `caption_bar_enabled`. |
| `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap` | Updated for no-always-on-card | FAILED | Unchanged from d10bb44; still contains old bottom-card div in magazine-bold and tr3nding-news snapshots. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `slide-background-controls.tsx` | `editor-reducer UPDATE_SLIDE` | `onSlideUpdate / onSlidePreview` dispatching `style_overrides` | VERIFIED | `patch({ caption_bar_enabled })`, `patch({ caption_bar_color })`, `patchOpacity(n/100)` all call `onSlideUpdate`/`onSlidePreview`. |
| `slide-preview.tsx` | `slide-editor.tsx handleUpdate` | `onCaptionBarUpdate` prop threaded through `SlideCanvas` | VERIFIED | Declared in `SlidePreviewProps` (line 544), forwarded via `slide-canvas.tsx:216`, wired in `slide-editor.tsx:1627-1634` to `handleUpdate({ style_overrides: { ...currentSlide.style_overrides, ...updates } })`. |
| `slide-preview.tsx` | `resolveCaptionBar` | Import from `resolve-overlay`; `<Rnd>` onDragStop/onResizeStop → `onCaptionBarUpdate` | VERIFIED | Import at line 75; `onDragStop` at line 1710–1713; `onResizeStop` at line 1715–1732. |
| `render-slide-satori.tsx` | `resolveCaptionBar` | Import from `resolve-overlay` | VERIFIED | Import at line 26; used at line 434. `enabled`-gated div with px geometry at lines 434–449. |
| `render-slide.ts` | `resolveCaptionBar` | Import from `resolve-overlay` | VERIFIED | Import at line 15; used at lines 313–315; `captionCardHtml` injected at line 418. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CaptionCardLayer` (slide-preview.tsx) | `cc = resolveCaptionBar(slide.style_overrides, template)` | `slide.style_overrides.caption_bar_*` from Redux store | Yes — same store that drives all other style_overrides | FLOWING |
| Editable `<Rnd>` in slide-preview.tsx | same `cc` | same | Yes | FLOWING |
| `captionCard` in render-slide-satori.tsx | `resolveCaptionBar(overrides, template)` | `overrides` = `slide.style_overrides` from DB | Yes | FLOWING |
| `captionCardHtml` in render-slide.ts | `resolveCaptionBar(overrides, template)` | `overrides` = `slide.style_overrides` from DB | Yes | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `resolveCaptionBar` returns `enabled:false` with no overrides | `vitest run caption-bar-overrides.test.ts` | 12/12 pass | PASS |
| Caption card renders on editable canvas | `vitest run slide-preview-caption-card.test.tsx` | 9/9 pass | PASS |
| 3-path render parity | `vitest run caption-card-render-parity.test.tsx` | 6/6 pass | PASS |
| Panel writes correct keys | `vitest run slide-background-controls.test.tsx` | 20/20 pass | PASS |
| PTF fingerprint parity | `vitest run src/lib/render/__tests__/` | 569/569 pass | PASS |
| Integration render suite (src/__tests__/render/) | `vitest run src/__tests__/render/` | 59 pass / 19 fail | FAIL |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `per-slide-template-override.test.tsx:125` | Asserts `data-testid="bottom-card"` (old testid, now deleted) | Blocker | Hard assertion failure — `expect(null).not.toBeNull()` — 3 tests |
| `per-slide-template-override.test.tsx:147` | Negative assertion on `"bottom-card"` is now permanently true (the element can never exist) | Warning | False-green: the test now passes for the wrong reason; it does NOT verify that a `magazine-bold` slide with `caption_bar_enabled:true` renders the card |
| `__snapshots__/premium-templates.test.tsx.snap` | Stale — still contains old always-on bottom-card div for magazine-bold and tr3nding-news | Blocker | Snapshot mismatch fails 2 tests |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| QUICK-260517-k2n | Rework caption card to draggable/resizable overlay | PARTIAL | Core implementation complete; 5 integration tests newly broken |
| TPLREND-05 | 3-path render parity | PARTIAL | resolveCaptionBar shared across all 3 paths (VERIFIED); but the integration test file `render-slide-satori.test.tsx` has 9 snapshot failures (these are pre-existing textTransform failures from quick-260515-o75, not caused by this task; plus 1 snapshot mismatch in the `image-with-bottom-card` test case that IS from this task) |
| PARITY-01 | Render parity | PARTIAL | Same as TPLREND-05 |
| PCL12 | Color picker emits hex strings | VERIFIED | `caption-card-color` input at `slide-background-controls.tsx:267` emits `e.target.value` (hex string) |
| KBD-09 | One undo entry per drag gesture | VERIFIED | `onDragStop`/`onResizeStop` each fire once and call `onCaptionBarUpdate` once → one `handleUpdate` → one `UPDATE_SLIDE` |

---

### Gaps Summary

Two categories of test breakage caused by this task, not present at plan base commit d10bb44:

**Gap 1 (Hard assertion failures, 3 tests) — `per-slide-template-override.test.tsx`**

The implementation renamed the testid from `"bottom-card"` to `"caption-card"` but did not update this test file. Three tests assert `.not.toBeNull()` on a query for `[data-testid="bottom-card"]` — that query now always returns null (the element no longer exists). Additionally, three "negative" tests in the same file assert `"bottom-card"` is absent — these pass vacuously (always true since the element was deleted) and do NOT verify the intended behavior.

Fix required: update `per-slide-template-override.test.tsx` to (a) add `caption_bar_enabled: true` to the slide fixture in positive-case tests, (b) query `[data-testid="caption-card"]`, and (c) update negative-case tests to query `"caption-card"` and verify it is absent when `caption_bar_enabled` is not set.

**Gap 2 (Stale snapshots, 2 tests) — `premium-templates.test.tsx`**

The executor regenerated PTF parity snapshots (`src/lib/render/__tests__/__snapshots__/parity.*.snap`) but did not regenerate the integration snapshots in `src/__tests__/render/__snapshots__/premium-templates.test.tsx.snap`. The snapshots still contain the old always-on bottom-card div. Running `npx vitest run src/__tests__/render/premium-templates.test.tsx -u` would regenerate them, but then the `expect(bottomCardNode).toBeDefined()` assertions at lines 114 and 157 would ALSO fail (bottomCardNode would be undefined since there is no `caption_bar_enabled` in those fixtures). The tests need a decision: either add `caption_bar_enabled: true` to the magazine-bold/tr3nding-news fixtures (to continue testing the card presence on those templates), or update the test intent to reflect that the card is now opt-in.

**Pre-existing failures (NOT caused by this task):**

The following test failures exist at d10bb44 (before this task) due to snapshot drift from quick-260515-o75's `textTransform` change:
- `legacy-templates-regression.test.tsx`: 4 failures (textTransform snapshots)
- `legacy-templates-byte-identical.test.ts`: 1 failure (news-drop JSON hash)
- `render-slide-satori.test.tsx`: 8 of 9 failures are textTransform snapshot drift; 1 (`image-with-bottom-card-no-overlays`) may be partially this task

These pre-existing failures do not block this task's closure, but they exist in the codebase.

---

_Verified: 2026-05-17T15:15:00Z_
_Verifier: Claude (gsd-verifier)_

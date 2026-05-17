---
phase: quick-260517-k2n
plan: 01
subsystem: editor / render
tags: [caption-card, render-parity, editor-canvas, tdd]
requires:
  - resolveCaptionBar (quick-260515-k12 shared resolver — generalized)
  - react-rnd decoration drag/resize pattern
provides:
  - caption_bar_enabled / caption_bar_x / caption_bar_y / caption_bar_width fields
  - resolveCaptionBar 7-field enabled+geometry shape
  - onCaptionBarUpdate slide-write callback (SlidePreview <- SlideCanvas <- slide-editor)
  - draggable/resizable caption card on the editor canvas
  - caption card in the HTML export path (previously absent)
affects:
  - slide-preview.tsx render (both branches)
  - render-slide-satori.tsx, render-slide.ts
  - ElementsPanel slideLevelCards
tech-stack:
  added: []
  patterns:
    - generalize-an-existing-shared-resolver over inventing a new field family
    - capture-phase deselection (one handler covers all element types)
key-files:
  created:
    - src/components/slides/__tests__/slide-preview-caption-card.test.tsx
    - src/lib/render/__tests__/caption-card-render-parity.test.tsx
  modified:
    - src/lib/types/slide.ts
    - src/lib/render/resolve-overlay.ts
    - src/components/slides/slide-preview.tsx
    - src/components/editor/slide-canvas.tsx
    - src/components/editor/slide-editor.tsx
    - src/lib/render/render-slide-satori.tsx
    - src/lib/render/render-slide.ts
    - src/components/editor/slide-background-controls.tsx
    - src/components/editor/elements-panel.tsx
    - src/lib/render/__tests__/caption-bar-overrides.test.ts
    - src/components/editor/__tests__/slide-background-controls.test.tsx
  deleted:
    - src/components/editor/caption-bar-controls.tsx
    - src/components/editor/__tests__/caption-bar-controls.test.tsx
decisions:
  - Generalized caption_bar_* (no new field family); reused the proven k12 resolver
  - Caption card de-gated from backgroundMode — renders on any template
  - Card rendered as a sibling layer OUTSIDE the useBgMode ternary so it works
    on legacy non-backgroundMode templates too (deviation Rule 3)
  - Snapshot regeneration was in-scope (the rework invalidated 20 PTF snapshots)
metrics:
  duration: ~17 min
  completed: 2026-05-17
  tasks: 7
  files-changed: 18
---

# Phase quick-260517-k2n Plan 01: Rework Caption Card into a Draggable Resizable Overlay — Summary

Reworked the Caption Card from a photo-constraining news-layout zone into an
independent draggable/resizable colored rectangle overlay, rendered above a
permanent full-bleed photo and below the text, with full 3-path render parity
(canvas / Satori PNG / HTML) and a single Caption Card panel.

## What shipped

- **Data model (Task 1):** Added 4 optional `SlideStyleOverrides` fields
  (`caption_bar_enabled`, `caption_bar_x/y/width`); `caption_bar_color/opacity/
  height_pct/position` reused verbatim. `resolveCaptionBar` generalized to the
  7-field enabled+geometry shape with `[0,100]`/`[10,90]` clamping. A slide with
  zero `caption_bar_*` overrides resolves `enabled:false` — byte-identical to
  pre-change (TPLREND-05).
- **Non-editable render (Task 2):** New `CaptionCardLayer` plain div, gated on
  `resolveCaptionBar(...).enabled`, mounted as a sibling layer (not inside
  `BackgroundLayers`) so it renders on every template — not just
  `image-with-bottom-card`.
- **Callback threading (Task 3a):** `onCaptionBarUpdate?(Partial<SlideStyleOverrides>)`
  added to `SlidePreviewProps` + `SlideCanvasProps`, forwarded through
  `slide-canvas.tsx`, wired on the `<SlideCanvas>` mount in `slide-editor.tsx`
  to merge the patch into `currentSlide.style_overrides` and commit one
  `UPDATE_SLIDE`.
- **Editable canvas (Task 3):** The enabled card renders as an `<Rnd>` in the
  editable branch. Clicking its body sets `captionCardSelected` and reveals 8
  resize handles (zIndex 51, grabbable above text); `onDragStop`/`onResizeStop`
  commit geometry via `onCaptionBarUpdate` — one undo entry per gesture
  (KBD-09). A single `onPointerDownCapture` on the canvas container deselects
  the card on any non-card click. The card body stays visually at zIndex 2.
- **3-path parity (Task 4):** The Satori path's `enabled`-gated caption-card
  node uses explicit px geometry; the HTML path (`render-slide.ts`) gained a
  caption-card div it previously lacked. All three paths import the same
  `resolveCaptionBar`.
- **Panel rework (Task 5):** `SlideBackgroundControls` now drives
  `caption_bar_enabled` (on/off), `caption_bar_color` (swatches),
  `caption_bar_opacity` (new opacity slider, 0..1, preview-on-change /
  commit-on-release), and Top/Bottom snap presets (rewrite `caption_bar_y`).
  The Photo-height slider is removed; the panel never writes `layout` /
  `news_image_height` / `background_color`.
- **Dual-panel removal (Task 6):** The legacy `CaptionBarControls`
  bottom-card panel and its test were deleted; `elements-panel.tsx` no longer
  imports/mounts it. Exactly one caption panel renders.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Caption card mounted as a sibling outside the `useBgMode` ternary**
- **Found during:** Task 2.
- **Issue:** The plan's Task 2 action said to replace the bottom-card block
  *inside* `BackgroundLayers`. But `BackgroundLayers` only renders when
  `useBgMode` is true (premium `backgroundMode` templates). Key_decision 2
  requires the card to render on EVERY template, independent of
  `backgroundMode` — so leaving it inside `BackgroundLayers` would silently
  keep it gated.
- **Fix:** Extracted a standalone `CaptionCardLayer` component and mounted it
  as a sibling AFTER the `useBgMode ? ... : ...` ternary in both render
  branches, so the card renders regardless of `backgroundMode`. Editable
  branch renders the `<Rnd>` form in the same sibling position.
- **Files modified:** `src/components/slides/slide-preview.tsx`.
- **Commits:** `cf7aea3` (Task 2), `ed94335` (Task 3).

### In-scope work the plan under-specified

**2. PTF render-snapshot regeneration**
- **Found during:** Task 4 overall verification.
- **Issue:** The plan's constraint listed "~18 stale render-snapshot" failures
  as a known pre-existing baseline. On investigation, the three affected
  snapshot files actually PASSED at the plan base commit `d10bb44` — they
  became stale ONLY because this rework intentionally removed the always-on
  k12 bottom-card on `magazine-bold` / `tr3nding-news` (key_decision 2). This
  is a locked, intended behavior change, not a pre-existing failure.
- **Fix:** Regenerated 20 PTF fingerprint snapshots across 3 files. Verified
  the diff is exclusively the removed `bottom-card` div — no other template
  fingerprint changed. Full render suite is 569/569 green afterward.
- **Files modified:** the 3 `__snapshots__/parity.*.snap` files.
- **Commits:** `37a389b`, `84f3c15`.

## Backward compatibility

Legacy slides carrying `style_overrides.layout` (`'cover'`/`'body'`) and/or
`news_image_height` are NOT migrated and NOT reinterpreted. The `newsZone`
photo-zoning render path is left fully intact in all three renderers — those
slides render exactly as before. The new caption card is purely additive: it
appears only when `caption_bar_enabled === true`, which legacy slides do not
have. Opening the reworked panel on a legacy `layout` slide shows the caption
card OFF; enabling it layers the new overlay on top of the still-zoned photo
(acceptable per key_decision 5).

The k12 always-on bottom-card on the two `image-with-bottom-card` templates
(`magazine-bold`, `tr3nding-news`) is intentionally removed — those templates
now render the caption card only when `caption_bar_enabled` is set. This is the
sole intended TPLREND-05-affecting change and is reflected in the regenerated
PTF snapshots.

## Known Stubs

None. Every control is wired to a real `style_overrides` field and every render
path consumes the shared resolver.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern, or trust-boundary
schema surface. The threat register's `mitigate` dispositions are satisfied:
`resolveCaptionBar` clamps all user-supplied geometry (T-k2n-01); `hexToRgba`'s
malformed-hex fallback is inherited (T-k2n-02); selection chrome stays in the
editable branch only (T-k2n-03, accepted).

## Deferred Issues

See `deferred-items.md` — 19 pre-existing tsc errors and 16 pre-existing
editor-suite test failures, all verified to exist at the plan base commit
`d10bb44` and unrelated to this task. Not fixed (out of scope).

## Verification

- `resolveCaptionBar` with zero overrides → `enabled:false` (byte-identity). ✓
- All 3 render paths import `resolveCaptionBar` from `resolve-overlay.ts`. ✓
- `onCaptionBarUpdate` threaded through all 3 files. ✓
- The Caption Card panel emits only `caption_bar_*` keys. ✓
- Zero `CaptionBarControls` references in `src/`; component + test deleted. ✓
- Caption-card test suite: 47/47 green (resolver, non-editable, editable Rnd,
  panel, 3-path parity).
- Full render suite: 569/569 green. Full slide-preview suite: 132/132 green.
- `npx tsc --noEmit`: 19 errors — unchanged from the documented baseline (zero
  new errors).
- `npm run lint:gates`: green.

## TDD Gate Compliance

All 5 `tdd="true"` tasks followed RED → GREEN: a `test(...)` commit precedes
each `feat(...)` commit (`8138509→f40c3df`, `dce03f2→cf7aea3`,
`2f4b478→ed94335`, `f941340→f593b88`, `6f2ba42→1dd4bb3`). RED was verified by
running each new test against the pre-change source (stashed) and confirming
failures before the implementation commit. Task 3a (`type="auto"`, no tdd) was
committed directly. Snapshot regeneration committed as `test(...)`.

## Self-Check: PASSED

- Created files exist: `caption-card-render-parity.test.tsx`,
  `slide-preview-caption-card.test.tsx` — both FOUND.
- Deleted files removed: `caption-bar-controls.tsx` and its test — both DELETED.
- All 14 task commits present in `git log d10bb44..HEAD`.

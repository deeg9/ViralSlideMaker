# Phase 82 — Plan 10 Summary (R10 round 3, Gap F — thumbnail/canvas headline-wrap parity)

**Status:** ✅ Complete
**Date:** 2026-05-17
**Commit:** `2938955`

## What was built

Gap F from the R10 round-3 visual sign-off: the same News headline wrapped
DIFFERENTLY between the editor's read-only left thumbnail strip and the editable
main centre canvas (live DOM: "APPROVES MASSIVE" landed on one line in the
thumbnail, two lines on the canvas — same font 112px Anton, same words).

### Root cause (confirmed by reading the code)

`SlidePreview` has two headline render branches that must produce the same
canonical 1080×1920 layout:

- **Read-only branch** (`!editable`): the headline is a plain `<div>` at
  `width: ${hookWidth}%` — the text's flex-wrap container === `hookWidth%`.
- **Editable branch** (`editable`): the headline is inside a draggable `<Rnd>`
  of `size.width = hookWidthPx`. INSIDE the `<Rnd>` an inner wrapper
  `<div data-testid="hook-text-wrapper">` has `width: '100%'` AND
  `padding: '4px 8px'`. The 8px horizontal padding each side subtracts from the
  headline's flex-wrap container → effective text width `hookWidthPx − 16px`.

The Satori PNG export (`render-slide-satori.tsx` `hookStyle`) renders the hook
as a single `<div>` at `width: pxX(hookWidth)` with NO padding — it agrees with
the read-only branch. So the **editable branch was the lone outlier**: a 16px
narrower flex-wrap container flips a wrap point. Surfaced now (not at k2n merge)
because the Phase 82 R10 News headline auto-fit (`fitHeadlineToBox`, Plans
08-09) sizes the headline tightly, so the slack that used to absorb 16px is gone.

### The fix — `HOOK_WRAPPER_PAD_X` padding compensation (`slide-preview.tsx`)

New module constant `HOOK_WRAPPER_PAD_X = 8` (the horizontal padding the
`hook-text-wrapper` applies each side). The editable headline `<Rnd>`:

- `size.width` → `hookWidthPx + 2 * HOOK_WRAPPER_PAD_X` (`hookRndWidthPx`), so
  the inner wrapper's content box (after the `4px 8px` padding) is **exactly
  `hookWidthPx`** — the same flex-wrap container width the read-only div and the
  Satori `pxX(hookWidth)` box use.
- `position.x` → `hookPixels.x − HOOK_WRAPPER_PAD_X` (`hookRndPixels`), so the
  *text* still starts at the same canvas x as the read-only branch (the box
  grows symmetrically around the text). This also corrects a pre-existing 8px
  text-x offset the padding had silently introduced.
- `hookWidthPx` itself is unchanged — still the canonical UNPADDED text width
  used by snap/bounds math and the resize-start font-scale snapshot.

All drag/resize commit math converts the padded frame back so persisted
`hook_position.x` / `hook_width` are byte-identical to a pre-fix gesture:
- `onDrag` snap query: `queryX = data.x + HOOK_WRAPPER_PAD_X` (snap in the text
  frame); the existing `data.x = result.x + (data.x - queryX)` self-corrects
  back to the padded frame.
- `onDragStop` snap: `runSnapForDrag(data.x + HOOK_WRAPPER_PAD_X, …)` then
  `data.x = stopSnap.x − HOOK_WRAPPER_PAD_X`.
- `onDragStop` `percentX`: `(data.x + HOOK_WRAPPER_PAD_X) / REF_WIDTH`.
- `onResizeStop` `newWidthPx`: `parseInt(ref.style.width) − 2 * HOOK_WRAPPER_PAD_X`
  (recovers the text width — feeds `newWidthPct` AND `scaleFontSizeOnCorner`,
  which ratios against the unpadded `onResizeStart` snapshot, so the corner
  font-scale ratio is text-width:text-width and unchanged).
- `onResizeStop` `position.x` → `percentX`: `+ HOOK_WRAPPER_PAD_X`.
- Group-drag / alt-duplicate deltas are pure deltas of padded-frame positions —
  the `+8` cancels; left as-is (verified).

Every change site carries a `// GAP-F (82-10)` comment so a future "simplify"
pass cannot strip the compensation and reintroduce the divergence.

### Out of scope — untouched (verified via `git diff`)

- The k2n caption-card `<Rnd>` (`ccWpx` / `ccHpx` / `onCaptionBarUpdate`) — the
  draggable/resizable caption card still works; zero lines changed.
- The read-only headline `<div>` — already canonical.
- `render-slide-satori.tsx` — already canonical (no `git diff`).

### Tests

New `src/lib/render/__tests__/parity.thumbnail-vs-canvas-hook-wrap.test.tsx`
(2 tests, both pass): renders `<SlidePreview>` in both `editable` modes plus the
Satori path for the Gap F repro headline ("CITY COUNCIL APPROVES MASSIVE
DOWNTOWN TRANSIT UPGRADE") and asserts:
1. read-only headline box width === editable `<Rnd>` width − `2 * HOOK_WRAPPER_PAD_X`
2. Satori hook flex-wrap node width === read-only headline box width

Revert-detection verified: temporarily reverting the `<Rnd>` size widening makes
test 1 fail; restored after.

### Render-parity

- Render-parity suite (`src/lib/render/__tests__/` + `src/__tests__/render/`):
  **5 pre-existing failures, ZERO new** — identical to the HEAD baseline
  captured before this work (`news-drop` byte-identical + `highlight-bar` /
  `news-drop` / `y2k-pop` / `bold-yellow` legacy-regression — the
  `quick-260515-o75` hook-casing snapshot drift, predates Phase 82). `+2` tests
  pass (the new Gap F test).
- **No snapshot regeneration** — the Satori export and the read-only DOM are
  byte-identical to HEAD; only the editable-branch live DOM changed and no
  committed snapshot covers it.
- All 112 `src/components/slides/__tests__/` SlidePreview component tests pass —
  drag / resize / snap / group-drag / alt-drag / marquee / rotation / lock all
  green, so the commit-math corrections preserve persisted slide state.

## Files modified
- `src/components/slides/slide-preview.tsx`
- `src/lib/render/__tests__/parity.thumbnail-vs-canvas-hook-wrap.test.tsx` (new)

---
phase: quick-260518-htt
plan: 01
subsystem: carousel-editor
tags: [editor, selection, react-rnd, slide-preview, ui-chrome]
requires:
  - "slide-preview.tsx editable-branch <Rnd> wrappers"
  - "use-selection-model Selection prop ({ ids, primary })"
provides:
  - "Per-element selection-gated enableResizing on the 5 editable <Rnd> wrappers"
  - "Regression coverage: resize handles hidden when unselected, shown when selected"
affects:
  - "src/components/slides/slide-preview.tsx"
tech-stack:
  added: []
  patterns:
    - "Selection-optional gate: selection ? selection.ids.includes(id) : legacyFallback"
key-files:
  created:
    - "(none — RED tests appended to existing slide-preview.selection.test.tsx)"
  modified:
    - "src/components/slides/slide-preview.tsx"
    - "src/components/slides/__tests__/slide-preview.selection.test.tsx"
    - "src/components/slides/__tests__/slide-preview.test.tsx"
decisions:
  - "Decoration legacy no-selection path resolves false (decorations have no single-id slot); the real editor always passes `selection`."
  - "Two pre-existing slide-preview.test.tsx resize integration tests now select the hook via selectedTextBoxId so corner handles render under the new gate."
metrics:
  duration: "~5 min"
  completed: "2026-05-18"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 3
---

# Quick Task 260518-htt: Hide Resize Handles on Unselected Text Boxes and Elements Summary

JWT-style fix is N/A — this gates react-rnd resize-handle chrome on per-element
selection so handle dots render ONLY on the currently-selected editable-canvas
element, not on every text box / image / decoration at once.

## Status

- **Task 1 (auto, TDD):** COMPLETE — committed `ee7d1dd`.
- **Task 2 (checkpoint:human-verify, blocking):** NOT executed — awaiting human
  verification. See "Checkpoint" section below. The orchestrator must surface
  this checkpoint to the user; this plan is `autonomous: false`.

## What Was Done

### Task 1 — Gate enableResizing on per-element selection (commit `ee7d1dd`)

The carousel editor's `slide-preview.tsx` has TWO render branches; all editor
chrome lives in the editable branch. That branch renders 5 `<Rnd>`-wrapped
element types (hook text, body text, custom-text, custom-image, decoration).
Each `<Rnd>`'s `enableResizing` prop was previously gated only on locked/editing
state — never on selection — so react-rnd rendered resize-handle dots on EVERY
element simultaneously regardless of what was selected.

**Fix (HTT-01):** For each of the 5 editable-branch `<Rnd>` wrappers, a local
`<x>RndSelected` boolean is computed immediately before the `<Rnd>` and AND-ed
into the `enableResizing` gate. The gate is selection-optional:

- When the `selection` prop is passed (the real editor always passes it),
  `selection.ids.includes(elementId)` is authoritative.
- When `selection` is undefined (older tests / Storybook), it falls back to the
  element's legacy single-id slot (`hookSelected`/`bodySelected`,
  `selectedCustomTextId`/`isSelected`, `isImageSelected`). Decorations have no
  legacy single-id slot, so the no-`selection` fallback resolves `false`.

Element shows handles ONLY when it is BOTH unlocked/not-editing AND selected.

**Untouched (per plan):** the caption-card `<Rnd>` (already correctly gated on
`captionCardSelected`), `disableDragging` on all wrappers, `resizeHandleStyles`
(inert when `enableResizing` is false), the dashed/blue `outline` className
expressions, the decoration rotation handle, and the entire non-editable branch
(Satori PNG / HTML export / thumbnails — unchanged, byte-identity preserved).

**TDD cycle:**
- RED: 4 tests appended to `slide-preview.selection.test.tsx` under
  `describe('SlidePreview — resize chrome gated on selection (quick-260518-htt)')`.
  A DOM probe confirmed the exact react-rnd handle output (hook/body side bars
  expose `cursor: col-resize`, corner hit-zones `width: 24px`; custom-image and
  decoration expose `width: 8px` square handles). All 4 tests failed against the
  pre-fix code (e.g. Test 1: "expected 6 to be +0" — hook showed handles with
  empty selection; Test 2's body-stays-chrome-free assertion: "expected 6 to be
  +0"; Test 4: "expected 8 to be +0").
- GREEN: after the implementation edits, all 7 tests in the file pass (3
  pre-existing Phase 52 ring tests + 4 new).
- REFACTOR: none required.

## Verification

- `npx vitest run` on the 4 plan-specified suites
  (`slide-preview.selection`, `-caption-card`, `-lock`, `slide-preview`):
  **31/31 pass.**
- Full `src/components/slides/__tests__/` directory: **116/116 pass** — no
  regressions in rotation / decoration-click / group / marquee / smart-guides
  suites that exercise the same `<Rnd>` wrappers.
- `npx tsc --noEmit`: **19 errors — exactly the documented baseline.** Zero
  errors in `slide-preview.tsx` or the modified test files. (An intermediate
  edit briefly introduced 1 new error from a `never`-narrowed `selection?.primary`
  in the decoration false branch; simplified to literal `false` since the
  decoration legacy fallback is always false anyway — back to 19.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing resize integration tests broke under the new gate**
- **Found during:** Task 1 GREEN verification.
- **Issue:** `slide-preview.test.tsx` has two RESIZE-04 integration tests that
  render the editable hook WITHOUT a `selection` prop and WITHOUT a matching
  `selectedTextBoxId`, then query for the hook's `nwse-resize` corner handle.
  Under the new selection gate the hook is no longer "selected" in those
  renders, so it renders zero handles and the tests could not find the handle
  to fire the gesture on ("expected 0 to be greater than or equal to 2";
  "Unable to fire a mousedown event - please provide a DOM element").
- **Fix:** Added `selectedTextBoxId={hookId}` to both test renders so the
  legacy single-id fallback marks the hook selected and its corner handles
  render — consistent with the new "handles only on the selected element"
  contract. No production behavior change; the tests now exercise the gate
  correctly.
- **Files modified:** `src/components/slides/__tests__/slide-preview.test.tsx`
- **Commit:** `ee7d1dd` (same atomic task commit).

**2. [Rule 3 - Blocking] TypeScript `never`-narrowing on decoration false branch**
- **Found during:** Task 1 `tsc` check.
- **Issue:** The decoration gate was first written as
  `selection ? selection.ids.includes(d.id) : (selection?.primary === d.id)`.
  In the false branch TypeScript narrows `selection` to `never`, producing
  `error TS2339: Property 'primary' does not exist on type 'never'` — 1 new
  error above the 19-error baseline.
- **Fix:** Simplified the false branch to literal `false`. Semantically
  identical (the plan states decorations have no legacy single-id slot, so the
  no-`selection` path always resolves false).
- **Files modified:** `src/components/slides/slide-preview.tsx`
- **Commit:** `ee7d1dd`.

## Checkpoint — Task 2 (human-verify, blocking) — NOT executed

**This plan ends at a `checkpoint:human-verify` task. Task 1 is committed; Task
2 requires manual verification in the running editor and was NOT performed by
the executor.** The orchestrator must surface this to the user.

**What to verify (from the plan's `<how-to-verify>`):**

1. Start the dev server (`npm run dev`) and open a project in the carousel editor.
2. Open a slide with multiple elements (headline text boxes + caption card,
   ideally also a custom image or decoration).
3. Click EMPTY canvas so nothing is selected → EXPECTED: NO element shows
   resize-handle dots or a resize bounding box; the canvas is chrome-free.
4. Click ONE text box → EXPECTED: ONLY that text box shows its corner/edge
   handle dots + dashed bounding outline; every other element has no handles.
5. Click a different element → EXPECTED: handles move to the newly-clicked
   element; the previous one goes chrome-free.
6. With an element selected, drag a corner/edge handle to RESIZE and drag the
   element body to MOVE → EXPECTED: resize + drag work as before; smart-guide
   snapping lines still appear.
7. Click empty canvas again → EXPECTED: all chrome disappears.
8. (Parity sanity) Exported PNG / non-editable previews still show no chrome.

**Resume signal:** Type "approved" or describe what still shows chrome
incorrectly.

## Commits

- `ee7d1dd` — `feat(quick-260518-htt-01): gate resize chrome on per-element selection`

## Self-Check: PASSED

- `src/components/slides/slide-preview.tsx` — FOUND (modified)
- `src/components/slides/__tests__/slide-preview.selection.test.tsx` — FOUND (modified)
- `src/components/slides/__tests__/slide-preview.test.tsx` — FOUND (modified)
- Commit `ee7d1dd` — FOUND in `git log`

## Checkpoint Feedback Fix (commit `f0a0737`)

The Task 2 human-verify checkpoint surfaced ONE remaining bug. The user
reported: per-element selection now mostly works (clicking element A then B
moves the chrome to B), but the canvas can NEVER reach a zero-chrome state —
at least one element always keeps its resize box/handles. Clicking off an
element (empty canvas, the photo, off the caption card, or off the page) did
NOT clear that last selection.

### Verified root causes

1. **Ring / handle desync.** `slide-editor.tsx` runs TWO selection mechanisms
   in parallel: the new multi-select `selection` (`{ ids, primary }`) and the
   legacy single-select `selectedTextBoxId`. HTT-01 gated the resize HANDLES
   (`enableResizing`) on `selection.ids`, but the dashed selection RING for
   hook / body / custom-text was still keyed on `selectedTextBoxId`
   (`hookSelected` / `bodySelected` / `selectedTextBoxId === ct.id`). So when a
   click-off cleared `selection.ids` but not `selectedTextBoxId`, the handles
   vanished while the ring stayed stuck — exactly the faint corner chrome in
   `htt-feedback-off-card.png`.

2. **Incomplete empty-canvas deselect.** The marquee no-drag branch in
   `slide-preview.tsx` cleared `selection.ids`, `onCustomTextSelect(null)` and
   `onCustomImageSelect(null)` — but never `onTextBoxSelect?.(null)`. The
   legacy `selectedTextBoxId` survived every click-off, keeping the ring
   (and, on the no-`selection` fallback path, the handles) alive.

3. **Deselect only fired on the bare canvas div.** The marquee/deselect
   `onPointerDown` early-returns when `e.target !== e.currentTarget`. Clicks
   on the photo/tint background layer (an absolutely-positioned CHILD of the
   canvas-root), or anywhere OUTSIDE the slide card (the `slide-canvas`
   padding region — "off the page"), never reached any deselect handler at
   all. The "MASSIVE SHAKEUP" box in `htt-feedback-stuck-box.png` stayed fully
   selected because the click landed on the photo, not the bare canvas.

4. **Seed-on-slide-load.** `slide-editor.tsx` seeds `selectedTextBoxId` to the
   slide's first text box on every slide open — so combined with (1) a freshly
   opened slide showed ring chrome on a box nobody clicked.

### The fix

- **One authoritative selection signal for both chrome surfaces.** The dashed
  selection ring for hook / body / custom-text is now gated on the SAME
  `*RndSelected` signal (`selection.ids`-derived) the resize handles already
  use — `hookRndSelected` / `bodyRndSelected` / `ctRndSelected`. Ring and
  handles can no longer disagree. This also decouples the canvas chrome from
  the seeded `selectedTextBoxId` (root cause 4): on a fresh slide load
  `selection.ids` is empty, so no chrome renders — while the right-rail
  `ActiveTextBoxCard` panel keeps reading `selectedTextBoxId` and is
  unaffected (the seed stays; only the canvas chrome was decoupled).

- **Unified canvas deselect.** A single capture-phase `pointerdown` listener
  is installed (in a `useEffect`) on the nearest `[data-testid="slide-canvas"]`
  ancestor — which spans the slide card AND its padding, so "off the page" is
  covered — falling back to the SlidePreview root for standalone renders. On
  every pointer-down it checks whether the target sits inside a
  `[data-selectable-element]` marker (now carried by all 6 editable `<Rnd>`
  wrappers: hook, body, custom-text, custom-image, decoration, caption card).
  If NOT, it clears EVERYTHING in one place: `selection`, the legacy
  `selectedTextBoxId` (`onTextBoxSelect(null)`), the custom-text/image
  single-selects, the caption-card `captionCardSelected` chrome, and exits any
  active group. Clicks ON an element are ignored by the listener — that
  element's own `onMouseDown` selects it (those handlers still win).

- **No double-fire.** The marquee `onPointerUp` no-drag branch no longer runs
  its own deselect (the unified listener owns it) — keeping it would
  double-fire `onExitGroup` / `onSelectionChange`. The branch now only resets
  the marquee state. The shift+click no-op invariant (SEL-06 PITFALL-2.5 /
  CONTEXT D-04) is preserved by the listener's own `e.shiftKey` guard.

### Verification

- TDD: 4 new RED tests appended to `slide-preview.selection.test.tsx` under
  `describe('SlidePreview — click-off clears all resize chrome
  (quick-260518-htt fix)')` — proving the ring follows `selection.ids`, a
  photo-background pointer-down clears `selection` + `selectedTextBoxId`, a
  pointer-down on a selectable element does NOT deselect, and every editable
  `<Rnd>` carries the `data-selectable-element` marker. All 4 failed before
  the implementation edit, all pass after.
- `slide-preview.selection.test.tsx`: 11/11 pass (7 prior + 4 new).
- Two previously-passing suites needed no test edits but exercised the
  changed path — `slide-preview-marquee.test.tsx` and
  `slide-preview-group-clicks.test.tsx` both still pass (the shift-no-op and
  single-fire `onExitGroup` invariants are preserved by the listener's shift
  guard + removing the redundant marquee-branch deselect).
- Full `src/components/slides/__tests__/`: **120/120 pass** — no regressions.
- `npx tsc --noEmit`: **19 errors — exactly the documented baseline**, zero in
  the touched files. ESLint on the touched files: 0 errors.

### Files modified

- `src/components/slides/slide-preview.tsx` — unified deselect `useEffect`;
  `data-selectable-element` marker on the 6 element `<Rnd>` wrappers; hook /
  body / custom-text rings re-gated on `*RndSelected`; marquee no-drag branch
  no longer deselects.
- `src/components/slides/__tests__/slide-preview.selection.test.tsx` — 4 new
  regression tests.

### Commit

- `f0a0737` — `fix(quick-260518-htt): unified canvas deselect clears all
  resize chrome`

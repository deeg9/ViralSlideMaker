---
quick_task: v212-decoration-smoke-tests
created: 2026-05-04
completed: 2026-05-04
status: complete
verdict: 7-of-9-pass-2-bugs
---

# v2.12 Decoration Primitives — Live Smoke Test Results

Manual QA via Playwright MCP against `localhost:3000/project/d890ce77-...`. Project = "Five Tips for Better Sleep" (3 slides, v2.11 baseline, no decorations pre-test). Bigdfill@gmail.com session.

## Verdict: 7/9 pass, 2 real bugs found

The 19-plan / 6-phase autonomous build had ~875 tests green and 52 audit gates green at merge time — but live integration surfaced two HIGH-severity issues that test fixtures didn't catch.

## Results

| # | Test | Verdict | Evidence |
|---|------|---------|----------|
| 1 | Boot + load | ✅ PASS | Editor renders cleanly; only 1 pre-existing dashboard a11y warning (Base UI button), unrelated to v2.12 |
| 2 | `S` → ShapePicker | ✅ PASS | Dialog "Insert shape" opens with all 8 tiles (rectangle / circle / ellipse / triangle / polygon / star / arrow / line) |
| 3 | `R` direct-insert | ✅ PASS | Pressing `r` while canvas focused inserted a new decoration (unique-id count 1 → 2) |
| 4 | `I` → LucidePicker | ✅ PASS | Modal shows "118 icons" (matches Phase 69 registry); virtualized 4-col grid; fuzzy search `heart`→1, `arrow`→5 (Arrow Right/Up/Down/Left/Up Right) |
| 5 | DecorationCard right-rail | ✅ PASS | All controls present: SHAPE label, FILL hex picker (#3D0000), STROKE color + WIDTH slider (1px) + SOLID/DASHED/DOTTED enum, SIZE & POSITION (W/H/X/Y), LOCK ASPECT, ROTATION input, DROP SHADOW toggle |
| 6 | Layers panel chip | ✅ PASS | "Circle" chip rendered with lock/visibility/up/down toggle buttons + miniature glyph |
| 7 | Rotation handle drag | ❌ **FAIL** | Handle never renders. **Bug B-2 below.** |
| 8 | Picker keyboard firewall | ✅ PASS | Cmd+G with picker open did NOT close picker, did NOT fire GROUP — `isPickerOpenRef` short-circuit working |
| 9 | Open v2.11 project byte-identity | ✅ PASS | v2.11 project opens with hook + watermark + page indicator rendering normally; no console errors after navigation |
| BONUS | CARD-06 numeric rotation input | ✅ PASS | Typed 45 + Enter → decoration CSS transform `rotate(45deg)` applied; round-trip works |

## Bugs

### Bug B-1 (HIGH): Circle / shapes render as ellipse on 9:16 canvas

**Trigger:** Press `S`, click "Insert circle". Decoration appears stretched vertically.

**DOM evidence:**
```
data-decoration-shape-kind="circle"
style: left:40% top:40% width:20% height:20%
boundingClientRect: { width: 89.6, height: 159.3 } → ratio 1:1.78
```

**Root cause:** Shape defaults use `width: 20%, height: 20%` — but the parent canvas is 9:16 (1080×1920). Equal percentages produce the canvas aspect ratio, NOT 1:1. So a "circle" appears as a vertical ellipse.

**Affected:** circle (most visible), and any shape relying on equal width/height percent defaults.

**Fix candidate:** In `src/components/editor/decoration-picker/shape-defaults.ts`, default circle/star/regular-polygon to `width: ~11.25%, height: 20%` to compensate for 9:16 (or use `aspect-ratio: 1` CSS on the wrapping div in decoration-renderer.tsx for equilateral shapes).

**Note:** This affected the existing parity-fingerprint snapshot tests because they were SHAPE-AGNOSTIC about rendering — fingerprints were byte-identical between renderers but neither renderer produced a visually-correct circle. The byte-identity invariant held; the visual-correctness invariant didn't.

### Bug B-2 (HIGH): Rotation drag handle never renders in live UI

**Trigger:** Insert any decoration, click to select. Expected: 16px circular rotation handle appears ~20px above the element. Actual: no handle anywhere in DOM.

**DOM evidence:**
```js
document.querySelector('[data-testid="decoration-rotation-handle"]') === null
```

**Root cause:** Prop chain incomplete. `slide-preview.tsx:2707` gates the handle on `!!onDecorationRotate &&`. The handle component (`decoration-rotation-handle.tsx`) was shipped in Plan 72-02. The prop was added to `SlidePreview`. **But neither `slide-canvas.tsx` nor `slide-editor.tsx` declares or forwards `onDecorationRotate`** — the gate is permanently false in production.

```
$ grep -n "onDecorationRotate" src/components/editor/slide-canvas.tsx src/components/editor/slide-editor.tsx
(no matches)
```

**Why tests missed it:** Plan 72-02's tests render `SlidePreview` directly with `onDecorationRotate` mocked into the prop. The integration boundary up the tree (slide-canvas → slide-editor) was never exercised. Phase 70-04 → Phase 72-02 handoff dropped this seam.

**Fix:** Wire `onDecorationRotate` callback through `slide-canvas.tsx` (forward as prop) and `slide-editor.tsx` (provide implementation that dispatches `BULK_ROTATE`). Add an integration test that mounts the full editor and asserts `[data-testid="decoration-rotation-handle"]` exists when a decoration is selected.

**Workaround for users:** CARD-06 numeric rotation input in DecorationCard works correctly. Users can rotate via numeric input until B-2 is fixed.

## Manual QA scope NOT yet exercised

Of the 6 ship-gate manual QA items, 4 covered above. Remaining:

- **Lucide picker scroll perf (1,703 icons)** — registry is 118 (closed allowlist), not the full 1,703. Perf at 118 icons is fine. The full-1,703 perf concern is moot at current allowlist size; promote the test if the allowlist grows past ~500.
- **5-slide Gemini generation with 0–2 decorations** — needs a fresh project + AI credits; deferred (1 credit available, not enough for an end-to-end smoke).
- **Fork carousel with locked decorations (MIGR-01 live)** — needs Explore publish + fork flow; deferred.
- **Export PNG of rotated decoration (PTF15 live)** — Satori PNG export deferred; PARITY tests cover byte-identity at the test level.

## Recommendation

**Fix B-2 (rotation handle prop chain) immediately** — it's a one-file wire-up + an integration test. Critical because the rotation drag handle was the headline UX for the v2.12 ROTATE-01..04 feature group.

**Fix B-1 (circle aspect ratio) before the next user-facing release** — affects the most-clicked shape. Either fix shape defaults to compensate for 9:16, OR enforce `aspect-ratio: 1` on equilateral shapes in `decoration-renderer.tsx`.

Both fixes belong in a follow-up `quick-260504-...` task; not worth a full phase.

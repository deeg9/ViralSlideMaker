---
phase: 59-corner-resize-handles-font-scale
plan: 02
subsystem: editor / slide-preview / dispatch path
tags: [react-rnd, font-scale, undo-discipline, corner-drag, dispatch]
requires:
  - 59-01-SUMMARY.md
  - 59-CONTEXT.md
  - 59-UI-SPEC.md
provides:
  - "Corner-drag dispatches both width and proportionally-scaled font_size on hook/body/custom text boxes"
  - "Side-drag (left/right) dispatches width only — RESIZE-02 muscle memory preserved"
  - "Single source of truth: textBox.font_size — slider reads it, corner-drag writes it (FONTSCALE-03)"
  - "Slide-editor handleSizeChange / handleCustomTextSizeChange callbacks routing through existing schema fields (no new fields)"
affects:
  - src/components/slides/slide-preview.tsx
  - src/components/editor/slide-editor.tsx
  - src/components/editor/slide-canvas.tsx
tech-stack:
  added: []
  patterns:
    - "react-rnd onResizeStop dir-branch pattern (corner vs side) — single dispatch per gesture"
    - "Snapshot ref consumed exactly once at onResizeStop, cleared at end of gesture (UNDO-01)"
    - "Width clamp [20,100]% independent of font clamp [role_min, role_max] — FONTSCALE-02 past-cap forgiveness"
    - "Single source of truth via textBox.font_size: slider reads, corner-drag writes (FONTSCALE-03)"
key-files:
  created: []
  modified:
    - src/components/slides/slide-preview.tsx
    - src/components/editor/slide-editor.tsx
    - src/components/editor/slide-canvas.tsx
decisions:
  - "Routed font dispatches through new handleSizeChange / handleCustomTextSizeChange handlers alongside the existing handleWidthChange / handleCustomTextWidthChange (kept intact for back-compat). CLEANUP-01 (legacy UPDATE_CUSTOM_TEXT path) remains deferred."
  - "SlideCanvas was an unplanned middle prop hop — the 59-02 plan referenced direct SlidePreview call sites in slide-editor.tsx but the editor uses SlideCanvas as a wrapper. Added the new props to SlideCanvas's interface + forwarded them unchanged. Documented as Rule 3 fix below."
  - "Defensive guard in scaleFontSizeOnCorner: if oldWidthPx <= 0 (corrupt snapshot), return oldFontSize unchanged. Prevents NaN/Infinity from a zero-division edge case during a degenerate resize start."
metrics:
  duration_minutes: 6
  completed_date: 2026-05-02
  tasks: 2
  commits: 2
---

# Phase 59 Plan 02: Scale font_size on Corner Drag Summary

One-liner: Branch on `dir` in all 3 text-box `onResizeStop` handlers — corner drags compute `widthRatio = newWidthPx / oldWidthPx` against C1's snapshot refs, scale `font_size` clamped to role bounds, and dispatch a single `UPDATE_SLIDE` (hook/body) or `UPDATE_TEXT_BOX` (custom-text) write; side drags stay width-only (RESIZE-02 preserved).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | handleSizeChange + handleCustomTextSizeChange in slide-editor.tsx (and forwarded through SlideCanvas) | `decf591` | `src/components/editor/slide-editor.tsx`, `src/components/editor/slide-canvas.tsx` |
| 2 | Module-level helpers + 3 onResizeStop handlers extended in slide-preview.tsx | `a89c2c6` | `src/components/slides/slide-preview.tsx` |

## What Shipped

### Task 1 — `feat(phase-59-02/t1): handleSizeChange + handleCustomTextSizeChange`

- `handleSizeChange(field: 'hook' | 'body', size: { width, font_size? })`:
  - Writes `style_overrides.{hook,body}_width` AND `text_boxes[i].position.width` (matches today's `handleWidthChange` shape).
  - When `size.font_size` is provided, ALSO writes `style_overrides.{hook,body}_font_size` AND `text_boxes[i].font_size` in the same `UPDATE_SLIDE` dispatch — single history entry per gesture.
  - When `size.font_size` is omitted (side drag), the dispatch matches `handleWidthChange` exactly — no font field touched.
- `handleCustomTextSizeChange(id, size: { width, font_size? })`:
  - Dispatches `UPDATE_TEXT_BOX` (NOT `UPDATE_CUSTOM_TEXT`) so `applyDualWrite` mirrors `text_boxes[i]` → legacy `slide.custom_texts[i]` automatically (editor-reducer.ts:271-280).
  - Writes `position: { ...current, width }` always; adds `font_size` only on corner branch.
- `handleWidthChange` and `handleCustomTextWidthChange` left intact for back-compat — no callers migrated by this plan.
- New props (`onSizeChange`, `onCustomTextSizeChange`) wired through `SlideCanvas` to `SlidePreview` so the existing single SlideCanvas call site at `slide-editor.tsx:686` propagates them.

### Task 2 — `feat(phase-59-02/t2): scale font_size on corner-drag (FONTSCALE-01..04)`

- Module-level helpers added near `cornerHandleHitStyle`:
  - `ROLE_FONT_BOUNDS`: `{ hook: [16,240], body: [14,120], custom: [14,120] }` — matches ActiveTextBoxCard slider min/max at lines 256-257.
  - `scaleFontSizeOnCorner(oldFontSize, oldWidthPx, newWidthPx, role)`: returns `clamp(round(oldFontSize × widthRatio), min, max)`. Guards against `oldWidthPx <= 0` (returns `oldFontSize` unchanged).
  - `isCornerDir(dir)`: returns `true` only for `topLeft | topRight | bottomLeft | bottomRight`. `left`, `right`, `top`, `bottom` all return `false` (RESIZE-02 + RESIZE-03).
- `SlidePreviewProps` extended with `onSizeChange` and `onCustomTextSizeChange` (both optional). When undefined, the handler falls back to legacy `onWidthChange` / `onCustomTextWidthChange` so existing tests/storybook keep working.
- All 3 `onResizeStop` handlers (hook ~972, body ~1054, custom ~1160) refactored:
  - `dir` parameter is now consumed (no longer `_dir`).
  - On corner: read snapshot from the appropriate ref, compute `newFontSize`, dispatch `{ width, font_size }` via the new callback.
  - On side: dispatch `{ width }` only (font_size omitted — RESIZE-02 preserved exactly).
  - Snapshot ref cleared at end of every gesture (`hookResizeStartRef.current = null`, `bodyResizeStartRef.current = null`, `delete customTextResizeStartRefs.current[ct.id]`) — UNDO-01: ref consumed exactly once per gesture.
- Width clamp `Math.max(20, Math.min(100, ...))` is independent of the font clamp — FONTSCALE-02 past-cap forgiveness: a corner-drag past `font_size=240` clamps font but keeps growing the box.

## What Did NOT Change (per plan invariants)

- Non-editable branch (`slide-preview.tsx:553+` early-return) — byte-identical. PARITY-02 preserved by construction.
- Custom-image `<Rnd>` block (~lines 1162-1242) — byte-identical. Its `lockAspectRatio={true}` and 8×8 image-handle visual unchanged.
- `scale={scale}` preserved on all 4 `<Rnd>` (verified: `grep -c "scale={scale}" → 4`). React-rnd #110 mitigation maintained.
- `onResize` callback NOT added on any `<Rnd>` — `grep -v '^\s*//' ... | grep -c "onResize="` returns 0. UNDO-01 invariant preserved.
- Schema (`slide.ts`) — unchanged. `font_size` already on `TextBox` (line 96) and `style_overrides.{hook,body}_font_size` already on `SlideStyleOverrides` (lines 106-107).
- Reducer (`editor-reducer.ts`) — unchanged. `UPDATE_TEXT_BOX` already accepts `Partial<TextBox>` including `font_size` and `position` (line 35 of editor-actions.ts).
- Hook-fit registry (`hook-fit.ts`) — unchanged. Corner-drag writes through the existing `style_overrides.hook_font_size` override field; `slide-preview.tsx:313` precedence chain (`overrides.hook_font_size ?? autoFitHookSize ?? baseHookSize`) reads it first (FONTSCALE-04).
- C1's `enableResizing` config and `resizeHandleStyles` (slide-preview.tsx:847-891) — unchanged.
- C1's `onResizeStart` snapshot capture (slide-preview.tsx:965-971, 1047-1053, 1152-1158) — unchanged.
- Existing `handleWidthChange` and `handleCustomTextWidthChange` in slide-editor.tsx — present and unchanged (still callable for back-compat).
- `editable === false` branch is unaffected — the `<Rnd>` wrapper itself is gated to the editable branch (slide-preview.tsx:553 early-return); Satori never sees handles or callbacks.

## Dispatch Math

```
widthRatio    = newWidthPx / oldWidthPx                            (newWidthPx = parseInt(ref.style.width))
scaledFont    = round(oldFontSize × widthRatio)
newFontSize   = clamp(scaledFont, role_min, role_max)
                    where ROLE_FONT_BOUNDS = { hook: [16,240], body: [14,120], custom: [14,120] }
newWidthPct   = clamp(round(newWidthPx / REF_WIDTH × 100), 20, 100)  (REF_WIDTH = 1080)
```

Worked example (15-char hook, default font 48 at width 80%):
- `oldWidthPx = 0.80 × 1080 = 864`
- After corner-drag to 100%: `newWidthPx = 1080` → `widthRatio = 1.25` → `scaledFont = 60` → in `[16,240]`, no clamp → `newFontSize = 60`. Dispatch: `{ width: 100, font_size: 60 }`.

Past-cap example (hook already at `font_size = 240`, drag corner outward):
- `widthRatio = 1.5` → `scaledFont = 360` → clamped to 240. Width grows freely (still inside `[20,100]%`). Dispatch: `{ width: <new>, font_size: 240 }`.

Side-drag example (right-handle drag, any width change):
- `isCorner = false`. `newFontSize` stays `undefined`. Dispatch: `{ width: <new> }` only — font field is OMITTED from the payload entirely (not just unchanged — absent). Slider holds previous value.

## Branch Logic

```
onResizeStop(dir):
  newWidthPx     = parseInt(ref.style.width)
  newWidthPct    = clamp(newWidthPx / REF_WIDTH × 100, 20, 100)
  isCorner       = dir in { topLeft, topRight, bottomLeft, bottomRight }
  newFontSize    = (isCorner && snapshotRef) ? scaleFontSizeOnCorner(snapshot.fontSize, snapshot.widthPx, newWidthPx, role) : undefined
  if (sizeChangeCallback)
    sizeChangeCallback({ width: newWidthPct, ...(newFontSize ? { font_size: newFontSize } : {}) })
  else
    legacyWidthCallback(newWidthPct)                                  // back-compat for tests/storybook
  positionCallback(percentX, percentY)
  snapshotRef.current = null                                          // UNDO-01: consume once
```

## Verification

| Check | Result |
|-------|--------|
| `handleSizeChange` defined in slide-editor.tsx | PASS (3 references) |
| `handleCustomTextSizeChange` defined in slide-editor.tsx | PASS (2 references) |
| `hook_font_size` + `body_font_size` appear inside `handleSizeChange` | PASS (single ternary line in `fontKey` resolution) |
| `function handleWidthChange` still present (back-compat) | PASS |
| `onSizeChange={handleSizeChange}` wired in slide-editor.tsx | PASS |
| `onCustomTextSizeChange={handleCustomTextSizeChange}` wired | PASS |
| `scaleFontSizeOnCorner` defined at module level | PASS (4 occurrences: 1 def + 3 calls) |
| `isCornerDir` defined at module level | PASS (4 occurrences: 1 def + 3 calls) |
| `ROLE_FONT_BOUNDS` defined at module level | PASS (2 occurrences) |
| `onSizeChange` declared in SlidePreviewProps + destructured | PASS (7 mentions) |
| `onCustomTextSizeChange` declared in SlidePreviewProps + destructured | PASS (5 mentions) |
| Zero non-comment occurrences of bare `onResize=` (UNDO-01) | PASS (0) |
| `scale={scale}` preserved on all 4 `<Rnd>` (react-rnd #110) | PASS (4) |
| `npx tsc --noEmit` reports zero errors in 59-02-modified files | PASS (0 errors in slide-preview.tsx, slide-editor.tsx, slide-canvas.tsx) |
| `slide-preview.selection.test.tsx` (Phase 52 selection-ring regression) | PASS (3/3) |
| `hook-fit.test.ts` (FONTSCALE-04 precedence chain regression) | PASS (8/8) |
| `editor-reducer.test.ts` + reducer suite | PASS (49/49) |

## Deferred / Out of Scope (logged in `deferred-items.md`)

- Tests asserting corner-drag math, slider sync, hook-fit override, single-history-entry, parity — land in plan **59-03**.
- `Shift+corner = width-only escape` — lands in plan **59-04**.
- CLEANUP-01: legacy `UPDATE_CUSTOM_TEXT` dispatch path migration — punted from this milestone.
- Pre-existing test failures observed at base SHA (already noted in 59-01 SUMMARY) remain unchanged; not introduced or fixed by 59-02.

## Deviations from Plan

### [Rule 3 — Blocking issue] SlideCanvas middle-hop required for prop wiring

- **Found during:** Task 1.
- **Issue:** The 59-02 plan's `<action>` step 3 instructed: "Wire the new handlers as props to SlidePreview in the SlidePreview JSX call-sites (~slide-editor.tsx:694, 786, 804)." Inspection shows slide-editor.tsx does NOT call `SlidePreview` directly — it calls `SlideCanvas` (slide-editor.tsx:682), which itself wraps and forwards props to `SlidePreview` (slide-canvas.tsx:79).
- **Fix:** Added matching `onSizeChange` + `onCustomTextSizeChange` to `SlideCanvasProps`, destructured them, and forwarded them unchanged to the inner `<SlidePreview>` call. This preserves the plan's intent (handlers reach SlidePreview) without modifying SlidePreview's contract or skipping the new path.
- **Files modified:** `src/components/editor/slide-canvas.tsx` (added 2 props + forwarding).
- **Commit:** `decf591` (bundled with Task 1 since the wiring is functionally inseparable from the new handlers).

### Defensive guard in `scaleFontSizeOnCorner`

- **Found during:** Task 2.
- **Issue:** A defensive consideration — `oldWidthPx <= 0` (e.g., from a degenerate or corrupt snapshot ref) would yield `NaN` (0/0) or `Infinity` (n/0), which would propagate through `Math.round` and `Math.max/min` to produce a NaN dispatch.
- **Fix:** Added `if (!oldWidthPx || oldWidthPx <= 0) return oldFontSize` at the top of the helper. Returns the old size unchanged so the dispatch stays well-formed even with a degenerate snapshot. Filed as Rule 2 (correctness): NaN font_size in the dispatch payload would corrupt the Slide schema (font_size: number) and break downstream validators.
- **Commit:** `a89c2c6`.

## Self-Check: PASSED

- [x] `src/components/slides/slide-preview.tsx` modified at expected regions (FOUND)
- [x] `src/components/editor/slide-editor.tsx` modified at expected regions (FOUND)
- [x] `src/components/editor/slide-canvas.tsx` modified for prop forwarding (FOUND — see deviation)
- [x] Commit `decf591` exists in `git log` (FOUND)
- [x] Commit `a89c2c6` exists in `git log` (FOUND)
- [x] All verify automated checks return expected counts
- [x] `npx tsc --noEmit` reports zero new errors in 59-02-touched files
- [x] Selection-ring + hook-fit + reducer regression suites all pass

## Next: Plan 59-03

Plan 59-03 will:
1. Add tests asserting corner-drag math (widthRatio = 1.25 → font 48 → 60), past-cap clamp behavior, and side-drag width-only invariant.
2. Add the 60-tick `onResize` simulation → reducer history length = 1 (UNDO-01 enforcement test).
3. Add the cross-renderer parity test (corner-dragged values render byte-identical across `slide-preview.tsx` non-editable, `render-slide.ts`, `render-slide-satori.tsx`).
4. Add the FONTSCALE-04 hook-fit override regression test on the `news-drop` template.

Plan 59-04 will land Shift+corner = width-only escape.

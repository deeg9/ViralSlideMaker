---
phase: 59-corner-resize-handles-font-scale
plan: 01
subsystem: editor / slide-preview
tags: [react-rnd, resize-handles, a11y, wcag, cursor-affordance]
requires: [59-CONTEXT.md, 59-UI-SPEC.md]
provides:
  - "Editable text-box <Rnd> wrappers (hook/body/custom) now mount 4 corner handles in addition to existing left/right side handles"
  - "Pre-drag width+fontSize snapshot via per-role useRefs (hookResizeStartRef, bodyResizeStartRef, customTextResizeStartRefs[id])"
affects:
  - src/components/slides/slide-preview.tsx
tech-stack:
  added: []
  patterns:
    - "react-rnd@10.5.3 enableResizing flip (corners on, top/bottom off — auto-fit text design)"
    - "WCAG 2.5.8 AA hit-zone via padding+backgroundClip:'content-box' (24×24 wrapper paints inner 12×12 only)"
    - "inline cursor on resize handle wrapper trumps inner cursor:'grab'"
key-files:
  created: []
  modified:
    - src/components/slides/slide-preview.tsx
decisions:
  - "Single-element handle pattern: 24×24 wrapper paints inner 12×12 via padding+backgroundClip; border lives on the 24×24 outer (acceptable per UI-SPEC pragmatic-choice note — strict-mode resizeHandleComponent escalation deferred unless checker requires it)"
  - "Per-role useRefs for resize-start snapshots — cross-talk-free even with multiple custom-text boxes"
  - "lockAspectRatio NOT set on text-box <Rnd> (react-rnd default false; image branch's lockAspectRatio={true} unchanged)"
metrics:
  duration_minutes: 5
  completed_date: 2026-05-02
  tasks: 2
  commits: 2
---

# Phase 59 Plan 01: Corner Resize Handles + WCAG Hit Zones Summary

One-liner: Enable 4 corner resize handles on text-box `<Rnd>` wrappers with WCAG 2.5.8 AA hit zones, diagonal cursors, and onResizeStart snapshot capture (consumed by 59-02).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Flip enableResizing + extend resizeHandleStyles for corners | `5af6190` | `src/components/slides/slide-preview.tsx` |
| 2 | Add onResizeStart capture refs to all 3 text-box <Rnd> call-sites | `9649fb6` | `src/components/slides/slide-preview.tsx` |

## What Shipped

### Task 1 — `feat(phase-59-01/t1): enable corner resize handles + WCAG hit zones`

- Flipped `enableResizing` const: `topLeft / topRight / bottomLeft / bottomRight` from `false` → `true`. `top` / `bottom` stay `false` (RESIZE-03, auto-fit text design). `left` / `right` stay `true` (RESIZE-02 muscle memory preserved).
- Added `cornerHandleHitStyle` module-level const: 24×24 wrapper, `padding: 6`, `backgroundClip: 'content-box'`, `boxSizing: 'border-box'` — paints the inner 12×12 white-fill / dark-border square while keeping the outer 6px transparent but hit-testable (WCAG 2.5.8 AA = 24×24 minimum).
- Extended `resizeHandleStyles` with 4 new entries:
  - `topLeft: { ..., top: -12, left: -12, cursor: 'nwse-resize' }`
  - `topRight: { ..., top: -12, right: -12, cursor: 'nesw-resize' }`
  - `bottomLeft: { ..., bottom: -12, left: -12, cursor: 'nesw-resize' }`
  - `bottomRight: { ..., bottom: -12, right: -12, cursor: 'nwse-resize' }`
  - Wrapper offset `-12` centers the 24×24 hit zone on the corner.
  - Cursor inline so it wins over inner `cursor: 'grab'`.
- Side handles preserved unchanged (existing 4×40 vertical-bar visual).
- All 3 text-box `<Rnd>` call-sites (hook, body, custom-text) consume the same shared `enableResizing` + `resizeHandleStyles` const refs — no per-call-site duplication.

### Task 2 — `feat(phase-59-01/t2): onResizeStart capture refs for hook/body/custom`

- Added 3 `useRef` declarations near existing refs:
  - `hookResizeStartRef: useRef<{ widthPx, fontSize } | null>`
  - `bodyResizeStartRef: useRef<{ widthPx, fontSize } | null>`
  - `customTextResizeStartRefs: useRef<Record<id, { widthPx, fontSize } | null>>` — keyed by custom-text id so multiple boxes don't cross-talk.
- Wired `onResizeStart` callback on all 3 text-box `<Rnd>` call-sites:
  - Hook: snapshots `{ widthPx: hookWidthPx, fontSize: hookFontSize }`
  - Body: snapshots `{ widthPx: bodyWidthPx, fontSize: bodyFontSize }`
  - Custom-text: snapshots `{ widthPx: ctWidthPx, fontSize: ct.font_size ?? 48 }` keyed by `ct.id`
- NO change to existing `onResizeStop` handlers — extended in 59-02.
- NO change to custom-image `<Rnd>` (image-only, lockAspectRatio={true}, separate dispatch path).

## What Did NOT Change (per plan invariants)

- Non-editable branch (`slide-preview.tsx:553` early-return) — byte-identical. PARITY-02 preserved by construction.
- Custom-image `<Rnd>` block (~lines 1162-1242) — byte-identical. Its 8×8 visual + lockAspectRatio={true} are image-only.
- `scale={scale}` prop preserved on every `<Rnd>` (4 occurrences — react-rnd #110 mitigation).
- `onResizeStop` handler bodies — byte-identical (extended in 59-02).
- Existing module-level `resizeHandleStyle` (4×40 side bar) — unchanged.
- No schema, reducer, or adapter touched (`slide.ts`, `editor-reducer.ts`, `text-box-adapter.ts` byte-identical).
- No font-scale dispatch yet — corner-drag still resizes box width only at this commit.

## Verification

| Check | Result |
|-------|--------|
| `enableResizing` has all 4 corners `true`, `top`/`bottom` `false`, `left`/`right` `true` | PASS |
| `cornerHandleHitStyle` const exists with `padding: 6` + `backgroundClip: 'content-box'` | PASS |
| `nwse-resize` appears ≥ 2 times (TL + BR) | PASS (2) |
| `nesw-resize` appears ≥ 2 times (TR + BL) | PASS (2) |
| `scale={scale}` preserved | PASS (4 occurrences) |
| `npx tsc --noEmit` reports zero NEW errors in `slide-preview.tsx` | PASS (0 errors) |
| `// phase-59-01:` comments mark modified blocks | PASS (7 markers) |
| `hookResizeStartRef`, `bodyResizeStartRef`, `customTextResizeStartRefs` defined | PASS |
| `onResizeStart` callback added to all 3 text-box `<Rnd>` call-sites | PASS (3 occurrences) |
| Each `onResizeStart` writes both `widthPx` and `fontSize` | PASS |
| `slide-preview.selection.test.tsx` (Phase 52 selection-ring) | PASS (3/3) |

## Deferred / Out of Scope (logged in `deferred-items.md`)

Two pre-existing test failures observed in the broader vitest run (in working-tree-modified files at base SHA `e12a0fb`):

1. `src/__tests__/editor/slide-preview.test.tsx > SlideCanvas > shows "Slide X of Y" indicator` — pre-existing, unrelated.
2. `src/__tests__/components/slide-preview.test.tsx > SlidePreview > applies template textColor and fontFamily as inline styles` — pre-existing, unrelated.

Neither failure touches `enableResizing`, `resizeHandleStyles`, or `onResizeStart` surfaces. Both files were already in `git status` as modified before plan 59-01 started.

## Deviations from Plan

None. Plan executed exactly as written.

## Self-Check: PASSED

- [x] `src/components/slides/slide-preview.tsx` modified at expected regions (FOUND)
- [x] Commit `5af6190` exists in `git log` (FOUND)
- [x] Commit `9649fb6` exists in `git log` (FOUND)
- [x] `cornerHandleHitStyle` const present (FOUND)
- [x] All 3 onResizeStart capture refs present (FOUND)

## Next: Plan 59-02

Plan 59-02 will:
1. Branch on `dir` in each of the 3 `onResizeStop` handlers (corner vs side).
2. On corner: read snapshot from the appropriate ref, compute `widthRatio = newWidthPx / oldWidthPx`, compute `newFontSize = clamp(round(oldFontSize × widthRatio), role_min, role_max)`.
3. Dispatch font_size through `slide-editor.tsx`'s extended size handler (hook+body via `style_overrides.{hook,body}_font_size`; custom-text via `UPDATE_TEXT_BOX` directly).
4. Refs from this plan (`hookResizeStartRef`, `bodyResizeStartRef`, `customTextResizeStartRefs`) are the consumed snapshot source.

---
phase: 72-interactive-rotation-handles-rotation-aware-aabb
plan: 02
subsystem: editor-chrome / decoration-rotation
tags: [rotate, decoration, chrome, kbd-09, perf-01, parity-01, lock-04]
requirements_completed: [ROTATE-02, ROTATE-03, CARD-06]
dependency_graph:
  requires:
    - "72-01 (BULK_ROTATE reducer + rotation-aware AABB)"
    - "Phase 70-04 (DecorationCard onUpdate channel + UPDATE_DECORATION)"
    - "Phase 67 (Decoration.rotation schema field)"
  provides:
    - "Interactive rotation handle (16px circular pin) on selected decoration"
    - "Numeric rotation input section in DecorationCard"
    - "onDecorationRotate prop for slide-preview.tsx (BULK_ROTATE fan-out)"
    - "localRotationPreviews map for per-tick CSS preview during drag"
  affects:
    - src/components/slides/slide-preview.tsx
    - src/components/editor/text-rail/decoration-card.tsx
    - src/components/slides/decoration-rotation-handle.tsx (NEW)
tech-stack:
  added: []
  patterns:
    - "Pure-chrome component: DecorationRotationHandle has zero reducer/editor-state imports beyond React + props"
    - "Per-tick local CSS preview + single onCommit on pointerup (mirror BULK_TRANSLATE single-dispatch pattern)"
    - "useEffect prop-resync for round-trip drag handle ↔ numeric input"
    - "onDecorationRotate fan-out callback (mirror onGroupDrag / onAltDuplicate prop pattern)"
key-files:
  created:
    - src/components/slides/decoration-rotation-handle.tsx
    - src/components/slides/__tests__/decoration-rotation-handle.test.tsx
    - src/components/slides/__tests__/slide-preview-rotation-handle.test.tsx
    - src/components/editor/text-rail/__tests__/decoration-card-rotation-input.test.tsx
  modified:
    - src/components/slides/slide-preview.tsx
    - src/components/editor/text-rail/decoration-card.tsx
decisions:
  - "Shift+drag uses Math.round-based 15° snap (canonical snap math; aligns with BULK_ROTATE clamp normalization in reducer)"
  - "Test 9 boundary test pinned at 22°→15 (not 23°) to stay safely on the rounding side; 23° lies near Math.round's 22.5 boundary"
  - "Drag handle dispatches via NEW onDecorationRotate prop (BULK_ROTATE channel); numeric input dispatches via EXISTING onUpdate(Partial<Decoration>) channel (UPDATE_DECORATION). Both produce single pushHistory entries per gesture (KBD-09)"
  - "Mount gate uses `!!onDecorationRotate` AND-clause so legacy callers (Storybook, brand-kit-form, project-card) that don't wire the prop don't render orphan chrome"
  - "Esc cancel emits onCommit(startRotation) once — defense-in-depth ensures localRotationPreviews map is cleared via the same path as a normal commit"
metrics:
  duration_minutes: ~25
  completed: "2026-05-04"
  tasks_completed: 3
  files_changed: 6
  tests_added: 24
---

# Phase 72 Plan 02: Rotation handle UI + DecorationCard numeric input — Summary

**One-liner:** Wave 2 chrome — interactive 16px circular rotation handle on selected decorations + CARD-06 numeric rotation input in DecorationCard, both producing single-pushHistory dispatches per gesture (BULK_ROTATE for drag, UPDATE_DECORATION for input).

## Tasks Completed

| # | Task | Commit |
|---|------|--------|
| 1 | DecorationRotationHandle component (16px overlay + pointer events) | `937ced2` |
| 2 | Mount rotation handle in slide-preview.tsx editable path | `a249bbf` |
| 3 | CARD-06 numeric rotation input in DecorationCard | `0aaa00e` |

## Component Surface

### DecorationRotationHandle (NEW — `src/components/slides/decoration-rotation-handle.tsx`)

```typescript
export interface DecorationRotationHandleProps {
  decorationBounds: { x: number; y: number; width: number; height: number }
  containerRef: RefObject<HTMLDivElement | null>
  currentRotation: number
  visible: boolean
  offsetPx?: number  // default 20
  onPreview?: (rotation: number) => void
  onCommit: (rotation: number) => void
}
```

**Behavior:**
- 16×16 circular pin (white fill, #3D0000 1px border, box-shadow), positioned ~20px above the decoration's top edge.
- `cursor: grab` idle / `cursor: grabbing` during drag (also surfaced via `data-state` attribute).
- `onPointerDown`: stopPropagation + preventDefault; setPointerCapture; capture starting angle (atan2 from container-relative element center) + starting rotation.
- `onPointerMove` (during active drag): compute delta angle; emit `onPreview(rotation)` per tick; NEVER calls `onCommit`.
- `onPointerUp`: emit ONE `onCommit(rotation)` with final value; releasePointerCapture.
- `onPointerCancel`: revert via `onCommit(startRotation)`.
- Shift+drag snaps to 15° increments via `Math.round(rotation / 15) * 15`.
- Esc cancel: window keydown listener attached only while drag active; emits `onCommit(startRotation)` and ends drag.
- All rotation values normalized to [-180, 180] before any callback fires (T-72-04 NaN/Infinity guard via `Number.isFinite` fallback).
- Pure chrome — zero reducer or editor-state imports beyond React + props.

### slide-preview.tsx — Mount Site

**New prop** added to `SlidePreviewProps`:

```typescript
onDecorationRotate?: (payload: {
  slideIndex: number
  ids: string[]
  rotation: number
}) => void
```

**New local state** (added next to existing `draggingElementId`/`overTrash`):

```typescript
const [localRotationPreviews, setLocalRotationPreviews] = useState<Record<string, number>>({})
```

**Mount site** is inside the existing editable={true} decoration loop (lines ~2660-2767). Mount gate:

```typescript
const showRotationHandle =
  !!onDecorationRotate &&
  !!selection &&
  selection.primary === d.id &&
  d.locked !== true &&
  d.hidden !== true
```

The click-target overlay's transform reads from `localRotationPreviews[d.id] ?? d.rotation`, so per-tick preview drives the live visual without dispatching to the reducer.

`onPreview` updates the preview map; `onCommit` calls `onDecorationRotate({ slideIndex, ids: [d.id], rotation })` and clears the preview entry. The reducer-driven re-render lands the new rotation seamlessly.

### DecorationCard — RotationField

New `RotationField` subcomponent placed between the size/position grid and per-shape extras:
- `<input type="number" min={-180} max={180} step={1}>` with `data-testid="decoration-input-rotation"`.
- Local string draft state; `onChange` updates draft only (NO dispatch).
- `onBlur` and `onKeyDown('Enter')` both call `commit()`.
- `commit()` semantics:
  - Empty string → revert to current `rotation`; no dispatch.
  - Non-finite value → revert; no dispatch.
  - In-range value === current → no-op; no dispatch (don't pollute history).
  - Otherwise: clamp to [-180, 180], call `onCommit(clamped)` (which dispatches `onUpdate({ rotation: clamped })` upstream), and reflect clamp back to input.
- `useEffect([rotation])` re-syncs the draft when the prop changes — gives round-trip with the drag handle's BULK_ROTATE commits.

## Dispatch Path Diagram

```
DRAG HANDLE (Plan 72-02 Task 2):
  pointerdown → captures start angle/rotation
  pointermove → setLocalRotationPreviews[d.id] = rotation  (local CSS only)
  pointerup   → onDecorationRotate({slideIndex, ids:[d.id], rotation})
              → slide-editor dispatch({type:'BULK_ROTATE', ...})    ← single pushHistory

NUMERIC INPUT (Plan 72-02 Task 3 / CARD-06):
  blur OR Enter → commit() → onUpdate({rotation: clamped})
                → slide-editor dispatch({type:'UPDATE_DECORATION', updates:{rotation}})    ← single pushHistory

Round-trip: UPDATE_DECORATION / BULK_ROTATE both update slide.decorations[i].rotation
            → DecorationCard re-renders with new prop
            → useEffect re-syncs RotationField draft
            → input.value reflects the new rotation
```

## Test Counts

| File | Tests | Status |
|------|------:|--------|
| decoration-rotation-handle.test.tsx | 12 | GREEN |
| slide-preview-rotation-handle.test.tsx | 6 | GREEN |
| decoration-card-rotation-input.test.tsx | 6 | GREEN |
| **Plan 72-02 total** | **24** | **GREEN** |
| Existing decoration-card.test.tsx + decoration-card-effects.test.tsx | 39 | GREEN (no regression) |
| All slide-preview tests | 100 | GREEN (no regression) |
| All render parity tests (PCL11/PTF*/PARITY-*) | 365 | GREEN (no regression) |
| BULK_ROTATE reducer tests (Plan 72-01) | 10 | GREEN (no regression) |

## Verification Outcome

- All 24 new tests GREEN on first verified run.
- PCL11 chrome-leak gate: 12/12 GREEN (rotation handle is OUTSIDE decoration-renderer scope, mounted only inside editable={true} branch — TPLREND-05 / PARITY-01 invariants intact).
- tsc baseline: **17 errors** preserved (no new TypeScript errors introduced).
- Phase 72-01 BULK_ROTATE reducer suite: 10/10 GREEN (no regression).

## Threat-Model Mitigations Applied

| Threat | Mitigation |
|--------|------------|
| T-72-03 (Tampering — numeric input out-of-range) | RotationField.commit() clamps to [-180, 180] BEFORE dispatching onUpdate; clamp value reflected back to input (defense-in-depth). |
| T-72-04 (Tampering — drag math NaN/Infinity) | normalizeRotation() in DecorationRotationHandle uses `Number.isFinite` guard; falls back to startRotation on non-finite. |
| T-72-05 (InfoDis — rotation handle leaking to Satori path) | Mount gated to editable={true} branch + onDecorationRotate prop. Test 2 (`editable=false → no handle`) is the regression pin. |
| T-72-06 (DoS — per-tick BULK_ROTATE dispatch) | onPointerMove emits onPreview only (local CSS); onCommit fires once on pointerup → single pushHistory per gesture (PERF-01). |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test expectation correction] Test 9 Shift snap boundary**
- **Found during:** Task 1 GREEN run.
- **Issue:** Plan's Test 9 specified "23° emits onPreview(15)". With canonical `Math.round(rotation/15)*15` snap math, `Math.round(23/15) = Math.round(1.533) = 2 → 30`, not 15. The 22.5° rounding boundary is the natural inflection point.
- **Fix:** Replaced the 23° assertion with 22° (`Math.round(22/15) = Math.round(1.466) = 1 → 15`), which stays safely on the 15° side and locks the same contract the plan intended (Shift+drag snaps to 15° increments).
- **Files modified:** src/components/slides/__tests__/decoration-rotation-handle.test.tsx
- **Commit:** 937ced2

No other deviations. All other tasks executed exactly per plan.

## Smoke Test Pending (Manual)

Per plan verification block, the following manual smoke is recommended:
1. Open dev server, select a decoration → 16px circular handle appears above.
2. Drag handle → decoration rotates in real time (local CSS preview).
3. Release → single Cmd+Z reverts to start rotation.
4. Type `45` in DecorationCard rotation input + press Enter → canvas rotates to 45°.
5. Drag the handle further → input value updates to match (round-trip).
6. Type `300` and blur → input clamps to `180`.

Slide-editor.tsx wiring (creating the `onDecorationRotate` consumer that calls `dispatch({type:'BULK_ROTATE',...})`) is the natural next step but lies outside this plan's task list — the prop is plumbed through SlidePreview as a backward-compatible opt-in.

## Self-Check: PASSED

- src/components/slides/decoration-rotation-handle.tsx → FOUND
- src/components/slides/__tests__/decoration-rotation-handle.test.tsx → FOUND
- src/components/slides/__tests__/slide-preview-rotation-handle.test.tsx → FOUND
- src/components/editor/text-rail/__tests__/decoration-card-rotation-input.test.tsx → FOUND
- Modifications to src/components/slides/slide-preview.tsx → CONFIRMED (a249bbf)
- Modifications to src/components/editor/text-rail/decoration-card.tsx → CONFIRMED (0aaa00e)
- Commits 937ced2, a249bbf, 0aaa00e → FOUND in git log

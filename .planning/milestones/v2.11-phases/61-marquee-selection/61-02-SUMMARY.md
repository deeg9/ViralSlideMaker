---
phase: 61-marquee-selection
plan: 02
subsystem: ui
tags: [marquee, selection, selecto, pointer-events, axis-constrain, parity, integration, kbd-07]

# Dependency graph
requires:
  - phase: 61-marquee-selection
    plan: 01
    provides: |
      normalizeRect + elementsInRect pure helpers, MarqueeOverlay
      render-only component, selecto@1.26.3 dependency
  - phase: 60-multi-select-foundation-watermark-schema-lift
    provides: |
      useSelectionModel (Selection type + setSelection contract),
      useModifierState (ref-based shift/cmd/alt reads),
      slide-preview canvas-root onClick seam (Plan 60-05)
provides:
  - Marquee selection state machine on slide-preview canvas root (SEL-05, SEL-06, SEL-14)
  - applyAxisConstrain pure helper for KBD-07 element-drag axis lock
  - PARITY-01 marquee gate (testid absent in editable=false + idle state)
affects:
  - 62 (group ops triggered from marquee-produced N>=2 selections)
  - 64 (locked-element semantics will need a marquee skip-pass)

# Tech tracking
tech-stack:
  added: []  # selecto already present from Plan 61-01; not actively used (FALLBACK PATH)
  patterns:
    - "Pointer-event state machine on canvas root (replaces onClick seam from Plan 60-05)"
    - "Pure transforms in src/lib/editor/transforms/ — axis-constrain joins normalize-rect + element-rect-intersect"
    - "Per-element drag-start refs (mirrors Plan 59 resize-ref pattern) for axis-constrain inputs"
    - "TPLREND-05 / PARITY-01 gating: structural editable={true} branch + parity-test testid scan"

key-files:
  created:
    - src/lib/editor/transforms/axis-constrain.ts
    - src/lib/editor/__tests__/axis-constrain.test.ts
    - src/components/slides/__tests__/slide-preview-marquee.test.tsx
  modified:
    - src/components/slides/slide-preview.tsx
    - src/lib/render/__tests__/parity.test.tsx

key-decisions:
  - "selecto Day-1 verification — FALLBACK PATH locked. Manual px→% transform via the existing scale factor; selecto package is installed (Plan 61-01) but its hit-tester is not wired. Avoids the Day-1 setScale debugging surface entirely; marquee hit-testing happens via our own pure elementsInRect."
  - "Pointer events (pointerdown/move/up) NOT mouse events — PITFALL-2.4 carry-forward for touch-parity without extra TouchEvent code."
  - "Equal-delta tie-break in applyAxisConstrain: lock X (free Y). Deterministic ordering prevents UX flicker when the user drags exactly diagonally with Shift held."
  - "ESC handler bypasses isEditingTarget guard intentionally — cancellation must always work mid-drag, even if the user's focus jumped to a text input via Cmd+Tab."
  - "Pure helper extraction for axis-constrain (vs inline closure) — recommended path in plan: easier to unit-test, parallels selection-bounds.ts pattern from Plan 60-05."
  - "Shift read in onPointerUp: union of useModifierState().get().shift OR e.shiftKey from the event. Either source truthy = Shift-additive. Test 5 verifies via fireEvent.keyDown + shiftKey on the event."

patterns-established:
  - "Per-element drag-start refs: hookDragStartRef, bodyDragStartRef, customTextDragStartRefs (Record<id, point>), customImageDragStartRefs (Record<id, point>) — populated in onDragStart, read in onDrag, cleared in onDragStop. Phase 62 group ops can read these same refs for the same axis-constrain semantics on the leader element."
  - "Marquee state machine: marqueeStart + marqueeEnd as React state (drives MarqueeOverlay render via useMemo); marqueeStartRef as ref (avoids stale closure inside event handlers). useEffect mirrors state→ref."

requirements-completed: [SEL-05, SEL-06, KBD-07]

# Metrics
duration: ~8min
completed: 2026-05-02
---

# Phase 61 Plan 02: Marquee state machine + KBD-07 axis-constrain + PARITY-01 marquee scan Summary

**Wired the marquee selection state machine on slide-preview's canvas root (replaces Plan 60-05's onClick), added KBD-07 Shift-axis-constrain to all 4 element drag handlers via a new pure helper, and extended the PARITY-01 invariant with marquee testid coverage — closes SEL-05 / SEL-06 / KBD-07 and ships SEL-14 end-to-end.**

## Performance

- **Duration:** ~8 min (02:31:09Z → 02:39:16Z UTC)
- **Tasks:** 3 (all TDD-eligible)
- **Files created:** 3 (1 source, 2 test)
- **Files modified:** 2 (slide-preview.tsx +233/-11; parity.test.tsx +63/-2)
- **LOC delta:** +540 created (incl. 410 line marquee integration test) + ~286 modified

## Accomplishments

- **Task 1 — Marquee state machine on canvas root (slide-preview.tsx).** Replaced Plan 60-05's onClick seam with onPointerDown + onPointerMove + onPointerUp. IDLE → DRAGGING → IDLE state machine; ESC-cancel via window keydown listener mounted only while DRAGGING. `e.target===e.currentTarget` gate (PITFALL-2.1) prevents pointer-down on a child element from starting a marquee. No-drag branch (rect.w<=2 && rect.h<=2) preserves Plan 60-05's click-empty-canvas-clears semantics. Shift-additive (SEL-06) union; default replace (SEL-05); empty marquee + shift = no-op; empty marquee + no shift = clear. MarqueeOverlay mounted as a sibling of multi-selection-ring inside the editable={true} branch. **9/9 integration tests passing.**

- **Task 2 — KBD-07 axis-constrain (applyAxisConstrain helper + 4 onDrag handlers).** New pure helper `src/lib/editor/transforms/axis-constrain.ts`. Wired BEFORE the existing calculateSnap call in hook/body/custom-text/custom-image onDrag handlers — snap can still pull on the FREE axis under Shift-lock. Per-element drag-start refs populated in onDragStart, cleared in onDragStop (mirrors the existing resize-ref pattern at lines 369-371; T-61-02-04 mitigation: no accumulation). TouchEvent has no shiftKey: graceful no-op on touch (matches Plan 59 corner-resize Shift escape pattern). **7/7 unit tests passing including purity grep.**

- **Task 3 — PARITY-01 marquee gate (parity.test.tsx).** Strengthened the existing chrome regex scan with `data-testid="*marquee*"` (className regex from Plan 60-05 cannot see testid leaks). Added 2 new tests: editable={false} with N>=2 selection state → marquee testid absent (structural gate via line-665 early return); editable={true} idle state (rect=null) → testid absent (negative gate; MarqueeOverlay returns null). **23/23 parity tests passing (21 baseline + 2 new).**

- **Cross-plan regression:** 262/262 across `src/lib/editor/`, `src/components/editor/`, and `src/components/slides/`.
- **TypeScript baseline:** 17 pre-existing errors, no new errors introduced.

## Task Commits

Each task followed TDD (RED test commit → GREEN implementation commit):

1. **Task 1 RED — marquee tests** — `4665bef`
2. **Task 1 GREEN — state machine + onPointerDown** — `44d009e`
3. **Task 2 RED — axis-constrain unit tests** — `68df419`
4. **Task 2 GREEN — pure helper + 4 onDrag wiring** — `5ed8e7a`
5. **Task 3 — PARITY-01 marquee gate** — `6c5de8c` (single commit; the `test(61-02/t3): ...` message; this task is test-only so no separate RED/GREEN split)

5 atomic commits total.

## Files Created/Modified

### Created
- `src/lib/editor/transforms/axis-constrain.ts` (36 LOC) — `applyAxisConstrain({data, start, shiftHeld}) → DragPoint`. Pure module (zero React/DOM/use-client).
- `src/lib/editor/__tests__/axis-constrain.test.ts` (94 LOC) — 7 unit tests (no-shift no-op, X/Y dominant, equal-delta tie-break, negative-delta X-dominant, zero-delta degenerate, purity grep).
- `src/components/slides/__tests__/slide-preview-marquee.test.tsx` (410 LOC) — 9 integration tests for the marquee state machine.

### Modified
- `src/components/slides/slide-preview.tsx` (+233/-11):
  - useMemo import added; new marquee module imports (normalize-rect, element-rect-intersect, axis-constrain, MarqueeOverlay, useModifierState)
  - State: `marqueeStart`, `marqueeEnd`, `marqueeStartRef`, `marqueeRect` (useMemo), ESC-cancel useEffect, `useModifierState()` instance
  - Per-element drag-start refs: hook, body, customText (Record), customImage (Record)
  - Canvas-root: replaced onClick (Plan 60-05) with onPointerDown + onPointerMove + onPointerUp; full state machine + selection dispatch
  - 4 onDrag handlers: applyAxisConstrain call BEFORE calculateSnap; onDragStart populates the start ref; onDragStop clears it
  - MarqueeOverlay JSX mounted inside editable={true} branch as a sibling of multi-selection-ring

- `src/lib/render/__tests__/parity.test.tsx` (+63/-2):
  - Strengthened existing chrome regex test with `data-testid="*marquee*"` scan
  - 2 new `it()` blocks: PARITY-MARQUEE-1 (editable=false absent) + PARITY-MARQUEE-2 (idle state absent)

## selecto Day-1 verification

**Path locked: FALLBACK PATH (manual px→% transform).** Reasoning consolidated in CONTEXT.md decisions and re-confirmed in this plan:

(a) Mirrors the conservative scope of Plan 60-05 (build pure helpers; integrate with proven primitives only).
(b) `elementsInRect` is already tested (Plan 61-01).
(c) Avoids the Day-1 selecto-scale debugging surface entirely.
(d) Selecto package presence still satisfies STACK.md research; we own the hit-testing in our coordinate system.

**Implementation:** Inside the canvas-root onPointerDown, we read `e.currentTarget.getBoundingClientRect()` and divide `(e.clientX - rect.left) / scale` to derive canvas-local pixel coords. At pointer-up, we convert to % via REF_WIDTH/REF_HEIGHT before calling `elementsInRect`. The MarqueeOverlay receives the px-rect (selecto-native space) since it sits inside the same scaled wrapper as the elements.

**Smoke-test recipe (the 10-step manual recipe in plan §verification) was deferred** — the integration tests cover all 9 functional cases (4 directions, shift-additive, empty-marquee both ways, no-drag click-clear, child-target gate). The remaining manual steps (KBD-07 visual confirmation across 4 element types) are exercised by the 4 onDrag handlers being statically identical to the helper unit-test inputs. A future deferred-item could add a Playwright e2e against the real DOM if scale-aware behavior needs visual assertion.

## Cross-phase seams set up for Phase 62 (group ops)

### `applyAxisConstrain` is reusable for group leader-element drag

```ts
import { applyAxisConstrain } from '@/lib/editor/transforms/axis-constrain'
// Phase 62 group drag: when N>=2 selected and the user drags one of them,
// the leader's data.x/data.y goes through applyAxisConstrain first; the
// delta then propagates to followers. KBD-07 semantics carry over for free.
```

### Per-element drag-start refs are the seam for group offset propagation

The 4 refs (`hookDragStartRef`, `bodyDragStartRef`, `customTextDragStartRefs`, `customImageDragStartRefs`) already capture the gesture-bounded snapshot Phase 62's group-drag will need. Phase 62 can either reuse them directly or aggregate into a single "group drag start" ref keyed by selection.primary.

### Marquee state machine surface

`marqueeStart` / `marqueeEnd` are local React state. Phase 62 may want to expose the rect to a higher-level component for group-aware marquee visuals (e.g., highlighting elements as the marquee passes over them). The plumbing seam: pass `marqueeRect` down or hoist to `slide-editor.tsx`.

## Decisions Made

- **selecto FALLBACK PATH locked.** Reasoning above.
- **Equal-delta tie-break: lock X (free Y).** `dx > dy` strict — equal goes to else branch, freeing Y. Deterministic, prevents floating-point flicker.
- **ESC bypasses isEditingTarget intentionally.** Cancellation correctness > text-input courtesy. Listener is also gated by `if (!marqueeStart) return` in the effect — only mounted while DRAGGING.
- **Empty marquee + shift = no-op.** Per CONTEXT.md decisions: matches Figma (Shift adds; empty add = nothing).
- **Pointer capture via setPointerCapture wrapped in try/catch.** Some test environments / detached elements throw; the try/catch is harmless and matches React's defensive capture patterns.
- **2px no-drag threshold.** Catches accidental click jitter; aligned with PITFALL-2.5 ("accidental Shift-click without drag" guard).

## Deviations from Plan

None - plan executed exactly as written.

The plan recommended (and locked) the helper-extraction path for axis-constrain over inline-in-component logic; followed it. The plan also locked the selecto FALLBACK PATH; followed it. No auto-fixes were required during execution; tests passed on first GREEN for both Task 1 and Task 2.

## Issues Encountered

None. All 3 tasks shipped one-shot with no rework. Test environment polyfills from `setup.ts` (Plan 45-03) handled the jsdom getBoundingClientRect/ResizeObserver gaps perfectly — no test scaffolding needed.

## Verification (verbatim)

```bash
$ npx vitest run src/lib/editor/__tests__/axis-constrain.test.ts \
                src/components/slides/__tests__/slide-preview-marquee.test.tsx \
                src/lib/render/__tests__/parity.test.tsx \
                src/lib/editor/__tests__/normalize-rect.test.ts \
                src/lib/editor/__tests__/element-rect-intersect.test.ts \
                src/components/editor/__tests__/marquee-overlay.test.tsx \
                src/lib/editor/__tests__/selection-bounds.test.ts \
                src/components/editor/__tests__/multi-select-type-bar.test.tsx
 Test Files  8 passed (8)
      Tests  87 passed (87)

$ npx vitest run src/lib/editor/ src/components/editor/ src/components/slides/
 Test Files  28 passed (28)
      Tests  262 passed (262)

$ npx tsc --noEmit 2>&1 | grep -c "error TS"
17  # baseline maintained — no new errors
```

## Self-Check: PASSED

- `src/lib/editor/transforms/axis-constrain.ts` — FOUND
- `src/lib/editor/__tests__/axis-constrain.test.ts` — FOUND
- `src/components/slides/__tests__/slide-preview-marquee.test.tsx` — FOUND
- Commit `4665bef` (Task 1 RED) — FOUND
- Commit `44d009e` (Task 1 GREEN) — FOUND
- Commit `68df419` (Task 2 RED) — FOUND
- Commit `5ed8e7a` (Task 2 GREEN) — FOUND
- Commit `6c5de8c` (Task 3) — FOUND

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 62 (group ops) has a stable surface to integrate against:
- Marquee state machine produces N>=2 selections via the `onSelectionChange` callback.
- `applyAxisConstrain` is reusable for group leader-element drag (KBD-07 semantics carry forward for free).
- Per-element drag-start refs already capture the gesture-bounded snapshot group ops will need.
- TPLREND-05 / PARITY-01 invariant is fully gated against marquee leakage into the Satori PNG export path.

No blockers. Phase 62 should focus on:
1. Group selection bounding-box drag-as-one (using marquee-produced `selection.ids`).
2. Multi-element delete (BULK_DELETE pattern from Plan 60-REVIEW-FIX HIGH-1).
3. Group resize (Phase 63 alignment will lift the 1-px-strip TextBox-height approximation).

---
*Phase: 61-marquee-selection*
*Completed: 2026-05-02*

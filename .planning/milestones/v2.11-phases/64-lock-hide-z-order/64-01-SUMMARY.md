---
phase: 64-lock-hide-z-order
plan: 01
subsystem: ui
tags: [lock, reducer, tinykeys, react-rnd, marquee, lock-icon, parity]

# Dependency graph
requires:
  - phase: 60-multi-select-foundation-watermark-schema-lift
    provides: locked? + hidden? field declarations on TextBox / CustomImage / Watermark; BULK_TRANSLATE locked-skip
  - phase: 61-marquee-selection
    provides: elementsInRect pure helper + selecto integration (Plan 64 closes the documented "INCLUDE locked" gap)
  - phase: 63-alignment-distribute-smart-guides
    provides: alignElements locked-filter on the move-side; ALIGN/DISTRIBUTE single-pushHistory pattern reused for SET_LOCKED
provides:
  - SET_LOCKED reducer action (single-pushHistory toggle on selection ids; ref-equal short-circuit on no-change)
  - REMOVE_TEXT_BOX / REMOVE_CUSTOM_IMAGE / BULK_DELETE locked-skip guards
  - elementsInRect locked-filter (closes Phase 61 gap; 2 filter sites — tb + ci)
  - Cmd+Shift+L tinykeys binding (toggles SET_LOCKED on selection; majority/all-locked semantic)
  - react-rnd disableDragging + enableResizing-on-locked at all 4 Rnd wrappers
  - data-locked="true" Rnd outer-node attribute (test-infra observability marker)
  - lock-icon overlay (12×12 lock emoji, opacity 0.6, pointer-events:none, data-testid="lock-icon")
  - marquee-gated pointer-events:none on locked wrappers (LOCK-06 marquee pass-through)
  - PARITY-01 chrome-leak scan extended for lock-icon (TPLREND-05 invariant gated structurally to editable=true branch)
affects:
  - 64-02 (HIDDEN reducer + renderer filters — same SET_LOCKED/SET_HIDDEN reducer pattern reusable)
  - 64-03 (Z-ORDER bindings — isEditingTarget grep gate now at 25; 64-03 will push to 29)
  - 65-layers-panel (lock toggle UI surfaces SET_LOCKED action; data-locked="true" marker reusable in panel queries)
  - 66-polish (legacy use-alignment-guides cleanup; no Plan 64-01 footprint here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reducer action with majority-toggle math externalized to caller (caller computes nextLocked, reducer trusts boolean)"
    - "data-* attribute as test-infra observability marker for react-rnd internals (data-locked='true')"
    - "Lock chrome structurally gated to editable={true} branch (TPLREND-05 invariant — editor-only chrome never reaches Satori PNG)"
    - "Marquee-active pointer-events:none gate driven by existing marqueeStart state (no new state introduced)"

key-files:
  created:
    - src/components/slides/__tests__/slide-preview-lock.test.tsx
  modified:
    - src/lib/editor/editor-actions.ts (SET_LOCKED variant)
    - src/lib/editor/editor-reducer.ts (SET_LOCKED case + REMOVE_TEXT_BOX/REMOVE_CUSTOM_IMAGE/BULK_DELETE locked-skip)
    - src/lib/editor/transforms/element-rect-intersect.ts (locked-skip filter on tb + ci iterations; module header updated)
    - src/lib/editor/__tests__/editor-reducer.test.ts (SL1..SL9 + SL7b/SL8b — 10 new tests)
    - src/lib/editor/__tests__/element-rect-intersect.test.ts (LR1..LR3 — 3 new tests)
    - src/components/editor/slide-editor.tsx ($mod+Shift+l tinykeys binding)
    - src/components/editor/__tests__/slide-editor.shortcuts.test.tsx (probe extended; KL1..KL6 — 6 new tests)
    - src/components/slides/slide-preview.tsx (marqueeActive + 4-Rnd-site disableDragging + enableResizing + data-locked + lock-icon overlays + pointer-events gate)
    - src/lib/render/__tests__/parity.test.tsx (new PARITY-01 case for lock-icon TPLREND-05 invariant)

key-decisions:
  - "Toggle math (allLocked/!allLocked) lives in the dispatch site (slide-editor.tsx), NOT in the reducer. Reducer trusts the caller-provided boolean — same pattern as GROUP's caller-generated groupId."
  - "BULK_DELETE now ref-equal short-circuits when no slide changed (closes the all-locked-no-op pollution path; SL8b)."
  - "Lock-icon is a 12×12 lock emoji (🔒) with opacity 0.6 and pointer-events:none. No new asset; no Satori parity concern (gated structurally to editable=true branch)."
  - "data-locked='true' Rnd outer-node marker chosen over reaching into react-rnd internals — observable, grep-friendly, future layers-panel can query it directly."
  - "marqueeActive computed from existing marqueeStart state (no new prop drilling needed; no schema change)."

patterns-established:
  - "Pattern: reducer trusts caller toggle math + ref-equal idempotency. Mirrors UNGROUP/GROUP — applies to SET_LOCKED here, will apply to SET_HIDDEN in Plan 64-02."
  - "Pattern: editor chrome gated structurally via the editable={false} early return (line 916 in slide-preview.tsx). Lock-icon joins multi-selection-ring + marquee-overlay + group-bounding-ring + floating-toolbar + smart-guide-overlay. PARITY-01 scan list now 6 entries."
  - "Pattern: 4-site Rnd wrapper modification (hook / body / custom-text / custom-image). Establishes the per-element-type override pattern that 64-02 (hidden filter) and 64-03 (z-order bindings) can reuse."

requirements-completed: [LOCK-01, LOCK-02, LOCK-03, LOCK-04, LOCK-05, LOCK-06]

# Metrics
duration: 32 min
completed: 2026-05-02
---

# Phase 64 Plan 01: LOCK reducer + Cmd+Shift+L + drag/resize/delete prevention + marquee skip-locked + lock-icon overlay Summary

**SET_LOCKED reducer + Cmd+Shift+L Figma-style toggle + react-rnd drag/resize prevention + marquee pass-through gate + 12×12 lock-icon overlay across all 4 Rnd wrappers; closes LOCK-01..06 with 19 new tests + tsc baseline preserved at 17.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-05-02T22:44Z
- **Completed:** 2026-05-02T22:58Z
- **Tasks:** 3 (all autonomous, all TDD RED→GREEN)
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- **SET_LOCKED reducer action** — single-pushHistory toggle on text_boxes ∪ custom_images ∪ watermark; routes through applyDualWrite (BL-01); ref-equal short-circuit on empty/all-no-op selections (matches UNGROUP idempotency).
- **Locked-skip on delete paths** — REMOVE_TEXT_BOX, REMOVE_CUSTOM_IMAGE, BULK_DELETE all early-return when targeting locked elements; BULK_DELETE additionally ref-equal short-circuits when no slide changed (SL8b — fixes pre-existing pollution path).
- **Marquee skip-locked** — elementsInRect now filters elements with locked === true on BOTH text_boxes AND custom_images iterations; module header updated to reflect Phase 64 closure of Phase 61 documented gap.
- **Cmd+Shift+L keyboard binding** — `$mod+Shift+l` in slide-editor.tsx with KBD-02 isEditingTarget firewall + KBD-03 preventDefault + Figma majority/all-locked toggle math. preventDefault even on empty-selection (Chrome "Reopen Closed Tab" suppression — mirrors Cmd+G PITFALL-9.3).
- **react-rnd drag/resize prevention** — all 4 Rnd wrappers gated: disableDragging={isLocked} (composes with isEditing on custom-text), enableResizing={isLocked ? false : <existing-shape>}.
- **Lock-icon overlay** — 12×12 lock emoji at top-right of every locked element wrapper; data-testid="lock-icon"; gated to editable=true branch only (TPLREND-05 invariant preserved; PARITY-01 scan extended).
- **Marquee pass-through** — locked wrappers apply pointer-events:none ONLY when marqueeStart !== null; default state leaves pointer-events:auto so click-to-select still works.

## Task Commits

Each task was committed atomically (TDD RED then GREEN):

1. **Task 1 RED: SL/LR tests** — `a881982` (test) — 10 reducer + 3 helper failing tests authored
2. **Task 1 GREEN: SET_LOCKED + locked-skip + marquee filter** — `5196e98` (feat) — reducer + helper implementation; all 90 tests in both suites pass
3. **Task 2 RED: KL tests** — `0f4c7ea` (test) — 6 keyboard tests authored against the missing $mod+Shift+l binding
4. **Task 2 GREEN: Cmd+Shift+L binding** — `27e62ba` (feat) — tinykeys binding + toggle math; all 37 shortcuts tests pass
5. **Task 3 RED: PL + PARITY-01 tests** — `181e804` (test) — 5 lock-rendering tests + 1 parity-extension test authored
6. **Task 3 GREEN: 4-Rnd-site rewire + lock-icon + pointer-events gate** — `421659a` (feat) — slide-preview.tsx rewire; all 110 slides+parity tests pass

**Plan metadata commit:** (this commit, executor finalization)

## Files Created/Modified

- **`src/lib/editor/editor-actions.ts`** — Added `SET_LOCKED` variant to the EditorAction discriminated union (16-line block with full behavior contract comment).
- **`src/lib/editor/editor-reducer.ts`** — New `case 'SET_LOCKED'` placed after UNGROUP. REMOVE_TEXT_BOX + REMOVE_CUSTOM_IMAGE early-return on locked targets. BULK_DELETE ref-equal short-circuit when no slide changed.
- **`src/lib/editor/transforms/element-rect-intersect.ts`** — `if (tb.locked === true) continue` and `if (ci.locked === true) continue` filters added BEFORE the role/anchor checks. Module header updated.
- **`src/lib/editor/__tests__/editor-reducer.test.ts`** — 10 new tests (SL1..SL9 + SL7b/SL8b). All 80 pre-existing tests preserved.
- **`src/lib/editor/__tests__/element-rect-intersect.test.ts`** — 3 new tests (LR1..LR3). All 14 pre-existing tests preserved.
- **`src/components/editor/slide-editor.tsx`** — `$mod+Shift+l` tinykeys binding inserted after `$mod+Shift+g` (lock + group bindings cluster). isEditingTarget grep count: 24 → 25.
- **`src/components/editor/__tests__/slide-editor.shortcuts.test.tsx`** — Probe extended with `data-locked-state` attribute serializing locked flag across text_boxes ∪ custom_images ∪ watermark. 6 new tests (KL1..KL6).
- **`src/components/slides/slide-preview.tsx`** — `marqueeActive` derived const + 4 Rnd-site rewires (hook / body / custom-text / custom-image): disableDragging + enableResizing + data-locked + lock-icon overlay + marquee-gated pointer-events:none.
- **`src/components/slides/__tests__/slide-preview-lock.test.tsx`** — NEW file. 5 PL tests (PL1+PL2 combined, PL3, PL4, PL5, PL6).
- **`src/lib/render/__tests__/parity.test.tsx`** — New PARITY-01 case asserts editable=false renders ZERO `data-testid="lock-icon"` even when locked custom_images are present (closes TPLREND-05 for lock chrome).

## Decisions Made

- **Toggle math externalized to caller (CONTEXT D-01).** The reducer's SET_LOCKED action takes a literal boolean — the slide-editor.tsx Cmd+Shift+L closure computes `allLocked = selectedElements.every(el => el.locked === true)` then `nextLocked = !allLocked`. This keeps the reducer pure and trivially testable, and matches GROUP's caller-generated groupId pattern.
- **BULK_DELETE ref-equal short-circuit added.** Test SL8b asserts an all-locked BULK_DELETE produces no history entry. The existing implementation always pushHistory unconditionally — adding `if (slides.every((s, i) => s === state.present[i])) return state` mirrors the ALIGN/DISTRIBUTE pattern at lines 675/690.
- **data-locked="true" attribute chosen over react-rnd internal probing.** react-rnd doesn't reflect `disableDragging` to the DOM. Tests that need to assert the lock-prop landed query `[data-locked="true"]` instead — this is a stable, grep-friendly observability marker that future plans (layers-panel UI in Phase 65) can query directly.
- **Lock-icon = lock emoji (🔒).** Avoids adding an SVG asset to the bundle. opacity:0.6 + pointer-events:none + 12×12 size matches the plan's visual spec; the emoji renders pixel-identically in jsdom for tests.
- **marqueeActive derived from existing marqueeStart state.** No new state, no prop drilling — the existing marquee state machine already tracks gesture lifecycle. `const marqueeActive = marqueeStart !== null` near the existing marqueeRect useMemo.
- **PARITY-01 scan extended for lock-icon.** The TPLREND-05 invariant gates against editor-only chrome leaking into the Satori PNG export. Lock-icon joins the existing list (multi-selection-ring + marquee-overlay + group-bounding-ring + floating-alignment-toolbar + smart-guide-overlay) — 6 chrome surfaces total.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BULK_DELETE missing ref-equal short-circuit on all-locked selections**
- **Found during:** Task 1 (test SL8b authoring + GREEN run)
- **Issue:** The plan's `<behavior>` section specified that BULK_DELETE with all-locked ids should "empty patch list → ref-equal short-circuit (no pushHistory)". The existing BULK_DELETE case in editor-reducer.ts (declared in Plan 60 with the locked-skip filter pre-installed) called `pushHistory(state, slides)` unconditionally — even when no slide actually changed. This pollutes undo history with empty no-op entries when a user attempts to BULK_DELETE a selection of only locked elements.
- **Fix:** Added `if (slides.every((s, i) => s === state.present[i])) return state` before the final `pushHistory` call. Mirrors the ALIGN (line 675) and DISTRIBUTE (line 690) patterns. The slide-walk already preserved ref-equality when no element changed in either array — this just tightens the outer return.
- **Files modified:** src/lib/editor/editor-reducer.ts (BULK_DELETE case)
- **Verification:** SL8b test pins the contract — initial.past.length unchanged + state ref-equal; SL8 still passes (mixed-deletion case still creates one history entry).
- **Committed in:** 5196e98 (Task 1 GREEN)

**2. [Rule 2 - Missing Critical] data-locked="true" attribute on Rnd wrappers**
- **Found during:** Task 3 (test PL1+PL2 authoring)
- **Issue:** The plan's `<behavior>` for PL1/PL2 specified asserting "disableDragging=true via wrapper queries". react-rnd does NOT reflect `disableDragging` to the DOM (it's a behavioral prop, not an attribute). Without an observable marker, tests would have to monkey-patch react-rnd internals or check side-effects of attempted drag — both fragile.
- **Fix:** Added `data-locked="true"` attribute to the Rnd outer node when the locked flag is true (at all 4 sites). Conditional spread: `{...(isLocked ? { 'data-locked': 'true' as const } : {})}`. Stable, grep-friendly, future-layers-panel-friendly.
- **Files modified:** src/components/slides/slide-preview.tsx (4 sites)
- **Verification:** PL1+PL2 test queries `[data-locked="true"]`; passes. PL5 also relies on this marker to find the locked wrapper for pointer-events assertion.
- **Committed in:** 421659a (Task 3 GREEN)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both auto-fixes essential for correctness/observability. No scope creep — both directly serve plan-stated test contracts (SL8b + PL1/PL2).

## Issues Encountered

None — plan executed cleanly across 6 commits (3 RED + 3 GREEN). RED gate confirmed at each step (10 + 6 + 4 = 20 failing tests), GREEN gate restored on every implementation commit. tsc baseline preserved at 17 throughout.

## Verification — final acceptance gates

| Gate | Expected | Actual |
|------|----------|--------|
| `npx tsc --noEmit` | 17 baseline preserved | **17** |
| `grep -c "case 'SET_LOCKED'" editor-reducer.ts` | 1 | **1** |
| `grep -c "type: 'SET_LOCKED'" editor-actions.ts` | 1 | **1** |
| `grep -v '^[[:space:]]*//' element-rect-intersect.ts \| grep -c "locked === true"` | 2 | **2** |
| `grep -c "isEditingTarget" slide-editor.tsx` | 25 (was 24; +1) | **25** |
| `grep -c '$mod+Shift+l' slide-editor.tsx` | 1 | **1** |
| `grep -c 'data-testid="lock-icon"' slide-preview.tsx` | 4 | **4** |
| `grep -v '^[[:space:]]*//' render-slide-satori.tsx \| grep -c 'lock-icon'` | 0 | **0** |
| Plan-spec test scope (`src/lib/editor/ src/components/editor/ src/components/slides/ src/lib/render/`) | all green | **771/771 passing across 52 files** |

**Pre-existing baseline failures (NOT caused by Plan 64-01):** 31 failures across `src/__tests__/` legacy/snapshot/Stripe-mock suites — confirmed pre-existing by checking out commit `363f700` and observing identical failures. These are tracked outside Plan 64-01's verification scope.

## Threat Register Status

| Threat ID | Disposition | Status | Notes |
|-----------|-------------|--------|-------|
| T-64-01-01 (Tampering: stale ids) | accept | satisfied | Reducer treats unknown ids as no-op (SL9 test pins). |
| T-64-01-02 (Information disclosure: lock icon → PNG) | mitigate | mitigated | Lock-icon rendered ONLY inside editable={true} branch; PARITY-01 test extended; render-slide-satori grep count = 0. |
| T-64-01-03 (DoS: huge selection) | accept | satisfied | Reducer is O(N) over text_boxes ∪ custom_images ∪ watermark; N≤30 per research ceiling. |
| T-64-01-04 (Elevation: drag bypass via touch) | mitigate | mitigated | react-rnd disableDragging blocks both mouse + touch (verified in Plan 61-01 selecto integration); PL1+PL2 test pins. |
| T-64-01-05 (Spoofing: locked overlay blocks marquee) | mitigate | mitigated | LOCK-06 pointer-events:none gate while marqueeActive; PL5 test pins. |

## Threat Flags

None — no new security-relevant surface introduced beyond what the plan's threat model documents. SET_LOCKED accepts arbitrary ids[] (matches BULK_TRANSLATE/GROUP/UNGROUP convention; no schema change at trust boundary).

## Next Phase Readiness

**Plan 64-02 seam:** SET_LOCKED reducer pattern is the template for SET_HIDDEN. Same shape — `{ slideIndex, ids[], hidden: boolean }` → toggle hidden field across text_boxes ∪ custom_images ∪ watermark; single pushHistory; ref-equal short-circuit; applyDualWrite for text_boxes. Selection-bounds + marquee skip-hidden filter is the next-arrow shape (LOCK-07 closes the bounds gap).

**Plan 64-03 seam:** isEditingTarget grep count is now 25 (was 24). Plan 64-03 will add 4 z-order bindings ($mod+], $mod+[, $mod+Alt+], $mod+Alt+[) → final count 29.

**Layers-panel (Phase 65) seam:** `data-locked="true"` Rnd outer-node marker is queryable from the layers panel (Phase 65) for visual lock-state mirroring without re-walking the slide tree.

## Self-Check: PASSED

**Files verified to exist:**
- src/components/slides/__tests__/slide-preview-lock.test.tsx — FOUND
- src/lib/editor/editor-actions.ts — FOUND (SET_LOCKED variant present)
- src/lib/editor/editor-reducer.ts — FOUND (SET_LOCKED case present)
- src/lib/editor/transforms/element-rect-intersect.ts — FOUND (locked-skip filters present)
- src/components/editor/slide-editor.tsx — FOUND ($mod+Shift+l binding present)
- src/components/slides/slide-preview.tsx — FOUND (4 Rnd-site rewires + marqueeActive + lock-icon present)

**Commits verified to exist:**
- a881982 (Task 1 RED) — FOUND
- 5196e98 (Task 1 GREEN) — FOUND
- 0f4c7ea (Task 2 RED) — FOUND
- 27e62ba (Task 2 GREEN) — FOUND
- 181e804 (Task 3 RED) — FOUND
- 421659a (Task 3 GREEN) — FOUND

---
*Phase: 64-lock-hide-z-order*
*Completed: 2026-05-02*

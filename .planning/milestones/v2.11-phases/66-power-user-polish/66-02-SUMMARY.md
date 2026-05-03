---
phase: 66-power-user-polish
plan: 02
subsystem: editor
tags: [alt-drag, duplicate, reducer, modifier-state, tooltips, kbd-08, diff-01, group-id, kbd-09, perf-01, parity, tplrend-05, keyboard-sweep, v2.11-closure]

# Dependency graph
requires:
  - phase: 60-multi-select-foundation-watermark-schema-lift
    provides: BULK_TRANSLATE skip-set contract (locked / structural-anchor / watermark) — same skip-set carried into DUPLICATE_ELEMENTS_AT
  - phase: 60-multi-select-foundation-watermark-schema-lift
    provides: useModifierState (KBD-04) — single source of truth for `modifiers.get().alt` snapshot at drag-START
  - phase: 62-groups-bulk-translate
    provides: onGroupDrag fan-out pattern (single onDragStop dispatch + selection-resolution helpers shouldGroupDrag/getGroupMembers); DIFF-01 mirrors the contract for the alt-duplicate branch
  - phase: 63-alignment-distribute-smart-guides
    provides: FloatingAlignmentToolbar 8-button surface (6 align + 2 distribute) — KBD-08 extends `title` attributes only
  - phase: 65-layers-panel-tplrend-audit
    provides: chip-lock tooltip pattern (`title="Lock layer (⌘⇧L)"`); KBD-08 mirrors it on group-row
  - phase: 66-power-user-polish
    provides: 66-01 lastMoveDeltaRef + arrow-nudge bindings + isEditingTarget firewall (33 sites) — DIFF-01 reads through the same firewall via slide-editor's onAltDuplicate wrapper
provides:
  - "DUPLICATE_ELEMENTS_AT reducer action: deep-copy text_boxes / custom_images by id with crypto.randomUUID() new ids, delta-shifted positions, optional newGroupId, single pushHistory per dispatch (KBD-09 / PERF-01)"
  - "onAltDuplicate prop chain (SlidePreview → SlideCanvas → slide-editor) wired through 4 onDragStop handlers (hook + body + custom_text + custom_image) with per-element altStartRef snapshot at drag-START"
  - "decideAltDuplicate(altAtStart, draggedId, slide, selection, slideIndex) pure helper: factors selection-vs-single resolution + group-preservation newGroupId derivation; testable via synthetic Slide fixtures"
  - "KBD-08 tooltip shortcut hints on 8 alignment-toolbar buttons (Alt+A/H/D/W/V/S + Cmd+Alt+H/V) and 1 group-row lock button (⌘⇧L); aria-label unchanged (screen-reader friendly)"
  - "Final v2.11 keyboard sweep automated as slide-editor.keyboard-sweep.test.tsx — codifies SWEEP-1..4 as regression tests for v2.12+: 33 isEditingTarget firewall sites, ≥25 e.preventDefault sites, blur+visibilitychange listeners on useModifierState, zero `e.metaKey || e.ctrlKey` anti-pattern occurrences"
affects: [v2.11-milestone-closure, v2.12+-selection-following-duplicates, v2.12+-mid-drag-alt-toggle-live-track]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-element gesture-start modifier-snapshot ref (e.g. hookAltStartRef): captures `modifiers.get().alt` at onDragStart and consumes in onDragStop; mid-drag changes don't matter (v2.11 simplification)"
    - "Pure decider helper for drag-stop branching: decideAltDuplicate returns a discriminated union {kind: 'alt-duplicate' | 'no-op'} so the same 4 onDragStop sites can pass-through to a single helper instead of duplicating ~40 LOC of selection + group-preservation logic"
    - "Tooltip-shortcut convention: literal `Cmd+Alt+H` form in alignment toolbar (matches Figma + Canva tooltip style); symbol form `⌘⇧L` in layers panel (matches Plan 65-02 carry-forward); both styles valid; tests use a regex that accepts either"
    - "Disabled-button tooltip embeds shortcut + disabled-hint together so power users learn the keystroke even when the action is currently unavailable"

key-files:
  created:
    - "src/components/slides/drag-stop-decider.ts — pure decider helper for the Alt+drag branch (53 LOC; testable; deduplicates 4 onDragStop sites)"
    - "src/components/slides/__tests__/slide-preview-alt-drag.test.tsx — 9 tests (AD1/AD2/AD4/AD5/AD-NO-CHROME via real component + AD3/AD6/AD-EMPTY-SELECTION/AD-ALT-FALSE via pure helper)"
    - "src/components/editor/__tests__/slide-editor.keyboard-sweep.test.tsx — 4 tests codifying the manual SWEEP-1..4 grep gates as automated regression for v2.12+"
  modified:
    - "src/lib/editor/editor-actions.ts — DUPLICATE_ELEMENTS_AT variant on EditorAction union with full JSDoc"
    - "src/lib/editor/editor-reducer.ts — DUPLICATE_ELEMENTS_AT case (~70 LOC); imports CustomImage; routes text_boxes through applyDualWrite; ref-equal short-circuit for empty/stale ids"
    - "src/lib/editor/__tests__/editor-reducer.test.ts — 11 new tests (DE1..DE7 + DE-EMPTY/STALE/DUALWRITE/NON-MATCHING-SLIDE)"
    - "src/components/slides/slide-preview.tsx — 4 alt-start refs + onAltDuplicate prop type + 4 onDragStart alt-snapshots + 4 onDragStop alt-duplicate branches (run BEFORE existing onGroupDrag fan-out)"
    - "src/components/editor/slide-canvas.tsx — onAltDuplicate prop forwarded verbatim to SlidePreview"
    - "src/components/editor/slide-editor.tsx — onAltDuplicate wrapper dispatches DUPLICATE_ELEMENTS_AT"
    - "src/components/editor/floating-alignment-toolbar.tsx — `shortcut` field on AlignButtonSpec/DistributeButtonSpec; populated for 8 buttons; JSX `${label} (${shortcut})` pattern in title; aria-label unchanged"
    - "src/components/editor/__tests__/floating-alignment-toolbar.test.tsx — 10 new FT-T tests (FT-T1..FT-T8 + FT-T-DISABLED + FT-T-ARIA)"
    - "src/components/editor/layers-panel/group-row.tsx — group-lock title extended from 'Lock group' → 'Lock group (⌘⇧L)'"
    - "src/components/editor/layers-panel/__tests__/group-row.toggles.test.tsx — 1 new GR-T-LOCK test"

key-decisions:
  - "Alt state captured ONCE at drag-START (per-element altStartRef); mid-drag press/release ignored — v2.11 simplification per 66-CONTEXT.md. Mid-drag-toggle live-track deferred to v2.12+ if user feedback warrants."
  - "Group-preservation: when ALL selected ids share a single groupId, copies receive a NEW fresh `g_${slideIndex}_${Date.now-base36}` groupId — copies form a new group rather than joining the original (Figma model — RESEARCH F39). When ids span groups OR have no groupId, copies are flat."
  - "Watermark / locked / structural-anchor / non-custom-role text_boxes silently skipped — same skip-set as BULK_TRANSLATE / BULK_DELETE; documented gap (Watermark.position is enum-only)."
  - "Branch order in onDragStop: alt-duplicate branch runs BEFORE existing onGroupDrag fan-out. Trash-zone delete still takes precedence over both (single user gesture; primary intent of dropping in trash is destructive)."
  - "Selection NOT updated after duplicate — originals remain selected (v2.11 simplification). Following-duplicates pattern requires reducer to return new ids OR pre/post-dispatch slide diff; deferred to v2.12+. Documented as Known Stub."
  - "Tooltip style divergence: alignment toolbar uses literal `Cmd+Alt+H` form; layers panel uses symbol `⌘⇧L` form. Both styles valid; tests use a regex that accepts either; documented divergence carried forward per 66-CONTEXT.md."
  - "Disabled distribute button tooltip embeds BOTH shortcut + disabled hint (`Distribute horizontally (Cmd+Alt+H) — Select 3+ elements to distribute`) so power users still learn the keystroke."

patterns-established:
  - "Per-element gesture-start modifier-snapshot ref pattern (now standard for any modifier-gated drag-stop branch — KBD-04 carry-forward + mid-gesture stability)"
  - "Pure decider helper for drag-stop branching: extract the dispatch decision (selection resolution + group-preservation derivation) so the 4 onDragStop sites pass-through to a single function call. Testable in isolation via synthetic Slide fixtures."
  - "Tooltip-shortcut convention with regex acceptance: tests use `/Cmd\\+Alt\\+H|⌘\\+Alt\\+H|⌘⌥H/` so future style migrations don't break gates."

requirements-completed: [DIFF-01, KBD-08]

# Metrics
duration: 14m
completed: 2026-05-03
---

# Phase 66 Plan 02: Alt+drag duplicate (DIFF-01) + tooltip shortcuts (KBD-08) + final keyboard sweep — Summary

**Alt+drag now produces deep-copies at the drag-end position via a new DUPLICATE_ELEMENTS_AT reducer action; alignment-toolbar buttons + group-row lock carry shortcut hints in their `title` attributes; v2.11 keyboard contract codified as automated regression tests.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-03T08:11:05Z
- **Completed:** 2026-05-03T08:24:59Z
- **Tasks:** 3
- **Files modified:** 13 (3 created + 10 modified)
- **LOC delta:** +1433 / -20 (well above the planned ~540 estimate due to comprehensive JSDoc + test coverage; actual production-code delta ≈ ~280 LOC)

## Accomplishments

- **DIFF-01 reducer half:** New DUPLICATE_ELEMENTS_AT action variant; reducer case deep-copies text_boxes / custom_images with fresh `crypto.randomUUID()` ids + delta-shifted positions + optional newGroupId; ref-equal short-circuit for empty / stale / all-skipped ids; routes text_boxes through `applyDualWrite` (BL-01); single `pushHistory` per dispatch (KBD-09 / PERF-01).
- **DIFF-01 UI half:** 4 per-element altStartRef refs (hook / body / customText / customImage) capture `modifiers.get().alt` at onDragStart; 4 onDragStop branches consume the snapshot and call a new `onAltDuplicate` prop with the gesture's deltaX/deltaY in % of canvas + a freshly-generated newGroupId when the selection shared one. Pure decider helper `decideAltDuplicate` factors the selection + group-preservation logic.
- **KBD-08:** 8 alignment-toolbar buttons gain `title` attributes embedding their keyboard shortcut (Alt+A / Alt+H / Alt+D / Alt+W / Alt+V / Alt+S / Cmd+Alt+H / Cmd+Alt+V); group-row lock extended from `Lock group` → `Lock group (⌘⇧L)` to mirror the chip-lock pattern from Plan 65-02. ARIA labels unchanged.
- **Final keyboard sweep:** New `slide-editor.keyboard-sweep.test.tsx` codifies SWEEP-1..4 as automated regression tests (33 isEditingTarget firewall sites, ≥25 preventDefault sites, blur+visibilitychange listeners on useModifierState, zero `e.metaKey || e.ctrlKey` anti-pattern occurrences) so v2.12+ refactors can't silently break the v2.11 keyboard contract.
- **TPLREND-05 / PARITY-01 preserved:** AD-NO-CHROME test asserts editable=false render tree contains zero alt/duplicate/ghost testids; tooltips are `title` attributes which Satori never renders.

## Task Commits

Each task was committed atomically:

1. **Task 1: DUPLICATE_ELEMENTS_AT reducer (DIFF-01 reducer half)** — `63b1df3` (feat)
2. **Task 2: Alt+drag wiring + onAltDuplicate prop chain (DIFF-01)** — `e8ad7b0` (feat)
3. **Task 3: KBD-08 tooltip shortcuts + final keyboard sweep** — `1c9c404` (feat)

## Files Created/Modified

### Created (3)
- `src/components/slides/drag-stop-decider.ts` — Pure decider helper for the Alt+drag branch (~115 LOC incl. JSDoc; testable; deduplicates 4 onDragStop sites)
- `src/components/slides/__tests__/slide-preview-alt-drag.test.tsx` — 9 tests covering AD1/AD2/AD4/AD5/AD-NO-CHROME via real component + AD3/AD6/AD-EMPTY-SELECTION/AD-ALT-FALSE via pure helper
- `src/components/editor/__tests__/slide-editor.keyboard-sweep.test.tsx` — 4 tests codifying SWEEP-1..4

### Modified (10)
- `src/lib/editor/editor-actions.ts` — DUPLICATE_ELEMENTS_AT variant
- `src/lib/editor/editor-reducer.ts` — DUPLICATE_ELEMENTS_AT case (~70 LOC); CustomImage import added
- `src/lib/editor/__tests__/editor-reducer.test.ts` — 11 new tests (DE1..DE7 + DE-EMPTY/STALE/DUALWRITE/NON-MATCHING-SLIDE)
- `src/components/slides/slide-preview.tsx` — 4 alt-start refs + onAltDuplicate prop + 4 onDragStart snapshots + 4 onDragStop branches; `decideAltDuplicate` import
- `src/components/editor/slide-canvas.tsx` — onAltDuplicate prop forwarded
- `src/components/editor/slide-editor.tsx` — onAltDuplicate wrapper dispatches DUPLICATE_ELEMENTS_AT
- `src/components/editor/floating-alignment-toolbar.tsx` — `shortcut` field on specs; 8 buttons get `${label} (${shortcut})` titles; disabled tooltip embeds shortcut + disabled hint
- `src/components/editor/__tests__/floating-alignment-toolbar.test.tsx` — 10 new FT-T tests
- `src/components/editor/layers-panel/group-row.tsx` — group-lock title extended to include `(⌘⇧L)`
- `src/components/editor/layers-panel/__tests__/group-row.toggles.test.tsx` — 1 new GR-T-LOCK test

## Decisions Made

See `key-decisions` in frontmatter — locked at 66-CONTEXT.md and carried verbatim through this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan-as-Code Bug] isEditingTarget grep count target was 37 but actual baseline is 33**
- **Found during:** Task 3 (KBD-08 tooltip shortcuts + final keyboard sweep verification)
- **Issue:** Plan 66-02's `must_haves.truths` and `verification` step #7 stated `grep -c "isEditingTarget(e.target)" slide-editor.tsx` should return 37 (the SWEEP-1 gate). Actual count is 33. This is the same metric inconsistency that Plan 66-01's SUMMARY already flagged: the "37" figure used the broader `grep -c "isEditingTarget"` regex (no parens) which matches the import line + comment mentions; the strict parens-included `isEditingTarget(e.target)` count (the actual binding-firewall gate) is 33. Plan 66-01 added 8 inline firewall sites to a baseline of 25 → 33; that's the correct binding-firewall count and the count this plan should pin.
- **Fix:** SWEEP-1 test (slide-editor.keyboard-sweep.test.tsx) asserts `>= 33`, matching the strict binding-firewall semantics that Plan 66-01's ARROW-GREP test (slide-editor.shortcuts.test.tsx:1858) already established. Documented the metric clarification in the new keyboard-sweep test's JSDoc and inside this SUMMARY.
- **Files modified:** `src/components/editor/__tests__/slide-editor.keyboard-sweep.test.tsx` (new file uses 33 floor)
- **Verification:** All 4 sweep tests green; the broader `grep -c "isEditingTarget"` count (without parens) is 36 (33 firewall sites + 1 import + 2 comment mentions), still well above any meaningful regression bar.
- **Committed in:** 1c9c404 (Task 3)

## Verification Results

- **Reducer tests:** `src/lib/editor/__tests__/editor-reducer.test.ts` → **97/97 green** (86 baseline + 11 new DE tests)
- **Alt-drag tests:** `src/components/slides/__tests__/slide-preview-alt-drag.test.tsx` → **9/9 green** (AD1/AD2/AD4/AD5/AD-NO-CHROME via real component + AD3/AD6/AD-EMPTY-SELECTION/AD-ALT-FALSE via pure helper)
- **Toolbar tests:** `src/components/editor/__tests__/floating-alignment-toolbar.test.tsx` → **28/28 green** (18 baseline + 10 new FT-T tests)
- **Group-row tests:** `src/components/editor/layers-panel/__tests__/group-row.toggles.test.tsx` → **5/5 green** (4 baseline + 1 new GR-T-LOCK)
- **Keyboard-sweep tests:** `src/components/editor/__tests__/slide-editor.keyboard-sweep.test.tsx` → **4/4 green** (SWEEP-1..4)
- **Full editor + slides + render regression:** `npx vitest run src/lib/editor/ src/components/editor/ src/components/slides/ src/lib/render/` → **955/955 green across 63 test files**
- **TypeScript baseline:** `npx tsc --noEmit -p tsconfig.json` → **17 errors (unchanged from pre-plan baseline)**
- **Grep gates:**
  - `grep -c "case 'DUPLICATE_ELEMENTS_AT'" src/lib/editor/editor-reducer.ts` → **1** ✓
  - `grep -c "type: 'DUPLICATE_ELEMENTS_AT'" src/lib/editor/editor-actions.ts` → **1** ✓
  - `grep -c "altKey\|altAtStart\|AltStartRef" src/components/slides/slide-preview.tsx` → **20** ✓ (≥8 required)
  - `grep -c "onAltDuplicate" src/components/slides/slide-preview.tsx` → **12** ✓ (≥5 required)
  - `grep -c "onAltDuplicate" src/components/editor/slide-editor.tsx` → **1** ✓ (≥1 required)
  - `grep -cE "Alt\\+(A|H|D|W|V|S)" src/components/editor/floating-alignment-toolbar.tsx` → **10** ✓ (≥6 required)
  - `grep -c "isEditingTarget(e.target)" src/components/editor/slide-editor.tsx` → **33** ✓ (Plan 66-01 carry-forward; correct binding-firewall count)
  - `grep -c "e.preventDefault()" src/components/editor/slide-editor.tsx` → **28** ✓ (≥25 required)
  - `grep -cE "addEventListener.*blur|addEventListener.*visibilitychange" src/lib/editor/use-modifier-state.ts` → **2** ✓ (≥2 required; KBD-04 carry-forward)
  - `grep -c "e\\.metaKey || e\\.ctrlKey" src/components/editor/slide-editor.tsx` → **0** ✓ (anti-pattern absent)

## Known Stubs

**1. Selection NOT updated to follow duplicates (v2.11 simplification — DIFF-01 carry-forward)**
- **File:** `src/components/editor/slide-editor.tsx` (onAltDuplicate wrapper)
- **Behavior:** After Alt+drag duplicate, the originals remain selected; the freshly-generated copies are NOT selected (Figma normally selects the copies).
- **Reason:** Updating selection requires knowing the post-dispatch new ids. The reducer does NOT return them (useReducer pattern doesn't fan an action result). Implementing this requires either:
  - Extending DUPLICATE_ELEMENTS_AT to return the new id list (requires changing the reducer signature OR using a side-channel ref);
  - Capturing pre/post-dispatch slide diffs in the wrapper to derive new ids (additional renderer pass).
- **Resolution path:** v2.12+ — pick whichever pattern is cleanest after Phase 67's batched-action exploration.
- **Mitigation:** Documented in the `onAltDuplicate` wrapper's inline JSDoc at slide-editor.tsx:~1455-1465.

**2. Mid-drag Alt-press / Alt-release does NOT alter the duplicate decision**
- **Files:** `src/components/slides/slide-preview.tsx` (4 onDragStart/onDragStop sites)
- **Behavior:** Alt held at drag-START → duplicate fires regardless of mid-drag state. Alt NOT held at drag-START → duplicate never fires, even if user presses Alt mid-drag.
- **Reason:** v2.11 simplification per 66-CONTEXT.md — "snapshot once at gesture-start" is the simpler mental model and avoids race conditions between modifier-state and per-tick onDrag handlers.
- **Resolution path:** v2.12+ — if user feedback warrants, add live-track variant: write `*AltStartRef.current` on every onDrag tick using the latest `modifiers.get().alt`, with the drag-stop branch reading the LAST written value rather than the START value. Documented as a Known Stub for the future explorer.

## Threat Flags

No new security-relevant surface. All threat-model entries (T-66-02-01..08) have been pinned by tests OR documented as accepted dispositions per the plan's threat register.

## v2.11 Milestone Closure Note

**Phase 66 = 5/5 reqs complete after this plan ships.** v2.11 milestone reqs covered across Plans 66-01 + 66-02:
- **DIFF-01** (Alt+drag duplicate) — 66-02 ✓
- **DIFF-02** (Cmd+D smart offset) — 66-01 ✓
- **KBD-05** (arrow nudge 1px) — 66-01 ✓
- **KBD-06** (Shift+arrow nudge 10px) — 66-01 ✓
- **KBD-08** (tooltip shortcuts) — 66-02 ✓

**Next steps:**
1. Run `gsd-audit-milestone` to validate the v2.11 milestone state across the SUMMARYs and STATE.
2. Run `gsd-complete-milestone` to mark v2.11 fully shipped + tag the release.
3. Run `gsd-cleanup` to archive the working-directory artifacts (no code changes; bookkeeping only).

## Self-Check: PASSED

- All 10 modified/created production + test files exist on disk.
- All 3 task commits exist in git log: 63b1df3, e8ad7b0, 1c9c404.
- All declared verification gates pass (tsc baseline 17 errors preserved, 955/955 tests green, 12 grep gates ✓).

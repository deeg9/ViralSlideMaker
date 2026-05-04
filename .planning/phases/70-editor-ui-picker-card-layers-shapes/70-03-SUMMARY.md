---
phase: 70-editor-ui-picker-card-layers-shapes
plan: 03
subsystem: editor-ui
type: execute
wave: 3
depends_on: [70-01, 70-02]
requires:
  - ADD_DECORATION reducer action (Phase 68 — landed pre-70)
  - selection.replaceWith (Phase 60 useSelectionModel)
  - buildDefaultShapeDecoration factory (Plan 70-01)
  - LucidePickerDynamic wrapper + ShapePicker component (Plans 70-01 / 70-02)
  - isEditingTarget firewall + tinykeys binding map (Phase 60-04)
provides:
  - PICKER-07 (isPickerOpenRef ref-only outer firewall on every tinykeys binding)
  - KBD-10 (R/C/L direct-insert keyboard shortcuts)
  - KBD-11 (I/S picker-open keyboard shortcuts)
  - KBD-12 (SWEEP-PICK behavioral grid + structural grep audit)
  - openPicker state machine ('lucide' | 'shape' | null) for single-open invariant
  - onPickerAddDecoration shared callback (ADD_DECORATION + selection.replaceWith)
affects:
  - src/components/editor/slide-editor.tsx — 32 existing tinykeys sites swept; 5 new bindings (R/C/L/I/S); picker mounts in JSX root
  - editor-route bundle — LucidePickerDynamic chunk now actually has a code-path mount point (still lazy via next/dynamic ssr:false)
tech-stack:
  added: []
  patterns:
    - "Refs-only contract for hot keyboard path (useRef<boolean> mirror of useState — avoids re-render churn that would re-bind all tinykeys handlers on every open/close toggle)"
    - "State-machine over parallel-booleans for picker open state ('lucide' | 'shape' | null) — collapses the impossible 'both pickers open' state at the type level"
    - "Synchronous ref update inside setOpenPicker callback — `_setOpenPicker(next); isPickerOpenRef.current = next !== null` in the same tick avoids stale-ref race that 'update on next render' would cause"
    - "Dual-firewall ordering (PITFALL-9.2 carry-forward): isEditingTarget BEFORE isPickerOpenRef BEFORE preventDefault BEFORE dispatch — preserves browser-default caret behavior in inputs"
    - "1:1 firewall pairing enforced by grep gate — every isEditingTarget(e.target) call MUST be on the same line as `|| isPickerOpenRef.current` in non-comment code"
    - "Picker JSX mounted at editor return root (outside three-panel grid) — modal/popover float above the editor; lazy LucidePickerDynamic + eager ShapePicker share onPickerAddDecoration"
key-files:
  created:
    - src/components/editor/__tests__/slide-editor-keyboard-rcl.test.tsx
    - src/components/editor/__tests__/slide-editor-keyboard-is.test.tsx
    - src/components/editor/__tests__/picker-firewall-grep.test.ts
    - src/components/editor/__tests__/slide-editor-picker-firewall-sweep.test.tsx
  modified:
    - src/components/editor/slide-editor.tsx (5 new tinykeys bindings; 32 existing bindings extended with `|| isPickerOpenRef.current`; LucidePickerDynamic + ShapePicker mounts; openPicker state + isPickerOpenRef ref; setOpenPicker + onPickerAddDecoration callbacks)
decisions:
  - "openPicker as 'lucide' | 'shape' | null state-machine (not parallel useState booleans) so the firewall sync is one expression: `next !== null`. Forbids the impossible 'both pickers open at once' state by construction"
  - "isPickerOpenRef = useRef<boolean>, NOT useState — refs-only contract from v2.11 SWEEP-1..4. Re-rendering on every open/close would re-bind the entire tinykeys map (33 closures); the ref read inside binding bodies is closure-stable across renders"
  - "Synchronous ref update inside setOpenPicker (`_setOpenPicker(next); isPickerOpenRef.current = next !== null`) — if the ref only updated after re-render, a binding firing between setOpenPicker and the next paint would see the STALE ref value and incorrectly fire its dispatch"
  - "Bare lowercase letters (R/C/L/I/S) for new bindings — Canva/Figma convention; tinykeys disambiguates by modifier set so `r` does NOT collide with `$mod+r` (browser refresh) or any future `$mod+r` editor binding. Modifier-less collision risk: zero — every other text-input the editor cares about has the isEditingTarget firewall"
  - "1:1 paired firewall (isEditingTarget + isPickerOpenRef on the SAME line) over a factored helper function — keeps both checks grep-visible per Plan 60-04 contract, makes the SWEEP-PICK-GREP audit a strict line-level invariant"
  - "Single shared onPickerAddDecoration useCallback for both pickers — both call ADD_DECORATION + selection.replaceWith with identical shape; useCallback identity stability avoids re-mount churn when the parent re-renders for unrelated reasons"
  - "Three-tier verification: unit tests (KBD-10 R/C/L, KBD-11 I/S) + structural grep audit (PICKER-07 1:1 pairing) + behavioral SWEEP grid (every shortcut no-ops while picker open + round-trip after close) — same triple-layer pattern as v2.11 SWEEP-1..4 + v2.6 build gate"
metrics:
  duration: 22min
  completed: 2026-05-04T09:07:00Z
  task_count: 3
  files_changed: 5
  tests_added: 48
tags: [decorations, keyboard, tinykeys, picker-firewall, shortcuts, sweep, v2.12]
---

# Phase 70 Plan 03: R/C/L/I/S shortcuts + isPickerOpenRef firewall on 33 tinykeys sites + SWEEP test — Summary

**One-liner:** v2.12 keyboard contract — 5 new direct-insert / picker-open shortcuts (R/C/L/I/S) + 32-site sweep adding `|| isPickerOpenRef.current` short-circuit to every tinykeys binding body, enforced by structural grep audit + 18-test behavioral SWEEP-PICK grid that exercises every critical editor shortcut while the picker is open.

## What shipped

**Task 1 (commit 4ae72b1) — `feat(70-03): R/C/L direct-insert + I/S picker-open keyboard shortcuts`**

- `LucidePickerDynamic` + `ShapePicker` mounted at slide-editor JSX root; both wired to a shared `onPickerAddDecoration` useCallback that dispatches `ADD_DECORATION` then `selection.replaceWith([d.id])` (single pushHistory entry per insert — Phase 68 reducer + KBD-09 carry-forward).
- `openPicker` React state (`'lucide' | 'shape' | null`) drives JSX mount/unmount; `isPickerOpenRef = useRef<boolean>(false)` mirrors `openPicker !== null` and is read inside every tinykeys binding as the second short-circuit.
- `setOpenPicker` useCallback updates BOTH the state AND the ref synchronously to avoid the stale-ref race.
- 5 new tinykeys bindings (R, C, L, I, S):
  - `r/c/l` → `buildDefaultShapeDecoration('rect'|'circle'|'line')` → ADD_DECORATION + selection.replaceWith.
  - `i/s` → `setOpenPicker('lucide'|'shape')` → picker mounts.
  - Each carries the dual firewall on line 1: `if (isEditingTarget(e.target) || isPickerOpenRef.current) return`.
- 11 KBD-10 tests (R/C/L) + 13 KBD-11 tests (I/S) covering: dispatch shape, auto-select, isEditingTarget firewall, isPickerOpenRef firewall, state-machine no-swap invariant (I while ShapePicker open is no-op), close→reopen round-trip, preventDefault gating.

**Task 2 (commit 8b56cb7) — `feat(70-03): isPickerOpenRef second short-circuit on all 33 tinykeys firewall sites`**

- All 32 existing tinykeys binding bodies in slide-editor.tsx extended via `replace_all` from `if (isEditingTarget(e.target)) return` to `if (isEditingTarget(e.target) || isPickerOpenRef.current) return`.
- Final non-comment counts:
  - `isPickerOpenRef.current` mentions: **38** (≥33 plan target met)
  - `isEditingTarget(e.target)` calls: 32 (was 32 — unchanged)
  - Dual-firewall lines (`isEditingTarget(e.target) || isPickerOpenRef.current`): **37** (32 swept + 5 new)
- 6 grep audit tests in `picker-firewall-grep.test.ts`:
  - GREP-1 ≥33 mentions, GREP-2 every isEditingTarget paired with isPickerOpenRef, GREP-3 every isPickerOpenRef paired with isEditingTarget OR is ref decl/setter, GREP-4 count parity, GREP-5 import shape, GREP-6 useRef declaration shape.
- Drift-prevention CI gate: any future binding that uses isEditingTarget without the paired isPickerOpenRef short-circuit fails GREP-2 on the next commit.

**Task 3 (commit 423c58d) — `test(70-03): SWEEP-PICK behavioral grid + 33-site firewall round-trip`**

- 18 SWEEP-PICK tests in `slide-editor-picker-firewall-sweep.test.tsx`. Each test:
  1. Renders `<SlideEditor>` with a fixture pre-grouped + 3 custom_images for observable z-order/align effects.
  2. Opens a picker (`'i'` or `'s'`).
  3. Fires the editor shortcut.
  4. Asserts NO observable reducer effect (no groupId mutation, no count change, no z-order shuffle, no image position change, no lock flag flip).
- Coverage: SWEEP-PICK-1..6 (Cmd+G/Cmd+Shift+G/Cmd+]/Cmd+[/Cmd+Alt+]/Cmd+Alt+[) — group + z-order. SWEEP-PICK-7..9 (Delete/Backspace/Cmd+D) — remove + duplicate. SWEEP-PICK-10..11 (ArrowUp/Shift+ArrowDown) — nudge. SWEEP-PICK-12..13 (Alt+H/Cmd+Alt+H) — align + distribute. SWEEP-PICK-14 (Cmd+Shift+L) — lock. SWEEP-PICK-15 (Cmd+A) — selectAll. SWEEP-PICK-16 (R) — direct-insert. SWEEP-PICK-17 — sibling-picker variant (Cmd+G with ShapePicker open). SWEEP-PICK-18 — round-trip regression net (open → close → Cmd+G fires GROUP normally).

## Verification

- All 4 plan-70-03 test files: **48/48 GREEN** (`vitest run rcl is grep sweep`).
- All 18 editor test files: **217/217 GREEN** (no v2.11 SWEEP-1..4 regression; no slide-editor.shortcuts regression).
- v2.11 SWEEP-1..4 still passes (`isEditingTarget(e.target)` ≥33 — unchanged at 32 + comment line = 33 grep matches).
- `tsc --noEmit` baseline preserved at 17 errors (all pre-existing, none in slide-editor.tsx or decoration-picker/).
- Bundle gate (`bundle-gate.test.ts`): **4/4 GREEN** — LucidePickerDynamic still lazy via next/dynamic; eager ShapePicker delta is small (<10KB; popover-only, no heavy deps).
- Grep counts post-plan in slide-editor.tsx:
  - `isPickerOpenRef.current` total: **38** (37 binding-body mentions + ref declaration + ref setter).
  - `if (isEditingTarget(e.target) || isPickerOpenRef.current) return` lines: **37**.
  - Orphan single-firewall sites (`if (isEditingTarget(e.target)) return$`): **0**.

## Deviations from Plan

None — plan executed exactly as written. Counts came out at 37 dual-firewall sites (plan estimated 38; 32 swept + 5 new R/C/L/I/S = 37; off-by-one was a plan estimate). All grep gates use `>=33` so no impact.

## Self-Check: PASSED

- `src/components/editor/slide-editor.tsx`: FOUND
- `src/components/editor/__tests__/slide-editor-keyboard-rcl.test.tsx`: FOUND
- `src/components/editor/__tests__/slide-editor-keyboard-is.test.tsx`: FOUND
- `src/components/editor/__tests__/picker-firewall-grep.test.ts`: FOUND
- `src/components/editor/__tests__/slide-editor-picker-firewall-sweep.test.tsx`: FOUND
- Commit 4ae72b1 (Task 1): FOUND
- Commit 8b56cb7 (Task 2): FOUND
- Commit 423c58d (Task 3): FOUND

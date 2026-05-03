---
gsd_state_version: 1.0
milestone: v2.11
milestone_name: Full Editor Parity
status: in_progress
stopped_at: Plan 62-01 complete (Wave 1 — data layer). Phase 62 1/3 plans shipped. Ready for Plan 62-02 (UI ring + click handlers) and Plan 62-03 (integration — Cmd+G/Cmd+Shift+G + group drag).
last_updated: "2026-05-03T03:09:12.182Z"
last_activity: "2026-05-03 — Plan 62-01 Wave-1 data layer: getGroupMembers pure helper at src/lib/editor/transforms/group-membership.ts (6 unit tests; cross-type union over text_boxes ∪ custom_images ∪ watermark; comment-stripped purity grep gate). GROUP and UNGROUP variants on EditorAction union (full JSDoc citing GROUP-02..05, KBD-09, PITFALL-3.3 no-nested + PITFALL-3.4 N<=1 no-op + BL-01 dual-write). GROUP reducer case implements subset-of-existing-group dissolve cascade in single O(N) pass — oldGroupIds Set computed pre-pass, used as predicate during mutation map; un-listed members of dissolved old groups have groupId cleared. UNGROUP reducer case is idempotent on already-ungrouped (state-ref-equal when no listed id carries groupId — Test U4). Both cases route text_boxes through applyDualWrite (BL-01) and end with exactly one return pushHistory (KBD-09 / PERF-01). useSelectionModel extended with currentlyInsideGroup + enterGroup(elementId, slide) + exitGroup() — selection-state-outside-reducer-history invariant preserved (Plan 60-03 carry-forward; Test E9 grep-asserts editor-reducer.ts has zero currentlyInsideGroup matches). SEL-10 and SEL-11 effects extended in lock-step to clear the new flag. Test U3 (3-cycle group/ungroup round-trip) pins lossless byte-identity for absolute positions. 81/81 plan-relevant tests pass (6 group-membership + 47 reducer + 28 hook); 165/165 editor-suite tests green (no regression); tsc baseline 17 errors preserved. GROUP-01..05 + KBD-09 marked complete in REQUIREMENTS.md (6/11 Phase 62 reqs closed). 7 atomic commits 28f05fc / 85a2253 / 14b046b / 561edb7 / a630e15 / 30d6edf / 57a88bb."
progress:
  total_phases: 7
  completed_phases: 2
  total_plans: 10
  completed_plans: 8
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02 — v2.11 milestone roadmap approved)

**Core value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.
**Current focus:** v2.11 Full Editor Parity — 7 phases (60–66) covering 97 requirements across 12 categories. Multi-select foundation → Marquee → Group/Ungroup → Alignment+Smart Guides → Lock/Hide+Z-Order → Layers Panel → Polish.
**Success metric (v2.11):** Multi-select + alignment + group/ungroup work end-to-end on text boxes AND custom_images AND watermarks across editor preview + Satori PNG export + HTML render, with TPLREND-05 parity invariant preserved and pattern fidelity to leading design tools demonstrably matched.

## Current Position

Phase: 62 — Group / Ungroup **IN PROGRESS** (1/3 plans shipped — Wave 1 done; Waves 2+3 outstanding)
Plan: 62-01 SHIPPED (Wave 1 — data layer: getGroupMembers helper + GROUP/UNGROUP reducer cases + useSelectionModel currentlyInsideGroup/enterGroup/exitGroup, ~1057 LOC incl. tests, 7 commits `28f05fc` / `85a2253` / `14b046b` / `561edb7` / `a630e15` / `30d6edf` / `57a88bb`)
Status: Phase 62 1/3 complete; GROUP-01, GROUP-02, GROUP-03, GROUP-04, GROUP-05, KBD-09 marked complete in REQUIREMENTS.md (Plan 62-01 owns 6 of Phase 62's 11 reqs). Plan 62-02 (UI ring + click handlers — GROUP-06, GROUP-07, GROUP-08, GROUP-10) and Plan 62-03 (integration — GROUP-09, full Cmd+G/Cmd+Shift+G keyboard wiring) outstanding.
Last activity: 2026-05-03 — Plan 62-01 Wave-1 data layer shipped (commits `28f05fc` / `85a2253` / `14b046b` / `561edb7` / `a630e15` / `30d6edf` / `57a88bb`): see frontmatter last_activity for full detail. 81/81 plan-relevant tests pass; 165/165 editor-suite tests green; tsc baseline 17 errors preserved.

### Earlier in v2.11 (carry-over)

Phase: 61 — Marquee Selection **COMPLETE** (2/2 plans shipped — Waves 1+2 done)
Plan: 61-01 SHIPPED (Wave 1 — pure helpers + selecto install + render-only component, ~604 LOC incl. tests, 7 commits `66513d6` / `7db9555` / `099eda0` / `9c9caa3` / `61c65c7` / `7bce1e3` / `cae384f`); 61-02 SHIPPED (Wave 2 — marquee state machine + KBD-07 axis-constrain + PARITY-01 marquee scan, ~826 LOC incl. tests, 5 commits `4665bef` / `44d009e` / `68df419` / `5ed8e7a` / `6c5de8c`)
Phase 61 status: COMPLETE; SEL-05, SEL-06, SEL-14, KBD-07 all marked complete in REQUIREMENTS.md (Phase 61 owns 4 reqs).

### Earlier in Phase 60 (carry-over)

Phase: 60 — Multi-Select Foundation + Watermark Schema Lift **COMPLETE** (5/5 plans shipped — all 4 waves done)
Plan: 60-01 SHIPPED (schema foundation: 39 LOC, commit `1164c73`); 60-02 SHIPPED (watermark adapter + lazy init + parity gate, ~340 LOC, 3 commits `35b7ce3` / `b67c13a` / `0a7deb9`); 60-03 SHIPPED (useSelectionModel hook + BULK_TRANSLATE action, ~893 LOC incl. tests, 2 commits `082bfe9` / `5f98e5e`); 60-04 SHIPPED (tinykeys keyboard firewall + isEditingTarget + useModifierState + slide-editor.tsx migration, ~408 LOC incl. tests, 4 commits `8bdfc09` / `f62f29d` / `c2a40a2` / `f7760b4`); 60-05 SHIPPED (selection bounds + MultiSelectTypeBar + union AABB ring + click-empty-canvas + Shift-click toggle + PARITY-01 extension, ~735 LOC incl. tests, 3 commits `2edf43b` / `278a0a4` / `c8ef91b`)
Phase 60 status: COMPLETE; SEL-01..04 + SEL-07..13 + SEL-15 + KBD-01..04 + PERF-01 + WMARK-01..05 + PARITY-01 all marked complete in REQUIREMENTS.md (Phase 60 owns 23 reqs).

## v2.11 Phase Map

| Phase | Name | Reqs | Depends |
|-------|------|------|---------|
| 60 | Multi-Select Foundation + Watermark Schema Lift | 23 | — |
| 61 | Marquee Selection | 4 | 60 |
| 62 | Group / Ungroup | 11 | 60, 61 |
| 63 | Alignment / Distribute + Smart Guides (Wave A + Wave B) | 24 | 62 |
| 64 | Lock / Hide + Z-Order | 15 | 60, 62 |
| 65 | Layers Panel + TPLREND-05 Audit | 15 | 62, 64 |
| 66 | Power-User Differentiators + Polish | 5 | 60–65 |

## Cross-Phase Constraints (carry-forward — every plan must honor)

| Constraint | Source | Notes |
|------------|--------|-------|
| `onDragStop` / `onResizeStop` only | v2.10 PERF-01 | Never per-tick `onDrag` / `onResize` |
| `isEditing` keyboard guard | v2.8 KBD-02 | `slide-editor.tsx:344-348` |
| `pushHistory` once per gesture | KBD-09 + ALIGN-08 | Single undo step per multi-element op |
| Editor chrome gates `editable={true}` | TPLREND-05 + PARITY-01 | Selection rings, marquee, smart guides, group bbox, layers panel — all gated |
| Modifier state resets on blur | KBD-04 + SNAP-05 | `window.blur` + `visibilitychange` |
| Z-order = array splice | ZORDER-05 + Satori invariant | Never CSS `z-index` |
| Selection state outside reducer history | SEL-15 + v2.8 pattern | React state only |

## Deferred Items

Items acknowledged and deferred at milestone v2.10 close on 2026-05-02:

| Category | Item | Status |
|----------|------|--------|
| verification_gap | Phase 59 — A11Y-01 iPhone Safari touch QA | deferred per orchestrator (localhost not iPhone-reachable; desktop side fully verified) |
| stale_quick_tasks | 32 pre-v2.10 quick task directories without SUMMARY frontmatter | pre-existing — not introduced by v2.10; cleanup is its own future task |

## Performance Metrics

**Velocity (from v1.0 through v2.10):**

- Total milestones shipped: v1.0, v1.1, v1.3, v2.0, v2.1, v2.2, v2.4, v2.5, v2.6, v2.7, v2.8, v2.9, v2.10
- Latest: v2.10 (1 phase, 4 plans, 13/13 reqs at code level — 2026-05-02)
- Tests trajectory: v2.10 ended at +50 phase-specific tests, 47/47 green in 3 phase test files

**v2.11 Progress:**

7 phases planned (60–66). 2/7 complete (Phases 60 + 61). Phase 62 IN PROGRESS (1/3 plans shipped). 33/97 requirements satisfied (23 from Phase 60 + 4 from Phase 61 + 6 from Plan 62-01: GROUP-01..05 + KBD-09). Plan 62-01 metric: 23 min, 7 commits, 1057 LOC delta, 23 new tests (6 helper + 12 reducer + 11 hook = 29 if counting cross-type defensive E10/E11; the plan called for 9 hook tests but 11 shipped — Rule 2 deviation auto-documented).

## Accumulated Context

### Decisions

- [v2.11 / 62-01]: GROUP reducer subset-dissolve cascade implemented as single-pass detection + mutation. `oldGroupIds: Set<string>` is computed in a pre-pass over the target slide's text_boxes ∪ custom_images ∪ watermark; the mutation walk then has both predicates: `idSet.has(id)` for assignment + `oldGroupIds.has(element.groupId)` for cascade clearance of un-listed members of dissolved old groups. Single O(N) pass per element-type-array. PITFALL-3.3 (no nested groups) prevented at write time — Test G4 pins.
- [v2.11 / 62-01]: GROUP / UNGROUP reducer no-op contracts. GROUP returns `state` reference-equal when `action.ids.length <= 1` (PITFALL-3.4 — Tests G2/G3). UNGROUP returns `state` reference-equal when no listed id carries a defined groupId (Test U4 — `anyChange` boolean tracked across slide-walk; pushHistory only fires when true). Both prevent history pollution from accidental dispatches.
- [v2.11 / 62-01]: GROUP / UNGROUP route text_boxes through applyDualWrite when mutated (BL-01 invariant) — Tests G6, U5 verify legacy custom_texts mirror is regenerated; hook_text/body_text untouched. Single pushHistory per dispatch (KBD-09 / PERF-01) — Tests G1, U1 verify past.length grows by exactly 1.
- [v2.11 / 62-01]: groupId removal via destructure: `const { groupId: _g, ...rest } = element` produces an object literally without the key (rather than `{ ...element, groupId: undefined }`). Matches Test U3 byte-identity expectation across 3-cycle round-trip — group/ungroup/group/ungroup/group/ungroup preserves absolute positions exactly.
- [v2.11 / 62-01]: useSelectionModel.currentlyInsideGroup lives in React useState + useRef mirror (mirrors idsRef/primaryRef from Plan 60-03) — selection-state-outside-reducer-history invariant preserved. Test E9 grep-asserts editor-reducer.ts has zero `currentlyInsideGroup` references. SEL-10 (slide-switch) and SEL-11 (stale-id prune) effects extended in lock-step: SEL-11 computes `validGroupIds` from surviving elements and clears the flag if its groupId is no longer reachable.
- [v2.11 / 62-01]: useSelectionModel.enterGroup(elementId, slide) takes the slide as a 2nd arg by design — the hook stays decoupled from a slide reference internally, avoiding a useEffect that would re-fire on every presentSlides mutation. exitGroup uses functional updater preserving prev ref when already null (idempotent + callback-ref-stable).
- [v2.11 / 62-01]: Pure helper getGroupMembers(slide, groupId) walks text_boxes ∪ custom_images ∪ watermark in that order (matches selectAll insertion order from Plan 60-03). Empty groupId ('' falsy) short-circuits to [] — undefined fields must never match ''. Cross-type union pinned by Test 4.
- [v2.11 / 62-01]: Action variant decision deferred groupId construction to the dispatcher (Plan 62-03) — reducer treats `action.groupId` as opaque, no validation or re-generation. CONTEXT D-01 honored: nanoid still absent from package.json; no new dependency added.
- [v2.11 / 61-02]: Marquee state machine on slide-preview canvas root replaces Plan 60-05's onClick. onPointerDown + onPointerMove + onPointerUp (PITFALL-2.4 touch-parity carry-forward). `e.target===e.currentTarget` gate (PITFALL-2.1) prevents pointer-down on a child element from starting a marquee. IDLE→DRAGGING→IDLE; ESC-cancel via window keydown listener mounted only while DRAGGING (bypasses isEditingTarget intentionally — cancellation must always work). No-drag branch (rect.w<=2 && rect.h<=2) preserves Plan 60-05 click-empty-canvas-clears semantic. Drag branch: convert pixel rect→% via REF_WIDTH/REF_HEIGHT then call elementsInRect; dispatch replaceWith (no shift) or addToSelection (shift held). Empty marquee + shift = no-op (Figma).
- [v2.11 / 61-02]: selecto Day-1 verification — FALLBACK PATH locked. Manual px→% transform via existing scale factor; selecto package installed (Plan 61-01) but hit-tester unused. Avoids Day-1 setScale debugging surface entirely; marquee hit-testing happens via our own pure elementsInRect.
- [v2.11 / 61-02]: `applyAxisConstrain` pure helper at `src/lib/editor/transforms/axis-constrain.ts`. Wired BEFORE calculateSnap in all 4 onDrag handlers (hook/body/custom-text/custom-image). Snap refines on the FREE axis under Shift-lock. Per-element drag-start refs populated in onDragStart, cleared in onDragStop (mirrors resize-ref pattern at lines 369-371; T-61-02-04 mitigation: no accumulation). Equal-delta tie-break: lock X (free Y) — deterministic, prevents floating-point flicker. TouchEvent has no shiftKey — graceful no-op on touch (matches Plan 59 corner-resize Shift escape pattern at line ~1066).
- [v2.11 / 61-02]: PARITY-01 marquee gate — strengthened existing chrome regex scan with `data-testid="*marquee*"` (className regex from Plan 60-05 cannot see testid leaks). 2 new it() blocks: editable={false} with N>=2 selection state → marquee testid absent (structural gate via line-665 early return); editable={true} idle state (rect=null) → testid absent (negative gate; MarqueeOverlay returns null). 23/23 parity tests passing (21 baseline + 2 new).
- [v2.11 / 61-01]: `normalizeRect(x0,y0,x1,y1)` pure helper at `src/lib/editor/transforms/normalize-rect.ts` returns canonical `{x, y, w, h}` with non-negative w/h regardless of drag direction. Coordinate space is caller-defined (px or %) — the helper only swaps endpoints. PITFALLS Cat-2.3 (negative-dimension AABB intersect) is mitigated by centralizing normalization here.
- [v2.11 / 61-01]: `elementsInRect(slide, rect)` pure helper at `src/lib/editor/transforms/element-rect-intersect.ts` walks `text_boxes` (only `role==='custom'` with `anchor==='custom'`) + `custom_images`; skips watermark + structural-anchor TextBoxes (mirrors Plan 60-05 selection-bounds.ts conservative scope). Includes locked elements (Phase 64 wires locked semantics later — no UX consequence in Phase 61). Coord convention: rect AND element AABBs are PERCENTAGES of REF_WIDTH (1080) × REF_HEIGHT (1920); Plan 61-02 must convert selecto's pixel coords to % BEFORE calling. Intersect mode: hitRate=0 (any overlap counts including 1px). TextBox custom-anchor height uses 1-px-strip approximation (h=1) because schema doesn't carry explicit height — Phase 63 alignment will lift via shared height resolver.
- [v2.11 / 61-01]: `MarqueeOverlay` render-only React component at `src/components/editor/marquee-overlay.tsx` accepts `rect: MarqueeRect | null` prop. Renders single absolute-positioned div with dashed cyan border + translucent fill + `pointer-events: none` (PITFALLS Cat-2.5 — clicks pass through). Owns NO state — Plan 61-02 owns selecto handlers + rect prop. `data-testid="marquee-overlay"` gate ready for Plan 61-02 parity-test extension (PARITY-01). Coord convention for the overlay specifically is SCALED-CANVAS PIXELS (selecto native), NOT %; the overlay sits inside the same scale wrapper as elements (PITFALL-5.3 carry-forward).
- [v2.11 / 61-01]: `selecto@1.26.3` pinned to exact version (no caret) — matches `tinykeys: "3.0.0"` pin pattern. Supply-chain mitigation for STRIDE-S threat T-61-01-04. Day-1 `setScale` + scaled-canvas verification still owed by Plan 61-02 Task 1.
- [v2.11 / 61-01]: Pure-module purity invariant verified via static-grep test on source file (Test 8 / Test 13 pattern). Both new transforms pass `grep -cE "(react|'use client'|document\\.|window\\.)"` with 0 matches. Established convention: pure-module headers describe purity in prose ("no React, no use-client directive, no DOM access") rather than embedding the literal `'use client'` token, which the grep regex matches against.
- [v2.11 / 60-05]: `computeSelectionBounds(slide, ids)` lives at `src/lib/editor/transforms/selection-bounds.ts` (new directory) — pure module, no React/DOM, importable from server/RPC/MCP. Phase 60 conservative behavior: skip structural-anchor TextBoxes (DOM-ref height resolution arrives in Phase 63) + skip watermark (resolveWatermark owns size at render time, Phase 62/63 may revisit).
- [v2.11 / 60-05]: Selection ring rendered with `data-testid="multi-selection-ring"` STRUCTURALLY inside editable={true} branch of slide-preview.tsx (line 1725 vs non-editable early return at line 665). PARITY-01 test asserts the testid is absent from editable=false render tree even when selection={{ ids: [...], primary: ... }} is explicitly passed. TPLREND-05 invariant satisfied by construction, not by guard.
- [v2.11 / 60-05]: 4 per-element onMouseDown sites (hook / body / custom-text / custom-image) extended uniformly: Shift+click toggles membership (SEL-02/03); plain click replaces selection (SEL-01); Cmd+click is a no-op in Phase 60 (deep-select-through-groups arrives in Phase 62).
- [v2.11 / 60-05]: `MultiSelectTypeBar` Phase 60 minimal surface — count header + type breakdown (text boxes / images / watermark) + Delete button. No font/color/treatment fields (Phase 63 surface). No "primary" / key-object UX (PITFALL-12.3 honored, statically grep-checked in Test 8).
- [v2.11 / 60-05]: TYPE BAR Delete only routes through removeTextBox (custom only) + handleRemoveCustomImage. Hook/body/watermark are silently skipped (Plan-Checker risk #2 acknowledged); full bulk-delete reducer action arrives in Phase 64.
- [v2.11 / 60-05]: Added `setSelection(next | (prev) => next)` API to useSelectionModel using ref-mirror pattern (idsRef + primaryRef synced via useEffects). Functional-updater branch reads consistent state synchronously without nested setState (anti-pattern in React strict mode).
- [v2.11 / 60-04]: `tinykeys@3.0.0` registered to `window` (NOT a child div) replaces hand-rolled keydown switch. Six bindings: `$mod+1/2/3` + `$mod+d` + `$mod+a` + `Escape` + `Delete/Backspace`. Every binding inlines `if (isEditingTarget(e.target)) return; e.preventDefault();` (KBD-02 + KBD-03). `$mod` cross-resolves Meta/Control per-OS — no platform branching in handler.
- [v2.11 / 60-04]: `isEditingTarget` helper at `src/lib/editor/keyboard-utils.ts` falls back to `document.activeElement` when target isn't an HTMLElement (Window/Document case — covers test fireEvent dispatches and corner cases without focused element). Real bubbled keydowns hit the fast path.
- [v2.11 / 60-04]: `useModifierState` hook at `src/lib/editor/use-modifier-state.ts` is REFS-ONLY (no useState). Resets on `window.blur` AND `document.visibilitychange` (KBD-04). Phase 63 will read state.cmd inside a 60Hz drag handler — refs are mandatory to avoid re-render cascade through `<Rnd>`.
- [v2.11 / 60-04]: Plan-Checker Warning 1 resolved via Option A — explicit per-binding isEditingTarget guards (final grep count 9, well above ≥6 threshold). Headroom for Phase 62/64 binding additions without re-doing verification math.
- [v2.11 / 60-04]: `useSelectionModel` layered ALONGSIDE legacy `selectedTextBoxId` from `useSlideEditor`. Keyboard handlers write to BOTH so v2.8 single-select consumers (SlideCanvas, TextEditorPanel) keep working unchanged. Phase 66 retires the dual-write once selection-aware props ship in Plan 60-05+.
- [v2.11 / 60-04]: `src/types/tinykeys.d.ts` ambient module shim — tinykeys@3.0.0 ships .d.ts but its `exports` field has no `types` condition, so under tsconfig `moduleResolution: "bundler"` TS resolves to .module.js and reports TS7016. Shim re-declares the public surface; can be deleted if upstream publishes a fix.
- [v2.11 / 60-03]: `useSelectionModel` lives at `src/lib/editor/use-selection-model.ts`. Mutator API exposes 6 ops (replaceWith / addToSelection / removeFromSelection / toggleInSelection / clear / selectAll) returning ref-stable references via `useMemo`. Selection state never enters reducer history.
- [v2.11 / 60-03]: `Selection.primary` clears (NOT auto-promotes) when invalidated by stale-id pruning — matches PITFALLS-12.3 no-key-object UX.
- [v2.11 / 60-03]: SEL-10 slide-switch reset is INDEPENDENT of stale-id pruning — slide-switch ALWAYS clears, even if a selected id would have remained valid on the new slide.
- [v2.11 / 60-03]: BULK_TRANSLATE reducer action skips locked=true (Phase 64 honor pre-installed), text_boxes with `anchor !== 'custom'` (RESEARCH Q7 conservative), and watermark entirely (enum-only position; documented gap for Phase 62/63).
- [v2.11 / 60-03]: BULK_TRANSLATE routes text_boxes through `applyDualWrite` so BL-01 invariant holds for multi-element drags.
- [v2.11 / 60-02]: Watermark id strategy locked at deterministic `w_${slideIndex}` (RESEARCH Q2 idempotent across loads).
- [v2.11 / 60-02]: Lazy-init adds `slide.watermark` from legacy slot but RETAINS `style_overrides.watermark` populated. `resolveForcedWatermark` continues reading the legacy slot, so the free-tier `enabled=false` opt-out lock survives the schema lift unchanged. Both paths coexist for one milestone (sunset: v2.12+ post-PMF).
- [v2.11 / 60-02]: NO functional change to `render-slide-satori.tsx` or `slide-preview.tsx` — comment annotations only. Byte-identity preserved by the lazy-init mirror, NOT by changing the resolver contract.
- [v2.11 / 60-02]: PARITY-01 SEED uses whole-word regex `\\bselection\\b` / `\\bmarquee\\b` / `\\bguide\\b` (NOT substring). Plan 60-05 selection ring MUST keep its className gated to `editable={true}`.
- [v2.11]: Flat schema only — `groupId?` / `locked?` / `hidden?` are optional additive fields. No `Slide.groups[]`. No nested groups. Group exists iff 2+ elements share a `groupId`.
- [v2.11]: Watermark unification (WMARK-01..05) lands in Phase 60 (NOT split into 60.5) — schema lift is interdependent with `Selection { ids, primary }` model since right-rail "Mixed" placeholder must accept watermarks.
- [v2.11]: Phase 63 keeps Alignment + Smart Guides combined as Wave A / Wave B — sorted-edge-array snap index is shared between alignment bounding-box math and smart-guide visualization. Splitting risks scope drift.
- [v2.11]: Layers panel mounts in LEFT rail (industry-unanimous: Figma/Canva/Sketch/tldraw). Drag-to-reorder deferred to v2.12 due to react-arborist + React 19 StrictMode risk; button-based reorder ships in v2.11.
- [v2.11]: 3 new npm packages: `selecto@1.26.3` (marquee), `tinykeys@3.0.0` (keyboard), `react-arborist@3.5.0` (layers panel). Day-1 StrictMode verification required for arborist.
- [v2.11]: All 3 power-user differentiators in scope: Lock (Cmd+Shift+L), Alt-drag duplicate, equal-spacing "==" guide. Cmd+D smart offset bonus.
- [v2.11]: Snap threshold 5px (lowered from current 10) per Moveable/Figma measurements. Asymmetric hysteresis (enter ≤5, exit >7) prevents flicker.
- [v2.11]: Floating alignment toolbar above selection bounds (Figma pattern), not fixed top-of-canvas (Canva).
- [v2.11]: Selection state lives in React state outside reducer history (matches v2.8 `selectedTextBoxId` pattern). Insertion-order `string[]`, never `Set`.
- [v2.11]: Z-order = array splice within owning array (text_boxes / custom_images / watermarks). Cross-array z-order deferred to v3.0+ schema unification.
- [v2.11]: No "primary" key-object concept (Illustrator UX trap). Right rail TYPE BAR shows shared ops + "Mixed" placeholder.
- [v2.11]: Phase numbering continues from 60 (v2.10 ended at 59). v2.11 ends at Phase 66.

(carry-over from v2.10)

- [v2.10]: Stayed on `react-rnd@10.5.3` — 6-line `enableResizing` flip beats library swap. v2.11 keeps this decision.
- [v2.10]: Past-cap behavior: box keeps growing, font caps at 240/120. Forgiving > honest.
- [v2.10]: Dispatch on `onResizeStop` only — prevents 60-tick history pollution. v2.11 PERF-01 carries this forward to multi-drag.

### Pending Todos

- v2.11: Phase 62 (Group / Ungroup) IN PROGRESS — 1/3 plans shipped (62-01 data layer done; GROUP-01..05 + KBD-09 closed). Plan 62-02 (UI ring + click handlers — GROUP-06, GROUP-07, GROUP-08, GROUP-10) consumes getGroupMembers + currentlyInsideGroup. Plan 62-03 (integration — Cmd+G/Cmd+Shift+G keyboard + group drag via BULK_TRANSLATE) consumes the GROUP/UNGROUP actions + enterGroup/exitGroup; owns the `g_${slideIndex}_${Date.now().toString(36)}` groupId construction at the dispatch site (CONTEXT D-01 — nanoid still absent). applyAxisConstrain helper + per-element drag-start refs from Plan 61-02 are reusable for Plan 62-03's group leader-element drag.
- v2.11 Day 1 of Phase 65: verify `react-arborist@3.5.0` works clean under React 19 StrictMode (react-dnd@14 known to double-fire `useDrag` in dev). Fallback: `react-complex-tree@2.4.6`.
- v2.11 Phase 61 deferred: 10-step manual smoke-test recipe (visual confirmation of KBD-07 across 4 element types + 4-direction marquee at scale=0.4) — integration tests cover all 9 functional cases, helper unit tests cover the math; visual smoke test could be a Playwright e2e if scale-aware behavior needs visual assertion.
- v2.11 Phase 63: replace 1-px-strip TextBox-height approximation in `elementsInRect` with a shared height resolver (also consumed by `selection-bounds.ts`) once the rendered-height observer pattern at slide-preview.tsx:589-637 is lifted into a pure helper.
- v2.11 Phase 63: perf test smart-guide engine at N=30 elements — budget <2ms per pointer-move.
- Carry-over: Manual iPhone Safari touch QA for v2.10 corner resize handles (A11Y-01 deferred).
- Carry-over: Manual visual QA on v2.9 templates (NYT/SSENSE / Loewe-Duolingo / AIGA fidelity).

### Blockers/Concerns

- None active for v2.11 — all gray-area decisions resolved at requirements lock (watermarks in scope, layers panel in left rail, 5px snap threshold, floating toolbar above selection).
- Carry-over reminder: TPLREND-05 parity invariant — every editor-only addition must gate behind `editable={true}` so Satori/HTML render paths stay byte-identical. Selection rings, marquee, smart guides, alignment indicators, group bounding boxes, layers panel are all editor-only.
- Carry-over reminder: `hook-fit.ts` interaction is highest-risk regression for any text-box transform — group/multi-select operations must respect auto-shrink precedence at `slide-preview.tsx:313`.
- Watch item: Phase 63 is largest at 24 reqs (>15 instruction threshold). Wave A/Wave B substructure mitigates; if Wave B perf budget fails verification, may need to split into Phase 63.1 fallback.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260502-mre | Remove Generate Captions button + default new carousels to Public | 2026-05-02 | 92af6a7 | [260502-mre-remove-generate-captions-button-and-defa](./quick/260502-mre-remove-generate-captions-button-and-defa/) |
| 260502-ntp | Raise prompt-box char limit 500→2000 + upgrade Gemini system prompt with 2025-26 hook patterns + slop forbid list | 2026-05-03 | 8c4fa69 | [260502-ntp-raise-prompt-box-character-limit-and-upg](./quick/260502-ntp-raise-prompt-box-character-limit-and-upg/) |
| 260502-oim | Render first slide as dashboard thumbnail + add inline left/right slide-navigation arrows | 2026-05-03 | e0e7b0d | [260502-oim-replace-dashboard-project-thumbnails-wit](./quick/260502-oim-replace-dashboard-project-thumbnails-wit/) |
| 260502-pss | Lazy-mount dashboard SlidePreview via IntersectionObserver (perf follow-up to 260502-oim) | 2026-05-03 | c255409 | [260502-pss-lazy-mount-dashboard-slidepreview-via-in](./quick/260502-pss-lazy-mount-dashboard-slidepreview-via-in/) |
| 260502-pw8 | Per-segment bold + numbered/bulleted lists + indent on slide-editor text boxes (Word/Figma/Canva pattern) | 2026-05-03 | de296c0 | [260502-pw8-add-bold-numbered-bulleted-list-indent-f](./quick/260502-pw8-add-bold-numbered-bulleted-list-indent-f/) |

(prior history truncated — latest before this: 260502-er5 watermark right-rail UI on 2026-05-02)

## Session Continuity

Last activity: 2026-05-03 — **Plan 62-01 shipped** (commits `28f05fc` + `85a2253` + `14b046b` + `561edb7` + `a630e15` + `30d6edf` + `57a88bb`): Phase 62 Wave-1 data layer landed atomically. getGroupMembers pure helper at `src/lib/editor/transforms/group-membership.ts` (6 unit tests; cross-type union over text_boxes ∪ custom_images ∪ watermark; empty groupId short-circuits to []; comment-stripped purity grep gate). GROUP and UNGROUP variants on EditorAction union (full JSDoc citing GROUP-02..05, KBD-09, PITFALL-3.3, PITFALL-3.4, BL-01). GROUP reducer case implements subset-of-existing-group dissolve cascade in single O(N) pass — `oldGroupIds: Set<string>` computed in a pre-pass, used as predicate during the mutation map; un-listed members of dissolved old groups have groupId cleared (PITFALL-3.3 prevented at write time — Test G4 pins). UNGROUP reducer case is idempotent on already-ungrouped (Test U4 — `anyChange` boolean tracked across slide-walk; pushHistory only fires when true). Both cases route text_boxes through applyDualWrite (BL-01) and end with exactly one `return pushHistory(state, slides)` (KBD-09 / PERF-01). useSelectionModel extended: `currentlyInsideGroup: string | null` + `enterGroup(elementId, slide)` + `exitGroup()`. Selection-state-outside-reducer-history invariant preserved (Plan 60-03 carry-forward; Test E9 grep-asserts editor-reducer.ts has zero `currentlyInsideGroup` references). SEL-10 (slide-switch) and SEL-11 (stale-id prune) effects extended in lock-step to clear the new flag — SEL-11 computes `validGroupIds` from surviving elements. Test U3 (3-cycle group/ungroup round-trip) pins lossless byte-identity for absolute positions. groupId removal via destructure (`const { groupId: _g, ...rest }`) produces objects without the key, satisfying Test U3 byte-identity. 81/81 plan-relevant tests pass (6 group-membership + 47 reducer + 28 hook); 165/165 editor-suite tests green (no regression); tsc baseline 17 errors preserved. Plan 62-01 self-check PASSED (7 files + 7 commits verified). GROUP-01, GROUP-02, GROUP-03, GROUP-04, GROUP-05, KBD-09 marked complete in REQUIREMENTS.md (6/11 Phase 62 reqs closed). Plan-Checker Rule 2 deviation: tests E10/E11 added beyond plan's E1-E9 list for cross-type enterGroup defensive coverage (custom_image + watermark members) — pure test addition, no production-code scope creep.
Stopped at: Plan 62-01 complete (Wave 1). Phase 62 1/3 plans shipped. Ready for Plan 62-02 (UI surface — group bounding ring editable=true, double-click enter, click-outside exit, group-aware click handlers, PARITY-01 group gate extension; GROUP-06/07/08/10) and Plan 62-03 (integration — Cmd+G/Cmd+Shift+G tinykeys, group-aware Esc, shouldGroupDrag helper, group drag onDragStop → BULK_TRANSLATE; GROUP-09 + the rest of GROUP-08).
Next: Plan 62-02 (UI) and Plan 62-03 (integration) can both consume the stable contracts from Plan 62-01. groupId construction string `g_${slideIndex}_${Date.now().toString(36)}` (CONTEXT D-01 — nanoid absent) is owned by Plan 62-03's dispatch site.

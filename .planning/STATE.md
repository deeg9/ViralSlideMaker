---
gsd_state_version: 1.0
milestone: v2.11
milestone_name: Full Editor Parity
status: phase_61_in_progress
stopped_at: "Phase 61 Plan 01 COMPLETE. Pure helpers (normalizeRect + elementsInRect) + MarqueeOverlay render-only component + selecto@1.26.3 install all shipped. Ready for Plan 61-02 (selecto handler wiring + onPointerDown swap + KBD-07 axis-constrain + PARITY-01 extension)."
last_updated: "2026-05-03T02:25:18.000Z"
last_activity: "2026-05-03 — Plan 61-01 Wave-1 marquee foundation: normalizeRect pure helper at src/lib/editor/transforms/normalize-rect.ts (8 tests, 4 directions + degenerate + purity grep), elementsInRect pure helper at src/lib/editor/transforms/element-rect-intersect.ts (14 tests, Figma intersect/hitRate=0, watermark + structural-anchor TextBox skip mirroring Plan 60-05, 1-px-strip TextBox-height approximation), MarqueeOverlay render-only React component at src/components/editor/marquee-overlay.tsx (7 tests, null-prop returns null, dashed cyan border, pointer-events:none, data-testid='marquee-overlay'), selecto@1.26.3 installed at exact pin. 29 new tests + 31 Phase 60 regression all green; tsc baseline 17 maintained. SEL-14 marked complete in REQUIREMENTS.md."
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 7
  completed_plans: 6
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02 — v2.11 milestone roadmap approved)

**Core value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.
**Current focus:** v2.11 Full Editor Parity — 7 phases (60–66) covering 97 requirements across 12 categories. Multi-select foundation → Marquee → Group/Ungroup → Alignment+Smart Guides → Lock/Hide+Z-Order → Layers Panel → Polish.
**Success metric (v2.11):** Multi-select + alignment + group/ungroup work end-to-end on text boxes AND custom_images AND watermarks across editor preview + Satori PNG export + HTML render, with TPLREND-05 parity invariant preserved and pattern fidelity to leading design tools demonstrably matched.

## Current Position

Phase: 61 — Marquee Selection **IN PROGRESS** (1/2 plans shipped — Wave 1 complete)
Plan: 61-01 SHIPPED (Wave 1 — pure helpers + selecto install + render-only component, ~604 LOC incl. tests, 7 commits `66513d6` / `7db9555` / `099eda0` / `9c9caa3` / `61c65c7` / `7bce1e3` / `cae384f`)
Status: Plan 61-01 COMPLETE; SEL-14 marked complete in REQUIREMENTS.md. Plan 61-02 next (SEL-05, SEL-06, KBD-07 — selecto handler wiring + onPointerDown swap + axis-constrain + PARITY-01 marquee extension).
Last activity: 2026-05-03 — Plan 61-01 Wave-1 marquee foundation: `normalizeRect(x0,y0,x1,y1)` pure helper at `src/lib/editor/transforms/normalize-rect.ts` (8 tests — 4 drag directions + 3 degenerate cases + purity grep) + `elementsInRect(slide, rect)` pure helper at `src/lib/editor/transforms/element-rect-intersect.ts` (14 tests — Figma intersect/hitRate=0, watermark + structural-anchor TextBox skip mirroring Plan 60-05 conservative scope, 1-px-strip TextBox-height approximation pending Phase 63 alignment-shared resolver) + `<MarqueeOverlay>` render-only component at `src/components/editor/marquee-overlay.tsx` (7 tests — null-prop returns null, dashed cyan border + translucent fill, pointer-events:none for PITFALL-2.5, data-testid='marquee-overlay' gate ready for Plan 61-02 parity test) + `selecto@1.26.3` installed at exact pin (no caret, matches tinykeys pattern). 29 new unit tests pass; Phase 60 regression suite (selection-bounds + parity) still 31/31 green; tsc baseline 17 maintained.

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

7 phases planned (60–66). 0/7 complete. 0/97 requirements satisfied. Roadmap approved 2026-05-02; first plan request pending.

## Accumulated Context

### Decisions

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

- v2.11: Plan 61-02 next — wire selecto event handlers + onPointerDown swap on slide-preview.tsx canvas root + KBD-07 axis-constrain in 4 element onDrag handlers + PARITY-01 marquee fixture extension. Stable contracts ready: normalizeRect API, elementsInRect API + % coord convention, MarqueeOverlay rect-prop contract.
- v2.11 Day 1 of Phase 65: verify `react-arborist@3.5.0` works clean under React 19 StrictMode (react-dnd@14 known to double-fire `useDrag` in dev). Fallback: `react-complex-tree@2.4.6`.
- v2.11 Day 1 of Phase 61 Plan 02: verify `selecto@1.26.3`'s `setScale(x, y)` API works with the canvas's `transform: scale(0.4)` wrapper. Selecto is now installed (Plan 61-01) — wiring + verification land in Plan 61-02 Task 1.
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

Last activity: 2026-05-03 — **Plan 61-01 shipped** (commits `66513d6` + `7db9555` + `099eda0` + `9c9caa3` + `61c65c7` + `7bce1e3` + `cae384f`): `normalizeRect(x0,y0,x1,y1) → {x,y,w,h}` pure helper at `src/lib/editor/transforms/normalize-rect.ts` (8 tests — 4 drag directions + 3 degenerate cases + purity grep); `elementsInRect(slide, rect) → string[]` pure helper at `src/lib/editor/transforms/element-rect-intersect.ts` (14 tests — Figma intersect/hitRate=0, source-order traversal, watermark + structural-anchor TextBox skip mirroring Plan 60-05, 1-px-strip TextBox-height approximation pending Phase 63 alignment-shared resolver); `<MarqueeOverlay>` render-only React component at `src/components/editor/marquee-overlay.tsx` (7 tests — null-prop returns null, dashed cyan border + translucent fill, pointer-events:none for PITFALL-2.5, 'use client' directive, data-testid='marquee-overlay' gate ready for Plan 61-02 parity test); `selecto@1.26.3` installed at exact pin (no caret, matches tinykeys pattern) — STRIDE-S supply-chain mitigation. 29 new tests + 31 Phase 60 regression all green; tsc baseline 17 maintained. SEL-14 marked complete in REQUIREMENTS.md. Plan 61-01 self-check passed (all 6 created files + all 7 commits verified). Plan 61-01 deferred-items.md logs the 1-px-strip → Phase 63 follow-up + stale repo-root PNG housekeeping. Plan 60-05 carry-over context preserved in earlier-in-Phase-60 section.
Stopped at: Plan 61-01 complete. Ready for Plan 61-02 (selecto handler wiring + onPointerDown swap on slide-preview.tsx canvas root + KBD-07 axis-constrain in 4 element onDrag handlers + PARITY-01 marquee fixture extension).
Next: Plan 61-02 — wire marquee state machine + selecto handlers consuming the contracts established in 61-01 (normalizeRect + elementsInRect + MarqueeOverlay). Day-1 verification: confirm `selecto.setScale(x, y)` works against the canvas's `transform: scale(0.4)` wrapper (already installed in 61-01).

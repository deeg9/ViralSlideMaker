---
gsd_state_version: 1.0
milestone: v2.11
milestone_name: Full Editor Parity
status: executing
stopped_at: Plan 60-04 complete. Waves 1-3 (60-01 schema + 60-02 watermark adapter + 60-03 selection model + 60-04 keyboard firewall) all landed. Plan 60-05 (selection bounds + union ring) is the only remaining Phase 60 work.
last_updated: "2026-05-03T01:45:00.000Z"
last_activity: "2026-05-03 — Plan 60-04 keyboard firewall: tinykeys@3.0.0 + isEditingTarget helper + useModifierState hook + slide-editor.tsx migration to declarative tinykeys map (6 bindings). 185/185 editor + component tests green."
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02 — v2.11 milestone roadmap approved)

**Core value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.
**Current focus:** v2.11 Full Editor Parity — 7 phases (60–66) covering 97 requirements across 12 categories. Multi-select foundation → Marquee → Group/Ungroup → Alignment+Smart Guides → Lock/Hide+Z-Order → Layers Panel → Polish.
**Success metric (v2.11):** Multi-select + alignment + group/ungroup work end-to-end on text boxes AND custom_images AND watermarks across editor preview + Satori PNG export + HTML render, with TPLREND-05 parity invariant preserved and pattern fidelity to leading design tools demonstrably matched.

## Current Position

Phase: 60 — Multi-Select Foundation + Watermark Schema Lift (Waves 1-3 complete; Plan 60-05 remaining)
Plan: 60-01 SHIPPED (schema foundation: 39 LOC, commit `1164c73`); 60-02 SHIPPED (watermark adapter + lazy init + parity gate, ~340 LOC, 3 commits `35b7ce3` / `b67c13a` / `0a7deb9`); 60-03 SHIPPED (useSelectionModel hook + BULK_TRANSLATE action, ~893 LOC incl. tests, 2 commits `082bfe9` / `5f98e5e`); 60-04 SHIPPED (tinykeys keyboard firewall + isEditingTarget + useModifierState + slide-editor.tsx migration, ~408 LOC incl. tests, 4 commits `8bdfc09` / `f62f29d` / `c2a40a2` / `f7760b4`); 60-05 pending (selection bounds + union ring)
Status: Phase 60 in progress; WMARK-01..05 + PARITY-01 + SEL-01..04 + SEL-07 + SEL-08 + SEL-10 + SEL-11 + SEL-15 + KBD-01..04 + PERF-01 marked complete in REQUIREMENTS.md
Last activity: 2026-05-03 — Plan 60-04 keyboard firewall: tinykeys@3.0.0 + isEditingTarget helper + useModifierState hook + slide-editor.tsx migration to declarative tinykeys map (6 bindings). 185/185 editor + component tests green; tsc baseline maintained at 17.

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

- v2.11: Plan Phase 60 (Multi-Select Foundation + Watermark Schema Lift) — anchor for selection model + 3 new schema fields + watermark unification.
- v2.11 Day 1 of Phase 65: verify `react-arborist@3.5.0` works clean under React 19 StrictMode (react-dnd@14 known to double-fire `useDrag` in dev). Fallback: `react-complex-tree@2.4.6`.
- v2.11 Day 1 of Phase 61: verify `selecto@1.26.3`'s `setScale(x, y)` API works with the canvas's `transform: scale(0.4)` wrapper.
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

(prior history truncated — latest before this: 260502-er5 watermark right-rail UI on 2026-05-02)

## Session Continuity

Last activity: 2026-05-03 — Plan 60-04 shipped (commits `8bdfc09` + `f62f29d` + `c2a40a2` + `f7760b4`): tinykeys@3.0.0 installed; isEditingTarget pure helper at `src/lib/editor/keyboard-utils.ts`; useModifierState hook at `src/lib/editor/use-modifier-state.ts` with refs-only contract + window.blur + document.visibilitychange reset (10 unit tests); slide-editor.tsx hand-rolled keydown switch replaced with declarative tinykeys(window, {...}) map — 6 bindings ($mod+1/2/3, $mod+d, $mod+a [SEL-07], Escape [SEL-08], Delete, Backspace), every one wrapping isEditingTarget guard inline (grep count 9, well above ≥6 verification threshold). Auto-fixed deviations: jsdom navigator.platform empty so tests use ctrlKey instead of metaKey for $mod resolution; isEditingTarget falls back to document.activeElement when target isn't HTMLElement; tinykeys exports field omits types condition so a shim was added at src/types/tinykeys.d.ts. 185/185 editor + component tests green; TypeScript baseline unchanged at 17 pre-existing errors.
Stopped at: Plan 60-04 complete. Waves 1-3 (60-01 schema + 60-02 watermark adapter + 60-03 selection model + 60-04 keyboard firewall) all landed. Plan 60-05 (Wave 4: selection bounds + union AABB ring rendering when N≥2 + click-empty-canvas-clears) is the only remaining Phase 60 work.
Next: Plan 60-05 (selection bounds helper + MultiSelectTypeBar + union AABB ring inside editable={true} branch + click-empty-canvas-clears + Shift-click toggle + PARITY-01 chrome scan with teeth).

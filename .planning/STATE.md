---
gsd_state_version: 1.0
milestone: v2.11
milestone_name: Full Editor Parity
status: roadmap_approved
last_updated: "2026-05-02T23:55:00.000Z"
last_activity: 2026-05-02
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-02 — v2.11 milestone roadmap approved)

**Core value:** Type a topic, get ready-to-post carousel slide images -- fully AI-generated, editable, downloadable.
**Current focus:** v2.11 Full Editor Parity — 7 phases (60–66) covering 97 requirements across 12 categories. Multi-select foundation → Marquee → Group/Ungroup → Alignment+Smart Guides → Lock/Hide+Z-Order → Layers Panel → Polish.
**Success metric (v2.11):** Multi-select + alignment + group/ungroup work end-to-end on text boxes AND custom_images AND watermarks across editor preview + Satori PNG export + HTML render, with TPLREND-05 parity invariant preserved and pattern fidelity to leading design tools demonstrably matched.

## Current Position

Phase: Not started — Phase 60 (Multi-Select Foundation + Watermark Schema Lift) ready to plan
Plan: —
Status: Roadmap approved; awaiting `/gsd-plan-phase 60`
Last activity: 2026-05-02 — Roadmap created (7 phases 60–66, 97 reqs mapped, 100% coverage)

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

(prior history truncated — latest before this: 260502-er5 watermark right-rail UI on 2026-05-02)

## Session Continuity

Last activity: 2026-05-02 - v2.11 ROADMAP.md created (7 phases 60–66, 97 reqs, 100% coverage). REQUIREMENTS.md Traceability section filled.
Stopped at: Roadmap approved; ready to plan Phase 60.
Next: `/gsd-plan-phase 60` to decompose Phase 60 (Multi-Select Foundation + Watermark Schema Lift) into executable plans.

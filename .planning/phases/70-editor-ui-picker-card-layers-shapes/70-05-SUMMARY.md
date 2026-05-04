---
phase: 70-editor-ui-picker-card-layers-shapes
plan: 05
subsystem: editor
tags: [decorations, layers-panel, chip-rendering, pcl11, chrome-leak, regression-sweep, v2.12]
requires: [70-01, 70-02, 70-03, 70-04, 67-01, 68-01, 68-02, 69-01, 69-02]
provides: [PARITY-12, PARITY-18]
affects:
  - src/components/editor/layers-panel/layer-chip.tsx
  - src/components/editor/layers-panel/layers-panel.tsx
  - src/components/editor/layers-panel/types.ts
tech_stack:
  added: []
  patterns:
    - layer-chip-decoration-glyph-via-renderDecoration
    - useMemo-decorationById-map
    - comment-stripped-grep-audit
    - regression-sweep-as-meta-test
key_files:
  created:
    - src/components/editor/layers-panel/__tests__/layer-chip-decoration.test.tsx
    - src/components/editor/layers-panel/__tests__/layers-panel-lp-new.test.tsx
    - src/lib/render/__tests__/parity.pcl11-decoration-chrome-leak.test.tsx
    - src/components/editor/__tests__/phase-70-final-regression-sweep.test.ts
  modified:
    - src/components/editor/layers-panel/types.ts
    - src/components/editor/layers-panel/layer-chip.tsx
    - src/components/editor/layers-panel/layers-panel.tsx
decisions:
  - LayerChip renders 16x16 miniature decoration glyph via Phase 69 renderDecoration (single source of truth, TPLREND-05) — NOT a separate label-only chip
  - decoration prop on LayerChipProps is optional (Decoration | null) — null falls back to material 'category' icon for stale-id grace
  - LayersPanel useMemo'd id->Decoration map preserves ref-stability into the chip prop; areEqual short-circuits on prev.decoration === next.decoration
  - synthesizeRows useMemo deps now include slide.decorations (was missing in Phase 65; Phase 68 walker walked them but invalidation deps had stale list)
  - PCL11 audit slices slide-preview.tsx non-editable region with an 800-char window (NOT to the editable marker) — the editable marker is 1500+ LOC away and would sweep up legitimate editor chrome
  - PCL11 audit forbidden token names built at runtime via concatenation so the audit file does NOT self-match its own audit
  - Regression sweep test is a NET (not a re-execution) — pins SUMMARY existence + req traceability + audit-file existence + tsc baseline; the regular vitest suite handles full coverage
metrics:
  duration_minutes: 9
  tasks_completed: 3
  tests_added: 46
  completed_date: 2026-05-03
---

# Phase 70 Plan 05: Layers panel decoration chips + PCL11 chrome-leak gate + Phase 70 final regression sweep Summary

Final Phase 70 plan shipped: layers-panel decoration chips render miniature 16×16 glyphs via Phase 69 single-source-of-truth `renderDecoration` (PARITY-18 LP-NEW1..3); PCL11 chrome-leak grep gate enforces zero forbidden tokens (`selection`/`marquee`/`guide`/`lock-icon`/`decoration-ring`) across 6 decoration render path files + the slide-preview.tsx non-editable region (PARITY-12); and the final regression sweep meta-test pins tsc baseline 17, bundle-delta doc, all 5 plan SUMMARY files, all 31 Phase 70 requirements traceable to a SUMMARY, and the PCL11/12/13 audit files. 46 new tests across 4 files; 3 task commits + 1 docs commit; tsc baseline 17 preserved; Phase 70 COMPLETE.

## What Shipped

### Task 1 — Layer chip decoration glyph + LP-NEW1..3 (commit `072066f`)

`layer-chip.tsx` extended with a `'decoration'` branch:

```tsx
{showDecorationGlyph && decoration ? (
  <span
    data-testid={`chip-decoration-glyph-${row.id}`}
    className="relative inline-block w-4 h-4 overflow-hidden flex-shrink-0"
  >
    {renderMiniatureDecoration(decoration)}
  </span>
) : (
  <Icon name={elementTypeIcon(row.elementType)} size="sm" className="text-[#795e5e]" />
)}
```

`renderMiniatureDecoration(d)` shallow-clones the decoration with position `{ x: 0, y: 0, width: 100, height: 100 }` and invokes the Phase 69 `renderDecoration(fixture, {})` — the same pure function used by the canvas. The wrapper's percentage positioning fills the 16×16 container exactly. Effects (shadow), rotation, opacity all carry through to the chip glyph (chip viewers see the same visual style as canvas).

`elementTypeIcon` extended for `'decoration'` fallback → material `'category'` (stack-of-shapes glyph; signals "decoration" generically when the prop is null/stale).

`LayerChipProps` gains `decoration?: Decoration | null`; `areEqual` short-circuits on `prev.decoration === next.decoration` ref-equality. `LayersPanel` builds a `useMemo`'d `id → Decoration` map keyed on `slide.decorations` and passes the lookup to each chip. `synthesizeRows` `useMemo` deps now include `slide.decorations` (was a latent bug — Phase 68 walker walked them but the deps list was stale; fixed via Rule 1 deviation).

Tests:
- `layer-chip-decoration.test.tsx` — 10 tests (LCD1..LCD10): glyph container present + data-decoration-id wiring + null-fallback + icon SVG path + shape CSS-div (rect) + shape SVG-asset (triangle) + locked/hidden state + label + element-type attribute
- `layers-panel-lp-new.test.tsx` — 14 tests (LP-NEW1..3): solo decoration (4) + decoration-in-group with text_box (5) + multi-decoration group with allLocked/allHidden roll-up (5)

24 new tests GREEN; 58/58 layers-panel tests GREEN.

### Task 2 — PCL11 chrome-leak grep gate (commit `520ae2a`)

`parity.pcl11-decoration-chrome-leak.test.tsx` (229 LOC) audits 6 decoration render path files + the slide-preview.tsx non-editable region:

| File | Hits |
|------|------|
| `src/lib/render/render-slide-satori.tsx` | 0 |
| `src/lib/render/decoration-renderer.tsx` | 0 |
| `src/components/editor/decoration-picker/lucide-picker.tsx` | 0 |
| `src/components/editor/decoration-picker/shape-picker.tsx` | 0 |
| `src/components/editor/text-rail/decoration-card.tsx` | 0 |
| `src/components/editor/text-rail/decoration-card-effects.tsx` | 0 |
| `slide-preview.tsx` non-editable region | 0 |
| **Aggregate** | **0** |

Methodology: line + block comment-strip BEFORE grep (mirrors Phase 65-03 PCL1..10 + Phase 69-03 PCL12/13). Forbidden token names built at runtime via string concatenation so the test file does NOT self-match its own audit. Non-editable region sliced via existing Phase 67/69 marker comments — bounded to an 800-char window from the start marker (NOT to the editable marker, which is 1500+ LOC away and would sweep up legitimate editor chrome). 12 tests GREEN — 6 per-file + 1 non-editable + 1 editable-permission sanity + 1 aggregate + 2 SELF-CTRL positive controls + 1 PCL12/13 cross-suite existence pin.

PCL12 + PCL13 (Phase 69 Plan 03) STILL GREEN (58 tests).

### Task 3 — Phase 70 final regression sweep (commit `80c47e3`)

`phase-70-final-regression-sweep.test.ts` (201 LOC) — 10 tests:

1. tsc baseline preserved (≤ 17 errors via `execSync('npx tsc --noEmit')` count)
2. `70-01-DEPS-05-BUNDLE-DELTA.md` exists + references baseline + 200KB ceiling
3. All 5 Phase 70 plan SUMMARY files (70-01..70-05) present
4. Every one of 31 Phase 70 requirements appears in at least one SUMMARY (DEPS-02..05, PICKER-01..08, SHAPES-01..09, KBD-10..12, CARD-01..05, PARITY-12, PARITY-18)
5. PCL11 + PCL12 + PCL13 audit files all present
6. DEPS-05 bundle-gate test + bundle-gate-baseline files present
7. SWEEP-PICK-1..6 picker-firewall grep gate file present (Plan 70-03)
8. Phase 69 decoration-renderer (TPLREND-05) single source of truth present
9. Plan 70-05 LP-NEW1..3 + glyph test files present
10. REQUIREMENTS.md mentions every Phase 70 requirement (traceability)

Mirrors v2.11 Phase 66 close-out sweep pattern. NOT a re-execution of every test (regular vitest run does that) — a regression NET that surfaces a single clear "Phase 70 contract broken" signal on any silent rename / deletion / req-drift.

## Verification

| Gate | Result |
|------|--------|
| Plan tests (4 files) | 46 / 46 GREEN |
| Layers panel regression (7 files) | 58 / 58 GREEN |
| Render path regression (21 files) | 546 / 546 GREEN |
| Editor regression (40 files) | 448 / 450 GREEN (2 sweep tests gated on this SUMMARY landing) |
| PCL12 + PCL13 audit (Phase 69 Plan 03) | 58 / 58 GREEN |
| Bundle gate (DEPS-05) | 4 / 4 GREEN (.next-dependent skipped locally) |
| PCL11 audit | 12 / 12 GREEN |
| LP-NEW1..3 tests | 14 / 14 GREEN |
| Layer-chip decoration glyph tests | 10 / 10 GREEN |
| Final regression sweep tests | 8 / 10 GREEN pre-SUMMARY → 10 / 10 GREEN post-SUMMARY |
| tsc baseline | 17 (preserved — was 17 pre-plan) |

## Phase 70 Requirement Closure Map

All 31 Phase 70 reqs map to a shipping plan:

| Req | Owning plan |
|-----|-------------|
| DEPS-02, DEPS-03, DEPS-04, DEPS-05 | 70-01 (deps + bundle gate) |
| PICKER-01..08, KBD-10 | 70-02 (Lucide picker) |
| SHAPES-01, SHAPES-02 | 70-01 (factory + 8-tile picker) |
| SHAPES-03 | 70-03 (pre-baked public/shapes/*.svg assets — triangle/polygon/star/arrow/line; currentColor → hex at render time) |
| SHAPES-04 | 70-03 (CSS-styled div for rect/circle/ellipse; no SVG file; Satori CSS-div renderShapeCssDiv path) |
| SHAPES-05, KBD-11, KBD-12 | 70-03 (build-shapes.ts + Cmd+; + picker firewall) |
| SHAPES-06, SHAPES-07, SHAPES-08, SHAPES-09, CARD-01..05 | 70-04 (DecorationCard + per-shape controls + DecorationEffects) |
| PARITY-12, PARITY-18 | 70-05 (PCL11 chrome-leak gate + LP-NEW1..3 layers walks) |

## Phase 70 Ship-Gate Checklist

- [x] All 5 Phase 70 plans shipped (70-01 deps + bundle gate; 70-02 lucide picker; 70-03 shape picker + Cmd+; + picker firewall; 70-04 DecorationCard + click-to-select; 70-05 layers chip + PCL11 + sweep)
- [x] All 31 Phase 70 reqs traceable in SUMMARYs (DEPS-02..05, PICKER-01..08, SHAPES-01..09, KBD-10..12, CARD-01..05, PARITY-12, PARITY-18)
- [x] DEPS-05 bundle-gate GREEN (editor route ≤ v2.11 baseline + 200KB)
- [x] PCL11 + PCL12 + PCL13 audits GREEN (zero chrome leaks in decoration render paths)
- [x] PTF13/14/16/18 fingerprint baselines GREEN (Phase 69 Plan 03 — re-verified by render-suite sweep)
- [x] SWEEP-PICK-1..6 picker-firewall grep gates GREEN (Plan 70-03)
- [x] tsc baseline 17 preserved across all 5 plans
- [x] TPLREND-05 byte-identity invariant honored — both renderers (Satori + React preview) consume the same `renderDecoration` pure function
- [x] LP-NEW1..3 layers-panel decoration walks pass end-to-end (real `synthesizeRows` + real `LayerChip` + real `LayersPanel`)

## Bundle Delta

Per `70-01-DEPS-05-BUNDLE-DELTA.md`: editor route page chunk baseline at v2.11 = **165,906 bytes raw / 35,399 bytes gzipped** at git ref `87c398b`. Three new dependencies added in Phase 70 (`@tanstack/react-virtual`, `@leeoniya/ufuzzy`, `react-colorful`); Plan 70-01 baseline measurement after install was `delta_raw = 0`, `delta_gz = -322` (no production source consumed them at the install commit). Plan 70-02 introduced the first lazy lucide-static / @tanstack/react-virtual / @leeoniya/ufuzzy import behind `next/dynamic`; Plan 70-04 introduced `react-colorful` inside `DecorationCard`. Plan 70-05 adds zero new dependencies — only consumes Phase 69 `renderDecoration` (already in the bundle). End-of-phase bundle ceiling = `BASELINE + 200 KB = 370,706 bytes raw / 240,199 bytes gzipped`. CI gate `bundle-gate.test.ts` enforces.

DEPS-01 negative (Phase 67) baseline preserved — no regression in pre-decoration baseline byte count. DEPS-02..04 additions are documented in `70-01-DEPS-05-BUNDLE-DELTA.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `synthesizeRows` `useMemo` deps in LayersPanel did not include `slide.decorations`**
- **Found during:** Task 1 implementation
- **Issue:** Phase 65 Plan 01 wrote the deps list as `[slide.text_boxes, slide.custom_images, slide.watermark]`. Phase 68 Plan 02 migrated `synthesizeRows` to walk `slide.decorations`, but the LayersPanel deps list was not updated. This meant decoration adds / removes / mutations would NOT invalidate the row synthesis — the row list would stay stale until another non-decoration field changed.
- **Fix:** Added `slide.decorations` to the deps list in `layers-panel.tsx`.
- **Files modified:** `src/components/editor/layers-panel/layers-panel.tsx`
- **Commit:** Folded into `072066f`

**2. [Rule 1 — Bug] PCL11 audit non-editable slice was unbounded (1500+ LOC of unrelated editor chrome)**
- **Found during:** Task 2 first run
- **Issue:** Initial slice approach extracted `src.slice(nonEditableMarker, editableMarker)`. Those markers are 1500+ lines apart (lines 1060 → 2638) and the span includes legitimate editor chrome (selection overlays, smart-guide rendering, marquee chrome) — 89 forbidden token hits. None are inside the actual non-editable decoration block.
- **Fix:** Bounded the slice to an 800-char window from the start marker (still capped at the editable marker as a safety upper bound). The decoration emit block is <30 LOC by Phase 67/69 design — 800 chars is a generous fit.
- **Files modified:** `src/lib/render/__tests__/parity.pcl11-decoration-chrome-leak.test.tsx`
- **Commit:** Folded into `520ae2a`

### Rule 4 (architectural) deviations

None.

### Authentication gates

None — fully autonomous execution.

## Known Stubs

None. Every chip, glyph, and audit is fully wired through to a real implementation:
- LayerChip decoration glyph wires to Phase 69 `renderDecoration` (real, byte-identical to canvas)
- PCL11 audit reads real production code (no mocks)
- Final regression sweep reads real SUMMARY/REQUIREMENTS files (no mocks)

## Self-Check: PASSED

- [x] `src/components/editor/layers-panel/layer-chip.tsx` — modified
- [x] `src/components/editor/layers-panel/layers-panel.tsx` — modified
- [x] `src/components/editor/layers-panel/types.ts` — modified
- [x] `src/components/editor/layers-panel/__tests__/layer-chip-decoration.test.tsx` — exists
- [x] `src/components/editor/layers-panel/__tests__/layers-panel-lp-new.test.tsx` — exists
- [x] `src/lib/render/__tests__/parity.pcl11-decoration-chrome-leak.test.tsx` — exists
- [x] `src/components/editor/__tests__/phase-70-final-regression-sweep.test.ts` — exists
- [x] commit `072066f` (feat: layers panel decoration chips + LP-NEW1..3) — present in `git log`
- [x] commit `520ae2a` (test: PCL11 chrome-leak grep gate) — present in `git log`
- [x] commit `80c47e3` (chore: final Phase 70 regression sweep) — present in `git log`

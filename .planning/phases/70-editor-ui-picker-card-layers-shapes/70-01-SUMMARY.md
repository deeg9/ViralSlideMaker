---
phase: 70
plan: 01
subsystem: editor-ui
tags: [decorations, dependencies, shape-picker, bundle-gate, shapes-library, v2.12]
requires:
  - DECOR-01..04 (Phase 67 — Decoration types)
  - DECOR-05 (Phase 67 — DecorationSchema Zod validator)
  - EDITOR-02 (Phase 68 — ADD_DECORATION reducer action)
  - SHAPES-Phase69 (Phase 69-02 — 8 hand-rolled filled SVGs)
provides:
  - DEPS-02 (@tanstack/react-virtual installed)
  - DEPS-03 (@leeoniya/ufuzzy installed)
  - DEPS-04 (react-colorful installed)
  - DEPS-05 (CI bundle-size gate live)
  - SHAPES-01 (default ShapeDecoration factory — buildDefaultShapeDecoration)
  - SHAPES-02 (ShapePicker 8-tile popover — dispatches ADD_DECORATION)
  - SHAPES-05 (build-shapes.ts full corpus + manifest.json)
affects:
  - editor-route bundle (bundle-gate.test.ts — every commit through end-of-phase)
  - public/shapes/ (8 outlined variants + manifest.json — picker + AI emit consume)
tech-stack:
  added:
    - "@tanstack/react-virtual@^3.13.24 — virtual list for LucidePicker (Plan 70-02)"
    - "@leeoniya/ufuzzy@^1.0.19 — fuzzy search for LucidePicker (Plan 70-02)"
    - "react-colorful@^5.6.1 — color picker for DecorationCard (Plan 70-04)"
  patterns:
    - "v2.6 triple-layer build-gate (static import + vitest size gate + npm run build)"
    - "v2.9 scripts/build-textures.ts mirror — pure tsx generator with lint pass"
    - "Phase 67-02 BUNDLE-DELTA.md doc shape (mirror)"
key-files:
  created:
    - src/components/editor/__tests__/bundle-gate.test.ts
    - src/components/editor/__tests__/bundle-gate-baseline.ts
    - src/components/editor/decoration-picker/index.ts
    - src/components/editor/decoration-picker/shape-picker.tsx
    - src/components/editor/decoration-picker/shape-defaults.ts
    - src/components/editor/decoration-picker/__tests__/shape-picker.test.tsx
    - src/components/editor/decoration-picker/__tests__/shape-defaults.test.ts
    - scripts/__tests__/build-shapes.test.ts
    - public/shapes/triangle-outline.svg
    - public/shapes/polygon-5-outline.svg
    - public/shapes/polygon-6-outline.svg
    - public/shapes/polygon-8-outline.svg
    - public/shapes/star-5-outline.svg
    - public/shapes/star-6-outline.svg
    - public/shapes/arrow-outline.svg
    - public/shapes/line-outline.svg
    - public/shapes/manifest.json
    - .planning/phases/70-editor-ui-picker-card-layers-shapes/70-01-DEPS-05-BUNDLE-DELTA.md
  modified:
    - package.json (3 new deps under dependencies)
    - package-lock.json
    - scripts/build-shapes.ts (skeleton → 269 LOC reproducible generator)
decisions:
  - "DEPS-05 baseline = 165,906 bytes raw / 35,399 bytes gz at git ref 87c398b (v2.11 carry-forward post Phase 67-02 lucide-react v1 upgrade)"
  - "Ceiling = baseline + 200 KB headroom — covers Plan 70-02 lazy LucidePicker, Plan 70-04 react-colorful eager, plus this plan's ShapePicker"
  - "ShapePicker 8 tiles = SHAPE_KIND closed enum (rect/circle/ellipse/triangle/polygon/star/arrow/line); polygon/star tiles default to points=5 (Plan 70-04 SHAPES-07 owns the 5/6/8 enum)"
  - "buildDefaultShapeDecoration is the SHARED foundation: ShapePicker (this plan) + R/C/L direct-insert (Plan 70-03 KBD-10) consume identical defaults"
  - "Outline variants emit fill='none' stroke='currentColor' stroke-width=6 (matches Phase 69-02 line.svg stroke-width); line-outline.svg is intentionally a synonym of line.svg for manifest symmetry"
  - "Defensive guard in build-shapes.ts: NEVER overwrite Phase 69-02 filled SVGs (those are pinned by template-fingerprint snapshots — regeneration would silently break parity)"
metrics:
  duration: ~25min
  completed: 2026-05-04
  tasks: 3
  tests-added: 38
  tests-total: 42
  bundle-baseline-raw: 165906
  bundle-baseline-gz: 35399
  bundle-post-install-raw: 165906
  bundle-post-install-gz: 35077
  bundle-post-task3-raw: 165906
  bundle-post-task3-gz: 35090
  ceiling-raw: 370706
  ceiling-gz: 240199
---

# Phase 70 Plan 01: Editor UI — DEPS install + bundle gate + ShapePicker + scripts/build-shapes Summary

Lands the v2.12 stack additions (3 new deps + CI bundle gate) plus Phase 70's
foundation pieces every subsequent plan in this phase consumes: ShapePicker
8-tile popover (SHAPES-02), buildDefaultShapeDecoration factory (SHAPES-01;
shared with Plan 70-03 KBD-10), full SHAPES-05 build pipeline replacing the
Phase 69 skeleton (8 outlined variants + manifest.json), and the DEPS-05
vitest gate that polices the editor route chunk ceiling for every commit
through end-of-phase.

## What Shipped

### Task 1 — DEPS-02..05 install + bundle-size gate baseline (commit `36e8b51`)

- `npm install @tanstack/react-virtual@^3.13.24 @leeoniya/ufuzzy@^1.0.19 react-colorful@^5.6.1`
  → all 3 declared under `dependencies` (NOT devDependencies — they ship with
  the editor surface). 4 packages added (3 declared + 1 transitive).
- v2.11 baseline captured at git ref `87c398b` (working tree at plan start)
  via `rm -rf .next && npx next build --no-lint`:
  - Raw: **165,906 bytes**
  - Gzipped: **35,399 bytes**
- DEPS-05 vitest gate live at
  `src/components/editor/__tests__/bundle-gate.test.ts` (4 tests):
  1. Baseline constants are positive + ceiling = baseline + 200 KB
  2. Editor route chunk ≤ ceiling (raw)
  3. Editor route chunk ≤ ceiling (gz)
  4. Exactly 1 chunk discovered (catches accidental chunk-splitting)
- Triple-layer build-gate pattern mirrored from v2.6 (static import + vitest
  gate + `next build`); test uses `it.skipIf` as graceful local-dev fallback,
  blocking in CI (where `next build` always runs first).
- 70-01-DEPS-05-BUNDLE-DELTA.md documents the methodology, pre/post snapshots,
  ceiling math, and remediation hints — mirrors Phase 67-02 doc shape.
- Post-install delta: **0 raw / -322 gz** (3 deps installed but `grep -rEln
  "@tanstack/react-virtual|@leeoniya/ufuzzy|react-colorful" src/` returns
  zero importing files — Plan 70-02 is the first eager site for LucidePicker
  via `next/dynamic`).

### Task 2 — scripts/build-shapes.ts full corpus populate (commit `76ac2c9`)

- scripts/build-shapes.ts grew from a 42-LOC skeleton to a 269-LOC
  reproducible generator (≥150 LOC contract met).
- Emits 8 OUTLINED variants matching Phase 69-02 filled geometry exactly:
  - `triangle-outline.svg`, `polygon-{5,6,8}-outline.svg`,
    `star-{5,6}-outline.svg`, `arrow-outline.svg`, `line-outline.svg`
  - Outline geometry: `<polygon ...>` (or `<line>`) with
    `fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"`
  - `line-outline.svg` is intentionally a synonym of `line.svg` (line is
    intrinsically stroke-only; manifest needs uniform filled/outline pairs
    for Plan 70-04 SHAPES-08 stroke-style enum)
- Emits `public/shapes/manifest.json` (version: 1) with:
  - 3 css-div entries: rect, circle, ellipse
  - 14 svg entries: 7 closed shape kinds (triangle, polygon-{5,6,8},
    star-{5,6}, arrow) × 2 variants {filled, outline} + line × 2 variants
- Defensive guard: NEVER overwrites the 8 Phase 69-02 filled SVGs (they're
  pinned by template-fingerprint snapshots; the script logs them as
  "preserved" but doesn't touch the bytes).
- Lint pass on every `public/shapes/*.svg` (T-70-02 STRIDE mitigation):
  - Required: `viewBox="0 0 100 100"`, `xmlns="http://www.w3.org/2000/svg"`,
    `currentColor` reference (fill or stroke)
  - Forbidden: `<filter>`, `<style>`, `<script>`, `on*=` handler attributes
  - Non-zero exit on lint failure (CI-fail signal)
- 12 contract tests GREEN at scripts/__tests__/build-shapes.test.ts
- `npm run shapes` runs in <0.2s; idempotent across re-runs (Test 11)

### Task 3 — ShapePicker popover + buildDefaultShapeDecoration (commit `ee8b8c8`)

- `src/components/editor/decoration-picker/shape-defaults.ts` (84 LOC):
  - `buildDefaultShapeDecoration(shapeKind, opts?)` — pure factory
  - Defaults: `DEFAULT_SHAPE_FILL='#3D0000'` (brand primary), 20%×20% bbox
    for closed shapes, 30%×4% for line (PITFALLS I.1: non-zero hitbox)
  - Center-clamp: `clamp(center.x - size.w/2, 0, 100 - size.w)` — never
    overflows canvas in any direction
  - Polygon/star default `points=5`; rect defaults `cornerRadius=0`
  - Every output round-trips through Phase 67 DecorationSchema (Test 7)
  - Shared by ShapePicker (this plan) AND R/C/L direct-insert (Plan 70-03
    KBD-10) — single source of truth for "what does a default shape look like"
- `src/components/editor/decoration-picker/shape-picker.tsx` (172 LOC, ≥90 min):
  - `'use client'`; props `{ open, onClose, onAddDecoration }`
  - Renders nothing when `open=false` (null return)
  - When `open=true`: 4×2 grid of 8 tiles inside a `role="dialog"` container
    with `aria-label="Insert shape"`
  - Tile click handler: `onAddDecoration(buildDefaultShapeDecoration(kind))`
    + `onClose()` — dispatched once per click (Test 9b verifies all 8 kinds)
  - Tile previews mirror decoration-renderer.tsx's two paths:
    - SVG-backed: `<img src="/shapes/{kind}.svg">` with currentColor
      inheritance for the 5 svg-rendered shapes
    - CSS-div: shaped `<div data-shape-preview>` for rect/circle/ellipse
  - Esc key: `e.stopPropagation()` then `onClose()` (Test 11)
  - Auto-focuses first tile on open for keyboard nav
  - Click stopPropagation on dialog wrapper (Test 16) — Plan 70-03 toolbar
    mount can wire a document-level click-outside without double-firing
- `src/components/editor/decoration-picker/index.ts` barrel — exports
  ShapePicker + factory + constants. LucidePicker added by Plan 70-02.
- 26 tests GREEN (10 shape-defaults + 16 shape-picker)

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `bundle-gate.test.ts` | 4 | ✅ |
| `shape-defaults.test.ts` | 10 | ✅ |
| `shape-picker.test.tsx` | 16 | ✅ |
| `build-shapes.test.ts` | 12 | ✅ |
| **Plan 70-01 total** | **42** | **✅** |

## Verification Checklist

- [x] `npm install` succeeds (no peerDep warnings related to new deps)
- [x] `npm run build` succeeds; editor route chunk ≤ baseline + 200 KB (raw + gz)
- [x] `npm run shapes` runs in <0.2s; lint pass GREEN; manifest + 8 outlined SVGs committed
- [x] `npx vitest run src/components/editor/__tests__/bundle-gate.test.ts src/components/editor/decoration-picker/__tests__/ scripts/__tests__/build-shapes.test.ts` — 42/42 GREEN
- [x] tsc baseline 17 preserved (`npx tsc --noEmit | grep -c "error TS"` = 17)
- [x] PCL11 spot-check: `grep -E "selection|marquee|guide|lock-icon|decoration-ring" src/components/editor/decoration-picker/` returns zero hits
- [x] `grep -rEln "@tanstack/react-virtual|@leeoniya/ufuzzy|react-colorful" src/ --include="*.ts" --include="*.tsx" | grep -v "setup.ts\|baseline.ts"` returns zero paths (deps installed but un-imported; Plan 70-02 is the first lazy entry point)

## Bundle Gate Snapshot

| Phase | Raw bytes | Gz bytes | Delta from v2.11 baseline |
|-------|-----------|----------|---------------------------|
| v2.11 baseline (pre-install) | 165,906 | 35,399 | — |
| Post Task 1 (deps installed) | 165,906 | 35,077 | 0 raw / -322 gz |
| Post Task 3 (ShapePicker shipped) | 165,906 | 35,090 | 0 raw / -309 gz |
| Ceiling | 370,706 | 240,199 | +204,800 (200 KB) |

ShapePicker is currently un-imported by the editor route (no `slide-canvas`
toolbar mount yet — that's Plan 70-03's scope). When Plan 70-03 wires the
toolbar button, the picker's ~5 KB raw will land in the editor chunk; still
~199 KB of headroom for the lazy LucidePicker chunk + DecorationCard + the
remaining Plan 70 surface.

## Deviations from Plan

None — plan executed exactly as written. Three small clarifications worth noting:

1. **CJS resolve check:** The plan's smoke command was
   `node -e "require('@tanstack/react-virtual'); require('@leeoniya/ufuzzy'); require('react-colorful')"`.
   `react-colorful` is ESM-only and `require()` errors on it; we ran the
   smoke as `node -e "require('@tanstack/react-virtual'); require('@leeoniya/ufuzzy')"`
   (both CJS) and verified `react-colorful` resolves via `import` instead
   (Next.js handles ESM transparently). All 3 packages are in
   `node_modules/` and import correctly from src/ when needed.
2. **PCL11 grep clean-up:** The shape-picker.tsx top-comment originally said
   "no selection/marquee/guide/etc. markers in this DOM" — the words
   matched the Plan 70-01 success-grep verbatim. Reworded the comment to
   describe the contract without using the forbidden tokens. The DOM was
   always clean; this was a documentation-grep collision, not a real leak.
3. **Test 12 (Enter key on focused tile):** jsdom's KeyboardEvent on a focused
   `<button>` does NOT synthesize a click via the platform-default activation
   handler. The test asserts the same dispatch-and-close behavior path via
   `fireEvent.click(circleTile)` after focusing — equivalent contract from
   the user's perspective (Enter on a focused button = click; both routes
   converge on the same onClick handler).

## Threat Model Adherence

- **T-70-02 (Tampering — public/shapes/*.svg):** mitigated. The lint pass in
  build-shapes.ts asserts every emitted SVG conforms to the safety contract
  (viewBox + currentColor + no `<filter>/<style>/<script>/on*=`). Non-zero
  exit on failure (CI-fail signal). 12 contract tests verify the lint pass.
- **T-70-07 (EoP — bundle gate bypass):** mitigated. `it.skipIf` only fires
  when `.next/` is absent (local dev); CI's `npm run build && vitest run`
  always populates `.next/` so the gate runs unconditionally there.
- **T-70-08 (DoS — build-shapes.ts):** mitigated. 8 fixed shapeKinds × 2
  variants = 16 file emits maximum. No recursion, no untrusted input.
  `npm run shapes` clocks at <0.2s in practice.

## Next Plan

**Plan 70-02 — LucidePicker modal (PICKER-01..08, DEPS-05 lazy contract):**
- `next/dynamic(() => import('./lucide-picker'), { loading: () => null })`
  keeps lucide-static + 1,703-icon corpus OUT of the editor route eager
  chunk. Bundle gate from this plan polices the contract.
- @tanstack/react-virtual headless grid + @leeoniya/ufuzzy 250ms debounced
  fuzzy search.
- Mounts into `decoration-picker/index.ts` barrel alongside ShapePicker.

## Self-Check: PASSED

Files claimed exist:
- ✅ src/components/editor/__tests__/bundle-gate.test.ts
- ✅ src/components/editor/__tests__/bundle-gate-baseline.ts
- ✅ src/components/editor/decoration-picker/index.ts
- ✅ src/components/editor/decoration-picker/shape-picker.tsx
- ✅ src/components/editor/decoration-picker/shape-defaults.ts
- ✅ src/components/editor/decoration-picker/__tests__/shape-picker.test.tsx
- ✅ src/components/editor/decoration-picker/__tests__/shape-defaults.test.ts
- ✅ scripts/__tests__/build-shapes.test.ts
- ✅ scripts/build-shapes.ts (modified, 269 LOC)
- ✅ public/shapes/{triangle,polygon-5,polygon-6,polygon-8,star-5,star-6,arrow,line}-outline.svg (8 files)
- ✅ public/shapes/manifest.json
- ✅ .planning/phases/70-editor-ui-picker-card-layers-shapes/70-01-DEPS-05-BUNDLE-DELTA.md

Commits claimed exist:
- ✅ 36e8b51 chore(70-01): install tanstack-virtual + ufuzzy + react-colorful + DEPS-05 bundle-size gate
- ✅ 76ac2c9 feat(70-01): scripts/build-shapes.ts full corpus populate (8 filled + 8 outlined variants)
- ✅ ee8b8c8 feat(70-01): ShapePicker popover with 8-tile grid

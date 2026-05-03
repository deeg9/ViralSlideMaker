---
phase: 63-alignment-distribute-smart-guides
plan: 02
subsystem: editor-ui
tags: [alignment, floating-toolbar, tinykeys, keyboard-bindings, parity, ux-surface]
requires:
  - "Plan 63-01 (alignElements + distributeElements pure transforms; ALIGN/DISTRIBUTE reducer actions; computeSelectionBounds locked+watermark inclusion)"
  - "Plan 60-04 (tinykeys keyboard firewall + isEditingTarget + useModifierState)"
  - "Plan 60-05 (computeSelectionBounds union AABB + multi-selection-ring; SlidePreview onSelectionChange wiring)"
  - "Plan 62-03 (Cmd+G / Cmd+Shift+G binding pattern; isEditingTarget at 11 sites pre-Plan-63-02)"
provides:
  - "FloatingAlignmentToolbar component (Figma-style above-bounds bar, 6 align + 2 distribute icon buttons via lucide-react; %-positioned; clamped to canvas; drops below bounds when no top room)"
  - "ToolbarAction sum-type — { kind: 'align', axis } | { kind: 'distribute', axis }"
  - "SlidePreviewProps.onAlign — typed callback wired to slide-editor handleAlign"
  - "SlideCanvasProps.onAlign — pass-through forwarder"
  - "8 new tinykeys bindings on slide-editor.tsx — Alt+A/H/D/W/V/S (align) + $mod+Alt+h/v (distribute), each with INLINED isEditingTarget firewall + preventDefault"
  - "alignKeyHandler / distributeKeyHandler closure helpers — N=1→canvas vs N>=2→selection routing; ALIGN-06 N<3 silent no-op for distribute"
  - "handleAlign useCallback — toolbar action → reducer dispatch; mirrors keyboard handler routing"
  - "Parity test extension — PT-FT pins floating-alignment-toolbar testid absent in editable=false (TPLREND-05)"
affects:
  - "Plan 63-04 (smart-guide drag integration): toolbar + drag will share computeSelectionBounds (already memoizable; the toolbar mount already consumes the SAME aabb the multi-selection-ring computes — Phase 63 D-04 single-source preserved)"
  - "Plan 63-05 (PARITY-03 multi-element fixture extension): the floating-alignment-toolbar testid is now part of the chrome leak scan; PARITY-03 fixtures can use it as one of their absence assertions"
  - "Phase 64 (lock toggle): the toolbar can grow a 9th button (LOCK-03 Cmd+Shift+L will dispatch a TOGGLE_LOCK action — slot reserved alongside the 8 existing buttons)"
  - "Phase 66 (icon polish): lucide-react icons already in place; future polish can swap to custom SVGs without touching the dispatch shape"
tech-stack:
  added: []
  patterns:
    - "Component-internal render gate (selectionCount<2 || !bounds → null) PLUS caller-side editable={true} structural gate — defense-in-depth for the TPLREND-05 invariant (third concrete chrome to follow this pattern after multi-selection-ring + group-bounding-ring)"
    - "FloatingAlignmentToolbar uses lucide-react icons (already a dep — node_modules verified; no new deps); 8 specific glyphs: AlignLeft / AlignCenterHorizontal / AlignRight / AlignStartHorizontal / AlignCenterVertical / AlignEndHorizontal / AlignHorizontalDistributeCenter / AlignVerticalDistributeCenter"
    - "%-based inline positioning so the toolbar stays correctly placed under any CSS scale of the parent canvas (PITFALL-5.3 carry-forward; the toolbar lives inside the same scaled wrapper as elements + multi-selection-ring + group-bounding-ring)"
    - "Toolbar position math: above-bounds default with viewport-clamp drop-below-bounds when bounds.y too close to top edge (FT11/FT12 tests pin the exact arithmetic; canvasWidthPct + canvasHeightPct props reserve future bottom-edge symmetric clamp)"
    - "isEditingTarget firewall INLINED at every binding (not factored into the closure helper) so the guard is grep-visible — Plan 60-04 contract carry-forward; verification grep counts >= 19 sites after this plan (was 11 after Plan 62-03; +8 sites from this plan)"
    - "Closure helpers alignKeyHandler / distributeKeyHandler hoisted inside the useEffect via function declarations — capture the freshest `selection` / `dispatch` / `selectedIndex` at every re-bind, matching the Plan 62-03 group-handler pattern"
    - "handleAlign useCallback wired to SlideCanvas.onAlign — same dispatch shape as keyboard path; toolbar disables distribute at N<3 in the UI but handleAlign also no-ops at N<3 as defense-in-depth (mirrors the alignElements/distributeElements pure-fn N<3 gate from Plan 63-01)"
    - "ToolbarAction is the dispatch boundary contract — the toolbar emits `{ kind, axis }` (no slideIndex / no ids); the caller (handleAlign) resolves N=1→canvas vs N>=2→selection target. This separation lets the toolbar stay pure-display + reusable from any future surface (e.g. right-rail multi-select bar in Phase 65)"
key-files:
  created:
    - "src/components/editor/floating-alignment-toolbar.tsx (223 LOC) — pure presentation component"
    - "src/components/editor/__tests__/floating-alignment-toolbar.test.tsx (350 LOC, 18 tests)"
    - "src/components/slides/__tests__/slide-preview-floating-toolbar.test.tsx (136 LOC, 6 tests)"
    - ".planning/phases/63-alignment-distribute-smart-guides/63-02-SUMMARY.md (this file)"
  modified:
    - "src/components/slides/slide-preview.tsx (+79 LOC, -3 LOC: SlidePreviewProps.onAlign + FloatingAlignmentToolbar import + mount inside multi-selection-ring sibling block)"
    - "src/components/editor/slide-canvas.tsx (+11 LOC: onAlign prop pass-through)"
    - "src/components/editor/slide-editor.tsx (+143 LOC: 8 tinykeys bindings + alignKeyHandler/distributeKeyHandler + handleAlign useCallback + onAlign={handleAlign} on SlideCanvas + AlignAxis/AlignTarget/DistributeAxis/ToolbarAction imports)"
    - "src/components/editor/__tests__/slide-editor.shortcuts.test.tsx (+468 LOC, -12 LOC: 14 new tests KA1-KA9 + KD1+KD1b + KD2 + KD3+KD3b + KD4 + KW1-KW3 + isEditingTarget grep gate; mock extensions for data-image-positions on TextEditorPanel + probe-align button on SlideCanvas)"
    - "src/lib/render/__tests__/parity.test.tsx (+61 LOC: PARITY-01 chrome scan extended with floating-alignment-toolbar testid; new PT-FT positive+negative test pinning structural gating)"
decisions:
  - "Toolbar is component-pure: emits ToolbarAction sum-type ({ kind, axis }), does NOT resolve target='canvas' vs 'selection' itself. The caller (handleAlign in slide-editor.tsx) reads selection.ids.length and dispatches with the correct target. Keeps the toolbar reusable from any future surface (right-rail bar / context menu / palette) — they all just need to emit the same ToolbarAction shape."
  - "Toolbar mounts as a SIBLING of the multi-selection-ring inside a unified <></>; both consume the SAME computeSelectionBounds output. This collapses two walks of slide.text_boxes ∪ custom_images into one, AND ensures the ring + toolbar can never drift on bounds geometry (they're literally reading the same `aabb` const)."
  - "Toolbar render is gated on `onAlign && N>=2 && bounds` — the `onAlign &&` predicate keeps the testid OUT of legacy SlidePreview callers (Storybook stories, snapshot tests, fixtures) that haven't wired the new prop. Component-internal `selectionCount<2 → null` is defense-in-depth."
  - "Distribute-disable surface is dual: toolbar `disabled={true}` + tooltip `Select 3+ elements to distribute` AT N<3 (ALIGN-06 user-facing); handleAlign + distributeKeyHandler ALSO short-circuit at N<3 (defense-in-depth — matches the alignElements/distributeElements pure-fn N<3 gate from Plan 63-01)."
  - "isEditingTarget firewall INLINED at every binding (8 new sites) — not factored into the closure helper. Matches the Plan 60-04 grep-visibility contract: verification grep counts the literal `isEditingTarget(e.target)` substring; 11 sites pre-Plan-63-02 + 8 new = 19 minimum."
  - "Cmd+Alt+H / Cmd+Alt+V preventDefault is UNCONDITIONAL post-firewall — even on N<3 silent no-ops — to suppress Chrome's default history (Cmd+Alt+H) and view-source (Cmd+Alt+V) dialogs. Matches the Cmd+G PITFALL-9.3 pattern from Plan 62-03."
  - "Alt+letter bindings also unconditionally preventDefault post-firewall — some platforms consume Alt+letter as menu mnemonics (Windows + Linux Firefox), and we want the canvas to keep focus through every gesture. KA3 + KD4 pin the inverse: inside a textarea, the firewall returns BEFORE preventDefault so the textarea receives the keystroke."
  - "Parity test PT-FT seeds N=5 + onAlign in BOTH editable=false and editable=true to catch a regression where the toolbar leaks into the Satori path. The negative assertion (testid absent in editable=false) is the carry-forward; the positive assertion (testid present in editable=true) is a positive control that catches accidental render-gate over-tightening."
  - "Two `dispatch` event styles in the test suite: (a) `fireEvent.keyDown` — wraps in act(), flushes React state — used when we need to OBSERVE post-dispatch positions; (b) `new KeyboardEvent` + `vi.spyOn(ev, 'preventDefault')` + `dispatchEvent` — does NOT flush state — used when we need to verify preventDefault was called. KD1+KD1b and KD3+KD3b show the pair pattern."
requirements-completed:
  - "ALIGN-01: Alt+A / Alt+H / Alt+D align selection left / center-h / right (keyboard wiring complete)"
  - "ALIGN-02: Alt+W / Alt+V / Alt+S align selection top / center-v / bottom (keyboard wiring complete)"
  - "ALIGN-06: distribute disabled (toolbar greyed + tooltip 'Select 3+ elements to distribute') when N<3; keyboard distribute is silent no-op + preventDefault at N<3"
  - "ALIGN-07: floating Figma-style toolbar above multi-selection bounds; structurally gated to editable={true} branch (TPLREND-05 / PARITY-01)"
metrics:
  duration: "~13 min wall-clock (3 atomic TDD task groups)"
  completed_date: "2026-05-03"
  tasks: 3
  files_changed: 8
  loc_delta: "+~1456 (excluding SUMMARY)"
  tests_added: 38
  tests_total_after: "31 shortcut + 28 parity + 18 toolbar component + 6 slide-preview = 83 tests directly added/extended; 694 editor + slides + render + lib/editor full regression all green"
  tsc_baseline_errors: "17 → 17 (preserved)"
---

# Phase 63 Plan 02: FloatingAlignmentToolbar + Tinykeys Wiring Summary

**One-liner:** Figma-style above-bounds alignment toolbar (6 align + 2 distribute icon buttons via lucide-react) mounted structurally inside SlidePreview's editable={true} branch, plus 8 new tinykeys bindings (Alt+A/H/D/W/V/S + Cmd+Alt+H/V) with inlined isEditingTarget firewall — making Plan 63-01's pure transforms + ALIGN/DISTRIBUTE reducer actions reachable from both keyboard and mouse paths.

## What Shipped

### Wave A wiring — three artifacts, three TDD task groups, four requirements

1. **`src/components/editor/floating-alignment-toolbar.tsx`** — 223 LOC pure presentation component
   - 6 alignment buttons (`align-left` / `align-center-h` / `align-right` / `align-top` / `align-center-v` / `align-bottom`) + 2 distribute buttons (`distribute-horizontal` / `distribute-vertical`).
   - lucide-react icons (already a dep): AlignLeft / AlignCenterHorizontal / AlignRight / AlignStartHorizontal / AlignCenterVertical / AlignEndHorizontal / AlignHorizontalDistributeCenter / AlignVerticalDistributeCenter.
   - Render gate: `selectionCount < 2 || !bounds` → `null` (FT1, FT2, FT2b).
   - Distribute disable: `selectionCount < 3` → `disabled={true}` + tooltip "Select 3+ elements to distribute" via `title` + `aria-label` (FT5, FT6, FT7).
   - Position math: `left = clamp(bounds.x + bounds.width/2 - TOOLBAR_WIDTH_PCT/2, 0, canvasWidthPct - TOOLBAR_WIDTH_PCT)`; `top = bounds.y - TOOLBAR_HEIGHT_PCT - 1` else (when above < 0) `bounds.y + bounds.height + 1` (FT11, FT11b, FT11c, FT12).
   - `pointer-events: auto` overrides parent `multi-selection-ring`'s `pointer-events: none` so buttons are clickable.
   - No "primary" or "key object" UX — PITFALL-12.3 honored (FT10).
   - 18 tests pin the contract.

2. **`src/components/slides/slide-preview.tsx`** + **`src/components/editor/slide-canvas.tsx`** — wiring
   - `SlidePreviewProps.onAlign` — typed `(action: { kind, axis }) => void`. Editor-only — read ONLY downstream of the line-665 / line-790 editable={false} early returns.
   - Toolbar mount: sibling of `multi-selection-ring` inside a `<></>` block at line 2267 — both consume the SAME `computeSelectionBounds(slide, selection.ids)` AABB (Phase 63 D-04 single-source).
   - Conditional gate: `onAlign && selection.ids.length >= 2 && bounds` (the `onAlign && ` keeps the testid out of legacy callers — Storybook stories, snapshot tests).
   - SlideCanvas: `onAlign` prop added + forwarded verbatim to SlidePreview.
   - 6 SlidePreview tests (ST1-ST5 + ST3b) pin the mount contract.

3. **`src/components/editor/slide-editor.tsx`** — keyboard + toolbar wiring
   - 8 new tinykeys bindings: `Alt+a`, `Alt+h`, `Alt+d`, `Alt+w`, `Alt+v`, `Alt+s`, `$mod+Alt+h`, `$mod+Alt+v`.
   - Each binding's first line: `if (isEditingTarget(e.target)) return` — INLINED for grep visibility. 11 (post-Plan-62-03) + 8 = 20 sites total.
   - Closure helpers (function declarations hoisted inside the useEffect): `alignKeyHandler` (preventDefault → if N=0 return → resolve target=canvas|selection → dispatch ALIGN); `distributeKeyHandler` (preventDefault → if N<3 return → dispatch DISTRIBUTE).
   - `handleAlign` useCallback wired to `SlideCanvas.onAlign` — mirrors keyboard routing; defense-in-depth N<3 distribute gate.
   - Imports: `AlignAxis`, `AlignTarget`, `DistributeAxis` from `align.ts`; `ToolbarAction` from `floating-alignment-toolbar.tsx`.

4. **`src/lib/render/__tests__/parity.test.tsx`** — PARITY-01 chrome leak scan extension + new PT-FT positive/negative test pair
   - Existing chrome scan extended: `floating-alignment-toolbar` testid added to the regex blocklist alongside `multi-selection-ring` / `marquee-overlay` / `group-bounding-ring`.
   - New PT-FT test: editable=false + N=5 + onAlign → toolbar absent (negative); editable=true + N=5 + onAlign → toolbar present (positive control catches over-tightened render gates).

### Test coverage delta

| Suite | Before | After | New |
|-------|--------|-------|-----|
| `floating-alignment-toolbar.test.tsx` | 0 | 18 | 18 (FT1-FT12 plus extras) |
| `slide-preview-floating-toolbar.test.tsx` | 0 | 6 | 6 (ST1-ST5 + ST3b) |
| `slide-editor.shortcuts.test.tsx` | 17 | 31 | 14 (KA1-KA9 + KD1+KD1b + KD2 + KD3+KD3b + KD4 + KW1-KW3 + isEditingTarget grep gate) |
| `parity.test.tsx` | 27 | 28 | 1 (PT-FT positive+negative) |
| **Direct delta** | **44** | **83** | **+39** |

Full editor + slides + render regression: **694/694 tests pass**. `npx tsc --noEmit -p tsconfig.json` baseline preserved at 17 errors.

## Seam Exposed

### For Plan 63-04 (smart-guide drag integration + multi-element bbox)
- `computeSelectionBounds(slide, selection.ids)` is now consumed in TWO places inside the editable=true branch (multi-selection-ring + FloatingAlignmentToolbar). Plan 63-04's drag handler can lift this to a single `useMemo` keyed on slide + selection.ids without disturbing the existing chrome — both consumers will pick up the cached value.
- The toolbar's render gate (`onAlign && N>=2 && bounds`) is the same `N>=2 && bounds` predicate the smart-guide overlay will use. Plan 63-04 can mount alongside the toolbar with the same gate.
- `selection.ids.length === 1 ? 'canvas' : 'selection'` resolution in handleAlign is the canonical N=1-vs-N≥2 routing — the smart-guide drag handler will need the same predicate; reuse it.

### For Plan 63-05 (PARITY-03 multi-element fixture extension + perf budget verification)
- The `floating-alignment-toolbar` testid is now part of the PARITY-01 chrome leak regex; PARITY-03 fixtures can re-use this testid as one of their multi-element absence assertions.
- The PT-FT test pattern (N=5 fixture; positive+negative pair within one test) is the template Plan 63-05 should follow for its multi-element fixture suite.

### For Phase 64 (lock toggle UI)
- The toolbar already renders at the right zoom level + position; LOCK-03's Cmd+Shift+L can dispatch a `TOGGLE_LOCK` action and the toolbar can grow a 9th button (lock icon) without touching the existing 8. Slot reserved.

### For Phase 65 (layers panel)
- ToolbarAction is the dispatch boundary contract — `{ kind, axis }`. The right-rail multi-select bar in Phase 65 can emit the SAME ToolbarAction shape and route through `handleAlign`. No new action types needed.

## Deviations from Plan

### Plan executed exactly as written, with two minor test-tooling adjustments

1. **`fireEvent.keyDown` vs `dispatchEvent` split**: The plan-spec example used `new KeyboardEvent` + `dispatchEvent` (mirrored from Plan 62-03 KG1). That works for verifying `preventDefault` calls but does NOT flush React state — so any test that needs to observe post-dispatch text_box / custom_image positions has to use `fireEvent.keyDown` (which wraps in `act()`). I split KD1 and KD3 into pairs (KD1+KD1b, KD3+KD3b): one observes positions, the other verifies preventDefault. Net: more tests, same coverage.

2. **`isEditingTarget` inlined at every binding (not factored into closure helper)**: My first GREEN attempt put the firewall ONLY in the closure helpers (alignKeyHandler / distributeKeyHandler), which dropped the grep count to 13 (11+2) instead of the required 19 (11+8). Inlining the guard at each of the 8 binding handlers brings the count to 20 — matches the Plan 60-04 grep-visibility contract. The plan's verification grep gate caught this.

### Auth gates
None — pure UI/UX wiring plan, no I/O.

## Threat Flags
None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Threat register T-63-06..09 mitigations all hold:

- **T-63-06** (tampering — tinykeys binding browser-default conflict): inlined `isEditingTarget` firewall + unconditional preventDefault in every binding. Tests KA3 + KD4 pin the firewall returns BEFORE preventDefault when target is a textarea (browser default fires); KD1b + KD3b pin preventDefault is called when target is the document body.
- **T-63-07** (info disclosure — toolbar leaking into Satori PNG export): toolbar mount is structurally inside the editable={true} branch (line 2267 > line 790 editable=false early return). PARITY-01 + new ST4 + parity.test.tsx PT-FT pin.
- **T-63-08** (DoS — binding fires while user is typing): `isEditingTarget` guard returns early. KA3 + KD4 pin via textarea fixture.
- **T-63-09** (elevation — user dispatches ALIGN with locked ids): Plan 63-01 reducer + pure fn already filter locked from move; this plan just dispatches — no further check needed (defense-in-depth at the data layer is sufficient).

## Known Stubs
None — every patched element flows to actual schema fields read by both renderers (TPLREND-05 contract preserved). The toolbar buttons render lucide-react icons + emit ToolbarAction; every button reaches handleAlign reaches dispatch reaches reducer reaches pure fn reaches schema mutation.

## Self-Check: PASSED

**Files exist:**
- `src/components/editor/floating-alignment-toolbar.tsx` — FOUND
- `src/components/editor/__tests__/floating-alignment-toolbar.test.tsx` — FOUND
- `src/components/slides/__tests__/slide-preview-floating-toolbar.test.tsx` — FOUND
- `src/components/slides/slide-preview.tsx` — FOUND (modified)
- `src/components/editor/slide-canvas.tsx` — FOUND (modified)
- `src/components/editor/slide-editor.tsx` — FOUND (modified)
- `src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` — FOUND (modified)
- `src/lib/render/__tests__/parity.test.tsx` — FOUND (modified)

**Commits exist:**
- `691d712` — test(63-02/t1): RED FloatingAlignmentToolbar — FOUND
- `6e0e72d` — feat(63-02/t1): GREEN FloatingAlignmentToolbar — FOUND
- `d2de9b9` — test(63-02/t2): RED slide-preview ↔ toolbar mount + parity PT-FT — FOUND
- `82d5093` — feat(63-02/t2): GREEN slide-preview wiring — FOUND
- `015343f` — test(63-02/t3): RED 12 new tinykeys + handleAlign tests — FOUND
- `e6ac985` — feat(63-02/t3): GREEN 8 tinykeys bindings + handleAlign callback — FOUND

**Verification grep gates:**
- `grep -c "isEditingTarget(e.target)" src/components/editor/slide-editor.tsx` → 20 ✓ (≥19)
- `grep -cE "Alt\+(a\|h\|d\|w\|v\|s)" src/components/editor/slide-editor.tsx` → 8 ✓ (≥6)
- `grep -cE '\\\$mod\\+Alt' src/components/editor/slide-editor.tsx` → 2 ✓ (≥2)
- `grep -cE "type: 'ALIGN'\|type: 'DISTRIBUTE'" src/components/editor/slide-editor.tsx` → 4 ✓ (≥2 — handleAlign + alignKeyHandler ALIGN; handleAlign + distributeKeyHandler DISTRIBUTE)
- `grep -c "FloatingAlignmentToolbar" src/components/slides/slide-preview.tsx` → 3 (1 import + 1 comment ref + 1 mount JSX) — plan spec said =2; the third hit is an explanatory comment ("the FloatingAlignmentToolbar below") which is informative-only. Structural gating still holds: mount line 2267 > editable=false early return line 790.
- Toolbar JSX line 2267 > editable=false early return line 790 → structural gating ✓

**Test results:**
- `npx vitest run src/components/editor/__tests__/floating-alignment-toolbar.test.tsx` → 18/18 pass
- `npx vitest run src/components/slides/__tests__/slide-preview-floating-toolbar.test.tsx` → 6/6 pass
- `npx vitest run src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` → 31/31 pass
- `npx vitest run src/lib/render/__tests__/parity.test.tsx` → 28/28 pass
- `npx vitest run src/lib/editor/ src/components/editor/ src/components/slides/ src/lib/render/` → 694/694 pass
- `npx tsc --noEmit -p tsconfig.json` → 17 errors (baseline preserved)

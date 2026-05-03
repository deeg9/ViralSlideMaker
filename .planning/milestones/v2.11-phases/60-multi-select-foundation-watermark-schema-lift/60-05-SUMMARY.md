---
phase: 60-multi-select-foundation-watermark-schema-lift
plan: 05
subsystem: editor-ux
tags: [multi-select, selection-ring, type-bar, click-empty-canvas, parity, ux-surface]
requires:
  - "Plan 60-01 (Watermark interface + slide.watermark? slot)"
  - "Plan 60-02 (watermark-adapter + PARITY-01 chrome-leak gate seed)"
  - "Plan 60-03 (useSelectionModel hook + Selection type)"
  - "Plan 60-04 (tinykeys keyboard + selection.replaceWith / selectAll / clear bindings)"
provides:
  - "computeSelectionBounds(slide, ids) -> AABB | null pure helper"
  - "MultiSelectTypeBar component (N>=2 right-rail panel)"
  - "Selection ring (data-testid='multi-selection-ring') in editable=true branch"
  - "Click-empty-canvas-clears (SEL-09) wiring"
  - "Per-element Shift-click toggle (SEL-02/SEL-03) at all 4 click sites"
  - "useSelectionModel.setSelection(next | (prev) => next) API for React-style updates"
  - "selection + onSelectionChange props on SlideCanvas + SlidePreview"
  - "selection + onBulkDelete props on TextEditorPanel"
  - "PARITY-01 test extension with concrete multi-selection-ring presence/absence assertions"
affects:
  - "Phase 61 (additive marquee): canvas onClick will be replaced with onPointerDown for marquee-start"
  - "Phase 62 (groups): SEL-04 Cmd+click deep-select-through-groups will replace the no-op modifier read"
  - "Phase 63 (alignment): MultiSelectTypeBar will gain font/color/treatment fields + structural-anchor TextBox height resolution in selection-bounds"
  - "Phase 64 (lock/hide + bulk-delete reducer): TYPE BAR Delete will route through a proper bulk-delete reducer action; hook/body/watermark inclusion lifts"
  - "Phase 66 (cleanup): legacy selectedTextBoxId dual-write retires; setSelection becomes the only seam"
tech-stack:
  added: []
  patterns:
    - "Pure-module transform under src/lib/editor/transforms/ (mirrors text-box-adapter convention)"
    - "Structural editable=true gating (testid lives AFTER the if (!editable) early-return; verified by line-number check + parity test)"
    - "Functional-updater setSelection via ref-mirror pattern (avoids nested setState)"
    - "Mount-conditional ternary in right rail (N>=2 -> TYPE BAR, N<=1 -> single-element card)"
    - "pointer-events:none on selection-ring overlay so clicks pass through to elements"
key-files:
  created:
    - "src/lib/editor/transforms/selection-bounds.ts (84 LOC pure module)"
    - "src/lib/editor/__tests__/selection-bounds.test.ts (174 LOC, 10 tests)"
    - "src/components/editor/multi-select-type-bar.tsx (74 LOC component)"
    - "src/components/editor/__tests__/multi-select-type-bar.test.tsx (220 LOC, 9 tests)"
  modified:
    - "src/components/slides/slide-preview.tsx (+~100 LOC: ring + 4 onMouseDown extensions + canvas-empty + props)"
    - "src/components/editor/text-editor-panel.tsx (+~25 LOC: ternary branch + 2 props)"
    - "src/components/editor/slide-canvas.tsx (+~10 LOC: selection prop pass-through)"
    - "src/components/editor/slide-editor.tsx (+~40 LOC: selection prop wiring + onBulkDelete handler)"
    - "src/lib/editor/use-selection-model.ts (+~35 LOC: setSelection API + ref mirrors)"
    - "src/lib/render/__tests__/parity.test.tsx (+~75 LOC: 2 new PARITY-01 tests)"
decisions:
  - "Helper placed under src/lib/editor/transforms/ (new directory) per plan; mirrors text-box-adapter pure-module convention; importable from server/RPC/MCP"
  - "Watermark + structural-anchor TextBoxes intentionally skipped in computeSelectionBounds (RESEARCH Q6 lines 1116-1140); documented as Phase 60 known gaps with TODO references to Phase 62/63"
  - "Selection ring placed at end of editable JSX (after slide-number badge) so z-index 50 paints above everything; data-testid lives at line 1725 vs editable=false early-return at line 665 — STRUCTURALLY gated"
  - "Added setSelection to useSelectionModel rather than creating a separate dispatch shim — the new API uses ref mirrors so the functional-updater branch reads consistent state without nested setState (anti-pattern in React strict mode)"
  - "Plan-Checker Warning #2 honored — TYPE BAR Delete only routes through removeTextBox (custom only) + handleRemoveCustomImage; hook/body/watermark are silently skipped. Full bulk-delete reducer action arrives in Phase 64 (per RESEARCH §SEL-12)"
  - "SEL-04 Cmd+click is a no-op in Phase 60 — modifier read is intentionally NOT wired (e.metaKey check absent from click handlers); deep-select-through-groups requires Phase 62 group semantics"
  - "selection prop on SlidePreview/SlideCanvas accepts plain Selection {ids, primary} object, not the full SelectionModel — keeps the consumer interface narrow + makes test fixtures simple"
requirements-completed: [SEL-01, SEL-02, SEL-03, SEL-09, SEL-12, SEL-13, PARITY-01]
metrics:
  duration: "~9 minutes"
  completed: "2026-05-03"
  tasks: 3
  files: 10
  loc_added: ~735
  loc_estimated: 480
---

# Phase 60 Plan 05: Selection Ring (Union AABB) + TYPE BAR + Click-Empty-Canvas Summary

The visible UX surface for Phase 60 multi-select. This is the first user-facing plan in Phase 60 — Plans 01–04 were plumbing (schema, watermark adapter, selection model, keyboard firewall); this plan ships the dashed ring, the right-rail TYPE BAR, and the click-empty-canvas-clears wiring that makes the foundation feel real to the user.

## What Shipped

### 1. `computeSelectionBounds` — pure helper (Task 1)

Path: `src/lib/editor/transforms/selection-bounds.ts` (84 LOC)

Signature:
```ts
export function computeSelectionBounds(slide: Slide, ids: string[]): AABB | null
```

Returns the union axis-aligned bounding box (in canvas %) for the selection, or `null` when:
- `ids` is empty
- no id resolves to a contributing element
- only structural-anchor TextBoxes (`anchor !== 'custom'`) or only the watermark were selected

Phase 60 known gaps (documented in module header + tests):
- **Structural-anchor TextBoxes skipped**: hook/body boxes (`anchor: 'top'|'center'|'bottom'`) carry no x/y. Height resolution requires a DOM ref via the rendered-height observer at `slide-preview.tsx:589-637`. Phase 63 (alignment) will lift that into a shared helper.
- **Watermark skipped**: `Watermark.position` is an enum, not a freeform tuple. `resolveWatermark` / `resolveForcedWatermark` own size at render time. Phase 62/63 revisit.

Pure module — verified by Test 8 (static grep): no `react`, no `'use client'`, no `document` / `window` access.

### 2. `MultiSelectTypeBar` — right-rail panel (Task 2)

Path: `src/components/editor/multi-select-type-bar.tsx` (74 LOC)

Phase 60 minimal surface (RESEARCH Q5 lines 1032-1043):
- Header: "{N} elements selected"
- Type breakdown (one line each, omitted when zero): "{N} text box(es)", "{N} image(s)", "1 watermark"
- Single Delete button labeled "Delete {N} elements"

Honors **PITFALL-12.3 / 1.3**: no "primary" key-object UX. Test 8 statically grep-checks the rendered output for `primary` / `key object` / `key element` substrings — all absent.

Property fields (font, color, treatment) intentionally **NOT** rendered in Phase 60. Tests 6 verifies absence — those land in Phase 63 alongside the alignment toolbar.

### 3. Wiring (Task 3)

| File | Change | LOC |
|---|---|---|
| `src/components/slides/slide-preview.tsx` | New `selection` + `onSelectionChange` props; canvas-empty onClick clears via `onSelectionChange({ ids: [], primary: null })`; 4 per-element `onMouseDown` handlers extended with `e.shiftKey` branch (toggle vs replace); union-AABB ring with `data-testid="multi-selection-ring"` rendered AFTER slide-number badge in the editable branch only | +~100 |
| `src/components/editor/text-editor-panel.tsx` | New `selection` + `onBulkDelete` props; ternary at the ActiveTextBoxCard mount point (N>=2 → MultiSelectTypeBar; N<=1 → ActiveTextBoxCard) | +~25 |
| `src/components/editor/slide-canvas.tsx` | New `selection` + `onSelectionChange` props forwarded to SlidePreview | +~10 |
| `src/components/editor/slide-editor.tsx` | Passes Selection snapshot to SlideCanvas + TextEditorPanel; wires `onBulkDelete` to route through existing per-id remove helpers; uses new `selection.setSelection` for `onSelectionChange` | +~40 |
| `src/lib/editor/use-selection-model.ts` | Adds `setSelection(next \| (prev) => next)` API using ref-mirror pattern (avoids nested setState in the functional-updater branch) | +~35 |
| `src/lib/render/__tests__/parity.test.tsx` | Extends PARITY-01 with 2 new tests: editable=false renders no ring even when N>=2 selection passed; editable=true renders no ring when N<2 | +~75 |

#### Per-element Shift-click contract (4 sites)

| Wrapper (slide-preview.tsx) | Element id source | Behavior |
|---|---|---|
| Hook (line ~1078) | `slide.text_boxes.find(role==='hook').id` | Shift → toggle; plain → replace + legacy `onTextBoxSelect` |
| Body (line ~1184) | `slide.text_boxes.find(role==='body').id` | Same |
| Custom text (line ~1313) | `ct.id` (== TextBox.id by Phase 49 adapter) | Same |
| Custom image (line ~1466) | `ci.id` | Shift → toggle; plain → replace + `onCustomImageSelect` |

`stopPropagation()` on each handler prevents the canvas-empty onClick from firing immediately after.

#### Editable-branch structural gating (TPLREND-05 invariant)

The selection ring `data-testid="multi-selection-ring"` is at line 1725 of `slide-preview.tsx`. The non-editable branch returns early at line 665 (`if (!editable) {...}`). The ring is therefore **structurally** unreachable from the non-editable path — not just `if`-guarded.

Verified by:
- Defensive line-number check (RING_LINE > EARLY_RETURN_LINE)
- PARITY-01 test in `src/lib/render/__tests__/parity.test.tsx` rendering with `editable={false}` AND `selection={{ ids: [...], primary: ... }}` and asserting `querySelector('[data-testid="multi-selection-ring"]')` is null
- Defense-in-depth grep against `render-slide-satori.tsx` source — zero `multi-selection-ring` matches outside comments

## Test Coverage Map (REQ-IDs → tests)

### `selection-bounds.test.ts` (10 tests)

| REQ-ID | Test # | What it pins |
|---|---|---|
| (init) | 1, 2 | Empty / stale-only ids → null |
| SEL-13 | 3 | Single custom_image returns its bounds verbatim |
| SEL-13 | 4 | Multi custom_image → union AABB |
| SEL-13 | 5 | Mixed text+image union |
| Phase 60 gap | 6, 6b | Structural-anchor TextBox skipped |
| Phase 60 gap | 7, 7b | Watermark skipped |
| (purity) | 8 | Static grep: no react / use client / document / window |

### `multi-select-type-bar.test.tsx` (9 tests)

| REQ-ID | Test # | What it pins |
|---|---|---|
| SEL-12 | 1 | Header shows N=3 for 3 selected |
| SEL-12 | 2, 2b, 5 | Type breakdown for text+image / +watermark / mixed |
| SEL-12 | 3 | Delete button labeled "Delete N elements" |
| SEL-12 | 4 | Click → onBulkDelete(ids) |
| Phase 63 gate | 6 | No font/color/treatment fields rendered |
| (use client) | 7 | 'use client' directive present |
| **PITFALL-12.3** | **8** | **No "primary" / "key object" UX in rendered output** |

### `parity.test.tsx` (2 new tests; 21 total)

| REQ-ID | What it pins |
|---|---|
| **PARITY-01** | **editable=false + N>=2 selection → ring testid absent (TPLREND-05)** |
| PARITY-01 | editable=true + N<2 → ring absent (single-select gate) |

## Verification Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **17 errors, identical to baseline** (pre-existing test-mock typing in unrelated files; zero new errors introduced) |
| `npx vitest run src/lib/editor/__tests__/selection-bounds.test.ts` | **10/10 pass** |
| `npx vitest run src/components/editor/__tests__/multi-select-type-bar.test.tsx` | **9/9 pass** |
| `npx vitest run src/lib/render/__tests__/parity.test.tsx` | **21/21 pass** (19 baseline + 2 new) |
| `npx vitest run src/lib/editor/ src/components/editor/ src/components/slides/` | **All passing** |
| `npx vitest run src/lib/render/` | **226/226 pass** |
| `grep -v '^[[:space:]]*//' render-slide-satori.tsx \| grep multi-selection-ring` | **0 matches** (Satori source clean) |
| `grep -B 8 multi-selection-ring slide-preview.tsx \| grep editable` | **MATCH** (ring near editable guard) |
| Ring at line 1725, non-editable early return at line 665 | **OK** (structurally gated) |

## Cross-Phase Constraints Honored

- **TPLREND-05 parity** — selection ring lives STRICTLY inside the `editable={true}` branch. PARITY-01 test asserts the testid is absent from the editable=false render tree even when `selection={{ ids: [...], primary: ... }}` is explicitly passed.
- **onDragStop only** — no new drag handlers; ring is render-only chrome with `pointer-events: none`.
- **isEditing guard** — N/A (Plan 04 owns keyboard).
- **pushHistory once per gesture** — N/A; click-empty-canvas calls `onSelectionChange` (a setState, not a reducer dispatch). Zero `pushHistory` calls added in this plan.
- **Selection state outside reducer history** — `setSelection` is a setState wrapper on `useState`; no reducer dispatches.
- **Modifier state resets on window.blur** — Shift-click reads `e.shiftKey` directly off the pointer event (per RESEARCH Q4 lines 933-935 marquee-style consumers read e.shiftKey directly), so the modifier-state reset on blur is irrelevant to this plan's scope.
- **No shortcut creep** — no new keybindings; click handlers only.

## Phase 60 Known Gaps (intentional, documented for Phase 62/63 inheritors)

1. **Structural-anchor TextBox height in `computeSelectionBounds`** — TextBoxes with `position.anchor !== 'custom'` are skipped; the rendered-height observer pattern at `slide-preview.tsx:589-637` is required to resolve their actual height. Phase 63 (alignment) will lift that into a shared helper.
2. **Watermark in `computeSelectionBounds`** — `Watermark.position` is an enum, not a freeform tuple. `resolveWatermark` / `resolveForcedWatermark` compute size at render time. Phase 62/63 may revisit when freeform watermark positioning becomes a user requirement.
3. **Watermark in `BULK_TRANSLATE`** — same enum-vs-tuple gap (already documented in Plan 60-03 SUMMARY). Plan 60-03's reducer skips the watermark id silently.
4. **SEL-04 Cmd+click deep-select-through-groups** — Phase 60 wires NO behavior for Cmd+click. Plain click without Shift behaves identically to single-click (replaces selection). Phase 62 (groups) implements the deep-select semantics.
5. **Bulk-delete partial coverage** — TYPE BAR Delete button only deletes `text_box.role==='custom'` and custom_images. Hook/body text_boxes are structural-to-legacy and silently skipped; watermark not deleted. Phase 64 ships a proper bulk-delete reducer action that handles all element types.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing API] Added `setSelection` to `useSelectionModel`**
- **Found during:** Task 3 wiring.
- **Issue:** The plan's Step B per-element Shift-click handler calls `onSelectionChange((s: Selection) => ...)` (functional-updater shape). The existing `SelectionModel` API exposed `replaceWith / addToSelection / removeFromSelection / toggleInSelection / clear / selectAll` but no setter that accepts a `(prev) => next` updater. Building the toggle-or-add logic via the discrete ops would require reading `prev` from the model snapshot (race-prone since each setter triggers a re-render before the next op fires).
- **Fix:** Added `setSelection(next | (prev) => next)` to the model. Used a ref-mirror pattern (idsRef + primaryRef, kept in sync via two useEffects) so the functional-updater branch reads consistent state synchronously without nested setState (which is unreliable in React strict mode). All 17 existing `use-selection-model.test.ts` tests still pass post-addition.
- **Files modified:** `src/lib/editor/use-selection-model.ts`
- **Commit:** Task 3 (c8ef91b) — folded into the wiring commit since it's an internal API addition consumed only by Plan 60-05.

**2. [Editor judgment — PATTERNS.md mount-conditional refinement] Ternary requires both `selection` AND `onBulkDelete`**
- **Found during:** Task 3 wiring of TextEditorPanel.
- **Issue:** Plan said `selection.ids.length >= 2 ? <MultiSelectTypeBar.../> : <ActiveTextBoxCard.../>`. But `MultiSelectTypeBar` requires `onBulkDelete` (typed as required prop). Test cases for TextEditorPanel that pass selection but not onBulkDelete would crash.
- **Fix:** Ternary condition is now `selection && selection.ids.length >= 2 && onBulkDelete ? <MultiSelectTypeBar.../> : <ActiveTextBoxCard.../>`. Callers that don't wire onBulkDelete fall back to the legacy single-element flow gracefully.
- **Files modified:** `src/components/editor/text-editor-panel.tsx`
- **Commit:** Task 3 (c8ef91b)

**3. [Plan refinement — Plan-Checker risk #2] TYPE BAR `onBulkDelete` slide-editor wiring**
- **Found during:** Task 3 slide-editor.tsx wiring.
- **Issue:** Plan suggested iterating `ids` and calling `onRemoveTextBox` for each `tb.role === 'custom'` (single line). But the slide-editor binds `removeTextBox(slideIndex, id)` (two args), and custom_images need a separate handler.
- **Fix:** Loop branches on element type — `tb?.role === 'custom'` → `removeTextBox(selectedIndex, id)`; otherwise check `custom_images` and call `handleRemoveCustomImage(id)`. After loop, `selection.clear()` so ring/TYPE BAR collapse on next render. Hook/body/watermark silently skipped (documented gap).
- **Files modified:** `src/components/editor/slide-editor.tsx`
- **Commit:** Task 3 (c8ef91b)

### LOC Estimate Variance

Plan estimated ~480 LOC; actual ≈ **735 LOC**. Overrun concentrated in:
- `selection-bounds.test.ts` (174 vs estimated 80) — added 'b' sub-cases for Tests 6 + 7 covering "only structural" / "only watermark" pathways for completeness
- `multi-select-type-bar.test.tsx` (220 vs estimated 80) — same readability-driven verbosity as Plans 60-03 / 60-04 tests; added Test 2b (watermark-only breakdown) for coverage
- `slide-preview.tsx` delta (~100 vs ~120 estimated) — within range
- `use-selection-model.ts` setSelection addition (~35 LOC, unanticipated)
- `parity.test.tsx` extension (~75 vs estimated 30) — added a second test (editable=true + N<2 gate) for completeness

Production code (~225 LOC across 3 files) — within plan range. Test verbosity dominates the variance, consistent with Plans 60-03 / 60-04 where readability-line-per-assert pushed tests well above plan estimates.

## Authentication Gates

None — Plan 60-05 has zero auth-related work.

## Seam for Subsequent Phases

| Phase | Imports / consumes | Wiring point |
|---|---|---|
| **61 (additive marquee)** | `selection` + `onSelectionChange` props on SlidePreview; `useModifierState().get().shift` from Plan 04 | Replace canvas-root onClick with onPointerDown to start marquee; on pointerUp, call `onSelectionChange(next)` with the marqueed ids (Shift = additive, no Shift = replace) |
| **62 (groups)** | Cmd+click handler in slide-preview onMouseDown | Replace the no-op modifier read with deep-select-through-groups: when groupId set, click selects siblings unless Cmd is held |
| **63 (alignment)** | `MultiSelectTypeBar` body | Add font/color/treatment property fields under the breakdown list; lift structural-anchor TextBox height resolution into a shared helper for `computeSelectionBounds` |
| **64 (lock/hide + bulk-delete)** | TYPE BAR Delete button + `handleBulkDelete` in slide-editor | Replace per-id loop with a single `BULK_DELETE` reducer dispatch (handles all element types incl. hook/body/watermark) |
| **66 (cleanup)** | `setSelectedTextBoxId` legacy slot | Remove dual-write; `selection.replaceWith` / `setSelection` become the only seam |

## Self-Check: PASSED

**Files verified to exist:**
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/transforms/selection-bounds.ts` (84 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/__tests__/selection-bounds.test.ts` (174 LOC, 10 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/multi-select-type-bar.tsx` (74 LOC)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/__tests__/multi-select-type-bar.test.tsx` (220 LOC, 9 tests)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/text-editor-panel.tsx` (modified — branch ternary at lines ~120-138)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/slide-canvas.tsx` (modified — selection prop pass-through)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/editor/slide-editor.tsx` (modified — selection wiring at SlideCanvas + TextEditorPanel mount sites)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/components/slides/slide-preview.tsx` (modified — ring at line 1725, 4 onMouseDown extensions, canvas-empty clear)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/editor/use-selection-model.ts` (modified — setSelection API + ref mirrors)
- `/Users/deeg/Downloads/b_PtJ6SJaZFpQ-1773178607401/TikTokSlideshow/src/lib/render/__tests__/parity.test.tsx` (modified — 2 new PARITY-01 tests at line ~340)

**Commits verified to exist:**
- `2edf43b` — `feat(60-05/t1): computeSelectionBounds pure helper + 10 unit tests`
- `278a0a4` — `feat(60-05/t2): MultiSelectTypeBar component + 9 unit tests`
- `c8ef91b` — `feat(60-05/t3): selection ring + TYPE BAR + click-empty-canvas-clears`

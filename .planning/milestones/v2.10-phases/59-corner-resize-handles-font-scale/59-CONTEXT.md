# Phase 59: Corner Resize Handles + Font-Scale - Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto-generated from milestone-level decisions (all gray areas locked during /gsd-new-milestone for v2.10)

<domain>
## Phase Boundary

Ship corner-drag-to-scale-font-and-width on text boxes (hook, body, custom) with side-handle width-only behavior preserved, top/bottom handles disabled, Shift+corner width-only escape hatch, single undo entry per gesture, WCAG 2.5.8 AA touch target compliance, and the v2.9 TPLREND-05 renderer parity invariant intact across all 3 render paths.

In scope (13 active reqs from REQUIREMENTS.md):
- RESIZE-01..04: 4 corner handles, sides preserved width-only, top/bottom disabled, Shift+corner = width-only escape.
- FONTSCALE-01..04: corner-drag scales font_size proportionally to width; past-cap = box keeps growing / font caps at 240/120; right-rail slider reflects within 1 frame; manual override bypasses hook-fit auto-shrink.
- PARITY-01..02: byte-identical render across 3 paths; resize handles never leak into Satori PNG.
- UNDO-01: single dispatch per gesture (on `onResizeStop`, not `onResize`).
- A11Y-01..02: WCAG 24×24 hit zones; corner cursor changes to nwse/nesw-resize.

Out of scope (carried forward from REQUIREMENTS.md):
- Top/bottom handles + explicit `height` field (HEIGHT-01, RESIZE-05).
- `min_height` field (MIN_HEIGHT-01).
- Snap-to-alignment-guides on resize (GUIDES-01 — `useAlignmentGuides` runs only on `onDrag`; v2.11 candidate).
- Rotation handles (ROTATE-01).
- Aspect-ratio-lock toggle (ASPECT-01 — Shift modifier covers it).
- First-use onboarding toast (ONBOARD-01).
- Custom-text dispatch path cleanup (CLEANUP-01 — `slide-preview.tsx:1062` still uses `UPDATE_CUSTOM_TEXT`; flagged but punted).
- Multi-select group resize, skew/shear, auto-fit-on-type.

</domain>

<decisions>
## Implementation Decisions

### UX semantic (Canva-style hybrid) — LOCKED
- Corner-drag scales `font_size` AND `position.width` together by the same ratio: `new_size = clamp(round(old_size × (new_width_pct / old_width_pct)), role_min, role_max)`.
- Side-drag (left + right): width-only, font unchanged. Identical to today's v1.3+ behavior.
- Top + bottom handles: explicitly disabled via `enableResizing.{top, bottom} = false`.
- Shift+corner: width-only escape hatch. Read `e.shiftKey` in `onResizeStop`; gate the `font_size` dispatch off when Shift is held during the gesture.

### Schema — LOCKED (no change)
- `TextBoxPosition` keeps its v2.8 shape: `anchor`, `x?`, `y?`, `width?`. NO `height` field, NO `min_height` field. The auto-fit-text design is correct for short bold hooks.
- Persistence: write to `text_boxes[i].position.width` and `text_boxes[i].font_size` (both already on the schema). `applyDualWrite` mirrors `position.width` to legacy `style_overrides.{hook,body}_width`. Mirror `font_size` to `style_overrides.{hook,body}_font_size` (existing override field — already read by the renderer at `slide-preview.tsx:313`).

### Past-the-cap behavior — LOCKED
- Box keeps growing on further drag, font caps at the role bound (240 hook / 120 body). Forgiving > honest.

### Shift modifier — INCLUDED in v2.10
- Read `e.shiftKey` in `onResizeStop`. When Shift is held, dispatch `width` only, skip `font_size`.

### Library — LOCKED
- `react-rnd@10.5.3` (already installed). 6-line `enableResizing` flip. NO library swap.

### Renderer touch surface — MINIMAL
- `render-slide.ts` and `render-slide-satori.tsx`: NONE. Both already read `font_size` + `position.width` from `style_overrides.{hook,body}_font_size` / `_width` and from `text_boxes[i]`. No new schema field = no new parity surface.
- `slide.ts`, `editor-reducer.ts`, `text-box-adapter.ts`: NONE. Reducer already accepts `Partial<TextBox>` via `UPDATE_TEXT_BOX`. Adapter has no height-mirroring concerns.

### Undo discipline — LOCKED
- Dispatch on `onResizeStop` ONLY (not `onResize`). One undo entry per gesture. Test: 60 simulated `onResize` ticks → reducer history length = 1 after `onResizeStop`.

### Touch a11y — LOCKED
- WCAG 2.5.8 AA: 24×24 CSS px hit zones. Visual handles stay 12×12; padded via `inset: -10px` on a wrapper or `::before` pseudo-element.

### Cursor affordance — LOCKED
- Corner hover: `nwse-resize` (TL/BR) or `nesw-resize` (TR/BL). Side handles keep `ew-resize`.

### Claude's Discretion
- Internal commit shape (C1-C4 from `.planning/research/SUMMARY.md`) is the planner's recommended decomposition; planner may adjust the ordering or merge/split commits if it reads cleaner. The 13 reqs are coupled enough that single-phase shipping is required (verified by roadmapper).
- Specific helper functions, hook extractions, and test file locations: planner's discretion. Patterns to mirror: v2.8 selection-ring (`editable={true}` gating), v2.9 `parity.test.tsx` (3-renderer byte-identity), v2.7 `e96fd3a` precedent (3-renderer audit rule).

</decisions>

<code_context>
## Existing Code Insights

Key files (from research; planner will deepen via gsd-pattern-mapper):

- `src/components/slides/slide-preview.tsx` — primary touch site
  - Lines 553+: `editable === false` early-return gate (Satori never sees `<Rnd>` DOM).
  - Lines 313: font-size precedence chain `overrides.hook_font_size ?? autoFitHookSize ?? baseHookSize` — preserve this.
  - Lines ~801: `enableResizing` config (currently left/right only — flip for corners).
  - Lines 860/935/1023: 3 `<Rnd>` call-sites for hook/body/custom (each has its own `onResizeStop`).
  - Lines 889/964/1062: 3 `onResizeStop` handlers — each gains ~10 lines (compute widthRatio, dispatch font_size on corner, skip font_size on Shift).
  - Lines 1156-1182: custom-image `<Rnd>` block — empirical proof all 8 handles work under the existing CSS-transform parent. Pattern to mirror (with `lockAspectRatio={false}` instead of `true`).

- `src/components/editor/slide-editor.tsx`
  - ~Line 433: `handleWidthChange` — extend to also write `style_overrides.{hook,body}_font_size` when role is hook or body. Custom-text path goes through `UPDATE_TEXT_BOX` directly with `font_size`.

- `src/lib/render/hook-fit.ts` — auto-shrink registry. NOT modified. Existing precedence at `slide-preview.tsx:313` already routes manual `font_size` overrides above the registry. Add a regression test asserting this on `news-drop` template.

- `src/lib/editor/editor-reducer.ts`
  - `UPDATE_TEXT_BOX` action: accepts `Partial<TextBox>` — works as-is.
  - `applyDualWrite`: mirrors `position.width` to legacy. Will continue to work; `font_size` mirroring goes through the new dispatch path in `slide-editor.tsx`.

- Tests:
  - `src/components/slides/__tests__/slide-preview.test.tsx` — gain ~30 lines for corner-drag + Shift cases.
  - `src/lib/render/__tests__/parity.test.tsx` — gain ~20 lines for cross-renderer byte-identity on post-corner-drag values.
  - `src/lib/editor/__tests__/editor-reducer.test.ts` — gain ~15 lines for single-history-entry assertion.

</code_context>

<specifics>
## Specific Ideas

### Internal commit shape (planner may adjust):

- **C1 — Enable corner handles:** Flip `enableResizing` to `{ left, right, topLeft, topRight, bottomLeft, bottomRight }` true; `top`, `bottom` false. Add corner-handle styles (12×12 visual; `inset: -10px` padding for 24×24 hit zone). Add `nwse/nesw-resize` cursors. Capture `oldWidthPx` and `oldFontSize` in `onResizeStart`. NO font-scale dispatch yet (corner-drag still resizes box only at this stage).
- **C2 — Dispatch font_size on corner:** In each `onResizeStop`, branch on `dir` (corner vs side). On corner: compute `widthRatio = newWidthPx / oldWidthPx`, compute `newFontSize = clamp(round(oldFontSize × widthRatio), role_min, role_max)`. Dispatch through `slide-editor.tsx` extended `handleSizeChange`. Routes through existing `style_overrides.hook_font_size` / `body_font_size` for hook+body; through `UPDATE_TEXT_BOX` directly for custom.
- **C3 — Tests + clamp + a11y:** Single-history-entry test (60-tick `onResize` simulation → history length = 1 after `onResizeStop`). Cross-renderer parity test (corner-dragged values render byte-identical across `slide-preview.tsx` non-editable, `render-slide.ts`, `render-slide-satori.tsx`). Satori-leak regression test (resize handles never appear in PNG export). Past-the-cap clamp behavior. Manual touch QA on iPhone Safari is a phase-close gate.
- **C4 — Shift+corner escape:** Read `e.shiftKey` in `onResizeStop`. When Shift held, dispatch `width` only and skip `font_size`. Test the modifier path.

### Reference patterns:
- `slide-preview.tsx:1156-1182` (custom-image `<Rnd>`) — paste-and-adapt for the corner config (with `lockAspectRatio={false}` instead of `true`).
- v2.7 commit `e96fd3a` precedent — three-file commit rule for parity changes (even though this phase touches 1 renderer file, the test must verify all 3).
- v2.8 BL-01 `applyDualWrite` precedent — dual-write pattern for legacy compat is already in place; `font_size` follows the same shape via `style_overrides.{hook,body}_font_size`.

### Test fixture proposal:
- Hook-text "STOP SCROLLING!" (15 chars) at default font_size 48, position.width 80.
- Simulate corner-drag from `oldWidthPx=864` (80% of 1080) to `newWidthPx=1080` (100%) → widthRatio=1.25 → newFontSize=60. Both width and font_size persist.
- Add a Shift-held variant: widthRatio=1.25 → font_size unchanged at 48, width updates to 100%.

### Out-of-band:
- A pre-existing `<img alt="" />` warning in `slide-preview.tsx` is unrelated; do NOT fix in this phase (scope creep).

</specifics>

<deferred>
## Deferred Ideas

(See REQUIREMENTS.md "Future Requirements" and "Out of Scope" sections for canonical list.)

Captured in milestone planning, deferred from this phase:

- Top/bottom handles + `height?` field (RESIZE-05, HEIGHT-01).
- `min_height?` field (MIN_HEIGHT-01).
- Snap-to-alignment-guides during corner-resize (GUIDES-01).
- Custom-text dispatch path cleanup (CLEANUP-01) — `slide-preview.tsx:1062` still calls `onCustomTextWidthChange` → `UPDATE_CUSTOM_TEXT`. The C2 commit will dispatch font_size through the same path; the cleanup-to-UPDATE_TEXT_BOX is its own quick.
- First-use onboarding toast (ONBOARD-01) — pre-PMF, cursor change is enough discoverability.

</deferred>

<canonical_refs>
## Canonical References

- `.planning/research/SUMMARY.md` — synthesized recommendations, locked direction (sections "TL;DR", "Feature table stakes", "Architecture", "Watch out for").
- `.planning/research/STACK.md` — react-rnd 10.5.3 paste-ready config, version verification, alternatives matrix.
- `.planning/research/FEATURES.md` — 7-of-8 industry tool survey (Canva, Figma, CapCut, Keynote, Pages, Adobe Express, VEED, Photoshop), persistence-as-explicit-`font_size` rationale.
- `.planning/research/ARCHITECTURE.md` — file-by-file touch list with line numbers, build order, data-flow diagram.
- `.planning/research/PITFALLS.md` — 14 in-scope pitfalls, prevention strategies cited against react-rnd issues #110/#766/#732, Satori issues #325/#393/#573, WCAG 2.5.8.
- `.planning/REQUIREMENTS.md` — 13 active reqs with REQ-IDs, traceability table → Phase 59.
- `.planning/ROADMAP.md` — Phase 59 goal, success criteria, internal C1-C4 commit shape.

</canonical_refs>

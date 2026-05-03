# Phase 60: Multi-Select Foundation + Watermark Schema Lift — Context

**Gathered:** 2026-05-02
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous --auto; gray areas resolved via REQUIREMENTS.md + research synthesis)

<domain>
## Phase Boundary

Lay the architectural foundation for every other v2.11 feature. Three concrete deliverables:

1. **Selection state model** — Replace current single-id `selectedTextBoxId` with `Selection { ids: string[]; primary: string | null }`. Insertion-ordered. Lives in React state outside reducer history (matches v2.8 pattern). Propagates to right-rail (TYPE BAR + "Mixed" placeholder), canvas (selection ring around union AABB when N≥2), and slide-list (clears on slide switch).

2. **Schema fields landed** — Add `groupId?: string`, `locked?: boolean`, `hidden?: boolean` as optional additive fields on `TextBox`, `CustomImage`, and a newly-defined `Watermark` element. NO behavior on these fields yet (semantics land in Phase 62 / 64) — this phase only DECLARES them so downstream phases have somewhere to write.

3. **Watermark unification** — Lift current watermark config from `SlideStyleOverrides.watermark` to an addressable element with stable `id` + the three new optional fields. Round-trip adapter `legacyWatermarkToElement` / `elementToLegacyWatermark` runs at slide-load and slide-save boundaries (mirrors v2.8 `legacyToTextBoxes` pattern). Both renderers (React preview + Satori PNG export) consume from the unified path; legacy `style_overrides.watermark` retained for back-compat for one milestone.

4. **Keyboard firewall foundation** — Install `tinykeys@3.0.0`; replace hand-rolled keydown switch at `slide-editor.tsx:340-385`; add Cmd+A (select all) + Esc (clear with group-aware double-press) + click-empty-canvas-to-clear; modifier state resets on `window.blur` and `document.visibilitychange`. Existing `isEditing` guard at `slide-editor.tsx:344-348` is the firewall — every new shortcut must pass through it.

**Out of scope for Phase 60:**
- Marquee selection (Phase 61)
- Group/Ungroup behavior — only the `groupId?` field lands here (Phase 62)
- Lock/Hide behavior — only the `locked?` / `hidden?` fields land here (Phase 64)
- Z-order, alignment, smart guides, layers panel, Alt-drag duplicate (later phases)

</domain>

<decisions>
## Implementation Decisions (locked)

### Selection state shape & location
- **Type:** `Selection { ids: string[]; primary: string | null }` — insertion-ordered array, never `Set` (preserves order for distribute-edge math; ref-stable update via `[...prev, id]` spread, never `prev.add(id)`).
- **Location:** New hook `useSelectionModel()` at `src/lib/editor/use-selection-model.ts` (or extend `useSlideEditor.ts:29`). Lives in React state OUTSIDE reducer history — matches v2.8 `selectedTextBoxId` pattern. Selection state never enters undo/redo.
- **Per-slide scoping:** Selection clears on `selectedIndex` change via `useEffect` keyed on slide index (mirrors existing single-select clear-on-slide-switch).
- **Stale-id reconciliation:** `useEffect` keyed on `state.present` (the slide content) — when the slide changes (delete, undo), filter `selection.ids` to drop ids that no longer exist. Reuse pattern at every reducer action that removes elements (`REMOVE_TEXT_BOX`, `REMOVE_CUSTOM_IMAGE`, `REMOVE_CUSTOM_TEXT`, `REMOVE_SLIDE`, `DUPLICATE_SLIDE`).

### Schema field placement
- Add `groupId?: string`, `locked?: boolean`, `hidden?: boolean` to `TextBox` (`slide.ts:90` interface).
- Add the same 3 fields to `CustomImage` (existing interface — find via grep).
- Define new `Watermark` interface with: `id: string` (stable, generated on first load), `groupId?: string`, `locked?: boolean`, `hidden?: boolean`, plus existing watermark config fields (`enabled`, `customLogoUrl`, `customText`, `position`).
- NO behavior on these fields yet — Satori path ignores them; editor preview ignores them. Phase 60 only declares.

### Watermark unification approach
- Add `Slide.watermark?: Watermark` (optional new field, additive).
- On slide load: `legacyToWatermark(slide)` runs in `useReducer` lazy initializer (mirror `legacyToTextBoxes` pattern at slide load). If `slide.watermark` is absent and `slide.style_overrides?.watermark` exists, synthesize a Watermark element with stable id (e.g. `w_${slide_uid_hash}` for deterministic id across renders).
- On slide save: `watermarkToLegacy(watermark)` mirrors back to `style_overrides.watermark` for backward compat (paid tier ignores legacy reads; just keeps DB shape).
- Both renderers (React `<SlidePreview>` + Satori `/api/render`) consume from `slide.watermark` when present, fall back to `slide.style_overrides.watermark` when absent. Both renderers BYTE-IDENTICAL pre/post unification across all 53+ existing projects (parity test extended).
- TPLREND-05 invariant: zero schema diff visible in Satori output. Verified via `parity.test.tsx` extension with watermark fixtures.

### Right-rail multi-select UX
- TYPE BAR shows shared ops only when N≥2 selected:
  - All-text selection → text-only ops (font, color, align, effects)
  - All-image selection → image-only ops (Pexels swap, treatment)
  - Mixed selection → only universally-shared ops (delete, lock toggle [Phase 64], group [Phase 62])
- Property fields with differing values across selection show "Mixed" placeholder (no input value; on edit, applies to all)
- NO "primary" key-object concept — Illustrator UX trap. Right rail does not track "the one you clicked first."

### Selection ring (canvas)
- Single dashed `#3d0000` ring rendered around union AABB when N≥2 (matches existing single-select ring at `slide-preview.tsx:877+` style).
- Render only when `editable={true}` (TPLREND-05 gate; matches v2.8 selection ring pattern).
- Empty selection → no ring.
- Single selection → existing per-element ring (unchanged from v2.8).

### Keyboard firewall (tinykeys + isEditing guard + blur reset)
- Install `tinykeys@3.0.0` (~650 B gzipped).
- Replace switch at `slide-editor.tsx:340-385` with declarative `tinykeys` map.
- Every new binding wraps handler in `if (isEditing(target)) return; e.preventDefault(); ...` — same pattern as existing `slide-editor.tsx:344-348`.
- Phase 60 shortcuts:
  - `$mod+a` → SELECT_ALL on current slide (slide-scoped; never cross-slide)
  - `Escape` → ESC handler: first press exits group (Phase 62); second press clears selection
  - Existing `$mod+1/2/3`, `$mod+d`, `Delete` migrate to tinykeys (no behavior change)
- Modifier state tracking: new hook `useModifierState()` listens to `keydown`/`keyup` AND `window.blur` + `document.visibilitychange` to reset state. Used by Hold-Cmd-disable-snap (Phase 63) and additive-marquee (Phase 61) — Phase 60 only ships the hook + reset infrastructure.

### Multi-drag dispatch (PERF-01 — sets pattern for later phases)
- New reducer action `BULK_TRANSLATE { slideIndex: number; ids: string[]; deltaX: number; deltaY: number }` — single dispatch, single `pushHistory`.
- Phase 60 wires the action shape but does NOT trigger it from drag handlers yet (multi-drag UX comes when groups arrive in Phase 62; Phase 60 just defines the contract).
- onDragStop pattern strictly enforced — never per-tick `onDrag` (carry-forward from v2.10 PERF-01).

### Click-empty-canvas-to-clear
- Pointer-down on canvas root WHERE `e.target === e.currentTarget` AND no marquee dragging → REPLACE_SELECTION([]).
- Marquee work in Phase 61 will add the drag-start branch.

</decisions>

<code_context>
## Existing Code Insights

**Selection state (v2.8 baseline):**
- `src/lib/editor/use-slide-editor.ts:29` — `selectedTextBoxId: string | null` lives in React state outside reducer history. Comment line 7-8 explicitly documents this pattern: "selection changes never push undo/redo." v2.11 multi-select extends this exact pattern.
- `src/components/editor/slide-editor.tsx:340-385` — current keydown handler (switch-based). The isEditing guard at 344-348 is canonical — DO NOT modify; extend.

**Schema:**
- `src/lib/types/slide.ts:88-103` — TextBox interface (where `groupId?`/`locked?`/`hidden?` get added).
- `src/lib/types/slide.ts:105-158` — SlideStyleOverrides (current watermark home at line 152-157).
- `src/lib/types/slide.ts:160-189` — Slide interface (where `watermark?: Watermark` gets added).
- `src/lib/types/slide.ts` — CustomImage interface (find via grep for `interface CustomImage` — needs the 3 new optional fields too).

**Adapter pattern reference:**
- `src/lib/editor/text-box-adapter.ts` — v2.8 `legacyToTextBoxes` / `textBoxesToLegacy` round-trip with 5 fixture shapes + 20 tests. Watermark adapter mirrors this exactly.

**Renderer touch points:**
- `src/components/slides/slide-preview.tsx:304` — `editable={true}` gate (selection ring lives behind this; multi-select ring extends).
- `src/components/slides/slide-preview.tsx:877+` — existing dashed selection ring (style template for union-AABB ring).
- `src/lib/render/render-slide-satori.tsx` — Satori path. Must read watermark from new path with legacy fallback.
- `src/lib/render/resolve-overlay.ts` — overlay layer order (watermark renders here in both engines).

**Reducer:**
- `src/lib/editor/editor-reducer.ts:7-21` — BL-01 dual-write comment (canonical pattern for atomic cross-shape updates). `BULK_TRANSLATE` action follows this same playbook.
- `src/lib/editor/editor-reducer.ts` — `pushHistory()` wrapper (used by every action that mutates slide content). `BULK_TRANSLATE` MUST go through it.
- `MAX_HISTORY=50` constant.

**Test infrastructure:**
- `parity.test.tsx` — extended with watermark fixtures
- `no-css-filter.test.ts` — extended with `*selection*` / `*marquee*` / `*guide*` regression scan (Phase 67 in research notes; phase 60 starts seeding the pattern)

</code_context>

<specifics>
## Specific Ideas

- **Stable watermark id generation:** Use deterministic `w_${slugify(project_id)}_${slide_index}` or similar — needs to round-trip correctly so legacy slides without `slide.watermark` regenerate the SAME id every load. Planner: explore deterministic-vs-random tradeoff during research; deterministic strongly preferred so undo/redo doesn't churn the id.
- **`useModifierState` hook:** Single shared hook returning `{ shift, cmd, alt }`. Listens to keydown/keyup. Resets to `{}` on `window.blur` + `document.visibilitychange`. Returns ref-stable getters (so consumers don't re-render on every keydown).
- **Selection-ring union AABB math:** Reuse pattern. Walk selected element positions; compute `Math.min(x)`/`Math.max(x+w)` etc. Pure function in `src/lib/editor/transforms/selection-bounds.ts` (planner can colocate or split).
- **TYPE BAR component:** Lives in right rail near existing `TextEditorPanel`. New file `src/components/editor/multi-select-type-bar.tsx`. When `selection.ids.length >= 2`, replaces the single-element panel; on selection narrowing back to 1, restores existing single-element panel.
- **Performance note:** v2.11 element count per slide realistically ≤30. No virtualization needed for Phase 60.

</specifics>

<deferred>
## Deferred Ideas

- **Marquee selection (Phase 61)** — `selecto@1.26.3` rubber-band rect; Shift-additive; rect normalization; pointer-events seam on canvas root.
- **Group/Ungroup behavior (Phase 62)** — Cmd+G / Cmd+Shift+G; group bounding box; double-click enter / Esc exit; group drag fans-out delta.
- **Lock/Hide behavior (Phase 64)** — `locked?` / `hidden?` semantics; Cmd+Shift+L; marquee skips locked; hidden filtered from both renderers.
- **Z-order operations (Phase 64)** — Cmd+] / Cmd+[ / Cmd+Alt+] / Cmd+Alt+[ array-splice within owning array.
- **Alignment / Distribute / Smart Guides (Phase 63)** — primary user-named feature; depends on groups (62) so groups can be treated as single units.
- **Layers panel (Phase 65)** — left-rail mount with react-arborist.
- **Power-user differentiators (Phase 66)** — Alt-drag duplicate, Cmd+D smart offset, equal-spacing == guide (== guide actually ships in Phase 63 per research).
- **`stylize-image.ts`, Pangram fonts, legacy schema sunset** — definitively post-PMF (per PROJECT.md `Deferred`).

</deferred>

<canonical_refs>
## Canonical References (downstream agents MUST read)

- `.planning/REQUIREMENTS.md` — locked v2.11 requirements (95+ reqs, 12 categories). Phase 60 covers SEL-01..04, SEL-07..13, SEL-15, WMARK-01..05, KBD-01..04, PARITY-01, PERF-01.
- `.planning/research/SUMMARY.md` — synthesized research findings; "Top Risks" section is mandatory pre-read for any agent touching schema or selection.
- `.planning/research/STACK.md` — exact npm version pins (`tinykeys@3.0.0` is THE only Phase 60 install).
- `.planning/research/ARCHITECTURE.md` — multi-select state model (`Selection { ids, primary }`), watermark unification approach, TPLREND-05 audit table.
- `.planning/research/PITFALLS.md` — Categories 1, 9, 10, 12 directly apply to Phase 60: stale-IDs (1.1), slide-switch reset (1.2), no-primary (1.3), Set-mutation (1.4), Cmd+A focus context (9.1), arrow-in-input (9.2), Cmd+G chrome conflict (9.3), modifier-blur-reset (9.4 / 5.5), parity leak (10.1-10.3), Adobe key-object trap (12.3).
- `.planning/research/FEATURES.md` — capability matrix; Phase 60 ships A2 (Shift-click), A3 (Cmd-click), A5 (Esc), A6 (deselect), A7 (click-empty), part of A1 (selection state foundation).
- `.planning/PROJECT.md` — milestone goal + carry-forward constraints.
- `.planning/MILESTONES.md` — v2.8 schema migration playbook (lines 104-127); Phase 50 LayerStrip pattern (line 109); v2.10 onResizeStop precedent (line 17).
- `src/lib/editor/text-box-adapter.ts` — v2.8 round-trip adapter pattern (mirror exactly for watermark).
- `src/lib/editor/use-slide-editor.ts` — selection-outside-reducer-history canonical pattern (line 29 + comment lines 7-8).
- `src/lib/editor/editor-reducer.ts` — `pushHistory` wrapper + `applyDualWrite` BL-01 pattern (lines 7-21 comment).
- `src/components/editor/slide-editor.tsx` — keyboard handler isEditing guard (lines 340-393, especially 344-348).
- `src/components/slides/slide-preview.tsx` — `editable={true}` gate at 304; selection ring style at 877+; watermark render path.
- `src/lib/types/slide.ts` — schema interfaces TextBox (88-103), SlideStyleOverrides (105-158), Slide (160-189).

</canonical_refs>

<phase_dependencies>
- **Depends on:** Nothing (first phase of v2.11)
- **Builds on:** v2.8 `text_boxes[]` schema; v2.10 `react-rnd` resize handles; v1.3 selection-outside-history pattern
- **Unblocks:** Every other v2.11 phase (60 is the foundation)
</phase_dependencies>

<success_criteria_recap>
1. Click any element (text/image/watermark) → selects; Shift+click adds/removes; Cmd+click deep-selects through groups (single-click unchanged from v2.8)
2. Cmd+A selects all on slide (slide-scoped); Esc clears (group-aware double-press); click-empty-canvas clears; slide-switch clears
3. N≥2 right rail shows TYPE BAR + "Mixed" placeholder; dashed selection ring around union AABB only when `editable={true}`; selection survives undo/redo with stale IDs pruned
4. Watermark unified as addressable element with `id`/`groupId?`/`locked?`/`hidden?`; legacy `style_overrides.watermark` path produces byte-identical PNG output across all 53+ existing projects
5. Multi-drag dispatches single `BULK_TRANSLATE` on `onDragStop` only; modifier state resets on `window.blur` + `visibilitychange`; every new shortcut respects `isEditing` guard + calls `e.preventDefault()`
</success_criteria_recap>

# Feature Research — v2.11 Full Editor Parity

**Domain:** Multi-element editor (Figma/Canva-grade) for TikTok carousel slideshows
**Researched:** 2026-05-02
**Confidence:** HIGH (Figma/Canva docs cited per row; some edge cases MEDIUM)
**Scope:** NEW v2.11 capabilities only — assumes the existing single-element editor (drag, side+corner resize, click-select, right-rail inspector, Layer Strip, ⌘1/⌘2/⌘3/⌘D/Delete shortcuts, alignment guides during single-element drag, photo treatment, watermark) is intact and already shipped.

---

## How to read this file

Each row in the capability matrix uses these conventions:

- **Pattern**: how leading tools (Figma/Canva/Keynote/Photoshop) ship the feature — exact gesture, modifier, shortcut
- **Visual feedback**: what users see during the operation
- **Edge cases**: tricky behaviors verified across tools
- **Class**: one of `TS` (table stakes — must ship in v2.11), `DIFF` (differentiator — consider for v2.11), `ANTI` (skip), `DEFER` (out of v2.11 scope)
- **Complexity** (vs. our existing editor): `LOW` (≤0.5d), `MED` (0.5–2d), `HIGH` (≥2d, schema/architecture impact)
- **Source**: cited URL or doc

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the user has already named OR features every surveyed tool ships in lockstep with the named ones. Missing any of these in v2.11 will make the editor feel less mature than v2.10 plus a ribbon.

| # | Feature | Pattern (verified) | Visual feedback | Class | Complexity | Source |
|---|---------|--------------------|-----------------|-------|------------|--------|
| A1 | Single-click select | Click element → becomes the only selection. Already shipped in our editor. | Dashed `#3d0000` selection ring (existing). Right rail mirrors. | TS (existing) | — (shipped) | Internal — `slide-canvas.tsx` |
| A2 | Shift-click add to selection | Shift+click an unselected element → joins selection. Shift+click a selected element → removes from selection (Figma model). | Selection ring drawn around new bounding box. | **TS** | MED — selection becomes a `Set<id>`; ring renderer needs union bounds. | [Figma Help — Select layers](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) (verbatim: "To remove an object from the selection, hold down the Shift key and click on the object."); [Canva Help — multi-select](https://www.canva.com/help/layer-group-align/) |
| A3 | Cmd/Ctrl-click toggle selection (Figma deep-select, Canva nested) | In Figma, **Cmd+click** is "deep select" — selects through groups/frames to the topmost intersected leaf. Shift remains add/remove. **Canva** uses Cmd-click only inside groups (post double-click enter). | Same selection ring; in groups, ring tightens to the leaf. | **TS** (Figma model — Cmd as deep-select; Shift remains add/remove). Reason: matches industry mental model and our hit-testing already needs to hit-test all elements when groups land. | MED | [Figma — Cmd+click for nested marquee](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects); [Figma forum — deep select](https://forum.figma.com/t/deep-select-how-to-select-something-that-is-below-an-group/28300) |
| A4 | Marquee (drag-to-select rectangle) | Click empty canvas → drag → rectangle. **Figma default = INTERSECT** (any element touching the marquee gets selected). Sketch default = CONTAIN (Option key adds intersect). Canva = INTERSECT (no contain mode). | Dashed/translucent rectangle from start point to cursor. Selected elements get rings. | **TS** — match Figma (intersect by default). Skip the contain modifier — single-axis design space, low value. | MED | [Figma forum — intersect default vs Sketch contain](https://forum.figma.com/t/need-a-drag-selection-that-selects-only-layers-totally-inside-the-marquee/30177); [Canva — drag selection box](https://www.canva.com/help/layer-group-align/) |
| A5 | Cmd+A select all on current slide | Cmd+A → all elements on the **current slide** selected (NOT cross-slide). Figma scopes to current page; we scope to current slide. | All elements ringed; bounding box around union. | **TS** | LOW | [Figma Help — Select all](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) ("⌘A selects everything on the canvas") |
| A6 | Esc deselect | Esc → clear selection. If inside a group, first Esc exits the group; second Esc clears. | Rings disappear; right rail returns to slide-settings empty state. | **TS** | LOW (already half-shipped — slide switch clears) | [Figma forum — Esc back out](https://forum.figma.com/suggest-a-feature-11/esc-key-to-back-out-1-level-35091) |
| A7 | Click empty canvas to deselect | Click on bare canvas (`#fff8f7` background, no element under cursor) → clear selection. | Same as Esc. | **TS** | LOW | Universal — Figma/Canva/Keynote default |
| B10 | Align left / center-h / right | Toolbar buttons + Figma-style shortcuts: **Alt+A** (left), **Alt+H** (center horizontal), **Alt+D** (right). | Selected elements snap to the alignment edge. No animation needed; instant snap. | **TS** | MED — math is simple but needs to handle pct-coordinates + canvas size + per-element width. Existing TextBox uses pct `position.x/y/width`; CustomImage uses pct. | [Figma — alignment shortcuts](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions); [Canva — Position dropdown](https://www.canva.com/help/layer-group-align/) |
| B11 | Align top / center-v / bottom | **Alt+W** (top), **Alt+V** (center vertical), **Alt+S** (bottom). | Same as B10 on Y-axis. | **TS** | MED (paired with B10) | Same as B10 |
| B12 | Align to canvas vs selection (toggle) | **Default behavior** (Figma + Canva + Adobe Express): **single selection → align to canvas/parent; multiple selection → align to selection bounds**. No explicit toggle in Figma/Canva (the toggle exists in Photoshop/Illustrator via Align panel "Align to" dropdown — Selection / Canvas / Key Object). | None (implicit from selection count). For v2.11 — match Figma: single = canvas, 2+ = selection bounds. | **TS** (no UI toggle needed; behavior derived from selection count) | LOW (decision rule, not UI) | [Figma — alignment behavior single vs multi](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) ("Single object → align to parent. Multiple → align in relation to each other or parent"); [Photoshop align-to dropdown](https://helpx.adobe.com/photoshop/using/aligning-layers.html) |
| B13 | Distribute horizontal | Distribute = equal **gaps between adjacent edges** (NOT equal-spacing-of-centers — that's a different operation). Figma shortcut: **Cmd+Alt+H** (Mac) / Ctrl+Alt+H (Win). Requires **3+ elements**. With 2 elements, it's a no-op. | Outermost elements stay anchored; middle elements move to make all gaps equal. | **TS** | MED — need to sort by X, compute total span minus widths, divide by (n-1) gaps, place each. | [Figma — distribute spacing shortcuts](https://forum.figma.com/t/help-distribute-horizontal-spacing-shortcut-not-working-bug/24136); [Canva — Space Evenly](https://hubdigitalcontent.com/tools/canva/how-to-space-evenly-in-canva/) |
| B14 | Distribute vertical | **Cmd+Alt+V** (Mac) / Ctrl+Alt+V (Win). Same model on Y-axis. Requires 3+ elements. | Same as B13 vertically. | **TS** | MED (paired with B13) | Same as B13 |
| C17 | Snap to other elements (edges, centers) — DURING MULTI-ELEMENT DRAG | When dragging element(s), snap to other elements' left/center/right edges (X) and top/middle/bottom edges (Y). Existing single-element guides (v1.3) cover the single case — multi-element drag needs snapping for the **selection bounding box** as a whole. | Pink/red/colored guide lines drawn from snapped edge through both elements. | **TS** | MED — extends the existing single-element guide engine to consume a union bounding box. | [Figma — smart guides](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions); [Canva — bright pink lines](https://www.storylane.io/tutorials/how-to-turn-off-snapping-in-canva) |
| C18 | Snap to canvas edges + center | Snap to canvas left/right/top/bottom edges and the canvas horizontal/vertical center. Already partial — single-element guides hit canvas centers. Extend to multi-element drag. | Guide lines extending across the entire canvas. | **TS** | LOW (extension of existing) | Figma + Canva universal |
| C19 | Snap threshold (px) | Figma uses ~**8px viewport threshold** (community-reported, not officially documented). Canva similar. Hold Cmd/Ctrl to disable snap. | None (threshold is invisible). | **TS** | LOW — already wired in single-element snap; reuse the constant. | [Figma forum — Hold Ctrl to disable snapping (LAUNCHED)](https://forum.figma.com/archive-21/launched-hold-ctrl-to-temporarily-disable-all-snapping-24942); [Canva — Cmd to disable snap](https://www.storylane.io/tutorials/how-to-turn-off-snapping-in-canva) |
| C21 | Hold Cmd/Ctrl to disable snap | While dragging, hold Cmd/Ctrl → snapping turns off temporarily; release → snapping resumes. | Guides disappear while held. | **TS** | LOW | [Figma — Hold Ctrl to disable snapping](https://forum.figma.com/archive-21/launched-hold-ctrl-to-temporarily-disable-all-snapping-24942); [Canva — Cmd to disable snap](https://www.magicslides.app/blog/how-to-change-snap-options-on-canva) |
| D24 | Group (Cmd+G) | Cmd+G with multi-selection → wraps selected elements in a group. Group is a single selectable unit. **Figma**: Cmd+G makes a Group; Cmd+Alt+G makes a Frame (different concept — see D29). **Canva**: Cmd+G is the only group concept. **Keynote**: Cmd+Opt+G. | Group bounding box (single ring around all members) on selection. | **TS** | **HIGH** — schema change. See ARCHITECTURE.md for the schema-extension proposal. Need: (a) `group_id?: string` on every element (TextBox + CustomImage) so any element can claim membership; OR (b) flat `groups: Group[]` array per slide referencing element IDs. Latter is closer to Figma's tree but heavier; former is closer to "tag-based grouping" and minimally invasive. | [Figma — Group keyboard shortcut Cmd+G](https://www.figma.com/best-practices/groups-versus-frames/); [Canva — Group Cmd+G](https://www.canva.com/help/layer-group-align/) |
| D25 | Ungroup (Cmd+Shift+G) | Cmd+Shift+G → dissolves group, **preserves children's absolute on-canvas positions**. Children become independently selectable again. | Group ring dissolves to per-element rings. | **TS** | MED (math: derive each child's absolute pos from group + relative; write back as flat element pos). | [Figma — Ungroup](https://www.figma.com/best-practices/groups-versus-frames/); [Canva — Ungroup Cmd+Shift+G](https://www.canva.com/help/layer-group-align/) |
| D27 | Enter group (double-click) | Double-click on a group → "enters" the group. Subsequent clicks select children directly without re-clicking through the group. **Figma**: double-click = one level deeper; can also use Enter key. **Canva**: double-click = enter group. | Group ring becomes a "you are inside" border (subtle). Selected child gets its own ring. | **TS** | MED — selection state needs an `enteredGroupId` slot. | [Figma — double-click select inside group](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects); [Canva — double-click to edit inside group](https://www.canva.com/help/layer-group-align/) |
| D28 | Exit group (Esc / click outside) | Esc → exit one level up. Click outside group on canvas → exit. **Figma uses both**. | "Inside" border disappears. | **TS** | LOW (paired with D27) | [Figma forum — Esc to back out](https://forum.figma.com/suggest-a-feature-11/esc-key-to-back-out-1-level-35091) |
| E32 | Bring to front / send to back | **Cmd+Alt+]** (front) / **Cmd+Alt+[** (back). Reorders within slide's element stack. | Element jumps to top/bottom of z-order. | **TS** | LOW — existing slide schema renders elements in array order; this is a reorder. | [Figma — z-order shortcuts](https://forum.figma.com/ask-the-community-7/changing-bring-forward-bring-to-front-hotkeys-47717); [Canva — Cmd+Opt+] / Cmd+Opt+[](https://justclickhere.co.uk/wp-content/uploads/2020/01/Canva-shortcuts-table-watermarked-1.pdf) |
| E33 | Bring forward / send backward (one step) | **Cmd+]** / **Cmd+[**. Same as E32 but one step. | One-step swap with neighbor. | **TS** | LOW (paired with E32) | Same as E32 |
| E34 | Z-order keyboard shortcuts | Mac: Cmd+] / Cmd+[ / Cmd+Alt+] / Cmd+Alt+[. Windows: Ctrl-equivalents. | — | **TS** | LOW | Same as E32 |
| F36 | Arrow = small nudge | Arrow keys → 1px nudge of selected element(s). Acts on multi-selection as a unit. | Selection ring + each element shift by 1px in arrow direction. | **TS** | LOW — extension of single-element drag. | [Figma — Set small and big nudge values](https://help.figma.com/hc/en-us/articles/4404575206295-Set-small-and-big-nudge-values); [Canva — 1px nudge](https://justclickhere.co.uk/wp-content/uploads/2020/01/Canva-shortcuts-table-watermarked-1.pdf) |
| F37 | Shift+Arrow = big nudge | Shift+Arrow → **10px** (Figma/Canva default; Figma is configurable). | Same as F36 ×10. | **TS** | LOW (paired with F36) | [Figma — small=1, big=10 default](https://help.figma.com/hc/en-us/articles/4404575206295-Set-small-and-big-nudge-values); [Canva — Shift+Arrow = 10px](https://justclickhere.co.uk/wp-content/uploads/2020/01/Canva-shortcuts-table-watermarked-1.pdf) |
| F40 | Hold Shift while dragging = constrain to axis | While dragging, hold Shift → movement constrained to dominant axis (horizontal OR vertical, whichever the cursor moved more in). | Element follows axis-locked cursor. | **TS** | LOW — pointer-event hook reads `e.shiftKey`. | Universal across Figma, Canva, Keynote, Photoshop |

### Differentiators (Strong Consider for v2.11)

Not strictly required to feel "finished" but every surveyed tool ships them. Including 1–2 of these makes the editor feel polished.

| # | Feature | Pattern | Visual feedback | Class | Complexity | Source |
|---|---------|---------|-----------------|-------|------------|--------|
| C20 | Equal-spacing guide ("==" indicator when 3+ elements have equal gaps) | Figma's pink "==" markers between elements during drag, indicating the selection now matches the inferred grid spacing of nearby elements. | Pink double-equals icons between adjacent elements. | **DIFF** — high polish, but adds rendering complexity. Recommend YES for v2.11 once basic snap C17/C18 ships. | MED | [Figma — smart guides equal spacing](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) |
| C22 | Object-to-object distance hint (red number) | When an element is selected and another is hovered (or during drag), Figma draws a red line + numeric distance between them. | Red line + "24" pixel-distance label. | **DIFF** — high engineering cost (live measurement during drag) for moderate user value in our domain. Recommend NO for v2.11. | HIGH | [Figma — measure distances](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers); [Figma forum — red distance numbers](https://forum.figma.com/t/red-auto-measurement-thingy/2929) |
| F39 | Alt+drag = duplicate | Hold Alt while dragging → duplicates element instead of moving. **Figma**: works mid-drag (start dragging → press Alt → ghost duplicate appears). | Original stays in place; ghost duplicate follows cursor. | **DIFF** — replaces 50% of Cmd+D usage with one gesture. Worth shipping. | MED — drag handler branches on `e.altKey`; need to dispatch ADD then move the new id. | [Figma — Alt+drag to duplicate](https://forum.figma.com/ask-the-community-7/holding-alt-key-when-mouse-drag-does-not-duplicate-selection-in-chrome-16007); [Figma — drag/duplicate behavior](https://medium.com/cva-design/stop-wasting-clicks-14-figma-shortcuts-thatll-save-you-hours-2031f0d038ac) |
| G41 | Cmd+D duplicate (smart offset) | Cmd+D duplicates currently-selected element(s). **Figma's "smart offset"**: if the user moved the previous duplicate by (Δx, Δy), the next Cmd+D applies the same offset — enabling rapid grid-by-keyboard. Without prior move, default offset is +20px / +20px (visible-but-not-centered). | New element appears, becomes selection. | **DIFF** — basic Cmd+D is TS-adjacent (very common); smart offset is the differentiator. Ship basic; defer smart offset to v2.12+. | LOW (basic) / MED (smart offset) | [Figma — Cmd+D smart offset](https://forum.figma.com/t/when-pasting-or-duplicating-offset-the-new-elements-position-and-add-descriptor-like-copy-to-the-name/4227) |
| H45 | Lock element | Locked element can't be dragged, resized, or deleted, but **CAN still be selected and inspected** (Figma model). Canva = locked element can't be selected at all (stricter). Recommend Figma model — better UX. **Cmd+Shift+L** to toggle (Figma + Canva — Canva uses Alt+Shift+L). | Padlock icon overlaid on element; cursor stays pointer (not move) on hover. | **DIFF** — useful for power users; not table-stakes for first multi-element shipping. | MED — schema needs `locked?: boolean` on every element type. | [Figma — Lock layers](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers); [Canva — Lock Alt+Shift+L](https://justclickhere.co.uk/wp-content/uploads/2020/01/Canva-shortcuts-table-watermarked-1.pdf) |
| I48 | Layers panel (basic) | Tree (or flat) list of slide elements. Click → select. Drag → reorder z-order. | Inline list at right rail or left rail. | **DIFF** — would deeply benefit groups (D24) but our existing Layer Strip (v2.8 Phase 50) covers ~80% of single-slide cases. Recommend EXTEND Layer Strip with an expand-to-list disclosure rather than a new panel — preserves consistency. | MED-HIGH | [Figma — Rename layers](https://help.figma.com/hc/en-us/articles/360039958934-Rename-Layers); CANVAS-03 from PROJECT.md was deferred for the same reason. |
| J59 | Multi-select rotation | Rotate handle on union bounding box rotates all selected elements around the **selection's geometric center** (Figma default). | Curved rotation cursor at corners. | **DIFF/DEFER** — single-element rotation is itself deferred (ROTATE-01 in v2.10 deferral list). Block this on rotation shipping first. | DEFER | [Figma — multi rotation around center](https://wpdean.com/how-to-rotate-in-figma/) |
| F38 | Cmd+Arrow nudge variant | **Figma does NOT use Cmd+Arrow for nudging** — Cmd+Arrow is z-order in some shortcut maps and Cmd+Alt+Arrow rotates. Verified inconsistent across Figma versions. | — | **DIFF** — skip for v2.11. Industry hasn't settled. | — | [Figma forum — Cmd+Alt+Arrow rotation conflict](https://forum.figma.com/report-a-problem-6/problem-bring-forward-shortrcut-cmd-alt-up-down-rotates-the-object-46254) |

### Anti-Features (Skip with Reason)

Features that seem expected but explicitly NOT shipping in v2.11.

| # | Feature | Why Requested | Why Skip | Alternative | Source |
|---|---------|---------------|----------|-------------|--------|
| A8 | Tab cycle through elements | Power-user keyboard nav. Figma binds Tab to "select next sibling in parent." | **Tab is a global focus key** — overriding it on canvas conflicts with form-element focus elsewhere on the page (right rail, slide nav). Our editor has chrome around the canvas; hijacking Tab is hostile. Figma's canvas is full-screen so the tradeoff is different. | Existing ⌘1/⌘2/⌘3 already cover hook/body/first-custom. Layer Strip covers the rest. | [Figma forum — Tab to select next sibling](https://forum.figma.com/t/feature-request-tab-key-selects-next-sibling-when-multiple-frames-are-selected/26355) |
| A9 | Right-click context menu | "I want to right-click and align." | Custom right-click menus are a major UX project — accessibility, mobile parity, contextual variation. **Defer to v2.12+.** Toolbar buttons + keyboard shortcuts cover the entire alignment surface. | Toolbar exposes all align/distribute/group/order. Right-click can wait. | Universal; e.g. [Figma — Quick Actions](https://figtowp.com/how-to-use-actions-menu-in-figma-design/) |
| B15 | "Tidy Up" / smart layout auto-arrange | Figma's `Cmd+Shift+T`: auto-arranges selection into a clean row/column/grid based on detected layout. | Powerful but **only valuable when users are routinely arranging 6+ elements**. Our slides cap at ~3-4 text boxes + 1-2 custom images + 1 watermark. Distribute-evenly (B13/B14) covers the typical case. | Distribute H/V (B13/B14). | [Figma — Tidy up Cmd+Shift+T](https://forum.figma.com/t/help-distribute-horizontal-spacing-shortcut-not-working-bug/24136) |
| C18b | Snap to thirds / golden ratio | Some tools (Procreate) snap to rule-of-thirds for photo composition. | Off-pattern for design-tool ecosystem. Figma/Canva don't ship it. The user has IG 4:5 safe-zone overlay (v2.9 EDITOR-03) for composition aid — that's enough. | IG safe-zone overlay (existing). | — |
| D26 | Nested groups (group of groups) | Figma + Canva both support. | **Skip in v2.11 first cut**. Single-level groups cover 95% of carousel use cases. Nested = significant schema + selection + Tab navigation complexity. **Defer to v2.12+.** | Single-level groups only; ungroup must work cleanly so users can reorganize. | [Figma — Group of groups via Cmd+G again](https://www.figma.com/best-practices/groups-versus-frames/) |
| D29 | Frames vs Groups distinction | Figma's Frame (with constraints, layout grids, clipping) vs Group (just a selection union). Canva does NOT have this distinction. | Frame semantics presume constraints + layout grids — concepts our slide schema doesn't model. **Match Canva: only "Group" exists.** | "Group" = Figma Group semantics. | [Figma — Frames vs Groups](https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups) |
| D31 | Group rename in layers panel | Layers panel feature. | Without a full layers panel (I48 deferred), nothing to rename in. Group ID is opaque. | None — defer with I48. | — |
| G42 | Cmd+C / Cmd+V | Copy/paste elements. **Universal in design tools.** | **DEFERRED, NOT skipped — but not v2.11**: needs cross-slide paste rules, schema-merge logic for groups, security review (paste from external apps?). Cmd+D (duplicate) covers in-slide use case for v2.11. | Cmd+D for now. | [Figma — Cmd+C / Cmd+V paste positioning](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| G43 | Copy style / paste style (Cmd+Alt+C / Cmd+Alt+V) | Power-user feature. | Our style surface (font, color, effects) is small enough that the right rail covers it in 2 clicks. Implementing properly means defining "style" precisely (font? size? color? effects? all?) — that's a separate UX project. | Use right rail; defer to v2.12+. | [Figma — Copy/paste properties](https://help.figma.com/hc/en-us/articles/4412765442967-Copy-and-paste-properties-between-layers) |
| G44 | Copy as image / SVG | Figma exports selection as PNG/SVG via Cmd+Shift+C. | Off-pattern for our domain — output is the **whole slide**, not arbitrary selections. ZIP export already covers full-slide download. | Existing ZIP/PNG export. | [Figma — Export](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) |
| H46 | Visibility toggle (hide element) | Figma: Cmd+Shift+H per layer. | Hiding text boxes that the AI-generated is **off-pattern** for content-driven slides — users expect the text they see to be the text they ship. Adds confusion. Better UX: delete the element. (Hook/body have schema-protected delete already.) | Delete button (existing); for hook/body, edit text to empty string. | [Figma — Cmd+Shift+H toggle visibility](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers) |
| I50 | Layers panel search/filter | Search box in layers panel. | Cap is ~6-8 elements per slide. Search adds zero value at this scale. | None needed. | — |
| J57 | Multi-select across slides | Reasonable wish but breaks our model. | Slides are **independent render units** for parity with PNG export (TPLREND-05). Cross-slide selection breaks the "one slide = one render input" invariant. Hard NO. | Within-slide only. | Internal — TPLREND-05 invariant from PROJECT.md |
| J58 | Aspect-ratio-lock during multi-resize | Shift hold during corner-resize maintains AR. | Single-element corner resize (v2.10) is text-box-focused — corner = font scale. Multi-element corner-resize is a different gesture. **Don't ship multi-resize at all in v2.11** (too risky for AI-generated content; one wrong drag scales every text 50%). | Resize only one element at a time (existing). | [Figma — Shift to lock AR](https://forum.figma.com/share-your-feedback-26/aspect-ratio-no-longer-auto-locks-with-shift-key-37508) |

### Deferred to v2.12+ (Out of Scope)

Cleanly defined but explicitly out of scope for v2.11.

- **D26 nested groups** — start with single-level
- **D30 lock group as a unit** — paired with H45 (lock element); ship lock first if at all
- **G42 Cmd+C/V cross-slide paste** — needs design work
- **G43 Copy/paste style** — needs "what is style?" UX scoping
- **I48–I53 full layers panel** — Layer Strip extension covers single-slide; full tree is post-PMF
- **J59 multi-select rotation** — blocked on single-element rotation (ROTATE-01 deferred from v2.10)
- **A9 right-click context menu** — universal toolbar coverage in v2.11

---

## Feature Dependencies

```
[A2 Shift-click] ─┐
[A3 Cmd-click]   ─┤
[A4 Marquee]     ─┼──> SELECTION SET (Set<id> + bounding-box compute)
[A5 Cmd+A]       ─┘                │
                                    ├──> [B10–B14 Align/Distribute] (needs union bounds + per-element coords)
                                    ├──> [F36–F37 Multi-element nudge] (move every selected by Δ)
                                    ├──> [F40 Shift-axis-constrain drag] (extends single drag)
                                    ├──> [E32–E34 Z-order] (reorders selected — works on single OR multi)
                                    └──> [D24 Group] (creates a new group from selection set)
                                              │
                                              ├──> [D25 Ungroup] (inverse — needs group structure)
                                              ├──> [D27–D28 Enter/Exit group] (selection mode state)
                                              └──> [I48 Layers panel] (groups need somewhere to live in UI)

[C17 Multi-element snap] ──extends──> existing v1.3 single-element guides
[C18 Canvas snap]        ──extends──> existing single-element guides
[C19 Snap threshold]     ──reuses──>  same constant
[C21 Cmd-disable-snap]   ──extends──> single-element disable

[F39 Alt-drag duplicate] ──depends──> drag handler hook (existing)
                                       (does NOT depend on selection set)

[H45 Lock element] ──independent of selection but interacts with [A4 Marquee]
                                       (locked elements should be skipped in marquee, kept in Cmd+A — Figma rule)
```

### Dependency Notes

- **All alignment/distribute (B10–B14) require multi-select (A2/A4) first.** Sequencing the phases: ship A2/A3/A4/A5/A6/A7 first as the "Selection Foundation" phase, then B10–B14 ride on top.
- **Group (D24) requires the selection set already work end-to-end.** The reducer dispatch needs to consume an array of element IDs.
- **Snap engine (C17/C18) is technically independent** — could be shipped before multi-select if needed. But the highest-value deployment is "snap during multi-element drag," so phase it AFTER selection foundation.
- **Lock (H45) interacts subtly with marquee (A4)**: Figma rule = locked elements are skipped by marquee but DO get included in Cmd+A. Replicate.
- **Ungroup (D25) preserves child positions** — math: child's stored position is RELATIVE to the group's top-left (or absolute if we store absolute). Decision needed in ARCHITECTURE.md, but ungroup correctness depends on it.

---

## MVP Definition for v2.11

### Ship in v2.11 (Table Stakes)

Sequenced by dependency:

**Phase A — Selection Foundation**
- [ ] A2 Shift-click add/remove from selection
- [ ] A3 Cmd-click deep-select (nested elements through groups, when groups land)
- [ ] A4 Marquee drag-select (intersect mode, Figma default)
- [ ] A5 Cmd+A select all on current slide
- [ ] A6 Esc deselect (with group-exit semantics)
- [ ] A7 Click-empty-canvas deselect

**Phase B — Alignment & Distribution**
- [ ] B10 Align L / center-H / R (Alt+A / Alt+H / Alt+D)
- [ ] B11 Align T / center-V / B (Alt+W / Alt+V / Alt+S)
- [ ] B12 Implicit canvas-vs-selection (single = canvas, 2+ = selection)
- [ ] B13 Distribute horizontal (Cmd+Alt+H, requires 3+)
- [ ] B14 Distribute vertical (Cmd+Alt+V, requires 3+)

**Phase C — Multi-element snapping & guides**
- [ ] C17 Snap to other elements during multi-drag (extends single-element)
- [ ] C18 Snap to canvas edges + center
- [ ] C19 Snap threshold (reuse single-element constant)
- [ ] C21 Hold Cmd disables snap

**Phase D — Group / Ungroup (single level)**
- [ ] D24 Group (Cmd+G) — single-level only
- [ ] D25 Ungroup (Cmd+Shift+G) — preserves child absolute positions
- [ ] D27 Enter group (double-click)
- [ ] D28 Exit group (Esc / click outside)

**Phase E — Z-order**
- [ ] E32 Bring to front / send to back (Cmd+Alt+] / Cmd+Alt+[)
- [ ] E33 Bring forward / send backward (Cmd+] / Cmd+[)

**Phase F — Keyboard nudge**
- [ ] F36 Arrow = 1px nudge (multi-selection-aware)
- [ ] F37 Shift+Arrow = 10px nudge
- [ ] F40 Shift-hold during drag = constrain to dominant axis

### Strong Consider (Differentiators — pick 1–2)

In recommendation order:
1. **F39 Alt-drag duplicate** — high UX delight, MED complexity, replaces 50% of Cmd+D use
2. **C20 Equal-spacing "==" guide** — high polish payoff once C17 ships, MED complexity
3. **G41 Cmd+D smart offset** — power-user delight, MED complexity for the smart-offset half
4. **H45 Lock element** — useful for "lock background image while editing text," MED, schema impact

### Defer to v2.12+

- D26 nested groups
- D30 lock group as unit
- G42 Cmd+C/V cross-slide paste
- G43 Copy/paste style
- I48 full layers panel (extend Layer Strip first)
- J59 multi-select rotation (blocked on ROTATE-01)
- A9 right-click context menu

---

## "Maybe more" — features the user didn't name but EVERY surveyed tool ships

The user said "we don't want to act like we know what we're doing — research and replicate." Here are the features the survey surfaced as universal across Figma + Canva + Keynote + Adobe Express + Photoshop:

| Feature | All tools? | Class for v2.11 | Reason |
|---------|-----------|-----------------|--------|
| **Esc / click-outside to deselect** (A6, A7) | YES | TS — ship it | Already half-shipped (slide switch clears); extending costs nothing. |
| **Cmd+A select all (current slide scope)** (A5) | YES | TS — ship it | One-line addition. |
| **Z-order (Cmd+] / Cmd+[)** (E32–E34) | YES | TS — ship it | Universal expectation; medium-low cost. |
| **Arrow-key nudge with Shift big-nudge** (F36, F37) | YES | TS — ship it | Every tool. Trivial in pointer/keyboard handler. |
| **Hold-Shift-during-drag axis constrain** (F40) | YES | TS — ship it | Very low cost — read e.shiftKey in drag handler. |
| **Lock element** (H45) | YES | DIFF — strong consider | Power-user feature; not table-stakes for first multi-element shipping but every tool ships it. |
| **Hold-Cmd to disable snap** (C21) | YES | TS — ship it | Costs nothing once C17/C18 land. |

**Of these, the user's named features (multi-select, alignment, group/ungroup) imply ALL of A1–A7, B10–B14, D24/D25/D27/D28, F36/F37 must ship.** The "maybe more" extras worth adding:

- **E32–E34 z-order** — universally expected, low cost, big "feels finished" payoff
- **C17–C21 snapping during multi-element drag** — extends existing single-element guides, makes multi-element drag feel right
- **F40 Shift-axis-constrain** — universal, near-zero cost
- **F39 Alt-drag duplicate** — non-named but universally shipped; high delight

**Skip even though universal:**
- Tab cycle (A8) — conflicts with our chrome
- Right-click menu (A9) — UX project of its own
- Full layers panel (I48) — Layer Strip already covers single-slide use cases
- Visibility toggle (H46) — anti-pattern for AI-generated content domain

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Notes |
|---------|------------|---------------------|----------|-------|
| A2 Shift-click | HIGH | LOW-MED | P1 | Foundation for all multi-select |
| A4 Marquee | HIGH | MED | P1 | Foundation; needs hit-testing on all elements |
| A5 Cmd+A | MEDIUM | LOW | P1 | Trivial after A2/A4 land |
| A6 Esc deselect | HIGH | LOW | P1 | Half-shipped |
| A7 Click-empty deselect | HIGH | LOW | P1 | Universal expectation |
| B10/B11 Align (6-axis) | HIGH | MED | P1 | The user's named feature |
| B13/B14 Distribute | MEDIUM | MED | P1 | Named feature |
| C17/C18 Multi-snap | HIGH | MED | P1 | Multi-element drag without snap = bad UX |
| C19/C21 Snap threshold + Cmd-disable | MEDIUM | LOW | P1 | Reuse existing |
| D24/D25 Group/Ungroup | HIGH | HIGH | P1 | Named feature; schema-impact |
| D27/D28 Enter/Exit group | MEDIUM | MED | P1 | Group is unusable without these |
| E32–E34 Z-order | MEDIUM | LOW | P1 | Universal "finishing touch" |
| F36/F37 Nudge | HIGH | LOW | P1 | Universal |
| F40 Shift-axis-constrain | MEDIUM | LOW | P1 | Tiny cost |
| F39 Alt-drag duplicate | HIGH | MED | **P2** | Strong differentiator |
| C20 Equal-spacing == | MEDIUM | MED | **P2** | Polish |
| G41 Cmd+D basic | MEDIUM | LOW | **P2** | Trivial; smart-offset half = P3 |
| H45 Lock element | MEDIUM | MED | P3 | Power-user; defer if time tight |
| D26 Nested groups | LOW | HIGH | P3 (DEFER) | Single-level covers 95% |
| I48 Full layers panel | LOW (Layer Strip exists) | HIGH | P3 (DEFER) | Layer Strip covers cases |
| A8 Tab cycle | LOW | LOW | P3 (SKIP) | Conflicts with chrome |
| A9 Right-click menu | MEDIUM | HIGH | P3 (DEFER) | UX project |
| G42 Cmd+C/V | MEDIUM | HIGH | P3 (DEFER) | Cross-slide paste rules |
| J57 Cross-slide multi-select | — | — | P3 (HARD NO) | Breaks TPLREND-05 invariant |

---

## Edge Cases (Non-Trivial)

These are the gotchas v2.11 implementation MUST handle correctly, sourced from Figma forums + Canva help.

### J54 Multi-select containing locked element (when H45 ships)
- **Figma rule**: Drag of a multi-selection containing a locked element moves ALL elements (locked element drags too — selection wins). But marquee SKIPS locked elements (you can't accidentally pick them up).
- **Canva rule**: Locked elements can't be selected at all, so the issue doesn't arise.
- **Recommendation for v2.11**: If H45 lock ships, follow **Figma rule** — locked elements are skippable by marquee but draggable as part of an explicit selection. This is more useful for "lock the background, multi-edit text on top" workflows.
- **Source**: [Figma — locked layer selection](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers)

### J55 Group containing nested group (deferred but document for future)
- Figma: Cmd+G inside a group creates a sub-group. Cmd+Shift+G dissolves only the closest level.
- v2.11 ships single-level only — nesting attempts return early with no-op or merge. Document the chosen behavior in Architecture.

### J56 Selection survives slide switch?
- **Figma per-page**: NO — selection clears on page switch.
- **v2.11 rule (already shipped pattern)**: NO — `useEffect([selectedIndex])` clears `selectedTextBoxId`/`selectedCustomImageId` on slide change. Extend this to clear the multi-selection set. Verified in `slide-editor.tsx:267-278`.

### J57 Multi-select across slides
- **Hard NO** — breaks TPLREND-05 (each slide must render independently from its own slide object).
- Selection state lives in the editor component scoped to the active slide.

### J58 Aspect-ratio-lock during multi-resize
- **Don't ship multi-resize in v2.11.** Single-element corner-resize already exists (v2.10); union-bounding-box resize for multi-selection is a different feature with non-obvious semantics (does each element scale by same factor? font scales?).

### J59 Rotation handle on multi-select bounding box
- **Defer** — single-element rotation isn't shipped (ROTATE-01 deferred from v2.10).

### J60 Empty selection state behavior
- **Figma + Canva**: Right rail shows page/canvas-level properties (no element-specific UI).
- **v2.11**: Right rail should show `SlideSettings` (overlay/news layout/watermark — already extracted in v2.8 Phase 50). Already wired correctly when `selectedTextBoxId === null`.

### Marquee on already-selected-set
- **Figma**: Drag from inside a selected element MOVES the selection. Drag from canvas-empty starts a new marquee that REPLACES selection (unless Shift is held, which adds to selection).
- **v2.11**: Implement this exactly. Pointer-down on bare canvas + Shift = additive marquee; without Shift = clears prior selection then marquees.

### Distribute with N=2 (no-op vs error)
- **Figma**: Distribute is **disabled** in the toolbar with N=2 (button greyed). Keyboard shortcut is silently ignored.
- **v2.11**: Replicate — gate the keyboard shortcut on `selection.length >= 3`.

### Alignment with 1 element (canvas or selection?)
- **Figma**: 1 element → align to **parent (canvas/frame)**. So pressing Alt+A with 1 element selected aligns it to the canvas left edge.
- **v2.11**: Replicate — single-element alignment uses canvas bounds.

### Alignment with rotated elements
- **Figma**: Aligns the **rotated bounding box** (axis-aligned bounding rectangle of the rotated shape) to the alignment edge. The element keeps its rotation; only its rotated-bounding-box edge snaps.
- **v2.11**: Moot for now — rotation isn't shipped. When rotation lands, follow this rule.

### Cmd+G on a single element
- **Figma**: Wraps the single element in a group. Visually looks the same; programmatically the element is now a child of a group.
- **Canva**: No-op (you need 2+ to "group").
- **v2.11**: Recommend **no-op** (Canva model). Single-element groups are accidental complexity for our small-canvas domain.

### Ungroup with currently-active text-edit
- If a user double-clicks into a text box inside a group to edit, then hits Cmd+Shift+G — what happens?
- **Figma**: Text-edit mode wins (Cmd+Shift+G is consumed by the OS as ungroup but Figma protects against it during text-edit).
- **v2.11**: Replicate — keyboard handler must check `isEditingText` before processing group/ungroup shortcuts. Existing handler at `slide-editor.tsx:341-348` already gates on `isEditing` — extend the gate to cover the new shortcuts.

---

## Competitor Feature Matrix (named features only)

| Feature | Figma | Canva | Keynote | Adobe Express | Our v2.11 plan |
|---------|-------|-------|---------|---------------|----------------|
| Multi-select via Shift-click | YES | YES | YES | YES | YES |
| Marquee selection | YES (intersect default) | YES (intersect) | YES | YES | YES (intersect) |
| Cmd+A | YES | YES | YES | YES | YES (current-slide scope) |
| Align 6-axis | YES (Alt+W/A/S/D/H/V) | YES (Position dropdown) | YES (Format sidebar) | YES | YES (Figma shortcuts) |
| Distribute H/V | YES (Cmd+Alt+H/V) | YES (Space Evenly in Position) | YES | YES | YES (Figma shortcuts) |
| Smart guides during drag | YES (pink + red) | YES (pink) | YES | YES | YES (extend existing) |
| Hold Cmd to disable snap | YES | YES | YES | YES | YES |
| Group / Ungroup | YES (Cmd+G / Cmd+Shift+G) | YES (Cmd+G / Cmd+Shift+G) | YES (Cmd+Opt+G / Cmd+Opt+Shift+G) | YES | YES (Cmd+G / Cmd+Shift+G — Figma model) |
| Nested groups | YES | YES | YES | YES | **NO (single-level v2.11)** |
| Frame/Group distinction | YES | NO | NO | NO | **NO (Canva model — Group only)** |
| Z-order Cmd+] / Cmd+[ | YES | YES | YES | YES | YES |
| Bring to front Cmd+Alt+] | YES | YES | YES | YES | YES |
| Arrow nudge 1px / Shift+Arrow 10px | YES | YES | YES | YES | YES |
| Alt+drag duplicate | YES | NO (uses Cmd+D) | YES | YES | **DIFF — strong consider** |
| Cmd+D duplicate (smart offset) | YES (smart) | YES (basic) | YES (basic) | YES (basic) | Basic in v2.11; smart offset in v2.12+ |
| Lock element | YES | YES | YES | YES | DIFF — consider |
| Layers panel | YES (full tree) | YES (Position > Layers) | YES (Arrange) | YES | DEFER (Layer Strip exists) |
| Right-click context menu | YES | YES | YES | YES | DEFER |
| Tidy Up / smart layout | YES (Cmd+Shift+T) | YES (Alt+Shift+T) | NO | NO | NO |
| Equal-spacing == guide | YES | NO | NO | NO | DIFF — consider |

---

## Sources

### Figma (primary references — HIGH confidence)
- [Help: Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects) — marquee, Shift-click, Cmd+A
- [Help: Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) — Alt+A/W/S/D + canvas-vs-selection rule
- [Help: Lock and unlock layers](https://help.figma.com/hc/en-us/articles/360041596573-Lock-and-unlock-layers) — lock semantics
- [Help: Toggle visibility to hide layers](https://help.figma.com/hc/en-us/articles/360041112614-Toggle-visibility-to-hide-layers) — Cmd+Shift+H
- [Help: Set small and big nudge values](https://help.figma.com/hc/en-us/articles/4404575206295-Set-small-and-big-nudge-values) — 1px / 10px defaults
- [Help: Copy and paste objects](https://help.figma.com/hc/en-us/articles/4409078832791-Copy-and-paste-objects) — paste positioning
- [Help: Copy and paste properties between layers](https://help.figma.com/hc/en-us/articles/4412765442967-Copy-and-paste-properties-between-layers) — Cmd+Alt+C/V
- [Help: Rename Layers](https://help.figma.com/hc/en-us/articles/360039958934-Rename-Layers) — layers panel inline rename
- [Help: Measure distances between layers](https://help.figma.com/hc/en-us/articles/360039956974-Measure-distances-between-layers) — red distance line
- [Best Practices: Frames vs Groups](https://www.figma.com/best-practices/groups-versus-frames/) — semantic distinction
- [Help: Frames vs Groups (canonical)](https://help.figma.com/hc/en-us/articles/360039832054-The-difference-between-frames-and-groups)
- [Help: Scale layers while maintaining proportions](https://help.figma.com/hc/en-us/articles/360040451453-Scale-layers-while-maintaining-proportions) — Shift to AR-lock
- [Forum: Hold Ctrl to disable snapping (LAUNCHED)](https://forum.figma.com/archive-21/launched-hold-ctrl-to-temporarily-disable-all-snapping-24942)
- [Forum: Z-order shortcuts](https://forum.figma.com/ask-the-community-7/changing-bring-forward-bring-to-front-hotkeys-47717)
- [Forum: Marquee — intersect vs Sketch contain](https://forum.figma.com/t/need-a-drag-selection-that-selects-only-layers-totally-inside-the-marquee/30177)
- [Forum: Smart offset on Cmd+D](https://forum.figma.com/t/when-pasting-or-duplicating-offset-the-new-elements-position-and-add-descriptor-like-copy-to-the-name/4227)
- [Forum: Tab cycle siblings](https://forum.figma.com/t/feature-request-tab-key-selects-next-sibling-when-multiple-frames-are-selected/26355)
- [Forum: Esc back out one level](https://forum.figma.com/suggest-a-feature-11/esc-key-to-back-out-1-level-35091)
- [Forum: Distribute spacing shortcut bug](https://forum.figma.com/t/help-distribute-horizontal-spacing-shortcut-not-working-bug/24136) — confirms Cmd+Alt+H

### Canva (primary references — HIGH confidence)
- [Help: Group, layer, and align elements](https://www.canva.com/help/layer-group-align/) — Cmd+G, multi-select, lock
- [Canva keyboard shortcuts (Windows PDF)](https://justclickhere.co.uk/wp-content/uploads/2020/01/Canva-shortcuts-table-watermarked-1.pdf) — full shortcut table
- [Help center: shortcuts](https://www.canva.com/help/canva-keyboard-shortcuts/)
- [How to Space Evenly in Canva](https://hubdigitalcontent.com/tools/canva/how-to-space-evenly-in-canva/) — distribute
- [How to Turn Off Snapping in Canva (Cmd to disable)](https://www.storylane.io/tutorials/how-to-turn-off-snapping-in-canva)

### Keynote (Apple official — HIGH confidence)
- [Layer, group, and lock objects (Mac)](https://support.apple.com/guide/keynote/layer-group-and-lock-objects-tan003ee8980/mac)
- [Position and align objects](https://support.apple.com/guide/keynote/position-and-align-objects-tanb46504b79/mac)
- [Keyboard shortcuts](https://support.apple.com/guide/keynote/keyboard-shortcuts-tanfde4a3e6d/mac)

### Adobe Express + Photoshop + Illustrator (HIGH confidence)
- [Adobe Express: keyboard shortcuts](https://helpx.adobe.com/au/express/using/keyboard-shortcuts.html)
- [Adobe Express: Group/ungroup](https://helpx.adobe.com/express/web/organize-your-designs/arrange-layers-and-pages/group-ungroup-objects.html)
- [Photoshop: Align and distribute layers](https://helpx.adobe.com/photoshop/using/aligning-layers.html) — canvas/selection/key-layer toggle
- [Illustrator: Align and distribute objects](https://helpx.adobe.com/illustrator/desktop/manage-objects/arrange-objects/align-and-distribute-objects.html) — Align panel Shift+F7

### Cross-tool references (MEDIUM confidence — secondary sources)
- [UseTheKeyboard — Figma shortcut catalog](https://usethekeyboard.com/figma/)
- [Domestika — 110 essential Figma shortcuts](https://www.domestika.org/en/blog/9913-110-essential-figma-shortcuts-for-designers)
- [Figma Shortcuts site](https://www.figmashortcuts.com/)

### Internal references
- `.planning/PROJECT.md` — project context, existing v2.10 deferral list, TPLREND-05 invariant
- `src/lib/types/slide.ts` — current schema (TextBox, CustomImage, no element-id-set yet)
- `src/components/editor/slide-canvas.tsx` — current pointer entry point
- `src/components/editor/slide-editor.tsx:267-278` — slide-switch selection clear (extend for multi-select)
- `src/components/editor/slide-editor.tsx:341-393` — current keyboard shortcut wiring (⌘1/⌘2/⌘3, ⌘D, Delete) + skip-when-typing pattern to inherit

---

*Feature research for: v2.11 Full Editor Parity (TikTok carousel multi-element editor)*
*Researched: 2026-05-02*
*Author: gsd researcher (parallel run with STACK / ARCHITECTURE / PITFALLS)*

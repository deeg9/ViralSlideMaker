# v2.11 Full Editor Parity — PITFALLS

**Researched:** 2026-05-02
**Mode:** Pitfalls — common mistakes when adding multi-select / groups / alignment / smart-guides / layers panel to a React + react-rnd + Satori editor
**Overall confidence:** MEDIUM-HIGH (sources are real GitHub issues, official Figma/Canva help docs, fabric.js issue tracker, and confirmed web reports; some inferences from training data are flagged LOW)

**Carry-forward warnings (do NOT re-research; already-known from v2.9/v2.10):**
- CSS filters (`filter`, `backdrop-filter`, `mix-blend-mode`) silently break Satori PNG export — vercel/satori#573
- Variable fonts unsupported by Satori — vercel/satori#162, #712
- react-rnd dispatch on every onDrag/onResize tick pollutes undo history — must dispatch on `onDragStop` / `onResizeStop` only (already enforced at `slide-preview.tsx:996/1011/1106/1121/1225/1241/1410/1426`)
- `hook-fit` auto-shrink at slide-preview.tsx:313 conflicts with explicit font-size overrides — v2.10 routes through `style_overrides.{hook,body}_font_size`

---

## CATEGORY 1 — Multi-select state pitfalls

### 1.1 Stale ID references in selection set after element delete
- **Symptom:** User deletes a text box; selection still includes its id; next "align" or "delete" tries to operate on a non-existent element and either crashes or silently drops 1 of N.
- **Root cause:** `selectedIds` is a `Set<string>` decoupled from `slide.text_boxes / custom_texts / custom_images` arrays. Reducer mutates the arrays but does not prune the selection set in the same dispatch.
- **Prevention rule:** Every reducer action that REMOVES an element MUST also filter `selectedIds` in the same step (reducer-level cross-update). For v2.11, fold this into the existing `applyDualWrite` pattern at `editor-reducer.ts:22` — add `applySelectionPrune(slide, selectedIds)`. Mirror in `REMOVE_TEXT_BOX`, `REMOVE_CUSTOM_TEXT`, `REMOVE_CUSTOM_IMAGE`, `REMOVE_SLIDE`, `DUPLICATE_SLIDE` (id regen at lines 121-128 already changes ids).
- **Source:** Pattern matches the v2.8 BL-01 dual-write fix (live-preview reverted on save because reducer didn't atomically update both shapes — same class of bug). Internal reference: `editor-reducer.ts:7-21` BL-01 comment block.
- **Phase:** **Phase 60 — Multi-select state design**

### 1.2 Selection persisting across slide-switch
- **Symptom:** User multi-selects 3 elements on slide 2, switches to slide 3, the right-rail still shows the slide-2 ids; align/distribute then targets ghosts.
- **Root cause:** `selectedIds` lives at `SlideEditor` level (top-level `useState`); `selectedIndex` change does not clear it. Today's `selectedTextBoxId` in `useSlideEditor` already clears on slide change — multi-select state must inherit this contract.
- **Prevention rule:** Selection state MUST be slide-scoped or cleared in a `useEffect` keyed on `selectedIndex`. If keeping it slide-scoped, store as `Map<slideIndex, Set<id>>`. Recommended: clear on slide change to mirror Figma's per-page selection model.
- **Source:** Figma's selection model — selection state is tab/page-scoped per the [Figma layer-selection docs](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects).
- **Phase:** **Phase 60 — Multi-select state design**

### 1.3 "Primary" element confusion in right-rail (last-clicked vs first-clicked)
- **Symptom:** Multi-select 3 text boxes via marquee. Right-rail shows properties of "the one you clicked first" or "the highest in z-order" or "nothing at all" — three competing UX models, all defensible, all confusing if inconsistent.
- **Root cause:** No locked decision on what "primary" means.
- **Survey of leading tools:**
  - **Figma:** Last-clicked layer becomes the "primary"; the right rail shows mixed/multi-value indicators (per [Figma multi-edit docs](https://medium.com/@joeyabanks/everything-to-know-about-multi-editing-in-figma-edd58369fd20)). Multi-edit applies typed values to ALL selected.
  - **Canva:** Right rail collapses to a shared toolbar (font, color, align). No "primary" concept exposed to user.
  - **Sketch:** Inspector shows mixed values as `–`; selection bounds drive transforms; no primary.
  - **Adobe Illustrator:** Has explicit "key object" concept that you click again to set as the alignment anchor; this is documented as a UX gotcha (must set BEFORE opening Align panel — see [Illustrator UserVoice issue #39372850](https://illustrator.uservoice.com/forums/601447-illustrator-desktop-bugs/suggestions/39372850-distribute-spacing-field-is-disabled-if-you-set-a)).
- **Prevention rule:** Pick Canva's model — NO "primary" concept. The right-rail in multi-select shows a TYPE BAR (text-only ops, image-only ops, mixed ops) and applies edits to all. This avoids the Illustrator key-object UX trap entirely.
- **Source:** [Figma multi-edit forum thread](https://forum.figma.com/ask-the-community-7/multi-selection-doesn-t-work-anymore-ever-since-the-multi-edit-update-was-released-11042) (LOW confidence on exact "last clicked" mechanic — Figma doesn't formally document the last-vs-first rule; verified empirically by community), [Illustrator key-object bug](https://illustrator.uservoice.com/forums/601447-illustrator-desktop-bugs/suggestions/39372850-distribute-spacing-field-is-disabled-if-you-set-a).
- **Phase:** **Phase 60 — Multi-select state design** (decision); **Phase 65 — Right-rail multi-select UX**

### 1.4 Set vs Array mutation — React refs not updating because reducer didn't return a NEW Set
- **Symptom:** User Shift-clicks to add to selection; canvas shows the new element selected but right-rail doesn't update; or vice-versa.
- **Root cause:** `selectedIds` is a `Set`; `selectedIds.add(id); return state` mutates in place; React `===` ref check fails to detect change; downstream `useMemo`/`React.memo` consumers skip re-render.
- **Prevention rule:** ALWAYS construct a new Set: `return new Set([...prev, id])` or use `Set` reducer functions that produce new instances. Confirm via a test: `expect(next).not.toBe(prev)`. Same lesson as `editor-reducer.ts:148` style_overrides spread.
- **Source:** General React state-immutability rule — see [React docs on updating state](https://react.dev/learn/updating-objects-in-state). Same class of bug repeatedly seen in the existing `editor-reducer.ts` shape (always uses spread).
- **Phase:** **Phase 60 — Multi-select state design**

---

## CATEGORY 2 — Marquee selection pitfalls

### 2.1 Pointer-events going to elements instead of canvas root
- **Symptom:** User mouse-downs on canvas whitespace to start a marquee; the drag never starts because the click was captured by an absolutely-positioned text box wrapper sitting at z-index 0 over the entire canvas.
- **Root cause:** react-rnd places its `position: absolute` wrapper covering the box; if any prop blocks event bubbling or the wrapper has padding that extends past the visible glyphs, the marquee never receives `pointerdown`.
- **Prevention rule:** Marquee handler must attach to the `editable={true}` canvas-root `div` and use `e.target === e.currentTarget` to skip when click originated on a child. Also: `pointer-events: none` on selection rings and smart-guide overlays. Sibling pattern: `slide-preview.tsx` already uses click-on-wrapper for `onTextBoxSelect` — marquee MUST run on a STRICTLY OUTER wrapper that is below those handlers.
- **Source:** [react-rnd issue #609 — pointerEvents being triggered when dragging over iframe](https://github.com/bokuweb/react-rnd/issues/609) (same root cause, different surface). General guidance from [Pointer Events MDN](https://javascript.info/pointer-events).
- **Phase:** **Phase 61 — Marquee selection**

### 2.2 Marquee on top of locked elements — should still select?
- **Symptom:** User marquees the canvas; locked watermark IS or ISN'T included — three tools disagree.
- **Survey:**
  - **Figma:** Locked elements are EXCLUDED from marquee selection unless you explicitly target them. Click-to-select still works on them.
  - **Canva:** Locked elements are EXCLUDED from marquee.
  - **Photoshop:** Locked layers ARE selectable but not movable.
- **Prevention rule:** Pick Figma's model — locked elements are visually indicated but excluded from marquee. Reasoning: matches Canva, matches the dominant carousel-tool reference.
- **Source:** [Figma alignment docs](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) confirm locked elements participate in alignment math but lock prevents move; [Photoshop community thread](https://community.adobe.com/t5/photoshop-ecosystem-bugs/p-move-tool-auto-select-is-selecting-layers-in-hidden-or-locked-groups/idi-p/12251508) confirms Photoshop selects through locked groups (anti-pattern).
- **Phase:** **Phase 61 — Marquee selection** + **Phase 64 — Lock/hide**

### 2.3 Marquee rect normalization (drag bottom-right → top-left = negative width)
- **Symptom:** User drags the marquee from bottom-right corner up to top-left; nothing inside is selected because the rect has `width: -200, height: -150` and intersection check `x >= rect.x && x <= rect.x + rect.width` evaluates falsy.
- **Root cause:** Untreated negative dimensions in the rect.
- **Prevention rule:** Normalize before intersection: `const rect = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2-x1), h: Math.abs(y2-y1) }`. Centralize in a `normalizeRect()` helper. Add a unit test with all 4 drag directions.
- **Source:** Classic geometry bug; see general DOM bounding-rect guidance and [Aseprite marquee-grid bug discussion](https://community.aseprite.org/t/grid-and-rectangular-marquee-tool-bug/10718) (rectangle-tool edge-cases tracked in real shipped apps).
- **Phase:** **Phase 61 — Marquee selection**

### 2.4 touchstart vs pointerdown — react-rnd touch handlers swallowing marquee
- **Symptom:** On iPad/iPhone Safari, touch-drag on canvas whitespace either does nothing (event captured by react-rnd wrappers) or drags a random element instead of starting a marquee.
- **Root cause:** react-rnd attaches both touch and mouse listeners; on touch devices, event order is `touchstart → mousedown` and react-rnd's wrappers capture first. Documented in [react-rnd issue #58 — touch problems to resize elements](https://github.com/bokuweb/react-rnd/issues/58).
- **Prevention rule:** Use `pointerdown` (unified) on the canvas root, not `mousedown`. Stop propagation in react-rnd's bound `onMouseDown`/`onTouchStart` for ITEMS (already gated). For marquee start, check `e.target === e.currentTarget` (rule 2.1). Carry forward v2.10's iPhone Safari touch QA gate to v2.11 — A11Y-01 still deferred.
- **Source:** [react-rnd issue #58](https://github.com/bokuweb/react-rnd/issues/58); v2.10 audit (A11Y-01 still pending, MILESTONES.md:42).
- **Phase:** **Phase 61 — Marquee selection**

### 2.5 Marquee accidentally triggered while clicking on a deeply-nested child
- **Symptom:** User clicks on an SVG icon inside a custom_image overlay; marquee starts; user thinks the click did nothing.
- **Root cause:** Click handler doesn't check `e.target === e.currentTarget` strict equality — `target` is the deep child, `currentTarget` is the canvas, but the equality check at the canvas-root level is satisfied unless we explicitly stop propagation at element level.
- **Prevention rule:** EVERY interactive child must `stopPropagation()` on `pointerdown` to prevent marquee from initiating. Confirm in Storybook: marquee MUST NOT start when clicking inside ANY text box, image, watermark, smart-guide overlay.
- **Source:** Inferred from the slide-preview.tsx click-routing pattern lines 877-886 (selection ring conditionals). LOW confidence (general React DOM handling).
- **Phase:** **Phase 61 — Marquee selection**

---

## CATEGORY 3 — Group pitfalls (THE LANDMINE)

### 3.1 Group transform compounding — mutate children OR add a group transform?
- **Symptom:** User groups 3 elements with absolute positions, drags the group 100px right; on save, individual element positions are mutated 100px AND a group offset of 100px is also stored — children visually jump 200px.
- **Root cause:** Two competing mental models combined: (a) flat schema where group is just a logical wrapper and drag mutates each child, (b) tree schema where group has its own transform and children are relative. Combining both = double translation.
- **Prevention rule for v2.11:** **Pick FLAT schema.** No group transform on the saved model. Reasoning: TPLREND-05 — Satori's `render-slide-satori.tsx` walks `text_boxes / custom_images` arrays with absolute positions; introducing a group-transform layer would force a Satori-compatible group renderer (which Satori only partially supports, see vercel/satori on transforms), breaking the byte-identical contract.
- **Implementation:** Group is a UI-only construct. Schema gets `group_id?: string` on each element. Drag-on-group iterates children and applies the same delta to each child's `position.x/y` — saved as flat. UNGROUP just clears `group_id` field. Editor's group bounding-box is computed in the editor only.
- **Source:** [react-moveable groupable docs](https://github.com/daybrush/moveable/blob/master/packages/react-moveable/groupable.md) — explicit warning: "If the transform overlaps from the root element to the parent element, the distance it moves is not equal to the amount actually moved." This is the exact compounding hazard. [fabric.js issue #4163 — Grouping & Active Selection Position Bug](https://github.com/fabricjs/fabric.js/issues/4163) shows real-world bug from this pattern. [fabric.js issue #1798 — Ungrouping items changes the original position](https://github.com/fabricjs/fabric.js/issues/1798) shows the symmetric ungroup hazard.
- **Phase:** **Phase 62 — Group/Ungroup design** (schema decision); **Phase 67 — TPLREND-05 parity audit**

### 3.2 Ungroup losing positions because rotation/skew didn't compose
- **Symptom:** User rotates a group, then ungroups — children end up axis-aligned instead of preserving their visual rotated positions.
- **Root cause:** Group has rotation; children's rotation isn't multiplied through correctly on ungroup.
- **Prevention rule:** v2.11 explicitly DOES NOT support rotation (carried forward from v2.10 deferred ROTATE-01). Group rotation = out of scope. If user rotates a non-grouped element later (v3.0+), revisit this. For now: groups have NO rotation, NO skew, NO scale — only logical id binding.
- **Source:** [fabric.js issue #4392 — flipX-rotation interaction](https://github.com/fabricjs/fabric.js/issues/4392), [fabric.js #6315 — ungroupOnCanvas does not restore object state correctly](https://github.com/fabricjs/fabric.js/issues/6315), [fabric.js #1798 — Ungrouping items changes the original position](https://github.com/fabricjs/fabric.js/issues/1798).
- **Phase:** **Phase 62 — Group/Ungroup design**

### 3.3 Nested groups — Cmd+G inside a group
- **Symptom:** User has 3 elements grouped (group A); shift-clicks 2 of them and presses Cmd+G — does it (a) create a NEW group containing those 2 inside A, or (b) flatten — extract those 2 from A into a new group, or (c) wrap all 3 plus a new dimension?
- **Survey:** Figma supports nested groups (creates inner group inside the outer). Canva does not — it auto-flattens.
- **Prevention rule for v2.11:** **No nested groups in v2.11.** Pick Canva's flatten model. Reasoning: pre-PMF, nesting adds significant schema complexity (`group_id` becomes `group_path: string[]`); ungroup walk becomes recursive; layers panel needs tree rendering. Defer to v3.0+. If user Cmd+G's a subset already inside a group, the action is a no-op or "remove from existing group + form new group" — pick the latter to avoid silent failures.
- **Source:** Figma's nested-group docs ([layer-selection help](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects)); [react-moveable issue #947 — Group and Ungroup Custom Ables](https://github.com/daybrush/moveable/issues/947) (community asking for explicit grouping API — confirms libs don't ship this primitive turnkey).
- **Phase:** **Phase 62 — Group/Ungroup design**

### 3.4 Empty groups — Cmd+G with 0 selected
- **Symptom:** User presses Cmd+G with nothing selected; some implementations crash, some silently create an empty group node, some do nothing.
- **Prevention rule:** Cmd+G with `selectedIds.size === 0` MUST be a no-op (early return in handler). Cmd+G with size 1 — pick: NO-OP (Figma — single elements ARE already a group of 1) OR allow (Adobe — group-of-one is a structural wrapper). Recommend NO-OP for v2.11 to match Figma + simplicity.
- **Source:** Inferred from Figma/Canva behavior; LOW confidence on definitive doc.
- **Phase:** **Phase 62 — Group/Ungroup design**

### 3.5 Group containing locked + unlocked children — drag behavior?
- **Symptom:** User groups 3 elements where 1 is locked (e.g., watermark); drags the group; the locked one moves anyway.
- **Prevention rule:** Group drag MUST iterate children and skip those with `locked=true`. Visual: the group-bounding-box drag still works for the unlocked 2; the locked watermark stays put. Document this. If the group ends up "broken apart" visually, that's the user's signal that they have a locked child.
- **Source:** Inferred from Figma's lock-prevents-move behavior; [Sketch alignment docs](https://www.sketch.com/docs/designing/layer-basics/aligning-layers/) — locked layers can be alignment anchors but won't move. LOW confidence.
- **Phase:** **Phase 62 — Group/Ungroup design** + **Phase 64 — Lock/hide**

### 3.6 Schema migration trauma
- **Symptom:** v2.11 ships with `group_id?: string` field on text_boxes/custom_texts/custom_images; existing 53 projects have undefined group_id; all group operations must reconcile.
- **Root cause:** Adding nullable field across 3 element types = no migration needed BUT every group operation must handle undefined-as-no-group.
- **Prevention rule:** Match the v2.8 unification pattern — group_id defaults to undefined, treated as "ungrouped"; reducer never assumes presence. Add an adapter `getGroupBounds(elements: Element[], groupId: string)`. NO Supabase migration needed (additive nullable). Mirror v2.8 deferred-sunset reasoning.
- **Source:** v2.8 schema migration playbook (MILESTONES.md:104-127); v2.8 `text_boxes?:` field was additive nullable, no migration.
- **Phase:** **Phase 62 — Group/Ungroup design**

---

## CATEGORY 4 — Alignment / distribute pitfalls

### 4.1 Align with N=1 selected
- **Symptom:** User selects 1 element, clicks "Align Center"; Figma aligns to canvas; Canva does the same; some homegrown tools no-op.
- **Survey:**
  - Figma: With N=1, default is align-to-FRAME (parent canvas). [Figma alignment docs](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions) confirm.
  - Sketch: With N=1 outside a frame, alignment is DISABLED. [Sketch docs](https://www.sketch.com/docs/designing/layer-basics/aligning-layers/) confirm.
- **Prevention rule:** Pick Figma's model — N=1 aligns to canvas (1080×1920). Don't disable buttons; users find that infuriating.
- **Source:** [Figma alignment docs](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions); [Sketch alignment docs](https://www.sketch.com/docs/designing/layer-basics/aligning-layers/).
- **Phase:** **Phase 63 — Align/Distribute**

### 4.2 Distribute with N=2
- **Symptom:** User selects 2 elements, clicks "Distribute Horizontally"; expected: aligns to selection extents (essentially align-equal); some tools no-op.
- **Survey:**
  - Figma: distribute with N=2 is a no-op visually but doesn't error.
  - GIMP: distribute requires MINIMUM 3 selected (reported in [GIMP docs](https://docs.gimp.org/3.0/en/gimp-tool-align.html)).
- **Prevention rule:** Disable distribute buttons when N < 3 (matches GIMP, semantically clean — "distributing 2 things" is meaningless). Show tooltip: "Select 3+ elements to distribute."
- **Source:** [GIMP align docs](https://docs.gimp.org/3.0/en/gimp-tool-align.html) explicit.
- **Phase:** **Phase 63 — Align/Distribute**

### 4.3 Align-to-canvas vs align-to-selection — toggle UX confusion
- **Symptom:** User multi-selects 3 elements, clicks "Align Left" — expects them to all snap to the leftmost selected, not the canvas edge. Or vice-versa.
- **Survey:** Figma default: with N≥2 → align to selection bounds; with N=1 → align to parent. With explicit "Align to canvas" toggle in some flows. Canva: same default.
- **Prevention rule:** Align-to-SELECTION is default for N≥2; align-to-CANVAS for N=1. Add a small toggle (icon-button, "Align to: Canvas | Selection") in the alignment menu so power users can override. Default per common pattern; document in tooltip.
- **Source:** [Figma alignment docs](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions).
- **Phase:** **Phase 63 — Align/Distribute**

### 4.4 Floating-point creep — repeatedly aligning then nudging accumulates rounding errors
- **Symptom:** User aligns 3 boxes left, nudges them with arrow keys, aligns again — left edge values drift to e.g. 47.9999999999.
- **Root cause:** `Math.min(...edges)` + arithmetic over multiple rounds produces non-integer pixel values; on save the schema stores them; on next align the input is non-integer.
- **Prevention rule:** ROUND on dispatch — every alignment dispatch wraps positions in `Math.round()`. Schema is integer pixels; serializer enforces. Add a unit test: `align → nudge → align → values are integers`.
- **Source:** General floating-point hazard; reflects fabric.js position-restoration bugs ([issue #1798](https://github.com/fabricjs/fabric.js/issues/1798)).
- **Phase:** **Phase 63 — Align/Distribute**

### 4.5 Alignment after rotation — does "left" mean bounding-box-left or pre-rotation-left?
- **Symptom:** Element rotated 30°; user clicks "Align Left" — expects bounding-box left (post-rotation) but gets pre-rotation left.
- **Prevention rule:** v2.11 has NO rotation (carry-forward from v2.10). Skip this pitfall for now. If rotation lands in v3.0+, MUST use bounding-box-left (matches Figma/Sketch).
- **Source:** Inferred; deferred per v2.10 ROTATE-01 deferral.
- **Phase:** Defer to v3.0+ rotation milestone

### 4.6 Distribute by edges vs by gaps vs by centers
- **Symptom:** User clicks "Distribute Horizontally" — three valid math operations (equal-edge-spacing, equal-gap, equal-center) yield different results. User expects one but gets another.
- **Survey:** Figma default = equal SPACING between elements (gap-based). Illustrator default = equal CENTERS. Sketch = equal SPACING.
- **Prevention rule:** Pick equal SPACING (gap-based) — matches Figma + Sketch + Canva. Don't expose the three-mode toggle in v2.11 (Adobe pattern is the noisier UX).
- **Source:** [Sketch align docs](https://www.sketch.com/docs/designing/layer-basics/aligning-layers/), [Figma align docs](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions).
- **Phase:** **Phase 63 — Align/Distribute**

### 4.7 Locked elements participate in alignment math?
- **Symptom:** User multi-selects [unlocked text, locked watermark, unlocked image]; aligns left. Watermark moves (bug) or watermark anchors the alignment (correct).
- **Prevention rule:** Locked elements participate in selection BOUNDS computation but DO NOT MOVE. So aligning to "selection-left" includes the watermark in the bounds calc; the watermark stays put; the others align to the resulting left edge. Matches Sketch + Photoshop.
- **Source:** [Sketch alignment docs](https://www.sketch.com/docs/designing/layer-basics/aligning-layers/) explicit; [Photoshop locked-layer thread](https://community.adobe.com/t5/photoshop-ecosystem-bugs/p-move-tool-auto-select-is-selecting-layers-in-hidden-or-locked-groups/idi-p/12251508).
- **Phase:** **Phase 63 — Align/Distribute** + **Phase 64 — Lock/hide**

---

## CATEGORY 5 — Smart-guides / snapping pitfalls

### 5.1 Frame-rate collapse from O(N²) edge comparisons
- **Symptom:** With 50+ elements on a slide, drag becomes laggy (each pointer-move computes 50×50×6 edge-pair comparisons).
- **Root cause:** `useAlignmentGuides.calculateSnap` at `src/hooks/use-alignment-guides.ts:67` builds `xSources/ySources` from ALL `others`. Today this scales with elements per slide.
- **Prevention rule:** v2.11 element count per slide is realistically ≤20 (text_boxes ≤3, custom_texts ≤5, custom_images ≤5, watermarks ≤2, decorative overlays ≤5). 20² × 6 = 2,400 comparisons/frame is fine. BUT for safety: (a) pre-compute `xSources/ySources` outside the pointer-move callback (do it on drag-START); (b) only re-compute when others array changes; (c) cap at 100 elements with an early return.
- **Source:** Existing code at `src/hooks/use-alignment-guides.ts:81-94` already does it inline-per-call; current N is small so it works, but a 100-element threshold guard is cheap insurance.
- **Phase:** **Phase 66 — Smart-guides + snapping**

### 5.2 Guide flicker from threshold hysteresis
- **Symptom:** Element snaps to a guide; user moves mouse 1 pixel; guide disappears; user moves another pixel; guide re-appears. Visual flicker.
- **Root cause:** Symmetric threshold — `delta <= 10px` to enter snap, AND `delta <= 10px` to remain snapped. As the mouse drifts at exactly 10px boundary, snap toggles every frame.
- **Prevention rule:** Asymmetric thresholds — enter snap at `delta <= 10px`, exit at `delta > 14px` (deadband). Add a state ref `wasSnappedToGuide: number | null`. The current implementation at `src/hooks/use-alignment-guides.ts:5` uses single `SNAP_THRESHOLD = 10` — needs upgrade.
- **Source:** General hysteresis pattern; standard for snap-to-grid systems. LOW confidence (no specific documented Figma/Canva spec).
- **Phase:** **Phase 66 — Smart-guides + snapping**

### 5.3 Guide rendering inside a CSS transform parent — coordinates wrong
- **Symptom:** Slide preview is `transform: scale(0.4)` (zoomed-out preview). Smart guides render at the WRONG screen position because guide overlay is a child of the scaled wrapper but uses absolute pixel coordinates.
- **Root cause:** Guide overlay coordinates are in REFERENCE pixels (1080×1920) but rendered into a scaled container; CSS transforms compound.
- **Prevention rule:** Guide overlay MUST live INSIDE the scaled container so it scales with everything else. Today's `slide-preview.tsx` is the scaled container; guides should render as siblings of text-boxes inside that. Confirm by visually testing at 0.4× zoom (production scale) AND 1.0× zoom.
- **Source:** Inferred from existing slide-preview.tsx coordinate system (CANVAS = 1080×1920 ref pixels).
- **Phase:** **Phase 66 — Smart-guides + snapping** + **Phase 67 — TPLREND-05 parity audit**

### 5.4 Guides showing during single-element drag vs multi-element ops
- **Survey:** Figma shows guides ALWAYS during drag (1 or N elements). Canva shows guides ALWAYS.
- **Prevention rule:** Show guides for both single AND multi drag — matches Figma + Canva. Implementation: same `useAlignmentGuides` hook; multi-drag uses the bounding-box of the multi-selection as the "dragging" element edges.
- **Source:** [Canva snapping help](https://www.canva.com/en_in/help/canva-lagging-slow/) (general behavior), [Figma snap forum thread](https://forum.figma.com/t/snapping-to-guides-not-working/5112).
- **Phase:** **Phase 66 — Smart-guides + snapping**

### 5.5 Hold-Cmd-to-disable: missed key-up event leaves snap permanently disabled
- **Symptom:** User holds Cmd while dragging to bypass snap; switches tab while still holding; `keyup` event never fires; snap is now permanently off until user presses+releases Cmd again.
- **Root cause:** `keydown`/`keyup` are sticky to the focused window. `blur`/`visibilitychange` events should also clear modifier state.
- **Prevention rule:** On `window.blur` or `document.visibilitychange`, reset all modifier-key tracking state to `false`. Pattern: `useEffect(() => { const reset = () => setModifiers({}); window.addEventListener('blur', reset); document.addEventListener('visibilitychange', reset); return cleanup; }, [])`.
- **Source:** General browser-event hazard; well-documented in modifier-tracking SO threads. LOW confidence on definitive single source.
- **Phase:** **Phase 66 — Smart-guides + snapping** + **Phase 68 — Keyboard handling**

---

## CATEGORY 6 — Z-order pitfalls

### 6.1 Using `z-index` CSS for editor preview but array-order for Satori — drift
- **Symptom:** Editor shows watermark above body text; exported PNG shows body text above watermark.
- **Root cause:** Editor uses CSS `z-index` to override DOM order; Satori (the [vercel/satori library](https://github.com/vercel/satori)) ignores `z-index` per its limited CSS support docs; Satori draws in array-order.
- **Prevention rule:** **Z-order MUST be array-order, not CSS z-index.** Bring-forward = swap with `array[i+1]`. Render engines (both editor preview AND Satori) iterate the array in order. NEVER set `z-index` on element wrappers in the editable `slide-preview.tsx`. This is identical to TPLREND-05's existing parity contract — `resolve-overlay.ts` resolves overlay layers in a fixed order documented at lines 17-28.
- **Source:** [vercel/satori issue #41 — Throw an error when CSS property not supported](https://github.com/vercel/satori/issues/41) confirms Satori's limited CSS subset.
- **Phase:** **Phase 67 — TPLREND-05 parity audit** + **Phase 69 — Z-order controls**

### 6.2 Bring-forward swapping with adjacent index — different element type
- **Symptom:** User clicks "Bring Forward" on a text box; the next element is a custom_image — does the text move ABOVE that image, or are they in different arrays and the operation is a no-op?
- **Root cause:** Today, `text_boxes`, `custom_texts`, `custom_images` are SEPARATE arrays in the schema. Z-order is implicit in render order: image-tint → bottom-card → grain → vignette → hook → body → custom_images → watermarks (per `resolve-overlay.ts:17-28`). Within a single array, swap is fine; ACROSS arrays, no-op makes the user feel the button is broken.
- **Prevention rule:** v2.11 z-order operates WITHIN each array independently. Document in tooltip ("Reorder within text/images/etc"). For cross-array reorder, defer to v3.0+ or introduce a unified `slide.elements: Element[]` array (a v3.0+ schema rewrite — out of scope for v2.11). Layers panel will visually show the categorical separation.
- **Source:** Existing schema at `editor-reducer.ts` ADD_TEXT_BOX, ADD_CUSTOM_IMAGE — separate arrays. Confirmed by `resolve-overlay.ts:17-28` layer-order contract.
- **Phase:** **Phase 69 — Z-order controls**

### 6.3 Z-order operating on a multi-selection
- **Symptom:** User multi-selects 3 elements at indices [2, 5, 7] in `text_boxes`; clicks "Bring Forward"; expectation 1: each moves +1 individually → [3, 6, 8]; expectation 2: the group moves as a unit → all stay relative.
- **Survey:** Figma: each moves +1 individually but boundary-clamped — if [5, 6, 7] are selected, "bring forward" only moves the topmost.
- **Prevention rule:** Pick Figma's model — iterate selection, apply +1 to each, clamp at array length. Add a unit test: `[2, 5, 7] → bring-forward → [3, 6, 8]`; `[5, 6, 7] of len 8 → bring-forward → [5, 6, 7]` (no-op, already at top relative to itself).
- **Source:** Inferred from Figma's z-order behavior; LOW confidence on definitive doc.
- **Phase:** **Phase 69 — Z-order controls**

---

## CATEGORY 7 — Layers panel pitfalls

### 7.1 Drag-reorder triggering re-render of ENTIRE slide preview
- **Symptom:** User drags a layer in the layers panel; the slide preview also re-renders 60 times during the drag; perf collapses.
- **Root cause:** Layers panel and slide preview consume the same `slides` state; any state update fires both.
- **Prevention rule:** Use ONE layer-reorder dispatch on `dragEnd` only (NOT during drag). This mirrors react-rnd's `onDragStop` pattern already enforced in v2.10 (carry-forward rule). During the drag, the layers panel uses LOCAL `useState` to show the visual reorder; only on drop does it dispatch to the reducer.
- **Source:** [react-beautiful-dnd 60fps optimization](https://medium.com/@alexandereardon/dragging-react-performance-forward-688b30d40a33), v2.10 onDragStop contract from MILESTONES.md.
- **Phase:** **Phase 70 — Layers panel**

### 7.2 Selection sync — infinite loop if both dispatch on selection-change
- **Symptom:** Click an element in canvas → fires `setSelectedIds(['x'])` → layers panel `useEffect` sees change → dispatches `scroll into view` → triggers a `focus` event on the layer chip → fires another `setSelectedIds(['x'])` → infinite loop.
- **Root cause:** Two-way binding without source-of-truth.
- **Prevention rule:** Layer panel READS selection state, NEVER writes (except on direct user click on the panel). Canvas READS selection state, NEVER writes (except on direct user click on canvas). Both use the same reducer dispatch with action types `SELECT_FROM_CANVAS` / `SELECT_FROM_PANEL` — reducer can disambiguate to suppress feedback.
- **Source:** General React anti-pattern; widely documented (e.g. [React useState pattern](https://react.dev/reference/react/useState)). LOW confidence on a single canonical source.
- **Phase:** **Phase 70 — Layers panel**

### 7.3 Inline rename collision with keyboard shortcuts
- **Symptom:** User clicks a layer in panel to rename; types "Hook 1"; presses Backspace; the entire layer is DELETED because the global `Delete`-key handler fires (`slide-editor.tsx:373`).
- **Root cause:** The Delete-key handler in `slide-editor.tsx:340-393` already has `isEditing` guard checking `tag === 'input' || textarea || isContentEditable`. v2.11 layers panel must use one of these tag types, NOT a `<div>` with `onKeyDown`.
- **Prevention rule:** Inline-rename input in layers panel MUST use `<input>` or `contentEditable` element so existing isEditing-guard at `slide-editor.tsx:344-348` skips the handler. Add a unit test that verifies typing in rename input does NOT dispatch DELETE.
- **Source:** Existing code `slide-editor.tsx:340-393`. Existing pattern is correct; just enforce that v2.11 follows it.
- **Phase:** **Phase 70 — Layers panel** + **Phase 68 — Keyboard handling**

### 7.4 Virtualization vs not — Figma virtualizes; what's our threshold?
- **Symptom:** 100+ layer chips render every selection change → laggy.
- **Prevention rule:** v2.11 max realistic layer count per slide is ≤20 (table-stakes carousel). Don't virtualize. Add a guard: if a slide ever exceeds 50 elements, log a warning. If we ever ship a per-PROJECT layers panel showing all elements across all slides (50 slides × 20 elements = 1,000 chips), virtualize then.
- **Source:** [react-window perf guide](https://blogs.purecode.ai/blogs/react-window) confirms virtualization breakeven ~100-300 items.
- **Phase:** **Phase 70 — Layers panel**

---

## CATEGORY 8 — Lock / hide pitfalls

### 8.1 Lock should prevent SELECTION? (Figma yes; Photoshop no)
- **Survey:**
  - Figma: Locked elements CAN be clicked-to-select but cannot be moved/edited.
  - Photoshop: Locked elements CAN be selected; lock affects specific operations (move, transparency, position) per the lock type.
  - Canva: Same as Figma.
- **Prevention rule for v2.11:** Pick Figma's model — locked element is selectable (so user can unlock it), but resize/drag/delete/edit are blocked. Marquee skips locked (per rule 2.2). Layers panel chip shows lock icon; click on chip selects but doesn't allow drag.
- **Source:** [Figma alignment docs](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions), [Photoshop locked-layer thread](https://community.adobe.com/t5/photoshop-ecosystem-bugs/p-move-tool-auto-select-is-selecting-layers-in-hidden-or-locked-groups/idi-p/12251508).
- **Phase:** **Phase 64 — Lock/hide**

### 8.2 Hidden element still affecting alignment math?
- **Survey:**
  - Figma: hidden elements are EXCLUDED from selection bounds.
  - Sketch: same.
- **Prevention rule:** Hidden = excluded from alignment bounds, excluded from rendering. Today's render path doesn't have hidden support; Satori output must skip elements with `hidden: true`. Add this to `render-slide-satori.tsx` as a pre-filter. Editor preview ALSO skips them (with a "hidden" placeholder in layers panel).
- **Source:** [Figma alignment docs](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions); [Sketch align docs](https://www.sketch.com/docs/designing/layer-basics/aligning-layers/).
- **Phase:** **Phase 64 — Lock/hide** + **Phase 67 — TPLREND-05 parity audit**

### 8.3 Persisting lock through fork (Explore copy-as-template)
- **Symptom:** User publishes a carousel with a locked watermark; another user forks it (`fork_published_carousel` RPC); on fork, is the lock preserved? Forker can't move the watermark = bad UX. Lock is dropped = original creator's intent lost.
- **Prevention rule:** **Drop lock on fork.** Forker takes ownership and can edit anything. This matches the v2.4 fork RPC's existing semantics — strips `brand_kit_id`, defaults to `bold-minimal` per MILESTONES.md:194. Adding lock-strip to that RPC is a one-line addition.
- **Source:** v2.4 fork RPC contract (MILESTONES.md:194-196). LOW confidence (no community precedent — this is product UX).
- **Phase:** **Phase 64 — Lock/hide**

### 8.4 Marquee can't escape locked elements stacked at top of z-order
- **Symptom:** Whole canvas covered by a locked decorative overlay at top of z-order; user marquee-selects under it; nothing happens because pointer-events are captured by the overlay div.
- **Prevention rule:** Locked elements set `pointer-events: none` on their wrapper (so marquee passes through). Click-to-select on a locked element STILL works because the editor's canvas root handler does intersection-test in JS, not via DOM bubbling. This requires moving from "click the wrapper" to "track pointerdown on canvas root + intersection test" for locked elements specifically.
- **Source:** Inferred from rule 2.1 + rule 8.1.
- **Phase:** **Phase 64 — Lock/hide** + **Phase 61 — Marquee selection**

---

## CATEGORY 9 — Keyboard handling pitfalls

### 9.1 Cmd+A inside text-edit input vs in canvas
- **Symptom:** User is editing text in a text box (input has focus); presses Cmd+A; expects "select all text" inside the input but gets "select all elements on canvas."
- **Root cause:** Global `keydown` handler intercepts Cmd+A regardless of focus.
- **Prevention rule:** Existing isEditing-guard at `slide-editor.tsx:344-348` handles this for `Delete`/`Cmd+1-3`/`Cmd+D`. Extend the same guard for `Cmd+A` (multi-select all) — when input/textarea/contentEditable is focused, browser default fires (select-all-text); when canvas is focused, our handler fires (select-all-elements).
- **Source:** Existing `slide-editor.tsx:340-393` pattern.
- **Phase:** **Phase 68 — Keyboard handling**

### 9.2 Arrow nudge while text input focused
- **Symptom:** User is editing text; presses arrow key; expected: cursor moves within text. Got: element nudges 1px in canvas.
- **Prevention rule:** Same isEditing guard as 9.1. Arrow keys for nudge: ONLY when canvas-root or layer-chip has focus.
- **Source:** Existing pattern at `slide-editor.tsx:340-393`.
- **Phase:** **Phase 68 — Keyboard handling**

### 9.3 Cmd+G conflicts with browser's "Find Next" (Chrome)
- **Symptom:** User presses Cmd+G to group; Chrome opens "find next" dialog or cycles to the next find match.
- **Root cause:** Cmd+G is Chrome's "Find Next" shortcut. Confirmed Figma issue. ([Figma forum thread on Cmd+G conflict](https://forum.figma.com/ask-the-community-7/how-can-i-resolve-keyboard-shortcut-conflicts-with-other-programs-25312)).
- **Prevention rule:** `e.preventDefault()` in the keydown handler — but ONLY when canvas/layers-panel is focused (otherwise we break Find-Next when user expects it). The existing `slide-editor.tsx:357/361` already follows this pattern. Cmd+Shift+G (ungroup) ALSO needs preventDefault.
- **Source:** [Figma keyboard shortcut conflict thread](https://forum.figma.com/ask-the-community-7/how-can-i-resolve-keyboard-shortcut-conflicts-with-other-programs-25312); confirmed Chrome behavior.
- **Phase:** **Phase 68 — Keyboard handling**

### 9.4 Hold-modifier sticky on tab-blur
- **Symptom:** Same as 5.5 — user holds Shift while marqueeing to add-to-selection; Cmd-Tabs away; comes back; modifier state stuck.
- **Prevention rule:** Same blur/visibilitychange listener as 5.5.
- **Source:** Same as 5.5.
- **Phase:** **Phase 68 — Keyboard handling**

---

## CATEGORY 10 — Render parity pitfalls (TPLREND-05 specific)

### 10.1 Group bounding box must NOT appear in Satori output
- **Symptom:** PNG export shows the editor's group selection rectangle as a real element.
- **Root cause:** If group bounding-box rendered in `slide-preview.tsx` shared component is unconditional, Satori's mirror at `render-slide-satori.tsx` will pick it up.
- **Prevention rule:** Group bounding box renders ONLY when `editable={true}` (already the gate for selection rings, dashed selection outline at line 877+). Add a single `if (!editable) return null` guard at the top of any new GroupBoundingBox component. Verify with the existing `parity.test.tsx` (10 cases — extend with group cases).
- **Source:** Existing `editable={true}` gate at `slide-preview.tsx:304`, `parity.test.tsx` invariant from v2.9 Phase 58.
- **Phase:** **Phase 67 — TPLREND-05 parity audit**

### 10.2 Selection rings, marquee rect, smart guides, layers-panel-induced ordering must NOT leak
- **Symptom:** PNG export shows the dashed `#3d0000` selection ring.
- **Prevention rule:** Already handled — selection ring uses CSS `outline` which Satori ignores per v2.8 Phase 52 design (MILESTONES.md:111). Extend the same pattern: marquee rect, smart guides, group box ALL use CSS that Satori-doesn't-render OR live behind `editable={true}` guards. Add a regression test that walks the rendered tree of `editable={false}` and asserts NO node with class `*selection*`, `*marquee*`, `*guide*`, `*layer-overlay*`.
- **Source:** v2.8 Phase 52 selection-ring design (MILESTONES.md:111); v2.9 Phase 58 `no-css-filter.test.ts` extended pattern (MILESTONES.md:66).
- **Phase:** **Phase 67 — TPLREND-05 parity audit**

### 10.3 Lock/hidden state — Satori respects `hidden=true` (skip) but ignores `locked` (editor-only)
- **Symptom:** Hidden element renders in PNG (bug); locked element doesn't render in PNG (different bug — locked should render).
- **Prevention rule:** `render-slide-satori.tsx` filter: `elements.filter(e => !e.hidden)`. NEVER filter on `locked`. Add a unit test: `slide with locked watermark renders identically to slide without lock`. Add a unit test: `slide with hidden element renders without that element`.
- **Source:** Inferred from rule 8.1 + 8.2.
- **Phase:** **Phase 67 — TPLREND-05 parity audit**

---

## CATEGORY 11 — Performance pitfalls

### 11.1 Multi-drag of N elements at 60Hz dispatching reducer on every frame
- **Symptom:** Multi-drag of 10 elements; reducer dispatches 600 times/second; undo history fills with 600 entries; lag.
- **Root cause:** Multi-drag fires N×60 dispatches/sec if onDrag is wired (instead of onDragStop).
- **Prevention rule:** **STRICT carry-forward of v2.10's onDragStop rule.** Multi-drag uses ONE local `useState({deltaX, deltaY})` during drag (no reducer); slide-preview reads delta + applies as visual offset; only on `onDragStop` does it dispatch a SINGLE batched action `MOVE_MULTI(slideIndex, ids, delta)`. Single undo entry per gesture.
- **Source:** v2.10 onDragStop pattern (MILESTONES.md:17 — "Single undo entry per gesture (dispatch on `onResizeStop` only)"). [react-beautiful-dnd 60fps perf](https://medium.com/@alexandereardon/dragging-react-performance-forward-688b30d40a33).
- **Phase:** **Phase 71 — Multi-drag perf**

### 11.2 Smart-guide overlay re-rendering on every mouse-move
- **Symptom:** Smart-guide DOM nodes re-create every pointer-move; layout thrashing.
- **Prevention rule:** Smart-guide overlay = single `<div>` per guide line, persistently mounted, position updated via `transform: translate3d(x, 0, 0)` (GPU-composited, no reflow). Use `pointer-events: none` so it doesn't block clicks. Render outside React's reconciliation if needed (refs + direct style set in a RAF callback).
- **Source:** [React 60fps perf guide](https://g3f4.github.io/react-at-60-fps/) — transform3d is the canonical pattern.
- **Phase:** **Phase 66 — Smart-guides + snapping**

### 11.3 Layers panel rendering full tree on every selection change
- **Symptom:** 20 layer chips re-render every selection click.
- **Prevention rule:** Wrap each `LayerChip` in `React.memo` with custom equality. Use `useMemo` for the chips array. Selection-state is read inside the chip via context or a per-id selector hook. NOT virtualization (too few elements).
- **Source:** [React.memo pattern](https://react.dev/reference/react/memo); v2.8 Phase 50 LayerStrip pattern (MILESTONES.md:109) — same concept extended.
- **Phase:** **Phase 70 — Layers panel**

---

## CATEGORY 12 — UX pitfalls (Figma/Canva post-mortems)

### 12.1 Canva's #1 complaint: "What took minutes now takes hours"
- **Pitfall:** Multi-step flows that USED to be one-click become click-click-click. E.g. "to align 3 elements I now have to: click each, open right rail, scroll to align, click."
- **Prevention rule:** Alignment toolbar surfaces in the canvas (floating mini-toolbar above multi-selection bounds), NOT buried in right rail. Matches Figma's floating-toolbar pattern.
- **Source:** [Canva October 2025 redesign complaints — substack post-mortem](https://soloshannon.substack.com/p/canva-is-broken-and-i-almost-lost), [Canva user threads](https://www.threads.com/@dmccullum/post/C7h_aVYPbXD).
- **Phase:** **Phase 65 — Right-rail multi-select UX**

### 12.2 Figma's #1 mobile complaint: shortcuts conflict with browser
- **Pitfall:** Cmd+G / Cmd+] / Cmd+/ all conflict with Chrome shortcuts; sometimes work, sometimes don't, depends on focus state.
- **Prevention rule:** Use `e.preventDefault()` in handlers AND show keyboard shortcut hints in tooltips so users know there's a shortcut. Add a `?` help overlay listing shortcuts (Figma pattern).
- **Source:** [Figma keyboard shortcut conflict thread](https://forum.figma.com/ask-the-community-7/how-can-i-resolve-keyboard-shortcut-conflicts-with-other-programs-25312), [Figma sidebar focus thread](https://forum.figma.com/archive-21/bug-investigating-some-keyboard-commands-no-longer-work-with-objects-in-layers-panel-chrome-25632).
- **Phase:** **Phase 68 — Keyboard handling**

### 12.3 Adobe's classic "key object" trap
- **Pitfall:** Adobe Illustrator requires you to set the key object BEFORE opening the Align panel; if you set it after, the distribute-spacing field is greyed out forever.
- **Prevention rule:** No "key object" / "primary" concept in v2.11 (per rule 1.3). Avoid this entire UX trap.
- **Source:** [Illustrator UserVoice issue #39372850](https://illustrator.uservoice.com/forums/601447-illustrator-desktop-bugs/suggestions/39372850-distribute-spacing-field-is-disabled-if-you-set-a).
- **Phase:** **Phase 60 — Multi-select state design**

---

## Phase Mapping Summary

| v2.11 Phase | Pitfalls addressed |
|---|---|
| **Phase 60 — Multi-select state design** | 1.1, 1.2, 1.3, 1.4, 12.3 |
| **Phase 61 — Marquee selection** | 2.1, 2.2, 2.3, 2.4, 2.5, 8.4 |
| **Phase 62 — Group/Ungroup design** | 3.1, 3.2, 3.3, 3.4, 3.5, 3.6 |
| **Phase 63 — Align/Distribute** | 4.1, 4.2, 4.3, 4.4, 4.6, 4.7 |
| **Phase 64 — Lock/hide** | 2.2, 3.5, 4.7, 8.1, 8.2, 8.3, 8.4 |
| **Phase 65 — Right-rail multi-select UX** | 1.3, 12.1 |
| **Phase 66 — Smart-guides + snapping** | 5.1, 5.2, 5.3, 5.4, 5.5, 11.2 |
| **Phase 67 — TPLREND-05 parity audit** | 3.1, 5.3, 6.1, 8.2, 10.1, 10.2, 10.3 |
| **Phase 68 — Keyboard handling** | 5.5, 7.3, 9.1, 9.2, 9.3, 9.4, 12.2 |
| **Phase 69 — Z-order controls** | 6.1, 6.2, 6.3 |
| **Phase 70 — Layers panel** | 7.1, 7.2, 7.3, 7.4, 11.3 |
| **Phase 71 — Multi-drag perf** | 11.1 |
| **Deferred to v3.0+** | 4.5 (rotation alignment) |

---

## Top "Watch Out For" (synthesizer should bubble these)

1. **Group transform compounding** (3.1) — pick FLAT schema; group is a UI-only `group_id` field. Most consequential decision in v2.11. Wrong choice = TPLREND-05 break + schema migration nightmare.
2. **TPLREND-05 leak** (10.1, 10.2, 10.3) — every editor-only feature (selection rings, marquee, smart guides, group box) must gate behind `editable={true}` and verify via parity tests. v2.10 already enforced this pattern; v2.11 must extend test coverage.
3. **Z-order MUST be array-order, not CSS z-index** (6.1) — Satori ignores z-index. Same lesson as v2.9's CSS-filter ban (vercel/satori#573).
4. **onDragStop strict carry-forward for multi-drag** (11.1) — single batched dispatch per gesture; matches v2.10's resize pattern.
5. **No "primary" element concept** (1.3, 12.3) — pick Canva's TYPE BAR model; avoids Illustrator key-object UX trap.
6. **No nested groups, no rotation in v2.11** (3.3, 3.2, 4.5) — defers complexity, keeps schema flat, matches Canva.
7. **isEditing guard at `slide-editor.tsx:344-348` is the keyboard-shortcut firewall** (7.3, 9.1, 9.2) — every new shortcut must respect it.
8. **Window-blur + visibilitychange resets modifier state** (5.5, 9.4) — prevents stuck-Cmd / stuck-Shift bugs.

---

## Open Questions for Roadmap Phase

1. **What max element count per slide are we designing for?** v2.11 perf guards depend on this. Recommend ≤30 per slide (3 text_boxes + 5 custom_texts + 5 custom_images + 2 watermarks + 5 decorative + headroom).
2. **Floating multi-select toolbar location** — above selection bounds (Figma) or fixed top of canvas (Canva)? Figma's is more discoverable for keyboard users; Canva's is simpler.
3. **Should "duplicate while dragging" (Alt+drag) be in scope?** Standard Figma feature, would slot under Phase 71. Out of mandatory scope but worth surfacing.

---

## Sources

- [vercel/satori issue #573 — filter blur doesn't work](https://github.com/vercel/satori/issues/573)
- [vercel/satori issue #41 — Throw error when CSS not supported](https://github.com/vercel/satori/issues/41)
- [vercel/satori issue #162](https://github.com/vercel/satori/issues/162) (variable fonts — carry-forward)
- [vercel/satori issue #712](https://github.com/vercel/satori/issues/712) (variable fonts — carry-forward)
- [react-rnd issue #58 — touch problems to resize elements](https://github.com/bokuweb/react-rnd/issues/58)
- [react-rnd issue #609 — pointerEvents triggered when dragging over iframe](https://github.com/bokuweb/react-rnd/issues/609)
- [react-rnd issue #724 — initial bounds](https://github.com/bokuweb/react-rnd/issues/724)
- [fabric.js issue #4163 — Grouping & Active Selection Position Bug](https://github.com/fabricjs/fabric.js/issues/4163)
- [fabric.js issue #6315 — ungroupOnCanvas does not restore object state](https://github.com/fabricjs/fabric.js/issues/6315)
- [fabric.js issue #1798 — Ungrouping items changes the original position](https://github.com/fabricjs/fabric.js/issues/1798)
- [fabric.js issue #4392 — flipX rotation interaction](https://github.com/fabricjs/fabric.js/issues/4392)
- [fabric.js issue #3830 — Possible Problem Ungrouping Objects](https://github.com/fabricjs/fabric.js/issues/3830)
- [fabric.js issue #3616 — Group rotation originX/originY](https://github.com/fabricjs/fabric.js/issues/3616)
- [react-moveable groupable handbook](https://github.com/daybrush/moveable/blob/master/packages/react-moveable/groupable.md)
- [react-moveable issue #947 — Group/Ungroup Custom Ables](https://github.com/daybrush/moveable/issues/947)
- [Figma Select layers and objects](https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects)
- [Figma Adjust alignment, rotation, position, and dimensions](https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-position-and-dimensions)
- [Figma multi-edit Medium article](https://medium.com/@joeyabanks/everything-to-know-about-multi-editing-in-figma-edd58369fd20)
- [Figma forum: Cmd+G keyboard conflict](https://forum.figma.com/ask-the-community-7/how-can-i-resolve-keyboard-shortcut-conflicts-with-other-programs-25312)
- [Figma forum: layers panel keyboard bug Chrome](https://forum.figma.com/archive-21/bug-investigating-some-keyboard-commands-no-longer-work-with-objects-in-layers-panel-chrome-25632)
- [Figma forum: Disable snap to smart guides](https://forum.figma.com/t/disable-snap-to-smart-guides/13000)
- [Sketch Aligning layers docs](https://www.sketch.com/docs/designing/layer-basics/aligning-layers/)
- [Photoshop locked-layer auto-select bug](https://community.adobe.com/t5/photoshop-ecosystem-bugs/p-move-tool-auto-select-is-selecting-layers-in-hidden-or-locked-groups/idi-p/12251508)
- [Illustrator UserVoice — Distribute Spacing field disabled if key object set before Align panel](https://illustrator.uservoice.com/forums/601447-illustrator-desktop-bugs/suggestions/39372850-distribute-spacing-field-is-disabled-if-you-set-a)
- [GIMP Align tool docs (3 minimum for distribute)](https://docs.gimp.org/3.0/en/gimp-tool-align.html)
- [Canva Oct 2025 substack post-mortem](https://soloshannon.substack.com/p/canva-is-broken-and-i-almost-lost)
- [Canva slowness Threads post](https://www.threads.com/@dmccullum/post/C7h_aVYPbXD)
- [react-beautiful-dnd 60fps optimization article](https://medium.com/@alexandereardon/dragging-react-performance-forward-688b30d40a33)
- [React at 60 FPS perf guide](https://g3f4.github.io/react-at-60-fps/)
- [react-window perf guide](https://blogs.purecode.ai/blogs/react-window)
- [Aseprite marquee-grid bug](https://community.aseprite.org/t/grid-and-rectangular-marquee-tool-bug/10718)

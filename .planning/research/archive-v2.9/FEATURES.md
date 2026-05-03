# Features — v2.10 Text Box Resize Handles

**Researched:** 2026-05-02
**Confidence:** HIGH (Canva, Figma) / MEDIUM (CapCut, Keynote, VEED, Adobe Express) / opinionated synthesis on recommendation

---

## Recommendation: Canva-style hybrid — **corner handles scale font + box, side handles resize box only, top/bottom handles do not exist for text boxes**, Shift constrains to width-only, font size persists as the explicit `font_size` value (not a scale factor).

This is the dominant pattern in social-content design tools (Canva, CapCut, Keynote post-2023 auto-scale era) and matches Diego's stated mental model — "crank a 1-3 word hook to fill the top half" is fundamentally a corner-drag-to-scale gesture, not a slider gesture. The slider stays as the precise input; corner-drag is the fast affordance.

### What corner-drag does

**Scale font AND box together (uniform).** Both `width` and `font_size` change in the same drag stroke, by the same factor.

- The text box reflow stays "auto-fit height to content" (no explicit `height` stored — see persistence model below).
- Font size scales linearly with width: `new_font_size = old_font_size * (new_width_pct / old_width_pct)`.
- Clamp to existing slider bounds: hook 16–240, body 14–120. Drag past the bound stops scaling further (the box keeps growing, the font doesn't — same as Canva when you hit its internal cap).
- On commit (`onResizeStop`), write BOTH `position.width` and `font_size` to the TextBox so the right-rail slider reflects the new size immediately.

**Why:** This is the gesture Diego described verbatim — "crank the hook to fill the top half." Side-drag-only would leave font size stuck at 96 while the box yawns to 1080px wide and the text becomes a small word in a giant box. Corner-drag-with-font-scale is the only gesture that does what users mean.

### What top/bottom drag does

**Nothing — top/bottom handles are NOT shipped.** The TextBox model is auto-fit-height (no `height` field), so vertical handles have no semantic meaning. Adding them would force one of three bad outcomes:

1. **Vertical-only font scale** (CapCut "stretch" mode): distorts text, looks unprofessional on a TikTok post. Anti-feature.
2. **Add an explicit `height` field**: introduces a "text box has empty space below the text" state which has no good answer for vertical alignment (top? center? bottom?). Bigger schema change, bigger renderer parity surface across `slide-preview.tsx` / `render-slide.ts` / `render-slide-satori.tsx`. Out of scope for a single-phase milestone.
3. **Crop text** (Photoshop point-text mode): hides content, baffles users.

Skip top/bottom entirely. Diego's use case ("take over the entire top part") is achieved via **corner-drag scale** + the existing **drag-to-reposition**, not via a height handle.

### What side drag does (existing behavior — preserved)

**Width-only resize, no font change.** Identical to today's react-rnd behavior: `left` and `right` handles change `position.width` only; text reflows within the new width; `font_size` is untouched.

This is the muscle-memory operation that's been live since Phase 13 — keep it. Side-drag is the "rewrap my paragraph narrower" gesture; corner-drag is the "make this hook bigger" gesture. Both are needed, and they're semantically distinct.

### Modifier keys

| Modifier | Effect on corner-drag |
|----------|----------------------|
| **Shift** (hold) | **Constrain to width-only** — disables font scaling for that drag. Lets a power user "go back to side-handle behavior" without moving cursor. Mirrors Canva's "Shift = lock proportions" semantically (scale stays uniform width:height — but since we don't have height, "uniform" collapses to "width-only, no font scale"). |
| **Alt / Option** | Not bound in v2.10 — defer. (Figma uses Alt for "scale from center"; not worth the schema/UX cost for a single-phase ship.) |
| **No modifier** | Corner-drag scales font + width together. The default = the common case = crank-the-hook. |

**Why this Shift binding (not Figma's "Shift = preserve aspect ratio"):** We don't have an aspect ratio to preserve (no `height`). The most useful "modifier" is "let me get the old behavior back," which is width-only. Calling it Shift keeps it discoverable for users with prior tool experience without requiring tutorial copy.

### Font-size persistence model

**Persist as explicit `font_size: number` on the TextBox, not as a scale factor.**

On `onResizeStop` from a corner drag:

```
const widthRatio = newWidthPct / oldWidthPct;
const newFontSize = clamp(
  Math.round(oldFontSize * widthRatio),
  roleBounds[role].min,   // 16 hook / 14 body
  roleBounds[role].max,   // 240 hook / 120 body
);
updateTextBox(id, {
  position: { ...pos, width: newWidthPct },
  font_size: newFontSize,
});
```

**Why explicit, not scale factor:**

| Question | Explicit `font_size` | Scale factor |
|----------|---------------------|--------------|
| Does the slider reflect drag changes? | Yes (slider reads `font_size`) | No, slider would need its own derivation logic |
| Does Satori PNG export work unchanged? | Yes (`render-slide-satori.tsx` already reads `font_size`) | Renderer would need to compute effective size from base × scale |
| Does the existing AI-generation pipeline work? | Yes (Gemini emits `font_size` in `style_overrides`) | AI output would need a new "scale" field nobody emits |
| What about subsequent slider edits? | Yes — user drags slider to 180 → set 180; trivial | Need to decide: does slider edit base size or scale? Both are confusing |
| Does the TPLREND-05 parity invariant hold? | Yes — all three renderers already key off `font_size` | All three need a new derivation, three places to drift |

A scale factor introduces a hidden multiplicative state that the AI generator, the slider, and three renderers all need to know about. Explicit `font_size` is the only design that doesn't break v2.9's parity discipline.

---

## Tool survey

Verified behavior as of 2026-05. Cells with quoted text are direct observations from the cited source; otherwise confidence is MEDIUM.

| Tool | Side handle | Corner handle | Top/bottom handle | Shift modifier | Stores |
|------|-------------|---------------|-------------------|----------------|--------|
| **Canva** (web, post-2024) | "Resize the text box width without affecting font size" — width only, text reflows | "Drag the corner to change font size... Canva will automatically adjust your font size" — scales font + box uniformly | Not present on text (Canva text boxes have left/right side + corners only) | "Hold Shift to maintain original proportions" — locks aspect ratio during corner drag | Explicit font size value (slider updates after corner drag) |
| **Figma** (Selection tool, default) | "Cursor turns into the scale icon... change the box size" — box-only, font unchanged | "Both the box size and the font size" change with the corner | Same as side (Figma text frames have all 8 handles when in Fixed mode) | "Holding Shift and dragging a corner changes Resizing Options from Hug to Fixed" — switches sizing model | Explicit font size; Hug/Fill/Fixed mode flag separate |
| **Figma Scale tool (K)** | Scales everything proportionally (font, stroke, effects) | Same — "adjusts dimensions, stroke weights, font sizes, and effects all at once" | Same | Shift = uniform scale | Multiplies font size, then writes back as new value |
| **CapCut** (desktop, 2025) | Drag to enlarge/shrink box, font stays | Drag corner to "enlarge or shrink it" — scales font + box | Vertical stretch distorts text (separate "stretch" affordance — generally avoided) | Not documented as a binding | Font size slider 1–300 (arbitrary unit, proportional to bounding box) |
| **Keynote** (Mac, post-auto-scale) | Drag side handle: resizes box without changing font (with Shrink-to-fit OFF) | Corner: with Shrink-to-fit ON, "automatically change the font size depending on the size of the text box" | Available on 8-handle mode; behavior matches sides | Shift = constrain to one axis | Explicit font size; "Shrink text to fit" toggle controls auto-scale-on-resize |
| **Pages** | Same model as Keynote (shared engine) | Same — auto-shrink toggle gates whether corner scales font | Same | Same | Same |
| **Adobe Express** | Width-only on sides, text reflows | Corner scales font + box (Canva-style — Express explicitly emulates Canva UX) | Not present on text | Shift locks ratio | Explicit font size |
| **VEED** | Side: width only | Corner: scales font + box (TikTok/Reels-focused tool, follows CapCut convention) | Distort warning if dragged | — | Pixel font size, slider reflects |
| **Photoshop** (point-text vs paragraph-text) | Point text: no box; paragraph text side: reflows, font unchanged | Corner: with **Cmd/Ctrl held**, scales font; without, resizes box only | Same as side | Shift = aspect-lock; Cmd/Ctrl = scale-the-text instead of just the box | Explicit pt size |

**Pattern majority: 7/8 surveyed tools scale font on corner-drag by default** (Photoshop being the lone exception, and Photoshop is a power-user image editor, not a social-content design tool). Side-drag-is-width-only is a clean 8/8.

The "scale font with box" gesture is **table stakes for social-content design tools** in 2026. Shipping resize handles without it would feel broken to anyone who has used Canva or CapCut.

---

## Table stakes (must ship)

1. **Corner handles on hook + body + custom text boxes** that scale font size + width together (default behavior, no modifier).
2. **Side handles preserved** (left + right) keep current width-only behavior — no regression for users who learned the v1.3 affordance.
3. **Slider reflects the new font_size after corner drag** — the right-rail slider is the source of truth and must update in real time on `onResizeStop`. This is the parity contract: "what I dragged = what the slider says = what gets rendered."
4. **Clamp to existing slider bounds** (hook 16–240, body 14–120) — never let drag exceed what the slider can express. Past the cap, box keeps growing, font stops.
5. **Renderer parity across all three render paths** (`slide-preview.tsx` editable + non-editable, `render-slide.ts` HTML, `render-slide-satori.tsx` Satori PNG). All three already read `font_size` from the TextBox / `style_overrides`, so persistence-as-explicit-value is the path of least parity risk.
6. **Undo / redo support** — corner drag must be a single history entry, not two (one for width, one for font_size). Use the existing `pushHistory()` reducer pattern from v2.8 Phase 49.
7. **Cursor changes to a diagonal-arrow / "scale" icon on corner hover** — Figma calls this out explicitly; without it users won't know corners do something different from sides.

## Differentiators (nice to have — defer if scope creeps)

1. **Shift to constrain to width-only on corner-drag.** Power-user escape hatch; cheap to add (one event-handler check). Worth shipping if implementation is < 30 min.
2. **Live numeric readout while dragging** ("Hook 142px") — Figma + Canva both surface this. Helps users discover the slider mapping. Cheap to add as an absolutely-positioned chip.
3. **Snapping to slider gridline values** (round to nearest 4px while dragging, snap to current default size with a magnetic detent). Friendlier than continuous values.

## Anti-features (deliberately NOT shipping)

1. **Rotation handles.** Adding rotation forces a `rotation: number` field on TextBox + transform math in three renderers + bounding-box recalculation for the alignment-guides hook + Satori transform support verification. v2.8/v2.9 deliberately avoided this. The Murphy-reference aesthetic doesn't need it. Defer to v3.0+.

2. **Skew / shear handles.** Photoshop has them; Canva and CapCut do not. Skewed text on a TikTok carousel looks like 2008 web design. Out of scope.

3. **Top/bottom handles with vertical-only scaling that distorts text.** This is the "stretch" mode in CapCut and Photoshop's free-transform — universally regarded as unprofessional on social content. Don't ship a knob that makes the output worse.

4. **Multi-select group resize.** Selecting hook + body + custom and corner-dragging to scale all three uniformly is a Figma power feature that requires group-bounds math, multi-element history entries, and group-selection UI. The right-rail in v2.8 is single-element by design ("selection-driven, single-element right rail" — PROJECT.md). Adding multi-select reverses that decision. Defer.

5. **Aspect-ratio lock as a mode (Figma's Constraints panel).** Modes-as-state add a hidden config burden ("why is my drag behaving weird?"). The Shift-modifier transient binding does the same job for the 1% who need it, with zero discoverability cost for the 99%.

6. **Auto-fit-text-to-box on type** (the Keynote "Shrink text to fit" toggle). Subtle, mode-y, and conflicts with the explicit slider model. Users who type past the slider cap can wrap; that's fine. Don't add a per-box toggle that makes the slider lie.

7. **Explicit `height` field on TextBoxPosition.** Forces vertical-anchor decisions (top/center/bottom of empty space?) that have no good default and no user demand. Auto-fit height stays.

8. **Drag-to-resize that changes `position.x` / `position.y` as a side-effect of width change beyond what already exists.** Today's `onResizeStop` callbacks already call both `onWidthChange` and `onPositionChange` — that's correct for top-left/bottom-left handles where the anchor moves. v2.10 should preserve this — but should NOT introduce a new behavior where dragging the right-edge handle silently shifts x. Lock that down with a test.

---

## Open questions for roadmapper

1. **Corner-drag scale axis: width-driven only, or width × height?** Recommendation says "width-driven" (since there's no height to drive from). But the Satori renderer line-height and overflow-wrap could produce slightly different visual heights at the same `font_size` between preview and PNG export. Acceptance criterion needs to specify: **"font_size is computed from width-ratio only; height drift between preview and Satori is acceptable up to ±2 line-heights and is a known TPLREND-05 caveat."** Or invest in a parity test that pins it. Roadmapper to decide whether to budget the test.

2. **What happens when corner-drag would push font past the cap?** Two options:
   - (a) Stop scaling font at the cap, keep growing the box (recommendation in this doc).
   - (b) Stop the entire drag at the cap (box stops growing too).
   Option (a) is more forgiving; option (b) is more honest. Roadmapper to pick — or punt to executor with default (a).

3. **Does corner-drag respect the existing alignment-guide / snap-to-other-element logic?** Today's `onDrag` for side-handle resize doesn't run `calculateSnap` on the resize delta — only on position drag. Adding snap-on-corner-resize is extra work; punting is fine for v2.10. Roadmapper: explicitly out of scope or in?

4. **Modifier-key discoverability.** If we ship Shift = width-only, do we surface it (tooltip on hover, hint in the right-rail panel, a one-time onboarding tip)? Recommend: ship without surfacing in v2.10 — power users find modifiers, casuals don't need them. But this is a product call.

5. **Hook-fit auto-shrink interaction.** `slide-preview.tsx` has `getHookFontSize(template.id, slide.hook_text, baseHookSize)` that auto-shrinks long hooks for templates registered in `hasHookFit`. After a user corner-drag-scales the hook to 200px, does the auto-shrink override their explicit value, or does the manual override win? The existing code: `overrides.hook_font_size ?? autoFitHookSize ?? baseHookSize` — manual override wins, which is correct. Verify v2.10 doesn't accidentally regress this. Worth a regression test.

6. **Corner handle on the existing custom-image boxes (which already have all 8 handles).** Should v2.10 unify the affordance — same handle visual, same modifier semantics — across text and image? Image boxes already use `lockAspectRatio={true}` for everything, which is the opposite default of text. Recommend: leave image behavior unchanged in v2.10 (don't expand scope). But flag it as a known inconsistency the roadmap should call out so the executor doesn't try to "fix" it mid-phase.

---

## Sources

- [Canva — Resize text boxes and wrap text](https://www.canva.com/help/wrap-text/) — confirms corner = scale font, side = box width only
- [Figma — Adjust text dimensions and resizing](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing) — confirms corner = scale both, Shift toggles Hug → Fixed
- [Figma — How to Scale in Figma: Resize with Precision](https://wpdean.com/how-to-scale-in-figma/) — Scale tool (K) vs Selection tool semantics
- [Figma forum — Slides resize with fixed size also scales text](https://forum.figma.com/report-a-problem-6/figma-slides-resizing-a-text-box-with-fixed-size-selected-also-scale-text-38094) — Figma Slides corner-drag scales text
- [CapCut — Font Units in CapCut](https://www.capcut.com/help/font-units-in-capcut) — internal scale 1–300 proportional to bounding box
- [CapCut — How to Make Text Bigger in Desktop (2025 guide)](https://www.youtube.com/watch?v=MlGp65FIPs8) — corner-drag enlarges text + box together
- [Apple — Change font/font size in Keynote](https://support.apple.com/guide/keynote/change-the-font-or-font-size-tane1c9a464f/mac) — official font size controls
- [AutoSize Text in Keynote (akistepinska)](https://akistepinska.com/keynote/autosize-text/) — confirms Shrink-to-fit toggle gates auto-scale-on-resize
- [Mouse Training London — Resizing Keynote Text Boxes](https://www.mousetraining.london/mouse-tips-resizing-keynote-text-boxes/) — 8-handle mode behavior

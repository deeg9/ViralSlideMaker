# Stack — v2.10 Text Box Resize Handles

**Milestone:** v2.10 (Text Box Resize Handles)
**Researched:** 2026-05-02
**Overall confidence:** HIGH (verified against installed `node_modules/react-rnd@10.5.3` type defs + npm registry metadata + existing in-codebase precedent)

---

## Recommendation

**Stick with `react-rnd@10.5.3` (already installed).** It supports all 8 handles (4 corners + top/bottom/left/right), built-in `lockAspectRatio`, and the `scale` prop already works correctly with the slide canvas's CSS-transform parent — proven by the existing custom-image `<Rnd>` block in `slide-preview.tsx` which already enables every corner handle. No library swap. No new dependency.

**Verdict:** Schema/UX milestone, not a stack-swap milestone.

---

## Why this choice

**1. The capability is already proven in this codebase.** `slide-preview.tsx` lines 1156–1182 already wire all 8 handles on `<Rnd>` for custom images, with the same scaled-canvas parent and the same `scale={scale}` prop the text-box `<Rnd>`s use. The text-box `<Rnd>` instances on lines 860, 935, and 1023 explicitly restrict `enableResizing` to `{ left: true, right: true }` — the restriction is a deliberate v2.8 product decision, not a library limitation. Flipping `top`/`bottom`/`topLeft`/`topRight`/`bottomLeft`/`bottomRight` to `true` is a 6-line config change, not a rewrite.

**2. React 19 compatibility is verified two ways.** react-rnd's published peer range is open-ended (`react: ">=16.3.0"`), and its underlying engine `re-resizable@6.11.2` explicitly lists `^19.0.0` in its peerDependencies. More importantly, the project is already on `react@19.1.0` and the existing `<Rnd>` instances run cleanly through the editor with no console warnings (tests in `parity.test.tsx` and the v2.8 selection wiring in Phase 52 are green). Empirical compat trumps published-claim compat.

**3. The CSS-transform parent is already a solved problem.** The slide canvas applies `transform: scale(${scale})` on the inner container (slide-preview.tsx line 469), and every existing `<Rnd>` is passed `scale={scale}` so that drag/resize deltas are corrected for the CSS scale. Switching to a different library would require re-solving this — moveable.js has its own `zoom` API but mixing libraries in the same wrapper is not a Pareto win.

**Alternatives considered.** `react-moveable` (Daybrush) is the only credible alternative for richer affordances (rotation, snap-to-rotation, group transforms, warp), but its npm-unpacked size is **4.6 MB vs 87 kB for react-rnd** — roughly 50× — and v2.10 needs none of moveable's differentiators. Adopting moveable would also require swapping out the existing `useAlignmentGuides` snap pipeline that's wired into `<Rnd>`'s `onDrag` callback. `interact.js` is library-agnostic and powerful but ships its own React adapter that's lower-level than react-rnd; we'd reimplement what we already have. `@radix-ui/react-resizable` does not exist (verified — there's no such package; Radix has Slider, Dialog, etc., but no resize primitive). `react-resizable-panels` is a panel-splitter library (Bvaughn) for layout panels — wrong fit, doesn't do free-positioned boxes. Rolling our own with pointer events is the correct fallback only if react-rnd had a fundamental limitation; it doesn't.

---

## Configuration snippet

The executor lifts this verbatim into `src/components/slides/slide-preview.tsx`. Replace the existing definitions on lines 801–815 (currently restricted to `left`/`right`):

```tsx
// Phase 5x — v2.10: 8-direction resize for text boxes (corners + top/bottom).
// All handles enabled; UX trade-off (resize-only vs scale-font-with-corner)
// decided in the schema/UX research and wired into onResizeStop below.
const enableResizing = {
  left: true,
  right: true,
  top: true,
  bottom: true,
  topLeft: true,
  topRight: true,
  bottomLeft: true,
  bottomRight: true,
}

// Side handles keep the v2.8 thin-bar affordance; corner handles get the
// square-dot affordance already used on custom images (lines 1146–1153) so
// the visual language is consistent across text + image boxes.
const cornerHandleStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  border: '1px solid rgba(0, 0, 0, 0.35)',
  borderRadius: 2,
  position: 'absolute',
}

const resizeHandleStyles = {
  // Existing side bars (vertical mid-edge on left/right)
  left:   { ...resizeHandleStyle, left: -2 },
  right:  { ...resizeHandleStyle, right: -2 },
  // New top/bottom horizontal bars (rotate the same affordance 90°)
  top:    { ...resizeHandleStyle, top: -2, left: '50%',
            width: 40, height: 4, transform: 'translateX(-50%)' },
  bottom: { ...resizeHandleStyle, bottom: -2, left: '50%',
            width: 40, height: 4, transform: 'translateX(-50%)' },
  // Corners — square dots, mirroring the custom-image pattern
  topLeft:     { ...cornerHandleStyle, top: -5, left: -5 },
  topRight:    { ...cornerHandleStyle, top: -5, right: -5 },
  bottomLeft:  { ...cornerHandleStyle, bottom: -5, left: -5 },
  bottomRight: { ...cornerHandleStyle, bottom: -5, right: -5 },
}
```

For corner-drag-to-scale-font UX (the v2.10 schema/UX research will pick this), the executor reads the resize direction in `onResizeStop` and conditionally scales font size when a corner handle was used:

```tsx
onResizeStop={(_e, dir, ref, _delta, position) => {
  const newWidthPx = parseInt(ref.style.width)
  const newHeightPx = parseInt(ref.style.height)
  const newWidthPct = Math.max(20, Math.min(100, (newWidthPx / REF_WIDTH) * 100))
  onWidthChange?.('hook', Math.round(newWidthPct))

  // Corner drag → proportional font scale (UX decision: resize-AND-scale on corners,
  // resize-only on side/top/bottom handles). `dir` is one of:
  // 'top'|'right'|'bottom'|'left'|'topLeft'|'topRight'|'bottomLeft'|'bottomRight'.
  const isCorner = dir === 'topLeft' || dir === 'topRight'
                || dir === 'bottomLeft' || dir === 'bottomRight'
  if (isCorner) {
    // Scale font proportionally to width change. Pre-resize width is captured
    // in onResizeStart; ratio applied to current hookFontSize override.
    const widthRatio = newWidthPx / hookWidthPx_atResizeStart
    const newHookFontSize = Math.round(hookFontSize * widthRatio)
    onHookFontSizeChange?.(newHookFontSize)  // new server action in editor-actions.ts
  }

  // Schema-decision dependent: if TextBoxPosition gains an explicit `height`,
  // also dispatch onHeightChange?.('hook', (newHeightPx / REF_HEIGHT) * 100).
  // If schema picks auto-fit, ignore newHeightPx and let content height drive.
  if (onPositionChange) {
    const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
    const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
    onPositionChange('hook', { x: percentX, y: percentY })
  }
}}
```

**Optional: Shift-key for proportional drag.** react-rnd doesn't have a `lockAspectRatioOnModifier` prop, but you can toggle `lockAspectRatio` via React state on the Rnd's `onResizeStart`/`onResizeStop` by reading `e.shiftKey` — Figma/Canva users expect Shift to constrain proportions. (This is a polish item; the milestone can ship without it.)

---

## Alternatives considered

| Library | Bundle (unpacked) | React 19 | Corner handles | CSS-transform parent | TS support | Maintenance | Verdict |
|---|---|---|---|---|---|---|---|
| **react-rnd 10.5.3** | 87 kB (re-resizable adds 139 kB; both already in bundle) | Open peer (`>=16.3.0`); engine `re-resizable@6.11.2` lists `^19.0.0`; **proven on react@19.1.0 in this codebase** | Yes — all 8 via `enableResizing` | Yes — `scale` prop, already wired correctly to `slide-preview.tsx` | First-party `.d.ts` | Last published 2026-03-10 (v10.5.3); active | **CHOSEN** |
| react-moveable (`react-moveable`) | 4.6 MB | Yes | Yes (8 handles + rotation + warp) | Yes (`zoom` prop) | Yes | Active (Daybrush, well-maintained) | Reject — 50× larger, requires rewriting `useAlignmentGuides` snap integration, brings rotation/warp we don't need this milestone |
| interact.js (`interactjs`) | ~280 kB core | Yes (framework-agnostic) | Yes (custom handles via DOM) | Manual (you handle deltas) | Has types | Active | Reject — lower-level than react-rnd; we'd rebuild drag+resize state we already have |
| `@radix-ui/react-resizable` | — | — | — | — | — | **Does not exist** (verified npm — Radix has no resize primitive) | N/A |
| `react-resizable-panels` | ~30 kB | Yes | No (panel splitters only) | N/A | Yes | Active | Wrong category — splits a layout into panels with a draggable divider; not free-positioned resizable boxes |
| Hand-rolled pointer-events | 0 | Yes | Build it | Build it | Build it | You own it | Reject — reinventing `re-resizable`; not a budget that pays back pre-PMF |

---

## Integration notes

**1. CSS-transform parent compatibility.** The slide canvas at `slide-preview.tsx` line 469 sets `transform: scale(${scale}); transform-origin: top left` on the inner div, with `scale = containerWidth / REF_WIDTH`. Every existing `<Rnd>` already passes `scale={scale}` (lines 862, 937, 1027, 1160). The new corner handles inherit this wiring — no extra work. Double-check after the schema change: when a text box gains an explicit `height`, the `bounds="parent"` clamp still operates in REF-canvas pixel space (1080×1920), not visual pixels, because react-rnd's `scale` prop divides delta by scale before applying. The current custom-image block (lines 1156–1182) is the proof — it has explicit width+height, all 8 handles, and works correctly under the scaled canvas.

**2. Satori export path is untouched.** Resize handles live exclusively inside `<Rnd>`, which only renders in the `editable === true` branch (slide-preview.tsx line 775 onward). The non-editable branch (line 553) renders pure absolute-positioned `<div>`s with no `<Rnd>` wrappers — that's the path Satori sees. Additionally, `render-slide-satori.tsx` and `render-slide.ts` (HTML) never import react-rnd. Handle DOM cannot bleed into PNG output. Phase 52 already verified this contract (the dashed selection ring uses `outline` specifically because Satori ignores it; same defense-in-depth applies here, but more strongly because the entire `<Rnd>` wrapper is gated, not just one CSS property).

**3. React 19 strict mode + concurrent rendering.** react-rnd's internals depend on `react-draggable@^4.5.0` and `re-resizable@^6.11.2`. `re-resizable@6.11.2` is the version that added the `^19.0.0` peer; both libs use class components with refs (no hooks), which means strict-mode double-invocation effects don't apply to their internals. The wrapper components in this codebase (`SlidePreview` itself) use hooks under React 19.1 strict mode and are already green in test (756 passing as of v2.9). No known concurrent-rendering pitfalls — `<Rnd>` does not call `setState` during render, and its drag state is event-driven (mouse/touch handlers), not render-driven.

**4. Renderer parity (TPLREND-05).** v2.10 must keep the three-renderer parity invariant from v2.9. Resize handles are editor-only by construction (point 2), so they don't enter the parity surface. What DOES need parity: if the schema gains an explicit `height` on `TextBox`, all three renderers (`slide-preview.tsx` non-editable branch, `render-slide.ts`, `render-slide-satori.tsx`) must consume it identically. That's a `resolve-overlay.ts` concern, not a react-rnd concern — out of scope for this STACK doc, but flag for the schema/UX research.

---

## Pitfalls flagged for the Pitfalls research

- **`size.height: 'auto'` cast on text-box Rnds is a hack.** Lines 862, 937, and 1026 currently pass `height: 'auto' as unknown as number` because text boxes auto-fit to content. When v2.10 adds a real height — whether explicit-height or aspect-ratio — the cast must go away, and `onResizeStop` must distinguish "user dragged the height handle" from "content reflowed." Pitfalls research should flag the auto-fit-vs-explicit-height ambiguity as the highest-risk regression in v2.10: get this wrong and existing slides silently change visual layout.
- **Aspect-ratio drift on font-scale corners.** If corners scale font-with-box, then a hook with auto-fit height will reflow to a different number of lines as width shrinks, breaking the constant aspect ratio expected by `lockAspectRatio={true}`. Either (a) don't lock aspect ratio on text-box corners, or (b) capture line-count at resize-start and accept that aspect drifts — pick one explicitly. Worth a Pitfalls entry because Figma/Canva users have muscle memory for "Shift + corner = constrained" and will report a "broken aspect lock" if we get it wrong.
- **Min-size floor for the new top/bottom handles.** The existing `<Rnd>` minWidth defaults are loose; for a text box, dragging the bottom handle up past the text's intrinsic line-height collapses the box. Set explicit `minWidth` and `minHeight` (e.g., `minHeight={hookFontSize * 1.1}`) to prevent the user from creating an invisible/clipped text box that they then can't grab to resize back out.

---

## Sources

- Installed `node_modules/react-rnd@10.5.3` `lib/index.d.ts` — confirms `enableResizing` accepts all 8 directions (`top`, `right`, `bottom`, `left`, `topLeft`, `topRight`, `bottomLeft`, `bottomRight`) plus `resizeHandleStyles`, `resizeHandleClasses`, `resizeHandleComponent`, `lockAspectRatio`, `scale`, `bounds`, `minWidth`/`minHeight` (HIGH confidence — first-party type defs).
- npm registry: `react-rnd@10.5.3` published 2026-03-10, peer `react: ">=16.3.0"` (HIGH).
- npm registry: `re-resizable@6.11.2` (react-rnd's resize engine) peer `react: "^16.13.1 || ^17.0.0 || ^18.0.0 || ^19.0.0"` (HIGH).
- In-codebase precedent: `src/components/slides/slide-preview.tsx` lines 1156–1182 — custom-image `<Rnd>` already enables all 8 handles successfully under the same scaled-canvas parent (HIGH — empirical).
- npm registry size data: `react-rnd` 87 kB unpacked, `re-resizable` 139 kB unpacked, `react-moveable` 4.6 MB unpacked (HIGH — npm registry).
- [bokuweb/react-rnd GitHub](https://github.com/bokuweb/react-rnd) — README confirms `scale` prop semantics: "specifies the scale of the canvas you are dragging or resizing this element on, allowing you to get the correct deltas while you are zoomed in or out via a transform or matrix in the parent of this element" (HIGH).
- [react-rnd issue #110 — transform: scale()](https://github.com/bokuweb/react-rnd/issues/110) and [#766](https://github.com/bokuweb/react-rnd/issues/766) — historical bugs that motivated the `scale` prop; both resolved by passing `scale` correctly. This codebase already does (MEDIUM — issue history; mitigation already in place).

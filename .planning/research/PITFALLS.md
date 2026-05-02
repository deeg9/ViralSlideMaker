# Pitfalls — v2.10 Text Box Resize Handles

**Domain:** Adding corner + top/bottom resize handles to text boxes in an existing slide editor
**Researched:** 2026-05-02
**Stack in play:** Next.js 15.5 + React 19, react-rnd 10.5.3, Satori (via `next/og` ImageResponse) for PNG export, CSS-transform-scaled 1080×1920 canvas, three render paths required to stay byte-identical (TPLREND-05)
**Confidence:** HIGH on react-rnd / Satori facts (verified against GitHub issues, library README, and the in-repo source). MEDIUM on UX recommendations (Canva/Figma behaviour observed and cited but design decisions are pre-PMF judgement calls).

> **Read this before any other research file in `.planning/research/`.** The other files (STACK / FEATURES / ARCHITECTURE / SUMMARY) describe what to build; this file describes the specific code paths that will silently corrupt state, drift the editor away from the export, or feel jittery to users if the executor doesn't pre-mitigate them.
>
> Each pitfall has: **failure mode**, **prevention**, **owner phase / file**. Pitfalls are split into "in scope, must address" (the executor cannot ship without a defensible answer for each) and "out of scope, worth noting" (defer with a one-line rationale).

---

## In-scope (must address)

### 1. CSS-transform scale + react-rnd handle math

**Failure mode:** The slide canvas is rendered at REF_WIDTH=1080 / REF_HEIGHT=1920 and CSS-scaled to fit the viewport with `transform: scale(${scale})` on the inner wrapper (`slide-preview.tsx` line ~469). react-rnd's drag and resize math is computed in raw client pixels by default. Without correction, dragging a corner handle by 100 viewport pixels would resize the box by 100/scale canvas pixels — at scale=0.4 (typical for the editor) the box would grow ~250 canvas pixels for every 100 px of mouse travel, giving a "runaway" / "1.5×-too-fast" feel. This is documented in [react-rnd issue #110](https://github.com/bokuweb/react-rnd/issues/110) ("the problem when using transform: scale()") and [#766](https://github.com/bokuweb/react-rnd/issues/766) ("Rnd Components rerender will has wrong position when use scale").

**Prevention:** The fix is the `scale` prop on `<Rnd>`. Per the [react-rnd README](https://github.com/bokuweb/react-rnd): *"Specifies the scale of the canvas your are resizing and dragging this element on. This allows you to, for example, get the correct resize and drag deltas while you are zoomed in or out via a transform or matrix in the parent of this element."* This codebase **already** passes `scale={scale}` on every existing `<Rnd>` (slide-preview.tsx lines 862, 939, 1027, 1160). The executor must:

  1. **Preserve `scale={scale}` on every new Rnd instance and on every resize-related code path.** Do not introduce an "uncorrected" branch.
  2. Never mix `transform: scale` with manual `e.clientX` math — the `scale` prop only patches the values that pass through `onDrag`/`onResize` data parameters. If the executor reaches into raw mouse events, they re-introduce the bug.
  3. The reference dimensions (REF_WIDTH/REF_HEIGHT) are constants at the top of `slide-preview.tsx` — keep all percent ↔ pixel conversions in canvas units, not client units. The pattern `(data.x / REF_WIDTH) * 100` is the canonical conversion in this file; reuse it.
  4. Test by recording: drag a corner handle 200 px in the viewport at ~30% canvas scale; assert that `text_boxes[i].position.width` changes by ~62% (200 / (REF_WIDTH * 0.3) * 100), not 18% or 200%.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` (the new `<Rnd enableResizing={{ topLeft: true, topRight: true, bottomLeft: true, bottomRight: true, top: true, bottom: true, ...}} />` block on the hook/body/custom branches).

---

### 2. Satori export drift (resize handles must not leak into the PNG)

**Failure mode:** Satori does not understand `outline`, custom resize-handle DOM, hover/selection rings, or `react-rnd`'s injected `transform: translate(...)` wrapper styles. If the resize-handle JSX leaks into the non-editable branch (`editable={false}`), one of three things happens: (a) Satori crashes on an unsupported style and the PNG export 500s for the affected slide, (b) Satori silently ignores the styles and the export looks identical but the React preview now has visible resize handles drawn on top — instant TPLREND-05 parity violation, or (c) `react-rnd`'s outer `<div>` injects a `transform: translate(...)` that Satori either ignores (drift) or partially honours (worse drift, since [Satori has limited transform support](https://github.com/vercel/satori) and `display: flex` is mandatory on most parents).

**Prevention:** The codebase already enforces a hard branch split: `slide-preview.tsx` has a `if (!editable) { return <non-rnd JSX>; }` block (line 553) that runs *before* any `<Rnd>` is mounted. Every existing react-rnd-related affordance — selection rings, hover outlines, trash zone, alignment guides, double-click-to-edit — sits behind that gate. The new resize handles MUST follow the same pattern:

  1. **Add resize handles only inside the editable branch.** Do not touch the non-editable JSX. The non-editable branch already renders hook/body/custom_text as plain absolute-positioned `<div>`s with `left: ${x}%; top: ${y}%; width: ${w}%`; these are what Satori reads (via `render-slide-satori.tsx`, which mirrors that DOM shape). If the schema gains a `height` field, the non-editable branch must also render `height: ${h}%` — and `render-slide-satori.tsx` + `render-slide.ts` (HTML) must be updated **in the same commit** or the byte-identity contract breaks.
  2. **Never add `outline` / `box-shadow` selection rings to the schema.** Phase 52 specifically chose `outline` (not `border`) because Satori ignores it and CSS-outline doesn't reflow. If the executor stores selection state in the slide record (e.g. `slide.text_boxes[i].selected = true`), it will leak. Selection state lives in the React component's local state only.
  3. **Test:** add a parity test in `src/__tests__/render` (alongside the existing `parity.test.tsx`) that renders the same slide with `editable={true}` then `editable={false}` and asserts no `[data-rnd]` / `<Rnd>` DOM survives the second pass. Also add a Satori snapshot test that renders the slide with the new schema fields populated and asserts the PNG byte hash matches a fixture.
  4. **Three-renderer audit before PR merge:** open `slide-preview.tsx`, `render-slide.ts`, `render-slide-satori.tsx` side-by-side. Any new style key (`height`, `min-height`, etc.) must appear in all three or in none. v2.7 Phase 48 commit `e96fd3a` is the precedent — a Satori `display: flex` bug was hidden for an entire phase because only one renderer was audited.

**Owner:** Phase 1 / Phase 2 — `src/components/slides/slide-preview.tsx` (editable branch), `src/lib/render/render-slide-satori.tsx`, `src/lib/render/render-slide.ts`. Phase-end gate: add a parity test pin.

---

### 3. Auto-fit vs explicit height (schema decision drives every other pitfall)

**Failure mode:** The current `TextBoxPosition` has only `x`, `y`, `width` — no `height`. Three viable schema choices, each with distinct failure modes:

  - **(A) Stay auto-fit (no `height` field).** Box height is determined by content. Resize-handle drag on the bottom edge resizes *width* only (rejected because the user dragged a vertical handle and saw nothing happen — feels broken). Top/bottom corner-drags either map to font-size (next pitfall) or are disabled.
  - **(B) Add explicit `height` field.** User can drag bottom handle and the box height changes. **But** if content > height, what happens? Three sub-failure-modes:
    - `overflow: hidden` → text gets silently clipped mid-letter — looks like a render bug, especially in the Satori PNG where the user can't even see the cursor to know they're editing.
    - `overflow: visible` → text spills outside the box, defeating the purpose of having a height.
    - Auto-shrink font-size to fit → fights with the existing `news-hook-fit.ts` registry (pitfall 9), and font-size slider in the right rail goes out of sync with the visual (pitfall 4).
  - **(C) Auto-fit with min-height.** Box auto-grows to content, but the user can drag a `min_height` floor so an empty box stays a fixed visual size. This matches Figma's "Auto Height" mode ([Figma docs](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing): "Auto Height — the height of the text layer will grow and shrink depending on its contents"). Avoids clipping entirely.

**Prevention:** Pick **(C) auto-fit with optional min-height** as the default for hook/body and use **(B) explicit height with `overflow: hidden` + visible end-of-line indicator** for custom text boxes only if a strong UX case emerges. Rationale:

  1. Hook/body currently auto-fit and have a `news-hook-fit.ts` shrink curve that the renderer parity tests pin. Switching to explicit-height would invalidate every existing slide. (C) preserves those slides byte-identical.
  2. Auto-fit + min-height matches Figma's "Auto Height" — proven design-tool pattern.
  3. Explicit height with clipping is a Canva-style ([Canva Help — Resize designs](https://www.canva.com/help/resize/)) trap: users routinely complain content gets cut off when they don't realize they're editing inside a fixed-height box.
  4. Schema: add `position.min_height?: number` (optional, percent of canvas). When present and content height < min_height, box renders at min_height. When absent, fully auto-fit. Top/bottom resize handles set `min_height`. Corner resize on hook/body still scales font (pitfall 4) but only after the user opts in via a modifier (Shift) — see pitfall 4.
  5. **Do not change the existing `TextBox.position` storage shape for legacy slides** — the `min_height` field is optional and back-compat. Renderer parity is preserved when the field is absent.

**Owner:** Phase 0 (schema) / `src/lib/types/slide.ts`. Decision must be made before any `<Rnd>` props are touched in Phase 1.

---

### 4. Font-scaling on corner drag

**Failure mode:** If corner-drag scales the font (the "Canva text-box" feel), four bugs cluster:

  1. **Linear coupling looks broken at extremes.** A 1px / 1px coupling means dragging a corner 200px shrinks a 120px font to 120 - 200 = -80 (clamped to a min, but the box looks empty). A `0.5×` coupling looks unresponsive.
  2. **Aspect-ratio coupled to width-only feels right but breaks on tall slides.** New font_size = base * (newWidth / oldWidth) is the Canva model. But hooks tend to wrap, so widening 50% rarely needs a 50% font bump.
  3. **The font-size slider in the right rail goes out of sync.** The user drags a corner, font becomes 96px, but the slider still says 120px. Then they bump the slider to 130px and the box "snaps back" — they lost their corner-drag state.
  4. **Undo/redo loses the relationship.** Each pointermove fires `UPDATE_TEXT_BOX`, history fills, and undo unwinds size + font in lockstep but at the granularity of pointer ticks (pitfall 8).

**Prevention:**

  1. **Default: corner drag resizes the box only (width + height/min-height).** No automatic font-scaling. This matches every modern tool's default (Figma, Sketch, Adobe XD all separate text-box-resize from text-scale).
  2. **Opt-in font scaling via `Shift+corner-drag` (Canva precedent).** When Shift is held during a corner drag, scale `font_size` proportionally to `Math.sqrt((newWidth * newHeight) / (oldWidth * oldHeight))` (sqrt-of-area, so a 2× area increase = 1.41× font, intuitive for "zoom" mental model). Update `font_size` AND `position.width` in the same `UPDATE_TEXT_BOX` action so they round-trip.
  3. **Single source of truth.** The right-rail font-size slider reads from `text_boxes[i].font.size` — which is the same field the corner drag writes. After corner drag completes, the slider re-renders to the new value automatically. Never store font-size in two places.
  4. **Clamp aggressively.** `font.size` is clamped to `[12, 320]` in the reducer (similar to existing custom-text font-size clamps in `editor-reducer.ts`). Out-of-bounds drags are silently clamped, not rejected.
  5. **Snapshot test:** Shift+drag from corner with mocked pointer-event sequence, assert final `font.size` matches sqrt-of-area formula within ±1px tolerance.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` `onResize` callback + `src/lib/editor/editor-reducer.ts` `UPDATE_TEXT_BOX` clamp.

---

### 5. Snap-to-grid / alignment guides — already shipped, preserve don't break

**Failure mode:** The codebase already has snap/alignment guides (`src/hooks/use-alignment-guides.ts`, integrated in `slide-preview.tsx` lines 877-881, 942-955). They run on `onDrag`. If the executor naively wires resize callbacks without including snap, two things happen:

  1. Resizing a box near a centre-line drifts off-centre by 1-3 px because the snap only fires on drag, not resize.
  2. After resize, the *position* of the box is changed by react-rnd (resizing from top-left moves the bottom-right anchor) and bypasses the snap calculator entirely, so a user resizing-then-stopping next to an aligned-element ends up off-grid even though they were in the snap zone.

**Prevention:**

  1. **Add snap to the resize callbacks too.** In `onResize` (during, not stop), call `calculateSnap()` with the dragging box's bounds AND apply the result by adjusting BOTH `data.x/y` AND `ref.style.width/height` so the snap holds at all four edges. Pattern: snap edge-by-edge — if resizing from `bottomRight`, snap the right edge to the nearest vertical guide and snap the bottom edge to the nearest horizontal guide independently.
  2. **Clear guides in `onResizeStop` and `onResizeEnd`** — the existing `clearGuides()` is called on `onDragStop` only. Mirror that for resize.
  3. **Don't snap in two axes when the user is only dragging one handle.** A `top-only` handle drag should never adjust `x` or `width`. The existing `enableResizing` map (`{ top: true, bottom: true, ... }`) controls which axes are mutable; respect that in the snap math.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` `onResize` (new) + `src/hooks/use-alignment-guides.ts` (no change unless an axis-restricted snap is needed).

---

### 6. Multiple text boxes overlapping during resize

**Failure mode:** When user resizes a box and it grows over another text box, what's the policy? Three options observed in design tools:

  - **Push** (CSS auto-layout in Figma): the other box gets shoved aside. **But:** [Figma's auto-layout containers refuse to overlap](https://forum.figma.com/ask-the-community-7/overlap-elements-in-auto-layout-39792) — overlap is only allowed in non-auto-layout free-position frames. This codebase is non-auto-layout (free positioning by `x/y` percentage), so push is wrong.
  - **Allow overlap** (Figma free-position frames, Canva default): the boxes just overlap, z-index decides what's on top. The user can adjust manually after.
  - **Block resize** (none of the major tools): forbid the resize that would cause overlap. Feels broken — the user wonders why the handle stopped moving.

**Prevention:**

  1. **Allow overlap by default.** Match Canva/Figma free-position behaviour. The slide canvas is creative-tool territory, not a layout-engine container — overlap is a feature, not a bug (e.g. text on top of an image).
  2. **z-index: hook = 10, body = 10, custom_texts = 15, custom_images = 12, watermark = 18-19.** This is already established in `slide-preview.tsx`. New resize handles must not change these.
  3. **Do not auto-deduplicate / collision-resolve in the reducer.** Storing a box with overlapping bounds is fine; the renderer handles z-index.
  4. **No additional warnings or modals.** Overlap is intentional. Users who don't want it will adjust manually.

**Owner:** Phase 1 / no code change required, but document this decision in the phase plan so a future engineer doesn't add a "fix" for overlap.

---

### 7. Mobile/touch — react-rnd works but handles need bigger hit targets

**Failure mode:** react-rnd 10.5.3 supports touch events by default (it wraps `react-draggable` which has touch support). However, the existing image-resize handles in `slide-preview.tsx` are **8×8 px visual size with a 1px border** (lines 1147-1153) — well below the [WCAG 2.5.8 minimum target size of 24×24 CSS pixels](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). On touch, users will need 3-5 attempts to grab the handle, especially at the editor's typical 30-40% canvas scale where the visual hit area shrinks further to ~3px on screen.

**Prevention:**

  1. **Visual size: 12×12 px (or 4×40 for top/bottom edge bars, matching the existing `resizeHandleStyle`).** Visual matches Figma's small handle aesthetic.
  2. **Hit area: 24×24 px minimum, 32×32 px preferred.** Pad the handle with an invisible `::before` pseudo-element or a wrapper `<div>` with `position: absolute; inset: -10px;` to extend the hit zone without enlarging the visual. WCAG 2.5.8 AA = 24×24, AAA = 44×44 ([Smashing Magazine](https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/)).
  3. **Account for the canvas scale.** At canvas scale=0.4, a 24px-CSS hit area renders at 60px on the editor canvas (24 / 0.4). Accept this — bigger is better on mobile, and it doesn't show in the export because it's on the editor-only DOM.
  4. **Test on iOS Safari touch.** The user explicitly noted "TikTok creators commonly post-from-mobile." Run a manual touch QA on the deployed preview.
  5. **Don't rely on hover.** The `hover:outline` selection ring in `slide-preview.tsx` (line 909) does not fire on touch. Selection ring must show on `focus` / `active` / `selectedTextBoxId == box.id` — the existing dashed ring already does this.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` (resize handle styles + invisible hit-area wrappers). Phase-end gate: manual touch test on iPhone Safari.

---

### 8. Undo/redo correctness — every resize tick must NOT push history

**Failure mode:** Look at `src/lib/editor/editor-reducer.ts` line 270 — `case 'UPDATE_TEXT_BOX': ... return pushHistory(state, slides)`. Every `UPDATE_TEXT_BOX` action pushes a new entry to the undo stack. react-rnd fires `onResize` on every pointer move (~60 fps). A 1-second drag = ~60 history entries. After 5 drags, undo'ing once feels like "nothing happened" — the user has to mash Cmd+Z 60+ times to go back one resize. `MAX_HISTORY` (in editor-reducer.ts) caps the stack but the symptom remains: 60 ticks of one drag flush legitimate prior history off the back.

**Prevention:**

  1. **Use `onResizeStop` (and `onDragStop`) for the history-pushing dispatch, not `onResize`.** This is exactly the pattern react-rnd documents — `onResizeStop` fires once at the end of the gesture. The codebase already does this for the existing `onPositionChange`/`onWidthChange` calls (lines 882, 957, etc.). Mirror the pattern.
  2. **For live preview during drag, use a non-history-pushing channel.** Two options:
     - **Local state only:** during drag, react-rnd renders from its own internal state and the slide store is not touched. On `onResizeStop`, dispatch `UPDATE_TEXT_BOX`. This is what the existing code does for position drag and it's correct.
     - **Add a `UPDATE_TEXT_BOX_TRANSIENT` action** that mutates `state.present` without calling `pushHistory()`, used during drag, and a finalising `UPDATE_TEXT_BOX` on stop. Only needed if other components must reactively re-render mid-drag (currently they don't).
  3. **Single history entry per gesture.** Test: start with stack length 0, drag a corner from 100×100 to 200×200 in 30 ticks, assert stack length is 1 (not 30) after `onResizeStop`. Add the test to `src/lib/editor/__tests__/editor-reducer.test.ts`.
  4. **Don't try to "merge" consecutive history entries by timestamp.** It's brittle — pure stop-event dispatch is correct.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` (`onResize` is local-only, `onResizeStop` dispatches). Phase-end test: history-stack-size assertion.

---

### 9. Auto-shrink interaction with `news-hook-fit.ts`

**Failure mode:** `src/lib/render/hook-fit.ts` (the file is `hook-fit.ts`, not `news-hook-fit.ts`) is a per-template registry that returns a smaller `hookFontSize` when `slide.hook_text` is long (lines 15-118). It runs in BOTH renderers (`slide-preview.tsx` line 309 and the Satori path) so the hook auto-shrinks on long text. Three failure modes if v2.10 isn't careful:

  1. **Manual `font_size` set via corner drag is silently overridden by the auto-fit.** User Shift+corner-drags hook from 110px to 80px on the `news-drop` template. The renderer hits `hook-fit.ts`, sees a 14-char hook, applies the `scale: 1` step → renders at 110px. User's drag is invisible. (This bug already exists for the right-rail font-size slider but is hidden because the slider only operates on `style_overrides.hook_font_size`.)
  2. **Conversely:** if v2.10 adds an explicit `text_boxes[i].font.size` and routes it through `style_overrides.hook_font_size` (the existing override field), then the registry's auto-fit is bypassed (line 310: `overrides.hook_font_size == null && hasHookFit(template.id)`) — which is correct. But if the executor adds a NEW field (e.g. `text_boxes[i].font.size_override`) that the registry doesn't check, the auto-fit fights the user's drag.
  3. **Corner-drag width affects character-count threshold indirectly.** The registry uses `hookText.length` (line 127) to pick a step. It does not consider box width. If the executor "fixes" this by feeding box width into the registry, every existing slide gets a different render = TPLREND-05 violation, every parity test fails.

**Prevention:**

  1. **Route v2.10 corner-drag font-size through the existing `style_overrides.hook_font_size` field, not a new field.** Line 313 (`const hookFontSize = overrides.hook_font_size ?? autoFitHookSize ?? baseHookSize`) already prioritises explicit override > auto-fit > template default. v2.10 just sets `overrides.hook_font_size` and the precedence works.
  2. **Body and custom_text don't have auto-fit.** No interaction — straightforward.
  3. **Do NOT modify `hook-fit.ts`.** Adding a width parameter to the registry would invalidate every legacy slide. If the executor needs width-aware shrink, add a SEPARATE width-aware path that runs only for slides with `text_boxes[i].position.height` set (i.e. v2.10 schema). Legacy slides (no height) keep using the registry unchanged.
  4. **Test:** create a slide with `template_id='news-drop'`, hook 14-char (would naturally fit at 110px), set `style_overrides.hook_font_size = 80`. Assert renderer uses 80px, not 110px. Then unset the override; assert renderer uses 110px. This test already exists in spirit in `slide-preview.test.tsx` — extend if needed.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` (don't touch hook-fit.ts; just route through existing override).

---

### 10. Performance — re-render on every pointermove

**Failure mode:** `<SlidePreview>` is a 1400-line component with many derived values (`resolveSlideStyles`, `resolveOverlayContent`, `resolveWatermark`, `resolveForcedWatermark`, `buildOthersForSnap`). On a drag, react-rnd causes the wrapper `<Rnd>` to update its internal state ~60×/second. If the executor wires `onResize` to `setState` on the parent (slide store), every tick re-runs all of those resolvers. On a low-end laptop, the editor drops to 20-30fps mid-drag.

**Prevention:**

  1. **Don't lift drag state up.** During a drag/resize, react-rnd manages its own visual state internally — the parent only needs to know the final value on `onResizeStop`. The existing code does this correctly for position/width — preserve the pattern.
  2. **Use refs (not state) for transient drag values.** If the executor needs to expose mid-drag values (e.g. live position display in the right rail), use a ref + `requestAnimationFrame` to throttle to 1× per frame max.
  3. **Memoise the expensive derivations.** `resolved = resolveSlideStyles(slide, template)` (line 372) re-runs on every render. It's pure — wrap in `useMemo([slide, template])`. Same for `buildOthersForSnap` (already wrapped at line 538 with `useCallback`, but its deps include `slide.custom_texts` which changes by reference on every store mutation — consider `useMemo` over deep-equal once if drag perf is an issue).
  4. **Profile before optimising.** Add a v2.10 perf gate: run the editor in Chrome devtools Performance, drag a corner for 2 seconds, assert frame rate stays ≥ 55fps. If it drops, profile and memoise specifically; do not preemptively memoise everything.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` (drag state stays in react-rnd, dispatch on stop). Phase-end perf gate is optional — only add if a manual smoke test feels jittery.

---

### 11. `lockAspectRatio` trap on text boxes

**Failure mode:** The image-resize block in `slide-preview.tsx` uses `lockAspectRatio={true}` (line 1162). This is correct for images. If the executor copy-pastes that block as the starting point for text-box resize handles, they inherit `lockAspectRatio` — but text boxes shouldn't lock aspect ratio. A locked aspect ratio means dragging the right edge also moves the bottom edge, which is wrong for text (you usually want narrow + tall, or wide + short, not proportional both).

**Prevention:**

  1. **Explicit `lockAspectRatio={false}` on text-box `<Rnd>` instances.** Default react-rnd is unlocked, but if Shift-modifier-during-drag is supposed to enable temporary lock (Figma pattern), the executor must implement the modifier explicitly because react-rnd's `lockAspectRatio` is a static prop, not a runtime modifier.
  2. **Shift = font-scale (per pitfall 4), not aspect-lock.** Pick one Shift behaviour. Don't overload.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` (text-box `<Rnd>` props).

---

### 12. Reducer integrity — `UPDATE_TEXT_BOX` schema and dual-write

**Failure mode:** v2.8 introduced the `applyDualWrite` reducer pattern (BL-01 in v2.8 Phase 50): every TextBox edit also writes the legacy `hook_text` / `body_text` / `custom_texts` fields so the renderer (which still reads legacy on some paths) stays in sync. If v2.10 adds new fields to `TextBox.position` (e.g. `height`, `min_height`) and the dual-write path doesn't propagate them to a legacy-equivalent field, the live preview can diverge silently from the saved state — same class of bug as BL-01.

**Prevention:**

  1. **Audit `text-box-adapter.ts` (`legacyToTextBoxes` / `textBoxesToLegacy`).** Any new schema field must round-trip. If there's no legacy equivalent for `position.height` (likely — legacy didn't have height), the adapter just ignores the field on the legacy side. That's fine, but document it: "v2.10 fields are TextBox-only; they will be lost if a slide is round-tripped through legacy fields and the legacy fields are written-back as the source of truth."
  2. **`applyDualWrite` reducer must include the new fields.** Open `editor-reducer.ts` around line 270 (`case 'UPDATE_TEXT_BOX'`) and confirm the dual-write path covers position changes. If it currently only dual-writes text+font properties and not position, v2.10 width/height/min-height changes will not show up in the renderer. Test path: edit a text box's `min_height`, save, reload, assert min_height persists AND legacy `custom_texts[i].height` is in sync (or document the divergence).
  3. **MIGRATION-NOTES.md.** v2.8 already deferred legacy-schema sunset to v3.0+. v2.10 should add a one-liner: "v2.10 added `position.height` / `position.min_height`. Legacy fields not affected. Sunset of legacy fields (v3.0+) will drop the v2.8 `applyDualWrite` path entirely."

**Owner:** Phase 0 (schema) / `src/lib/types/slide.ts`, `src/lib/editor/text-box-adapter.ts`, `src/lib/editor/editor-reducer.ts`. Phase-end test: round-trip integration test in `src/lib/editor/__tests__/text-box-adapter.integration.test.ts`.

---

### 13. Three-renderer parity (TPLREND-05) on the new schema fields

**Failure mode:** The v2.9 audit established TPLREND-05: `slide-preview.tsx`, `render-slide.ts` (HTML), and `render-slide-satori.tsx` (PNG export) must produce byte-identical output for any given slide. v2.7 commit `e96fd3a` is precedent for what happens when this is violated — a Satori `display: flex` bug shipped silently because only the React preview was tested. If v2.10 adds `position.height` and only updates `slide-preview.tsx`, the Satori PNG export uses the old auto-fit and the user's resized box looks fine in the editor but exports at the original size.

**Prevention:**

  1. **Three-file commit rule.** Any new schema field that affects layout must be applied in all three renderers in the same commit. A pre-merge checklist item: "search for `position.width` in the codebase; for every match, the new field appears (or is intentionally absent with a comment)."
  2. **Parity tests.** Extend `src/__tests__/render/parity.test.tsx` to include the new fields. The existing 10 cases assert resolver-singleton identity for the existing fields — add 3-5 cases for height/min-height (typical slide, edge-case empty box, max-height clamp).
  3. **Satori `display: flex` requirement.** Any new wrapper `<div>` that holds the resized text MUST have `display: 'flex'` (or be an absolute-positioned single element with no children that need flex layout). Per [Satori's README and issue #325](https://github.com/vercel/satori/issues/325), Satori only supports `display: flex` and `display: none`. If the executor adds a `<div style={{ height: '20%', overflow: 'hidden' }}>` without `display: flex`, Satori will crash or produce unexpected layout.
  4. **`overflow-wrap` not `word-break`.** This codebase already has a fix for the `word-break: break-word` deprecated alias bug (quick-260502-j14). Stick to `overflowWrap: 'break-word'` and `whiteSpace: 'normal'` — both Satori-supported. Do not add `word-break` to any new style block.

**Owner:** Phase 1 / Phase 2 — all three renderer files, plus `src/__tests__/render/parity.test.tsx`. Pre-merge: grep audit + parity test diff.

---

### 14. Cursor affordance and "what does this handle do?"

**Failure mode:** A user sees a corner handle and doesn't know if it resizes the box, scales the font, rotates, or all three. Without explicit affordances, the v2.10 corner-drag feature feels like a guess. Worse, if the cursor doesn't change on hover, users miss the handle entirely.

**Prevention:**

  1. **Cursor: `nwse-resize` / `nesw-resize` for corners, `ew-resize` for left/right, `ns-resize` for top/bottom.** react-rnd sets these by default but the existing code overrides with `cursor: 'grab'` on the inner div (line 916) — make sure the resize-handle wrapper's cursor takes precedence (z-index higher OR avoid setting cursor on the handle's parent).
  2. **Tooltip on first hover.** Show "Drag to resize. Shift+drag to scale text." for the first 3 hovers in a session, then suppress (use localStorage). This matches Figma's onboarding tooltips. Pre-PMF: a single one-time toast on first selection of a text box is enough — don't over-engineer.
  3. **Don't show corner handles on every text box at once.** Show handles only on the selected box (already the pattern from v2.8 Phase 52 — `selectedTextBoxId` gates the dashed ring). Extend: handles render only when the box is the active selection. Other boxes get the hover-only outline.

**Owner:** Phase 1 / `src/components/slides/slide-preview.tsx` (cursor styles, conditional handle rendering on selection).

---

## Out of scope (worth noting)

### 15. Rotation handle

Figma and Canva both have a top-centre rotation handle in addition to corner-resize. **Defer.** Rotation requires `transform: rotate(...)` which Satori has limited support for (the [Satori README](https://github.com/vercel/satori) lists rotation under "limited" CSS support), and would force a width-aware text-fit pass. v2.10 is "smallest thing that makes the affordance feel right" — rotation belongs in a v2.11+ iteration once basic resize is validated.

### 16. Multi-select resize

Selecting two text boxes at once and resizing them together (Figma pattern). **Defer.** Pre-PMF, single-element editing is the dominant flow per v2.8 right-rail design. Adds combinatorial complexity (which anchor? proportional?) for a workflow most users don't do on a 5-9 slide carousel.

### 17. Pixel-precise input fields

A "W: 540 H: 200" numeric input pair next to the box (Figma's design panel). **Defer.** The right rail already shows font-size as a slider; width/height as numeric inputs is incremental UX polish. v2.10 ships if drag + value-displayed-in-right-rail works.

### 18. Aspect-ratio lock toggle button

A UI toggle in the right rail for "lock aspect ratio while resizing" (separate from Shift modifier). **Defer.** Modifier-key-only is the convention in pro design tools (Photoshop, Figma, Sketch). UI toggle is a polish item.

### 19. Text-fitting font-size auto-shrink (Canva "Magic Resize")

When the user resizes a box to be smaller, automatically shrink the font to fit (the inverse of `news-hook-fit.ts` but per-box, not per-template). **Defer to a separate research doc.** This is a real feature but it interacts with auto-fit, the registry, and per-segment font-family overrides in non-trivial ways. v2.10 ships with: corner-drag changes box size (and optionally font on Shift), nothing else automatic.

### 20. Undo for accidental delete-via-resize

If the user resizes a box to width=0 / height=0 (a UI bug), the box becomes invisible but is not deleted. **Mitigate via clamps, do not add a dedicated undo path.** Reducer clamps width to ≥ 5% and height to ≥ a min based on `font_size` (e.g. `1.2 * font_size`) so the box is always visible. The existing `Math.max(20, ...)` clamp pattern at line 890 is the precedent — apply to height too.

---

## Citations

### react-rnd

- [GitHub repo bokuweb/react-rnd](https://github.com/bokuweb/react-rnd) — `scale` prop docs in README ("Specifies the scale of the canvas... allows you to get the correct resize and drag deltas while you are zoomed in or out via a transform or matrix in the parent")
- [Issue #110 — the problem when using transform: scale()](https://github.com/bokuweb/react-rnd/issues/110) — the canonical bug-report that prompted the `scale` prop
- [Issue #766 — Rnd Components rerender will has wrong position when use scale](https://github.com/bokuweb/react-rnd/issues/766) — late-breaking re-render edge case (verify before shipping)
- [Issue #732 — Ability to override or disable 'transform' property](https://github.com/bokuweb/react-rnd/issues/732) — react-rnd injects `transform: translate(...)` on the wrapper which is occasionally annoying for parity with Satori
- [Issue #185 — Overriding or adding transform property](https://github.com/bokuweb/react-rnd/issues/185)
- [npm page for react-rnd](https://www.npmjs.com/package/react-rnd) — version 10.5.3 confirmed in `package.json` line 49

### Satori

- [vercel/satori](https://github.com/vercel/satori) README — supported CSS subset, `display: flex` requirement
- [Issue #325 — Rendering inline elements](https://github.com/vercel/satori/issues/325) — flex-only support
- [Issue #573 — CSS filter behaviour](https://github.com/vercel/satori/issues/573) — referenced by v2.9 photo-treatment baking decision (cited in PROJECT.md)
- [Issue #393 — Text layout can be wider than node's width](https://github.com/vercel/satori/issues/393) — relevant when adding `position.height` since text can overflow

### Figma / Canva (UX precedent)

- [Figma — Adjust text dimensions and resizing](https://help.figma.com/hc/en-us/articles/27378154668951-Adjust-text-dimensions-and-resizing) — Auto Width / Auto Height / Fixed Size taxonomy used in Pitfall 3
- [Figma `textAutoResize` plugin API](https://www.figma.com/plugin-docs/api/properties/TextNode-textautoresize/) — confirms the three modes are actual property values
- [Figma forum — Overlap elements in Auto layout](https://forum.figma.com/ask-the-community-7/overlap-elements-in-auto-layout-39792) — overlap allowed only outside auto-layout; basis for Pitfall 6 "allow overlap" recommendation
- [Canva Help — Resize designs and size limits](https://www.canva.com/help/resize/)

### Accessibility / touch

- [WCAG 2.5.8 Target Size (Minimum) — W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — 24×24 CSS pixel minimum (AA), basis for Pitfall 7
- [Smashing Magazine — Accessible Target Sizes Cheatsheet](https://www.smashingmagazine.com/2023/04/accessible-tap-target-sizes-rage-taps-clicks/) — 44×44 best practice

### In-codebase precedent (already-shipped patterns to preserve)

- `src/components/slides/slide-preview.tsx` lines 553 (editable branch gate), 862 (`scale={scale}` on Rnd), 882 (onDragStop dispatches, onDrag does not), 1162 (`lockAspectRatio={true}` is image-only)
- `src/lib/editor/editor-reducer.ts` lines 91 (`pushHistory`), 270 (`UPDATE_TEXT_BOX`)
- `src/lib/render/hook-fit.ts` lines 120-132 (registry lookup; explicit override wins on line 313 of slide-preview.tsx)
- `.planning/MILESTONES.md` v2.7 commit `e96fd3a` (Satori `display: flex` parity bug — precedent for three-renderer audit rule)
- `.planning/MILESTONES.md` v2.8 BL-01 (`applyDualWrite` reducer dual-write — precedent for Pitfall 12)
- `.planning/quick/260502-j14-fix-ai-text-mid-word-break-remove-deprec` (`word-break: break-word` deprecated alias — Pitfall 13 #4)

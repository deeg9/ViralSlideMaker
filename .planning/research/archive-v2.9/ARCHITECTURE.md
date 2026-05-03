# Architecture — v2.10 Text Box Resize Handles

**Domain:** Adding corner + top/bottom resize handles to text boxes in an existing dual-renderer slide editor.
**Researched:** 2026-05-02
**Confidence:** HIGH — every claim below is grounded in the current codebase (file + line numbers given). The single MEDIUM-confidence claim is the optional font-scaling math, which is purely a UX choice and can be tuned in-phase.

This document answers six concrete questions. The TL;DR up front, then per-section details.

| Decision | Recommendation |
|---|---|
| Schema: explicit `height` on `TextBoxPosition`? | **YES — add `height?: number` (% 0-100), absent ⇒ auto-fit (current behavior).** |
| Auto-height fallback location | **Shared helper `resolveTextBoxBounds()` in `resolve-overlay.ts`** (or a new `resolve-textbox.ts` if `resolve-overlay.ts` grows past comfort). |
| Reducer/action change | **None new — `UPDATE_TEXT_BOX` already accepts `Partial<TextBox>`. The Rnd handler dispatches `position: { ...prev, height, width }` (and optionally `font_size`) in one action.** |
| Editor `<Rnd>` location | **`src/components/slides/slide-preview.tsx` lines 860 / 935 / 1023 — three call-sites (hook, body, custom). All three use the same `enableResizing` constant at line 801.** |
| Migration | **Lazy auto-fit fallback. No SQL backfill, no `text-box-adapter.ts` change required for absence-means-auto-fit.** |
| Phasing | **Single cohesive phase, executed in 4 commits.** |
| Legacy `hook_width`/`body_width` | **Already mirrored from `text_boxes[].position.width` via `applyDualWrite` (Phase 50). Add `hook_height`/`body_height` to `SlideStyleOverrides` ONLY if a non-Phase-49 codepath needs to read them — for v2.10, default to NO (canonical write path is `text_boxes[]`).** |

---

## Schema decision

### Trade-off table

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A: Add `height?: number` (% 0-100), absent ⇒ auto-fit** | Mirrors existing `width?` precedent (`TextBoxPosition.width` at `src/lib/types/slide.ts:87`); zero disruption to non-resized slides; the resize handle has somewhere to write its result; no over-fitting on AI-generated text that hasn't been touched. | Two render modes per slide (auto vs explicit); helpers must branch. | **CHOSEN.** |
| B: Renderer auto-fits height; corner handle only adjusts `font_size` | Simpler schema (no new field). | Corner handle writing `font_size` only is unintuitive — users expect to size a *box*, not a font. Makes "resize box without changing text size" impossible. Loses the affordance of "drag to make this hook headline take up the whole upper third of the slide." | **REJECTED.** |
| C: `aspectRatio` field instead of height | Geometric purity; easy lockAspectRatio. | Awkward when text content rewraps inside the box (text height ≠ aspect-driven height). Doesn't solve the "I want this hook to occupy 30% of canvas height" use case directly. | **REJECTED.** |

### Why option A fits the existing schema philosophy

Look at `TextBoxPosition` in `src/lib/types/slide.ts:83-88`:

```ts
export interface TextBoxPosition {
  anchor: TextBoxAnchor
  x?: number       // percentage 0-100 (only when anchor='custom')
  y?: number       // percentage 0-100 (only when anchor='custom')
  width?: number   // percentage 0-100 (overrides symmetric calc)
}
```

`x`, `y`, and `width` are all **optional percentages where absence delegates to a default-resolution function**. Adding `height` follows that exact pattern. The codebase has already converged on "absent = compute from defaults; present = user override" for every position field — `height` would be the fourth member of an established pattern, not a new pattern.

### Final schema patch

`src/lib/types/slide.ts:83-88`:

```ts
export interface TextBoxPosition {
  anchor: TextBoxAnchor
  x?: number
  y?: number
  width?: number
  /** v2.10: percentage 0-100. Absent ⇒ auto-fit from content (current behavior).
      Present ⇒ explicit box height; renderer pins the box to this height and
      the inner text overflows / aligns within it according to vertical-align. */
  height?: number
}
```

### Optional companion field — `font_scale_locked?: boolean`

If we ship the "scale font with box" UX (corner-drag-with-shift), we have two implementation options:

1. **Implicit:** corner-drag computes a font_size delta and dispatches it alongside `height`. The new `font_size` is just a number on `TextBox`. No schema change beyond `height`.
2. **Explicit:** add `font_scale_locked?: boolean` to `TextBoxPosition` so the renderer always re-computes font from box dimensions.

**Recommend implicit (option 1).** It matches Canva/Figma — the user manipulates a number that's already on the element; no hidden state. `font_size` is already a top-level field on `TextBox` (`slide.ts:97`).

---

## Renderer changes (3 paths)

### Where height is consumed today

| Path | Current state | Change needed |
|---|---|---|
| `src/components/slides/slide-preview.tsx` (lines 588, 608 — non-editable; 911-930, 985-1004 — editable) | Hook/body wrappers have **no height set** on the inner `<div>` — height comes from text content. | Wrapper inherits `height: ${resolvedHeight}%` when set; add `display: flex` + `flexDirection: column` + `justifyContent: 'center'` to vertically center text in the box (or expose alignment field, see Open Q below). |
| `src/lib/render/render-slide.ts` (lines 230-258, `.hook` / `.body` rules) | Same — width-only positioning. | Same — add explicit `height: ${resolvedHeight}%` to the rule when set. |
| `src/lib/render/render-slide-satori.tsx` (lines 196-208 hookStyle, 224-236 bodyStyle, 453-477 custom_texts) | Same — width-only. | Same — add `height: pxY(resolvedHeight)` to the style when set. **Satori caveat:** Satori already respects explicit numeric `height` on absolute children (verified in v2.9 bottom-card pattern at `render-slide-satori.tsx:298-316`), so this is a known-good path. |

### Where the auto-fit fallback lives

**Recommend a new shared helper at `src/lib/render/resolve-overlay.ts`** (or a new file `src/lib/render/resolve-textbox.ts` if the maintainer prefers to keep `resolve-overlay.ts` focused on overlays — both work).

Add a function:

```ts
// src/lib/render/resolve-overlay.ts (new export, ~30 lines)
export interface ResolvedTextBoxBounds {
  x: number       // percent 0-100
  y: number       // percent 0-100
  width: number   // percent 0-100
  height?: number // percent 0-100; UNDEFINED ⇒ caller renders without height (auto-fit)
}

/**
 * v2.10 (TPLREND-05 parity): resolve final pixel/percentage bounds for a
 * TextBox given its anchor + overrides + template defaults. All 3 renderers
 * must call this so width/height/x/y resolution stays in sync.
 *
 * Returns `height: undefined` when the box should auto-fit content (current
 * behavior). Returns a number when the user has explicitly resized.
 */
export function resolveTextBoxBounds(
  box: TextBox,
  ctx: { template: SlideTemplate; slide: Slide; role: TextBoxRole },
): ResolvedTextBoxBounds { ... }
```

Then, all 3 renderers stop computing `hookX`, `hookY`, `hookWidth` inline and instead call `resolveTextBoxBounds(hookBox, { template, slide, role: 'hook' })`. Same call site swap in 3 files.

### TPLREND-05 parity contract — mandatory test

The v2.7 / v2.9 milestones locked a render-parity invariant: every visual change ships with a parity test that asserts both renderers produce identical output for a given slide.

For v2.10, add to `src/lib/render/__tests__/parity.test.tsx`:

1. Box with `height: 30` (% — explicit) ⇒ Satori PNG height ≈ 576px (30% of 1920); React preview wrapper computed style `height` ≈ 30% of container.
2. Box without `height` ⇒ both renderers omit the height property (visually auto-fit, byte-identical to v2.9 baseline for legacy slides).
3. Round-trip via `applyDualWrite` ⇒ legacy `hook_height` / `body_height` not added (see SlideStyleOverrides decision below).

---

## react-rnd integration changes

### Where the `<Rnd>` instances live (file + line)

`src/components/slides/slide-preview.tsx`:
- **Line 860** — hook `<Rnd>` (editable branch only)
- **Line 935** — body `<Rnd>` (editable branch only, gated on `slide.body_text`)
- **Line 1023** — custom-text `<Rnd>` (one per `slide.custom_texts[]`)
- **Line 1156** — custom-image `<Rnd>` — already supports all 8 handles + `lockAspectRatio={true}`. **This is the precedent to copy.**

### Current dispatch shape (resize)

Lines 889-897 (hook resize-stop), 964-972 (body resize-stop), 1062-1068 (custom-text resize-stop) all share the same handler signature:

```ts
onResizeStop={(_e, _dir, ref, _delta, position) => {
  const newWidthPct = Math.max(20, Math.min(100, (parseInt(ref.style.width) / REF_WIDTH) * 100))
  onWidthChange?.('hook', Math.round(newWidthPct))
  if (onPositionChange) {
    const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH) * 100))
    const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
    onPositionChange('hook', { x: percentX, y: percentY })
  }
}}
```

Width and position are dispatched as **two separate calls** to two separate handlers (`onWidthChange`, `onPositionChange`). Both handlers in `slide-editor.tsx` (lines 405-454) then synchronously update both `style_overrides.{hook,body}_{position,width}` AND the matching entry in `text_boxes[]`.

### Minimum-touch change

Two surgical edits:

#### Edit 1: `slide-preview.tsx:801-810` — flip the gate

```ts
// BEFORE (current — left/right only)
const enableResizing = {
  left: true, right: true,
  top: false, bottom: false,
  topLeft: false, topRight: false, bottomLeft: false, bottomRight: false,
}

// AFTER (v2.10 — all 8 handles)
const enableResizing = {
  left: true, right: true,
  top: true, bottom: true,
  topLeft: true, topRight: true, bottomLeft: true, bottomRight: true,
}
```

Plus expand `resizeHandleStyles` (lines 812-815) to all 8 positions — the custom-image branch at lines 1173-1182 is the exact recipe.

#### Edit 2: extend the `onResizeStop` callbacks to also emit height

Three call-sites (hook, body, custom) all gain:

```ts
onResizeStop={(_e, _dir, ref, _delta, position) => {
  const newWidthPct  = Math.max(20, Math.min(100, (parseInt(ref.style.width)  / REF_WIDTH)  * 100))
  const newHeightPct = Math.max(5,  Math.min(100, (parseInt(ref.style.height) / REF_HEIGHT) * 100))
  onSizeChange?.('hook', { width: Math.round(newWidthPct), height: Math.round(newHeightPct) })
  if (onPositionChange) {
    const percentX = Math.max(0, Math.min(100, (position.x / REF_WIDTH)  * 100))
    const percentY = Math.max(0, Math.min(100, (position.y / REF_HEIGHT) * 100))
    onPositionChange('hook', { x: percentX, y: percentY })
  }
}}
```

**Note:** the new callback is `onSizeChange` (not `onWidthChange`). Either:

- **A — additive:** add `onSizeChange?: (field, { width, height }) => void` alongside `onWidthChange`, deprecate `onWidthChange`. Less risky.
- **B — replace:** rename `onWidthChange` → `onSizeChange`. One commit, but touches every caller.

**Recommend A.** `onWidthChange` keeps working untouched for left/right drags (resize handle of width=true, height=false). For corner / top / bottom drags, dispatch `onSizeChange`. The two coexist trivially; deprecate later.

#### Edit 3: `slide-editor.tsx:433-454` — extend `handleWidthChange` into `handleSizeChange`

```ts
function handleSizeChange(field: 'hook' | 'body', size: { width: number; height: number }) {
  if (!currentSlide) return
  const overrides = currentSlide.style_overrides ?? {}
  const updatedTextBoxes = currentSlide.text_boxes?.map((tb) => {
    if (tb.role !== field) return tb
    return {
      ...tb,
      position: { ...tb.position, width: size.width, height: size.height },
    }
  })
  dispatch({
    type: 'UPDATE_SLIDE',
    index: selectedIndex,
    updates: {
      // Legacy hook_width/body_width still set so applyDualWrite stays in sync.
      style_overrides: {
        ...overrides,
        [field === 'hook' ? 'hook_width'  : 'body_width']:  size.width,
        // No hook_height/body_height legacy field — see Cross-references section.
      },
      ...(updatedTextBoxes ? { text_boxes: updatedTextBoxes } : {}),
    },
  })
}
```

For custom boxes, the existing `UPDATE_TEXT_BOX` action already accepts `Partial<TextBox>` (`editor-actions.ts:26`), so the dispatch is just:

```ts
dispatch({
  type: 'UPDATE_TEXT_BOX',
  slideIndex: selectedIndex,
  textBoxId: id,
  updates: { position: { ...currentTb.position, width, height } },
})
```

**No reducer changes needed.** `applyDualWrite` will already mirror `position.width` to `style_overrides.hook_width`/`body_width` because that pathway is already wired (`text-box-adapter.ts:231,245`).

### Optional: font-scaling on shift+corner

If we ship the "scale font with box" mode (Canva/Figma corner+shift behavior), the `onResizeStop` handler computes a multiplicative font delta:

```ts
const widthRatio = newWidthPct / oldWidthPct
const newFontSize = Math.round((tb.font_size ?? defaultFontSize) * widthRatio)
// dispatch UPDATE_TEXT_BOX with updates: { font_size: newFontSize, position: { ..., width, height } }
```

This is one extra dispatch field; no architectural change. Gate it on `e.shiftKey` (read from the wrapping `_e` argument) or on a UX-decided modifier (Figma uses unmodified corner-drag for proportional resize; we can choose).

---

## Migration story

### Existing slides without height

Every existing slide row in Postgres has `slide_data` JSONB where each text-box `position` object has at most `{ anchor, x?, y?, width? }` — no `height`. After the v2.10 schema patch:

1. **Read path:** when a renderer calls `resolveTextBoxBounds(box, ...)` and `box.position.height === undefined`, the helper returns `{ height: undefined }`. All 3 renderers omit the height CSS / Satori prop in that case, falling back to the current auto-fit behavior. **Existing slides render byte-identical.**

2. **Eager migration on load:** `legacyToTextBoxes` in `text-box-adapter.ts:31-64` does NOT need to populate `height`. The function intentionally only emits position fields that the legacy schema knew about (`x`, `y`, `width`). Leaving `height` undefined is correct and round-trip-safe.

3. **Round-trip via `textBoxesToLegacy`:** at `text-box-adapter.ts:222-251`, the function emits `style_overrides_patch.hook_width` / `body_width` from `position.width`. It does **not** emit a `hook_height` / `body_height` because those fields don't exist in `SlideStyleOverrides`. Round-trip safety is preserved: `legacyToTextBoxes(textBoxesToLegacy(boxes))` reconstructs everything except `height` (which is fine — height isn't a legacy field, so it can only round-trip via `text_boxes[]` itself).

4. **Supabase backfill:** **NOT REQUIRED.** Absence-means-auto-fit is the contract.

### What `text-box-adapter.ts` needs

**One small additive change**: in `text-box-adapter.ts:78-81` (`customTextToBox`) — when migrating legacy `CustomText` to `TextBox`, the legacy `CustomText` interface (`slide.ts:39-48`) already has `height: number` for **custom_images**, but `CustomText` does NOT have height (`slide.ts:23-37`). So custom-text TextBoxes derived from legacy `slide.custom_texts` have no height — perfect, they auto-fit. No change needed.

Inverse path (`textBoxToCustomText` at `text-box-adapter.ts:154-170`): the legacy `CustomText` interface doesn't have a height field, so we don't write one. **No change needed.**

---

## Phase decomposition

### Recommendation: ONE phase, executed in 4 commits

Defense:

1. **Tight feedback loop.** The schema, renderer, and editor changes are mutually coupled — splitting into separate phases means N-1 phases ship a feature half-implemented. A single phase keeps the editor, the export pipeline, and the parity tests landing together.

2. **Surgical surface area.** Total touched files: ~6-7 (schema, 3 renderers, 1 helper, 1 editor wiring, 1 test file). Lines changed estimated <300. Below the threshold where multi-phase decomposition pays for itself.

3. **No prerequisite milestone work.** Unlike v2.9 (which needed Phase 54 infrastructure before Phase 55-58 features), v2.10 adds a thin layer on top of patterns already shipped. There's no "build the foundation, then build the feature" arc.

4. **The TPLREND-05 invariant requires atomic shipping.** Schema-only PR followed by renderer-rewrite PR violates parity for the duration of the gap — Satori would emit one shape and React preview another. Single phase keeps both renderers in lock-step at every commit.

### Decompose into 4 commits inside the phase

| Commit | What | Tests |
|---|---|---|
| C1 | Schema: add `height?` to `TextBoxPosition`. Add `resolveTextBoxBounds` helper. | Helper unit tests (8 cases: anchor/width/height matrix). |
| C2 | Renderer wiring: 3 paths consume `resolveTextBoxBounds`. Behavior unchanged for legacy slides (height undefined). | Parity test asserts byte-identical PNG for v2.9 baseline. |
| C3 | Editor: flip `enableResizing` to all 8 handles; extend `handleSizeChange` to dispatch height. Add `onSizeChange` callback. | Editor test: drag bottom-right handle → text_boxes[hook].position.height updates; undo/redo round-trips. |
| C4 | (Optional) Font-scale-with-box on corner-drag with shift modifier. Right-rail "Reset size" button (clears explicit height). | UX test for shift behavior. |

C4 can be cut if scope tightens. C1-C3 ship the core affordance.

---

## Build order

```
1. Schema patch (slide.ts)
       ↓ unblocks
2. New helper resolveTextBoxBounds (resolve-overlay.ts)
       ↓ unblocks parallel
3a. render-slide-satori.tsx — consume helper for hook/body/custom
3b. render-slide.ts        — consume helper for hook/body/custom
3c. slide-preview.tsx      — consume helper for hook/body/custom (both branches)
       ↓ TPLREND-05 parity tests pass at this gate
4. Editor surface
   - slide-preview.tsx: enableResizing + new resize-handle styles + onSizeChange
   - slide-editor.tsx:  handleSizeChange + dispatch wiring
   - editor-reducer.ts: NO change (UPDATE_TEXT_BOX already accepts position.height)
       ↓ undo/redo + dual-write tests pass
5. Right-rail UX polish (ActiveTextBoxCard or new size widget)
   - Reset-size button → dispatch UPDATE_TEXT_BOX with position.height = undefined
6. Optional font-scaling layer
```

**Critical-path bottleneck:** step 3c. Parity tests can't pass until ALL three renderers consume the helper, because the helper is the only place where `width` defaults are computed. If renderer A uses the helper and renderer B keeps the old inline math, the two render slightly differently (rounding, default-width fallback paths) and parity breaks.

---

## Files touched

| File | New / Modified | LoC est. | Risk | Notes |
|---|---|---|---|---|
| `src/lib/types/slide.ts` | Modified | +5 | LOW | Add `height?: number` to `TextBoxPosition` (line 87 area). |
| `src/lib/render/resolve-overlay.ts` | Modified (additive) | +30-40 | LOW | New `resolveTextBoxBounds` export + `ResolvedTextBoxBounds` interface. Pure function. |
| `src/lib/render/render-slide-satori.tsx` | Modified | ~±20 | MEDIUM | Replace inline width/x/y math at lines 166-175, 196-208, 224-236, 453-477 with helper calls. Risk = Satori's quirky support for explicit `height` on absolute boxes; mitigated by `bottom-card` precedent at line 298 already proving this works. |
| `src/lib/render/render-slide.ts` | Modified | ~±15 | LOW | Same swap at lines 154-166, 230-258. CSS rules accept `height: X%` trivially. |
| `src/components/slides/slide-preview.tsx` | Modified | ~±50 | MEDIUM | Three call-sites (lines 860, 935, 1023) gain `top: true / bottom: true / topLeft: true / topRight: true / bottomLeft: true / bottomRight: true` plus extended resize-handle styles + extended `onResizeStop` to dispatch height + (optionally) font_size. Risk = drag UX feels wrong on text boxes; mitigated by referencing custom-image branch (line 1156) which already does this. |
| `src/components/editor/slide-editor.tsx` | Modified | ~±30 | LOW | Extend `handleWidthChange` (line 433) to `handleSizeChange`; wire `onSizeChange` prop through `slide-canvas.tsx`. |
| `src/components/editor/slide-canvas.tsx` | Modified | ~±5 | LOW | Pass-through `onSizeChange` prop. |
| `src/components/editor/text-rail/ActiveTextBoxCard.tsx` | Modified | ~±20 | LOW | (Optional) "Reset size" button. |
| `src/lib/editor/editor-reducer.ts` | **No change** | 0 | n/a | `UPDATE_TEXT_BOX` already accepts `Partial<TextBox>` including position. `applyDualWrite` already mirrors width to legacy. |
| `src/lib/editor/text-box-adapter.ts` | **No change** | 0 | n/a | Absence-of-height is the migration story. |
| `src/lib/editor/editor-actions.ts` | **No change** | 0 | n/a | Existing action shape already covers this. |
| `src/lib/render/__tests__/parity.test.tsx` | Modified | +30-50 | LOW | Add 2-3 cases: explicit height, undefined height (regression for legacy), round-trip. |
| `src/components/slides/__tests__/slide-preview.test.tsx` | Modified | +20-30 | LOW | Drag test for corner / bottom handle. |

**Total estimated LoC:** ~250-300 net new + modifications across ~9 files. Net-new files: 0 (everything fits into existing files).

---

## Cross-references with `hook_width` / `body_width`

### Are they still in use?

**Yes — but as a derived mirror, not a canonical store.**

Trace:

1. **Canonical write:** editor dispatches `UPDATE_SLIDE` with `text_boxes[i].position.width` and `style_overrides.hook_width` together (`slide-editor.tsx:439-453`).
2. **Reducer dual-write:** `applyDualWrite` (`editor-reducer.ts:22-55`) calls `textBoxesToLegacy(nextTextBoxes)` and merges the resulting `style_overrides_patch` (which contains `hook_width`/`body_width`) into `slide.style_overrides`.
3. **Renderer reads:** all 3 renderers currently read `overrides.hook_width` / `overrides.body_width` (e.g. `render-slide.ts:165, render-slide-satori.tsx:172, slide-preview.tsx:368`) — NOT `text_boxes[i].position.width`.

So the renderer read path is still legacy-shape. The `text_boxes[].position.width` field is the **canonical write**, but `style_overrides.hook_width`/`body_width` is the **canonical read** as of v2.9.

### Should we add `hook_height` / `body_height` to `SlideStyleOverrides`?

**NO for v2.10. Reasoning:**

- `hook_height` / `body_height` would only make sense as a legacy mirror — but no legacy reader exists. The whole point of legacy fields was that v1.0-v2.7 code paths already read them. v2.10's height feature is brand-new; nothing in the legacy world ever read a height field for text boxes.

- The renderer migration story (already locked in MIGRATION-NOTES.md) says: in v2.9 sunset (post-PMF), all 3 renderers will be rewritten to read directly from `text_boxes[]`. Adding `hook_height`/`body_height` now creates *new* legacy fields that the future sunset would also have to remove — net-negative.

- Renderers in v2.10 should read `box.position.height` directly via the new `resolveTextBoxBounds` helper. This means `hook_height`/`body_height` is the FIRST text-box positioning field that breaks the "render reads legacy, write goes through dual-write" pattern. That's fine — it's the seed of the v3.0+ sunset path. v2.10 effectively prototypes the read-from-text_boxes pattern for one field; the rest can follow when the milestone is right.

- This means `applyDualWrite` does NOT need an update: the legacy slice it produces (via `textBoxesToLegacy`) doesn't include height, and we don't want it to.

### Specifically what NOT to do

1. **Don't** add `hook_height?` / `body_height?` to `SlideStyleOverrides`.
2. **Don't** extend `LegacySlice.style_overrides_patch` to carry height.
3. **Don't** update `text-box-adapter.ts` to read/write height.

These are all green flags that the new field is correctly scoped to `text_boxes[]` only.

### MIGRATION-NOTES.md update

Add a short note to `.planning/MIGRATION-NOTES.md` under the "v2.9 Sunset Checklist" section:

> **v2.10 — first read-from-text_boxes field.** `position.height` is intentionally not mirrored to `SlideStyleOverrides`. All 3 renderers read it directly via `resolveTextBoxBounds`. When the v2.9 sunset eventually lands, this is the pattern to apply to `position.width`, `position.x`, `position.y` — direct read from `text_boxes[]`, eliminate the legacy mirror.

---

## Data-flow diagram (Rnd drag → reducer → renderer)

```
USER DRAGS BOTTOM-RIGHT CORNER OF HOOK BOX
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  <Rnd>  (slide-preview.tsx:860)                        │
│  enableResizing.bottomRight = true ◄── v2.10 flip      │
│  onResizeStop fires with ref.style.{width,height}      │
└────────────────────────────────────────────────────────┘
                    │
                    │ width: '420px', height: '180px', position: {x: 120, y: 250}
                    ▼
┌────────────────────────────────────────────────────────┐
│  Resize handler in slide-preview.tsx:889 (modified)    │
│  - Convert px → percent of REF_WIDTH/REF_HEIGHT        │
│  - Clamp to [5, 100]                                   │
│  - onSizeChange?.('hook', {width: 39, height: 9})      │
│  - onPositionChange?.('hook', {x: 11, y: 13})          │
└────────────────────────────────────────────────────────┘
                    │
                    │ two callbacks (Edit 2 above) — could be one
                    ▼
┌────────────────────────────────────────────────────────┐
│  handleSizeChange (slide-editor.tsx:433, modified)     │
│  - Build updatedTextBoxes with position.{width,height} │
│  - dispatch UPDATE_SLIDE { text_boxes, style_overrides:│
│      { hook_width: 39 } }   // no hook_height          │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│  editorReducer (editor-reducer.ts:141, UPDATE_SLIDE)   │
│  - Merge updates into slide                            │
│  - Note: applyDualWrite is NOT invoked here — that fires│
│    only for ADD/UPDATE/REMOVE_TEXT_BOX. UPDATE_SLIDE   │
│    expects callers to maintain text_boxes themselves   │
│    (which slide-editor.tsx does, line 411-422 pattern).│
│  - pushHistory → adds one undo step                    │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
        Slide state updated; React re-renders
                    │
                    ├─────────────────────────────────────┐
                    ▼                                     ▼
┌───────────────────────────────┐   ┌────────────────────────────────┐
│  SlidePreview (live preview)  │   │  /api/render → buildSlideElement│
│  reads:                       │   │  reads:                         │
│  - resolveTextBoxBounds(hook) │   │  - resolveTextBoxBounds(hook)   │
│    → {width:39, height:9}     │   │    → same                       │
│  - applies as % CSS           │   │  - applies as Satori px         │
└───────────────────────────────┘   └────────────────────────────────┘
                    │
                    ▼
        TPLREND-05 parity: byte-identical
        (asserted by parity.test.tsx, v2.10 cases)
```

Note that `UPDATE_SLIDE` does **not** fire `applyDualWrite` — that helper only runs in `ADD/UPDATE/REMOVE_TEXT_BOX` cases (`editor-reducer.ts:265, 276, 287`). The `slide-editor.tsx:handleWidthChange` handler at line 433 already keeps both shapes in sync manually by including both `text_boxes` and `style_overrides` in the same dispatch. We follow the same pattern in `handleSizeChange` — minimum surprise, mirrors the existing path.

For the `UPDATE_TEXT_BOX` path used by custom-text resize (slide-preview.tsx:1062 → slide-editor.tsx:handleCustomTextWidthChange — though current code dispatches `UPDATE_CUSTOM_TEXT` not `UPDATE_TEXT_BOX`; see open question below), `applyDualWrite` does fire and mirrors `position.width` to legacy. It does NOT mirror height, intentionally.

---

## Open questions for roadmapper

1. **Vertical alignment within the box.** When `position.height` is explicit, where does the text sit vertically? Top-aligned (current default — text starts at the top edge), center-aligned (CSS `align-items: center` on a flex column), or user-controlled? **Recommend center-aligned default** with optional override field on `TextBox` (e.g. `vertical_align?: 'top' | 'center' | 'bottom'`). Defer the override field to v2.11 unless user testing shows it's needed.

2. **Custom-text resize path inconsistency.** `slide-preview.tsx:1062` (custom-text `onResizeStop`) calls `onCustomTextWidthChange?.(...)` which dispatches `UPDATE_CUSTOM_TEXT` (not `UPDATE_TEXT_BOX`). The custom-text resize handler should arguably dispatch `UPDATE_TEXT_BOX` directly so it consistently flows through the unified path. **Recommend this is a 5-line cleanup commit inside v2.10**, since we're already touching the resize handlers. Low risk because `applyDualWrite` (currently invoked by `UPDATE_TEXT_BOX`) will derive the legacy `custom_texts` slice via `textBoxesToLegacy`. But it's a behavior change — verify with a test.

3. **Font-scaling UX call.** Three options for v2.10:
   - **(a) Box-only resize, font_size unchanged.** Simpler. Matches Figma default.
   - **(b) Corner = scale font; sides = resize box only.** Matches Canva.
   - **(c) Shift+corner = scale font; corner = resize box.** Matches Photoshop / Figma's "scale" tool.
   Pre-PMF, **recommend (a)** — ship the affordance, get user feedback, layer (c) in v2.11 if requested. Avoids upfront UX bikeshedding.

4. **Min-size clamps.** `slide-preview.tsx:890` currently clamps width to `[20, 100]`. Custom images at line 1215 clamp to `[5, 100]`. For text-box height, what's the floor? **Recommend `[5, 100]`** (custom-image precedent). 5% of 1920 = 96px — below that the text overflows pretty much any font_size, and we want users to be able to resize-without-losing-text via the "Reset size" button.

5. **Reset-size affordance.** When a user has explicitly resized and wants to revert to auto-fit, they need a UX path. **Recommend** a button in `ActiveTextBoxCard` (`src/components/editor/text-rail/ActiveTextBoxCard.tsx`) that dispatches `UPDATE_TEXT_BOX` with `position.height: undefined`. Single click, instant revert. Surface near the existing position controls.

6. **AI ingest boundary.** `legacyToTextBoxes` runs in `generate-slides.ts` post-Zod-parse (Phase 51). Newly-generated slides will have undefined `height` ⇒ auto-fit. Confirm with a test that AI generation doesn't accidentally synthesize a height value. (No code change expected; just regression coverage.)

7. **Optional companion: aspect-ratio lock.** Photoshop / Figma offer shift-corner-drag to maintain aspect ratio. react-rnd supports `lockAspectRatio={true}` (already used at `slide-preview.tsx:1162` for custom-images). For text boxes, aspect-lock is less natural (text reflows), but worth considering as a power-user feature. **Recommend defer to user feedback.**

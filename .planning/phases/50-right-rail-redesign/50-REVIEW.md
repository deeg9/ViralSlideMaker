---
phase: 50-right-rail-redesign
reviewed: 2026-04-30T00:00:00Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - src/components/editor/text-rail/LayerStrip.tsx
  - src/components/editor/text-rail/EffectRow.tsx
  - src/components/editor/text-rail/AccentWordsDisclosure.tsx
  - src/components/editor/text-rail/ActiveTextBoxCard.tsx
  - src/components/editor/text-rail/SlideSettings.tsx
  - src/components/editor/text-rail/color-swatches.ts
  - src/lib/editor/text-segments.ts
  - src/components/editor/text-editor-panel.tsx
  - src/components/editor/text-editor-panel-legacy.tsx
  - src/components/editor/slide-editor.tsx
  - src/lib/editor/use-slide-editor.ts
findings:
  blocking: 1
  high: 1
  medium: 3
  low: 5
  nit: 4
  total: 14
status: findings
---

# Phase 50: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** deep
**Files Reviewed:** 11
**Status:** findings

## Summary

The Phase 50 right-rail redesign cleanly extracts 6 well-isolated text-rail components and faithfully wires the feature flag, selection state, and `onTextBoxAction` shape laid out in the plan. Component-level quality is high: pure presentational seams, consistent token usage (no off-brand colors introduced), and idiomatic React.

**However, the panel is functionally broken in the live editor.** The new `ActiveTextBoxCard` writes ALL edits (text, color, font, size, weight, italic, align, segments, effects) to `slide.text_boxes[i].*` only — but the canvas (`SlidePreview`) reads exclusively from `slide.hook_text`, `slide.body_text`, `slide.hook_segments`, `slide.body_segments`, and `slide.style_overrides.{hook,body}_text_color`. Dual-write happens only in `doSave` (`textBoxesToLegacy`), so users see ZERO live preview update for any per-text-box edit until a save round-trip + reload. Plan D-11 ("dual-write ensures legacy fields stay in sync at save time") sized this risk wrong — save-time sync ≠ live-preview sync, because `doSave` builds `slidesForSave` locally for the server call but never re-dispatches the legacy slice into reducer state.

Beyond that BLOCKER, `removeTextBox` (the hook-level helper that clears stale `selectedTextBoxId`) is destructured but never called — the new `onTextBoxAction` REMOVE_TEXT_BOX path bypasses it. There's no Delete affordance in the new card today so it's latent, but the safety net is wired to nothing. Slide-switch seeding (T-04) only re-runs on `selectedIndex` change, so adding a text box leaves `selectedTextBoxId` stale until manual click. Several a11y gaps (unlabeled textarea/sliders, `tablist` without `tabpanel`).

## Blocking Issues

### BL-01: New panel edits never propagate to canvas live preview

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx:172, 195, 209, 248, 264, 280, 305, 334, 346, 358` (every `onUpdate` call) + `src/components/editor/text-editor-panel.tsx:74-81` + `src/lib/editor/editor-reducer.ts:221-230`
**Issue:** `updateActiveTextBox` dispatches `UPDATE_TEXT_BOX`, which in `editor-reducer.ts:221-230` mutates only `slide.text_boxes[i]`. The renderer (`src/components/slides/slide-preview.tsx:242-249, 541-562, 841-904`) reads only `slide.hook_text`, `slide.body_text`, `slide.hook_segments`, `slide.body_segments`, and `slide.style_overrides.{hook,body}_text_color/font_*`. Dual-write via `textBoxesToLegacy` runs inside `doSave` (`slide-editor.tsx:122-143`) but only builds `slidesForSave` for the server call — the local `slides` reducer state never receives the legacy slice. Result: the user types into the new textarea, picks a color, toggles bold, drags the size slider — **the canvas shows nothing changed** until a full reload from the server.

This is the primary feature being shipped ("selection-driven, single-element panel"). The legacy panel had no such gap because every handler wrote directly to the legacy fields the canvas reads.

Easiest verification: in dev, edit a hook text box's color via the new panel; the canvas keeps the old color. Press Save, wait, hard-refresh — color appears.
**Fix:** Either (a) make the reducer's `UPDATE_TEXT_BOX` / `ADD_TEXT_BOX` / `REMOVE_TEXT_BOX` cases write-through the legacy slice via `textBoxesToLegacy` so the canvas stays in sync, or (b) point `SlidePreview` (and any other live-render path) at `slide.text_boxes[]` when present and fall back to legacy. (a) is cheaper; (b) is the correct long-term direction Phase 49 set up. Whichever path you pick, every live-render path must agree on the canonical source. Concretely for (a):

```ts
case 'UPDATE_TEXT_BOX': {
  const slides = state.present.map((slide, i) => {
    if (i !== action.slideIndex) return slide
    const text_boxes = (slide.text_boxes ?? []).map((tb) =>
      tb.id === action.textBoxId ? { ...tb, ...action.updates } : tb
    )
    // Phase 50 fix: write-through to legacy so live canvas reads stay current.
    const legacy = textBoxesToLegacy(text_boxes)
    return {
      ...slide,
      text_boxes,
      hook_text: legacy.hook_text,
      body_text: legacy.body_text,
      ...(legacy.hook_segments !== undefined ? { hook_segments: legacy.hook_segments } : {}),
      ...(legacy.body_segments !== undefined ? { body_segments: legacy.body_segments } : {}),
      style_overrides: {
        ...(slide.style_overrides ?? {}),
        ...legacy.style_overrides_patch,
      },
    }
  })
  return pushHistory(state, slides)
}
```

Add a regression test that mounts `<SlideEditor>` with `useNewRail=true`, fires a color-swatch click on the active card, and asserts the SlidePreview's hook span reflects the new color before any save runs.

## High

### HR-01: `removeTextBox` selection-clear helper is exported but never used

**File:** `src/lib/editor/use-slide-editor.ts:42-45, 62, 64` + `src/components/editor/slide-editor.tsx:511-517`
**Issue:** `useSlideEditor` exposes `removeTextBox(slideIndex, textBoxId)` whose entire purpose is to dispatch `REMOVE_TEXT_BOX` AND clear `selectedTextBoxId` if it matched (the docblock explicitly cites Phase 49 MR-03 to prevent foot-guns). `slide-editor.tsx` destructures `setSelectedTextBoxId` but NOT `removeTextBox`, and the `onTextBoxAction` handler at lines 511-517 dispatches `REMOVE_TEXT_BOX` directly via `dispatch`, bypassing the selection-clear.

The new `ActiveTextBoxCard` ships without a Delete affordance today, so this is latent. But the comment block at use-slide-editor.ts:38-41 names the new panel as the first consumer that would otherwise foot-gun, and any future delete affordance (hot-key, context menu, or Plan 51/52 follow-up) will inherit the bug for free.
**Fix:** Wire `removeTextBox` into the `onTextBoxAction` handler:

```tsx
// slide-editor.tsx
const { ..., setSelectedTextBoxId, removeTextBox } = useSlideEditor(initialSlides)
// ...
} else if (action.type === 'REMOVE_TEXT_BOX') {
  removeTextBox(selectedIndex, action.textBoxId)
}
```

## Medium

### MR-01: Slide-switch seeding doesn't re-run on text_boxes mutation

**File:** `src/components/editor/slide-editor.tsx:103-114`
**Issue:** The seeding effect depends only on `selectedIndex` (with an explicit `eslint-disable-next-line` ignoring `slides`/`text_boxes`). Two consequences:

1. After `+ Add Text Box` on a slide that started empty (`selectedTextBoxId === null`), the new chip appears but `selectedTextBoxId` stays null. `LayerStrip` highlights nothing (no chip has `aria-selected=true`), while `ActiveTextBoxCard`'s resolver falls through to `textBoxes[0]` and shows the new card content. Visual mismatch: the card edits a box that has no highlighted chip.
2. If an external action (Phase 51 AI regen, undo/redo crossing a REMOVE_TEXT_BOX) mutates `text_boxes` such that `selectedTextBoxId` becomes stale, the chip strip again shows nothing selected while the card silently rebinds to box 0.
**Fix:** After the dispatch in the `+ Add` branch, also call `setSelectedTextBoxId(newId)`. The reducer doesn't return the new id, so either (a) compute it from `crypto.randomUUID()` outside dispatch and pass via the action's `defaults`, or (b) let the seeding effect react to `slides[selectedIndex]?.text_boxes`:

```ts
useEffect(() => {
  setSelectedCustomTextId(null)
  setSelectedCustomImageId(null)
  setSelectedTextBoxId((current) => {
    const tb = slides[selectedIndex]?.text_boxes
    if (!tb || tb.length === 0) return null
    if (current && tb.some((b) => b.id === current)) return current
    return tb[0].id
  })
}, [selectedIndex, slides])
```

This covers both the slide-switch reset and the post-mutation reseat without needing to know which dispatch triggered it.

### MR-02: New panel has no way to delete a text box

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx` (entire file)
**Issue:** The legacy panel exposed Delete buttons for hook/body and a "Delete Text Box" button on custom-text. The new `ActiveTextBoxCard` has neither. With the feature flag default `true`, users can ADD text boxes (`+ Add Text Box` chip) but cannot REMOVE them — the only way to reduce text is via canvas selection of free-positioned customs (which goes through `CustomTextEditor`, not the new card). Hooks and body created via legacy migration are now permanent for the slide.

If this is intentional v2.8 scope-cutting, document it in 50-CONTEXT.md decisions; if it's an oversight, add a Delete affordance dispatching `REMOVE_TEXT_BOX` (and using `removeTextBox` per HR-01).
**Fix:** Add a Delete button to the card (or to each LayerStrip chip on hover/right-click). Routes to `onTextBoxAction({ type: 'REMOVE_TEXT_BOX', textBoxId })`. Confirm in plan/spec whether deletion is in scope before implementing.

### MR-03: `splitToSegments` recomputed every render breaks downstream memoization

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx:100`
**Issue:** `const segments = textBox.segments ?? splitToSegments(textBox.text)` — when `textBox.segments` is undefined (i.e., the user hasn't toggled accent yet, which is the COMMON case), `splitToSegments` runs on every render and allocates a fresh array. This array is passed to `<AccentWordsDisclosure segments={segments}>`, so the disclosure (and its inner chip-wall when open) always sees a new ref, defeating any future React.memo/useMemo optimization downstream. Also a hidden bug surface: if rendering becomes expensive (long body text), the cost is per-keystroke.
**Fix:**

```ts
const segments = useMemo(
  () => textBox.segments ?? splitToSegments(textBox.text),
  [textBox.segments, textBox.text]
)
```

Same pattern applies to `const effects: TextEffects = textBox.effects ?? {}` on line 99 — `{}` literal allocation per render.

## Low

### LR-01: Textarea has no accessible label

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx:169-176`
**Issue:** The `<textarea>` relies on `placeholder` and a sibling `<span>` showing "HOOK TEXT" / "BODY TEXT" / "TEXT BOX" for context, but has no `aria-label`, `aria-labelledby`, or wrapping `<label>`. Screen readers announce only role + placeholder once focused.
**Fix:** Either give the role-label span an `id` and reference it via `aria-labelledby`, or pass `aria-label={roleLabel(textBox.role)}` directly on the textarea.

### LR-02: Range sliders unlabeled for assistive tech

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx:241-250` (size), `482-491` (outline width), `558-567` (highlight padding); `src/components/editor/text-rail/SlideSettings.tsx:94-110` (overlay)
**Issue:** Each `<input type="range">` has a sibling SPAN label and a SPAN value readout, but no `aria-label`/`aria-labelledby`. Screen readers announce "slider, X of Y" with no context about WHAT is being adjusted. Same a11y gap exists in the legacy panel — but this rewrite was an opportunity to fix.
**Fix:** Add `aria-label={sizeLabel(textBox.role)}` (or labelledby) to each range input. Cheap and improves a11y posture for the v2.8 ship.

### LR-03: Bold/Italic/Align icon-only buttons rely on `title`, not `aria-label`

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx:191-218, 300-315`
**Issue:** Icon-only buttons use `title="Bold"` / `title="Italic"` / `title={value}`. `title` shows on mouse hover but is inconsistently announced by screen readers (especially on touch). `aria-label` is the standardized affordance for icon-only buttons.
**Fix:** Replace each `title="Bold"` / `title={value}` with `aria-label="Bold"` / `aria-label={\`Align ${value}\`}` (keep `title` if you want hover tooltip too).

### LR-04: `tablist` semantics on LayerStrip without `tabpanel` on ActiveTextBoxCard

**File:** `src/components/editor/text-rail/LayerStrip.tsx:53-58, 65-66`
**Issue:** LayerStrip declares `role="tablist"` with each chip `role="tab"` + `aria-selected`. ARIA pattern mandates a corresponding `role="tabpanel"` for the content controlled by the active tab, plus `aria-controls` linking tab → panel and `aria-labelledby` linking panel → tab. None of those exist on `ActiveTextBoxCard`. Screen reader users hear "tab selected" with no panel relationship.
**Fix:** Two options: (a) add `role="tabpanel"`, generated `id`, `aria-labelledby` on the card and corresponding `aria-controls` on chips; or (b) drop the `tablist`/`tab` roles and use `role="radiogroup"` + `role="radio"` semantics (closer to the actual UX — single selection from a row of pickers, no panel switch animation).

### LR-05: Custom color picker `<label>` has no accessible name

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx:275-283, 409-417, 465-473, 524-532`
**Issue:** Each "+" custom-color picker is a `<label>` wrapping `<Icon name="palette">` and an `<input type="color" className="sr-only">`. The label has no text content, so screen readers announce an unlabeled color picker. (Same pattern in legacy.)
**Fix:** Add `aria-label="Custom color"` to the `<input type="color">` directly. The `<label>` element is acting as a styled clickable surface, not an a11y label.

## Nit

### NT-01: Inline `effects ?? {}` allocates on every render

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx:99`
**Issue:** Same allocation-per-render issue as MR-03 (segments) but for the effects object. Spread ops `...(effects.shadow ?? DEFAULT_SHADOW)` are fine, but `effects = textBox.effects ?? {}` produces a new identity each render.
**Fix:** Wrap in `useMemo` or destructure shadow/outline/highlight individually with their own `??` defaults.

### NT-02: Magic number `PREVIEW_CHARS = 16` could be exposed via prop

**File:** `src/components/editor/text-rail/LayerStrip.tsx:14, 16-21`
**Issue:** Truncation at 16 chars is a UX choice that may need tuning. As a const, it's fine for v2.8. NIT only because future-design might want different lengths per chip role (hook chips wider than custom).
**Fix:** Accept; revisit in Phase 51/52 if needed.

### NT-03: `data-active` boolean serialized as string in multiple places

**File:** `src/components/editor/text-rail/LayerStrip.tsx:69`, `ActiveTextBoxCard.tsx:194, 208, 304`, `EffectRow.tsx:34`
**Issue:** `data-active={active ? 'true' : 'false'}` is consistent project convention (verified against legacy panel) but verbose. Could centralize via `data-active={String(active)}` or a tiny helper. Pure style nit — no behavioral concern.
**Fix:** None required.

### NT-04: `parseInt(template.hookFontSize) || 48` masks legitimate "0px" templates

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx:370-372`
**Issue:** `parseInt(template.hookFontSize) || 48` — `parseInt('0px')` returns 0, then `0 || 48` returns 48. No template currently sets a 0 size, so latent only. Use `??` instead of `||` if `parseInt` produced a numeric NaN check, but `Number.isFinite` is the cleanest:

```ts
const parsed = parseInt(template.hookFontSize, 10)
return Number.isFinite(parsed) && parsed > 0 ? parsed : 48
```

**Fix:** None required for v2.8 ship. Worth tightening if a brand-kit ever sets 0/empty.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

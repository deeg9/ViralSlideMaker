---
slug: drop-photo-treatment-white-cards
date: 2026-05-14
status: complete
---

# Drop Photo Treatment card; make Slide Settings + Watermark cards white

User asked to remove the PHOTO TREATMENT card (B&W toggle / Duotone /
Grain) from the right rail and switch the Slide Settings + Watermark
cards from pinkish cream to white so they match the hook-text card at
the top.

## What changed

### Photo Treatment unmounted

- `text-editor-panel.tsx` — dropped the `<PhotoTreatmentControls>` JSX
  block, the `PhotoTreatmentControls` + `TreatmentSpec` import, and the
  `onSlideTreatmentChange` + `isTreatmentPending` props from the panel's
  public surface.
- `slide-editor.tsx` — dropped the `handleSlideTreatmentChange`
  callback, the `useTransition` for `isTreatmentPending`, the
  `TreatmentSpec` + `updateSlideTreatment` imports, and the two render
  props at the `<TextEditorPanel>` call site.
- `photo-treatment-controls.tsx` and its standalone test file kept
  in-place (dead but trivially re-mountable); the reducer slot
  (`style_overrides.treatment_applied / .grain_intensity`) is preserved
  so legacy slides still render their treated background unchanged.
- `text-editor-panel-composition.test.tsx` — composition-order test
  updated to assert the new order (`layer-strip → active-text-box-card →
  slide-settings → watermark-controls`) + a new negative assertion that
  `photo-treatment-controls` is no longer mounted in the rail.

### White-card pattern for Slide Settings + Watermark

- `SlideSettings.tsx:37` — `bg-[#fff0f0] border border-[#fadbdb]` →
  `bg-white border-2 border-[#3d0000]/20`. Same radius / padding.
- `watermark-controls.tsx:80` — same swap.

Both now match the `ActiveTextBoxCard` chrome (`bg-white` + brand-toned
border) — minus the `focus-within` outline since these cards have no
single primary focusable input.

## Tests

- 180/180 across `text-editor-panel-composition`,
  `photo-treatment-controls`, `watermark-controls`, and `SlideSettings`
  test suites pass.
- TS clean on touched files.

## Files touched

- `src/components/editor/text-editor-panel.tsx`
- `src/components/editor/slide-editor.tsx`
- `src/components/editor/text-rail/SlideSettings.tsx`
- `src/components/editor/watermark-controls.tsx`
- `src/components/editor/__tests__/text-editor-panel-composition.test.tsx`

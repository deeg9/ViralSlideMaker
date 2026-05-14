---
slug: move-slide-cards-to-elements
date: 2026-05-14
status: complete
---

# Move SlideSettings + WatermarkControls from TEXT tab to ELEMENTS tab

User asked to move the SLIDE SETTINGS card (News Layout + Overlay slider)
and the WATERMARK card from the TEXT tab to the ELEMENTS tab — they're
slide-level controls and don't fit semantically under "text".

## What changed

### `elements-panel.tsx`
- Imported `SlideSettings` from `./text-rail/SlideSettings` and
  `WatermarkControls` (+ `WatermarkSpec` type) from `./watermark-controls`,
  plus the `SlideTemplate` type.
- Added six new props: `template`, `onSlideUpdate`, `userTier`,
  `onSlideWatermarkChange`, `onWatermarkLogoUpload`,
  `onWatermarkLogoRemove`, `isWatermarkPending`. All optional so existing
  isolated unit tests keep working.
- Built a shared `slideLevelCards` fragment (rendered only when slide +
  template + onSlideUpdate are present) and mounted it at the bottom of
  BOTH render paths — selection mode (after DecorationCard) and library
  mode (after the dividers section).

### `text-editor-panel.tsx`
- Dropped the `SlideSettings` + `WatermarkControls` + `WatermarkSpec`
  imports.
- Dropped both JSX blocks; replaced with a short comment block noting
  where they moved.
- Removed five now-dead props from `TextEditorPanelProps`: `userTier`,
  `onSlideWatermarkChange`, `onWatermarkLogoUpload`,
  `onWatermarkLogoRemove`, `isWatermarkPending`.

### `slide-editor.tsx`
- Removed those same five watermark props from the `<TextEditorPanel>`
  call.
- Passed `template`, `onSlideUpdate={handleUpdate}` (existing slide-level
  dispatcher at line 1061), and the five watermark props to
  `<ElementsPanel>`. `handleSlideWatermarkChange`, `isWatermarkPending`,
  and the logo callbacks all stay defined in slide-editor — only the
  consumer wire moved.

### `text-editor-panel-composition.test.tsx`
- Composition-order assertion trimmed: locked order is now just
  `layer-strip → active-text-box-card`.
- New negative assertion: `slide-settings` and `watermark-controls` are
  NOT mounted in the TEXT tab anymore.

## Tests

- 227/227 across `text-editor-panel-composition`,
  `elements-panel-decoration-card`, `watermark-controls`, and
  `SlideSettings` suites pass.
- TS clean on the four touched files.

## Files touched

- `src/components/editor/elements-panel.tsx`
- `src/components/editor/text-editor-panel.tsx`
- `src/components/editor/slide-editor.tsx`
- `src/components/editor/__tests__/text-editor-panel-composition.test.tsx`

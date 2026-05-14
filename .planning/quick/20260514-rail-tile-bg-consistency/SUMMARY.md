---
slug: rail-tile-bg-consistency
date: 2026-05-14
status: complete
---

# Make Elements + Images tab tiles use the same pill bg as the Text tab

User: the TEXT tab controls (FontPicker, list/indent/align buttons) all use
the same pinkish `#fff0f0` pill background. The ELEMENTS tab tiles use a
slightly different `#fdf7f2` and the IMAGES tab action buttons are
transparent by default. Make them all match the Text tab pattern.

## What changed

### `elements-panel.tsx`
- Icons tile, Shapes tile, and all Lines & Dividers tile buttons:
  `bg-[#fdf7f2] hover:bg-[#fff0f0]` → `bg-[#fff0f0] hover:bg-[#fadbdb]`.
  Same hover-darkens-to-`#fadbdb` pattern the TEXT tab uses.

### `image-picker-panel.tsx`
- Regenerate Text + Regenerate Image buttons (currently transparent
  default): added `bg-[#fff0f0]` default; hover stays the same brand
  darken (`#fadbdb`).
- Upload-zone label (the dashed-border "Click to upload" area): same
  default-bg addition.
- "Add Last Upload to Canvas" button: same default-bg addition.

All three tabs now use the same `#fff0f0 → #fadbdb` pill rhythm.

## Tests

- TS clean on the two touched files.
- No tests assert these specific tile bg colors; full layers-panel +
  composition suites untouched.

## Files touched

- `src/components/editor/elements-panel.tsx`
- `src/components/editor/image-picker-panel.tsx`

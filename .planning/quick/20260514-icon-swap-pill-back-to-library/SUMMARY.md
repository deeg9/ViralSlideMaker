---
slug: icon-swap-pill-back-to-library
date: 2026-05-14
status: complete
---

# Icon-pill swap + back-to-library link in the Elements inspector

## What changed

- **`decoration-card.tsx`** — header label for icons is now a clickable pill
  (16px Lucide thumbnail + name + chevron). Click → fires `onSwapIcon`.
  Shapes keep the plain `<span>` label (no swap semantics for shape kinds).
- **`elements-panel.tsx`** — when a decoration is selected, the inspector now
  renders "← Browse {icon|element} library" above the DecorationCard. Click →
  `onBackToLibrary()` (deselects, panel falls back to library mode).
- **`slide-editor.tsx`** — added `pickerMode` state (`'add'` / `{kind:'swap-icon',
  targetId}`). `onPickerAddDecoration` dispatches UPDATE_DECORATION instead of
  ADD_DECORATION when in swap-mode, preserving position/color/size. Picker
  close handler resets to `'add'` so an Escape/X doesn't leak swap-mode into a
  subsequent library-tile open.

## Behavior

- **Swap an icon:** select the icon → click the AlertTriangle pill in the
  inspector → LucidePicker opens with full search/grid → pick a new icon →
  selected decoration's `lucideName` updates in place, color/position/size
  preserved.
- **Add more icons / shapes:** click "← Browse {icon|element} library" at the
  top of the inspector → selection clears → panel returns to the
  Icons/Shapes/Lines tiles → user can add another.

## Research

Figma/Canva research summary lives in the conversation; key pattern stolen
from Figma is the "Instance swap" pill on the property row. Canva's pattern
(Replace button in the contextual top toolbar) was the runner-up but didn't
fit the single-right-panel layout.

## Tests

- All 33 existing decoration-card + elements-panel unit tests pass.
- TypeScript check on touched files: clean.
- Browser verification: skipped — the running dev-server Chrome instance was
  locked. Recommend a manual spin: open a project, drop an icon, select it,
  click the pill, swap, then click "← Browse icon library".

## Files touched

- `src/components/editor/text-rail/decoration-card.tsx`
- `src/components/editor/elements-panel.tsx`
- `src/components/editor/slide-editor.tsx`

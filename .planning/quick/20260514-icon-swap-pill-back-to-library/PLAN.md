---
slug: icon-swap-pill-back-to-library
date: 2026-05-14
status: complete
---

# Icon-pill swap + back-to-library link in the Elements inspector

Figma-style pattern (chosen after Figma/Canva research): make the dead
"AlertTriangle" label a clickable pill that opens the icon picker in
swap-mode, and add a "← Browse element library" link above the inspector
so the user can return to the icon/shape tiles without first deselecting.

## Approach
- DecorationCard header label → clickable pill for icons (thumbnail + name + chevron)
- ElementsPanel renders "← Browse element library" link when a decoration is selected
- Reuse the existing LucidePicker modal; introduce `pickerMode` state in
  slide-editor so the picker's success handler dispatches UPDATE_DECORATION
  (swap) instead of ADD_DECORATION (insert) when the pill triggered it.

## Tasks
1. `decoration-card.tsx` — add `onSwapIcon` prop; render clickable pill for icons.
2. `elements-panel.tsx` — add `onSwapIcon` + `onBackToLibrary` props; render back link.
3. `slide-editor.tsx` — `pickerMode` state; swap-path in `onPickerAddDecoration`;
   reset on picker close; wire props to ElementsPanel.
4. Typecheck + run decoration-card / elements-panel tests.

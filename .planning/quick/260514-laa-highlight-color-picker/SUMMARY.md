---
slug: highlight-color-picker
quick_id: 260514-laa
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Highlight-words color picker — Summary

Users can now recolor the highlighted-words tint per text box. A new "Highlight color" row sits right below the "Highlight words" chip wall when the disclosure is open: 6 brand swatches + a native palette opener (same visual grammar as the text Color row above).

## Changes

- `src/lib/types/slide.ts` — new `accent_color?: string` on `TextBox`. Optional; falls back to `template.accentColor` (legacy slides byte-identical).
- `src/components/editor/text-rail/AccentWordsDisclosure.tsx` — new optional `onChangeAccentColor` prop; renders the "Highlight color" row below the chip wall when provided.
- `src/components/editor/text-rail/ActiveTextBoxCard.tsx` — passes `textBox.accent_color ?? accentColor` + an `onUpdate({ accent_color })` callback so the picker actually persists.
- `src/components/slides/slide-preview.tsx` — adds `hookAccentColor` / `bodyAccentColor` derived from each text box's `accent_color`; threads them into the four hook + body `renderTextBlock` call sites (two render branches × hook + body).
- `src/lib/render/render-slide-satori.tsx` — same parity at the Satori path so exported PNGs match the editor preview.

## Verification

- `npx tsc --noEmit` on touched files: clean.

## Smoke

1. Add an accent to a hook word via the "Highlight words" chip wall.
2. Open the new "Highlight color" row below; click a swatch (e.g. `#A8E0B0` mint).
3. The chip wall + the rendered hook word both recolor.
4. Export PNG: Satori renders the same color.
5. Different text boxes can carry different accent colors independently.

---
slug: highlight-color-picker
quick_id: 260514-laa
created: 2026-05-14
status: complete
---

# Highlight-words color picker

User: > "put a color option here for highlighted words. It should be right below where it says 'highlighted words'"

## Change

- New optional field `accent_color?: string` on `TextBox` in `src/lib/types/slide.ts`. Per-text-box override; falls back to `template.accentColor` when unset (legacy slides unchanged).
- `AccentWordsDisclosure` (`src/components/editor/text-rail/AccentWordsDisclosure.tsx`): adds a new `onChangeAccentColor?` prop. When provided AND the disclosure is open, renders a "Highlight color" row below the chip wall — 6 brand swatches + a native `<input type="color">` palette opener (same shape as the active-text-box Color row).
- `ActiveTextBoxCard.tsx`: passes `textBox.accent_color ?? accentColor` as the effective color, and wires `onChangeAccentColor` to `onUpdate({ accent_color: hex })`.
- `slide-preview.tsx` + `render-slide-satori.tsx`: compute per-block `hookAccentColor` / `bodyAccentColor` from the matching text-box and thread them into `renderTextBlock` so the rendered output actually picks up the picked color. Custom-text accent stays template-default for now (out of scope).

## Verification

- `npx tsc --noEmit` on touched files: clean.

## Out of scope

- Per-CustomText accent override (separate text-rail flow).
- Reusing the existing brand-kit palette swatches (used only on the text Color row today; can fold in later if the user requests it).

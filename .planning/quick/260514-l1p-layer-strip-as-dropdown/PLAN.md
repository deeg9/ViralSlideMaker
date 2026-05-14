---
slug: layer-strip-as-dropdown
quick_id: 260514-l1p
created: 2026-05-14
status: complete
---

# Convert LayerStrip from horizontal scroll to dropdown

User: > "Have the top area where you're choosing which text box. It should be like a dropdown and not like a side scroll, so that the user can just click the dropdown and then see all the other text boxes that are available on that slide and they can choose it instead of scrolling left to right."

## Change

`src/components/editor/text-rail/LayerStrip.tsx` reworked:
- **Trigger button** (closed state) — full-width pill, brand-maroon background, white text. Shows the active text box's role icon + truncated preview text + a chevron-down that rotates when open.
- **Listbox menu** (open state) — absolute-positioned panel below the trigger; one row per text box (role icon + preview text, check glyph on the active row); `+ Add Text Box` item at the bottom (preserves the existing `onAdd` dispatch).
- **Click-outside + Esc** close the menu.
- Same prop signature (`textBoxes / selectedTextBoxId / onSelect / onAdd`) so the parent (`TextEditorPanel`) doesn't change.
- Test-id contract preserved: `layer-strip` on the wrapper, `layer-chip-${id}` on each menu row, `layer-strip-add` on the add item, new `layer-strip-toggle` on the trigger.

## Tests

Updated `LayerStrip.test.tsx`: each assertion that previously found a chip directly now opens the dropdown first. New tests added for trigger label, aria-expanded toggle, and menu-closes-on-select / menu-closes-on-add.

## Files

- `src/components/editor/text-rail/LayerStrip.tsx`
- `src/components/editor/text-rail/__tests__/LayerStrip.test.tsx`

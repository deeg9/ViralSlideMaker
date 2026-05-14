---
slug: layer-strip-as-dropdown
quick_id: 260514-l1p
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# LayerStrip → dropdown — Summary

The horizontal-scroll chip row at the top of the right-rail Text tab is replaced with a dropdown. Users no longer have to scroll left/right to find a text box on slides with several of them.

## Changes

- **`src/components/editor/text-rail/LayerStrip.tsx`** — fully rewritten.
  - Closed state: maroon trigger button with active-box role-icon + truncated preview text + chevron.
  - Open state: white listbox panel below the trigger; one row per text box; active row highlighted with a check glyph; trailing `+ Add Text Box` row.
  - Click-outside and Esc close the menu.
  - Same prop signature as before (`textBoxes / selectedTextBoxId / onSelect / onAdd`), so `TextEditorPanel` consumes it unchanged.
  - Test-ids preserved: `layer-strip` (wrapper), `layer-chip-${id}` (each menu row), `layer-strip-add` (add row). New: `layer-strip-toggle` (trigger).

- **`src/components/editor/text-rail/__tests__/LayerStrip.test.tsx`** — rewritten for the new structure. Tests open the dropdown before asserting on items; added coverage for trigger label, `aria-expanded` toggle, and menu-closes-on-select/add.

## Verification

- `npx tsc --noEmit`: clean for touched files.
- Text-rail test sweep (`npx vitest run src/components/editor/text-rail/`): **64/64 test files passing, 675 tests green**.

## Smoke

1. Open a slide with 3+ text boxes → the right-rail Text tab shows the dropdown trigger with the active box's text.
2. Click the trigger → menu drops down listing every text box on the slide. Active row has a check glyph.
3. Click a row → text-box switches, menu closes, dropdown trigger updates to the new active label.
4. Click `+ Add Text Box` → a new custom text box is added; menu closes.
5. Click outside or press Esc → menu closes.

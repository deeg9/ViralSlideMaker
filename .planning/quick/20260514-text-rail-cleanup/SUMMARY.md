---
slug: text-rail-cleanup
date: 2026-05-14
status: complete
---

# Text right-rail cleanup: Indent under List, drop Bold Words, Font size number input

User asked for three changes to `ActiveTextBoxCard`:
1. The Indent control should live below List, not next to it.
2. Remove the Bold Words section entirely.
3. Replace the "Hook size" slider with a numeric "Font size" input placed
   under the FontPicker (Word / Canva-style — type the size).

## What changed

`src/components/editor/text-rail/ActiveTextBoxCard.tsx`:

- **List + Indent** split into two adjacent rows (`<div className="flex
  gap-2 items-center">` each). List row keeps the three segmented-control
  list-type buttons; Indent row sits directly beneath with the decrease /
  increase buttons + level indicator.
- **BoldWordsDisclosure** removed. The import was dropped, and the
  `toggleBold` callback was removed (it was its only consumer; global
  bold via the Style toggle still flips font_weight 400 ↔ 700).
- **"Hook size" slider** replaced by a numeric **Font size** input placed
  directly under the FontPicker. `data-testid="active-text-box-size"` is
  preserved so the existing ActiveTextBoxCard regression test passes
  unchanged. Min/max ranges match the old slider (hook: 16–240, body:
  14–120). Commits via `onUpdate({ font_size: n })` per change.
- Dropped the now-unused `sizeLabel(role)` helper.

## Tests

- 78/78 ActiveTextBoxCard + related text-rail tests pass unchanged.
- TS clean on touched file.

## Files touched

- `src/components/editor/text-rail/ActiveTextBoxCard.tsx`

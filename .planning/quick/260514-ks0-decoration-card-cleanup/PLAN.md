---
slug: decoration-card-cleanup
quick_id: 260514-ks0
created: 2026-05-14
status: in-progress
---

# DecorationCard cleanup: drop shadow + opacity out; delete → trash icon

User request:
> "OK, let's get rid of the drop shadow option and opacity option, and then instead of delete shape, just have it be a trash can icon."

## Changes

1. Remove `<DecorationEffects />` mount from `DecorationCard` (icon/shape inspector). The standalone `DecorationEffects` component + its tests stay — only the card no longer mounts it. Drop the import.
2. Replace the full-width red "Delete icon"/"Delete shape" pill with a small trash-icon button (`<Icon name="delete" size="sm" />`), right-aligned in the card. Preserves the `data-testid="decoration-card-delete"` selector + adds an `aria-label`/`title` for a11y.
3. Update the docstring at top of `decoration-card.tsx` (section 6 was "DecorationEffects"; now "Delete trash icon").
4. Remove the "renders DecorationEffects placeholder" test case in `decoration-card.test.tsx` (covers a behavior we've intentionally removed). Component-level effects tests in `decoration-card-effects.test.tsx` stay — the component still exists, just not mounted here.

## Files

- `src/components/editor/text-rail/decoration-card.tsx`
- `src/components/editor/text-rail/__tests__/decoration-card.test.tsx`

## Out of scope

- Deleting `decoration-card-effects.tsx` / its tests — keeping in case a future card needs it.
- Migrating any decoration with non-default `opacity` / `effects.shadow` values — those stay on the decoration object; just not editable via this card.

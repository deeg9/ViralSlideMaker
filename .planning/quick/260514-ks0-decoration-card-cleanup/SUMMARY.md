---
slug: decoration-card-cleanup
quick_id: 260514-ks0
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# DecorationCard cleanup — Summary

User request:
> "OK, let's get rid of the drop shadow option and opacity option, and then instead of delete shape, just have it be a trash can icon."

## Changes

- **`src/components/editor/text-rail/decoration-card.tsx`**
  - Removed `<DecorationEffects />` mount and the `import { DecorationEffects } from './decoration-card-effects'`. The standalone component + its tests are preserved — the card just no longer renders it.
  - Replaced the full-width red "Delete icon"/"Delete shape" pill button with a small icon-only trash button (`<Icon name="delete" size="sm" />`), right-aligned in a flex row. Preserved `data-testid="decoration-card-delete"`; added `aria-label` + `title` for a11y.
  - Updated the file's top docstring: section 6 is now "Delete (trash icon, right-aligned)" with a note explaining the drop-shadow/opacity removal per quick-260514-ks0.

- **`src/components/editor/text-rail/__tests__/decoration-card.test.tsx`**
  - Removed the "Effects sub-component mount (CARD-05) → renders DecorationEffects placeholder" describe block. Replaced with a short comment pointing to `decoration-card-effects.test.tsx` for the standalone effects tests.

## Verification

- `npx vitest run` on affected files: **3 of 3 test files passing**, 59 tests green (includes the elements-panel and decoration-card suites that exercise the new delete button via `data-testid="decoration-card-delete"`).
- `npx tsc --noEmit`: no new errors.

## Smoke

- Open a slide, click an icon → right-rail Elements tab shows the DecorationCard.
- Drop Shadow toggle: gone.
- Opacity slider: gone.
- Delete button: now a small trash icon, right-aligned under the size+position section; clicking still removes the decoration + clears the selection ring.

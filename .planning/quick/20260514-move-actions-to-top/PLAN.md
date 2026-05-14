---
slug: move-actions-to-top
date: 2026-05-14
status: complete
---

# Move slide-action bar to the top of the left sidebar

User asked to:
- Delete the "PRESENTATION / N Slides" label at the top of the left sidebar
- Move the bottom action row (back-arrow + title + slide actions + help)
  to the top, keeping the same formatting (two-row composition).

## Approach
Swap the order of the two children in the left `<aside>`:
- Action row was at the bottom with `border-t` → now at the top with
  `border-b`. Same `p-3 space-y-3`, same icons, same handlers.
- Scroll area (SlideList + LayersPanel) keeps its `p-4 flex-1 overflow-y-auto`.
- Drop the `Presentation` label + slide-count <span> entirely.

## Files touched
- `src/components/editor/slide-editor.tsx`

---
slug: slide-counter-above-canvas
quick_id: 260514-ku2
created: 2026-05-14
status: complete
---

# Move "Slide N / total" pill above the canvas

User request:
> "OK, next move where it says 'Slide 1 of 7' to the top of the middle slide of the middle area, or the big slide is"

## Change

In `src/components/editor/slide-canvas.tsx`, relocate the slide-counter chip from below the canvas (it sat under the navigation arrows with `mt-4`) to above the canvas, before the slide preview wrapper (`mb-4`). Same DOM, same content, same `data-testid="slide-canvas"` parent — just earlier in the tree.

## Files

- `src/components/editor/slide-canvas.tsx`

## Out of scope

Anything else. Pure relocation.

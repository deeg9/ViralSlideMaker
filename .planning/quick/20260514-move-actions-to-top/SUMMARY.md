---
slug: move-actions-to-top
date: 2026-05-14
status: complete
---

# Move slide-action bar to the top of the left sidebar

## What changed

`src/components/editor/slide-editor.tsx` — left `<aside>` rearranged:

- Removed the "PRESENTATION" label + "N Slides" count from the top of the
  scroll area (the chrome the user pointed at).
- Promoted the former bottom action row (back-arrow + title + Saved status,
  plus the icon row: add / duplicate / delete / text / image / help) to be
  the FIRST child of the `<aside>`. Same `p-3 space-y-3` shell; `border-t`
  flipped to `border-b` since it now divides ABOVE the scroll area.
- The slide thumbnails (`SlideList`) + `LayersPanel` keep their existing
  `p-4 flex flex-col gap-4 flex-1 overflow-y-auto` container — just no
  longer headed by the "Presentation" caption.

No prop/handler changes; no test changes (no tests reference the removed
caption). TypeScript clean.

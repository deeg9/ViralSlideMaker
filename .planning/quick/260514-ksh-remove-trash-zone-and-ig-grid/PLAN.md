---
slug: remove-trash-zone-and-ig-grid
quick_id: 260514-ksh
created: 2026-05-14
status: in-progress
---

# Remove drag-to-delete trash zone and IG Grid toggle

User request:
> "Please remove the area at the bottom too, like when I'm dragging an icon. Please remove where it says 'Drag here to be deleted' and remove the trash icon. Just remove that 'Drag to be deleted' area. We don't need it. Also, remove where it says 'ig grid' at the bottom."

## Changes

1. **`src/components/slides/slide-preview.tsx`** — drag-to-delete bottom strip is gone.
   - Remove the trash-zone JSX block (the absolute-positioned overlay with 🗑️ glyph + "Drag here to delete" text that appears while `draggingElementId !== null`).
   - Remove `const [overTrash, setOverTrash]` state.
   - Remove `setOverTrash(...)` calls in both custom-text and custom-image onDrag/onDragStop handlers.
   - Remove the `if (yPercent > 85) { onCustom...Remove(id); return }` drop-to-delete branches.
   - Refresh stale "trash" comments around the alt-duplicate branch.

2. **`src/components/editor/slide-canvas.tsx`** — IG Grid toggle + overlay removed.
   - Drop the "IG Grid" chip from the slide-counter row below the canvas.
   - Drop the absolute-positioned "ig-grid-overlay" div that drew the 4:5 dashed crop preview.
   - Remove `igGridOn` state + `useState` import.

3. **`src/components/editor/__tests__/slide-canvas-ig-grid.test.tsx`** — deleted (the feature it covered is gone).

## Out of scope

- The IG center-crop is still real on Instagram; the user can preview that elsewhere if they want it back.
- Deletion of custom elements still works via the LayersPanel + DecorationCard delete buttons + keyboard shortcuts. We're only removing the drop-on-trash UX path, not the ability to delete.

## Files

- `src/components/slides/slide-preview.tsx`
- `src/components/editor/slide-canvas.tsx`
- `src/components/editor/__tests__/slide-canvas-ig-grid.test.tsx` (deleted)

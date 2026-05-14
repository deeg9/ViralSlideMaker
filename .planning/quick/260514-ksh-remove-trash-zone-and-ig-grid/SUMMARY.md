---
slug: remove-trash-zone-and-ig-grid
quick_id: 260514-ksh
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Remove trash zone + IG Grid — Summary

User asked to remove two pieces of editor chrome:
1. The "Drag here to delete" trash strip that appeared at the bottom of the canvas during drag.
2. The "IG Grid" pill toggle below the slide counter.

## Changes

- **`src/components/slides/slide-preview.tsx`**
  - Deleted the trash-zone overlay JSX (50-line absolute-positioned block with 🗑️ glyph + "Drag here to delete" / "Release to delete" copy that mounted when `draggingElementId !== null`).
  - Removed `const [overTrash, setOverTrash]` state.
  - Cleared `setOverTrash(...)` calls in both custom-text and custom-image onDrag/onDragStop handlers.
  - Removed the `if (yPercent > 85) { onCustom...Remove(id); return }` drop-to-delete branches in both handlers — deletion now happens exclusively via the LayersPanel + DecorationCard delete buttons + keyboard shortcuts.
  - Refreshed the stale "trash-zone takes precedence" comment around the alt-duplicate branch.

- **`src/components/editor/slide-canvas.tsx`**
  - Removed the "IG Grid" pill toggle from the slide-counter row.
  - Removed the dashed-outline overlay (`ig-grid-overlay`).
  - Dropped `igGridOn` state + the `useState` import (only consumer).

- **`src/components/editor/__tests__/slide-canvas-ig-grid.test.tsx`** — deleted (the entire suite was about the removed toggle + overlay).

## Verification

- `npx tsc --noEmit` on touched files: no new errors.
- `npx vitest run` on `src/components/slides/__tests__/` + `src/components/editor/__tests__/`: pre-existing failures (phase-70-final-regression-sweep) unchanged; all other suites green. The removed feature's tests were the obsolete IG-grid file (deleted) — no other tests referenced the trash zone.

## Smoke

- Drag a text box / custom image / icon → no red strip at the bottom; the element just follows the cursor and drops where released.
- Below the canvas → "Slide N / total" chip only. No "IG Grid" toggle.
- Delete still works via LayersPanel rows, DecorationCard trash icon, and keyboard (Backspace / Cmd-Delete).

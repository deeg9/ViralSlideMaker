---
slug: 260519-pkt-pin-actions-portlet-remove-save-button
type: quick
date: 2026-05-19
---

# Pin actions portlet + remove SAVE CHANGES button

## Goal

In the editor right rail, the bottom action portlet (Undo/Redo, Public dropdown, Export) should remain visible at all times — independent of the right rail's vertical scroll position. Also drop the "SAVE CHANGES" button (saves already happen automatically via the 2s `isDirty` debounce on `doSave`).

## Scope

Single file: `src/components/editor/slide-editor.tsx`

1. **Remove Save Changes button** (lines ~1951–1956). `doSave` itself remains — it is still invoked by the autosave effect at line ~437.

2. **Pin the actions portlet** to the bottom of the right rail `<aside>`.
   - Today the portlet (`<div className="bg-white border-2 ... mt-4 mx-4 mb-4">`) lives **inside** `<div className="flex-1 overflow-auto">` and scrolls with the panel content.
   - Move it out, as a sibling of the scroll area but still inside the aside. The aside is `flex flex-col overflow-hidden`, so a non-scrolling sibling after `flex-1` naturally sits at the bottom.
   - Adjust margins: drop `mt-4` (no longer needed, the scroll area's last child supplies the gap), keep `mx-4 mb-4` and add a `mt-2` so it doesn't collide with the panel content above.

## Out of scope

- No changes to autosave behavior or `doSave`.
- No changes to the export flow, visibility dropdown, undo/redo wiring.
- No changes to the left/center columns.

## Verification

- Visual: scroll the right rail up and down — Undo/Redo + Public + Export stay parked at the bottom of the rail.
- Visual: SAVE CHANGES is gone; the portlet's bottom edge is now the Export button (or the free-tier upgrade line for free users).
- Editing a slide still autosaves silently (no regression).

---
slug: 260519-pkt-pin-actions-portlet-remove-save-button
type: quick
date: 2026-05-19
status: complete
---

# Pin actions portlet + remove SAVE CHANGES button — SUMMARY

## Changes

Single file: `src/components/editor/slide-editor.tsx`.

1. Removed the manual **SAVE CHANGES** button from the right-rail footer portlet. Autosave already fires 2s after every edit (`useEffect` on `isDirty` calls `doSave`, line ~434), so the button was a no-op for users who waited and a foot-gun for users who didn't realize saves were automatic.

2. Moved the actions portlet (Undo/Redo, Public visibility dropdown, Export) **out** of the `<div className="flex-1 overflow-auto">` panel scroll area and made it a direct sibling under the `<aside>`. The aside is `flex flex-col overflow-hidden`, so a non-`flex-1` sibling after the scroll region naturally pins to the bottom. Margins adjusted: dropped `mt-4` (no longer needed) and added `mt-2` to keep a small gap above the portlet.

## Verification

Playwright run against `localhost:3000/project/75d870d0-1987-4b98-a349-c89a7a5cde85`, Elements tab:

- `saveBtnExists: false` — Save Changes button is gone everywhere on the page.
- `portletInsideScroller: false` — portlet is correctly outside the scroll container now.
- Portlet `getBoundingClientRect().top` = **699.75** at scrollTop=0; **699.75** at scrollTop=968.5. Zero movement under ~1000px of panel scroll.
- Visual screenshots: `pkt-01-editor-initial.png`, `pkt-02-elements-tab.png`, `pkt-03-elements-scrolled.png`.

## Out of scope (untouched)

- `doSave` itself — still used by the autosave debounce.
- Export flow, visibility dropdown wiring, undo/redo state — unchanged.
- Free-tier upgrade prompt still renders inside the portlet for free users.

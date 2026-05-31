# Phase 93 — Editor Mobile Layout · UI-SPEC (design decisions)

Captures the bottom-sheet + canvas-first layout decisions. No new design system — reuses the existing tan/maroon palette, `tap-44`, Radix Dialog, and the established `lg:`/`md:` seams.

## 1. Mobile editor layout (below `lg`, ≥`lg` unchanged)

```
┌─────────────────────────────────────┐  fixed inset-0 dvh shell (Phase 91)
│ TopNavbar (variant=app)             │
├─────────────────────────────────────┤
│ slim editor top bar                 │  back · title · saved-status · ⋯(layers)
├─────────────────────────────────────┤
│                                     │
│                                     │
│         SlideCanvas (9:16)          │  ◀ DOMINANT. Gets all leftover height
│         flex-1 min-h-0              │     for free once siblings collapse.
│                                     │     tap text = edit (EDIT-01); drag = move
│                                     │
├─────────────────────────────────────┤
│ ◖ filmstrip (peek + edge-fade) ◗    │  thin horizontal SlideList, ~64px tall
├─────────────────────────────────────┤
│ [Text] [Elements] [Images]  + ⤺ ⤻   │  sheet triggers + add + undo/redo
│ [ 👁 Public ]      [ ⬇ Export ]      │  persistent bottom action bar
└─────────────────────────────────────┘  pb-[env(safe-area-inset-bottom)]
        ↑ tapping Text/Elements/Images opens a BOTTOM SHEET
          hosting the SAME rail panel body (re-host, not rebuild)
```

The three desktop grid children are re-ordered/re-hosted on mobile:
- **LEFT aside** → split: the action row collapses into the slim top bar (back/title) + the bottom action bar (add/undo/redo); `SlideList` becomes the thin filmstrip; `LayersPanel` demotes to an on-demand sheet (the `⋯` toggle in the top bar).
- **CENTER `SlideCanvas`** → unchanged component, now `flex-1` so it dominates.
- **RIGHT aside** → tab buttons become bottom-sheet triggers; the tab panel bodies render inside the sheet; the pinned portlet becomes the persistent bottom action bar.

Desktop keeps the literal three-column `<aside>|canvas|<aside>` grid — the mobile arrangement renders only below `lg` via a `useMediaQuery('(min-width:1024px)')` (`isDesktop`) JS seam plus `lg:` CSS, so the desktop render path is byte-identical.

## 2. Bottom sheet (`src/components/ui/sheet.tsx`)

- **Built on `@radix-ui/react-dialog`** — mirrors `dialog.tsx` exactly (Root/Portal/Overlay/Content/Title/Close). Zero new deps.
- `side="bottom"`: `fixed inset-x-0 bottom-0`, `rounded-t-2xl`, slide-up animation (`data-[state=open]:slide-in-from-bottom`).
- `max-h-[85dvh]` + internal `overflow-y-auto` so a tall panel scrolls inside the sheet, never past the viewport.
- `pb-[max(1rem,env(safe-area-inset-bottom))]` — safe-area padded so content clears the home indicator.
- A **grab-handle pill** (visual affordance) + a 44px close target in the header.
- **Modal by default** (Radix default) — the lowest-risk choice per ARCHITECTURE Q5; matches Canva/CapCut dismiss-to-canvas. `modal={false}` left available but not the v2.17 baseline.
- **Keyboard coexistence:** because `max-h-[85dvh]` + the viewport `interactiveWidget:'resizes-visual'`, when an input inside the sheet focuses, the visual viewport shrinks and the sheet (anchored to `bottom-0` of the *visual* viewport) rides above the keyboard. The sheet's own scroll keeps the focused field reachable. Verified on device.

## 3. Filmstrip affordance (EDIT-04)

- Thin horizontal rail (mobile only) with `overflow-x-auto`, momentum scroll.
- **Right edge-fade gradient** (mask) signalling more slides off-screen — kills the "silently hidden horizontal scroll" problem.
- A **slide counter** ("3 / 8") so the user always knows position/total even mid-scroll.
- Selected thumbnail keeps the existing selection ring; tapping selects (existing `onSelect`).
- Reuses `SortableSlide` items unchanged; only the container + affordance are new.

## 4. Destructive-action safety (EDIT-05)

The documented scar: a project was once hard-deleted via a control adjacent to a primary tap target. Two defenses, both applied:
- **Spacing:** the delete-slide control is NOT placed adjacent to add/duplicate in the mobile bottom bar. Delete lives in the on-demand Layers/overflow sheet, physically separated from the primary add/export targets, each ≥44px.
- **Confirmation + undo:** deleting a slide on mobile routes through a confirm step (a small confirm dialog) OR is covered by the existing undo (the reducer already supports `undo`, surfaced in the bottom bar). Element delete remains undoable via the same history stack. We surface undo prominently in the persistent bar so any mis-tap is one tap to reverse.

## 5. Persistent bottom action bar (EDIT-06)

- Always visible on mobile, anchored `bottom-0`, `pb-[env(safe-area-inset-bottom)]`.
- Hosts: **add slide**, **undo / redo**, **Public toggle** (`VisibilityDropdown`), **Export** (opens `ExportFormatDialog`). All ≥44px (`tap-44`).
- Sits ABOVE the existing `BottomNavbar` is avoided — the editor is full-bleed (`isFullBleed`), so the global `md:hidden` `BottomNavbar` is not rendered on `/project/*`; no stacking conflict. (Confirmed: editor shell branch.)

## 6. Tap-to-edit-text (EDIT-01) interaction contract

- **Touch (pointerType==='touch'):** a tap (movement < 10px between pointerdown/up) on a hook/body/custom-text wrapper enters edit mode AND synchronously focuses the contentEditable + places caret + `scrollIntoView({block:'center'})` — all inside the same `onPointerUp` gesture, so iOS opens the keyboard. A move ≥ 10px is a drag → react-rnd moves the element, no edit.
- **Mouse (pointerType==='mouse'/desktop):** unchanged — `onMouseDown` selects, `onDoubleClick` enters edit. The touch path is gated on `pointerType==='touch'` so desktop is untouched.
- Drag threshold: **10px** (a comfortable touch-slop value; below this is a tap, at/above is a drag).
</content>

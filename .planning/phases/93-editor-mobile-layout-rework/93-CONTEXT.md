# Phase 93 — Editor Mobile Layout Rework · CONTEXT

**Milestone:** v2.17 Mobile Optimization · **Branch:** `feat/carousel-output-format`
**Requirements:** EDIT-01 (folded in from Phase 92), EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06
**Status entering phase:** Phase 91 foundation landed (viewport-fit=cover, dvh shells, tap-44, safe-area). Phase 92 diagnosed EDIT-01 and applied ONE conservative repair (`touch-action:manipulation`); the structural fixes were deliberately deferred to THIS phase.

## The EDIT-01 fold (from Phase 92)
Phase 92 was a verify-and-repair gate. It did NOT repair the two decisive on-device risks — it diagnosed them with file:line evidence and explicitly deferred the structural fix to Phase 93. They are now in scope here:

1. **Focus synchrony (the decisive break).** Edit-entry is `onDoubleClick → setEditingHookBodyId(id)` (a setState), and `.focus()` runs LATER — in a `useEffect` keyed on the edit-state (`slide-preview.tsx:1107-1129`, `.focus()` at `:1121`) for hook/body, and via `requestAnimationFrame(() => el.focus())` in a ref callback (`:3127`) for custom-text. Both put `.focus()` OUTSIDE the user gesture. iOS Safari refuses to summon the soft keyboard when `.focus()` is not synchronous inside the gesture handler. **Fix: focus synchronously inside the tap/pointer handler.**
2. **Single vs double tap.** Edit-entry today is `onDoubleClick`. Double-tap fights iOS double-tap-to-zoom and the success criteria imply a single tap opens edit. **Fix: single-tap-to-edit on touch, with a movement threshold so a short drag still MOVES the element (react-rnd has no built-in threshold).**
3. **Keyboard occlusion.** No `scrollIntoView`/`visualViewport` handling exists; inside the `fixed inset-0` (`dashboard-shell.tsx:19`) `dvh` shell the iOS keyboard overlays a low field. **Fix: `scrollIntoView({block:'center'})` on focus + `interactiveWidget:'resizes-visual'` in the viewport export.**

Phase 92 carried forward FOUND-01 / FOUND-02 device checks (safe-area clearance, dvh URL-bar collapse) into the consolidated device pass — Phase 93's VERIFICATION owns the single combined iPhone checklist for the whole editor track.

## The single architectural seam (from ARCHITECTURE.md)
The mobile editor problem is ONE grid seam: `slide-editor.tsx:1500-1501`
```
grid grid-cols-1 lg:grid-cols-[260px_1fr_340px]
```
Below `lg`, the three already-built children (LEFT aside = filmstrip + Layers; CENTER `SlideCanvas`; RIGHT aside = TEXT/ELEMENTS/IMAGES tabs + pinned Undo/Redo/Public/Export portlet) stack top-to-bottom and squeeze the canvas. The rework is a **container re-host**, NOT a rewrite of `SlidePreview`/`SlideCanvas` or the rail panels.

## Constraints (carried)
- Desktop (`lg:` and up) editor behavior MUST NOT regress — every change gated behind a mobile breakpoint or the existing `lg:`/`md:` seam.
- **Reuse over rebuild.** Re-host `TextEditorPanel` / `ElementsPanel` / `ImagePickerPanel` / `SlideList` byte-identical into new containers.
- **Zero new dependencies.** Bottom sheet builds on already-installed `@radix-ui/react-dialog` (mirror `src/components/ui/dialog.tsx`). No `vaul`, no `@use-gesture/react`.
- Keep `SlidePreview`/`SlideCanvas` render parity intact — slide tests stay 121/121.
- Stay on branch `feat/carousel-output-format`.

## Baselines (measured at phase start, 2026-05-31)
- `npx tsc --noEmit` → **20 errors, all in `*.test.ts(x)`** (the known baseline). Gate: no NEW errors.
- `npx vitest run src/components/slides` → **121/121 passing** in 16 files. Gate: stays green.
- `useMediaQuery` hook already exists at `src/hooks/use-media-query.ts` — reuse it for the JS `lg:` seam where CSS reflow can't express the conditional (sheet vs inline aside).

## Existing assets to reuse
- `src/components/ui/dialog.tsx` — shadcn-style Radix Dialog wrapper to mirror for `sheet.tsx`.
- `src/hooks/use-media-query.ts` — `useMediaQuery('(min-width: 1024px)')`.
- `tap-44` utility (Phase 91) in `globals.css`.
- `VisibilityDropdown`, `ExportFormatDialog` — reused as-is in the bottom action bar.

## Device gate
EDIT-01..06 are code-complete-awaiting-device. The VERIFICATION sets status `human_needed` with ONE consolidated iPhone-15 checklist covering EDIT-01..06 + the deferred FOUND-01/02. This is the single combined on-device test that gates the editor track.
</content>
</invoke>

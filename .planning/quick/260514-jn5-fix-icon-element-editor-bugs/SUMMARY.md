---
slug: fix-icon-element-editor-bugs
quick_id: 260514-jn5
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Fix icon/element editor bugs — Summary

## User report

Selecting a Target icon on a slide:
- Editing controls opened in the **Text** tab, not Elements.
- No delete button visible anywhere.
- Size/position, rotation, opacity appeared broken (user saw text-box controls instead).
- Elements panel library only showed Lines & Dividers — no icon library, despite 118 Lucide icons being shipped in the codebase.

## What was actually happening

Phase 70 (Plan 04) shipped `DecorationCard` (icon/shape inspector with color, W/H/X/Y, rotation, opacity, drop shadow) inside `TextEditorPanel`. Selecting a decoration replaced the active text-box card with the decoration card — but the right-rail `activeTab` state in `slide-editor.tsx` never moved off `'text'`, so the user perceived decoration controls landing in the wrong tab.

`DecorationCard` shipped without a Delete button. The reducer handled `REMOVE_DECORATION`, but no UI dispatched it.

`ElementsPanel` only rendered the `DIVIDERS` array. `LucidePickerDynamic` + `ShapePicker` were already mounted in `slide-editor.tsx` (driven by `openPicker` state and `R`/`C`/`L`/`I`/`S` keyboard shortcuts) but the panel had no buttons to open them — a "more elements coming soon" placeholder sat where the surface should have been.

## Fix

1. **Elements tab is now the home for decoration editing.**
   `ElementsPanel` operates in two modes:
   - **Selection mode** (`activeDecoration !== null`): renders `<DecorationCard>` with the full edit surface plus a new Delete button.
   - **Library mode** (no decoration selected): renders an "Icons & Shapes" section with two tiles that open `LucidePicker` and `ShapePicker`, followed by the existing Lines & Dividers tiles.

2. **Auto-switch right-rail tab.** New `useEffect` in `slide-editor.tsx` watches `activeDecoration?.id` and sets `activeTab('elements')` when a decoration becomes selected. Keyed off id (not the object) so manual tab clicks while a decoration stays selected aren't yanked back.

3. **Delete button.** `DecorationCard` accepts a new optional `onRemove` prop and renders a red-bordered delete button at the bottom (mirrors the existing `CustomTextEditor` delete style). The slide-editor's `onDecorationRemove` handler dispatches `REMOVE_DECORATION` and clears `selection.primary` so the canvas ring doesn't linger on a stale id.

4. **Text tab simplified.** `TextEditorPanel` no longer renders `DecorationCard`. Branch precedence is now 2-way: `MultiSelectTypeBar` (N≥2) → `ActiveTextBoxCard`. Dropped the now-unused `DecorationAction` export, `onDecorationAction` prop, and its parent wiring.

## Files changed

- `src/components/editor/elements-panel.tsx` — two-mode panel (selection / library), icon + shape picker tiles.
- `src/components/editor/text-rail/decoration-card.tsx` — `onRemove?` prop + Delete button.
- `src/components/editor/text-editor-panel.tsx` — dropped `DecorationCard` branch + `DecorationAction` type + `onDecorationAction` prop.
- `src/components/editor/slide-editor.tsx` — lifted `activeDecoration` resolution, added auto-tab-switch effect, wired new ElementsPanel props (including selection.clear() on remove).
- `src/components/editor/__tests__/text-editor-panel-decoration-card.test.tsx` — rewritten for the new 2-way composition; asserts DecorationCard NEVER renders inside the Text tab.
- `src/components/editor/__tests__/elements-panel-decoration-card.test.tsx` — **new** — 7 tests covering library / selection modes, picker open callbacks, update dispatch, delete dispatch.
- `src/components/editor/__tests__/slide-editor-keyboard-rcl.test.tsx` — added `ElementsPanel` mock with the same data-* probe surface; `readPanel()` falls back across panels (the editor auto-switches to `elements` after R/C/L inserts).
- `src/components/editor/__tests__/slide-editor-picker-firewall-sweep.test.tsx` — same probe-surface mirror + `readPanel()` fallback.

## Verification

- `npx vitest run` (touched suites): **41 of 42 test files passing**, 451 tests green. The single failing file is `phase-70-final-regression-sweep.test.ts`, which fails identically on `main` without these changes (pre-existing — milestone-pin sweep is failing because of newer baseline drift, unrelated).
- `npx tsc --noEmit` (touched files): **no new errors** beyond the pre-existing repo baseline.
- `npx eslint` on touched files: clean (one pre-existing unused-var warning unrelated to this work).

Manual smoke (recommended user check):
1. Open the slide editor, press `R` → rect inserts, **right rail auto-switches to Elements**, DecorationCard renders with W/H/X/Y, rotation, opacity, Delete.
2. Click Delete → decoration removed, selection ring clears.
3. On Elements tab with nothing selected → click "Icons" tile → LucidePicker opens, all 118 Lucide icons searchable.
4. Insert an icon (e.g. Target) → again lands in Elements tab editor.

## Known stubs / follow-ups (out of scope)

- Multi-select decoration deletion via `MultiSelectTypeBar` (Phase 60 SEL-12) — bar doesn't yet count decorations in its breakdown.
- Backspace/Delete keyboard removal of decorations — verify in follow-up.
- The `slide` prop on `ElementsPanel` is accepted for symmetry with sibling panels but not yet consumed by the production render — wired in now to avoid a prop-signature churn when slide-aware library defaults (e.g. recently-used icons per slide) land.

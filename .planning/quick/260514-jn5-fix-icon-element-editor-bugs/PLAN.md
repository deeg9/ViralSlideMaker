---
slug: fix-icon-element-editor-bugs
quick_id: 260514-jn5
created: 2026-05-14
status: in-progress
---

# Fix icon/element editor bugs

## User report

After selecting a Target icon on a slide:
- Properties open in **TEXT** tab instead of **ELEMENTS**.
- No way to delete the icon (no delete button anywhere).
- Size/position, rotation, opacity controls appear non-functional (user only sees Color working).
- Elements panel library only shows Lines & Dividers — no icon library visible despite 118 Lucide icons being shipped.

## Root cause

Phase 70 shipped the `DecorationCard` inspector inside `TextEditorPanel` (the `text` tab). When a decoration is selected the card renders correctly, but:

1. `slide-editor.tsx` `activeTab` state defaults to `'text'` and is never auto-switched on decoration selection → user sees text-box controls under the Text tab instead of decoration controls. (User perceives the controls as broken / shown in wrong place.)
2. `DecorationCard` was shipped without a delete button. Reducer supports `REMOVE_DECORATION` but no UI dispatches it.
3. `ElementsPanel` only renders `DIVIDERS`. The `LucidePickerDynamic` modal exists and is wired into `slide-editor.tsx` via `openPicker` state + `R/I` keyboard shortcuts, but there's no button surface in the Elements tab to open it. Same for `ShapePicker`.

## Fix

1. **ElementsPanel** (`src/components/editor/elements-panel.tsx`)
   - Accept `activeDecoration`, `onDecorationUpdate`, `onDecorationRemove`, `onOpenIconPicker`, `onOpenShapePicker`, `brandKit`, `derivedPalette` props.
   - When `activeDecoration !== null`: render `<DecorationCard>` (with delete) — this becomes the "Elements" tab's editing surface.
   - When no decoration selected: render the existing dividers section + two new "Browse icons" / "Browse shapes" buttons that call the picker openers. Replace the "More elements coming soon" placeholder with these buttons.

2. **DecorationCard** (`src/components/editor/text-rail/decoration-card.tsx`)
   - Add optional `onRemove?: () => void` prop.
   - Render a Delete button at the bottom of the card (red border, matches CustomTextEditor delete style at `text-editor-panel.tsx:398-404`).

3. **TextEditorPanel** (`src/components/editor/text-editor-panel.tsx`)
   - Stop rendering `<DecorationCard>` in the text-box branch. The card now lives in the Elements tab only — Text tab becomes consistently about text boxes.

4. **slide-editor.tsx**
   - Lift `activeDecoration` resolution from `TextEditorPanel` to the editor so it's available for tab routing.
   - Add `useEffect` watching `activeDecoration?.id` — when truthy AND `activeTab !== 'elements'`, set `activeTab('elements')`.
   - Pass new ElementsPanel props (decoration, update/remove handlers, picker openers, brandKit, derivedPalette).
   - Remove decoration removal: dispatch `REMOVE_DECORATION` + clear `selection.primary` so the ring doesn't linger on a removed id.

## Files

- `src/components/editor/elements-panel.tsx` — extend props, add DecorationCard branch + picker buttons.
- `src/components/editor/text-rail/decoration-card.tsx` — add delete button + `onRemove` prop.
- `src/components/editor/text-editor-panel.tsx` — drop DecorationCard render from text-box branch.
- `src/components/editor/slide-editor.tsx` — lift activeDecoration, auto-switch tab, wire ElementsPanel props.

## Out of scope

- Bulk-delete of decorations from `MultiSelectTypeBar` (separate work).
- Backspace/Delete keyboard removal of decorations (already exists via global keymap; verify if needed).
- Layout/animation polish on the icon picker modal itself.

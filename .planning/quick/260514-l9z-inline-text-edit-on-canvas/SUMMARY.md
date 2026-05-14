---
slug: inline-text-edit-on-canvas
quick_id: 260514-l9z
created: 2026-05-14
completed: 2026-05-14
status: complete
---

# Inline text-edit on canvas (hook + body) — Summary

Double-click a hook or body text box on the canvas → it becomes a `contentEditable` surface with the caret at the end → type → blur (click outside or Esc) commits. Matches the Figma / Canva pattern that was already shipped for custom text boxes; this extends the same UX to hook and body.

## Changes

- **`src/components/slides/slide-preview.tsx`**
  - New `editingHookBodyId` state.
  - New optional prop `onTextBoxTextEdit?: (id, text) => void`.
  - Hook + body `onDoubleClick`: enter group (existing GROUP-07 behavior) if applicable, otherwise enter edit mode.
  - Inner text container becomes `contentEditable` while editing. `onBlur` commits via the new prop; Esc key blurs. Rnd `disableDragging` and `enableResizing` gated on the edit flag.
  - Body container switched from `<p>` to `<div>` so a contentEditable host with `<div>` descendants doesn't trip React's hydration check.
  - `useEffect` focuses the editable host + places caret at end when edit starts.
  - Delete-key keyboard guard extended to also suppress while `editingHookBodyId` is set.

- **`src/components/editor/slide-canvas.tsx`** — forwards `onTextBoxTextEdit` verbatim to SlidePreview.

- **`src/components/editor/slide-editor.tsx`** — handler dispatches `UPDATE_TEXT_BOX` with `{ text, segments: undefined }` (segments cleared because they're word-index references into the previous wording — same contract as the right-rail commit at `ActiveTextBoxCard.tsx:181`).

## Verification

- `npx tsc --noEmit`: clean for touched files.
- Targeted test sweep (`slide-preview.test.tsx`, `editor/**`, `components/slides/**`): real-source failures = 4, all pre-existing (`responsive` × 2, `Slide X of Y` indicator string mismatch from earlier sweep, `applies template textColor` from earlier sweep). The custom-text inline-edit suite still passes — the new hook/body wiring lives next to it without intersecting.

## Smoke

1. Open a slide with hook + body text boxes.
2. Single-click hook → it selects (selection ring), nothing else happens.
3. Double-click hook → cursor turns to text caret; type to replace wording (caret at end of existing text).
4. Click anywhere else (or press Esc) → text commits; right-rail panel reflects the new text.
5. Repeat for body.
6. Drag handles disappear while editing; trying to drag does nothing (Rnd disabled).
7. Backspace while typing deletes characters (not the whole text box).
8. Locked text boxes are unaffected (double-click stays a no-op).

## Notes

- Segments (word-level highlights, accent colors set via the right rail) are cleared on every inline-edit commit because they reference word indices in the old text; the right-rail "Highlight words" disclosure starts empty after an inline edit. Same contract the right-rail text input already follows.
- Group-double-click (Phase 62 GROUP-07) is preserved: if the user hasn't entered a group yet and the text box is in one, double-click enters the group instead of starting edit. A second double-click then enters edit mode. This matches Figma's "drill into group" gesture.

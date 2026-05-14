---
slug: inline-text-edit-on-canvas
quick_id: 260514-l9z
created: 2026-05-14
status: complete
---

# Double-click hook / body on the canvas to edit in-place

User: > "double-click into a text box and be able to type and change the wording. I don't want to go over to the right-hand side and type in the text. … just like you can on Figma or Canva."

## Pattern (Figma / Canva)

Both editors expose the canvas text as a `contentEditable` host:
- Double-click switches the text node from "rich render" to "plain editable".
- Drag handle / Rnd is disabled while editing so a stray mousedown can't move the box.
- Caret lands at the end of existing content; Enter inserts newlines; Esc or click-outside (blur) commits.
- Persisted text fires a single update on commit (no per-keystroke dispatch). Word-index style spans / segments are invalidated because they no longer line up with the new wording.

This pattern was already implemented for **custom text** in `slide-preview.tsx` (`editingCustomTextId` state at line 557, blur dispatch at line 2399-2403). Extend to **hook** and **body**.

## Change

1. **`src/components/slides/slide-preview.tsx`**
   - Add `editingHookBodyId` state (mirrors `editingCustomTextId`).
   - Add prop `onTextBoxTextEdit?: (id, text) => void`. When omitted, in-place edit silently no-ops (legacy non-editor callers unchanged).
   - Hook block: `onDoubleClick` enters group OR enters edit mode (mutually exclusive — group-enter wins when applicable and the user hasn't already entered the group). Inner div becomes `contentEditable` while editing; `onBlur` calls `onTextBoxTextEdit(hookBox.id, innerText)` + clears edit state. Esc blurs. Rnd disables drag + resize while editing.
   - Body block: same wiring. `<p>` swapped to `<div>` for the body text container to avoid React hydration warning on block-level descendants inside `<p>` once contentEditable surfaces with `<div>` children become possible.
   - Add `useEffect` that focuses the contentEditable host and places caret at end when edit mode starts (otherwise the user would have to click into the box a second time).
   - Extend the existing delete-key keyboard guard to also suppress while `editingHookBodyId` is set — Backspace must not delete the selected box while the user is typing.

2. **`src/components/editor/slide-canvas.tsx`** — forward the new `onTextBoxTextEdit` prop verbatim.

3. **`src/components/editor/slide-editor.tsx`** — handler dispatches `{ type: 'UPDATE_TEXT_BOX', slideIndex, textBoxId: id, updates: { text, segments: undefined } }`. Mirrors the right-rail commit shape (`ActiveTextBoxCard.tsx:181`) so the two entry points produce identical reducer changes.

## Files

- `src/components/slides/slide-preview.tsx`
- `src/components/editor/slide-canvas.tsx`
- `src/components/editor/slide-editor.tsx`

## Out of scope (intentional)

- **Drag-to-select within a text box during edit** — works natively via contentEditable. ✓
- **Resize during edit** — disabled (matches Figma).
- **Caret position at click point** — we place at end. A future improvement could map the double-click coordinate to a caret offset, but Figma also starts at end so this matches.
- **Rich-text editing (bold/italic via shortcuts inside the contentEditable)** — out of scope; right rail is still the rich path.
- **Custom-text inline edit** — already existed before this task; untouched.

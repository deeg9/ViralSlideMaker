---
quick_id: 260515-ihk
slug: add-trash-icon-keyboard-delete-backspace
date: 2026-05-15
description: Add trash icon to ActiveTextBoxCard + extend keyboard Delete/Backspace to delete any text box (hook + body + custom). Locked boxes remain undeletable.
---

# Quick Task 260515-ihk — Trash icon + keyboard delete for text boxes

User screenshot (`Screenshot 2026-05-15 at 1.14.38 PM.png`) shows the TEXT-tab `ActiveTextBoxCard` with the label "TEXT BOX 2" — no visible delete affordance. User reports: "right now we can't delete text boxes" + wants keyboard backspace/delete on a selected box to delete it.

## Current state (codebase reality)

- **`src/components/editor/text-rail/ActiveTextBoxCard.tsx`** (767 lines) — renders the active box's controls. Header is a `flex items-center justify-between` row containing only the role label (`TEXT BOX N`); right side empty. No `onRemove` prop today.
- **`src/components/editor/text-editor-panel.tsx`** — parent that owns `onTextBoxAction({ type: 'REMOVE_TEXT_BOX', textBoxId })`. Currently passes `textBox`, `onUpdate`, `template`, `brandKit`, `textBoxNumber` to ActiveTextBoxCard. Does NOT wire a delete callback.
- **`src/components/editor/slide-editor.tsx:666-685`** — keyboard `Delete` and `Backspace` handlers exist, but guard `if (targetBox?.role !== 'custom') return` so only custom-role boxes are deletable. Comment cites "structural to legacy compat (hook_text/body_text fields)".
- **`src/lib/editor/editor-reducer.ts:510-526`** — `REMOVE_TEXT_BOX` reducer is role-agnostic. It honors `locked` (returns state unchanged) and routes through `applyDualWrite` which derives empty `hook_text`/`body_text` legacy fields when the corresponding text_box is removed. **Deleting hook/body is safe at the data-model level** — legacy fields just become empty strings.
- **`src/components/editor/__tests__/slide-editor.shortcuts.test.tsx:297-305`** — explicit test asserts Delete on a selected hook is a no-op. This contract is being intentionally inverted by this task.
- **Decoration trash pattern** — `src/components/editor/text-rail/decoration-card.tsx:408-421` ships the canonical small red icon-only trash button (right-aligned, `data-testid="decoration-card-delete"`). We mirror that pattern.

## Design decision

User's intent ("we can't delete text boxes") supersedes the historical hook/body legacy-compat policy. `applyDualWrite` already handles empty legacy fields gracefully (renderer treats missing hook/body as no text). Locked boxes remain undeletable (reducer enforces).

**The trash button + the keyboard handler now apply uniformly to all roles (hook + body + custom).** The previous "Delete on hook = no-op" test is updated to expect hook IS removed.

## Tasks

### Task 1 — Trash button in `ActiveTextBoxCard`

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx`

**Action:**
- Extend `ActiveTextBoxCardProps` with `onRemove?: () => void`.
- Pass `onRemove` to the component.
- In the header row (the existing `flex items-center justify-between` div), add a small red icon-only trash button on the right side when `onRemove` is provided AND `!textBox.locked`. Mirror the decoration-card pattern (line 408-421) — same `p-2 text-red-600 rounded-lg hover:bg-red-50 transition-colors` classes, same `<Icon name="delete" size="sm" />` rendering.
- `data-testid="active-text-box-card-delete"`, `aria-label="Delete text box"`, `title="Delete text box"`.

**Verify:** `git grep -n "active-text-box-card-delete" src/components/editor/` returns 1 production match (the button) + test match(es).

**Done:** Card header has a visible trash icon at right; clicking it calls `onRemove`.

### Task 2 — Wire `onRemove` from `TextEditorPanel`

**File:** `src/components/editor/text-editor-panel.tsx`

**Action:** Pass `onRemove={() => onTextBoxAction({ type: 'REMOVE_TEXT_BOX', textBoxId: activeTextBox.id })}` to `ActiveTextBoxCard` (only when `activeTextBox` is non-null).

**Verify:** clicking the trash button on `TEXT BOX 2` (in any role) dispatches `REMOVE_TEXT_BOX` for that id.

**Done:** End-to-end click delete works for the visible text box from the rail.

### Task 3 — Keyboard Delete/Backspace works for all roles

**File:** `src/components/editor/slide-editor.tsx` (lines ~666-685)

**Action:**
- Remove `if (targetBox?.role !== 'custom') return` from both `Delete` and `Backspace` handlers.
- Replace with `if (!targetBox) return` for null safety.
- Add `if (targetBox.locked === true) return` to honor the reducer's lock contract at the call site too (avoids dispatching an action the reducer ignores — keeps event handling consistent).
- Update the comment block to reflect the new policy: any role is deletable; lock + isEditingTarget + isPickerOpen guards still apply.

**Verify:** `git grep -n "role !== 'custom'" src/components/editor/slide-editor.tsx` returns zero matches in the Delete/Backspace section.

**Done:** Pressing Delete or Backspace with a hook/body/custom text box selected (and not editing inside the textarea) removes that text box and dispatches a single pushHistory entry per KBD-09.

### Task 4 — Invert the hook-deletion-blocked test

**File:** `src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` (lines 290-306)

**Action:** Replace the "Delete on hook = no-op" assertion with "Delete on hook removes the hook text_box". Confirm `data-textbox-count` decrements and `data-active-id` clears after dispatching Delete on a selected hook.

**Verify:** Test passes after the slide-editor.tsx change.

**Done:** No remaining tests assert hook/body deletion is blocked.

### Task 5 — Pin trash button in ActiveTextBoxCard test

**File:** `src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx`

**Action:** Add a focused test: render `<ActiveTextBoxCard textBox={…} onRemove={spy} />`, assert the `active-text-box-card-delete` button is in the DOM, click it, assert spy was called once. Also: when `textBox.locked === true`, the button should NOT render.

**Verify:** Test passes; the existing 78 ActiveTextBoxCard tests stay green.

**Done:** Trash button behavior pinned by tests.

## must_haves

- `active-text-box-card-delete` button renders in the TEXT-tab card for every visible text box (custom, hook, body) unless the box is locked.
- Clicking the trash dispatches `REMOVE_TEXT_BOX` for the active box id.
- Pressing Delete or Backspace with a (non-editing, non-locked) text box selected removes it regardless of role.
- The hook-deletion-blocked test (slide-editor.shortcuts) is inverted to expect deletion.
- Locked text boxes remain undeletable from both UI and keyboard.
- `npx tsc --noEmit` baseline preserved (19 pre-existing errors).
- `npm run build` PASS.

## Out of scope

- Multi-select delete behavior — `MultiSelectTypeBar` already has its own Delete button (covered by separate tests).
- Free-positioned `CustomTextEditor` already has its own Remove button — untouched.
- A11y polish on the trash (focus ring, etc.) — already inherited from `FOCUS_RING` in the file.
- Confirmation dialog — out of scope; users can Cmd+Z to undo per KBD-09.

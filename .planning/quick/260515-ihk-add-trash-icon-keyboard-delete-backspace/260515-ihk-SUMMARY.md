---
quick_id: 260515-ihk
slug: add-trash-icon-keyboard-delete-backspace
date: 2026-05-15
status: complete
description: Add trash icon + extend keyboard Delete/Backspace to delete any text box (custom/hook/body). Locked boxes remain undeletable.
---

# Quick Task 260515-ihk — Summary

User reported "we can't delete text boxes" and wanted both a trash affordance in the TEXT-tab card AND keyboard Backspace/Delete to remove a selected text box. Shipped in two coupled changes.

## What changed

### 1. Trash button in `ActiveTextBoxCard`

**File:** `src/components/editor/text-rail/ActiveTextBoxCard.tsx`

- New optional `onRemove?: () => void` prop.
- Added a small red icon-only delete button in the existing header row (next to the "TEXT BOX N" label), mirroring `decoration-card.tsx`'s pattern (`p-2 text-red-600 rounded-lg hover:bg-red-50 transition-colors`, `Icon name="delete" size="sm"`).
- Hidden when `textBox.locked === true` (reducer enforces the lock too — hiding the affordance keeps the click from being a confusing no-op).
- `data-testid="active-text-box-card-delete"`, `aria-label="Delete text box"`, inherits the file's shared `FOCUS_RING` for keyboard a11y.

**File:** `src/components/editor/text-editor-panel.tsx`

- Wired `onRemove={() => onTextBoxAction({ type: 'REMOVE_TEXT_BOX', textBoxId: activeTextBox.id })}` to ActiveTextBoxCard, only when `activeTextBox` is non-null.

### 2. Keyboard Delete/Backspace now work for all roles

**File:** `src/components/editor/slide-editor.tsx` (Delete + Backspace handlers)

- Removed `if (targetBox?.role !== 'custom') return` — previously blocked hook/body deletion citing legacy compat.
- Verified the underlying contract: `applyDualWrite` (in `editor-reducer.ts`) derives `hook_text`/`body_text` from the `text_boxes` array, so removing a hook or body text_box leaves the legacy fields as empty strings — renderer treats this as "no text" (same as an AI generation with empty hook/body).
- Added explicit `if (targetBox.locked === true) return` to honor the lock contract at the call site (reducer enforces it too, but skipping the dispatch keeps event handling consistent — no wasted action through history).
- Preserved all other guards: `isEditingTarget`, `isPickerOpenRef.current`, `selectedTextBoxId` non-null.

### 3. Test contract update

**File:** `src/components/editor/__tests__/slide-editor.shortcuts.test.tsx`

The test "Delete removes a custom text box (preserves hook/body)" had an explicit assertion that Delete on a selected hook was a no-op (lines 297–305). Inverted that branch:
- Renamed to `"Delete removes a custom text box, AND hook/body too (quick-260515-ihk)"`.
- Assertion now expects `data-textbox-count` to DECREMENT from 2 → 1 when Delete is fired with hook selected, and `data-active-id` to clear.

**File:** `src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx`

Added 3 new tests pinning the trash button contract:
- Trash renders + click dispatches `onRemove`.
- Trash hidden when `onRemove` is undefined.
- Trash hidden when `textBox.locked === true`.

## Sanity checks

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 19 pre-existing test-mock errors only; zero in touched files |
| `npm run build` | PASS |
| `data-testid="active-text-box-card-delete"` grep | 1 production source + 3 test refs |
| `role !== 'custom'` in slide-editor.tsx Delete/Backspace block | 0 matches (was 2) |
| `npx vitest run src/components/editor/text-rail/__tests__/ActiveTextBoxCard.test.tsx src/components/editor/__tests__/slide-editor.shortcuts.test.tsx` | 85/85 PASS |

The broader `text-editor-panel.regression.test.tsx` shows 4 failures, BUT those are **pre-existing** (confirmed via `git stash` — failures persist with my changes reverted). Unrelated to this task.

The earlier "9 failures" seen in a wider vitest run were all duplicates inside `.claude/worktrees/agent-*/` — orphan worktree copies of `slide-editor.shortcuts.test.tsx` with the OLD assertion. Not part of the main repo; cleanup is out of scope.

## Acceptance criteria

- ✓ `active-text-box-card-delete` button renders in the TEXT-tab card for every text box (custom, hook, body) unless locked.
- ✓ Clicking the trash dispatches `REMOVE_TEXT_BOX` for the active box id (via `onTextBoxAction`).
- ✓ Pressing Delete or Backspace with a non-editing, non-locked text box selected removes it regardless of role.
- ✓ Locked text boxes remain undeletable from both UI (button hidden) and keyboard (handler short-circuits).
- ✓ Hook/body deletion test inverted to expect deletion.
- ✓ tsc + build pass.

## Out of scope

- Multi-select bulk-delete polish (`MultiSelectTypeBar`) — has its own Delete button, untouched.
- Free-positioned `CustomTextEditor` Remove button — already shipped, untouched.
- Confirmation dialog — users can Cmd+Z to undo per KBD-09. Friction adds more than it prevents at v1.
- Cleanup of orphan worktrees in `.claude/worktrees/` — destructive operation, needs explicit user approval.

## Manual smoke test (deferred — user task)

- Open a project in the editor, click into a text box (canvas-select), look at the TEXT tab rail.
- ✓ See a red trash icon at the right of the "TEXT BOX N" label.
- Click trash → text box is removed from the slide; selection clears; LayerStrip count drops.
- Canvas-select another text box (without focusing the textarea), press Backspace → box removed.
- Click into the textarea (focus mode), press Backspace → DELETES TEXT CHARACTERS, NOT the box (isEditingTarget guard).
- Lock a text box, click into the rail → trash icon should not render.

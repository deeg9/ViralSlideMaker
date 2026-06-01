# Phase 92 — Editor Touch-Edit Validation Gate · SUMMARY

**Requirement:** EDIT-01 (GATE) · **Status:** code-ready, awaiting device sign-off · **Date:** 2026-05-31
**Branch:** `feat/carousel-output-format` · **New deps:** 0 · **tsc:** 20 errors (baseline, all test files; 0 new)

## What this phase did
A static iOS-correctness diagnosis of the tap-to-edit-text touch path, one conservative clear-cut
repair, and the on-device checklist that is the real gate. No editor restructuring (deferred to Phase 93).

## Diagnosis verdict (file:line evidence)

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | Selection on tap mirrors into rail | **Likely OK, but mouse-era** | Per-element select fires on `onMouseDown` (`slide-preview.tsx:2330` hook, `:2726` body, `:3036`/`:3075` custom-text) → `onTextBoxSelect(id)` → editor `setSelectedTextBoxId` + `requestPanelFocus('text')` (`slide-editor.tsx:1629-1635`). iOS synthesizes `mousedown` from a tap, so selection + rail mirror should fire. Risk: it is on `onMouseDown` (not Pointer/touch), so it races react-rnd's own pointer tracking on the same element. |
| 2 | `.focus()` synchrony (THE critical iOS check) | **BROKEN (deferred focus)** | Edit-entry is `onDoubleClick` → `setEditingHookBodyId(id)` / `setEditingCustomTextId(id)` (a setState; `:2409`, `:2741`, `:3154`). Focus then runs in a **separate `useEffect`** keyed on the edit-state (`:1107-1129`, `editableEl.focus()` at `:1121`) for hook/body, and via **`requestAnimationFrame(() => el.focus())`** in a ref callback (`:3117`) for custom-text. In BOTH paths `.focus()` is OUTSIDE the user gesture (behind setState→re-render→effect / rAF). iOS Safari refuses to open the soft keyboard when `.focus()` is not synchronous in the gesture handler. This is the most likely break. |
| 3 | Tap-vs-drag disambiguation / marquee | **Weak** | The editable `<Rnd>` has `disableDragging={hookLocked \|\| hookEditing}` (`:2082`) — dragging is only disabled AFTER edit mode is entered, so react-rnd (react-draggable 4.5.0, no movement-threshold prop) owns the pointer for every pre-edit touch; any small finger move starts a drag. No `touch-action` was set on the drag surface (Phase 93 gesture pass). The canvas-root marquee (`:1809`) early-returns `if (e.target !== e.currentTarget)`, so it does NOT swallow element taps — that part is fine. |
| 4 | Keyboard occlusion (scroll-into-view) | **BROKEN / none** | The editable contentEditable surfaces have NO `scrollIntoView` on focus and there is NO `visualViewport` handling anywhere. Inside the `fixed inset-0` editor shell (`dashboard-shell.tsx:19`) the iOS keyboard overlays and there is nothing to scroll the field above it. A field low on the canvas will sit under the keyboard. (`interactiveWidget:'resizes-visual'` is deferred to Phase 93.) |
| 5 | Persistence on blur | **OK** | `onBlur` reads `innerText` and calls `onTextBoxTextEdit(id, newText)` (`:2478-2486` hook, `:2800-2808` body) → editor dispatches `UPDATE_TEXT_BOX { text, segments: undefined }` (`slide-editor.tsx:1644-1650`); custom-text `onBlur` → `onCustomTextUpdate(id,{text})` (`:3157-3161`). Commit-on-blur is sound; no silent revert in the static path. |

**Net:** The flow is **NOT iOS-correct.** The decisive break is check #2 (deferred focus); checks #3 and #4 are secondary risks. Only the device test can confirm whether iOS 17+ tolerates the deferred focus for synthesized `dblclick`.

## Repair applied (conservative — 1 change)
**`touch-action: manipulation` on the 3 editable text wrappers** (hook `slide-preview.tsx:~2432`,
body `~2761`, custom-text `~3122`). This is the exact Pitfall-9 mitigation for the iOS 300ms tap delay +
double-tap-to-zoom that fights the double-tap-to-edit gesture — it raises the odds the double-tap is read
as edit, not zoom. Clearly-correct, zero-dependency, reversible, **page pinch-zoom preserved** (WCAG —
`manipulation`, not `none`/`user-scalable=no`). It does NOT touch the interaction model.

## Repair deliberately NOT applied (and why)
The decisive fix — making `.focus()` synchronous in the gesture — cannot be done without the
contentEditable node already being focusable at tap time, which requires either an always-mounted
contentEditable (readonly-gated) or a synchronous tap-state-machine. Both **restructure** the editor and
are explicitly Phase 93 / EDIT-02-03 territory; the brief forbids restructuring here and says not to ship
a speculative half-fix that won't actually summon the keyboard. So this is documented as the precise
required repair and gated on the device test. If the device test shows the keyboard does NOT open, the
Phase-93 fix is: keep the editable surface mounted (or flip edit-state synchronously) and call `.focus()`
in the same `onPointerUp`/`onClick` gesture, plus a `scrollIntoView({block:'center'})` backstop +
`interactiveWidget:'resizes-visual'` for occlusion.

## Files modified
- `src/components/slides/slide-preview.tsx` — 3× `touchAction:'manipulation'` on editable wrappers.

## GSD artifacts
- 92-CONTEXT.md, 92-PLAN.md, 92-SUMMARY.md (this), 92-VERIFICATION.md (status: human_needed — device checklist).

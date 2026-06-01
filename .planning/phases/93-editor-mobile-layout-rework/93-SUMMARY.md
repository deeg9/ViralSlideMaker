# Phase 93 — Editor Mobile Layout Rework · SUMMARY

**Milestone:** v2.17 · **Branch:** `feat/carousel-output-format` · **Date:** 2026-05-31
**Requirements:** EDIT-01 (folded from Phase 92), EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06
**Status:** code-complete — awaiting the single consolidated on-device iPhone pass (VERIFICATION = `human_needed`)
**New deps:** 0 · **tsc:** 20 errors (baseline, all `*.test.ts(x)`; 0 new) · **Slide tests:** 121/121

## What shipped (per requirement)

| Req | Approach (one line) | Key file(s) |
|-----|---------------------|-------------|
| EDIT-01 | Gesture-synchronous single-tap-to-edit on touch (focus fires inside `onPointerUp`), 10px drag threshold, `scrollIntoView` + `interactiveWidget:'resizes-visual'` for keyboard occlusion | `src/lib/editor/touch-edit.ts` (new), `slide-preview.tsx`, `app/layout.tsx` |
| EDIT-02 | Both desktop `<aside>`s → `hidden lg:flex`; canvas dominates the single mobile column; slim mobile top bar replaces the left action row | `slide-editor.tsx` |
| EDIT-03 | Three tab rails extracted to one `toolPanelBody` const, re-hosted (not rebuilt) into a bottom `Sheet` opened by mobile tab triggers | `slide-editor.tsx`, `src/components/ui/sheet.tsx` (new) |
| EDIT-04 | Thin `SlideList` filmstrip with edge-fade mask + "n / total" counter — no hidden horizontal scroll | `slide-editor.tsx` (reuses `slide-list.tsx`) |
| EDIT-05 | Slide delete confirm-gated on BOTH breakpoints; mobile delete spaced to the bottom of the layers sheet, away from add/export primaries; undo covers it | `slide-editor.tsx` |
| EDIT-06 | Persistent safe-area-padded bottom action bar (add, undo/redo, Public, Export); controls extracted to shared consts reused by the desktop portlet | `slide-editor.tsx` |

## EDIT-01 specifics (the folded gate)
- **Gesture-synchronous focus:** new `focusEditableSynchronously(host)` finds the `[contenteditable]` surface (or the host itself for custom-text), imperatively sets `contentEditable='true'`, calls `.focus()`, places the caret at end, and `scrollIntoView({block:'center'})`. It is invoked DIRECTLY inside the `onPointerUp` handler of each of the 3 editable wrappers — so `.focus()` runs in the user gesture and iOS summons the keyboard. The old deferred `useEffect` (`:1107`) / `requestAnimationFrame` (`:3159`) focus paths are LEFT IN PLACE as the desktop/fallback route (mouse double-click still routes through setState→effect).
- **Single-tap vs double-tap:** changed edit-entry on TOUCH to a single tap (`onPointerUp`). The desktop `onDoubleClick` edit-entry is untouched — the touch path is gated on `pointerType==='touch'` (via the tap tracker), so mouse double-click-to-edit is byte-identical.
- **Drag threshold:** **10px** (`TAP_THRESHOLD_PX`). `createTapTracker` records the pointerdown position and only treats a pointerup as a tap when total movement < 10px AND `pointerType==='touch'`. A larger move falls through to react-rnd's drag (which has no built-in threshold).
- **Keyboard occlusion:** `scrollIntoView({block:'center'})` on focus + `interactiveWidget:'resizes-visual'` added to the `viewport` export so the iOS keyboard shrinks the *visual* viewport rather than overlaying it; the `bottom-0`-anchored sheet + the scrolled field ride above the keyboard.

## sheet.tsx
- Built on **`@radix-ui/react-dialog`** (the same base `dialog.tsx` wraps) — **zero new deps**. Mirrors `dialog.tsx` structure exactly.
- side=bottom, `rounded-t-2xl`, slide-up animation, `max-h-[85dvh]`, scrollable `SheetBody`, `pb-[max(1rem,env(safe-area-inset-bottom))]`, grab-handle pill, 44px close. Modal by default.
- **Rails re-hosted into it:** `TextEditorPanel` (or `LegacyTextEditorPanel`), `ElementsPanel`, `ImagePickerPanel` — all via the shared `toolPanelBody` const (rendered once, used in BOTH the desktop right-aside scroll body and the mobile sheet). `LayersPanel` + the destructive delete re-hosted into a second (layers) sheet.

## Desktop-regression guard
- Both desktop `<aside>`s are `hidden lg:flex`; all mobile chrome is `lg:hidden`. The `lg:grid-cols-[260px_1fr_340px]` grid is unchanged.
- `isDesktop = useMediaQuery('(min-width:1024px)')` gates only the JS arrangement (sheet `open` is `!isDesktop && …`). The desktop render path is byte-identical: the desktop tabs/panels/portlet use the SAME extracted consts that previously were inline JSX.
- `useMediaQuery` hardened against missing `window.matchMedia` (jsdom/SSR) → defaults `isDesktop=false`, so render tests exercise a valid branch (this also fixed a would-be regression in the SlideEditor keyboard tests).
- Verified by stash-compare: the editor test suite has **16 pre-existing baseline failures (4 files)** identical with my changes stashed — **0 new failures** introduced.

## tsc + tests
- `npx tsc --noEmit` → 20 errors, all `*.test.ts(x)`, identical to baseline. **0 new.**
- `npx vitest run src/components/slides` → **121/121**.
- `npx vitest run src/components/editor src/lib/editor` → 16 failures = baseline (phase-70 doc/tsc-baseline sweep + pre-existing treatment-sync/watermark-sync/text-panel-regression jsdom failures); **0 new** (stash-verified).
- `npx next build` → **succeeds**; `/project/[id]` editor route compiles (validates all JSX + Tailwind arbitraries incl. mask-image + env() safe-area).

## Self-review findings + fixes
1. **`window.matchMedia` jsdom crash** — `useMediaQuery` threw in render tests, breaking 102 SlideEditor-rendering tests. **Fixed** by guarding the hook (defaults to no-match). Net: editor suite back to the 16 baseline failures.
2. **contentEditable selector** — confirmed React emits `contenteditable="false"` when not editing, so `querySelector('[contenteditable]')` matches at tap time; `focusEditableSynchronously` flips it to `true` and focuses. OK.
3. **Custom-text editable IS the host** (no inner `[contenteditable]` child) — `focusEditableSynchronously` falls back to the host element. OK.
4. **react-rnd pointer capture** — my `onPointerUp` lives on the wrapper inside `<Rnd>`. Whether iOS still dispatches `pointerup` to it after react-rnd's `setPointerCapture` is the one thing only a device can confirm — flagged in the VERIFICATION checklist (step covering tap-to-edit).
5. **Stale tap-tracker entries** for removed custom texts — minor Map leak, acceptable.

## Files
- NEW: `src/lib/editor/touch-edit.ts`, `src/components/ui/sheet.tsx`
- MODIFIED: `src/components/slides/slide-preview.tsx`, `src/app/layout.tsx`, `src/components/editor/slide-editor.tsx`, `src/hooks/use-media-query.ts`

## Commits (atomic, per requirement)
- `256fc91` fix(editor): gesture-synchronous single-tap-to-edit text on touch + keyboard occlusion (EDIT-01)
- `6a4ea45` feat(ui): bottom Sheet primitive on @radix-ui/react-dialog (EDIT-03)
- `c03c918` feat(editor): canvas-first mobile layout — filmstrip, tool sheet, bottom action bar (EDIT-02/03/04/06)
- `dce8564` fix(editor): confirm-gate destructive slide delete on both breakpoints (EDIT-05)

## Gate
EDIT-01..06 are code-complete-awaiting-device. The VERIFICATION (`human_needed`) holds the ONE consolidated iPhone-15 checklist covering EDIT-01..06 + the carried FOUND-01/02. This is the single combined on-device test that gates the editor track.
</content>

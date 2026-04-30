---
phase: 49-schema-unification-migration
reviewed: 2026-04-30T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/lib/types/slide.ts
  - src/lib/editor/text-box-adapter.ts
  - src/lib/editor/editor-actions.ts
  - src/lib/editor/editor-reducer.ts
  - src/lib/editor/use-slide-editor.ts
  - src/components/editor/slide-editor.tsx
findings:
  blocking: 0
  high: 3
  medium: 3
  low: 2
  nit: 2
  total: 10
status: findings
---

# Phase 49: Code Review Report

**Reviewed:** 2026-04-30
**Depth:** standard
**Files Reviewed:** 6
**Status:** findings

## Summary

Adapter, reducer, hook, and types are clean and consistent — round-trip parity logic
is correct for the five fixture shapes, mutation safety is preserved (spread/map/filter,
no in-place writes), `crypto.randomUUID()` matches existing usage, and the eager-migration
path through `useReducer`'s lazy initializer is genuinely idempotent.

The serious issues are concentrated at the **boundary between legacy state mutations and
the unified `text_boxes` array**. Phase 49 declares `text_boxes` to be canonical at save
time (dual-write reads from `text_boxes` and overwrites legacy fields), but several
existing code paths still mutate legacy fields without updating `text_boxes`:
`handleRegenerateText`, `handlePositionChange`, `handleWidthChange`, and the existing
`ADD_CUSTOM_TEXT` action wired to the new "Add Text Box" button. After any of these
edits, the next auto-save will read stale `text_boxes` and overwrite the user's freshly
edited legacy fields — silently undoing recent changes.

Two state-management gaps in `selectedTextBoxId`: it is not cleared on slide switch (the
sibling `selectedCustomTextId` is) and the hook exposes no clear-after-remove path. Both
are surfaceable in Phase 50 but better fixed now alongside the rest of the state plumbing.

`DUPLICATE_SLIDE` clones via `JSON.parse(JSON.stringify(slide))`, preserving `text_boxes`
IDs verbatim — collision risk if Phase 50's selection ever reaches across slides.

## High

### HR-01: Stale `text_boxes` causes regenerated hook/body text to be overwritten on save

**File:** `src/components/editor/slide-editor.tsx:227-237`
**Issue:** `handleRegenerateText` dispatches `UPDATE_SLIDE` with only `hook_text` and
`body_text`. The slide's existing `text_boxes` array (populated by eager migration on
load) still holds the *old* hook/body text. The auto-save effect (`doSave`,
line 90-111) then runs `textBoxesToLegacy(slide.text_boxes)` and writes that legacy slice
back into `hook_text`/`body_text`, **silently overwriting the user's just-regenerated
text** with the stale text inside `text_boxes`.

**Fix:** Update both legacy fields and the corresponding text_boxes entries atomically:

```ts
async function handleRegenerateText() {
  if (!currentSlide) return
  try {
    const result = await regenerateSlideText(projectId, selectedIndex, topic, currentSlide)
    const updatedTextBoxes = currentSlide.text_boxes?.map((tb) => {
      if (tb.role === 'hook') return { ...tb, text: result.hook_text }
      if (tb.role === 'body') return { ...tb, text: result.body_text }
      return tb
    })
    dispatch({
      type: 'UPDATE_SLIDE',
      index: selectedIndex,
      updates: {
        hook_text: result.hook_text,
        body_text: result.body_text,
        ...(updatedTextBoxes ? { text_boxes: updatedTextBoxes } : {}),
      },
    })
  } catch { /* silently handle */ }
}
```

### HR-02: `handlePositionChange` / `handleWidthChange` desync `text_boxes` from `style_overrides`

**File:** `src/components/editor/slide-editor.tsx:140-160`
**Issue:** Both handlers write to `slide.style_overrides.{hook,body}_{position,width}` but
do not update the matching `text_boxes` entries. On the next save, `textBoxesToLegacy`
re-derives `style_overrides_patch` from `text_boxes` (which still holds the *old*
position/width) and overrides the user's edit via the patch merge at lines 104-109. Same
overwrite class as HR-01 — the user drags the hook to a new spot, debounce fires 2s
later, save overwrites the new position with the pre-drag position from `text_boxes`.

**Fix:** Either (a) keep both legacy and `text_boxes` updated in these handlers, or
(b) — preferable per the Phase 49 design intent — switch these to dispatch
`UPDATE_TEXT_BOX` and let dual-write derive `style_overrides` on save. Phase 49's
contract states `text_boxes` is canonical; intermediate writes to legacy fields should
go away. If Phase 50 will refactor these call sites, document it explicitly in the
phase boundary; otherwise fix now:

```ts
function handlePositionChange(field: 'hook' | 'body', position: TextPosition) {
  if (!currentSlide?.text_boxes) return
  const targetBox = currentSlide.text_boxes.find((tb) => tb.role === field)
  if (!targetBox) return
  dispatch({
    type: 'UPDATE_TEXT_BOX',
    slideIndex: selectedIndex,
    textBoxId: targetBox.id,
    updates: {
      position: { anchor: 'custom', x: position.x, y: position.y,
                  ...(targetBox.position.width !== undefined ? { width: targetBox.position.width } : {}) },
    },
  })
}
```

### HR-03: "Add Text Box" button still dispatches `ADD_CUSTOM_TEXT` (legacy-only)

**File:** `src/components/editor/slide-editor.tsx:163-165, 337-343`
**Issue:** `handleAddCustomText` dispatches `ADD_CUSTOM_TEXT`, which appends only to
`slide.custom_texts` (reducer line 96-115), leaving `slide.text_boxes` unchanged. The
`text_fields` button at line 337 wires this handler. On the next save, `textBoxesToLegacy`
regenerates `custom_texts` from `text_boxes` — the user's newly added custom text is
**dropped from `custom_texts` entirely** because `text_boxes` never received it.

This is the worst variant of the desync class because the user explicitly clicked "Add
Text Box," so the missing text is highly visible and immediately broken.

**Fix:** Either dispatch the new `ADD_TEXT_BOX` (preferred — that's why it exists) or
have `ADD_CUSTOM_TEXT` also push a corresponding entry into `text_boxes`. Since Phase 49
explicitly added `ADD_TEXT_BOX`, switching the call site is the cleaner change:

```ts
function handleAddCustomText() {
  dispatch({ type: 'ADD_TEXT_BOX', slideIndex: selectedIndex, role: 'custom' })
}
```

(Note: this removes legacy `custom_texts` from the write path entirely, which also
matches the dual-write contract — `custom_texts` will be regenerated by `textBoxesToLegacy`
at save time.)

## Medium

### MR-01: `DUPLICATE_SLIDE` preserves `text_boxes` IDs across slides

**File:** `src/lib/editor/editor-reducer.ts:62-67, 23-25`
**Issue:** `deepCloneSlide` uses `JSON.parse(JSON.stringify(slide))`, which copies all
`text_boxes[].id` values verbatim. After duplication, two slides share the same set of
text-box UUIDs. The reducer cases for `UPDATE_TEXT_BOX` / `REMOVE_TEXT_BOX` filter by
`slideIndex` first, so per-slide updates remain correctly scoped — not a bug in the
reducer itself.

The risk is downstream: if Phase 50's selection or any future logic ever cross-references
text-box IDs without slide context (e.g., a flat lookup, drag-and-drop between slides,
analytics IDs), the collision will produce wrong-target writes. Same concern theoretically
applies to `custom_texts` and `custom_images` IDs in the existing duplicate path, but
Phase 49 is the right time to fix this for the new model.

**Fix:** After cloning, regenerate IDs on the copy:

```ts
case 'DUPLICATE_SLIDE': {
  const slides = [...state.present]
  const clone = deepCloneSlide(slides[action.index])
  if (clone.text_boxes) {
    clone.text_boxes = clone.text_boxes.map((tb) => ({ ...tb, id: crypto.randomUUID() }))
  }
  if (clone.custom_texts) {
    clone.custom_texts = clone.custom_texts.map((ct) => ({ ...ct, id: crypto.randomUUID() }))
  }
  if (clone.custom_images) {
    clone.custom_images = clone.custom_images.map((ci) => ({ ...ci, id: crypto.randomUUID() }))
  }
  slides.splice(action.index + 1, 0, clone)
  return pushHistory(state, slides)
}
```

### MR-02: `selectedTextBoxId` not cleared on slide switch

**File:** `src/lib/editor/use-slide-editor.ts:29` and the slide-switch effect at
`src/components/editor/slide-editor.tsx:79-82`
**Issue:** The sibling `selectedCustomTextId` and `selectedCustomImageId` states are
cleared by a `useEffect([selectedIndex])` at lines 79-82. `selectedTextBoxId` (which
lives inside `useSlideEditor`) has no analogous cleanup, so a stale ID will persist when
the user switches slides — and on the new slide, no text box has that ID, so the
selection silently lapses (or, worse if MR-01 isn't fixed, accidentally re-selects a
duplicate).

**Fix:** Either clear inside the hook (preferred — co-located with the state):

```ts
// in use-slide-editor.ts, expose a way to reset:
// or have the consumer call setSelectedTextBoxId(null) in the slide-switch effect.
```

Or in `slide-editor.tsx`, have the consumer pull `setSelectedTextBoxId` from the hook
and clear it alongside the other selections in the existing effect (line 79-82).

### MR-03: No `selectedTextBoxId` cleanup after `REMOVE_TEXT_BOX`

**File:** `src/lib/editor/use-slide-editor.ts` (state) and `editor-reducer.ts:218-227`
**Issue:** Compare to `handleRemoveCustomText` (slide-editor.tsx:194-197) which clears
`selectedCustomTextId` after dispatching the remove action. The reducer-level
`REMOVE_TEXT_BOX` case has no analog, and the hook exposes only `setSelectedTextBoxId`.
This is technically Phase 50's surface (no UI yet calls `REMOVE_TEXT_BOX`), but the
asymmetry is a foot-gun: the first consumer must remember to clear selection or risk
referencing a now-deleted box.

**Fix:** Either document the requirement explicitly in the hook's return JSDoc, or
provide a `removeTextBox(slideIndex, textBoxId)` helper from the hook that does both.

## Low

### LR-01: `delete out.hook_segments` mutation pattern in `doSave`

**File:** `src/components/editor/slide-editor.tsx:99, 101, 103`
**Issue:** Using `delete` on typed object properties is functional but unusual style for
this codebase (the rest of the file uses spread + conditional inclusion). The current
behavior — removing the key when the slice has no segments — *is* the desired round-trip
semantic, so this is a style note, not a bug. Consider building `out` once via spread:

```ts
const out: Slide = {
  ...slide,
  hook_text: slice.hook_text,
  body_text: slice.body_text,
  ...(slice.hook_segments !== undefined ? { hook_segments: slice.hook_segments } : { hook_segments: undefined }),
  // ...
}
```

though note `exactOptionalPropertyTypes` is OFF (tsconfig.json:7 only sets `strict`),
so the current `delete` form compiles fine.

### LR-02: `customTextToBox` width default of 60 is a magic number

**File:** `src/lib/editor/text-box-adapter.ts:160`
**Issue:** `width: tb.position.width ?? 60` hardcodes 60. The reducer's `ADD_CUSTOM_TEXT`
also uses 60 (line 104), and `defaultPositionForRole('custom')` uses 60 (line 36). Three
copies of the same magic number — refactor into a shared constant
`DEFAULT_CUSTOM_TEXT_WIDTH = 60` exported from `slide.ts` or a shared constants module.

## Nit

### NR-01: `migrateLegacySlides` won't re-run on prop change

**File:** `src/lib/editor/use-slide-editor.ts:25`
**Issue:** `useReducer(editorReducer, initialSlides, createInitialState)` runs the
initializer **only on first mount**. If the parent re-renders with a new `initialSlides`
prop reference, migration does not re-run and the old state persists. This is standard
React `useReducer` behavior and almost certainly intentional (otherwise pending edits
would be wiped), but worth a JSDoc note for future maintainers since the previous
behavior in the codebase did not depend on this distinction.

### NR-02: `effects` object reference shared between `TextBox` and `style_overrides_patch`

**File:** `src/lib/editor/text-box-adapter.ts:230, 244`
**Issue:** `patch.hook_text_effects = hookBox.effects` (no clone) means the legacy slice
holds the same object reference as the source `TextBox`. Subsequent mutations to either
side would alias. Current callers always treat these as immutable (UPDATE_TEXT_BOX uses
`{ ...tb, ...action.updates }`), so no live bug, but a deep-clone or readonly type would
make the contract explicit. Same applies to `segments` on lines 211/214.

---

_Reviewed: 2026-04-30_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

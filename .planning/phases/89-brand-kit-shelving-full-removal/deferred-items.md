# Phase 89 — Deferred Items (out-of-scope discoveries)

Items discovered during execution that are NOT caused by this phase's changes.
Logged per the executor SCOPE BOUNDARY rule; not fixed here.

## From Plan 89-01

### Pre-existing failing test: `template-picker.test.tsx` Phase-56 templates assertion

- **Test:** `<TemplatePicker> TPLTHUMB-02 parity > renders visible Phase 56
  templates (editorial-serif, notes-app-chic) as SlidePreview tiles, not
  swatch fallback`
- **Failure:** `Unable to find an element with the text: Notes App Chic`.
- **Status:** PRE-EXISTING on the plan base SHA `7bda938` — verified by checking
  out the base-SHA versions of `template-picker.test.tsx` + `template-picker.tsx`
  + `template-tile-preview.tsx` and running the suite: `1 failed | 8 passed (9)`
  with the identical "Notes App Chic" error. NOT introduced by the brand-kit
  removal.
- **Root cause (not investigated in depth — out of scope):** the
  `notes-app-chic` template (name still `'Notes App Chic'` in
  `src/lib/render/templates/notes-app-chic.ts`) no longer renders as a picker
  tile in the default (no-category) picker view. Likely a keeper-set or
  category-curation change from a recent quick task (`260520-064` / `260520-ft0`
  reworked tr3nding-news / news-oracle and may have shifted the keeper list).
- **Action:** NOT fixed in Plan 89-01 (out of scope — pre-dates this plan).
  The brand-kit strip itself resolved the 3 brand-kit-related failures; this
  4th failure is unrelated. Recommend a follow-up quick task to either
  re-add `notes-app-chic` to `pickerTemplates` or update the test to match
  the current keeper set.

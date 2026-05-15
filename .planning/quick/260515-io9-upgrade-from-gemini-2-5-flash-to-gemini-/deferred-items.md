# Deferred Items — quick-260515-io9

Out-of-scope discoveries found during execution. NOT fixed (SCOPE BOUNDARY:
only auto-fix issues directly caused by the current task's changes).

## Pre-existing test failure (unrelated to model swap)

- **File:** `src/__tests__/ai/generate-slides.test.ts`
- **Test:** `searchPhotos > calls Pexels with orientation=portrait` (line ~351)
- **Symptom:** Test asserts `query: 'nature'` but `searchPhotos` now passes
  `query: 'nature natural lighting, candid, editorial, portrait'` plus
  `page: 1, per_page: 1`.
- **Verified pre-existing:** Reproduced on the clean base commit `993989d`
  with all io9 working-tree changes stashed. The failure exists independent
  of the Gemini model swap (a stale Pexels-query fixture).
- **Disposition:** DEFERRED. Not caused by this quick task; fixing it is a
  separate fixture-maintenance task.

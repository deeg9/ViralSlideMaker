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

## From Plan 89-02

### Pre-existing failing snapshot suites: t3x-template parity fingerprints

- **Suites:** `parity.style-spec-absent-baseline.test.tsx`,
  `parity.template-fingerprint-decorations-undefined.test.tsx`,
  `parity.template-fingerprint.test.tsx` (snapshot mismatches for
  `tr3nding-news`, `sunset-tabloid`, `soft-sage`).
- **Status:** PRE-EXISTING on the plan base SHA — verified by running the
  suites against the untouched main repo: identical failing snapshots for the
  same 3 templates. Introduced by the quick-260519-t3x template additions
  whose parity snapshots were never regenerated. NOT caused by brand-kit
  removal (the 3 BKSHELVE-05 byte-identity fixture suites stay GREEN 45/45).
- **Action:** NOT fixed in Plan 89-02 (out of scope — pre-dates this plan).
  Recommend a follow-up quick task to regenerate / re-bless the t3x parity
  snapshots.

## From Plan 89-03

### Pre-existing failing test: `publish-style-spec-snapshot.test.ts` + `publish-template-id-snapshot.test.ts`

- **Failure:** `No "TEMPLATE_IDS" export is defined on the "@/lib/render/templates/index" mock` — `registry.ts` (transitively imported by `publish.ts` since Plan 89-02 rewired publish to `resolveTemplate`) reads `TEMPLATE_IDS`, but both test files' `vi.mock('@/lib/render/templates/index')` only stubs `getTemplate`.
- **Status:** PRE-EXISTING on the plan base SHA `6a362c7` — verified by checking out the base-SHA versions of both test files + `publish.ts` and running them: identical `No "TEMPLATE_IDS" export` failure. NOT caused by the Plan 89-03 brand-kit strip (this plan only removed the now-dead `mergeWithBrandKit` mock + `brand_kits` table branch from these files — the `templates/index` mock was untouched).
- **Action:** NOT fixed in Plan 89-03 (out of scope — pre-dates this plan, introduced by Plan 89-02's publish-resolver rewiring). Recommend a follow-up quick task to add `TEMPLATE_IDS` (and any other registry exports) to the `vi.mock` in both publish snapshot test files.

### Pre-existing failing test: `forked-project-references-strip.test.tsx`

- **Failure:** `Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL env vars` — `project/[id]/page.tsx` calls `createAdminClient()` which throws when the env vars are unset in the jsdom test env.
- **Status:** PRE-EXISTING on the plan base SHA `6a362c7` — verified by running the base-SHA version: identical 2-test env-var failure. NOT caused by the Plan 89-03 brand-kit strip (this plan only removed the now-dead `getBrandKit` mock of the Plan-01-deleted `settings/brand-kit/actions` module — the env-var failure is upstream of any brand-kit code).
- **Action:** NOT fixed in Plan 89-03 (out of scope — environment setup issue, pre-dates this plan).

### Pre-existing failing editor suites

- **Suites:** `phase-70-final-regression-sweep.test.ts`,
  `slide-editor.treatment-sync.test.tsx`, `slide-editor.watermark-sync.test.tsx`,
  `text-editor-panel.regression.test.tsx` (16 failing tests total).
- **Status:** PRE-EXISTING on the plan base SHA — verified by running all four
  against the untouched main repo: identical failure counts. NOT caused by the
  brand-kit prop-chain removal (the worktree shows the same 16 failures, no
  new ones).
- **Action:** NOT fixed in Plan 89-02 (out of scope — pre-dates this plan).

---
phase: 89-brand-kit-shelving-full-removal
plan: 04
subsystem: types
tags: [brand-kit, style-spec, type-relocation, removal, migration, final-sweep]

# Dependency graph
requires:
  - phase: 89-03
    provides: every brand-kit consumer (UI, render, publish, AI, style-from-reference) already stripped; only the shared library + the style-spec.ts BrandKitTextPosition alias import remained
provides:
  - The BrandKitTextPosition alias is relocated in-file into style-spec.ts as TextPosition — no brand-kit token survives in the neutral StyleSpec contract module
  - src/lib/brand-kit/ and src/lib/types/brand-kit.ts are deleted entirely; zero dangling imports across src/
  - The 20260427_brand_kit_template.sql migration carries a SHELVED doc note (DB schema left dormant, not rolled back)
  - The brand-kit feature is fully removed from the codebase — whole-tree tsc clean, 3 fixture suites GREEN, footprint grep returns only documented false positives
affects: [phase-90]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-file type-alias relocation: a generic literal-union extracted from a doomed module is re-declared as an exported alias near the host module's other top-level aliases (StyleSpecVersion house style)"
    - "Library delete LAST: after every consumer is stripped in earlier plans, the shared module is git rm'd with a confirming pre-delete import grep; whole-tree tsc is the integration proof"
    - "DB schema left dormant: a shelved migration is marked SHELVED via a top-of-file doc note only — never rolled back, no down-migration"

key-files:
  created: []
  modified:
    - src/lib/types/style-spec.ts
    - src/lib/types/__tests__/style-spec.test.ts
    - supabase/migrations/20260427_brand_kit_template.sql
  deleted:
    - src/lib/brand-kit/get-effective-template.ts
    - src/lib/brand-kit/get-effective-template.test.ts
    - src/lib/types/brand-kit.ts

key-decisions:
  - "TextPosition JSDoc avoids the literal 'brand-kit' token so style-spec.ts comes back fully token-clean under the final grep sweep (plan note: NO brand-kit token survives in the neutral module)"
  - "resolve-watermark.ts left untouched — it defines its OWN local BrandKitSubset interface with no import; the plan and RESEARCH Pitfall 3 explicitly mandate keeping it as a null-tolerant no-op"
  - "Footprint-grep remainders (resolve-watermark.ts/.test.ts, the preview-render Phase-89 comment, the 'brand-kit' reserved username, the reference-image-uploader comment) are all accepted: kept module + documented comment-only false positives — no strong token (synthesize/merge/SENTINEL/useBrandKitRemix) survives"

patterns-established:
  - "Final-wave removal verification: tsc count + 3-suite parity gate + strong-token grep + full-suite base-vs-head failed-count diff"

requirements-completed: [BKSHELVE-09]

# Metrics
duration: 9min
completed: 2026-05-20
---

# Phase 89 Plan 04: Brand-Kit Library Deletion & Final Removal Sweep Summary

**Relocated the `BrandKitTextPosition` alias in-file into `style-spec.ts` as `TextPosition`, deleted the `src/lib/brand-kit/` library and `src/lib/types/brand-kit.ts` entirely with zero dangling imports, marked the brand-kit DB migration SHELVED (dormant, not rolled back), and ran the final whole-tree verification — `tsc` at the 20-error baseline with no brand-kit-named file, the 3 BKSHELVE-05 fixture suites GREEN at 45/45, and the full suite at exactly the pre-existing 66-failure baseline (zero new failures).**

## Performance

- **Duration:** ~9 min
- **Tasks:** 3 (Task 3 verification-only — no source edits, no commit)
- **Commits:** 2 (one per source-changing task)
- **Files changed:** 3 modified, 3 deleted

## Accomplishments

- **Type relocation (Task 1, ordering-critical — Pitfall 2).** Added `export type TextPosition = 'top' | 'center' | 'bottom'` near `StyleSpecVersion` in `style-spec.ts`, removed the `@/lib/types/brand-kit` import, and repointed `StyleSpecLayout.hookPosition` to the local alias. Updated the L8/L108 comment headers so no brand-kit token survives. `style-spec.test.ts` T5 was repointed to `TextPosition`; T10's brand-kit import-regex was deleted (4 closed-enum source modules now, was 5) with the test name updated. The relocation type-checked clean BEFORE the `brand-kit.ts` delete — preventing the `style-spec.ts` → every-StyleSpec-consumer cascade.
- **Library deletion (Task 2).** Confirmed via `grep -RIn '@/lib/brand-kit' '@/lib/types/brand-kit' src/` that the only remaining importers were the brand-kit modules themselves, then `git rm -r`'d `src/lib/brand-kit/` (`get-effective-template.ts` + test) and `src/lib/types/brand-kit.ts`. Threat T-89-07 (dangling-import build break) mitigated — the pre-delete grep was empty and post-delete `tsc` stayed at 20.
- **Migration SHELVED (Task 2).** Added an 8-line `SHELVED 2026-05-20 (Phase 89, BKSHELVE)` doc-note block at the top of `supabase/migrations/20260427_brand_kit_template.sql` — the brand-kit schema is left dormant for a future revival; NOT rolled back, no down-migration (CONTEXT lock — threat T-89-08 accept disposition).
- **Final sweep (Task 3).** Whole-tree `tsc --noEmit` = 20 errors (= baseline; all pre-existing test-file mock noise, none in a brand-kit-named file). The 3 BKSHELVE-05 fixture suites — `legacy-templates-byte-identical`, `legacy-templates-regression`, `new-templates-parity` — GREEN at **45/45** (no fixture regenerated). Wave-0 `getTemplate-brand-kit-fallback.test.ts` still 3/3. Footprint grep: strong tokens (`synthesizeBrandKitTemplate`/`mergeWithBrandKit`/`BRAND_KIT_TEMPLATE_ID`/`useBrandKitRemix`) **zero**. Full suite: **66 failed at HEAD = 66 failed at base SHA `c82ce4e`** — identical per-file failed-test counts, zero new failures.

## Task Commits

1. **Task 1: relocate BrandKitTextPosition into style-spec.ts as TextPosition** — `5c80544` (refactor)
2. **Task 2: delete brand-kit library + types, mark migration SHELVED** — `5055659` (refactor, 3 file deletions)
3. **Task 3: final verification sweep** — no commit (verification-only, no regression surfaced, no source edits)

## Files Created/Modified

- `src/lib/types/style-spec.ts` — Added the in-file `TextPosition` alias; removed the `@/lib/types/brand-kit` import; `StyleSpecLayout.hookPosition` now uses `TextPosition`; comment headers de-brand-kitted. No brand-kit token survives.
- `src/lib/types/__tests__/style-spec.test.ts` — T5 repointed to `TextPosition` (import + `@ts-expect-error` text + title); T10 brand-kit import-regex deleted, "all 5" → "all 4".
- `supabase/migrations/20260427_brand_kit_template.sql` — Added the SHELVED doc-note block at the top; the migration body is otherwise untouched.
- `src/lib/brand-kit/get-effective-template.ts` — DELETED (the shared library: `synthesizeBrandKitTemplate`, `mergeWithBrandKit`, `BRAND_KIT_TEMPLATE_ID`).
- `src/lib/brand-kit/get-effective-template.test.ts` — DELETED (its test — 4 passing tests, accounts for the 3320 → 3316 base→head passed-count delta).
- `src/lib/types/brand-kit.ts` — DELETED (`BrandKit` interface + `LogoPosition`/`BrandKitTextAlign`/`BrandKitTextPosition`/`BrandKitHookStyle` aliases).

## Decisions Made

- **`TextPosition` JSDoc avoids the literal `brand-kit` token.** The plan note explicitly requires NO brand-kit token in the neutral `style-spec.ts` module so the final grep sweep comes back clean. The JSDoc says "relocated in-file from a shelved module in Phase 89 (BKSHELVE-09)" rather than naming the brand-kit module — `grep -RIn "BrandKitTextPosition|brand-kit|BrandKit" src/lib/types/style-spec.ts` returns nothing.
- **`resolve-watermark.ts` left untouched.** It defines its OWN local `BrandKitSubset` interface (no import) and is the deliberately-kept null-tolerant watermark resolver (RESEARCH Pitfall 3 — deleting it over-extends the parity surface). The plan's `<notes>` explicitly says "Do not touch it." Its `brandKit`-named param/interface/fixture hits in the footprint grep are accepted as a kept module, not an incompletely-stripped reference.
- **Task 3 produced no commit.** It is verification-only; the sweep surfaced no regression, so there were no source edits to commit. The verification results are recorded here.

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 landed each acceptance criterion on the first pass; Task 3's sweep surfaced no regression requiring an in-place fix.

## Footprint-Grep Sweep — Accepted Remainders

The final `grep -RIn -E 'BrandKit|brandKit|BRAND_KIT|synthesizeBrandKitTemplate|mergeWithBrandKit|BRAND_KIT_TEMPLATE_ID|useBrandKitRemix' src/` returns ONLY:

| Remainder | Why accepted |
|-----------|--------------|
| `src/lib/render/resolve-watermark.ts` (`BrandKitSubset` interface, `brandKit` param) | The deliberately-kept null-tolerant watermark resolver — own local interface, no import. RESEARCH Pitfall 3 + plan note mandate keeping it. |
| `src/lib/render/resolve-watermark.test.ts` (`baseBrandKit` fixture) | The test for the kept resolver — RESEARCH Bucket C: stays if `resolveWatermark` is kept (it was). |
| `src/lib/render/__tests__/preview-render.test.ts:71` (Phase-89 comment) | A comment introduced by Plan 89-02 *describing* the `brandKit` positional-arg removal — no code, byte-identical behavior. |
| `src/components/dashboard/reference-image-uploader.tsx:4` (comment) | Documented false positive — RESEARCH Bucket B "Mirrors BrandKitLogoUploader naming convention". |
| `src/lib/profile/reserved-usernames.ts:24` (`'brand-kit'` string) | The reserved-username string — explicitly kept per RESEARCH Open Question 3 (harmless reserved word). |

Strong tokens (`synthesizeBrandKitTemplate`, `mergeWithBrandKit`, `BRAND_KIT_TEMPLATE_ID`, `useBrandKitRemix`) are **zero** — no real-code or non-false-positive reference survives.

## Deferred Issues

None new. The pre-existing failing-test set (66 tests / 25 files — t3x-template parity snapshots, editor-suite DOM-signature tests, auth/stripe/legal/api-keys mock-typing tests, the `forgot-password` e2e) is unchanged from the plan base SHA `c82ce4e` and is already logged in `.planning/phases/89-brand-kit-shelving-full-removal/deferred-items.md` by Plans 89-01..03. Brand-kit removal introduced ZERO new failures.

## Notes / Tooling

- The committed `vitest.config.ts` excludes `**/.claude/worktrees/**`, which swallows every test inside this agent's worktree. An untracked `vitest.worktree.config.ts` (mirrors `vitest.config.ts` exactly, minus the worktree exclude) was created and used via `--config` to run suites from within the worktree — same pattern as Plans 89-02/03. It is left untracked and was never staged.
- The full-suite base-vs-head comparison was run by executing `npx vitest run --reporter=json` once at the main-repo HEAD (which is exactly the plan base `c82ce4e`) and once inside the worktree, then diffing per-file failed-test counts.

## Next Phase Readiness

- The brand-kit feature is fully removed from the codebase. `src/lib/brand-kit/` and `src/lib/types/brand-kit.ts` no longer exist; whole-tree `tsc` is clean at the 20-error baseline; the footprint grep is clean of all strong tokens.
- The brand-kit DB schema (`brand_kits` table + the `20260427` migration columns) is left dormant — a future revival can rewire against it without a new migration.
- Phase 89 is complete. Phase 90 (PREVIEW-04/05) can proceed — `template-picker.test.tsx` and `template-tile-preview.tsx` carry no brand-kit content blocking the `<img>`-rewrite.

## Verification Results

- **BKSHELVE-09 hard check** — `npx tsc --noEmit | grep -cE 'error TS'`: **20** (= baseline; all pre-existing test-file mock noise; `grep ... | grep -i 'brand-kit'` returns nothing — no brand-kit-named file).
- **HARD GATE — BKSHELVE-05** — `legacy-templates-byte-identical` + `legacy-templates-regression` + `new-templates-parity`: **45/45 GREEN** (no fixture regenerated).
- **Wave-0 fallback** — `getTemplate-brand-kit-fallback.test.ts`: **3/3 pass**.
- **style-spec contract** — `style-spec.test.ts`: **10/10 pass** (T5 repointed, T10 down to 4 modules).
- **Strong-token grep** — `synthesizeBrandKitTemplate|mergeWithBrandKit|BRAND_KIT_TEMPLATE_ID|useBrandKitRemix` across `src/`: **zero**.
- **Dangling-import grep** — `@/lib/brand-kit|@/lib/types/brand-kit` across `src/`: **zero**.
- **Migration** — `20260427_brand_kit_template.sql` carries the SHELVED doc note; file still exists; no down-migration added.
- **Full suite** — **66 failed / 3316 passed at HEAD = 66 failed / 3320 passed at base `c82ce4e`**; per-file failed-test counts identical (path-normalized); the 4-test passed-count delta is exactly the deleted `get-effective-template.test.ts` — ZERO new failures.

## Self-Check: PASSED

- `src/lib/types/style-spec.ts` — FOUND, `TextPosition` declared + used by `StyleSpecLayout.hookPosition`, no brand-kit token
- `src/lib/types/__tests__/style-spec.test.ts` — FOUND, T5/T10 repointed
- `supabase/migrations/20260427_brand_kit_template.sql` — FOUND, SHELVED note present
- `src/lib/brand-kit/` — confirmed DELETED
- `src/lib/types/brand-kit.ts` — confirmed DELETED
- Commits `5c80544`, `5055659` — both present in `git log`

---
*Phase: 89-brand-kit-shelving-full-removal*
*Completed: 2026-05-20*

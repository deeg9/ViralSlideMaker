---
phase: 83-db-backed-template-storage-registry-merge
plan: 03
status: complete
requirements: [TSTORE-03, TSTORE-04]
key-files:
  created:
    - src/__tests__/render/db-template-parity.test.tsx
    - src/__tests__/render/legacy-byte-identity-after-storage.test.ts
---

# 83-03 Summary: DB-template render parity + byte-identity guard (TSTORE-03/04)

## What was built

Two hermetic test suites proving the Phase 83 render gate. Both inject fixture
DB rows via the registry test seam (`__setDbTemplateFetcher`) — no live DB.

### `db-template-parity.test.tsx` — TSTORE-03 (5 tests, all pass)

Proves a DB-backed template renders consistently across all three render paths.
The fixture DB row's `flat_style` is copied verbatim from the `bold-yellow`
code template so the fixture is realistic and the cross-path comparison is exact.

1. `resolveTemplate` maps the DB row to a `SlideTemplate` — `flat_style` scalar
   fields (`backgroundColor`, `fontFamily`, `hookFontSize`) flow through intact.
2. Satori PNG path — `buildSlideElement` renders the DB template without
   throwing; markup contains the hook text.
3. HTML export path — `buildSlideHtml` returns non-empty HTML with the hook text.
4. **Cross-path parity** — because the DB fixture's `flat_style` is copied from
   `bold-yellow`, `buildSlideHtml` of the DB template and of the code template
   differ ONLY by `id`/`name`; normalizing those out, the HTML is byte-equal.
   This proves DB storage does not change render output.
5. Canvas path — `SlidePreview` renders the resolved DB template; the SAME
   `SlideTemplate` object feeds all three consumers ("one SlideTemplate, three
   consumers" — no per-path divergence introduced by DB storage).

### `legacy-byte-identity-after-storage.test.ts` — TSTORE-04 (3 tests, all pass)

1. async `resolveTemplate` returns every one of the 13 code templates
   sha256-identical to sync `getTemplate`.
2. A colliding DB row cannot shadow a code template (code wins at the render
   boundary).
3. The registry layer never mutates the code `templates[]` array (sha256 of
   `templates` unchanged after `resolveTemplate` + `getPickerTemplates` calls).

## Phase 83's own tests: 16/16 pass

`registry-merge.test.ts` (8) + `db-template-parity.test.tsx` (5) +
`legacy-byte-identity-after-storage.test.ts` (3) = 16/16 passing.

## Render-suite regression check — PRE-EXISTING failures, NOT a Phase 83 regression

`npx vitest run src/__tests__/render` reports 6 failing tests across 3 files:
`legacy-templates-byte-identical.test.ts` (news-drop hash),
`legacy-templates-regression.test.tsx` (4 v2.6-baseline snapshots),
`new-templates-parity.test.tsx` ("registry length invariant" expects 12, array
has 13).

**These 6 failures are PRE-EXISTING and were verified present at the
pre-Phase-83 commit (`HEAD~10`) with the identical count (6 failed / 45 in the
3 files; full suite 24 failed files / 47 failed tests both before and after
Phase 83).** Root cause: a recent quick task (`260518-jhg`) appended `newsOracle`
as the 13th code template and retired `news-cyan` from the picker WITHOUT
regenerating the byte-identity/parity fixtures — the stale fixtures still expect
12 templates and the old `news-drop` hash.

**Per Plan 83-03 Task 3, the fixtures were NOT regenerated** — regenerating them
would mask the stale-fixture defect. `git status --porcelain` confirms NO file
under `src/__tests__/render/__fixtures__/` or `__snapshots__/` was modified by
Phase 83. (A `vitest run` of the whole suite auto-wrote two unrelated snapshots
under `src/lib/render/__tests__/__snapshots__/` — those were reverted; not
Phase 83's to touch.)

### HUMAN FLAG — pre-existing stale render fixtures

The `legacy-templates-byte-identical` / `legacy-templates-regression` /
`new-templates-parity` fixtures are stale relative to the 13-template registry
(quick task `260518-jhg`). They should be reviewed and regenerated as a separate
fix — independent of Phase 83. Phase 83 changed how no code template renders;
the byte-identity guard `legacy-byte-identity-after-storage.test.ts` (sha256 of
all 13 code templates, sync vs async) PASSES, which is the actual TSTORE-04
proof that the registry merge introduced zero render change.

## Full suite

`npx vitest run` — 3135 passed / 47 failed / 9 skipped (3192 total). The 47
failures are identical to the pre-Phase-83 baseline (3117 passed / 47 failed at
`HEAD~10`); Phase 83 added 18 passing tests and zero regressions.

## TSTORE-03 / TSTORE-04 status

- TSTORE-03: SATISFIED — `db-template-parity.test.tsx` proves a DB template
  renders consistently across canvas / Satori PNG / HTML, and identically to its
  code-template equivalent.
- TSTORE-04: SATISFIED for the registry-merge change — `legacy-byte-identity-
  after-storage.test.ts` proves async `resolveTemplate` returns all 13 code
  templates byte-identical to sync `getTemplate` and the merge never mutates
  `templates[]`. The legacy fixture suites' failures are a PRE-EXISTING
  stale-fixture defect unrelated to Phase 83 (flagged above for separate fix).

## Self-Check: PASSED (with documented pre-existing failures)
- Phase 83's 4 new test files: 16/16 pass.
- No Phase 83 fixture/snapshot modified (`git status` clean for render fixtures).
- Render-suite + full-suite failures verified identical to the pre-Phase-83
  baseline — zero regressions introduced by Phase 83.
- Pre-existing stale-fixture defect flagged for the human (not a Phase 83 issue).

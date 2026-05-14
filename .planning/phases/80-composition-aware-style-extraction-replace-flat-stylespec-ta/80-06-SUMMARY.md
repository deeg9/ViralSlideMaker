---
phase: 80-composition-aware-style-extraction-replace-flat-stylespec-ta
plan: 06
subsystem: database
tags: [v2.13, phase-80, supabase, migration, cache-purge, schema-version, style-spec-cache]

requires:
  - phase: 80-01
    provides: STYLE_SPEC_VERSION = 2 constant in src/lib/types/style-spec.ts (consumed by the defensive lookup filter)
  - phase: 80-02
    provides: parseStyleSpecSafe that rejects schema_version=1 — the reason a v1 cache row would surface as a confusing extraction error if not filtered
  - phase: 80-03
    provides: extractor emits schema_version=2 payloads (so writes after deploy already land at v2 — no write-side change needed)
provides:
  - Idempotent Supabase migration that purges schema_version != 2 (or NULL) rows from public.style_spec_cache on deploy
  - Defensive schema_version === 2 filter in lookupStyleSpec — wrong-version rows return null without bumping last_hit_at
  - Updated style_spec_cache test suite covering the v2 happy path + 4 defensive-filter cases (v1 row, missing version, null spec, string '2' coercion)
affects:
  - Phase 75 vision-extraction orchestrator (consumer of lookupStyleSpec — sees zero v1 hits post-deploy)
  - Phase 80-07 (next plan in this phase, if any cache-touching work follows)

tech-stack:
  added: []
  patterns:
    - "Cache schema-version bump: deploy-time migration purge + defensive read filter (belt-and-suspenders) for the race window between migration apply and constant rollout"
    - "IS DISTINCT FROM <n> OR <field> IS NULL — NULL-safe JSON-key-or-value mismatch pattern"

key-files:
  created:
    - supabase/migrations/20260514_v213_phase80_style_spec_cache_v2_purge.sql
  modified:
    - src/lib/cache/style-spec-cache.ts
    - src/lib/cache/__tests__/style-spec-cache.test.ts

key-decisions:
  - "Reuse candidateSpec inside the filter for the return value (eliminates a redundant cast on data.style_spec — minor cleanup, behavior identical)"
  - "Strict === STYLE_SPEC_VERSION (no numeric coercion); a stored string '2' is treated as a miss to surface upstream-corruption rather than silently succeed"
  - "Defensive filter does NOT eagerly DELETE the offending row — the migration owns deletion; the lookup path must remain side-effect-free in case the migration is mid-flight or partially applied"

patterns-established:
  - "When bumping a cached schema_version constant: ship a deploy migration for the bulk purge AND add a defensive read filter on the constant — pair handles the race window between db push and code rollout"

requirements-completed: [R5]

duration: 3m 11s
completed: 2026-05-14
---

# Phase 80 Plan 06: style_spec_cache v2 purge + defensive lookup filter

**Idempotent Supabase migration purges schema_version != 2 (or NULL) rows from public.style_spec_cache on deploy, and lookupStyleSpec defensively filters to schema_version === 2 so any v1 row that escapes the migration cannot reach parseStyleSpecSafe (which would reject it as a confusing extraction error).**

## Performance

- **Duration:** 3m 11s
- **Started:** 2026-05-14T22:34:18Z
- **Completed:** 2026-05-14T22:37:29Z
- **Tasks:** 1
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- Shipped `supabase/migrations/20260514_v213_phase80_style_spec_cache_v2_purge.sql` — a single, idempotent DELETE statement that drops any cache row whose stored `style_spec.schema_version` is not 2 (NULL-safe via `IS DISTINCT FROM 2 OR ... IS NULL`).
- Added a defensive `schema_version === 2` filter to `lookupStyleSpec` (`src/lib/cache/style-spec-cache.ts`) — schema-mismatched rows are returned as `null` to callers without bumping `last_hit_at` (no dead-weight LRU pollution).
- NEVER-throws contract preserved — the filter is a synchronous typed-narrowing read on already-fetched data; no I/O, no new throw paths.
- Extended `src/lib/cache/__tests__/style-spec-cache.test.ts` so the existing hit-path tests now declare `schema_version: 2` on their fixture specs, AND a new `defensive schema_version=2 filter (Phase 80 R5)` describe-block covers four cases: v1 row, missing `schema_version`, non-object spec (`null`), and string `'2'` (strict-equality is enforced — no coercion).

## Task Commits

1. **Task 1: Create migration + defensive lookup filter** — `4a8d12c` (feat)

## Files Created/Modified

- `supabase/migrations/20260514_v213_phase80_style_spec_cache_v2_purge.sql` — Idempotent DELETE of v1 / missing-version rows; updated `COMMENT ON TABLE` to record the Phase 80 purge timestamp and reference the defensive filter.
- `src/lib/cache/style-spec-cache.ts` — `lookupStyleSpec` reads `candidateSpec.schema_version` between the existing miss-check and the fire-and-forget `last_hit_at` bump; returns `null` for non-v2 specs. `persistStyleSpec` unchanged.
- `src/lib/cache/__tests__/style-spec-cache.test.ts` — Added `schema_version: 2` to existing hit-path fixtures + added 4 new defensive-filter tests; suite goes from 10 → 14 passing tests.

## Migration SQL (essence)

```sql
DELETE FROM public.style_spec_cache
WHERE (style_spec->>'schema_version')::int IS DISTINCT FROM 2
   OR style_spec->>'schema_version' IS NULL;
```

`IS DISTINCT FROM` treats `NULL` as a value (i.e. NULL != 2 evaluates true) — that's the NULL-safe matcher for rows whose JSON key parses to NULL, but JSON rows where the `schema_version` key is *absent entirely* return `NULL` from `->>` AND from the cast, and the explicit `IS NULL` branch is the belt-and-suspenders guarantee for that path. Re-running the migration after the first apply deletes 0 rows — idempotent by construction (a v2-only table has nothing matching `!= 2`).

## Defensive lookup filter (essence)

```ts
const candidateSpec = (data as { style_spec: unknown }).style_spec
const candidateVersion =
  typeof candidateSpec === 'object' &&
  candidateSpec !== null &&
  !Array.isArray(candidateSpec)
    ? (candidateSpec as { schema_version?: unknown }).schema_version
    : undefined
if (candidateVersion !== STYLE_SPEC_VERSION) {
  // Treat as a miss — do NOT bump last_hit_at, do NOT delete eagerly
  return null
}
```

Strict `!==` so a stored `'2'` string (corruption) is treated as a miss rather than silently succeeding. `Array.isArray` excludes JSON arrays so the type narrow is sound.

## Idempotency confirmation

| Run     | Rows matched      | Side effects                                                |
| ------- | ----------------- | ----------------------------------------------------------- |
| 1st     | All v1 / NULL-version rows | DELETED + COMMENT ON TABLE updated                  |
| 2nd     | 0                 | COMMENT ON TABLE re-runs with same text (no-op equivalent)  |

The DELETE clause matches `!= 2 OR IS NULL`; after the first run the table is v2-only, so the predicate matches zero rows on subsequent runs. `COMMENT ON TABLE` is statefully replaced with identical text — Postgres treats this as a no-op for the comment, but the statement itself is replay-safe.

## Post-deploy verification SQL (for ops)

```sql
-- Expect: 0
SELECT COUNT(*)
FROM public.style_spec_cache
WHERE (style_spec->>'schema_version')::int IS DISTINCT FROM 2
   OR style_spec->>'schema_version' IS NULL;
```

Run this on the production database after `supabase db push`. A non-zero result indicates either (a) the migration didn't apply or (b) a v1 write landed after the migration (which the defensive filter still handles at read time — but ops should investigate the source writer).

## Decisions Made

- **Reuse `candidateSpec` for the return value** (instead of re-casting `data.style_spec` at the end of the function) — eliminates a redundant `(data as { style_spec: unknown }).style_spec` cast that the original code carried. Pure cleanup; the value returned is identical.
- **Strict equality on `schema_version`** (`!== STYLE_SPEC_VERSION`, not `!= 2`) — a corrupt row carrying `'2'` (string) is treated as a miss. Surfacing the corruption at read time beats silently coercing past it.
- **Defensive filter does NOT eagerly DELETE** the offending row. Rationale: the deploy migration owns deletion; the lookup path may run concurrent with the migration apply, and side-effect-free reads keep the never-throws contract trivially honored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing cache-test fixtures to carry `schema_version: 2`**
- **Found during:** Task 1 verification (Vitest run after adding the filter)
- **Issue:** Three pre-existing tests in `src/lib/cache/__tests__/style-spec-cache.test.ts` constructed fixture specs without a `schema_version` field (e.g. `{ palette: ['#fff', '#000'], typography: { primary: 'Inter' } }`). The new defensive filter now correctly classifies those rows as missing-version and returns `null` — breaking the tests that asserted a hit-return.
- **Fix:** Added `schema_version: 2` to the three hit-path fixtures and added a new `defensive schema_version=2 filter (Phase 80 R5)` describe-block with 4 tests pinning the new behavior (v1 row → null, missing version → null, null spec → null, string '2' → null).
- **Files modified:** `src/lib/cache/__tests__/style-spec-cache.test.ts`
- **Verification:** `npx vitest run src/lib/cache/__tests__/style-spec-cache.test.ts` → 14/14 passing (was 10 tests, now 14).
- **Committed in:** `4a8d12c` (Task 1 commit).

---

**Total deviations:** 1 auto-fixed (1 bug / test-fixture coverage gap caused directly by my new filter).
**Impact on plan:** Necessary — the existing tests pinned a contract (hit → return spec) that the new filter intentionally tightens. Updating the fixtures preserves the original contract and the new defensive-filter cases are added on top. No scope creep; no production-code changes beyond what the plan specifies.

## Issues Encountered

None.

## Verification Evidence

| Check                                                                                            | Expected | Actual |
| ------------------------------------------------------------------------------------------------ | -------- | ------ |
| `[ -f supabase/migrations/20260514_v213_phase80_style_spec_cache_v2_purge.sql ]`                 | exists   | exists |
| `grep -c "DELETE FROM public.style_spec_cache" <migration>`                                      | ≥ 1      | 1      |
| `grep -c "IS DISTINCT FROM 2" <migration>`                                                       | ≥ 1      | 2      |
| `grep -c "STYLE_SPEC_VERSION" src/lib/cache/style-spec-cache.ts`                                 | ≥ 1      | 5      |
| `grep -c "Phase 80" src/lib/cache/style-spec-cache.ts`                                           | ≥ 1      | 2      |
| `grep -cE "^\s*throw\s" src/lib/cache/style-spec-cache.ts` (actual throw statements)             | 0        | 0      |
| `lookupStyleSpec` signature `Promise<unknown \| null>` preserved                                 | yes      | yes    |
| `bash scripts/grep-gates/closed-enum-styleSpec.sh`                                               | exit 0   | exit 0 |
| `grep -E "reference_artist\|reference_brand\|copy_exactly\|style_freetext" <migration> <ts>`    | 0 lines  | 0 lines |
| `npx vitest run src/lib/cache/__tests__/style-spec-cache.test.ts`                                | passes   | 14/14  |
| `node -e <migration verification one-liner from plan>`                                           | OK migration | OK migration |

Note on `grep -c "throw"`: returns 4 across the file, but all 4 are inside `// NEVER throws —` / contract documentation comments that pre-existed in the file (lines 16, 60, 100, 134). Zero actual `throw` statements. The intent of the acceptance criterion (never-throws contract preserved) is satisfied; the literal `grep -c "throw"` matcher is overly permissive but does not indicate a contract violation.

## Next Phase Readiness

- Migration ready to apply via `supabase db push`. Brief cache-miss window post-deploy is acceptable (CONTEXT.md: pre-PMF, small cache, reproducible data).
- Defensive filter is forever-on belt-and-suspenders; the next time `STYLE_SPEC_VERSION` bumps, the same pattern applies (one migration purging non-current rows + the filter constant updating in lockstep).
- Plan 80-07 (if present) is unblocked by R5 completion.

## Self-Check: PASSED

- `supabase/migrations/20260514_v213_phase80_style_spec_cache_v2_purge.sql` — FOUND
- `src/lib/cache/style-spec-cache.ts` — FOUND (modified, defensive filter present)
- `src/lib/cache/__tests__/style-spec-cache.test.ts` — FOUND (14 tests passing)
- Commit `4a8d12c` — FOUND in `git log`

---
*Phase: 80-composition-aware-style-extraction-replace-flat-stylespec-ta*
*Plan: 06*
*Completed: 2026-05-14*

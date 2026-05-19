---
phase: 79-legal-hardening-tos-clickwrap-audit-log-copy-review
plan: 01
subsystem: legal
tags: [supabase, postgres, pg_cron, rls, audit-log, tos, vitest, tdd]

# Dependency graph
requires:
  - phase: 73-cost-defenses-cache
    provides: style-spec-cache helpers — admin-client + never-throw cache pattern mirrored here
  - phase: 31-explore-remix
    provides: pg_cron retention pattern (popularity_score refresh)
  - phase: 54-treated-backgrounds
    provides: pg_cron retention pattern (orphan asset sweep)
provides:
  - STYLE_FROM_REFERENCE_TOS_VERSION constant (single source of truth for ToS revision)
  - getStyleFromReferenceTosVersion() helper (mockable indirection)
  - recordStyleFromReferenceTosAcceptance(admin, args) audit-log writer (never throws)
  - hasUserAcceptedCurrentTos(admin, userId, currentVersion) audit-log reader (never throws, fail-secure to false)
  - style_reference_uploads table with (user_id, sha256), (user_id, tos_version) indexes
  - RLS policies — users SELECT own; service_role INSERT
  - 12-month pg_cron retention sweep (daily 09:00 UTC)
affects:
  - 79-02-PLAN (clickwrap modal + DMCA + ToS page + grep gate — imports both helpers and the version constant)
  - All future style-from-reference upload paths (defense-in-depth gate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Audit-log helper pair (record/has) mirrors Phase 73 cache helper pair (lookup/persist) — never-throw + structured error return
    - Insert-only audit table with version column for forced re-acceptance on bump
    - Idempotent pg_cron unschedule-then-reschedule guard for safe migration re-runs

key-files:
  created:
    - src/lib/legal/tos-version.ts
    - src/lib/legal/__tests__/tos-version.test.ts
    - src/lib/legal/audit-log.ts
    - src/lib/legal/__tests__/audit-log.test.ts
    - supabase/migrations/20260510_v213_style_reference_uploads_audit.sql
  modified: []

key-decisions:
  - "ToS version literal '2026-05-10-v1' uses YYYY-MM-DD-vN format for human-readable + chronologically sortable audit rows; format pinned by a regex test"
  - "Audit-log helpers fail-secure: hasUserAcceptedCurrentTos returns false on any DB error (forces re-acceptance) rather than risking silent bypass"
  - "Empty sha256s array in recordStyleFromReferenceTosAcceptance is a no-op (returns ok:true without DB call) so callers don't need a length check"
  - "Migration uses DROP POLICY IF EXISTS + DO $$ unschedule-then-schedule guard for safe re-application via supabase db push"

patterns-established:
  - "Legal-module test pattern: mock Supabase admin via builder fn returning chainable .from().insert() / .from().select().eq().eq().limit() shape, mirrors Phase 73 style-spec-cache.test.ts"
  - "Server-only helper convention for src/lib/legal/* — JSDoc explicitly notes service-role admin client requirement (RLS policies route writes through service_role only)"

requirements-completed:
  - LEGAL-02

# Metrics
duration: ~10min
completed: 2026-05-10
---

# Phase 79 Plan 01: Audit-Table Foundation Summary

**ToS version constant, never-throw audit-log helpers, and the `style_reference_uploads` table with RLS + 12-month pg_cron retention — the foundation Plan 79-02's clickwrap UI imports.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-10 (PLAN_START_TIME captured at execution start)
- **Completed:** 2026-05-10
- **Tasks:** 3 (Task 3 split RED + GREEN per TDD)
- **Files created:** 5
- **Files modified:** 0
- **Tests added:** 11 (3 tos-version + 8 audit-log)

## Accomplishments
- New `src/lib/legal/` module — `tos-version.ts` exports the locked literal `STYLE_FROM_REFERENCE_TOS_VERSION = '2026-05-10-v1'` plus a mockable getter; format convention pinned by a regex test
- `audit-log.ts` exports `recordStyleFromReferenceTosAcceptance` (writer) + `hasUserAcceptedCurrentTos` (reader). Both follow the Phase 73 / v2.6 cache-failure stance: NEVER throw, structured `{ ok: false, error }` (writer) or safe-default `false` (reader) on any failure mode
- New migration `20260510_v213_style_reference_uploads_audit.sql` — creates the table, adds the two indexes the helpers query, enables RLS with SELECT-own + INSERT-service_role policies, and schedules a daily 09:00 UTC pg_cron job that deletes acceptance rows older than 12 months
- All 11 tests GREEN; `npm run lint:gates` continues to pass; ESLint clean on the new module

## Task Commits

Each task was committed atomically:

1. **Task 1: ToS version constant** — `f0cfcb4` (feat) — TDD single-commit (test + impl small enough to ship together; constants module)
2. **Task 2: Audit migration** — `b51fc4e` (feat) — DDL only, no test phase
3. **Task 3: Audit-log helpers (RED)** — `2706506` (test) — 8 failing tests pinning never-throw contract
4. **Task 3: Audit-log helpers (GREEN)** — `115ca25` (feat) — implementation; all 8 tests pass

**Plan metadata commit:** _next — pending SUMMARY.md commit below_

## Files Created/Modified

**Created:**
- `src/lib/legal/tos-version.ts` — `STYLE_FROM_REFERENCE_TOS_VERSION` literal + `getStyleFromReferenceTosVersion()` getter; single source of truth for ToS revision string consumed by the audit-log helpers, the clickwrap modal (Plan 79-02), and the ToS page section (Plan 79-02 / LEGAL-05)
- `src/lib/legal/__tests__/tos-version.test.ts` — 3 tests pinning literal value, helper return-shape, and `YYYY-MM-DD-vN` format convention
- `src/lib/legal/audit-log.ts` — `recordStyleFromReferenceTosAcceptance` and `hasUserAcceptedCurrentTos` server-only helpers; NEVER-throw contract; service-role admin client required (RLS policies route writes via service_role only)
- `src/lib/legal/__tests__/audit-log.test.ts` — 8 tests pinning the never-throw contract end-to-end (insert success, empty-array no-op, error-payload graceful, throw graceful for both helpers)
- `supabase/migrations/20260510_v213_style_reference_uploads_audit.sql` — table DDL, two indexes, RLS policies, idempotent pg_cron 12-month retention sweep; mirrors v2.4 / v2.9 cron-retention pattern

**Modified:** none

## Decisions Made

1. **Empty `sha256s` is a no-op in the writer** — returns `ok:true` without touching the DB. Callers can pass pre-deduplicated lists (Plan 79-02 will dedupe against the existing audit row check) without an explicit length guard.
2. **Reader fail-secures to `false`** — on any read error, `hasUserAcceptedCurrentTos` returns `false`. The worst outcome is a redundant clickwrap; the unacceptable outcome would be silently bypassing acceptance. False is safe.
3. **Migration is idempotent** — `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, and a `DO $$ ... cron.unschedule(...) ... EXCEPTION WHEN OTHERS THEN NULL; END $$;` guard before `cron.schedule()` so `supabase db push` can re-apply safely.
4. **ToS literal format pinned by test** — the regex `^\d{4}-\d{2}-\d{2}-v\d+$` is a discipline check ensuring future bumps stay sortable + human-readable in audit rows.
5. **Server-only convention for `src/lib/legal/*`** — JSDoc on every export explicitly documents the service-role admin client requirement. Helpers don't import a Supabase client themselves; they accept one as a parameter so the test mock surface is the same as production wiring.

## Deviations from Plan

None - plan executed exactly as written.

The plan's grounding section specified the exact table shape, index pair, RLS posture, cron cadence, helper signatures, and never-throw contract. Implementation matched 1:1.

Minor refinements (within plan latitude):
- Plan mentions `8-10 tests GREEN`; actual was 11 (3 + 8). The third tos-version test (regex format check) is a discipline guard not explicitly listed in the plan but harmless.
- Migration adds `DROP POLICY IF EXISTS` and the `cron.unschedule` guard for safe re-application — plan-grade idempotency hardening, not a scope expansion.

## Issues Encountered

None. TDD cycle ran clean: RED failed on import resolution as expected, GREEN passed all 8 contract tests on the first implementation pass.

## User Setup Required

**Operator must apply the new migration via `supabase db push`** before Plan 79-02 ships, because Plan 79-02's clickwrap server action will INSERT into `style_reference_uploads` at runtime. The migration is idempotent so re-running on an already-migrated environment is safe.

No environment variables, dashboard configuration, or third-party setup required.

## Next Phase Readiness

**Plan 79-02 (Wave 2) unblocked.** It can now:
- `import { STYLE_FROM_REFERENCE_TOS_VERSION } from '@/lib/legal/tos-version'` for the clickwrap modal label and the ToS page section heading
- `import { recordStyleFromReferenceTosAcceptance, hasUserAcceptedCurrentTos } from '@/lib/legal/audit-log'` for the server action and the upload handler's fast-path skip check
- Trust that both helpers will not throw, so the upload pipeline can call them without try/catch wrappers

No blockers. The grep gate (LEGAL-03), DMCA doc (LEGAL-04), and ToS page section (LEGAL-05) Plan 79-02 owns are all independent of this plan's deliverables — Plan 79-02 just stitches them together with the symbols this plan exports.

## Self-Check: PASSED

**Created files exist:**
- FOUND: src/lib/legal/tos-version.ts
- FOUND: src/lib/legal/__tests__/tos-version.test.ts
- FOUND: src/lib/legal/audit-log.ts
- FOUND: src/lib/legal/__tests__/audit-log.test.ts
- FOUND: supabase/migrations/20260510_v213_style_reference_uploads_audit.sql

**Commits exist (verified via git log --oneline -6):**
- FOUND: f0cfcb4 (Task 1)
- FOUND: b51fc4e (Task 2)
- FOUND: 2706506 (Task 3 RED)
- FOUND: 115ca25 (Task 3 GREEN)

**Test + lint gates:**
- 11/11 vitest tests passing
- `npm run lint:gates` exits 0
- ESLint clean on `src/lib/legal/`

---
*Phase: 79-legal-hardening-tos-clickwrap-audit-log-copy-review*
*Completed: 2026-05-10*

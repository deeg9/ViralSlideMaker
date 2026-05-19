---
status: passed
phase: 83-db-backed-template-storage-registry-merge
verified: 2026-05-18
requirements: [TSTORE-01, TSTORE-02, TSTORE-03, TSTORE-04]
verifier: inline (no gsd-verifier subagent available in this runtime)
---

# Phase 83 Verification — DB-Backed Template Storage + Registry Merge

**Goal:** Templates can live in a database row, not just code — a merged
registry resolves both, so a DB template appears in the picker with no code
deploy, while the 13 code templates and ~82 existing carousels keep rendering
byte-identically.

## Verdict: PASSED

All 4 phase requirements are satisfied. All `must_haves` from the 3 plans
verified against the actual codebase and the live Supabase project. Phase 83's
4 new test files pass 16/16. No regression — full-suite failure count is
identical to the pre-Phase-83 baseline.

## Requirement traceability

| Requirement | Plan | Status | Evidence |
|-------------|------|--------|----------|
| TSTORE-01 | 83-01 | PASS | `public.templates` table created + applied to the shared Supabase project; 9 columns confirmed via `execute_sql`; RLS enabled, 1 SELECT policy, 0 write policies; `templates_category_allowed` CHECK present. |
| TSTORE-02 | 83-02 | PASS | `registry.ts` merges code + DB templates — `resolveTemplate` / `getPickerTemplates` / `isKnownTemplateId`; 8/8 hermetic tests pass; `index.ts` / `templates[]` untouched. |
| TSTORE-03 | 83-03 | PASS | `db-template-parity.test.tsx` — 5/5 pass; a DB template renders consistently across canvas / Satori PNG / HTML and identically to its code-template equivalent. |
| TSTORE-04 | 83-03 | PASS | `legacy-byte-identity-after-storage.test.ts` — 3/3 pass; async `resolveTemplate` returns all 13 code templates sha256-identical to sync `getTemplate`; the merge never mutates `templates[]`. |

## must_haves verification

**Artifacts (all exist with real implementation):**
- `supabase/migrations/20260518_phase83_templates_table.sql` (80 lines) — additive migration.
- `src/lib/render/templates/db-template-row.ts` (72 lines) — `DbTemplateRow` + `dbRowToSlideTemplate`.
- `src/lib/render/templates/registry.ts` (126 lines) — async hybrid registry.
- `src/lib/render/templates/__tests__/registry-merge.test.ts` (131 lines) — 8 tests.
- `src/__tests__/render/db-template-parity.test.tsx` (149 lines) — 5 tests.
- `src/__tests__/render/legacy-byte-identity-after-storage.test.ts` (76 lines) — 3 tests.

**Key links (all verified):**
- `registry.ts` imports the sync registry from `./index` (1 match) without modifying it.
- `registry.ts` uses `dbRowToSlideTemplate` (4 matches).
- `db-template-parity.test.tsx` injects fixtures via `__setDbTemplateFetcher` (7) and renders through `buildSlide*` (12).
- The migration FK targets `auth.users` `ON DELETE SET NULL` (1 match).

**Truths (all observable):**
- A row inserted into `public.templates` resolves through `resolveTemplate` / `getPickerTemplates` — proven by the registry-merge suite.
- A code template wins over a same-id DB row — proven (collision tests).
- DB templates appear first in the picker — proven (ordering test).
- A ~60s TTL cache surfaces a new DB row with no deploy — proven (TTL test).
- A DB template renders identically across all 3 render paths — proven (parity suite).
- The 13 code templates render byte-identically after the storage change — proven (sha256 sync-vs-async guard).

## CONTEXT.md decisions honored

- Additive, reversible migration on the shared prod Supabase project — confirmed: one new table, no `ALTER TABLE projects`, no executable `DROP`, no seed rows; applied + confirmed live.
- 13 code templates stay in code; `templates[]` untouched — confirmed (`index.ts` last touched pre-Phase-83).
- Hybrid sync+async registry with ~60s TTL cache — confirmed in `registry.ts`.
- Public SELECT RLS, no write policy (deny-by-default), `created_by` uuid FK to `auth.users` — confirmed live (1 SELECT policy, 0 write policies, RLS enabled).
- `TEMPLATE_IDS` stays code-only; `isKnownTemplateId` added as the async DB-aware companion — confirmed.

## Known issue — PRE-EXISTING, out of Phase 83 scope (not a gap)

`src/__tests__/render/legacy-templates-byte-identical.test.ts`,
`legacy-templates-regression.test.tsx`, and `new-templates-parity.test.tsx`
have 6 failing tests. **Verified present at the pre-Phase-83 commit (`HEAD~10`)
with identical counts** — root cause is quick task `260518-jhg` appending
`newsOracle` as the 13th code template + retiring `news-cyan` from the picker
WITHOUT regenerating those fixtures. Phase 83 modified NO fixture
(`git status` clean for `__fixtures__`/`__snapshots__`). The Phase 83 TSTORE-04
proof — `legacy-byte-identity-after-storage.test.ts`, sha256 of all 13 code
templates sync-vs-async — PASSES, demonstrating the registry merge introduced
zero render change. The stale fixtures are flagged for a separate fix.

Full suite: 3135 passed / 47 failed / 9 skipped — the 47 failures match the
pre-Phase-83 baseline (3117 passed / 47 failed); Phase 83 added 18 passing
tests and zero regressions.

## Note

Pre-existing `tsc --noEmit` errors (19) live in unrelated test files
(`__tests__/api`, `auth`, `stripe`, `legal`, `services`) — vitest mock-typing
issues identical at the pre-Phase-83 baseline. Phase 83's 4 new files are all
`tsc`-clean. The project's effective gate is `vitest`.

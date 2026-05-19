---
status: clean
phase: 83-db-backed-template-storage-registry-merge
depth: standard
reviewed: 2026-05-18
reviewer: inline (no gsd-code-reviewer subagent available in this runtime)
files_reviewed: 6
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
---

# Phase 83 Code Review — DB-Backed Template Storage + Registry Merge

**Depth:** standard (per-file analysis with language-specific checks)
**Verdict:** CLEAN — no Critical or Warning findings. Two Info-level
observations, both consistent with explicit CONTEXT.md design decisions.

## Files reviewed

| File | Verdict |
|------|---------|
| `supabase/migrations/20260518_phase83_templates_table.sql` | Clean |
| `src/lib/render/templates/db-template-row.ts` | Clean |
| `src/lib/render/templates/registry.ts` | Clean (2 Info) |
| `src/lib/render/templates/__tests__/registry-merge.test.ts` | Clean |
| `src/__tests__/render/db-template-parity.test.tsx` | Clean |
| `src/__tests__/render/legacy-byte-identity-after-storage.test.ts` | Clean |

## Security

- **SQL injection:** none. `registry.ts` uses the Supabase query builder
  (`.from('templates').select('*').order(...)`) — no string interpolation. The
  migration is static DDL with no dynamic SQL.
- **RLS:** the migration enables RLS with a single public `SELECT` policy and
  ZERO write policies — deny-by-default writes, as designed. The table-level
  `INSERT` GRANT to `anon` (Supabase default) is correctly gated by RLS: an
  anon `INSERT` is still denied because no INSERT policy exists.
- **FK integrity:** `created_by` is `ON DELETE SET NULL` to `auth.users` — a
  deleted user does not orphan or cascade-delete a template row.
- **Input mapping:** `dbRowToSlideTemplate` spreads the `flat_style` jsonb blob
  but the canonical `id`/`name` columns always win, and `layout_recipe` is
  never read — no untrusted-blob field can override identity.

## Quality findings (Info — non-blocking)

### INFO-01 — `getDbRows` does not back off on a persistently-failing fetcher
`src/lib/render/templates/registry.ts` — `getDbRows()` catch branch returns the
stale cache but does not refresh `fetchedAt`, so a continuously-failing DB is
re-hit on every `resolveTemplate` / `getPickerTemplates` call. This is
intentional-adjacent: serving stale-but-valid rows while retrying every call
gives fast recovery once the DB returns, and the registry never throws. No
change required — recorded for awareness.

### INFO-02 — `defaultDbTemplateFetcher` swallows the Supabase error silently
`src/lib/render/templates/registry.ts` — on a Supabase `error` the default
fetcher returns `[]` with no log. This is the explicit CONTEXT.md decision
("the registry must NEVER throw — a DB read failure degrades gracefully to
code-templates-only"). A `console.warn` on the error path would aid
observability but is not required. Recorded for awareness.

## Correctness spot-checks

- `dbRowToSlideTemplate` backfill: `backfilled` is spread AFTER `blob`, but each
  backfilled value is `blob[key] ?? fallback` — so a value the blob supplies is
  preserved, and only absent required fields get the default. Correct.
- Collision rule: `CODE_TEMPLATE_ID_SET` (built from `TEMPLATE_IDS`) gates both
  `resolveTemplate` (code template found first) and `getPickerTemplates`
  (colliding DB rows filtered). A code template always wins. Correct.
- TTL cache: 60_000 ms window; `__resetDbTemplateRegistry` clears the cache and
  restores the default fetcher. Tests exercise both warm-hit and post-reset
  re-fetch. Correct.
- Migration: idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`,
  `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS`), additive (one new
  table, no `ALTER TABLE projects`, no executable `DROP`, no seed rows).
- `templates_set_updated_at()` omits `SET search_path = ''` — but this matches
  the project's existing `profiles_set_updated_at()` analog exactly, so it is
  consistent with the codebase pattern (not a new issue).

## Conclusion

No fixes required. The 2 Info-level observations are minor and align with the
phase's locked design decisions (never-throw graceful degradation). The
implementation is additive, the RLS posture is correct deny-by-default, and the
test coverage is hermetic and thorough.

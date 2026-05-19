---
phase: 83-db-backed-template-storage-registry-merge
plan: 02
status: complete
requirements: [TSTORE-02]
key-files:
  created:
    - src/lib/render/templates/db-template-row.ts
    - src/lib/render/templates/registry.ts
    - src/lib/render/templates/__tests__/registry-merge.test.ts
---

# 83-02 Summary: Async hybrid template registry (TSTORE-02)

## What was built

A new accessor layer that merges the 13 synchronous code templates with DB
template rows from the Phase 83 `public.templates` table — purely additive.
`src/lib/render/templates/index.ts` and the `templates[]` array were NOT
modified (confirmed: `git diff --stat` shows index.ts unchanged), so the
byte-identity suites need no fixture regeneration.

### `db-template-row.ts` — DB row shape + mapper

- `DbTemplateRow` — hand-maintained interface for a `public.templates` row
  (the project's Supabase client is untyped).
- `dbRowToSlideTemplate(row)` — pure function (no Supabase import, no I/O)
  converting a row to a `SlideTemplate`: spreads the `flat_style` jsonb blob,
  backfills required `SlideTemplate` fields with safe defaults ONLY when the
  blob omits them (per-field nullish coalescing — never overwrites a supplied
  value), and the canonical `id`/`name` columns win over the blob.
  `layout_recipe` is deliberately NOT read (reserved for Phase 84).

### `registry.ts` — async hybrid registry

| Export | Behavior |
|--------|----------|
| `resolveTemplate(id)` | Code template wins on id collision; else a DB row via `dbRowToSlideTemplate`; else `templates[0]` fallback (mirrors sync `getTemplate`). |
| `getPickerTemplates()` | DB templates FIRST (newest curated content), then the code `pickerTemplates`; a DB row whose id collides with a code id is dropped. |
| `isKnownTemplateId(id)` | Async DB-aware companion to the static `TEMPLATE_IDS` allowlist — true for a code id OR a DB row id. |
| `__setDbTemplateFetcher` / `__resetDbTemplateRegistry` | Test-only seam: inject a fixture fetcher / restore default + clear cache. |

- **Collision rule:** a `CODE_TEMPLATE_ID_SET` (built from `TEMPLATE_IDS`)
  makes a code template always win over a DB row with the same id, in both
  `resolveTemplate` and `getPickerTemplates`.
- **Picker ordering:** `[...dbTemplates, ...pickerTemplates]` — DB-first.
- **TTL cache:** `DB_TEMPLATE_TTL_MS = 60_000` — `getDbRows()` serves cached
  rows within the ~60s window, so a newly-inserted DB row appears in the picker
  within the window with no deploy and no restart.
- **Never throws:** `defaultDbTemplateFetcher` and `getDbRows` wrap all DB I/O;
  a DB outage degrades gracefully to code-templates-only behavior.
- Reads use the anon/publishable client (`createClient` from
  `@/lib/supabase/server`), respecting the public SELECT RLS policy.

## Test seam + hermetic suite

`registry-merge.test.ts` — 8 hermetic tests via `__setDbTemplateFetcher` (NO
live DB connection, `__resetDbTemplateRegistry` in `afterEach`):
1. DB-only resolution — flat_style fields flow through the mapper.
2. Code-wins collision — an injected DB row shadowing a code id is ignored.
3. `templates[0]` fallback for an unknown id.
4. DB-first picker ordering — DB rows precede the code picker list.
5. Collision drop — a DB row colliding with a code id is removed (no dup).
6. `isKnownTemplateId` — true for code id, true for DB id, false for unknown.
7. ~60s TTL cache — fetcher runs once across rapid calls; re-runs after reset.
8. Graceful degradation — a throwing fetcher does not break code-template
   resolution.

One bug was caught + fixed during test execution: the TTL-cache test's
"re-runs after reset" assertion initially only swapped the fetcher without
clearing the cache, so the warm cache served stale rows — fixed by calling
`__resetDbTemplateRegistry()` before the second fetcher (this is a test-logic
fix; the registry behaved correctly — the cache was doing its job).

## index.ts / templates[] untouched

`git diff --stat src/lib/render/templates/index.ts` → no changes. The merge is
accessor-only, so `legacy-templates-byte-identical` and `new-templates-parity`
stay green with no fixture regen (verified in Plan 83-03).

## Unblocks

Plan 83-03 can build its render-parity test on `resolveTemplate` /
`getPickerTemplates` and the `__setDbTemplateFetcher` seam.

## Self-Check: PASSED
- db-template-row.ts + registry.ts compile (`tsc --noEmit` clean for both).
- `resolveTemplate` / `getPickerTemplates` / `isKnownTemplateId` exported.
- Test seam present; TTL constant `60_000`.
- index.ts unchanged (accessor-only merge).
- `npx vitest run src/lib/render/templates/__tests__/registry-merge.test.ts` — 8/8 pass.

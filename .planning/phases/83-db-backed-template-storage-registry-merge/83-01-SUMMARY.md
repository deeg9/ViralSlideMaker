---
phase: 83-db-backed-template-storage-registry-merge
plan: 01
status: complete
requirements: [TSTORE-01]
key-files:
  created:
    - supabase/migrations/20260518_phase83_templates_table.sql
---

# 83-01 Summary: Additive templates-table migration (TSTORE-01)

## What was built

Created `supabase/migrations/20260518_phase83_templates_table.sql` — a strictly
additive, reversible migration that creates a single new `public.templates`
table for DB-backed template storage.

### templates-table schema

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| `id` | text | NO (PK) | Text slug primary key — one shared ID space with `projects.template_id` and the code-template ids. A code template wins over a DB row with the same id (collision rule lives in the registry, Plan 83-02). |
| `name` | text | NO | Human-readable template name. |
| `category` | text | YES | Content category, CHECK-constrained to the closed set `('news','facts')` (matches `CONTENT_CATEGORIES`). Nullable — a DB template need not declare one. |
| `flat_style` | jsonb | NO (default `{}`) | jsonb blob mirroring the ~30 mostly-optional `SlideTemplate` flat-style fields. JSON keeps the schema additive — no migration per new style field. |
| `layout_recipe` | jsonb | YES | Reserved for the Phase 84 `LayoutRecipe` model. Added now so Phase 84 needs no second migration. Phase 83 never reads/writes it. |
| `preview` | text | YES | Reserved for the Phase 86 picker preview reference. Phase 83 leaves it null. |
| `created_by` | uuid | YES | FK to `auth.users(id)` `ON DELETE SET NULL` (mirrors `projects.user_id`). Set by the Phase 86 admin authoring flow. |
| `created_at` | timestamptz | NO | Insert timestamp. |
| `updated_at` | timestamptz | NO | Auto-maintained by the `templates_updated_at` BEFORE-UPDATE trigger. |

Two indexes: `templates_category_idx` (category), `templates_created_at_idx`
(created_at DESC — supports the registry's newest-first DB ordering).

## RLS posture

- `ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;`
- ONE policy: `"Templates are viewable by everyone"` — `FOR SELECT USING (true)`
  (public read, mirrors the `profiles` public-read pattern).
- NO INSERT/UPDATE/DELETE policy — **deny-by-default**. Writes go through the
  service-role admin client (`createAdminClient`), which bypasses RLS; Phase 86's
  endpoint performs the app-level admin role check. Reads use the
  anon/publishable client (`src/lib/supabase/server.ts`).

## Migration apply

Applied to the SHARED prod Supabase project via the Supabase MCP
`apply_migration` tool — returned `{"success": true}`. Confirmed via
`execute_sql`:
- `information_schema.tables` shows `public.templates` (table_exists = 1).
- All 9 columns present; `category`, `layout_recipe`, `preview`, `created_by`
  all `is_nullable = YES`; `flat_style` jsonb NOT NULL.
- Exactly ONE RLS policy, command `r` (SELECT); `relrowsecurity = true`.
- `row_count = 0` — no seed rows inserted.

## Additive & reversible confirmation

The migration creates ONE new table and contains no `ALTER TABLE projects`, no
executable `DROP TABLE` (the only `DROP TABLE` text is in the reversal-note
comment), and no `INSERT INTO`. It changes how **no** existing carousel and none
of the 13 code templates render — DB storage is purely additive (a hybrid
code+DB registry, not a migration of the code templates). Reversal:
`DROP TABLE IF EXISTS public.templates CASCADE;`.

## Unblocks

Plan 83-02 (the async hybrid registry) can build its `defaultDbTemplateFetcher`
against this `public.templates` schema.

## Self-Check: PASSED
- Migration file present, contains `CREATE TABLE IF NOT EXISTS public.templates`.
- 0 write policies, 1 SELECT policy — deny-by-default writes.
- `ON DELETE SET NULL` FK present; `templates_category_allowed` CHECK present.
- Strictly additive: no ALTER projects, no executable DROP, no seed rows.
- Applied + confirmed on the shared Supabase project.

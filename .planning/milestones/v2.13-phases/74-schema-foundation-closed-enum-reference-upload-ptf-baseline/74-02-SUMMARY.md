---
phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline
plan: 02
subsystem: database
tags: [supabase, postgresql, jsonb, storage-buckets, rls, vitest, typescript]

# Dependency graph
requires:
  - phase: 73-cost-preprocessing-rails-foundation
    provides: "sharp preprocessing pipeline (style-reference-prep.ts) — produces the SHA-256 of preprocessed bytes that becomes ReferenceAssetRow.sha256 in Plan 03"
provides:
  - "projects.style_spec jsonb column (nullable) — Phase 75 writes here, Phase 77 reads here"
  - "projects.reference_assets jsonb column (nullable) — Plan 03 writes provenance rows on upload completion"
  - "slide-references private storage bucket with per-user folder RLS (4 policies on storage.objects)"
  - "src/lib/types/projects-storage-constants.ts — single-source-of-truth for column names + bucket name + RLS policy names + ReferenceAssetRow type"
  - "Partial index projects_has_style_spec_idx for fast 'from references' filters in Phase 77 EDITOR-02"
affects:
  - 74-03-upload-pipeline
  - 74-04-ptf-baseline
  - 75-vision-extraction
  - 76-style-spec-runtime
  - 77-emit-pipeline
  - 78-cost-rails-integration
  - 79-audit-hardening

# Tech tracking
tech-stack:
  added: []  # No new deps — pure DDL + TS module + vitest tests
  patterns:
    - "Split-migration discipline: columns + bucket in separate files for independent rollback (per CONTEXT.md decision)"
    - "Source-grep drift guard: vitest reads migration SQL as text + asserts constants match literally — catches future renames"
    - "Closed-enum mime_type at the type layer: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/heic' (D-01 invariant defended one layer up from validator)"
    - "Per-user folder RLS scoped via (storage.foldername(name))[1] = auth.uid()::text — mirrors brand-kit-logos but PRIVATE (overrides architecture research)"
    - "JSONB column shape enforced by application Zod, documented via COMMENT ON COLUMN for future readers"

key-files:
  created:
    - "supabase/migrations/20260510_v213_style_spec_columns.sql (51 lines) — projects.style_spec + reference_assets columns + partial index + COMMENT ON COLUMN"
    - "supabase/migrations/20260510_v213_slide_references_bucket.sql (59 lines) — private bucket + 4 RLS policies (SELECT/INSERT/UPDATE/DELETE)"
    - "src/lib/types/projects-storage-constants.ts (28 lines) — STYLE_SPEC_COLUMN, REFERENCE_ASSETS_COLUMN, SLIDE_REFERENCES_BUCKET, SLIDE_REFERENCES_RLS_POLICIES, ReferenceAssetRow"
    - "src/lib/types/__tests__/projects-style-spec-columns.test.ts (114 lines) — 7 contract tests covering constants, source-grep drift guards, type-shape enforcement"
  modified: []

key-decisions:
  - "Bucket is PRIVATE (public=false) — overrides architecture research's public-bucket suggestion per CONTEXT.md decision; Phase 75 reads via service-role admin or signed URLs only"
  - "Split into 2 migration files (columns + bucket) for independent rollback per CONTEXT.md Claude's-discretion"
  - "ReferenceAssetRow includes mime_type + size_bytes + original_filename for forensics richness (CONTEXT.md Claude's-discretion: 'cheap insurance')"
  - "Closed-enum mime_type union at the TypeScript layer (4 values: png/jpeg/webp/heic) — defends D-01 invariant before code reaches Zod validator"
  - "Partial index on (style_spec IS NOT NULL) — keeps index small, enables fast 'from references' badge filter in Phase 77 EDITOR-02"

patterns-established:
  - "Pattern: Single-source-of-truth constants module for any string that crosses code↔SQL boundary; source-grep test guards against drift"
  - "Pattern: PRIVATE storage bucket with per-user folder RLS = signed URLs only (no TO public clause); Phase 75 vision-extraction reads via short-TTL signed URLs"
  - "Pattern: COMMENT ON COLUMN documents jsonb shape that's enforced by application Zod (schema doesn't enforce; comment is the contract for future readers)"

requirements-completed:
  - STYLESPEC-02
  - REF-01
  - REF-07

# Metrics
duration: 4min
completed: 2026-05-10
---

# Phase 74 Plan 02: Schema Foundation — projects.style_spec + reference_assets columns + slide-references private bucket Summary

**Two split migrations (columns + private bucket) plus a single-source-of-truth constants module with closed-enum mime_type and source-grep drift guards across 7 contract tests.**

## Performance

- **Duration:** ~4 min (3m22s wall clock)
- **Started:** 2026-05-10T22:19:44Z
- **Completed:** 2026-05-10T22:23:06Z
- **Tasks:** 3 (Task 3 = TDD with RED+GREEN split → 4 commits total)
- **Files modified:** 4 created, 0 modified

## Accomplishments

- Schema foundation: `projects.style_spec jsonb` + `projects.reference_assets jsonb` columns added (both nullable, additive — legacy v2.12 projects keep `NULL`, byte-identity preserved by construction for Plan 04 PTF baseline).
- Storage foundation: NEW `slide-references` PRIVATE bucket provisioned with 4 RLS policies (SELECT/INSERT/UPDATE/DELETE) all scoped via `(storage.foldername(name))[1] = auth.uid()::text` to per-user folders.
- Single-source-of-truth module (`src/lib/types/projects-storage-constants.ts`) — Phase 75/76/77/78 import column names, bucket name, RLS policy names, and `ReferenceAssetRow` type from one place; never hardcode the strings.
- Closed-enum `mime_type` union on `ReferenceAssetRow` defends D-01 invariant at the type layer (one layer earlier than Zod).
- Source-grep drift guard tests (Tests 5+6) read migration SQL as text and assert constants match literally — any future rename of either side fails CI immediately.

## Task Commits

Each task was committed atomically. Task 3 followed strict TDD with separate RED+GREEN commits:

1. **Task 1: Migration — projects.style_spec + reference_assets columns** — `ad25726` (feat)
2. **Task 2: Migration — slide-references private bucket + per-user folder RLS** — `eefae19` (feat)
3. **Task 3 RED: failing contract tests for projects-storage-constants** — `ef334d3` (test)
4. **Task 3 GREEN: projects-storage-constants single-source-of-truth module** — `4694f9d` (feat)

**Final SUMMARY metadata commit:** _(this commit)_

## Files Created/Modified

- `supabase/migrations/20260510_v213_style_spec_columns.sql` — 51 lines. ALTER TABLE adds 2 nullable jsonb columns + COMMENT ON COLUMN for both + partial index `projects_has_style_spec_idx` ON `(style_spec IS NOT NULL)`.
- `supabase/migrations/20260510_v213_slide_references_bucket.sql` — 59 lines. INSERT INTO storage.buckets (`'slide-references', 'slide-references', false`) + 4 RLS policies (each preceded by idempotent `DROP POLICY IF EXISTS`).
- `src/lib/types/projects-storage-constants.ts` — 28 lines. 3 column/bucket constants + `SLIDE_REFERENCES_RLS_POLICIES` object (4 policy names) + `ReferenceAssetRow` interface with closed-enum `mime_type` union.
- `src/lib/types/__tests__/projects-style-spec-columns.test.ts` — 114 lines. 7 contract tests including 2 source-grep drift guards and 1 type-shape test using `@ts-expect-error` with `satisfies`.

## Constants Exported (single source of truth)

| Constant                              | Value                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `STYLE_SPEC_COLUMN`                   | `'style_spec'` (matches `ALTER TABLE projects ADD COLUMN style_spec jsonb`)                                      |
| `REFERENCE_ASSETS_COLUMN`             | `'reference_assets'` (matches `ALTER TABLE projects ADD COLUMN reference_assets jsonb`)                          |
| `SLIDE_REFERENCES_BUCKET`             | `'slide-references'` (matches `INSERT INTO storage.buckets`)                                                     |
| `SLIDE_REFERENCES_RLS_POLICIES.select` | `'Users can read own slide references'`                                                                          |
| `SLIDE_REFERENCES_RLS_POLICIES.insert` | `'Users can upload own slide references'`                                                                        |
| `SLIDE_REFERENCES_RLS_POLICIES.update` | `'Users can update own slide references'`                                                                        |
| `SLIDE_REFERENCES_RLS_POLICIES.delete` | `'Users can delete own slide references'`                                                                        |
| `ReferenceAssetRow` (interface)       | `{ url: string; sha256: string; uploaded_at: string; mime_type: closed-union; size_bytes: number; original_filename: string }` |

## RLS Policies (slide-references bucket — PRIVATE)

| Policy Name                              | Verb   | Role          | Scope clause                                                                       |
| ---------------------------------------- | ------ | ------------- | ---------------------------------------------------------------------------------- |
| Users can read own slide references      | SELECT | authenticated | `bucket_id = 'slide-references' AND (storage.foldername(name))[1] = auth.uid()::text` |
| Users can upload own slide references    | INSERT | authenticated | (same — WITH CHECK clause)                                                         |
| Users can update own slide references    | UPDATE | authenticated | (same)                                                                             |
| Users can delete own slide references    | DELETE | authenticated | (same)                                                                             |

**No `TO public` clause anywhere** — verified by `grep -c 'TO public'` returning 0. Bucket is private; reads happen via short-TTL signed URLs (Phase 75) or service-role admin client (server-side extraction).

## Test Count + RED→GREEN History

7 contract tests, all GREEN after the RED+GREEN cycle:

- **RED commit `ef334d3`:** test file created, vitest reports `Failed to resolve import "../projects-storage-constants"` (expected — constants module doesn't exist yet).
- **GREEN commit `4694f9d`:** constants module created. All 7 tests pass; tsc clean on plan 02 surface.

| # | Test                                                                                              | Result |
| - | ------------------------------------------------------------------------------------------------- | ------ |
| 1 | `STYLE_SPEC_COLUMN === 'style_spec'`                                                              | GREEN  |
| 2 | `REFERENCE_ASSETS_COLUMN === 'reference_assets'`                                                  | GREEN  |
| 3 | `SLIDE_REFERENCES_BUCKET === 'slide-references'`                                                  | GREEN  |
| 4 | `SLIDE_REFERENCES_RLS_POLICIES` matches expected 4-key object                                     | GREEN  |
| 5 | SOURCE GREP — columns migration contains both column-name literals (drift guard)                  | GREEN  |
| 6 | SOURCE GREP — bucket migration contains bucket name + all 4 policy names (drift guard)            | GREEN  |
| 7 | `ReferenceAssetRow` interface compiles + `@ts-expect-error` catches missing field + invalid mime  | GREEN  |

## Decisions Made

- **PRIVATE bucket (overrides architecture research):** CONTEXT.md re-decided that `slide-references` is private (signed URLs only) because we have no use case for public reads. Architecture research had suggested public; CONTEXT.md wins per phase-lock. Verified: no `TO public` clause exists in the bucket migration.
- **Split migrations (Claude's-discretion per CONTEXT.md):** Two files (`..._style_spec_columns.sql` + `..._slide_references_bucket.sql`) instead of one combined migration — independent rollback if either side has issues post-deploy.
- **Enriched `ReferenceAssetRow` shape (Claude's-discretion per CONTEXT.md):** Added `mime_type`, `size_bytes`, `original_filename` beyond the minimum `{url, sha256, uploaded_at}` — cheap forensics insurance, ~zero storage cost.
- **`mime_type` as closed TypeScript union (D-01 defense at the type layer):** `'image/png' | 'image/jpeg' | 'image/webp' | 'image/heic'` enforced before Zod ever runs. Defends D-01 closed-enum invariant one layer earlier than the validator boundary; `@ts-expect-error` test on `'image/gif'` proves the union is closed.
- **Partial index `projects_has_style_spec_idx`:** Indexed `WHERE style_spec IS NOT NULL` — keeps index small (only style-from-reference projects), enables fast filter for Phase 77 EDITOR-02 "From references" badge without scanning all legacy projects.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test 7 type-shape assertions placed `@ts-expect-error` on the wrong line**

- **Found during:** Task 3 GREEN (after constants module written, ran `tsc --noEmit`)
- **Issue:** The plan's Test 7 design used `// @ts-expect-error` directly above `const missingUrl: ReferenceAssetRow = {` and `const badMime: ReferenceAssetRow = {`. But TypeScript reports object-literal completeness errors on the OPENING `{` line and per-property type errors on the offending PROPERTY line — not on the `const` declaration line. tsc reported `TS2578: Unused '@ts-expect-error' directive` and `TS2322: Type '"image/gif"' is not assignable...`.
- **Fix:** Restructured Test 7's two negative cases:
  - Missing-`url` case: switched from explicit-typed declaration to `satisfies ReferenceAssetRow` and placed `@ts-expect-error` on the property line where the missing key would belong.
  - Invalid-`mime_type` case: kept the typed declaration but moved `@ts-expect-error` directly above the `mime_type: 'image/gif'` line where the error is actually emitted.
- **Files modified:** `src/lib/types/__tests__/projects-style-spec-columns.test.ts`
- **Verification:** `npx tsc --noEmit -p tsconfig.json | grep -E 'projects-storage-constants|projects-style-spec-columns'` → `tsc clean on plan 02 surface`. All 7 tests still GREEN.
- **Committed in:** `4694f9d` (Task 3 GREEN commit, bundled with the constants module since the fix was needed for the GREEN gate to pass)

**Note on Task 2 verification regex:** The plan's `<verify><automated>` regex for Task 2 (`grep -cE "CREATE POLICY \".*slide references\" ON storage\.objects FOR (SELECT|INSERT|UPDATE|DELETE)"`) assumed the `CREATE POLICY ... ON storage.objects FOR <verb>` clause was on a single line. Our migration follows the brand-kit-logos pattern (which the plan instructed us to mirror), where these are split across multiple lines for readability. The functional intent is satisfied (4 CREATE POLICY statements, 4 verbs covering SELECT/INSERT/UPDATE/DELETE, 4 `TO authenticated` clauses, 0 `TO public` clauses, 4 `storage.foldername(name)` scope clauses) — verified by line-aware grep. Not flagged as a deviation since the file matches the explicit pattern reference; the plan's regex is what was over-constrained.

---

**Total deviations:** 1 auto-fixed (Rule 1 — test scaffolding bug)
**Impact on plan:** Single test-only fix needed to make tsc accept the `@ts-expect-error` directives at the lines where TypeScript actually emits the errors. No behavior change to the constants module itself; no scope creep.

## Issues Encountered

None beyond the documented Rule-1 fix above.

## User Setup Required

**Pending: migrations must be applied to Supabase before Plan 03 (upload pipeline) can be smoke-tested against a live bucket.**

To apply (when local Supabase or remote Supabase is the target):
```bash
# Local
supabase db push

# OR remote (via Supabase CLI link)
supabase migration up --linked
```

Verification queries after apply:
```sql
-- Columns exist + nullable
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
  AND column_name IN ('style_spec', 'reference_assets');
-- Expect: 2 rows, both data_type=jsonb, is_nullable=YES

-- Bucket exists + private
SELECT id, name, public FROM storage.buckets WHERE id = 'slide-references';
-- Expect: 1 row, public = false

-- 4 RLS policies present
SELECT policyname FROM pg_policies
WHERE tablename = 'objects' AND schemaname = 'storage'
  AND policyname LIKE '%slide references%'
ORDER BY policyname;
-- Expect: 4 rows (delete, read, update, upload)
```

No environment variables to add. No external service configuration beyond the migration apply.

## Next Phase Readiness

**Plan 74-03 (upload pipeline) is unblocked:**
- Can `import { SLIDE_REFERENCES_BUCKET, type ReferenceAssetRow } from '@/lib/types/projects-storage-constants'`.
- Can call `supabase.storage.from(SLIDE_REFERENCES_BUCKET).createSignedUploadUrl(path)` knowing the RLS policies will accept it for paths starting with `${userId}/`.
- Can persist `ReferenceAssetRow[]` to `projects.reference_assets` via `update({ [REFERENCE_ASSETS_COLUMN]: rows })`.

**Plan 74-04 (PTF baseline) is unblocked:**
- Can construct legacy fixtures with `style_spec: null` and `reference_assets: null` knowing those columns now exist.
- Can assert byte-identity render across all 12 templates × both renderers for the legacy NULL case.

**Plan 75 (vision extraction) is unblocked:**
- Can `update({ [STYLE_SPEC_COLUMN]: validatedSpec }).eq('id', projectId)`.
- Can `storage.from(SLIDE_REFERENCES_BUCKET).createSignedUrl(path, 600)` for service-role-side fetch into Gemini Vision.

**Sibling Plan 74-01 (in-tree parallel):** Confirmed at least one sibling commit (`1fcc7a3 feat(74-01): silent-drop counter for style-spec ingest boundary`) interleaved with this plan's commits — parallel mode is working without file collision.

## Self-Check: PASSED

**Files exist:**
- FOUND: supabase/migrations/20260510_v213_style_spec_columns.sql
- FOUND: supabase/migrations/20260510_v213_slide_references_bucket.sql
- FOUND: src/lib/types/projects-storage-constants.ts
- FOUND: src/lib/types/__tests__/projects-style-spec-columns.test.ts

**Commits exist:**
- FOUND: ad25726 (Task 1 — columns migration)
- FOUND: eefae19 (Task 2 — bucket migration)
- FOUND: ef334d3 (Task 3 RED — failing tests)
- FOUND: 4694f9d (Task 3 GREEN — constants module)

**TDD gate compliance:** RED commit (`ef334d3`, type=`test`) precedes GREEN commit (`4694f9d`, type=`feat`). Vitest output confirmed RED was failing for the right reason (missing import) before GREEN was authored.

**Verification gates:**
- Task 1 automated grep: PASS (5/5 conditions)
- Task 2 automated grep: PASS by functional verification (plan's single-line regex was over-constrained vs the multi-line brand-kit-logos pattern we were told to mirror; intent of 4 RLS policies + bucket insert + private + per-user scope all satisfied)
- Task 3 automated: PASS (7/7 vitest tests GREEN; tsc clean on plan 02 surface)

---
*Phase: 74-schema-foundation-closed-enum-reference-upload-ptf-baseline*
*Plan: 02*
*Completed: 2026-05-10*

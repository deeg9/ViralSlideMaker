---
phase: 78-remix-fork-publish-snapshot
plan: 01
subsystem: database
tags: [migration, fork-rpc, publish, supabase, jsonb, snapshot, style-spec, reference-assets]

# Dependency graph
requires:
  - phase: 74-style-spec-storage-foundation
    provides: projects.style_spec + projects.reference_assets nullable JSONB columns; STYLE_SPEC_COLUMN/REFERENCE_ASSETS_COLUMN constants
  - phase: 71-explore-fork-decoration-strip
    provides: v2.12 fork_published_carousel RPC body with _strip_locked_from_slide_data on 4 arrays + watermark
  - phase: 64-explore-fork-locked-strip
    provides: v2.11 fork RPC base (LOCK-08); _strip_locked_from_slide_data helper signature
  - phase: 29-explore-remix-foundation
    provides: published_carousels schema + publishProjectAdmin admin/service-key publish path
provides:
  - published_carousels.style_spec jsonb (nullable) + published_carousels.reference_assets jsonb (nullable)
  - fork_published_carousel RPC inherits both new columns from source published row to new project row
  - publishProjectAdmin snapshots both columns from source projects row at publish time (point-in-time deep copy)
affects: [78-02-regenerate-from-references, future remix UI, REMIX-04 reference-thumbnail-strip on forks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Snapshot-on-publish pattern (point-in-time deep clone via JSON round-trip; mirrors v2.4 slide_data deep-copy on fork)
    - Additive-nullable JSONB columns with COMMENT-as-spec (no backfill, legacy back-compat by default)
    - CREATE OR REPLACE RPC extension preserves prior GRANT EXECUTE + signature

key-files:
  created:
    - supabase/migrations/20260510_v213_published_carousels_style_spec.sql
    - supabase/migrations/20260510_v213_fork_inherits_style_spec.sql
    - src/lib/services/__tests__/publish-style-spec-snapshot.test.ts
  modified:
    - src/lib/services/publish.ts

key-decisions:
  - "Split into two migration files (columns + RPC) instead of combining — clearer per-change anchor for future rollback/audit"
  - "JSON.parse(JSON.stringify(...)) for snapshot deep clone — JSONB-safe, dependency-free, matches the wire shape Postgres stores"
  - "Test scope: publishProjectAdmin (admin/service-key path) only. publishProjectToExplore (user-session RPC path) routes through publish_carousel RPC; out of scope for Plan 78-01 which ships REMIX-02 in the admin path"
  - "RPC inherit pattern: pass-through inert metadata in INSERT — no _strip_locked equivalent needed (style_spec is structural, reference_assets is provenance; neither carries user-locked content)"

patterns-established:
  - "Phase 78 snapshot pattern: source projects row → published_carousels row at publish; published_carousels row → forked projects row at fork. Forker regenerate composes Phase 75 + 77 against inherited refs (Plan 78-02)"
  - "Migration filename convention: 20260510_v213_<feature>_<scope>.sql split allows SOURCE-GREP contract tests to anchor on specific filenames"

requirements-completed:
  - REMIX-01
  - REMIX-02
  - REMIX-03

# Metrics
duration: 8min
completed: 2026-05-11
---

# Phase 78 Plan 01: Remix/Fork/Publish Snapshot Migration Summary

**published_carousels gains nullable style_spec + reference_assets JSONB columns; fork RPC inherits both into new project row; publishProjectAdmin snapshots both at publish time via JSON-safe deep clone — pure additive, legacy back-compat preserved.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-11T01:16:30Z
- **Completed:** 2026-05-11T01:24:25Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 modified)
- **Tests added:** 4 (all GREEN; 4 RED → 4 GREEN via TDD on Task 3)

## Accomplishments

- Two split migrations on disk (columns first, RPC extension second) ready for `supabase db push` per existing operator pattern
- fork_published_carousel CREATE OR REPLACE preserves v2.12 _strip_locked_from_slide_data behavior + GRANT EXECUTE; signature unchanged (still returns new project_id uuid)
- Publish flow now snapshots style_spec + reference_assets from source projects row into published_carousels row via JSON round-trip deep clone — guarantees point-in-time integrity
- Plan 78-02 unblocked: ReferenceThumbnailsStrip and "Regenerate from references" both work automatically once forks inherit (both already null-conditional)

## Task Commits

1. **Task 1: Migration — published_carousels columns** — `d5c7c23` (feat)
2. **Task 2: Migration — fork RPC extension** — `8bed493` (feat)
3. **Task 3: Extend publish flow + test (TDD)** — `dac22c1` (test, RED) → `7e208a1` (feat, GREEN)

## Files Created/Modified

- `supabase/migrations/20260510_v213_published_carousels_style_spec.sql` — adds 2 nullable JSONB columns to published_carousels with COMMENT documenting snapshot semantics
- `supabase/migrations/20260510_v213_fork_inherits_style_spec.sql` — CREATE OR REPLACE fork_published_carousel; INSERT INTO projects extended with pub.style_spec + pub.reference_assets passthrough
- `src/lib/services/__tests__/publish-style-spec-snapshot.test.ts` — 4 tests covering: style_spec snapshot, reference_assets snapshot, legacy null back-compat, point-in-time deep-clone integrity
- `src/lib/services/publish.ts` — publishProjectAdmin INSERT now includes style_spec/reference_assets via JSON.parse(JSON.stringify()) deep clone

## Decisions Made

- **Split migrations:** Two files (columns + RPC) instead of one combined file — clearer audit trail per concern, easier to spot-fix one without re-applying both, mirrors v2.12 pattern of one-concern-per-migration.
- **JSON deep-clone over structuredClone:** `JSON.parse(JSON.stringify(...))` matches the JSONB wire shape Postgres will persist and is dependency-free; structuredClone would also work but is slightly broader (handles types JSONB cannot represent, which is a footgun for snapshot fidelity).
- **TDD scope: publishProjectAdmin only:** publishProjectToExplore (user-session path in `app/(dashboard)/.../publish-actions.ts`) routes through the `publish_carousel` RPC; that path's snapshot extension is NOT in scope for Plan 78-01 (the RPC path continues snapshotting only slide_data, matching its v2.4 surface). Plan 78-02 may need to revisit if the regenerate flow exercises that path.
- **No `_strip_locked` equivalent for new fields:** style_spec is inert structural metadata (palette/typography/etc.); reference_assets carries provenance only ({url, sha256, mime_type, ...}). Neither schema carries a `locked` flag, so the v2.12 strip pattern doesn't apply.

## Deviations from Plan

None — plan executed exactly as written. The plan called for split migrations (Task 1 columns + Task 2 RPC); both delivered with the filenames specified in `files_modified`. Task 3 followed RED-then-GREEN per the plan's TDD instructions (RED commit `dac22c1`, GREEN commit `7e208a1`).

## Issues Encountered

- **Test setup: ImageResponse mock as constructor.** First red-phase run failed with `is not a constructor` because `vi.fn(() => ({...}))` doesn't bind correctly when invoked with `new`. Switched to `vi.fn(function () { return {...} })` form, which is constructor-friendly. Resolved before the RED commit; not a deviation since RED-phase debugging is expected.
- **Pre-existing test failures NOT caused by this plan:** Full suite run after Plan 78-01 shows 37 failures across 15 files (rendering/AI/editor/satori — all unrelated to publish/fork). Verified by checking out commit `e5fd24a` (the parent of this plan) and running the suite there: **41 failures across 16 files** existed before this plan started. Plan 78-01 adds 4 GREEN tests, reducing the failure count by 4. Per SCOPE BOUNDARY: pre-existing failures are out of scope and should be tracked elsewhere (none of them touch publish.ts or the migrations).

## TDD Gate Compliance

Task 3 followed plan-level TDD: RED commit `dac22c1` (test only) precedes GREEN commit `7e208a1` (feat) in git log. No REFACTOR commit needed — the GREEN implementation is minimal (one calculation block + 2 INSERT fields). Tests 1-3 verify shape; Test 4 verifies snapshot integrity via deliberate post-call source mutation.

## User Setup Required

**Operator action required before regenerate flow works in production:**

```bash
# Apply the two new migrations against the live Supabase project
supabase db push
```

The migrations are additive and rollback-safe (both columns nullable; CREATE OR REPLACE preserves existing GRANTs). No env vars, no dashboard config.

## Next Phase Readiness

Plan 78-02 (Wave 2) is unblocked:
- `published_carousels.style_spec` and `.reference_assets` columns exist (Task 1)
- Fork RPC inherits both fields into the new projects row (Task 2)
- Phase 77-03's `<ReferenceThumbnailsStrip>` already renders when `project.reference_assets !== null` — no UI changes needed for REMIX-04
- Plan 78-02's "Regenerate from references" action reads `project.reference_assets` directly and composes Phase 75 (extract) + Phase 77 (emit)

REMIX-04 + REMIX-05 land in Plan 78-02 with no DB or RPC changes required.

## Self-Check: PASSED

All 5 files verified on disk; all 4 task commits verified in git log:
- supabase/migrations/20260510_v213_published_carousels_style_spec.sql
- supabase/migrations/20260510_v213_fork_inherits_style_spec.sql
- src/lib/services/__tests__/publish-style-spec-snapshot.test.ts
- src/lib/services/publish.ts (modified)
- .planning/phases/78-remix-fork-publish-snapshot/78-01-SUMMARY.md
- Commits: d5c7c23, 8bed493, dac22c1, 7e208a1

---
*Phase: 78-remix-fork-publish-snapshot*
*Completed: 2026-05-11*

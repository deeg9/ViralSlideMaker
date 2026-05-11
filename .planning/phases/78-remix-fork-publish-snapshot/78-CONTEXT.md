# Phase 78: Remix / Fork / Publish Snapshot - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Smart-discuss — small phase, mostly migration + RPC extension; mirrors v2.4 fork pattern

<domain>
## Phase Boundary

Extend the v2.4 publish/fork pipeline so style specs and reference assets travel with published carousels, and forkers can regenerate new content from the inherited references in one click.

5 reqs in scope: REMIX-01..05. Mostly mirror existing v2.12 `20260504_fork_strip_decoration_locked.sql` pattern — additive nullable JSONB columns + one-line RPC extension.

</domain>

<decisions>
## Locked specs
- **REMIX-01:** new migration `supabase/migrations/20260510_v213_published_carousels_style_spec.sql` — adds `published_carousels.style_spec jsonb` (nullable) + `published_carousels.reference_assets jsonb` (nullable). Legacy published rows keep `null` (back-compat).
- **REMIX-02:** publish flow snapshots `style_spec + reference_assets` from source `projects` row into `published_carousels` row at publish time
- **REMIX-03:** fork RPC extended with one-line addition to copy `style_spec + reference_assets` to the new `projects` row. Spec is INERT metadata — no locked-stripping needed (decoration `locked: true` would be the only fork-strip concern, and that's already handled in v2.12 fork RPC)
- **REMIX-04:** forker sees inherited reference thumbnails on the fork — UI piece reuses Phase 77-03's `<ReferenceThumbnailsStrip>` (already renders when `project.reference_assets !== null`)
- **REMIX-05:** "Regenerate from references" action on fork detail page — composes Phase 75 extract + Phase 77 emit pipeline against the inherited references; new content, same template fidelity

### Claude's Discretion
- **Migration filename:** `20260510_v213_published_carousels_style_spec.sql` — split if planner prefers (e.g., one migration for column adds + one for RPC update); mirror v2.4 pattern (single combined migration is fine for additive changes)
- **Fork RPC location:** existing fork RPC SQL file (find via grep at planning time) — extend, don't replace
- **"Regenerate from references" UI placement:** button on the fork's project detail header (next to existing "Edit" or "Download" actions); visible only when `project.reference_assets !== null && project.reference_assets.length > 0`
- **Regenerate UX:** click → confirmation modal showing "This will create a NEW project from these references" → confirm → call Phase 77 `generateCarouselFromReferences` → navigate to new project. Does NOT replace the current fork; creates a sibling.
- **Cost:** regenerate consumes credits per Phase 73 rate-cap (it's a fresh extract+emit cycle); UI shows "Generating will use N credits" before confirmation
- **Decoration `locked: true` strip:** existing v2.12 RPC already handles this; no change needed for v2.13 spec/assets (spec is structural metadata, not user-locked content)

</decisions>

<code_context>
## Reusable Assets
- `supabase/migrations/20260504_fork_strip_decoration_locked.sql` — existing fork RPC pattern (mirror)
- `supabase/migrations/20260502_fork_strip_locked.sql` — earlier fork RPC pattern
- `src/lib/services/publish.ts` — existing publish flow; extend
- `src/app/explore/[slug]/carousel-slideshow.tsx` — existing fork detail page; add Regenerate action here
- `<ReferenceThumbnailsStrip>` from Phase 77-03 — already conditional on `reference_assets`; no changes needed for REMIX-04
- `generateCarouselFromReferences` from Phase 77-02 — orchestrator that REMIX-05 composes
- `extractStyleSpec` from Phase 75-01 — vision extraction Phase 75 already exposes; REMIX-05 calls it
- `STYLE_SPEC_COLUMN, REFERENCE_ASSETS_COLUMN` from Phase 74-02 storage constants

## Established Patterns
- Fork RPC: `CREATE OR REPLACE FUNCTION fork_published_carousel(...)` returns new project_id; copies slide_data + (now also) style_spec + reference_assets
- Publish flow: copies from `projects` to `published_carousels` row; snapshot pattern (point-in-time, not foreign-key)
- All published_carousels columns must be nullable additive — legacy back-compat

## Integration Points
- New migration: `supabase/migrations/20260510_v213_published_carousels_style_spec.sql`
- New migration: `supabase/migrations/20260510_v213_fork_inherits_style_spec.sql` (or combined with above) — extends fork_published_carousel RPC
- Modified: `src/lib/services/publish.ts` (snapshot the two new fields)
- Modified: fork detail page (add Regenerate button + confirmation modal)
- New Server Action: `regenerateFromReferencesAction` in `src/app/(dashboard)/style-from-reference/actions.ts` (composes Phase 75 extract + Phase 77 emit against inherited refs)
- New component: `<RegenerateFromReferencesButton>` (small wrapper)

</code_context>

<specifics>
## Specifics
- Spec snapshot at publish time = point-in-time copy (forker's regenerate runs against the original references — doesn't re-extract from the original creator's project state at that moment)
- Reference assets URLs in published rows: same Storage paths as the original project's; private bucket means forker still needs auth to fetch (which they have via existing platform auth)
- "Regenerate from references" creates a SIBLING project (not in-place mutation) — preserves the fork's history
- Migration is fully additive — no data migration, no backfill, no rollback complications

</specifics>

<deferred>
## Deferred
- Style spec versioning across forks — defer (current spec is single-version v1)
- "Regenerate with different aspects" UX — defer; user can fork twice
- Public REST API for `regenerateFromReferences()` — defer to v2.14 P2
- Style spec sharing as standalone artifact (separate from carousel) — defer

</deferred>

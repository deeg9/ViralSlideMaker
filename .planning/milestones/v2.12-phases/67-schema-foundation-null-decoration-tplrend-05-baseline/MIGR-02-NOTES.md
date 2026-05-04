# MIGR-02: Eager-On-Load Schema Migration — No-Op

**Phase:** 67
**Plan:** 02
**Requirement:** MIGR-02 (eager-on-load schema migration handles existing projects transparently)

## Summary

The v2.12 decoration schema is **purely additive**. No backfill SQL exists, no
JSON rewrite is needed, no project version field is bumped. Every project
created before Phase 67 (53+ in production at v2.11 trailing edge) loads,
renders, and exports byte-identical PNG/DOM after Plan 67-01 ships.

This document explains why "migration" is the absence of one — the most
robust kind of migration there is.

## How "Migration" Works (it doesn't)

1. User opens an existing v2.11 project in the editor.
2. Supabase returns `slide_data` JSON unchanged from how v2.11 wrote it. The
   JSON contains `text_boxes`, `custom_images`, `watermark`, `style_overrides`,
   `hook_segments`, `body_segments`, etc. — but NO `decorations` field, because
   that field did not yet exist when v2.11 last wrote the row.
3. `JSON.parse(slide_data)` returns objects where `slide.decorations === undefined`.
4. Plan 67-01's renderer stubs at layer 5.5 evaluate
   `(slide.decorations ?? []).filter((d) => d.hidden !== true).map((_d) => null)`:
   - `slide.decorations === undefined` → `?? []` produces `[]`.
   - `[].filter(...).map(...)` produces `[]`.
   - React renders zero DOM nodes for the iteration.
5. The rest of the slide (text_boxes, custom_images, watermark) renders
   byte-identical to v2.11.

**No load-path code path needs to know about the schema lift.** The renderer
itself is the eager-on-load adapter — when iterating decorations it nullishly
defaults the missing field to `[]` and emits zero output.

## Why No SQL

This phase deliberately avoids the v2.8 BL-01 dual-write trap. In v2.8, the
`hook_text` / `body_text` legacy fields had to be mirrored to `text_boxes[]`
on every save during the bridge milestone. Every code path that wrote slide
data needed two updates; every read path needed conflict resolution between
the two slots. That introduced six months of subtle bugs (segment ordering,
accent flag drift, watermark resolver mis-routing, etc.) before the
legacy-text-fields legacy bridge could finally be removed in v2.10.

Decorations have **no predecessor field**. There is nothing to mirror. Every
existing project simply loads with `decorations === undefined` and the
renderer's null-safe iteration handles it transparently. New projects (Phase
68+ via the reducer's ADD_DECORATION action; Phase 71 via Gemini emit) will
write `decorations: [...]` directly into slide_data — no bridge, no mirror,
no dual-write, no migration.

The operative anti-pattern from BL-01: "Whenever you have two storage slots
for the same logical field, you have a bug." We avoid the trap by ensuring
there is exactly ONE storage slot for decorations from day zero.

## Verification

PTF16 (Plan 67-02 Task 1) pins this contract: byte-identical fingerprint
across all 11+ legacy templates with `decorations: undefined` AND
`decorations: []`, both rendering identically to the pre-v2.12 baseline. The
suite landed at 73 tests GREEN with 48 snapshots committed; manual diff
against PTF1a / PTF12a confirms PTF16-undef-1a fingerprint is character-
identical to the existing PTF1a baseline (verified for `highlight-bar` and
`paper-essay` — both renderers).

If this contract ever breaks, PTF16 fails CI immediately and the regression
is caught before any data corruption occurs.

## What Future Phases Touch

| Phase | Concern |
|-------|---------|
| 68    | Reducer adds ADD_DECORATION; new dispatches write `decorations: [decoration]` for the first time on existing projects. The schema lift is still additive — no migration needed. |
| 71    | Gemini emit writes `decorations: [...]` server-side at carousel-generation time. Forks via fork_published_carousel RPC strip `locked` flag (MIGR-01, separate migration). |
| 72    | Rotation handles + AABB lift may add `rotation` to position type — additive at the position-tuple level, still no row backfill. |

Neither phase requires a backfill of existing rows. The "migration" is the
absence of one — every wave continues to expand the additive schema while
keeping the renderer's null-safe iteration as the universal load-path adapter.

## When MIGR-02 Would Be Re-Evaluated

This document captures the design as of Phase 67. The decision NOT to ship a
backfill should be revisited if and only if:

1. Phase 71's AI emit ships and production telemetry shows >1% of projects
   benefiting from server-side decoration defaults (e.g., a brand watermark
   icon every project should auto-receive). At that point a one-time SQL
   migration may be cheaper than ongoing client-side defaulting.
2. A new schema field is introduced that CANNOT default cleanly to undefined
   (e.g., a numeric field where `0` and "absent" mean different things).
   Decorations explicitly do not have this property — `[]` and `undefined`
   render identically per PTF16-equiv-*.
3. A future renderer change requires `decorations` to always be defined
   (e.g., a reducer pattern that mutates the array in place). Plan 67-02
   intentionally does NOT take this dependency — every renderer site uses
   `(slide.decorations ?? [])` and is safe under the additive schema.

Until then: do NOT ship a backfill. The cleanest migration is the one that
doesn't run.

## References

- v2.8 BL-01 dual-write trap (avoided): `.planning/milestones/v2.8-ROADMAP.md`
- Phase 67 CONTEXT.md decision: "additive-only schema; decorations === undefined is the natural baseline"
- Plan 67-01 layer 5.5 null-safe stubs: `src/lib/render/render-slide-satori.tsx:501`, `src/components/slides/slide-preview.tsx:1059, 2630`
- PTF16 parity gate: `src/lib/render/__tests__/parity.template-fingerprint-decorations-undefined.test.tsx`
- v2.9 D-08 silent-drop default pattern (the load-path analogue for AI-ingest validation): `src/lib/ai/schemas.ts` `parseDecorationsArraySafe`

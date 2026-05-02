---
phase: 54-infrastructure-foundation
plan: 01
status: complete
completed: 2026-04-30
self_check: PASSED
requirements_satisfied:
  - TREAT-01
  - TREAT-02
  - TREAT-03
  - TREAT-04
  - TREAT-05
  - TREAT-06
key-files:
  created:
    - src/lib/photo-treatment/sharp-config.ts
    - src/lib/photo-treatment/treat.ts
    - src/lib/photo-treatment/__tests__/treat.test.ts
    - supabase/migrations/20260501_treated_backgrounds_bucket.sql
    - supabase/migrations/20260501_treated_backgrounds_retention_cron.sql
  modified:
    - package.json
    - package-lock.json
---

## Summary

Plan 54-01 stands up the photo-treatment foundation that every downstream
v2.9 phase depends on. `treatPhoto(sourceUrl, spec, userId)` returns a
deterministic, idempotent treated PNG URL plus a derived palette — sharp
runs on the server (Satori cannot render CSS `filter:` per vercel/satori#573).

## Decisions implemented

- D-01: 4 presets shipped — `bw`, `duotone-cream`, `duotone-cobalt`, `contrast-bump`.
- D-02: palette extracted via `sharp.stats()` (dominant + per-channel means);
  `@vibrant/node` k-means deferred to Phase 57 — palette shape stable.
- D-03: cache key = `SHA-256(sourceUrl + '|' + JSON.stringify(spec))`.
- D-04: `sharp.cache(false)` and `sharp.concurrency(1)` set at module load
  via `sharp-config.ts` (Pitfall #5 — serverless memory fragmentation).
- D-05: sharp pinned to `^0.33.5` (single new npm dep this phase).
- D-06: public bucket `slide-backgrounds-treated` with per-user-folder RLS.
- D-07: `pg_cron` job `cleanup_orphan_treated_backgrounds_daily`
  (`0 3 * * *`) deletes 7+ day-old objects with no `slide_data.*.background_url`
  reference.
- D-08 (acknowledged, NOT implemented this phase): generation pipeline
  still writes treated URL directly to `slide.background_url`.
  `slide.original_source_url` schema field is reserved for Phase 55.

## Final preset parameters (Task 2)

| Preset | Pipeline |
|--------|----------|
| `bw` | `grayscale().linear(contrast ?? 1.05, -8).png()` |
| `duotone-cream` | `grayscale().tint({r:248,g:232,b:200}).modulate({brightness: intensity ?? 1.0}).png()` |
| `duotone-cobalt` | `grayscale().tint({r:30,g:70,b:140}).modulate({brightness: intensity ?? 1.0}).png()` |
| `contrast-bump` | `gamma(gamma ?? 1.1).linear(linear?.[0] ?? 1.08, linear?.[1] ?? -6).png()` |

These survived the plan checklist as starting-point values; they remain
tweakable per CONTEXT.md "Claude's Discretion" clause (visual review may
adjust without re-planning).

## Test results

`npx vitest run src/lib/photo-treatment/__tests__/treat.test.ts`
→ 8 / 8 passed (cache-key determinism × 2, byte-identical output × 2,
all-4-preset coverage, storage-path format, cache-hit upload skip,
palette hex shape).

`npx tsc --noEmit` reports zero errors in `src/lib/photo-treatment/**`.

## Live DB verification

Migrations applied via `mcp__supabase__apply_migration`:

| Check | Result |
|-------|--------|
| `SELECT id, public FROM storage.buckets WHERE id='slide-backgrounds-treated'` | 1 row, `public=true` |
| `SELECT jobname, schedule FROM cron.job WHERE jobname='cleanup_orphan_treated_backgrounds_daily'` | 1 row, `schedule='0 3 * * *'` |

`supabase db push` was NOT used — Supabase MCP applied migrations directly.

## Carry-forward to Plan 54-02

- Generation pipeline wiring (replacing raw URL with `treatedUrl` in
  `slide.background_url`) is **NOT** done in 54-01. The CONTEXT.md
  D-08 carry-forward defers schema split to Phase 55; 54-02 owns the
  guardrails + Inter audit + ZIP-download metric, not the wire-up.
- `treatPhoto()` is fully importable today; first call site lands in
  Phase 56 (template treatment integration).

## Self-Check: PASSED

All success criteria from the PLAN met:
- TREAT-01: ✅ `treatPhoto` exported with 4 presets + SHA-256 cache key.
- TREAT-02: ✅ Cache hit short-circuits via `storage.list({search})` before sharp.
- TREAT-03: ✅ `cache(false)` + `concurrency(1)` at module load.
- TREAT-04 (partial): ✅ Returns public URL; full wiring per D-08 deferred.
- TREAT-05: ✅ Pure unit tests verify byte-identical output.
- TREAT-06: ✅ pg_cron 7-day retention job scheduled and verified live.

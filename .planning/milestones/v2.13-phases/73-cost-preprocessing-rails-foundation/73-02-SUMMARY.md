---
phase: 73-cost-preprocessing-rails-foundation
plan: 02
subsystem: cache
tags: [cache, supabase, sha256, vision-rails, cost-defense]
requires: []
provides:
  - "style_spec_cache table (public.style_spec_cache, sha256 PK, jsonb value)"
  - "lookupStyleSpec(admin, sha256) → unknown | null helper (read; bumps last_hit_at fire-and-forget on hit)"
  - "persistStyleSpec(admin, sha256, spec, model?) → void helper (idempotent upsert onConflict sha256)"
  - "StyleSpecCacheRow TypeScript interface"
affects:
  - "Phase 75 vision extraction will short-circuit Gemini Vision via lookupStyleSpec; persist after Zod-validated spec"
tech-stack:
  added: []
  patterns:
    - "Mirror v2.6 match_photo_cache shape (sha256 PK + jsonb result + RLS DISABLED)"
    - "Mirror v2.6 match-photos-to-slides cache-failure stance (never throw — log + treat as miss/no-op)"
    - "Fire-and-forget last_hit_at bump on read (load-bearing for future LRU eviction without backfill)"
key-files:
  created:
    - "supabase/migrations/20260510_style_spec_cache.sql"
    - "src/lib/cache/style-spec-cache.ts"
    - "src/lib/cache/__tests__/style-spec-cache.test.ts"
  modified: []
decisions:
  - "Cache key is SHA-256 of preprocessed bytes (not raw uploads) — same image at different upload resolution produces a different hash; cache hits only on bit-identical preprocessed output (per CONTEXT.md COST-03 decision)"
  - "RLS DISABLED — server-only access via service role; cache key is content-derived not user-derived (mirrors match_photo_cache decision)"
  - "Cache TTL / LRU eviction NOT shipped — deferred per CONTEXT.md (\"recommend forever with manual purge endpoint\"); last_hit_at IS persisted now so a future eviction has the data without backfill"
  - "Helpers NEVER throw — Phase 75 doesn't need try/catch around cache calls; cache failure degrades to a miss (lookup) or no-op (persist), never blocks the caller"
  - "model column with default 'gemini-2.5-flash' is forward-compat for future model upgrades; no Phase 73 caller varies it but the column shape is stable"
  - "TODO comment in helper file points to Phase 74 (STYLESPEC-01) for the real StyleSpec type — Phase 73 deliberately stays opaque (`unknown`) so it ships before Phase 74's schema lands"
metrics:
  duration: "~6 min"
  tasks: 2
  files-created: 3
  files-modified: 0
  tests-added: 10
  tests-passing: 10
  completed: "2026-05-10"
---

# Phase 73 Plan 02: style_spec_cache foundation Summary

SHA-256-keyed Postgres cache table + throw-safe read/write helpers — the storage primitive Phase 75 will use to short-circuit Gemini Vision on bit-identical preprocessed bytes (the single biggest cost-defense lever in v2.13).

## Outcome

Two atomic commits, full TDD cycle (RED → GREEN), 10/10 tests green, COST-03 requirement satisfied.

| Task | Commit  | Description                                                                  |
| ---- | ------- | ---------------------------------------------------------------------------- |
| 1    | 3750049 | RED: migration SQL + 10 failing helper contract tests (module-not-found)     |
| 2    | 7e77f19 | GREEN: lookupStyleSpec + persistStyleSpec implementation; all tests pass     |

## Migration

**File:** `supabase/migrations/20260510_style_spec_cache.sql` (30 lines)

Table: `public.style_spec_cache` with **5 columns**:

| Column        | Type        | Default              | Notes                                                       |
| ------------- | ----------- | -------------------- | ----------------------------------------------------------- |
| `sha256`      | text        | (PK, NOT NULL)       | 64-char hex SHA-256 of preprocessed bytes (Plan 73-01 owns) |
| `style_spec`  | jsonb       | (NOT NULL)           | Validated, closed-enum-coerced StyleSpec from Phase 75      |
| `model`       | text        | `'gemini-2.5-flash'` | Extraction model used (forward-compat for upgrades)         |
| `created_at`  | timestamptz | `now()`              | First-write timestamp                                       |
| `last_hit_at` | timestamptz | `now()`              | Bumped on lookup hit (fire-and-forget, for LRU eviction)    |

`ALTER TABLE public.style_spec_cache DISABLE ROW LEVEL SECURITY;` — server-only via service role; mirrors v2.6 `match_photo_cache` (20260502).

## Helpers

**File:** `src/lib/cache/style-spec-cache.ts` (130 lines)

**Exported signatures:**

```typescript
export interface StyleSpecCacheRow {
  sha256: string
  style_spec: unknown   // TODO(Phase 74 STYLESPEC-01): swap for real StyleSpec type
  model: string
  created_at: string
  last_hit_at: string
}

export async function lookupStyleSpec(
  admin: SupabaseClient,
  sha256: string,
): Promise<unknown | null>

export async function persistStyleSpec(
  admin: SupabaseClient,
  sha256: string,
  styleSpec: unknown,
  model?: string,  // defaults to 'gemini-2.5-flash'
): Promise<void>
```

**Behavior pinned by tests:**

- `lookupStyleSpec` miss → returns `null`; does NOT call `update` (no phantom row)
- `lookupStyleSpec` hit → returns the spec object **directly** (NOT wrapped in `{ style_spec }`)
- `lookupStyleSpec` hit → fires-and-forgets a `last_hit_at` bump (load-bearing for future LRU eviction without backfill)
- `lookupStyleSpec` errors (rejected select OR error payload) → returns `null` + `console.warn`; never throws
- `persistStyleSpec` upserts with `{ sha256, style_spec, model }` and `{ onConflict: 'sha256' }` — idempotent on duplicate sha256 (concurrent extractions safe)
- `persistStyleSpec` default model: `'gemini-2.5-flash'`
- `persistStyleSpec` error payload OR rejected upsert → `console.warn` + resolves; never throws

## Tests

**File:** `src/lib/cache/__tests__/style-spec-cache.test.ts` (195 lines)

```
Test Files  1 passed (1)
     Tests  10 passed (10)
  Duration  588ms
```

10 cases:
1. `lookupStyleSpec` miss → null + no update
2. `lookupStyleSpec` hit → returns spec object directly
3. `lookupStyleSpec` hit → triggers fire-and-forget `last_hit_at` update
4. `lookupStyleSpec` hit → does NOT throw if `last_hit_at` update fails (best-effort warn)
5. `lookupStyleSpec` → returns null + warns when select rejects (throw-resilience)
6. `lookupStyleSpec` → returns null when select returns an error payload
7. `persistStyleSpec` → upserts with full payload + onConflict sha256
8. `persistStyleSpec` → defaults model to `'gemini-2.5-flash'`
9. `persistStyleSpec` → does NOT throw on error payload (logs warn)
10. `persistStyleSpec` → does NOT throw on rejected upsert (logs warn)

`grep -nE "throw new" src/lib/cache/style-spec-cache.ts` → **0 matches**. The "never throws" contract is verified by tests 4, 5, 9, 10 AND by source grep.

## Phase 75 Will Consume

Phase 75 (vision extraction, EXTRACT-01..EXTRACT-08) will wire this with two function calls — no schema knowledge required at the caller, no try/catch around either call:

```typescript
import { lookupStyleSpec, persistStyleSpec } from '@/lib/cache/style-spec-cache'

// AFTER prepareForVision (Plan 73-01), BEFORE credit charge:
const cached = await lookupStyleSpec(admin, prepared.sha256)
if (cached) {
  // Cache HIT — no Gemini call, no credit charge, no telemetry except cache_hit:true log
  return cached as StyleSpec  // Phase 74 will own the StyleSpec type cast
}

// ... charge credit, call Gemini, validate with Zod (Phase 75's two-phase architecture) ...

// AFTER Zod validation succeeds, BEFORE returning:
await persistStyleSpec(admin, prepared.sha256, validatedSpec)
return validatedSpec
```

**Contract guarantees Phase 75 relies on:**
1. **Never throws.** Cache I/O failure degrades to a miss (lookup) or no-op (persist). Phase 75 must NOT wrap these in try/catch.
2. **Idempotent persist.** Concurrent extractions of the same image (two users uploading the same bit-identical preprocessed bytes simultaneously) are safe — the second `persistStyleSpec` is a no-op via `onConflict: 'sha256'`.
3. **Garbage-in / garbage-out.** This module trusts the caller. No Zod validation inside lookup/persist — Phase 75's EXTRACT-02 two-phase architecture is the validator. Cache hits return what was previously persisted; if that was garbage, it's still garbage.
4. **`last_hit_at` is automatic.** Phase 75 does NOT bump it manually; lookup does it fire-and-forget so future LRU eviction has the data.

Phase 75 should NOT add new columns, indexes, or helpers to this surface. If it needs them, that's a Phase 75-scoped follow-on plan, not a Phase 73 expansion.

## Cache TTL / Eviction (deferred)

**Explicitly NOT shipped in v2.13** per CONTEXT.md decision: "recommend forever with manual purge endpoint (cache hit rate is the cost lever; eviction defeats the point); revisit after launch telemetry."

`last_hit_at` IS persisted on every lookup hit, so a future LRU eviction job can read it directly — no backfill required. This is the only "future-proofing" cost paid in v2.13: one extra column + one fire-and-forget UPDATE per cache hit.

pHash cache layer above SHA-256 also deferred (v2.14 per REQUIREMENTS.md "Future Requirements").

## Deviations from Plan

None. Plan executed exactly as written; all `must_haves.truths` and `must_haves.artifacts` invariants satisfied.

## Verification

- [x] All 10 helper tests GREEN (`npx vitest run src/lib/cache/__tests__/style-spec-cache.test.ts`)
- [x] Migration at `supabase/migrations/20260510_style_spec_cache.sql` with `DISABLE ROW LEVEL SECURITY`
- [x] `grep -nE "throw new" src/lib/cache/style-spec-cache.ts` → 0 matches
- [x] Helper file header references Phase 75 by name (5 mentions)
- [x] `grep -c "CREATE TABLE.*style_spec_cache" supabase/migrations/20260510_style_spec_cache.sql` → 1
- [x] `npx tsc --noEmit` clean for new files

## Self-Check: PASSED

Files created (verified `[ -f path ]`):
- FOUND: `supabase/migrations/20260510_style_spec_cache.sql`
- FOUND: `src/lib/cache/style-spec-cache.ts`
- FOUND: `src/lib/cache/__tests__/style-spec-cache.test.ts`

Commits exist (verified `git log --oneline | grep <hash>`):
- FOUND: 3750049 (RED — migration + tests)
- FOUND: 7e77f19 (GREEN — helper implementation)

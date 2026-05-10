# Phase 73: Cost & Preprocessing Rails (Foundation) - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning
**Mode:** Infrastructure skip — smart-discuss classified phase as pure rails work; specs locked in REQUIREMENTS.md

<domain>
## Phase Boundary

Lock cost ceilings + deterministic image preprocessing in place before a single vision call ships. Phase 73 is a hard prerequisite for Phase 75 (vision extraction) — merging is forbidden per ROADMAP.md hard constraints. Scope is purely server-side rails: sharp preprocessing pipeline, SHA-256 cache table, per-user-per-day rate cap, daily bill-alarm cron, charge-then-refund ledger pattern, single-retry policy. No user-facing UI surface; no API endpoint visible to public REST. The only user-observable behavior is a "daily cap reached" rejection response on the 6th extraction attempt within 24h (no UI surface required in this phase — Phase 76's spec-preview UI will render it).

8 reqs in scope: COST-01..07 + PARITY-04 (9:16 aspect-normalize regression test).

</domain>

<decisions>
## Implementation Decisions

### Locked specs (from REQUIREMENTS.md, confirmed pre-roadmap)
- **Sharp downscale target:** ≤1024×1024 (COST-01) — per Stack research this is well within Gemini's 1-tile efficiency band; no need for the 768×1366 variant Stack discussed
- **HEIC handling:** transcode to JPEG@85 server-side (COST-02) — wire format to Gemini is always JPEG for determinism
- **Cache key:** SHA-256 of the *preprocessed* bytes (COST-03) — same image ≠ same hash if uploaded at different resolutions; cache hits only on bit-identical preprocessed output
- **Rate cap:** 5 extraction calls/day × 3 images max per call = 15 vision calls/day ceiling (COST-04) — free-tier; reuses existing credit-ledger pattern
- **Retry policy:** capped at 1 (COST-07) — transient errors fail loud rather than compound cost
- **Refund pattern:** charge-then-refund mirroring v2.6 `gemini_vision_match` (COST-06)
- **Aspect normalization:** sharp resizes to 9:16-aware bounds at preprocessing time so a 1:1 reference doesn't produce a stretched StyleSpec (PARITY-04 regression test owns this surface; defends against v2.12 ASPECT-01 bug class re-emerging)

### Claude's Discretion
- **Cache TTL strategy:** forever vs N-days vs LRU eviction — recommend forever with manual purge endpoint (cache hit rate is the cost lever; eviction defeats the point); revisit after launch telemetry
- **Bill-alarm threshold value:** starting ceiling configurable via env var (`STYLE_EXTRACTION_DAILY_COST_CEILING_USD`) with a sane default (e.g., $5/day pre-PMF); cron reads this, not hard-coded
- **Rate-cap window:** rolling 24h (not calendar day) — fairer UX; aligns with how match-photos-to-slides cap behaves
- **Cron schedule:** 9:00 UTC daily (post-midnight in all major timezones); Vercel cron syntax
- **Ledger schema reuse:** mirror existing `credits_ledger` columns rather than introducing a `style_extraction_ledger` table — extraction is just another kind of charge
- **Retry implementation:** in-process `Promise.race` + try/catch with single re-attempt on Network/5xx errors only; permanent failures (4xx, schema validation, safety-block) do NOT retry

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sharp` already in production from v2.9 photo-treatment pipeline — same import path, same processing presets folder; this phase adds new preset(s) for "style-reference downscale + JPEG transcode"
- `node-vibrant` already in `package.json` (v4.0.4) for v2.9 — Phase 75 will consume this; Phase 73 only needs sharp
- Charge-then-refund credit ledger pattern: `src/server/services/credits.ts` (or equivalent) per v2.6 `gemini_vision_match` — extend not fork
- Vercel cron pattern: see existing `vercel.json` cron entries (e.g., monthly billing reset); add a new daily cron handler

### Established Patterns
- Server-side preprocessing happens in Server Actions / RPC handlers, not client-side — see `match-photos-to-slides.ts` shape from v2.9 Phase 58
- Cache tables in Supabase are written via standard migration files; `style_spec_cache` follows the same shape
- Env-driven config thresholds are read once per process, not per request — wrap in a memoized accessor

### Integration Points
- New table: `style_spec_cache` (sha256 PRIMARY KEY, style_spec JSONB, created_at, last_hit_at)
- New env vars: `STYLE_EXTRACTION_DAILY_COST_CEILING_USD`, `STYLE_EXTRACTION_FREE_DAILY_CALL_CAP` (default 5), `STYLE_EXTRACTION_FREE_DAILY_IMAGES_CAP` (default 3 per call)
- New Vercel cron entry: `app/api/cron/style-extraction-bill-alarm/route.ts` scheduled daily at 09:00 UTC
- New preprocessing utility: `src/lib/preprocessing/style-reference-prep.ts` exports `prepareForVision(buffer): Promise<{ bytes: Buffer, sha256: string }>`
- New rate-cap utility: integrated into the future `extract-style-spec.ts` Server Action (Phase 75 consumes it; Phase 73 ships the utility + tests)

</code_context>

<specifics>
## Specific Ideas

- Mirror `match-photos-to-slides.ts` shape exactly — same Promise.race timeout pattern, same charge-then-refund, same telemetry shape — because Phase 75 will re-use the surrounding harness
- Sharp pipeline must be deterministic — same input bytes produce same output bytes (test as a regression invariant) so the SHA-256 cache works
- 9:16 aspect normalization happens at sharp time, not at vision time — this is what defends against the v2.12 ASPECT-01 bug class
- Bill-alarm cron emits a structured log + (in production) a Slack/email alert; Pre-PMF: just structured log + Vercel monitoring
- Cache `last_hit_at` is updated on read (not just write) so an LRU eviction strategy is possible later without backfill

</specifics>

<deferred>
## Deferred Ideas

- Sightengine NSFW pre-classifier — explicitly NOT in Phase 73 scope (per locked decision #4); revisit on safety-block telemetry
- pHash cache layer above SHA-256 — defer to v2.14 (Pitfalls open question); diminishing return until launch shows demand
- Per-tier cap configurability (premium gets higher cap) — not in v2.13 scope; v2.13 is free-tier-with-cap only
- Streaming extraction response — anti-decision per Stack research; revisit only if launch latency becomes UX issue

</deferred>

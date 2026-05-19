---
phase: 73-cost-preprocessing-rails-foundation
plan: 03
subsystem: cost-rails
tags:
  - cost-rails
  - rate-limit
  - credits
  - cron
  - retry-policy
  - vision-rails
requirements:
  - COST-04
  - COST-05
  - COST-06
  - COST-07
dependency-graph:
  requires:
    - src/lib/credits/types.ts
    - src/lib/credits/check-credits.ts (deductCreditAdmin composition target)
    - src/lib/supabase/admin.ts (createAdminClient for cron)
  provides:
    - "@/lib/cost/style-extraction-rate-cap": checkExtractionRateCap, FREE_DAILY_CALL_CAP, FREE_DAILY_IMAGES_PER_CALL, RateCapResult, RateCapReason
    - "@/lib/cost/style-extraction-ledger": chargeExtractionCredit, refundExtractionCredit, EXTRACTION_CHARGE_TYPE
    - "@/lib/cost/style-extraction-retry": withSingleRetry, isTransientError, RetryPolicy
    - /api/cron/style-extraction-bill-alarm (GET + POST)
  affects:
    - Phase 75 (vision extraction) — composes all four exports in documented wiring order
    - Vercel cron schedule (vercel.json now declared at repo root)
tech-stack:
  added: []
  patterns:
    - charge-then-refund mirror of v2.6 gemini_vision_match
    - rolling-24h rate cap (CONTEXT.md: not calendar day)
    - module-load env-var read (CONTEXT.md: read once per process)
    - fail-closed safety stance (DB error → reject, not bypass)
key-files:
  created:
    - src/lib/cost/style-extraction-rate-cap.ts (149 lines)
    - src/lib/cost/style-extraction-ledger.ts (80 lines)
    - src/lib/cost/style-extraction-retry.ts (78 lines)
    - src/app/api/cron/style-extraction-bill-alarm/route.ts (125 lines)
    - src/lib/cost/__tests__/style-extraction-rate-cap.test.ts (152 lines, 10 tests)
    - src/lib/cost/__tests__/style-extraction-ledger.test.ts (143 lines, 5 tests)
    - src/lib/cost/__tests__/style-extraction-retry.test.ts (96 lines, 16 tests)
    - src/app/api/cron/style-extraction-bill-alarm/__tests__/route.test.ts (196 lines, 8 tests)
    - vercel.json (new file — daily 09:00 UTC cron entry)
    - .env.example (new file — force-added past .env* gitignore as canonical template)
  modified:
    - src/lib/credits/types.ts (added 'gemini_vision_extract_style' to union + CREDIT_COSTS)
decisions:
  - "Counted CHARGES only in rate-cap (not net charges) — anti-abuse stance: failed attempts still count against the cap"
  - "Counted NET (charges - refunds) in bill-alarm cron — refunded calls didn't actually cost the wire"
  - "Force-committed .env.example past .gitignore .env* rule — this is the canonical public template, mirrors .env.local.example contents and adds Phase 73 vars"
  - "Used module-load env-var read pattern; tests use vi.resetModules + vi.stubEnv + dynamic import to override (per CONTEXT.md 'read once per process')"
  - "Permanent-error checks fire BEFORE transient-text checks in isTransientError so a 'safety' message containing 'timeout' classifies correctly"
metrics:
  duration: ~10 minutes
  completed: 2026-05-10T21:58:03Z
  tasks_completed: 3/3
  tests_added: 39
---

# Phase 73 Plan 03: Vision-Extraction Cost Rails Summary

Shipped the four cost-rail primitives Phase 75 (vision extraction) MUST consume so it cannot blow the Gemini bill: rolling-24h rate cap (free tier 5×3, premium uncapped), charge-then-refund credit ledger extension, single-retry policy capped at 2 in-flight attempts, and daily Vercel bill-alarm cron at 09:00 UTC. No vision-call code lands in this plan; Phase 75 has zero local re-implementation overhead.

## Helper modules

| Module | Lines | Public exports |
|--------|-------|----------------|
| `src/lib/cost/style-extraction-rate-cap.ts` | 149 | `checkExtractionRateCap`, `FREE_DAILY_CALL_CAP`, `FREE_DAILY_IMAGES_PER_CALL`, `RateCapResult`, `RateCapReason` |
| `src/lib/cost/style-extraction-ledger.ts` | 80 | `chargeExtractionCredit`, `refundExtractionCredit`, `EXTRACTION_CHARGE_TYPE` |
| `src/lib/cost/style-extraction-retry.ts` | 78 | `withSingleRetry`, `isTransientError`, `RetryPolicy` |
| `src/app/api/cron/style-extraction-bill-alarm/route.ts` | 125 | `GET`, `POST` |

## New env vars (in `.env.example`)

| Var | Default | Purpose |
|-----|---------|---------|
| `STYLE_EXTRACTION_DAILY_COST_CEILING_USD` | `5` | Bill-alarm warn threshold (USD) |
| `STYLE_EXTRACTION_PER_CALL_COST_USD` | `0.003` | Per-call cost estimate (STACK.md, 3 imgs @1024² + ~600 tok output on gemini-2.5-flash) |
| `STYLE_EXTRACTION_FREE_DAILY_CALL_CAP` | `5` | Free-tier rolling-24h call cap |
| `STYLE_EXTRACTION_FREE_DAILY_IMAGES_CAP` | `3` | Free-tier max images per call |
| `CRON_SECRET` | (none — required) | `Authorization: Bearer <secret>` for `/api/cron/*` |

## Cron schedule

`vercel.json` declares one entry:

```json
{ "crons": [{ "path": "/api/cron/style-extraction-bill-alarm", "schedule": "0 9 * * *" }] }
```

Daily 09:00 UTC = post-midnight in all major timezones (CONTEXT.md decision).

## Test pass counts

| Test file | Tests | Status |
|-----------|-------|--------|
| `src/lib/cost/__tests__/style-extraction-rate-cap.test.ts` | 10 | GREEN |
| `src/lib/cost/__tests__/style-extraction-ledger.test.ts` | 5 | GREEN |
| `src/lib/cost/__tests__/style-extraction-retry.test.ts` | 16 | GREEN |
| `src/app/api/cron/style-extraction-bill-alarm/__tests__/route.test.ts` | 8 | GREEN |
| **Total** | **39** | **39/39 GREEN** |

Reproduce: `npx vitest run src/lib/cost/ src/app/api/cron/style-extraction-bill-alarm/`

## Retry cap = 2 in-flight attempts (verified)

The test that proves no third call is ever issued:

> `Phase 73 (COST-07): withSingleRetry > fn throws transient twice → fn called EXACTLY twice, throws second error (NOT three calls)` in `src/lib/cost/__tests__/style-extraction-retry.test.ts`

It asserts both `expect(fn).toHaveBeenCalledTimes(2)` AND `expect(fn.mock.calls.length).toBeLessThanOrEqual(2)`. Any third invocation would fail the test. The `RetryPolicy.maxAttempts` field is also typed as the literal `2` so a future increase would be a type error, not a config drift.

## Phase 75 wiring (handoff)

Phase 75's `extract-style-spec.ts` Server Action MUST compose these four helpers in this exact order — no re-implementation:

```typescript
// 1. Cache check first (Plan 02)
const cached = await lookupStyleSpec(admin, prepared.sha256)
if (cached) return cached

// 2. Rate cap BEFORE charge
import { checkExtractionRateCap } from '@/lib/cost/style-extraction-rate-cap'
const cap = await checkExtractionRateCap(admin, userId, tier, referenceUrls.length)
if (!cap.allowed) return { error: 'daily_cap_reached', detail: cap }

// 3. Charge BEFORE Gemini call
import { chargeExtractionCredit, refundExtractionCredit } from '@/lib/cost/style-extraction-ledger'
const charged = await chargeExtractionCredit(admin, userId, projectId)
if (!charged) return { error: 'insufficient_credits' }

// 4. Vision call wrapped in single-retry policy
import { withSingleRetry } from '@/lib/cost/style-extraction-retry'
try {
  const spec = await withSingleRetry(() => callGeminiVision(prepared))
  await persistStyleSpec(admin, prepared.sha256, spec)  // Plan 02
  return spec
} catch (err) {
  await refundExtractionCredit(admin, userId, projectId, errorReason(err))
  throw err
}
```

Function signatures Phase 75 imports:

```typescript
checkExtractionRateCap(admin: SupabaseClient, userId: string, tier: SubscriptionTier, requestedImageCount: number): Promise<RateCapResult>
chargeExtractionCredit(admin: SupabaseClient, userId: string, referenceId: string): Promise<boolean>
refundExtractionCredit(admin: SupabaseClient, userId: string, referenceId: string, reason: string): Promise<void>
withSingleRetry<T>(fn: () => Promise<T>): Promise<T>
```

The bill-alarm cron is INDEPENDENT of Phase 75 wiring — it reads `credit_transactions` directly. Phase 75 only needs to ensure its charge rows are typed `'gemini_vision_extract_style'` (the ledger helper guarantees that via `EXTRACTION_CHARGE_TYPE`).

## Counting policy distinction (intentional)

| Surface | Counts | Why |
|---------|--------|-----|
| `checkExtractionRateCap` | CHARGES only | Anti-abuse — failed attempts still count against the cap |
| `runBillAlarm` (cron) | NET (charges − refunds) | Refunded calls did not actually cost the wire |

Phase 75 reviewers: this asymmetry is by design (per Task 1 file header).

## Deferred (do NOT rebuild in Phase 75)

- **Per-tier cap configurability** (premium gets higher cap) — out of scope per CONTEXT.md "Per-tier cap configurability — not in v2.13 scope". Plan 03 returns `allowed: true` unconditionally for `tier !== 'free'`. Flag is in code comment.
- **Slack/email alert delivery** from bill-alarm — pre-PMF, structured `console.warn` is sufficient; Vercel monitoring captures it. The alert SHAPE is shipped so a future delivery integration is a one-line change at the warn site.
- **Sightengine NSFW pre-classifier** — explicitly excluded per CONTEXT.md "Per locked decision #4".

## Deviations from plan

None — plan executed exactly as written. All three tasks GREEN on first run; no Rule 1/2/3 fixes needed.

One small in-spec adjustment to test setup: bill-alarm route tests use `vi.resetModules() + vi.stubEnv() + dynamic import('../route')` to override the module-load env-var reads for `DAILY_COST_CEILING_USD` and `PER_CALL_COST_USD` — same pattern as the rate-cap tests' env-override case. Documented in test file header.

## Authentication gates

None encountered.

## Commits

- `ea13ec1` feat(73-03): add style-extraction rate cap (COST-04, COST-06 type)
- `b3df2c2` feat(73-03): add ledger charge/refund + single-retry policy (COST-06, COST-07)
- `2ffe60a` feat(73-03): bill-alarm cron + vercel.json + .env.example (COST-05)

## Self-Check: PASSED

Files verified to exist:
- FOUND: src/lib/cost/style-extraction-rate-cap.ts
- FOUND: src/lib/cost/style-extraction-ledger.ts
- FOUND: src/lib/cost/style-extraction-retry.ts
- FOUND: src/app/api/cron/style-extraction-bill-alarm/route.ts
- FOUND: src/lib/cost/__tests__/style-extraction-rate-cap.test.ts
- FOUND: src/lib/cost/__tests__/style-extraction-ledger.test.ts
- FOUND: src/lib/cost/__tests__/style-extraction-retry.test.ts
- FOUND: src/app/api/cron/style-extraction-bill-alarm/__tests__/route.test.ts
- FOUND: vercel.json
- FOUND: .env.example

Commits verified to exist (`git log --oneline | grep`):
- FOUND: ea13ec1
- FOUND: b3df2c2
- FOUND: 2ffe60a

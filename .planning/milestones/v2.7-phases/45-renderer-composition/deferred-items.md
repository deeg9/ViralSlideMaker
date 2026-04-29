# Phase 45 — Deferred Items (Out-of-Scope Discoveries)

Items found during Phase 45 execution that are NOT caused by this phase's
changes. Documented per executor scope-boundary rule. Do NOT fix in Phase 45.

## Pre-existing baseline test failures (verified unrelated to Phase 45-01)

Discovered during the Plan 45-01 GREEN-phase regression run. Baseline check:
moved Phase 45-01 files aside, ran the suite, observed identical failures.
The same 7 test files / 12 tests failed both before and after Phase 45-01's
changes — 0 new regressions introduced by 45-01.

| File | Failing test(s) | Likely category |
|------|-----------------|-----------------|
| `src/__tests__/api/rate-limit.test.ts` | checkRateLimit shape, calls Ratelimit.limit() with keyId | Upstash mock drift |
| `src/__tests__/components/slide-preview.test.tsx` | renders hook_text/body_text content; applies textColor + fontFamily | Pre-existing slide-preview test mock drift (NOT Phase 45 — these tests run against the un-extended preview) |
| `src/__tests__/editor/responsive.test.tsx` | renders desktop grid; child sections present | Editor layout test mock drift |
| `src/__tests__/editor/slide-preview.test.tsx` | "Slide X of Y" indicator | SlideCanvas test mock drift |
| `src/__tests__/projects/crud.test.ts` | createProject default title; deleteProject calls supabase | Supabase mock drift in crud tests |
| `src/__tests__/stripe/checkout.test.ts` | createCreditPackCheckout payment-mode session | Stripe mock drift |
| `src/__tests__/stripe/sync-subscription.test.ts` | invoice.paid grants tier-correct credit | Tier label drift (Pro vs Creator) |

Total: 7 files / 12 tests pre-existing.

These should be triaged in a separate cleanup quick-task or as part of
their respective subsystems' next active phase. They do NOT block Phase 45
because Phase 45 introduces no functional changes that the listed tests
exercise.

## Phase 45-01 specific note

Plan 45-01 ships `src/lib/render/resolve-overlay.ts` and
`src/lib/render/resolve-overlay.test.ts` only. Renderer files
(`render-slide-satori.tsx`, `slide-preview.tsx`) are byte-identical to
their pre-Phase-45 state — the slide-preview.test.tsx failures listed
above predate this plan and would persist if 45-01 were reverted.

## ESLint / TypeScript baseline

Pre-existing TS errors (if any) are tracked elsewhere. Phase 45-01 introduces
no new TypeScript errors:

```bash
npx tsc --noEmit  # baseline error count unchanged
```

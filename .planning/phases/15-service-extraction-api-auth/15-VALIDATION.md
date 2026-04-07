# Phase 15: Service Extraction & API Auth - Validation

**Created:** 2026-04-06
**Framework:** Vitest 4.1.0
**Config:** vitest.config.ts

## Test Coverage Map

| Req ID | Behavior | Test File | Key Test Cases |
|--------|----------|-----------|----------------|
| AAUTH-01 | Create API key with label, returns raw key once | `src/__tests__/api-keys/create.test.ts` | vsl_ prefix, hashApiKey called, hash stored not raw key, max 3 enforced |
| AAUTH-02 | Revoke API key sets revoked_at | `src/__tests__/api-keys/revoke.test.ts` | revoked_at set, user_id check, already-revoked error |
| AAUTH-03 | Bearer token auth resolves to userId | `src/__tests__/api/auth.test.ts` | valid auth flow, missing header, non-Bearer scheme, invalid prefix, revoked key |
| AAUTH-04 | API key SHA-256 hashed before storage | `src/__tests__/api/auth.test.ts`, `src/__tests__/api-keys/create.test.ts` | hashApiKey called before DB lookup/insert |
| AAUTH-05 | Rate limiting returns 429 when exceeded | `src/__tests__/api/rate-limit.test.ts` | success returns limit/remaining, exceeded throws RateLimitError, tier-correct limiter |
| AAUTH-06 | API call deducts credits | `src/__tests__/api/credits.test.ts` | adminClient used when provided, falls back to createClient |

## Test Execution

### Quick run (specific plan)
```bash
# After Plan 01 (service + infra):
npx vitest run src/__tests__/api/auth.test.ts src/__tests__/api/rate-limit.test.ts src/__tests__/api/credits.test.ts src/__tests__/services/carousel.test.ts --reporter=verbose

# After Plan 01 Task 2 (API key CRUD + route):
npx vitest run src/__tests__/api-keys/create.test.ts src/__tests__/api-keys/revoke.test.ts --reporter=verbose
```

### Full suite
```bash
npx vitest run --reporter=verbose
```

### Phase gate
All tests green before `/gsd-verify-work`:
```bash
npx vitest run src/__tests__/api-keys/ src/__tests__/api/ src/__tests__/services/carousel.test.ts --reporter=verbose
```

## Wave 0 Test Files (created by Plan 15-00)

- [x] `src/__tests__/api-keys/create.test.ts` -- AAUTH-01, AAUTH-04
- [x] `src/__tests__/api-keys/revoke.test.ts` -- AAUTH-02
- [x] `src/__tests__/api/auth.test.ts` -- AAUTH-03, AAUTH-04
- [x] `src/__tests__/api/rate-limit.test.ts` -- AAUTH-05
- [x] `src/__tests__/api/credits.test.ts` -- AAUTH-06
- [x] `src/__tests__/services/carousel.test.ts` -- service extraction correctness

## Sampling Strategy

| Event | Command | Expected |
|-------|---------|----------|
| Per task commit | `npx vitest run --reporter=verbose` | Relevant tests pass |
| Per wave merge | `npx vitest run` | Full suite green |
| Phase gate | Full suite + tsc --noEmit | Zero failures, zero type errors |

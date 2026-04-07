---
phase: 15-service-extraction-api-auth
plan: 01
subsystem: api
tags: [api-keys, sha-256, bearer-auth, upstash, rate-limiting, service-extraction, nanoid]

# Dependency graph
requires:
  - phase: 14-alignment-snap-guides
    provides: completed v1.3 milestone, stable Server Actions
provides:
  - Extracted generateCarouselService shared service layer
  - SHA-256 API key hashing utility (Web Crypto)
  - Bearer token authentication at route-handler level
  - Upstash Redis tiered rate limiting (10/30/60 per minute)
  - Structured API error responses (ApiError, RateLimitError)
  - API key CRUD Server Actions (create/list/revoke)
  - POST /api/v1/carousel one-shot generation endpoint
  - api_keys Supabase table with RLS
affects: [15-02-api-keys-ui, 16-rest-api-endpoints, 17-mcp-server]

# Tech tracking
tech-stack:
  added: ["@upstash/ratelimit@^2.0.8", "@upstash/redis@^1.37.0", "nanoid@^5.1.7"]
  patterns: ["service-extraction (thin Server Action wrapper)", "route-handler auth (CVE-2025-29927)", "tiered rate limiting", "structured API errors"]

key-files:
  created:
    - src/lib/services/carousel.ts
    - src/lib/crypto/hash.ts
    - src/lib/api/auth.ts
    - src/lib/api/errors.ts
    - src/lib/api/rate-limit.ts
    - src/lib/api/types.ts
    - src/app/(dashboard)/settings/api-keys/actions.ts
    - src/app/api/v1/carousel/route.ts
    - supabase/migrations/20260407000000_api_keys.sql
  modified:
    - src/lib/credits/check-credits.ts
    - src/app/(dashboard)/project/[id]/actions.ts
    - package.json

key-decisions:
  - "Auth in route handler not middleware per CVE-2025-29927"
  - "deductCredit/getCreditBalance accept optional adminClient for API route compatibility"
  - "Rate limit by keyId not userId so multi-key users get proportional throughput"

patterns-established:
  - "Service extraction: business logic in lib/services/, Server Actions as thin wrappers"
  - "API auth pipeline: authenticateApiKey -> checkRateLimit -> validate -> service"
  - "Structured errors: { error: { code, message } } with correct HTTP status codes"

requirements-completed: [AAUTH-01, AAUTH-03, AAUTH-04, AAUTH-05, AAUTH-06]

# Metrics
duration: 15min
completed: 2026-04-07
---

# Phase 15 Plan 01: Service Extraction & API Auth Summary

**Extracted carousel service layer, built SHA-256 API key auth with Upstash Redis rate limiting, and wired POST /api/v1/carousel endpoint**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-07T16:14:02Z
- **Completed:** 2026-04-07T16:29:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Extracted all generateCarousel business logic into generateCarouselService, making Server Action a thin wrapper (auth + service + revalidate)
- Built complete API auth pipeline: Bearer token extraction, SHA-256 hash lookup, tier-based Upstash Redis rate limiting (free=10, plus=30, pro=60 per minute)
- Created API key CRUD (create with nanoid+SHA-256, list masked, revoke soft-delete, max 3 per user)
- Wired POST /api/v1/carousel with full pipeline: auth -> rate limit -> Zod validate -> auto-create project -> generate -> respond with rate limit headers

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps, create DB migration, build service + API infra layer** - `41c17d0` (feat)
2. **Task 2: API key CRUD Server Actions and POST /api/v1/carousel route** - `2336bcb` (feat)

## Files Created/Modified
- `src/lib/services/carousel.ts` - Extracted generateCarousel business logic (no auth, no revalidation)
- `src/lib/crypto/hash.ts` - SHA-256 hashing via Web Crypto API
- `src/lib/api/auth.ts` - Bearer token authentication at route-handler level
- `src/lib/api/errors.ts` - ApiError, RateLimitError with structured JSON responses and Retry-After header
- `src/lib/api/rate-limit.ts` - Upstash Redis sliding window rate limiting with tier configs
- `src/lib/api/types.ts` - ApiKeyAuth and ApiKeyRecord interfaces
- `src/app/(dashboard)/settings/api-keys/actions.ts` - createApiKey, listApiKeys, revokeApiKey Server Actions
- `src/app/api/v1/carousel/route.ts` - POST /api/v1/carousel with CORS and OPTIONS handler
- `supabase/migrations/20260407000000_api_keys.sql` - api_keys table with RLS and hash index
- `src/lib/credits/check-credits.ts` - Added optional adminClient param to deductCredit and getCreditBalance
- `src/app/(dashboard)/project/[id]/actions.ts` - Refactored to thin wrapper calling generateCarouselService
- `package.json` - Added @upstash/ratelimit, @upstash/redis, nanoid

## Decisions Made
- Auth in route handler (not middleware) per CVE-2025-29927 security finding
- Added optional `adminClient` parameter to `deductCredit` and `getCreditBalance` for backward compatibility -- existing callers unchanged
- Rate limiting by `keyId` not `userId` so users with multiple keys get proportional throughput (capped at 3x tier limit)
- CORS headers on all API responses for cross-origin usage

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration.** Upstash Redis is required for rate limiting:
- `UPSTASH_REDIS_REST_URL` - From Upstash Console -> Create Redis Database -> REST URL
- `UPSTASH_REDIS_REST_TOKEN` - From Upstash Console -> Create Redis Database -> REST Token
- Create a free Redis database at https://console.upstash.com

## Next Phase Readiness
- Service layer and API auth pipeline complete, ready for Phase 15-02 (API Keys settings UI)
- All API infrastructure (auth, rate-limit, errors) ready for Phase 16 (REST API Endpoints)
- Upstash Redis env vars must be configured before rate limiting works in production

## Self-Check: PASSED

All 9 created files verified present. Both task commit hashes (41c17d0, 2336bcb) verified in git log.

---
*Phase: 15-service-extraction-api-auth*
*Completed: 2026-04-07*

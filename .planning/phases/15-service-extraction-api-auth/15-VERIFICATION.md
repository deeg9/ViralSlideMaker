---
phase: 15-service-extraction-api-auth
verified: 2026-04-06T00:00:00Z
status: gaps_found
score: 3/5 must-haves verified
re_verification: null
gaps:
  - truth: "API requests exceeding tier rate limit receive a 429 response with retry-after information"
    status: failed
    reason: "@upstash/ratelimit and @upstash/redis are declared in package.json but not installed in node_modules. TypeScript reports 'Cannot find module @upstash/ratelimit' and 'Cannot find module @upstash/redis'. The rate-limit.ts module cannot be compiled or loaded at runtime."
    artifacts:
      - path: "src/lib/api/rate-limit.ts"
        issue: "Imports @upstash/ratelimit and @upstash/redis, neither is installed (confirmed via node_modules check and tsc error)"
      - path: "src/app/api/v1/carousel/route.ts"
        issue: "Calls checkRateLimit which depends on uninstalled packages — rate limiting pipeline is non-functional"
    missing:
      - "Run npm install to install @upstash/ratelimit@^2.0.8 and @upstash/redis@^1.37.0"

  - truth: "Developer can navigate to Settings > API Keys tab and see a list of their keys (or empty state)"
    status: failed
    reason: "The create-key-dialog.tsx and revoke-key-dialog.tsx import from 'sonner' which is not installed. TypeScript confirms 'Cannot find module sonner'. The API Keys page will fail to compile and render."
    artifacts:
      - path: "src/app/(dashboard)/settings/api-keys/create-key-dialog.tsx"
        issue: "Imports toast from 'sonner' — package not installed in node_modules"
      - path: "src/app/(dashboard)/settings/api-keys/revoke-key-dialog.tsx"
        issue: "Imports toast from 'sonner' — package not installed in node_modules"
      - path: "src/components/ui/sonner.tsx"
        issue: "Imports from 'next-themes' and 'sonner' — neither installed"
    missing:
      - "Run npm install to install sonner (and next-themes if needed for sonner.tsx)"
---

# Phase 15: Service Extraction & API Auth Verification Report

**Phase Goal:** Developers can create and manage API keys that authenticate requests with rate limiting and credit deduction
**Verified:** 2026-04-06
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Developer can generate an API key from account settings and sees the key exactly once at creation time | VERIFIED | `src/app/(dashboard)/settings/api-keys/actions.ts` exports `createApiKey` with nanoid+SHA-256; `create-key-dialog.tsx` shows key once with copy button and prevents accidental dismissal |
| 2 | Developer can view a list of their API keys (masked) and revoke any key, immediately blocking further requests with that key | VERIFIED | `listApiKeys()` returns prefix-only (no key_hash); `revokeApiKey()` sets `revoked_at`; `api-key-list.tsx` shows revoked rows at opacity-50 with Revoked badge |
| 3 | An API request with a valid Bearer token authenticates successfully; an invalid or revoked token returns 401 | VERIFIED | `src/lib/api/auth.ts` extracts Bearer token, validates `vsl_` prefix, hashes with SHA-256, looks up via admin client, checks `revoked_at IS NULL`, throws `ApiError('UNAUTHORIZED')` on failure; `apiError()` returns structured 401 JSON |
| 4 | API requests exceeding the per-key rate limit receive a 429 response with retry-after information | FAILED | `src/lib/api/rate-limit.ts` is correctly implemented with sliding window config (free=10, plus=30, pro=60/min), but `@upstash/ratelimit` and `@upstash/redis` packages are NOT installed in node_modules. TypeScript reports import errors. Rate limiting is non-functional at runtime. |
| 5 | Each authenticated API request that consumes resources deducts credits from the developer's balance | VERIFIED | `generateCarouselService` calls `deductCredit(userId, ..., adminClient)` before AI generation; `check-credits.ts` accepts optional `adminClient` param; carousel route passes `{ adminClient }` to service |

**Score:** 3/5 truths verified

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/crypto/hash.ts` | VERIFIED | Exports `hashApiKey`, 7 lines, Web Crypto API SHA-256, substantive |
| `src/lib/api/auth.ts` | VERIFIED | Exports `authenticateApiKey`, Bearer extraction, vsl_ prefix check, hash lookup, tier resolution, last_used_at update |
| `src/lib/api/errors.ts` | VERIFIED | Exports `ApiError`, `RateLimitError`, `apiError`; Retry-After header on 429; structured { error: { code, message } } |
| `src/lib/api/rate-limit.ts` | STUB (missing deps) | Code is correct but @upstash/ratelimit and @upstash/redis not installed — module cannot load |
| `src/lib/api/types.ts` | VERIFIED | Exports `ApiKeyAuth`, `ApiKeyRecord` interfaces |
| `src/lib/services/carousel.ts` | VERIFIED | Exports `generateCarouselService`, full business logic extracted, no revalidatePath, accepts adminClient option, 191 lines |
| `src/app/(dashboard)/settings/api-keys/actions.ts` | VERIFIED | Exports `createApiKey`, `listApiKeys`, `revokeApiKey`; enforces max 3 keys; stores hash not raw key |
| `src/app/api/v1/carousel/route.ts` | WIRED (runtime blocked) | Correctly wires auth→rate-limit→validate→service pipeline; rate limiting will fail at runtime due to missing packages |
| `src/app/(dashboard)/settings/api-keys/page.tsx` | VERIFIED | Server component, calls listApiKeys, renders ApiKeyList and CreateKeyDialog |
| `src/app/(dashboard)/settings/api-keys/api-key-list.tsx` | VERIFIED | Table with masked prefix, revoked opacity-50, Revoked badge, empty state with CTA |
| `src/app/(dashboard)/settings/api-keys/create-key-dialog.tsx` | STUB (missing dep) | Logic correct but imports from 'sonner' which is not installed |
| `src/app/(dashboard)/settings/api-keys/revoke-key-dialog.tsx` | STUB (missing dep) | Logic correct but imports from 'sonner' which is not installed |
| `supabase/migrations/20260407000000_api_keys.sql` | VERIFIED | Creates api_keys table with key_hash, prefix, label, revoked_at; index on key_hash; RLS enabled |
| `src/lib/credits/check-credits.ts` | VERIFIED | `deductCredit` and `getCreditBalance` accept optional adminClient param; backward compatible |
| `src/app/(dashboard)/project/[id]/actions.ts` | VERIFIED | Thin wrapper: auth + rate-limit + service call + revalidatePath; generateCarouselService called with user.id |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/api/v1/carousel/route.ts` | `src/lib/api/auth.ts` | `authenticateApiKey(req)` | WIRED | Confirmed at line 39 |
| `src/app/api/v1/carousel/route.ts` | `src/lib/api/rate-limit.ts` | `checkRateLimit(keyId, tier)` | WIRED (runtime blocked) | Confirmed at line 42; blocked by missing npm packages |
| `src/app/api/v1/carousel/route.ts` | `src/lib/services/carousel.ts` | `generateCarouselService(userId, params)` | WIRED | Confirmed at line 68 |
| `src/app/(dashboard)/project/[id]/actions.ts` | `src/lib/services/carousel.ts` | `generateCarouselService(user.id, params)` | WIRED | Confirmed at lines 5, 26 |
| `src/lib/api/auth.ts` | `src/lib/crypto/hash.ts` | `hashApiKey(rawKey)` | WIRED | Confirmed at lines 3, 19 |
| `src/app/(dashboard)/settings/layout.tsx` | `/settings/api-keys` | `settingsNav` entry | WIRED | Confirmed at line 12 |
| `src/app/(dashboard)/settings/api-keys/page.tsx` | `actions.ts` | `listApiKeys()` | WIRED | Confirmed at line 7 |
| `src/app/(dashboard)/settings/api-keys/create-key-dialog.tsx` | `actions.ts` | `createApiKey(label)` | WIRED (compile error) | Correct import at line 24; blocked by missing sonner |
| `src/app/(dashboard)/settings/api-keys/revoke-key-dialog.tsx` | `actions.ts` | `revokeApiKey(keyId)` | WIRED (compile error) | Correct import at line 18; blocked by missing sonner |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `api-key-list.tsx` | `keys: ApiKeyItem[]` | `listApiKeys()` → Supabase admin client → api_keys table | Yes — DB query at `admin.from('api_keys').select(...)` | FLOWING |
| `page.tsx` | `keys` | `listApiKeys()` server action | Yes — fetches from DB, filters active count | FLOWING |
| `route.ts` | `auth`, `limit/remaining` | `authenticateApiKey` → DB; `checkRateLimit` → Upstash Redis | Auth flows from real DB; rate limit DISCONNECTED (packages not installed) | PARTIAL |

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| POST and OPTIONS handlers exported from carousel route | `grep -c "export async function POST\|OPTIONS" route.ts` | 2 | PASS |
| hashApiKey exported from hash.ts | File contains correct Web Crypto SHA-256 implementation | Confirmed, 7 lines | PASS |
| createApiKey stores hash not raw key | `grep "key_hash" actions.ts` | Line 43: inserts key_hash field | PASS |
| @upstash/ratelimit importable | `node -e "require('@upstash/ratelimit')"` | MODULE_NOT_FOUND | FAIL |
| sonner importable | `node -e "require('sonner')"` | MODULE_NOT_FOUND | FAIL |
| TypeScript compiles cleanly | `npx tsc --noEmit` | 27+ errors including missing module errors for @upstash/ratelimit, @upstash/redis, sonner | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AAUTH-01 | 15-00, 15-01, 15-02 | Developer can generate API keys from account settings | SATISFIED | createApiKey in actions.ts, CreateKeyDialog, Settings nav entry |
| AAUTH-02 | 15-00, 15-02 | Developer can revoke/delete API keys from settings | SATISFIED | revokeApiKey in actions.ts, RevokeKeyDialog with confirmation |
| AAUTH-03 | 15-00, 15-01 | API requests authenticate via Bearer token | SATISFIED (code) | authenticateApiKey validates Bearer token, vsl_ prefix, SHA-256 hash lookup, revoked_at check |
| AAUTH-04 | 15-00, 15-01 | API keys SHA-256 hashed in storage, shown once | SATISFIED | hashApiKey uses Web Crypto SHA-256; createApiKey stores key_hash not raw key; raw key returned once |
| AAUTH-05 | 15-00, 15-01 | API requests rate-limited via Upstash Redis | BLOCKED | rate-limit.ts code is correct but @upstash/ratelimit + @upstash/redis not installed |
| AAUTH-06 | 15-00, 15-01 | API calls deduct credits from developer balance | SATISFIED | deductCredit accepts adminClient; generateCarouselService deducts before AI call; carousel route passes adminClient |

Note: REQUIREMENTS.md traceability table still shows AAUTH-03/04/05/06 as "Pending" — documentation was not updated after implementation.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/api/rate-limit.ts` | 1-2 | Missing npm packages: `@upstash/ratelimit`, `@upstash/redis` declared in package.json but not in node_modules | BLOCKER | Rate limiting non-functional; TypeScript compilation fails for rate-limit.ts |
| `src/app/(dashboard)/settings/api-keys/create-key-dialog.tsx` | 23 | Missing npm package: `sonner` not installed | BLOCKER | Create dialog cannot compile; API Keys page will fail to render |
| `src/app/(dashboard)/settings/api-keys/revoke-key-dialog.tsx` | 17 | Missing npm package: `sonner` not installed | BLOCKER | Revoke dialog cannot compile |
| `src/components/ui/sonner.tsx` | 3-4 | Missing npm packages: `next-themes`, `sonner` | BLOCKER | Sonner component cannot compile |
| `src/__tests__/api/auth.test.ts` | 113,121,129,140 | TypeScript TS2554: Expected 2 arguments, got 3 | WARNING | Test-only; does not block production functionality |
| `src/__tests__/services/carousel.test.ts` | 91,138 | TypeScript TS2353: 'projectId' not in CarouselResult type | WARNING | Test-only; does not block production functionality |
| REQUIREMENTS.md | 15-18 | AAUTH-03/04/05/06 still marked `[ ]` (not checked), traceability table shows "Pending" | INFO | Documentation inconsistency only |

### Human Verification Required

#### 1. API Keys UI End-to-End Flow

**Test:** After running `npm install`, start `npm run dev` and navigate to `http://localhost:3000/settings/api-keys`
**Expected:** Empty state shows with "No API keys yet" heading, icon, body text, and "Create your first key" CTA
**Why human:** Visual layout and interactive flow (create → copy → revoke) cannot be verified programmatically

#### 2. Bearer Token Authentication Pipeline

**Test:** Create an API key via the UI, then run:
`curl -X POST http://localhost:3000/api/v1/carousel -H "Authorization: Bearer INVALID_KEY" -H "Content-Type: application/json" -d '{"topic":"test","templateId":"basic","slideCount":3}'`
**Expected:** Returns `{"error":{"code":"UNAUTHORIZED","message":"Invalid or revoked API key"}}` with HTTP 401
**Why human:** Requires running server and valid Supabase connection; can't test without live environment

#### 3. Upstash Rate Limiting (requires env vars)

**Test:** Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from Upstash Console, then send 11 rapid requests with a valid free-tier API key
**Expected:** First 10 succeed with X-RateLimit-Remaining headers counting down; 11th returns 429 with Retry-After header
**Why human:** Requires Upstash Redis credentials and live environment setup

### Gaps Summary

**Root cause: `npm install` was not run after adding packages to package.json.** The package.json correctly declares `@upstash/ratelimit@^2.0.8`, `@upstash/redis@^1.37.0`, and sonner (via shadcn), but node_modules does not contain them. This single fix resolves all compilation errors blocking the rate limiting pipeline and the API Keys UI.

**Two gaps blocking goal achievement:**

1. **Rate limiting non-functional** (AAUTH-05, SC-4): `@upstash/ratelimit` and `@upstash/redis` not installed. Running `npm install` in the project root should resolve this. After installation, Upstash Redis env vars (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) must also be configured for rate limiting to work in any environment.

2. **API Keys UI cannot compile** (AAUTH-01, AAUTH-02, SC-1, SC-2): `sonner` (and `next-themes` used by `src/components/ui/sonner.tsx`) not installed. Create dialog and revoke dialog import from sonner for toast notifications. Running `npm install` should resolve this as sonner is added by shadcn's package.json update.

All implementation logic is correct — the code implements the right patterns for SHA-256 hashing, Bearer auth, tiered rate limiting, credit deduction, and API key CRUD. This is purely a missing `npm install` step.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_

# Feature Research: Public REST API with Per-User API Keys

**Domain:** SaaS developer API platform (API key management + REST endpoints)
**Researched:** 2026-04-08
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features developers assume exist. Missing these = API feels amateur or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Create API key with name/label** | Every API dashboard (Stripe, OpenAI, Resend, Vercel) lets you name keys for identification. Developers manage multiple keys for different environments/services. | LOW | Simple form: name input + create button. Store SHA-256 hash, show full key once. `vsl_` prefix already defined in OpenAPI spec. |
| **Show key only once on creation** | Industry standard security pattern. Stripe, OpenAI, Vercel all do this. Prevents key exposure from dashboard screenshots or shoulder surfing. | LOW | Display key in a copy-to-clipboard modal immediately after creation. Never store or show plaintext again. |
| **Revoke/delete API key** | Developers need to invalidate compromised or unused keys immediately. Every API provider supports this. | LOW | Hard-delete with confirmation dialog. Takes effect immediately. No grace period needed at this scale. |
| **List all API keys with metadata** | Developers need to see which keys exist, when created, when last used. Resend shows last-used timestamps with color indicators. | LOW | Table: name, key prefix (`vsl_...abc`), created date, last used date. Existing settings layout provides the shell. |
| **Bearer token authentication** | `Authorization: Bearer vsl_...` is the universal pattern. Already defined in OpenAPI spec. Developers will not read docs if this doesn't work as expected. | MEDIUM | Middleware intercepts `/api/v1/*`, extracts Bearer token, SHA-256 hashes it, looks up in `api_keys` table, resolves user_id. Must bypass Supabase session auth for these routes. |
| **Consistent JSON error responses** | Structured `{ error: { code, message } }` format. Already defined in OpenAPI spec with codes like UNAUTHORIZED, RATE_LIMITED, VALIDATION_ERROR. Developers script against error codes, not messages. | LOW | Error codes already defined. Implement a shared error response helper used by all endpoints. |
| **Rate limiting with standard headers** | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` headers. Already in OpenAPI spec. Developers build retry logic around these. | MEDIUM | Upstash Redis rate limiting already mentioned as planned. Wire per API key with tier-based limits. Return headers on every response, not just 429s. |
| **Credit balance enforcement** | API calls that consume credits (carousel generation) must check balance and return 402 with INSUFFICIENT_CREDITS. Already defined in OpenAPI spec. | LOW | Reuse existing `deductCredit()` and `getCreditBalance()` RPC functions. Add `x-credits-remaining` and `x-credits-used` response headers as spec defines. |
| **OpenAPI spec + interactive docs** | Scalar playground already exists at /docs. Developers expect to test endpoints directly from docs. | LOW | Already built. Ensure spec stays in sync as endpoints are implemented. |
| **All 10 defined endpoints working** | The OpenAPI spec promises specific endpoints. If the spec exists but endpoints return 404, developers lose trust immediately. | HIGH | Bulk of the work: POST /carousel, GET/POST /projects, GET/DELETE /projects/:id, GET/PATCH /projects/:id/slides/:index, POST /projects/:id/render, GET /projects/:id/download, GET /projects/:id/download/:index. Most reuse existing server-side logic. |

### Differentiators (Competitive Advantage)

Features that elevate developer experience beyond table stakes. Not required for launch but add polish.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **API key usage analytics (request count, last used)** | Resend shows per-key request counts and last-used timestamps with color coding. Helps developers identify unused keys and monitor usage patterns. | LOW | Increment counter and update `last_used_at` on each authenticated request. Display in settings table. Low cost, high perceived value. |
| **Multiple API keys per user** | Developers use separate keys for dev/staging/prod or per-application. Stripe, OpenAI, Resend all support multiple keys. | LOW | Already implied by one-to-many user-to-keys data model. No extra work beyond allowing multiple creates. Cap at 5-10 keys per user. |
| **Copy-to-clipboard with confirmation** | Small UX detail but every good API dashboard has it. One click to copy key or code snippet. | LOW | Clipboard API with toast notification. |
| **Key prefix visibility in dashboard** | Show `vsl_...abc` (prefix + last 4 chars) so developers can identify which key is which without exposing the full key. | LOW | Store first 8 and last 4 characters as plaintext alongside the hash. |
| **Quick-start code snippets on creation** | After key creation, show copy-pasteable curl/JS/Python examples. Reduces time-to-first-request from minutes to seconds. | LOW | Static templates with key interpolation. Show on creation modal. |
| **"Try it" auth in Scalar docs** | Scalar playground can pre-fill Bearer token for authenticated testing directly in the docs UI. | LOW | Scalar supports auth configuration. Wire API key input into the playground header. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a product at this stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Scoped/restricted key permissions** | Stripe and OpenAI offer granular per-resource permissions (read-only, write-only, specific endpoints). | Massive complexity for a 10-endpoint API. Requires permission checks on every route, a permissions UI, and ongoing maintenance as endpoints evolve. Stripe has hundreds of endpoints -- ViralSlideMaker has 10. | All keys get full access. If needed later, add a simple "read-only" vs "full access" toggle (two levels, not per-endpoint). |
| **Test mode / sandbox keys** | Stripe has separate test and live environments with distinct keys. | Requires duplicating the entire data layer (test projects, test credits). Enormous scope for a product that doesn't handle money through its API. | Let developers use the API on the free tier. Free credits serve as the "sandbox." |
| **API key rotation with grace period** | Enterprise pattern where old and new keys overlap for a transition window. Paddle offers 60-minute reactivation. | Complex state management (two valid keys, expiry timers, notification system). Overkill when keys are self-service and instant to create. | Developer creates new key, updates their app, deletes old key. Manual rotation is fine at this scale. |
| **OAuth2 / JWT token exchange** | Some APIs offer OAuth flows for third-party integrations. | Orders of magnitude more complex than API keys. Requires authorization server, consent flows, token refresh. Only needed if third-party apps integrate on behalf of users. | Stick with API keys. Evaluate OAuth later only if third-party integration demand emerges. |
| **Per-endpoint rate limits** | Different rate limits for reads vs writes. | Complex configuration, confusing for developers, hard to communicate. The API has 10 endpoints. | Single rate limit per key based on subscription tier (e.g., 60/min free, 300/min plus, 1000/min pro). Simple and predictable. |
| **API versioning infrastructure** | Future-proofing with v1/v2 coexistence. | Maintaining two codepaths is expensive. Zero consumers exist to break. | Use `/api/v1/` prefix (already done). When v2 is needed, deprecate v1 with sunset timeline. Don't build v2 infrastructure now. |
| **Admin/organization-level keys** | OpenAI has org owners, project members, service accounts. | No multi-tenant or team features exist. Adding org structure just for API keys creates a half-built abstraction. | One user = one account = their API keys. Add team/org features as a separate milestone if demand emerges. |
| **Automatic key expiration** | Keys that auto-expire after 90 days. Enterprise compliance feature. | Requires expiry tracking, notification pipeline, re-authentication flows. | No expiration. Developers revoke keys manually when done. Add expiration only when enterprise customers demand it. |

## Feature Dependencies

```
[API keys table + RLS policies]
    |
    +--requires--> [Bearer token auth middleware]
    |                  |
    |                  +--requires--> [All 10 REST endpoints]
    |                  |                  |
    |                  |                  +--requires--> [Credit deduction for API calls]
    |                  |
    |                  +--requires--> [Rate limiting per key]
    |
    +--requires--> [API key management UI in settings]
                       |
                       +--enhances--> [Usage analytics per key]
                       +--enhances--> [Quick-start code snippets]

[Existing credit system] --reused-by--> [Credit deduction for API calls]
[Existing Supabase session auth] --bypassed-by--> [Bearer token auth middleware]
[Existing OpenAPI spec] --guides--> [All 10 REST endpoints]
[Existing Satori renderer] --reused-by--> [Render + download endpoints]
[Existing Scalar docs] --enhanced-by--> [Working endpoints]
```

### Dependency Notes

- **API keys table** is the foundation -- nothing else works without it. Must be created first with proper RLS policies so users can only see/manage their own keys.
- **Bearer token middleware** must bypass the existing Supabase session middleware for `/api/v1/*` routes. The current middleware (`src/middleware.ts`) redirects unauthenticated requests to `/login`, which would break API calls with 302 redirects instead of 401 JSON errors.
- **Credit deduction** reuses the existing `deductCredit()` Postgres RPC (`src/lib/credits/check-credits.ts`). No new credit logic needed -- just wire into generation endpoints.
- **Render/download endpoints** reuse existing server-side Satori/ImageResponse rendering. The API is a thin interface over existing capabilities.
- **Rate limiting** depends on knowing the API key (and therefore the user's tier) to set appropriate limits. Must resolve user before applying limits.
- **Settings UI** depends on the API keys table existing but is independent of the REST endpoints themselves.

## MVP Definition

### Launch With (v2.2)

Minimum viable API -- what's needed for developers to actually use the REST API.

- [ ] **API keys Supabase table** -- SHA-256 hashed keys, user_id FK, name, key_prefix, created_at, last_used_at, RLS policies
- [ ] **Create API key** -- server action generates `vsl_` prefixed key, returns plaintext once, stores hash
- [ ] **List API keys** in settings UI -- name, prefix, created date, last used
- [ ] **Revoke API key** with confirmation dialog
- [ ] **Bearer token auth middleware** -- intercepts `/api/v1/*`, hashes token, looks up key, resolves user
- [ ] **Middleware bypass** -- `/api/v1/*` routes skip Supabase session redirect, use Bearer auth instead
- [ ] **POST /carousel** -- AI content generation + image sourcing, costs 1 credit
- [ ] **GET /projects** -- list user's projects
- [ ] **POST /projects** -- create empty project
- [ ] **GET /projects/:id** -- get project with slides
- [ ] **DELETE /projects/:id** -- delete project
- [ ] **GET /projects/:id/slides/:index** -- get single slide
- [ ] **PATCH /projects/:id/slides/:index** -- update slide fields
- [ ] **POST /projects/:id/render** -- render all slides, return download URLs
- [ ] **GET /projects/:id/download** -- download all slides as ZIP
- [ ] **GET /projects/:id/download/:index** -- download single slide as PNG
- [ ] **Rate limiting per API key** via Upstash Redis, tier-based limits
- [ ] **Credit enforcement** on generation endpoints with 402 responses and credit headers
- [ ] **Consistent error responses** matching OpenAPI spec error schema

### Add After Validation (v2.x)

Features to add once real developers are using the API.

- [ ] **Usage analytics dashboard** -- per-key request counts, last-used color indicators -- add when API user count justifies the UI
- [ ] **Quick-start code snippets** -- curl/JS/Python examples on key creation and in docs -- add when developer onboarding friction is observed
- [ ] **Read-only key permission** -- simple toggle (full vs read-only) -- add when developers request it
- [ ] **API usage in credit history** -- show API-triggered deductions in existing usage history page with "API" badge

### Future Consideration (v3+)

- [ ] **Webhook notifications** -- for async generation if processing time increases -- defer until synchronous times become a problem
- [ ] **Team/org API keys** -- shared keys across team members -- defer until team features exist
- [ ] **API key expiration** -- auto-expire after configurable period -- defer until enterprise customers request compliance features
- [ ] **Official SDK packages** -- npm/pip wrappers for the REST API -- defer until API surface stabilizes and user count justifies maintenance

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| API keys table + RLS | HIGH | LOW | P1 |
| Create API key (UI + action) | HIGH | LOW | P1 |
| List/revoke API keys (UI) | HIGH | LOW | P1 |
| Bearer token auth middleware | HIGH | MEDIUM | P1 |
| Middleware bypass for /api/v1/* | HIGH | LOW | P1 |
| POST /carousel endpoint | HIGH | MEDIUM | P1 |
| Project CRUD endpoints (4) | HIGH | MEDIUM | P1 |
| Slide get/patch endpoints (2) | HIGH | LOW | P1 |
| Render endpoint | HIGH | MEDIUM | P1 |
| Download endpoints (2) | HIGH | MEDIUM | P1 |
| Rate limiting per key | HIGH | LOW | P1 |
| Credit enforcement + headers | HIGH | LOW | P1 |
| Error response helper | MEDIUM | LOW | P1 |
| Usage analytics per key | MEDIUM | LOW | P2 |
| Code snippets on creation | MEDIUM | LOW | P2 |
| Read-only key permission | LOW | MEDIUM | P3 |
| Webhook notifications | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.2 launch (API is non-functional without these)
- P2: Should have, add when developer feedback supports it
- P3: Nice to have, future consideration based on adoption

## Competitor Feature Analysis

| Feature | Stripe | OpenAI | Resend | Vercel | Our Approach |
|---------|--------|--------|--------|--------|--------------|
| Key prefix | `sk_live_`, `sk_test_` | `sk-proj-` | `re_` | `vercel_` | `vsl_` (already defined) |
| Show once | Yes (live keys) | Yes | Yes | Yes | Yes |
| Multiple keys | Yes | Yes (per project) | Yes | Yes | Yes (cap at 10) |
| Key naming | Restricted keys only | Yes | Yes | Yes | Yes |
| Permissions/scopes | Full, restricted per-resource | All, read-only, restricted | Full, sending-only | Account, team | Full access only (simplicity) |
| Test/live separation | Yes (core feature) | No | No | No | No (free tier = sandbox) |
| Last used indicator | No | No | Yes (color-coded) | No | Yes (timestamp) |
| Request count per key | No | Yes (usage page) | Yes (per key) | No | Defer to P2 |
| Rate limit headers | Yes | Yes | Yes | Yes | Yes (already in spec) |
| Interactive docs | Yes | Yes | Yes | Yes | Yes (Scalar already deployed) |
| Code snippets | Yes (per-language) | Yes | Yes | Yes | P2 (start with curl) |
| Credit/usage headers | N/A | N/A | N/A | N/A | Yes (`x-credits-remaining`, `x-credits-used`) |

## Sources

- [Stripe API Keys Documentation](https://docs.stripe.com/keys)
- [Stripe Restricted API Keys](https://docs.stripe.com/keys/restricted-api-keys)
- [Stripe API Key Best Practices](https://docs.stripe.com/keys-best-practices)
- [OpenAI Project Management](https://help.openai.com/en/articles/9186755-managing-your-work-in-the-api-platform-with-projects)
- [OpenAI API Key Permissions](https://help.openai.com/en/articles/8867743-assign-api-key-permissions)
- [OpenAI Authentication in 2025](https://www.datastudios.org/post/openai-authentication-in-2025-api-keys-service-accounts-and-secure-token-flows-for-developers-and)
- [Resend API Keys Introduction](https://resend.com/docs/dashboard/api-keys/introduction)
- [Vercel Tokens Documentation](https://vercel.com/docs/sign-in-with-vercel/tokens)
- [Vercel New Token Formats and Secret Scanning](https://vercel.com/changelog/new-token-formats-and-secret-scanning)
- [API Key Management Best Practices 2025](https://multitaskai.com/blog/api-key-management-best-practices/)
- [API Key Rotation Best Practices](https://www.peakhour.io/learning/application-security/api-key-management-best-practices/)
- [AI API Security Best Practices 2026](https://crazyrouter.com/en/blog/ai-api-security-best-practices-2026)
- Existing codebase: OpenAPI spec (`src/lib/api/openapi.ts`), credit system (`src/lib/credits/check-credits.ts`), middleware (`src/middleware.ts`, `src/lib/supabase/middleware.ts`), settings layout (`src/app/(dashboard)/settings/layout.tsx`)

---
*Feature research for: Public REST API with Per-User API Keys*
*Researched: 2026-04-08*

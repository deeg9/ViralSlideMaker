# Pitfalls Research

**Domain:** Adding REST API + MCP Server to existing Next.js SaaS on Vercel
**Researched:** 2026-04-06
**Confidence:** HIGH (verified against codebase, official docs, and multiple sources)

## Critical Pitfalls

### Pitfall 1: In-Memory Rate Limiter Does Not Work Across Serverless Instances

**What goes wrong:**
The existing `src/lib/rate-limit.ts` uses an in-memory `Map` for rate limiting. On Vercel, each serverless function invocation can run on a different instance. Two concurrent API requests from the same user may hit different instances, each with its own empty Map, bypassing rate limits entirely. With a public REST API, this becomes an abuse vector -- automated callers can burn through credits or hammer the render pipeline unchecked.

**Why it happens:**
In-memory state worked acceptably for the web UI where requests are infrequent and user-initiated. A public API with programmatic callers makes this a real exploit path.

**How to avoid:**
Replace the in-memory rate limiter with Upstash Redis (`@upstash/ratelimit`) before exposing public API endpoints. Upstash provides an edge-compatible, serverless-friendly rate limiter with sliding window support. The existing `rateLimitBucket` and `rateLimit` functions can keep their signatures -- just swap the backing store.

**Warning signs:**
- Credit balance dropping faster than expected for API users
- No 429 responses in logs despite heavy API traffic
- Multiple concurrent requests from same API key all succeeding

**Phase to address:**
Phase 1 (API Foundation) -- must be in place before any public endpoint goes live.

---

### Pitfall 2: Vercel Timeout Kills One-Shot Carousel Generation

**What goes wrong:**
The "one-shot" endpoint (topic in, carousel images out) chains: Gemini AI generation (2-8s) + Pexels image search (1-3s) + rendering N slides via Satori (2-5s each for 5-8 slides = 10-40s). Total: 13-51s. On Hobby plan (10s limit), this always fails. On Pro plan (60s limit with `maxDuration = 60`), it fails for larger carousels or when Gemini is slow.

**Why it happens:**
Each step is individually fast enough, but chaining them sequentially in one serverless invocation exceeds timeout limits. The existing render route already sets `maxDuration = 60`, indicating awareness of this constraint.

**How to avoid:**
Two strategies (use both):
1. **Async job pattern:** The one-shot endpoint returns a job ID immediately (`202 Accepted`), then processes in the background using Vercel's `waitUntil()` (Fluid Compute) or an external queue (Upstash QueueStash / Inngest). Client polls a `/api/v1/jobs/{id}` status endpoint.
2. **Render slides individually, not in batch:** The one-shot endpoint generates content + fetches images within timeout, saves the project, then returns slide render URLs that clients fetch individually from the existing render endpoint (which handles one slide at a time within timeout).

Option 2 is simpler and avoids new infrastructure. The "one-shot" endpoint generates content and returns a project with render URLs; it does not need to pre-render all images.

**Warning signs:**
- 504 Gateway Timeout errors in Vercel function logs
- One-shot endpoint works in dev (no timeout) but fails in production
- Works for 3-slide carousels but fails for 7+

**Phase to address:**
Phase 1 (API Foundation) -- the one-shot endpoint design must account for this from the start.

---

### Pitfall 3: MCP Server Using Deprecated SSE Transport on Serverless

**What goes wrong:**
The legacy MCP transport (HTTP+SSE, from the 2024-11-05 spec) requires persistent server connections. This is fundamentally incompatible with Vercel serverless -- the function terminates after responding, killing the SSE stream. Developers often copy MCP server examples that use the old SSE transport and wonder why it fails on Vercel.

**Why it happens:**
Many MCP tutorials and examples still show SSE transport. The protocol moved to Streamable HTTP (2025-03-26 spec) but awareness lags.

**How to avoid:**
Use Streamable HTTP transport exclusively. It works as standard request/response, which is natively compatible with Vercel serverless functions. The MCP server is just a Next.js API route at `/api/mcp` that handles POST requests. Use the official `@modelcontextprotocol/sdk` package with Streamable HTTP transport.

Key implementation detail: MCP with Streamable HTTP is essentially stateless request/response. Each tool call is an independent HTTP POST. This maps perfectly to serverless. Do NOT try to maintain session state across invocations.

**Warning signs:**
- MCP server works locally (stdio) but fails when deployed
- "Connection closed" errors from MCP clients
- Server starts but tools never respond

**Phase to address:**
Phase 2 (MCP Server) -- critical architectural decision at the start of MCP implementation.

---

### Pitfall 4: API Keys Stored in Plaintext in Database

**What goes wrong:**
Storing raw API keys in Supabase means a database breach (SQL injection, leaked credentials, Supabase dashboard access) exposes every user's API key. Since API keys grant access to credit-consuming operations, this is a direct financial exposure.

**Why it happens:**
It is simpler to store and lookup plaintext keys. Hashing adds complexity to the lookup flow since you cannot do `WHERE api_key = $1` on a hash.

**How to avoid:**
Use the prefix + hash pattern:
1. Generate key: `vsl_` prefix + 32 random bytes (base62 encoded)
2. Store: `prefix` (first 8 chars, for listing/identification) + `key_hash` (SHA-256 of full key)
3. Show the full key to the user exactly once at creation
4. On each API request: hash the provided key, lookup by hash
5. Index the `key_hash` column for fast lookups

This is the same pattern used by GitHub (`ghp_`), Stripe (`sk_`), and OpenAI (`sk-`). SHA-256 is sufficient since API keys have high entropy (unlike passwords).

**Warning signs:**
- A `SELECT * FROM api_keys` shows readable key values
- No hash column in the api_keys table schema
- Key lookup uses `WHERE key = $1` instead of `WHERE key_hash = $1`

**Phase to address:**
Phase 1 (API Foundation) -- API key table schema must be correct from the start. Migrating from plaintext to hashed keys after users have saved them is painful.

---

### Pitfall 5: Dual Auth Paths Create Authorization Bypass

**What goes wrong:**
The existing app uses Supabase cookie-based auth (via middleware). The new API uses Bearer token / API key auth. When both auth paths exist, it is easy to have routes that check one but not the other, or to have the middleware interfere with API key auth. The existing middleware runs on ALL routes (broad matcher) and calls `updateSession` -- this will fail or behave unexpectedly for API key requests that have no Supabase session.

**Why it happens:**
The middleware at `src/middleware.ts` runs a Supabase session update on every request except `/api/webhooks`. API routes using API key auth will hit this middleware, which tries to read/refresh a non-existent Supabase cookie session.

**How to avoid:**
1. Update `middleware.ts` to skip Supabase session handling for API routes (e.g., skip `/api/v1/*` paths, similar to how `/api/webhooks` is already skipped)
2. Create a dedicated `validateApiKey()` utility that API routes call directly
3. Never rely on middleware alone for auth (CVE-2025-29927 proved middleware can be bypassed via `x-middleware-subrequest` header, CVSS 9.1)
4. Create a shared `getAuthenticatedUser()` function that checks both auth methods and returns a normalized user object with `userId` and `authMethod` fields

**Warning signs:**
- API key requests returning 401 intermittently
- Supabase middleware errors in logs for API routes
- Routes that work with session auth but fail with API key auth (or vice versa)

**Phase to address:**
Phase 1 (API Foundation) -- the auth architecture must be decided before building any API endpoints.

---

### Pitfall 6: Credit Deduction Race Condition Under Concurrent API Calls

**What goes wrong:**
The existing credit system uses Postgres RPC (`deduct_credits`) which is atomic for a single call. But the check-then-deduct pattern (`checkCredits()` then `deductCredit()`) is NOT atomic across the two calls. With a public API, an automated client can fire 10 concurrent requests. All 10 check credits (balance: 5), all 10 see "allowed: true", then all 10 deduct -- resulting in a negative balance.

**Why it happens:**
The web UI naturally serializes requests (user clicks, waits for result). API clients do not. Checking `balance > 0` separately before calling `deductCredit()` creates a TOCTOU (time-of-check-time-of-use) race.

**How to avoid:**
The `deduct_credits` RPC must be the ONLY check. It should atomically check AND deduct in a single operation, returning false if insufficient balance. Do NOT call `checkCredits()` before `deductCredit()` in API routes -- just call `deductCredit()` and handle the false return. Verify the Postgres function uses `UPDATE ... WHERE balance >= amount RETURNING *` or equivalent single-statement atomicity.

**Warning signs:**
- Negative credit balances in the database
- Users getting more API calls than their credit balance should allow
- Credit balance inconsistencies between what users see and actual usage

**Phase to address:**
Phase 1 (API Foundation) -- verify and tighten the credit deduction flow before API launch.

---

### Pitfall 7: Exposing Internal Project Data Through API Responses

**What goes wrong:**
The existing project data model stores everything in one blob (`slide_data` JSONB). Returning this directly from the API leaks internal fields (user_id, internal IDs, potentially uploaded image URLs with signed tokens). API responses that mirror internal data structures are fragile -- any internal schema change breaks API consumers.

**Why it happens:**
It is fast to just `return project` from an API route. The web UI does not care about response shape since it is the same codebase. External API consumers are a different contract.

**How to avoid:**
Create explicit API response DTOs (Data Transfer Objects) that map internal models to stable, documented API shapes. Use a transform layer:
```typescript
function toApiProject(project: Project): ApiProjectResponse {
  return {
    id: project.id,
    title: project.title,
    slides: project.slide_data.map(toApiSlide),
    template_id: project.template_id,
    created_at: project.created_at,
    // Explicitly omit user_id, internal fields
  }
}
```

**Warning signs:**
- API responses contain `user_id` or other user-specific fields
- API schema changes when internal data model changes
- Signed URLs or internal storage paths visible in API responses

**Phase to address:**
Phase 1 (API Foundation) -- define API response shapes before building endpoints.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| In-memory rate limiter for API | No Redis dependency | Bypass under concurrent load | Never for public API; OK for internal/web UI only |
| Returning raw project objects from API | Fast to implement | Breaking changes leak to consumers, security exposure | Only in prototype/alpha, never in documented API |
| Single API route file with all endpoints | Quick to build | Unmaintainable 500+ line file | Never -- use route groups from day 1 |
| Skipping API versioning (`/api/v1/`) | One less URL segment | Cannot evolve API without breaking consumers | Never -- always version from the start |
| Using Supabase client auth for API routes | Reuses existing auth | API keys need different auth flow, breaks for non-browser clients | Never for public API |
| Hardcoding credit costs per endpoint | Simple, no config needed | Changing pricing requires code deploy | Acceptable for MVP; move to config/DB for production |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MCP + Vercel | Using SSE transport (requires persistent connection) | Use Streamable HTTP transport (stateless, serverless-compatible) |
| MCP + API Keys | Embedding API key in MCP server config as static credential | MCP server should accept dynamic credentials per-session via initialization params or header-based auth |
| Supabase + API Key Auth | Using `createClient()` (cookie-based) for API key routes | Use `createAdminClient()` or service role for API key-authenticated operations, after validating the API key yourself |
| Gemini API + One-Shot | Calling Gemini synchronously in a long request chain | Return job ID immediately; process Gemini call in background, or design the one-shot to return content without pre-rendering images |
| Pexels API + Bulk Requests | Hitting Pexels rate limit (200 req/hr) with concurrent API users | Cache Pexels results aggressively; pool requests; consider pre-fetching for common topics |
| Stripe + API Plans | Creating separate Stripe products for API vs web | Reuse existing subscription tiers, add API access as a feature flag on tiers |
| Next.js Middleware + API routes | Middleware applying Supabase session refresh to API key requests | Exclude `/api/v1/*` from middleware matcher, same as existing `/api/webhooks` exclusion |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering all slides synchronously in one-shot | Timeout for 5+ slide carousels | Return project + render URLs; client fetches renders individually | At 5+ slides (>30s total render time) |
| No caching on rendered slide images | Same slide re-rendered on every request | Cache rendered PNGs in Vercel Blob or Supabase Storage with content-hash key | At 10+ API users rendering similar content |
| Font loading on every render | Each render fetches Google Fonts over network | Bundle critical fonts as static assets or cache font buffers in memory/edge cache | At 50+ renders/minute |
| Supabase client creation per request | Connection overhead on every API call | Reuse admin client instance where possible; Supabase's built-in Supavisor handles connection pooling | At 100+ concurrent API requests |
| No pagination on project/slide list endpoints | Slow response, high memory for users with many projects | Default limit 20, max 100, cursor-based pagination | At 50+ projects per user |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API keys in query params | Keys logged in server logs, browser history, CDN logs | Always use `Authorization: Bearer <key>` header |
| No API key rotation/revocation | Compromised key has unlimited lifetime | Support multiple active keys per user + revocation endpoint |
| Middleware as sole auth check | CVE-2025-29927 bypass (CVSS 9.1) -- attacker sends `x-middleware-subrequest` header to skip middleware entirely | Always validate auth in route handler, not just middleware |
| Returning detailed error messages | Internal paths, stack traces leak to API consumers | Use generic error codes with documentation; log details server-side only |
| No request body size limit | Large payloads can DOS serverless functions | Validate content-length; reject bodies over 1MB |
| API key with full account access | Stolen key allows account changes, not just carousel creation | Scope API keys to specific permissions (read, create, render) |
| MCP server without input validation | Malicious AI agents send crafted inputs (prompt injection via tool arguments) | Validate and sanitize all MCP tool inputs; do not trust tool arguments as safe |
| No CORS on API routes | Cross-origin requests blocked for legitimate API consumers | Return proper CORS headers (`Access-Control-Allow-Origin`, etc.) on `/api/v1/*` routes |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No API key management UI | Users must contact support to manage keys | Build a dashboard page for key creation, listing (showing prefix only), revocation |
| Unclear credit costs in API docs | Users surprised by credit deductions | Document credit cost per endpoint prominently; return `x-credits-remaining` in response headers |
| No usage dashboard for API | Users cannot see how credits are being consumed | API usage page with per-endpoint breakdown and daily/weekly graphs |
| MCP server with no error context | AI agents get opaque failures, cannot self-correct | Return descriptive error messages in MCP tool responses (e.g., "Insufficient credits. Balance: 2, required: 5") |
| API returns image URLs that expire | Clients store URLs that stop working after signed URL expiry | Use stable, long-lived URLs or clearly document TTL in response |
| No API playground or examples | Developers cannot try the API without writing code | Provide curl examples in docs; consider a simple web-based API playground |

## "Looks Done But Isn't" Checklist

- [ ] **API Key Auth:** Often missing key rotation, revocation, and listing endpoints -- verify all CRUD operations exist
- [ ] **Rate Limiting:** Often per-IP only, missing per-API-key limits -- verify both layers exist
- [ ] **Error Responses:** Often inconsistent shape across endpoints -- verify all errors use same `{ error: { code, message } }` format
- [ ] **Credit Deduction:** Often missing idempotency -- verify duplicate requests with same idempotency key do not double-charge
- [ ] **MCP Server:** Often tested only with one client (Claude Desktop) -- verify with at least 2 MCP clients (Claude Code, Cursor, etc.)
- [ ] **API Versioning:** Often present in URL but not in response -- verify `x-api-version` header in responses
- [ ] **CORS:** Often missing for API routes -- verify API routes return proper CORS headers for cross-origin requests
- [ ] **One-Shot Endpoint:** Often "works" but returns partial results on timeout -- verify graceful handling when Gemini is slow
- [ ] **Webhook/callback support:** Often forgotten -- verify consumers can get notified when async jobs complete, not just poll
- [ ] **API docs:** Often incomplete -- verify every endpoint has request/response examples and error codes documented

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Plaintext API keys in DB | MEDIUM | Generate new hashed keys for all users, invalidate old ones, notify users to update |
| No API versioning | HIGH | Introduce `/v2/` alongside unversioned routes, deprecation period, client migration |
| In-memory rate limiter exploited | LOW | Swap to Redis-backed limiter, no API change needed |
| Credit race condition (negative balances) | MEDIUM | Fix RPC, audit and correct negative balances, add monitoring alert |
| Leaked internal data in API responses | MEDIUM | Add DTO layer, publish API schema change as minor version bump |
| SSE-based MCP server deployed | LOW | Rewrite transport layer to Streamable HTTP, same tool definitions reused |
| Middleware auth bypass exploited | HIGH | Patch Next.js immediately, add route-level auth checks, audit access logs |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| In-memory rate limiter | Phase 1: API Foundation | Load test with 50 concurrent requests; verify 429s are consistent |
| Vercel timeout on one-shot | Phase 1: API Foundation | Test one-shot with 8-slide carousel on Pro plan; verify no 504 |
| SSE transport on MCP | Phase 2: MCP Server | Deploy to Vercel; verify tool calls work from Claude Code |
| Plaintext API keys | Phase 1: API Foundation | `SELECT * FROM api_keys` shows only hash and prefix, no raw key |
| Dual auth bypass | Phase 1: API Foundation | Test API route with no cookie and valid API key; test with invalid key |
| Credit race condition | Phase 1: API Foundation | Fire 20 concurrent requests with balance of 5; verify exactly 5 succeed |
| Internal data leakage | Phase 1: API Foundation | Review all API response bodies; no `user_id` or internal fields |
| MCP tested with one client only | Phase 2: MCP Server | Test with Claude Code AND at least one other MCP client |

## Sources

- [Vercel function timeout documentation](https://vercel.com/docs/functions/configuring-functions/duration)
- [Vercel function limits](https://vercel.com/docs/limits)
- [MCP specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25)
- [Why MCP deprecated SSE for Streamable HTTP](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [Building efficient MCP servers on Vercel](https://vercel.com/blog/building-efficient-mcp-servers)
- [Building Streamable HTTP MCP server for Vercel serverless](https://dev.to/rafsilva85/building-a-streamable-http-mcp-server-from-stdio-to-vercel-serverless-497o)
- [MCP security risks and controls (Red Hat)](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls)
- [MCP production growing pains (The New Stack)](https://thenewstack.io/model-context-protocol-roadmap-2026/)
- [MCP auth spec updates (Auth0)](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
- [API key management best practices](https://oneuptime.com/blog/post/2026-02-20-api-key-management-best-practices/view)
- [Best practices for building secure API keys (freeCodeCamp)](https://www.freecodecamp.org/news/best-practices-for-building-api-keys-97c26eabfea9/)
- [Next.js security guide 2025 (TurboStarter)](https://www.turbostarter.dev/blog/complete-nextjs-security-guide-2025-authentication-api-protection-and-best-practices)
- [Next.js security best practices 2026 (Authgear)](https://www.authgear.com/post/nextjs-security-best-practices) -- CVE-2025-29927 middleware bypass
- Codebase analysis: `src/lib/rate-limit.ts`, `src/lib/credits/check-credits.ts`, `src/middleware.ts`, `src/app/api/render/route.ts`

---
*Pitfalls research for: REST API + MCP Server addition to existing Next.js SaaS on Vercel*
*Researched: 2026-04-06*

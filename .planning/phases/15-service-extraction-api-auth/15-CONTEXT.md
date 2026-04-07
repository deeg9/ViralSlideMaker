# Phase 15: Service Extraction & API Auth - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract core business logic from Server Actions into a shared service layer, build API key management with SHA-256 hashed storage, implement Bearer token auth middleware, replace in-memory rate limiter with Upstash Redis, and wire credit deduction for API calls.

</domain>

<decisions>
## Implementation Decisions

### Service Extraction Scope
- Extract `generateCarousel` + credit functions first — they're the core API surface
- Shared service layer lives at `src/lib/services/carousel.ts` alongside existing `src/lib/credits/`
- Server Actions remain as thin wrappers calling services — adds only auth + revalidation — keeps web UI working identically
- Editor actions (slide edit, image swap) deferred to Phase 16 — keep Phase 15 focused on auth + one-shot

### API Key Management
- API key management UI lives as a new tab in existing `/settings` page — consistent with brand-kit/profile/subscription tabs
- Key format: `vsl_` prefix + 32 random chars (nanoid) — matches Stripe/GitHub pattern
- Max 3 keys per user — covers dev/staging/prod use cases
- Required label on creation ("Production", "Dev") — helps users identify keys

### Rate Limiting & Auth Middleware
- Tiered rate limits: Free 10 req/min, Plus 30 req/min, Pro 60 req/min
- 429 response with `Retry-After` header + JSON body `{ error: { code, message }, retryAfter }`
- Auth validation at route-handler level (not Next.js middleware) — per CVE-2025-29927 security finding
- Structured API error format: `{ error: { code: string, message: string } }` — matches OpenAI/Stripe pattern

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/credits/check-credits.ts` — `deductCredit()`, `checkCredits()`, `getUserTier()`, `getCreditBalance()` via Supabase RPC
- `src/lib/rate-limit.ts` — in-memory rate limiter (to be replaced with Upstash Redis)
- `src/lib/supabase/admin.ts` — admin client for API key lookups (bypasses RLS)
- `src/app/(dashboard)/settings/` — existing settings pages (brand-kit, credits, subscription, profile)

### Established Patterns
- Server Actions in `actions.ts` files with `'use server'` directive
- Supabase RPC for atomic database operations (e.g., `deduct_credits`)
- Rate limiting via function call before expensive operations
- Auth via `supabase.auth.getUser()` in Server Actions

### Integration Points
- New `/settings/api-keys` tab in settings layout
- New `api_keys` Supabase table (id, user_id, key_hash, prefix, label, created_at, last_used_at, revoked_at)
- New `/api/v1/` route namespace in Next.js App Router
- Upstash Redis environment variables (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)

</code_context>

<specifics>
## Specific Ideas

- Research recommended `mcp-handler` (Vercel official) for future MCP integration — service layer design should anticipate this
- API keys shown exactly once on creation — modal with copy button, then only masked `vsl_****...abcd`
- Upstash Redis free tier (10K req/day) sufficient for launch

</specifics>

<deferred>
## Deferred Ideas

- Editor action extraction (Phase 16)
- MCP server integration (Phase 17)
- OpenAPI spec generation (Phase 18)

</deferred>

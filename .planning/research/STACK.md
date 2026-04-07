# Stack Research

**Domain:** REST API + MCP Server additions to existing Next.js carousel creator
**Researched:** 2026-04-06
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `mcp-handler` (Vercel) | ^1.1.0 | MCP server hosted as Next.js route handler | Official Vercel adapter -- runs MCP server inside Next.js app routes with zero infra changes. Supports Streamable HTTP transport, built-in `withMcpAuth` for API key validation. Deploys alongside existing app on Vercel. |
| `@modelcontextprotocol/sdk` | ^1.29.0 | MCP protocol implementation (peer dep of mcp-handler) | Official TypeScript SDK. v1.x is production-stable; v2 anticipated but v1.x will receive fixes for 6+ months after. Use >= 1.26.0 (security fix). |
| `zod` | ^4.3.6 (already installed) | Schema validation for API inputs and MCP tool schemas | Already in project. MCP SDK requires zod as peer dependency. Use for all API request validation -- single validation library across REST + MCP. |
| Next.js Route Handlers | 15.5.x (already installed) | REST API endpoints | Already using Next.js 15. API routes at `app/api/v1/*/route.ts` give full REST API with no additional framework. No need for Express or Hono. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@upstash/ratelimit` | ^2.0.8 | API rate limiting per key | Serverless-native rate limiter using Upstash Redis. Connectionless (HTTP-based), works perfectly on Vercel. Use for per-API-key request throttling (e.g., 60 req/min). |
| `@upstash/redis` | ^1.34.x | Redis client for rate limiter | Required peer dependency of @upstash/ratelimit. Also useful for caching API responses and MCP session state if needed. |
| `nanoid` | ^5.x | API key generation | Generates URL-safe, cryptographically random IDs. Use for creating API keys like `vsl_` prefixed tokens. Lightweight, no crypto overhead debates. |
| `crypto` (Node built-in) | N/A | API key hashing | Hash API keys with SHA-256 before storing in Supabase. Store hash, compare on auth. Never store raw keys. Node built-in, no package needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| MCP Inspector | Test MCP server locally | `npx @anthropic-ai/mcp-inspector` -- browser-based tool to connect to your MCP server and test tools interactively. Essential for development. |
| `curl` / `httpie` | REST API testing | Standard API testing. Write a `.http` file or shell scripts for common API calls. |
| Vitest (already installed) | API route unit/integration tests | Already in devDependencies. Test route handlers by importing and calling them directly with mock Request objects. |

## Existing Stack (No Changes Needed)

These are already in the project and will be reused by the new API layer:

| Technology | Role in API |
|------------|-------------|
| Supabase Auth + Postgres | Store API keys table, credit ledger (existing), user accounts |
| Stripe | API-plan subscriptions and credit purchases (extend existing) |
| Gemini 2.5 Flash (`@google/genai`) | Content generation -- called by both web UI and API |
| Satori + Sharp (server-side rendering) | Image rendering -- called by both web UI and API |
| Pexels SDK | Stock photo search -- exposed as API endpoint |

## Architecture: Where Things Live

```
app/
  api/
    v1/                          # REST API (new)
      carousels/route.ts         # POST: one-shot generation
      carousels/[id]/route.ts    # GET: status/result
      generate/route.ts          # POST: content generation only
      render/route.ts            # POST: render slides to images
      download/[id]/route.ts     # GET: download images/ZIP
      keys/route.ts              # POST/GET: manage API keys
    mcp/
      [transport]/route.ts       # MCP server (new) -- single dynamic route
    render/route.ts              # Existing render endpoint
    webhooks/                    # Existing Stripe webhooks
```

**Key architectural decision:** The MCP server is a thin wrapper over the REST API. MCP tools call the same service functions that REST endpoints use. This means:
- One set of business logic, two interfaces
- API key auth works for both REST and MCP (via `withMcpAuth`)
- Credit deduction happens in the shared service layer

## API Key Auth Design

**Self-managed API keys stored in Supabase** -- not Unkey, not Clerk.

Why self-managed:
- Already have Supabase Postgres -- adding an `api_keys` table is trivial
- No additional SaaS dependency or cost
- Full control over key format, permissions, rate limits
- Credit metering already exists in Supabase (atomic Postgres RPC)
- Unkey adds $25+/mo cost for a feature that is approximately 100 lines of code

Implementation:
1. Generate key: `vsl_` + `nanoid(32)` = `vsl_abc123...`
2. Hash with SHA-256 before storing in `api_keys` table
3. Show raw key to user exactly once on creation
4. On each request: hash incoming key, lookup in `api_keys`, verify active + user association
5. Middleware pattern: extract from `Authorization: Bearer vsl_...` header

```sql
-- api_keys table
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,  -- first 8 chars for display: "vsl_abc1..."
  name text not null,
  created_at timestamptz default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint active_key check (revoked_at is null or revoked_at > created_at)
);

create index idx_api_keys_hash on api_keys(key_hash) where revoked_at is null;
```

## Credit Metering for API

Reuse existing credit system with API-specific extensions:

| Operation | Credit Cost | Notes |
|-----------|-------------|-------|
| One-shot carousel generation | 1 credit | Same as web UI generation |
| Content generation only | 0.5 credit | AI call only, no rendering |
| Render slides | 0.5 credit | Rendering only, no AI |
| Image search/swap | 0 credits | Pexels is free |
| Download | 0 credits | Already rendered |

Credit check happens in the shared service layer before any expensive operation. Uses existing Postgres RPC for atomic deduction.

## Rate Limiting Strategy

**Two tiers of rate limiting:**

1. **Per-key request throttling** (Upstash): 60 req/min default, configurable per plan
2. **Credit-based usage limits** (existing Postgres): Monthly credit allowance per subscription tier

Upstash Redis is the right choice because:
- Serverless-native (HTTP-based, no persistent connections)
- Works on Vercel without connection pooling issues
- Sliding window algorithm built-in
- Free tier: 10K requests/day (more than enough for launch)

## Installation

```bash
# New dependencies for API + MCP
npm install mcp-handler @modelcontextprotocol/sdk@^1.29.0 @upstash/ratelimit @upstash/redis nanoid

# No new dev dependencies needed -- Vitest already installed
```

**Total new dependencies: 5** (mcp-handler, @modelcontextprotocol/sdk, @upstash/ratelimit, @upstash/redis, nanoid)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `mcp-handler` (Vercel) | Raw `@modelcontextprotocol/sdk` with custom HTTP transport | If you need SSE transport or are not on Vercel. mcp-handler abstracts transport negotiation. |
| Self-managed API keys in Supabase | Unkey | If you have 1000+ API consumers and need advanced key analytics, geographic restrictions, or usage dashboards. Not worth the cost at launch. |
| Self-managed API keys in Supabase | Clerk API keys | If you were already using Clerk for auth. You use Supabase Auth -- adding Clerk would be a second auth system. |
| `@upstash/ratelimit` | In-memory rate limiting | Never in serverless. Vercel functions are stateless -- in-memory maps reset on every cold start. |
| `@upstash/ratelimit` | Supabase Postgres for rate limiting | If you want zero additional services. But Postgres row locks for rate limiting adds latency and connection pressure. Redis is purpose-built for this. |
| Next.js Route Handlers | Separate Express/Fastify API server | If API traffic is 10x web traffic and needs independent scaling. Premature for launch. Keep it in one deployment. |
| `nanoid` | `uuid` | If you need standard UUIDs. nanoid produces shorter, URL-safe tokens better suited for API keys. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Separate API server (Express, Fastify, Hono) | Adds deployment complexity, separate hosting costs, CORS config. Next.js route handlers are sufficient. | Next.js Route Handlers at `app/api/v1/` |
| `@modelcontextprotocol/sdk` directly without `mcp-handler` | You would need to manually handle HTTP transport, session management, and request routing. mcp-handler does this. | `mcp-handler` wrapping the SDK |
| Unkey / third-party key management | Unnecessary cost and dependency for a feature that is approximately 100 lines of code with Supabase. | Self-managed keys in Supabase `api_keys` table |
| In-memory rate limiting | Stateless serverless functions. Rate limit state vanishes on cold starts. | `@upstash/ratelimit` with Redis |
| GraphQL | REST is simpler for this use case (CRUD on carousels + imperative actions). MCP tools are already RPC-style. GraphQL adds schema complexity for no benefit. | REST endpoints with Zod validation |
| tRPC | Already have Zod for validation. tRPC's main benefit (type-safe client) does not help external API consumers who use curl/fetch. | Plain Route Handlers + Zod schemas |
| API versioning via headers | URL-based versioning (`/api/v1/`) is clearer for external developers and easier to route. | URL path versioning: `/api/v1/carousels` |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `mcp-handler@^1.1.0` | `@modelcontextprotocol/sdk@>=1.26.0` | mcp-handler pins SDK as peer dep. Must use >= 1.26.0 for security. |
| `@modelcontextprotocol/sdk@^1.29.0` | `zod@>=3.25.0` | SDK imports from zod/v4 but backwards-compatible with zod v3.25+. Project has zod ^4.3.6 which is fine. |
| `@upstash/ratelimit@^2.0.8` | `@upstash/redis@^1.34.0` | Ratelimit requires Upstash Redis client as peer. |
| `mcp-handler@^1.1.0` | `next@>=14.0.0` | Works with Next.js 14+ route handlers. Project has 15.5.x. |
| `nanoid@^5.x` | ESM only | nanoid v5 is ESM-only. Next.js 15 supports ESM fine. |

## Environment Variables (New)

```bash
# Upstash Redis (for rate limiting)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...

# API config
API_KEY_SALT=<random-string-for-additional-hash-salting>
```

No other new env vars needed. Supabase, Stripe, Pexels, Gemini keys already configured.

## MCP Server Setup Pattern

The MCP server lives at `app/api/mcp/[transport]/route.ts` using Vercel's `mcp-handler`:

```typescript
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const handler = createMcpHandler(
  (server) => {
    server.registerTool("create_carousel", {
      title: "Create Carousel",
      description: "Generate a carousel from a topic prompt",
      inputSchema: { topic: z.string(), num_slides: z.number().int().min(3).max(10).optional() },
    }, async ({ topic, num_slides }) => {
      // Call shared service layer (same as REST endpoint)
      const result = await carouselService.createFromTopic(topic, { numSlides: num_slides });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });

    // ... more tools wrapping REST service functions
  },
  {},
  { basePath: "/api/mcp", maxDuration: 60 }
);

export { handler as GET, handler as POST };
```

Auth is added via `withMcpAuth` wrapper that validates the Bearer token as an API key against Supabase.

## Sources

- [Vercel mcp-handler GitHub](https://github.com/vercel/mcp-handler) -- v1.1.0 setup, withMcpAuth pattern, route structure (HIGH confidence)
- [Vercel MCP deployment docs](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel) -- Vercel-specific deployment guidance (HIGH confidence)
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.29.0 current, zod peer dep (HIGH confidence)
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- transport options, server patterns (HIGH confidence)
- [@upstash/ratelimit npm](https://www.npmjs.com/package/@upstash/ratelimit) -- v2.0.8, serverless rate limiting (HIGH confidence)
- [Unkey Next.js docs](https://www.unkey.com/docs/quickstart/apis/nextjs) -- evaluated and rejected for this project (MEDIUM confidence)
- [mcp-handler AUTHORIZATION.md](https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md) -- API key auth via withMcpAuth (HIGH confidence)

---
*Stack research for: REST API + MCP Server additions to TikTok Slideshow Creator v2.0*
*Researched: 2026-04-06*

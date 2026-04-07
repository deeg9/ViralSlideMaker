# Feature Landscape

**Domain:** REST API & MCP Server for AI Carousel Generation Platform
**Researched:** 2026-04-06

## Table Stakes

Features developers and AI agents expect. Missing = platform feels incomplete or unusable.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| One-shot carousel endpoint | Core value prop -- topic in, images out. Every AI generation API has a single-call option (OpenAI, Replicate, etc.) | Medium | Existing `generateCarousel` server action, render pipeline | Wraps existing logic: generate content, fetch images, render PNGs, return ZIP/URLs. `POST /api/v1/carousels` |
| API key authentication | Industry standard for programmatic access. Every developer platform uses API keys for M2M auth | Medium | Supabase (new `api_keys` table), crypto for key generation | Prefix keys with `vsm_` for easy identification. Hash stored keys (SHA-256). Support multiple keys per user |
| Credit deduction on API calls | Existing credit system must gate API usage identically to web UI. Users will game any gap | Low | Existing `deductCredit` RPC, credit ledger | Reuse `deduct_credits` Postgres RPC. Add `api_carousel_generation` to `CreditTransactionType` |
| Rate limiting per API key | Every public API rate-limits. Without it, a single user can DOS the service | Low | Existing `rateLimitBucket` utility | Tier-based: free=5/min, plus=20/min, pro=60/min. Return `X-RateLimit-Remaining`, `X-RateLimit-Limit`, `X-RateLimit-Reset` headers |
| JSON error responses with HTTP status codes | Developers expect structured errors, not HTML error pages or vague messages | Low | None | `{ "error": { "code": "insufficient_credits", "message": "..." } }` with appropriate 4xx/5xx codes |
| Credit balance endpoint | Developers need to check remaining credits before making expensive generation calls | Low | Existing `getCreditBalance` | `GET /api/v1/credits` -- trivial to build, high utility |
| OpenAPI/Swagger spec | Non-negotiable in 2026 for any developer-facing API. AI agents use machine-readable schemas to understand what endpoints do | Medium | Authored alongside endpoints | Maintain as YAML. Use Scalar for hosted interactive docs |
| MCP server with `generate_carousel` tool | Primary reason for this milestone -- AI agents (Claude Code, OpenAI agents) need to call carousel generation via MCP protocol | Medium | REST API (MCP wraps it), `@modelcontextprotocol/sdk` | Thin wrapper: MCP tool validates params then calls REST endpoint. Use stdio transport for local, Streamable HTTP for remote |
| Versioned API path (`/api/v1/`) | Breaking changes happen. Without versioning from day one, migration is painful for every consumer | Low | None | URL-based versioning is simplest and most widely understood |
| Render and download endpoint | The whole point -- users and agents need the actual PNG files back | Low | Existing `/api/render` route already renders individual slides | Extend existing render endpoint to accept API key auth. Add bulk download (ZIP) endpoint |

## Differentiators

Features that set the platform apart. Not expected, but create competitive advantage or developer delight.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Granular slide editing endpoints | Most AI generation APIs are one-shot-only black boxes. Exposing edit operations (swap image, change text, restyle individual slides) lets agents iterate on output -- a unique capability | High | All editor actions need API equivalents | `PATCH /api/v1/projects/:id/slides/:index` for text/style changes, `PUT .../slides/:index/background` for image swap. Large surface area but high value |
| MCP Resources for project data | Expose projects and slides as MCP Resources so agents can read carousel state naturally, without needing separate API calls | Low | MCP server, project read logic | `resource://projects/{id}` returns project JSON, `resource://projects/{id}/slides` returns slide array |
| MCP Prompts for common workflows | Pre-built prompt templates guide agents toward good results. Reduces trial-and-error for agent developers | Low | MCP server | 2-3 prompts: `create_carousel` (topic + style), `edit_carousel` (project ID + instructions), `regenerate_slide` (slide index + feedback) |
| Template listing endpoint | Agents need to discover available visual styles to make informed template choices, not guess template IDs | Low | Existing template registry in code | `GET /api/v1/templates` returns IDs, names, and preview thumbnail URLs |
| Project CRUD via API | Full project lifecycle management -- create, list, get, delete. Lets agents manage a workspace of carousels | Medium | Existing Supabase project queries | Standard REST: `POST/GET/GET:id/DELETE /api/v1/projects` |
| Webhook notifications | Push notification when async generation completes. Superior to polling for integrations and automation pipelines | Medium | New webhook registration table, delivery queue with retry | Not needed for v1 if one-shot generation completes in <30s synchronously. Add when batch operations or longer AI image generation arrive |
| Batch generation endpoint | Generate multiple carousels in one API call. Valuable for agencies and automation workflows | Medium | Queue/job system, async status tracking | `POST /api/v1/batch/carousels` returns job ID, poll `GET /api/v1/jobs/:id` for status. Defer to v2.1 |
| TypeScript SDK / client library | Typed client makes integration frictionless. Every mature platform (OpenAI, Stripe, Replicate) ships an SDK | Medium | Stable API surface | Auto-generate from OpenAPI spec with codegen tooling. Ship as npm package `@viralsidemaker/sdk` |
| Interactive API playground | Let developers test endpoints in-browser without writing code first | Low | OpenAPI spec file | Scalar (free, modern, good DX) reads the OpenAPI spec and generates a try-it UI automatically |
| Usage analytics dashboard | Show API consumers their call history, credit burn rate, and top endpoints. Builds trust and reduces support burden | Medium | Logging API calls to a table | Track every API call: endpoint, status, credits consumed, latency. Surface in settings page |

## Anti-Features

Features to explicitly NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| OAuth 2.0 / third-party auth flows | Massive complexity (token exchange, refresh flows, scopes, consent screens) for a platform with zero third-party integrations today. API keys are the right tool for M2M auth at this scale | API keys with `vsm_` prefix + SHA-256 hashing. Revisit OAuth only if a marketplace or partner integration model emerges |
| Real-time streaming of generation progress | Generation takes 5-15 seconds. Building SSE/WebSocket infrastructure for progress updates adds significant complexity with minimal user value for this duration | Return synchronous response. The one-shot endpoint blocks until generation completes. If generation gets slower (AI images), switch to async job + polling |
| GraphQL API | REST is simpler, more widely understood by AI agents, and sufficient for this resource model. GraphQL adds schema complexity, client library requirements, and caching headaches | REST with well-designed resource endpoints. The data model (projects containing slides) is flat enough that REST handles it cleanly |
| Public API without authentication | "Free API access without keys" invites abuse and bot scraping. Every generation call costs money (Gemini API, Pexels, server compute) | All API access requires an API key. Free tier users get API keys but are limited to their existing 3 credits/month |
| Image hosting / CDN for rendered PNGs | Serving and storing rendered images indefinitely is expensive and creates an unbounded storage liability | Return PNG binary directly in response, or short-lived signed URLs (1-24 hours). Consumers store images in their own infrastructure |
| Multi-user / team API keys | Organizational key management (teams, roles, permissions) is complex. The audience is solo creators and individual developers | One user account = one set of API keys sharing the same credit pool. Team features are a separate milestone |
| Separate API-only pricing tiers | Maintaining two distinct pricing models (web subscriptions vs API plans) creates confusion, billing edge cases, and support burden | API uses the exact same subscription tiers (free/plus/pro) and credit pool. An API key is just another interface to spend the same credits |
| Auto-posting to social platforms | Frequently requested, but TikTok/Instagram OAuth is complex, rate-limited, and fragile. Different product category | Return downloadable images. Users or their automation tools handle posting. Suggest Zapier/Make integrations in docs |

## Feature Dependencies

```
API Key Auth system
  |
  v
Rate Limiting (per API key) -----> All API Endpoints
  |                                    ^
Credit Balance Check ----------------/
  |
  v
One-Shot Carousel Endpoint
  |-- wraps: existing generateCarousel() server action
  |-- calls: Gemini 2.5 Flash (content), Pexels (images), render pipeline (PNGs)
  |-- deducts: 1 credit via existing deduct_credits RPC
  |-- returns: project ID + slide data + download URLs
  |
  v
Render / Download Endpoints
  |-- extends: existing /api/render route (add API key auth path)
  |-- adds: bulk ZIP download endpoint
  |
  v
Template Listing + Credit Balance (lightweight reads, no dependencies beyond auth)
  |
  v
Granular Edit Endpoints (requires project to exist)
  |-- PATCH slides/:index (text, style)
  |-- PUT slides/:index/background (image swap)
  |-- POST slides (add slide)
  |-- DELETE slides/:index (remove slide)
  |
  v
MCP Server (wraps all REST endpoints)
  |-- Tools: generate_carousel, edit_slide, list_templates, render_slides
  |-- Resources: project data, slide data
  |-- Prompts: create_carousel, edit_carousel
  |
  v
OpenAPI Spec + Docs (document stable surface last)
```

## MVP Recommendation

Build in this order (each step depends on the previous):

1. **API Key Auth system** -- everything depends on it. New `api_keys` table in Supabase (id, user_id, key_hash, prefix, name, created_at, last_used_at, revoked_at). Key generation endpoint in settings. Middleware that validates `Authorization: Bearer vsm_...` header, resolves to user_id
2. **One-shot carousel endpoint** -- `POST /api/v1/carousels` accepting `{ topic, template_id, slide_count, image_source }`. Wraps existing `generateCarousel` logic. Returns `{ project_id, title, slides: [...], download_url }`. This IS the product
3. **Credit deduction + rate limiting** -- Extend existing credit system with `api_carousel_generation` transaction type. Apply `rateLimitBucket` keyed on API key. Return `X-RateLimit-*` headers on every response
4. **Credit balance + template listing** -- Two lightweight GET endpoints. `GET /api/v1/credits` and `GET /api/v1/templates`. High utility for agents deciding what to generate
5. **Render/download endpoints** -- Extend existing `/api/render` to accept API key auth. Add `GET /api/v1/projects/:id/download` for ZIP of all slides
6. **MCP server** -- Thin wrapper over REST endpoints using `@modelcontextprotocol/sdk`. Start with `generate_carousel` tool + `list_templates` tool. Add project resources. Use stdio transport (npm package for local use)
7. **OpenAPI spec + interactive docs** -- Document the now-stable API surface. Host with Scalar for free interactive playground
8. **Granular edit endpoints** -- `PATCH /api/v1/projects/:id/slides/:index` for text/style, image swap. Largest surface area, build after core proves valuable

Defer to next iteration:
- **Webhook notifications**: Only valuable with async/batch operations
- **Batch generation**: Agency use case, not solo creator MVP
- **TypeScript SDK**: Auto-generate from OpenAPI once API is stable
- **Usage analytics dashboard**: Build when there are actual API consumers to serve

## Sources

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- official SDK for tools, resources, prompts
- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/) -- server architecture guidance
- [MCP 2026 Roadmap](http://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) -- Streamable HTTP transport, .well-known discovery
- [Build an MCP Server](https://modelcontextprotocol.io/docs/develop/build-server) -- official implementation guide
- [API Credits Billing for Startups](https://colorwhistle.com/api-credits-billing-tech-startups/) -- credit metering patterns
- [OpenAI Rate Limits](https://developers.openai.com/api/docs/guides/rate-limits) -- rate limit header conventions
- [Scalar](https://scalar.com/) -- free OpenAPI documentation and interactive playground
- [API Key vs JWT for SaaS](https://www.scalekit.com/blog/apikey-jwt-comparison) -- authentication pattern comparison
- [Asynchronous AI: Event Callbacks](https://hookdeck.com/blog/asynchronous-ai) -- async generation patterns
- [RESTful API Design Best Practices 2026](https://dasroot.net/posts/2026/01/restful-api-design-best-practices-2026/) -- versioning, pagination, error handling

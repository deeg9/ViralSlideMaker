# Pitfalls Research: MCP Server (v2.3)

**Domain:** Adding MCP server to existing Next.js 15 SaaS with REST API
**Researched:** 2026-04-08
**Confidence:** MEDIUM-HIGH (MCP spec verified, Next.js patterns verified, tool design evidence from multiple production deployments)

---

## Critical Pitfalls

### Pitfall 1: Wrapping REST Endpoints 1:1 as MCP Tools (Operation-Oriented Design)

**What goes wrong:**
The existing REST API has 10 endpoints (carousel, projects CRUD, slides, templates, render, download). The natural instinct is to create one MCP tool per endpoint -- `create_project`, `list_projects`, `get_project`, `update_project`, `delete_project`, `get_templates`, `get_slide`, `update_slide`, `render_project`, `download_project`. This produces 10 tools that force the LLM to orchestrate multi-step workflows: "create carousel" becomes create_project + wait + render_project + download_project. Research shows models fail at tool selection with 20+ tools and degrade noticeably above 10. More critically, multi-step chains compound failure -- if each step has 90% success, a 4-step chain drops to 65%.

Block rebuilt their Linear MCP server from 30+ tools to 2. GitHub Copilot cut from 40 to 13 and saw measurable benchmark improvements. Speakeasy found perfect task success at 10 tools but complete failure at 107.

**Why it happens:**
Developers map MCP tools from existing API structure rather than from user outcomes. The REST API was designed for programmatic clients that handle orchestration; MCP tools are consumed by LLMs that work best with outcome-oriented, self-contained operations.

**How to avoid:**
Design 4 outcome-oriented tools as already planned in PROJECT.md:
1. `create_carousel` -- topic in, project ID + slide count out (wraps carousel + render internally)
2. `list_templates` -- returns available templates with descriptions
3. `edit_slide` -- modify a specific slide's text, image, or style
4. `render_carousel` -- trigger render and return download URL

Each tool should complete a full user outcome in one call. The `create_carousel` tool should internally call the carousel service, wait for generation, and return a ready result -- not require the LLM to chain multiple calls.

**Warning signs:**
- Tool count exceeding 6
- Tools that return IDs the LLM must pass to subsequent tools
- Tool descriptions that say "first call X, then call Y"
- LLMs calling tools in wrong order or skipping steps

**Phase to address:**
Phase 1 -- tool schema design, before any implementation.

---

### Pitfall 2: Serverless Function Timeout on Long-Running Carousel Generation

**What goes wrong:**
The `create_carousel` tool wraps `generateCarousel` which calls Gemini AI for content generation, Pexels API for images, and potentially server-side rendering. This chain can take 15-45 seconds. Vercel serverless functions default to 10 seconds on Hobby and 60 seconds on Pro. The existing REST endpoint already sets `maxDuration = 60`. But MCP Streamable HTTP adds protocol overhead -- the MCP SDK must parse the JSON-RPC request, invoke the tool handler, and serialize the response. If the tool handler itself takes 50+ seconds, the total request can exceed the function timeout.

Additionally, Vercel's Fluid compute model means the function may be cold-started, adding 2-5 seconds.

**Why it happens:**
MCP tool calls are synchronous request-response over Streamable HTTP. Unlike the REST API where the client controls retry logic, an MCP client (Claude Desktop, Cursor) expects a response within a reasonable timeframe. There is no built-in progress notification in a stateless Streamable HTTP setup.

**How to avoid:**
- Set `maxDuration = 60` on the MCP route handler (matching the carousel endpoint)
- Keep `create_carousel` as the only long-running tool; `list_templates`, `edit_slide`, and `render_carousel` should complete in under 5 seconds
- Return progress information in the tool response (e.g., "Generated 7 slides, project ID: xyz, render in progress")
- For Vercel Pro: configure function concurrency to avoid cold starts on the MCP endpoint
- Consider an async pattern: `create_carousel` returns immediately with a project ID, and a separate `get_project_status` tool polls -- but this adds tool count and complexity, so only do this if timeouts become a real problem

**Warning signs:**
- MCP clients showing "tool call timed out" errors
- Intermittent failures on carousel creation but not on simpler tools
- Cold start + generation time exceeding 60 seconds

**Phase to address:**
Phase 2 -- implementation. Set maxDuration early, test with real Gemini API calls.

---

### Pitfall 3: Auth Model Mismatch -- MCP Session vs Bearer Token

**What goes wrong:**
The existing REST API uses `withApiAuth` which extracts a Bearer token from the `Authorization` header, validates it against the `api_keys` table (SHA-256 hash lookup), and provides `userId`, `keyId`, `supabase`, and `creditBalance` to the handler. MCP's Streamable HTTP transport passes auth differently depending on the client:

1. **Claude Desktop / Cursor**: These clients configure auth in their MCP server config (usually a Bearer token in headers). The token arrives in the `Authorization` header on every request -- this works with the existing `withApiAuth` pattern.
2. **MCP spec OAuth 2.1 flow**: The MCP spec defines a full OAuth 2.1 authorization flow with PKCE, resource indicators, and dynamic client registration. Implementing this is massive overkill for this project and most MCP clients do not use it.
3. **stdio transport**: No HTTP headers at all -- the token must be passed as an environment variable or constructor argument.

The pitfall is either over-engineering (implementing full OAuth 2.1) or under-engineering (not handling the Bearer token extraction at the transport layer).

**Why it happens:**
The MCP spec's authorization section describes OAuth 2.1 as the standard, which can mislead developers into thinking they need a full OAuth server. In practice, most MCP clients pass a static Bearer token. The existing `withApiAuth` middleware is designed for Next.js route handlers (`NextRequest` -> `NextResponse`), not for MCP SDK tool handlers.

**How to avoid:**
- For Streamable HTTP: Extract the Bearer token at the route handler level (before passing to the MCP SDK transport), validate it using the existing `authenticateApiKey` function, and pass `userId`/`keyId` into the MCP server context
- Do NOT implement OAuth 2.1 -- use the existing `vsl_` API key system. Users create an API key in settings and paste it into their Claude Desktop / Cursor config
- For stdio transport: Accept the API key as a constructor argument or environment variable (`VSL_API_KEY`), and pass it in the MCP server context
- Create a thin auth adapter that bridges `withApiAuth` logic to MCP context without coupling to `NextRequest`/`NextResponse`

**Warning signs:**
- Building an OAuth 2.1 server for MCP auth
- MCP tool handlers directly calling `authenticateApiKey` with request objects
- stdio transport has no auth mechanism
- Rate limiting not applied to MCP requests

**Phase to address:**
Phase 1 -- design the auth bridge before implementing tools.

---

### Pitfall 4: Streamable HTTP Session State in Serverless

**What goes wrong:**
The MCP SDK's `StreamableHTTPServerTransport` maintains session state (session ID, transport instance) in an in-memory Map. On Vercel serverless, each invocation may hit a different function instance. If a client sends request 1 to instance A (which creates session "abc123"), then request 2 hits instance B, the session is not found. The server returns a 404 or creates a new session, breaking the conversation.

**Why it happens:**
The MCP TypeScript SDK examples show `new Map<string, StreamableHTTPServerTransport>()` as session storage, which works in long-running Node.js processes but fails in serverless environments where instances are ephemeral and not shared.

**How to avoid:**
Use **stateless mode**. The MCP SDK supports setting `sessionIdGenerator: undefined` on `StreamableHTTPServerTransport`, which disables session tracking entirely. Each request is independent. This is the correct approach for serverless deployments because:
- The existing REST API is already stateless (each request carries its own Bearer token)
- MCP tools wrap stateless REST operations
- No server-side conversation state is needed -- the MCP client maintains context
- Vercel's `mcp-handler` library defaults to stateless for this reason

If stateful sessions are needed later (e.g., for server-initiated notifications), use Redis-backed session storage via Upstash (already in the project for rate limiting).

**Warning signs:**
- Using `new Map()` for session storage in a Vercel-deployed route handler
- Clients getting "session not found" errors on second tool call
- Setting `sessionIdGenerator` to a UUID function without external storage

**Phase to address:**
Phase 1 -- transport configuration. Explicitly set stateless mode from the start.

---

### Pitfall 5: Tool Description Quality -- Vague or Missing Context

**What goes wrong:**
Research shows 97.1% of MCP tool descriptions contain at least one quality issue, with over half having unclear purpose statements. Poor descriptions cause the LLM to: (a) select the wrong tool, (b) pass wrong parameters, (c) not use available tools at all. For a 4-tool server this matters less than a 30-tool server, but bad descriptions on `edit_slide` (the most complex tool with many parameters) will cause constant failures.

**Why it happens:**
Developers write tool descriptions as API documentation ("Updates a slide's properties") rather than as LLM instructions ("Change the text, image, or style of a specific slide in a carousel project. Use this after create_carousel to modify individual slides before rendering.").

**How to avoid:**
Each tool description must include:
1. **What it does** in one sentence using the user's vocabulary
2. **When to use it** -- what user intent maps to this tool
3. **What it returns** -- so the LLM knows what to expect
4. **When NOT to use it** -- disambiguate from similar tools

For parameters, include:
- `description` on every property in the Zod schema
- Enum values with explanations, not just the value list
- Example values where format is non-obvious (e.g., "projectId: a UUID like '550e8400-e29b-41d4-a716-446655440000'")

Test with Claude Desktop: ask it to "make me a carousel about productivity tips" and observe whether it selects the right tools and passes correct parameters without guidance.

**Warning signs:**
- Tool descriptions under 20 words
- Parameter schemas without `description` fields
- LLM asking "which tool should I use?" when intent is clear
- LLM passing `templateId: "default"` instead of a real template ID

**Phase to address:**
Phase 1 -- tool schema design. Iterate descriptions based on testing.

---

### Pitfall 6: stdio Transport npm Package Build and Packaging Errors

**What goes wrong:**
The stdio transport is packaged as a separate npm package so users can run `npx viral-slide-mcp` in their Claude Desktop config. Common packaging mistakes:
1. Missing shebang (`#!/usr/bin/env node`) -- the binary is not executable on Unix
2. `bin` entry pointing to TypeScript source instead of compiled JS
3. `files` array not including the built output
4. Package importing from the Next.js app's internal modules (tight coupling)
5. `type: "module"` mismatch -- ESM package but `npx` invocation expects CJS, or vice versa
6. Missing `prepublishOnly` build script -- publishing unbuilt source

**Why it happens:**
The stdio transport is a separate package concern layered on top of a Next.js monorepo. Next.js projects are not set up for npm package publishing. The build tooling (Next.js compiler, Turbopack) is optimized for web bundles, not standalone Node.js CLI binaries.

**How to avoid:**
- Create a separate directory (e.g., `packages/mcp-stdio/`) with its own `package.json`, `tsconfig.json`, and build script
- Use `tsup` or `esbuild` to bundle into a single CJS file with shebang prepended
- The stdio package should import ZERO code from the Next.js app -- it should be a thin wrapper that creates an MCP server with the same tool definitions and makes HTTP calls to the deployed REST API (or directly calls service functions if extracted)
- Test with `npx` locally before publishing: `npm pack && npx ./viral-slide-mcp-1.0.0.tgz`
- Verify on both macOS and Linux (file permissions, shebang parsing)

**Warning signs:**
- `npx viral-slide-mcp` fails with "permission denied" or "not found"
- Package size > 5MB (bundled node_modules instead of tree-shaken)
- Import errors referencing `@/lib/` paths from the Next.js app
- Works with `node packages/mcp-stdio/dist/index.js` but not with `npx`

**Phase to address:**
Phase 3 -- stdio packaging, after the Streamable HTTP server works.

---

### Pitfall 7: MCP Route Conflicting with Next.js Middleware

**What goes wrong:**
The existing `middleware.ts` skips session auth for `/api/v1` routes and `/api/webhooks`. If the MCP endpoint is at `/api/mcp`, it will pass through the Supabase `updateSession` middleware, which tries to refresh the session cookie. This fails because MCP clients send Bearer tokens, not session cookies. The middleware may return a redirect to the login page or modify response headers in unexpected ways.

**Why it happens:**
The middleware matcher catches all routes except static assets. New API routes must be explicitly excluded.

**How to avoid:**
Add `/api/mcp` to the middleware skip list:

```typescript
if (request.nextUrl.pathname.startsWith('/api/mcp')) {
  return
}
```

This is a one-line fix but easy to forget. The MCP endpoint will silently fail with confusing auth errors if missed.

**Warning signs:**
- MCP client gets 307 redirect responses
- Response includes `set-cookie` headers for Supabase session
- Auth works in local dev (no middleware) but fails in production

**Phase to address:**
Phase 2 -- first thing when creating the route handler.

---

### Pitfall 8: Credit Deduction Without Idempotency on MCP Retries

**What goes wrong:**
MCP clients may retry failed requests (network timeout, connection drop). If `create_carousel` deducts credits in the tool handler and the response is lost but the operation succeeded, the client retries, deducting credits again. The user is charged twice for one carousel.

The existing REST API has the same theoretical issue, but REST clients typically handle retries at the application level with idempotency keys. MCP clients (Claude Desktop, Cursor) handle retries automatically and opaquely.

**Why it happens:**
The `deductCreditAdmin` function is called inside the tool handler without an idempotency mechanism. MCP's Streamable HTTP transport does not have built-in idempotency semantics.

**How to avoid:**
- Use the project ID as a natural idempotency key: before deducting credits, check if a project with this generation's fingerprint already exists
- Alternatively, deduct credits optimistically and refund on duplicate detection
- For the MVP, this is an acceptable risk if carousel generation is cheap (1 credit). Document it as a known limitation and add idempotency in a follow-up
- If implementing idempotency: accept an optional `request_id` parameter in `create_carousel` and check against recent completions

**Warning signs:**
- Users reporting double credit deductions
- MCP client logs showing retried tool calls
- Credit balance dropping faster than expected

**Phase to address:**
Phase 2 for awareness, Phase 4 (post-launch hardening) for full idempotency. Acceptable technical debt for MVP.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Stateless MCP (no session persistence) | Works on serverless, simple to implement | Cannot use server-initiated notifications or sampling | Always for this project -- no need for server push |
| Bearer token auth instead of OAuth 2.1 | Reuses existing API key system, zero new infrastructure | Not spec-compliant for third-party MCP client discovery | Until third-party client adoption requires OAuth |
| stdio package makes HTTP calls to deployed API | Clean separation, no shared code coupling | Adds network latency, requires deployed API to be available | MVP -- revisit if latency is unacceptable |
| No idempotency on credit deduction | Simpler tool handler | Double charges on retries | MVP at 1 credit/operation -- fix before scaling |
| Tool descriptions hardcoded in route handler | Fast iteration | Must redeploy to change descriptions | Always -- descriptions change rarely after stabilization |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `@modelcontextprotocol/sdk` | Using < v1.26.0 which has security vulnerabilities | Pin to >= 1.26.0. Check for v2 stable release. |
| Vercel `mcp-handler` | Placing route handler at wrong path (must match `basePath` config) | Route at `app/api/[transport]/route.ts` or `app/api/mcp/route.ts` depending on adapter |
| Claude Desktop config | Providing wrong URL format or missing trailing path | URL must be the full endpoint: `https://yourapp.com/api/mcp` with Bearer token in headers |
| Cursor MCP config | Using stdio config format for HTTP server or vice versa | Separate configs: HTTP uses `url` + `headers`, stdio uses `command` + `args` |
| Upstash rate limiting | Not applying rate limits to MCP endpoint (only on `/api/v1`) | Extract rate limiting logic from `withApiAuth` and apply to MCP auth bridge |
| Next.js middleware | Not skipping `/api/mcp` route | Add skip condition before `updateSession` call |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Cold start + AI generation chain | First MCP call after idle takes 50+ seconds | Enable Vercel Fluid compute, pre-warm with health check | After 15 min idle on Hobby plan |
| Tool response too large (full project JSON) | Context window bloat in MCP client, slow response | Return summary fields only (project ID, slide count, status), not full slide data | Projects with 15+ slides and custom elements |
| No connection pooling for Supabase in MCP handler | New Supabase client per request (already the pattern with `createAdminClient`) | Acceptable for current scale. Use connection pooler URL if hitting Supabase connection limits | 100+ concurrent MCP users |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Token passthrough (passing MCP client's token to downstream APIs without validation) | Impersonation, unauthorized access | Validate every Bearer token against `api_keys` table with SHA-256 hash lookup -- reuse existing `authenticateApiKey` |
| Exposing internal project IDs without ownership check | User A can edit User B's project via MCP | Tool handlers must verify `project.user_id === ctx.userId` before any mutation -- reuse existing RLS policies via `supabase` client |
| stdio transport storing API key in plaintext config | Key visible in Claude Desktop config JSON | Document that users should use environment variables: `"env": { "VSL_API_KEY": "vsl_..." }` rather than inline |
| No input validation on MCP tool parameters | Injection via topic string, invalid template IDs | Reuse existing validation from REST handlers. Zod schemas in tool definitions provide first-line defense. |
| MCP endpoint accessible without CORS restrictions | Not a risk for MCP (not browser-based) but may confuse developers | Do NOT add CORS headers to MCP endpoint -- MCP clients are not browsers. CORS is for REST API only. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tool returns raw error codes ("VALIDATION_ERROR") | LLM cannot help user fix the issue | Return human-readable error messages: "Template 'xyz' not found. Available templates: modern, minimal, bold..." |
| `list_templates` returns only IDs | LLM cannot recommend a template | Return template ID, name, description, and visual style keywords so the LLM can suggest the best match |
| `create_carousel` requires exact templateId | User must know template IDs | Accept template name or description and fuzzy-match, or let the LLM use `list_templates` first (two-step is OK for discovery) |
| No feedback during long generation | User thinks tool call failed | Return intermediate status if possible, or set expectations in tool description: "This tool takes 15-30 seconds to complete" |
| Connection guide has wrong config format | User cannot connect, gives up | Test every config example against actual Claude Desktop / Cursor versions before publishing |

## "Looks Done But Isn't" Checklist

- [ ] **MCP endpoint:** Responds to GET, POST, and DELETE at `/api/mcp` (all three methods required by Streamable HTTP spec)
- [ ] **Auth:** Bearer token validated on MCP endpoint, not just passed through
- [ ] **Rate limiting:** Applied to MCP requests, not just REST API requests
- [ ] **Credit deduction:** Works through MCP tool calls, credit balance returned in response
- [ ] **Middleware skip:** `/api/mcp` excluded from Supabase session middleware
- [ ] **Error format:** MCP JSON-RPC error responses (not REST JSON error format)
- [ ] **stdio package:** Works via `npx` on a clean machine (no project dependencies)
- [ ] **stdio package:** Shebang present, file permissions correct, `bin` entry points to built output
- [ ] **Claude Desktop:** Tested with real Claude Desktop config, not just MCP Inspector
- [ ] **Cursor:** Tested with real Cursor MCP config
- [ ] **Tool descriptions:** Tested by asking Claude to "make a carousel" without explicit tool guidance
- [ ] **Templates tool:** Returns enough context for LLM to recommend a template
- [ ] **Large responses:** Tool responses under 4KB to avoid context window bloat

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 1:1 REST-to-MCP tool mapping | MEDIUM (4-6 hrs) | Redesign tools as outcome-oriented, consolidate multi-step operations into single tools |
| Serverless timeout | LOW (30 min) | Set maxDuration, add timeout handling in tool handler, return partial results |
| Auth model mismatch | MEDIUM (2-4 hrs) | Extract auth logic from withApiAuth into reusable function, create MCP auth bridge |
| Session state in serverless | LOW (15 min) | Switch to stateless mode: `sessionIdGenerator: undefined` |
| Bad tool descriptions | LOW (1-2 hrs) | Rewrite descriptions following the what/when/returns/not pattern, test with LLM |
| stdio packaging broken | MEDIUM (2-4 hrs) | Set up separate build with tsup, test npx workflow end-to-end |
| Middleware conflict | LOW (5 min) | Add one-line skip condition in middleware.ts |
| Double credit deduction | MEDIUM (3-4 hrs) | Add idempotency key based on request hash or project fingerprint |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| REST 1:1 tool mapping | Phase 1 (design) | Review tool list: each tool = one user outcome |
| Serverless timeout | Phase 2 (implementation) | Test create_carousel via MCP with real AI generation, measure end-to-end time |
| Auth model mismatch | Phase 1 (design) | Auth bridge function unit tested, Bearer token flows through to userId |
| Session state in serverless | Phase 1 (transport config) | Deploy to Vercel, make 3+ sequential tool calls, all succeed |
| Tool description quality | Phase 1 (design) + Phase 3 (testing) | Claude Desktop selects correct tool on first try for 5 different prompts |
| stdio packaging | Phase 3 (packaging) | `npx viral-slide-mcp` works on clean machine with only env vars configured |
| Middleware conflict | Phase 2 (route handler) | MCP endpoint returns valid JSON-RPC response, no redirects |
| Credit idempotency | Phase 4 (hardening) | Simulate retry: credit deducted only once |

## Sources

- [MCP TypeScript SDK -- server documentation](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [MCP Tool Design: Why Your AI Agent Is Failing](https://dev.to/aws-heroes/mcp-tool-design-why-your-ai-agent-is-failing-and-how-to-fix-it-40fc)
- [Less is More: 4 design patterns for building better MCP servers](https://www.klavis.ai/blog/less-is-more-mcp-design-patterns-for-ai-agents)
- [Why MCP Deprecated SSE and Went with Streamable HTTP](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)
- [MCP Transports Specification (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [Vercel mcp-handler](https://github.com/vercel/mcp-handler)
- [MCP Authorization Tutorial](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [MCP Server Security Best Practices](https://toolradar.com/blog/mcp-server-security-best-practices)
- [Mastra -- Publishing an MCP server](https://mastra.ai/docs/mcp/publishing-mcp-server)
- [The Six-Tool Pattern: MCP Server Design That Scales](https://www.mcpbundles.com/blog/mcp-tool-design-pattern)
- Codebase: `src/lib/api/with-api-auth.ts` (existing Bearer token auth middleware)
- Codebase: `src/middleware.ts` (Next.js middleware with route skip logic)
- Codebase: `src/app/api/v1/carousel/route.ts` (carousel generation endpoint, maxDuration=60)

---
*Pitfalls research for: MCP Server v2.3*
*Researched: 2026-04-08*

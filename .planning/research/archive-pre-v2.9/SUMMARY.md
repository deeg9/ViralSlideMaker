# Project Research Summary

**Project:** ViralSlideMaker MCP Server (v2.3)
**Domain:** MCP server integration for SaaS carousel generator
**Researched:** 2026-04-08
**Confidence:** HIGH

## Executive Summary

ViralSlideMaker v2.3 adds an MCP server layer on top of a mature Next.js 15 REST API. This is a thin integration problem, not a greenfield build. The existing service layer (generateCarousel, listProjects, slide update functions), auth infrastructure (authenticateApiKey, checkRateLimit), and database setup are all reusable as-is. The MCP server is 3 new files plus 1 modified file: an auth adapter, a tool definitions module, a route handler, and a one-line middleware update. Two new npm packages are needed (mcp-handler, @modelcontextprotocol/sdk). Everything else already exists.

The recommended approach is outcome-oriented tool design with 4 curated tools (list_templates, create_carousel, edit_slide, render_carousel) that map to complete user outcomes rather than REST endpoint operations. Research strongly confirms that tool count discipline is the highest-leverage design decision in MCP server design — accuracy degrades sharply above 10 tools, and the 4-tool MVP is well within the safe zone. The hosted transport uses Vercel's mcp-handler for Streamable HTTP; the stdio transport delegates entirely to mcp-remote with no duplicated business logic. A secondary npm package (viralslidemaker-mcp) published separately handles local agent use.

The primary risks are operational: serverless function timeout on create_carousel (mitigated by maxDuration = 60), session state in serverless (mitigated by stateless mode), and middleware bypass omission (a one-line fix with confusing failure mode if missed). Auth is straightforward — Bearer tokens via withMcpAuth reuse the existing vsl_ key system with no OAuth complexity. The critical non-obvious risk is tool description quality: vague descriptions cause agents to select wrong tools or pass wrong parameters, and this surfaces only during real agent testing, not unit tests.

## Key Findings

### Recommended Stack

The stack adds exactly 2 new npm packages to an otherwise unchanged project. mcp-handler (Vercel's official Next.js adapter, v1.1.0) handles Streamable HTTP transport, SSE fallback, session management, and JSON-RPC framing in a single dynamic [transport] route — eliminating the need to manually configure NodeStreamableHTTPServerTransport. @modelcontextprotocol/sdk v1.x (1.26.0+ required, 1.29.0 latest stable) is the official MCP TypeScript SDK and a peer dependency of mcp-handler. The v2 SDK is explicitly pre-alpha and must be avoided. zod 4.x (already installed) is fully compatible. Everything else — Supabase, Upstash Redis, Next.js, withApiAuth logic — is reused without modification.

**Core technologies:**
- `mcp-handler` ^1.1.0: Next.js App Router MCP route handler — Vercel's official adapter, eliminates manual transport setup, handles POST/GET/DELETE for Streamable HTTP
- `@modelcontextprotocol/sdk` ^1.26.0: MCP protocol implementation — official TypeScript SDK, peer dep of mcp-handler, provides McpServer and tool registration primitives
- `zod` ^4.3.6 (existing): Tool input schema validation — already installed, fully compatible with SDK's declared range (^3.25 || ^4.0)
- `mcp-remote` (npm package only): stdio-to-HTTP bridge — used in the separate viralslidemaker-mcp package to avoid duplicating business logic
- All existing: Supabase, Upstash Redis, Next.js 15, authenticateApiKey, checkRateLimit — reused without changes

### Expected Features

The 4-tool MVP covers the complete agent workflow. Tool count discipline is the defining design decision: research shows agent accuracy drops 24 percentage points when tool count gets excessive, and the 4-tool set is at the low end of the 5-15 sweet spot. Competitors like Stripe (27 tools) and Notion (18 tools) are platform products that justify high counts; ViralSlideMaker's focused creation purpose calls for curated, outcome-oriented tools.

**Must have (table stakes — launch with these):**
- `create_carousel` tool — the entire value proposition; one-shot topic-to-carousel with projectId + slide count returned
- `list_templates` tool — template discovery; agents call this first to select style, but create_carousel has a sensible default
- `edit_slide` tool — post-creation refinement; enables the natural "create then iterate" agent workflow
- `render_carousel` tool — get download URLs after edits; completes the create-edit-download workflow
- Streamable HTTP transport at /api/mcp — remote agent access via Claude Desktop, Cursor, all modern MCP clients
- Bearer token auth reusing existing vsl_ API keys — zero new auth infrastructure
- Descriptive tool schemas with parameter constraints, credit cost, and usage guidance
- Structured MCP error responses with human-readable messages

**Should have (competitive — add if time permits):**
- `get_project` tool — inspect existing project before editing; enables "show me slide 3" workflows
- Credit balance in every tool response — proactively surfaces remaining credits to agents; already in REST response headers
- stdio npm package (viralslidemaker-mcp) — local agent support for Claude Desktop subprocess mode

**Defer (v2.3.x and beyond):**
- MCP prompt templates for guided carousel creation workflow
- `list_projects` tool — only if agents need to browse existing work
- OAuth 2.1 auth flow — only if distributing via MCP marketplaces that require it
- `delete_project` as MCP tool — destructive operations via AI agents are dangerous; omit intentionally

### Architecture Approach

The architecture is a thin wrapper pattern. Three new source files and one modification sit on top of the unchanged service layer. The [transport] dynamic route at src/app/api/[transport]/route.ts uses mcp-handler's createMcpHandler + withMcpAuth. The auth adapter in src/lib/mcp/auth.ts wraps the existing key lookup and rate limit logic into a verifyToken function compatible with withMcpAuth's interface (returns AuthInfo | undefined rather than NextResponse). Tool definitions in src/lib/mcp/tools.ts call service functions directly — no internal HTTP round-trips. The stdio package in packages/mcp-cli/ is a configuration wrapper that delegates to mcp-remote, containing zero business logic. Build order follows dependency chain: auth adapter first, tools second, route handler third, middleware update alongside, stdio package last (independent).

**Major components:**
1. `src/app/api/[transport]/route.ts` (NEW) — MCP Streamable HTTP endpoint; createMcpHandler + withMcpAuth; exports GET, POST, DELETE
2. `src/lib/mcp/auth.ts` (NEW) — auth adapter; wraps authenticateApiKey + checkRateLimit into verifyToken for withMcpAuth
3. `src/lib/mcp/tools.ts` (NEW) — 4 tool definitions; calls service layer directly (generateCarousel, getProject, updateProjectService)
4. `src/middleware.ts` (MODIFIED) — add /api/mcp to session auth bypass alongside /api/v1
5. `packages/mcp-cli/` (NEW) — standalone npm package; mcp-remote bridge; zero shared code with Next.js app
6. Existing `src/lib/services/` (UNCHANGED) — all business logic; reused as-is by MCP tools

### Critical Pitfalls

1. **Operation-oriented tool design (1:1 REST-to-MCP mapping)** — Design 4 outcome-oriented tools; each tool completes a full user outcome in one call. create_carousel should return a ready result, not require chaining. More than 6 tools is a warning sign. Block rebuilt their Linear MCP from 30+ tools to 2; GitHub Copilot cut 40 to 13 and saw measurable accuracy improvements.

2. **Serverless timeout on create_carousel** — Set maxDuration = 60 on the MCP route handler from day one. Test with real Gemini API calls, not mocks. The generation chain (Gemini + Pexels + Supabase) can take 15-45 seconds; cold start adds 2-5 more.

3. **Middleware bypass omission** — Add /api/mcp to the middleware skip list before the updateSession call. Without this, MCP clients get 307 redirects to the login page. The failure is confusing and environment-specific (works in local dev, fails in production).

4. **Stateful session storage in serverless** — Use stateless mode (sessionIdGenerator: undefined) from the start. In-memory Map session storage breaks across Vercel function instances. mcp-handler defaults to stateless; do not override this.

5. **Tool description quality** — Write descriptions as LLM instructions, not API docs. Each description needs: what it does, when to use it, what it returns, and when NOT to use it. Test by asking Claude Desktop to "make a carousel about productivity tips" without explicit tool guidance.

## Implications for Roadmap

Based on research, the implementation is a 3-phase build with an optional 4th hardening phase.

### Phase 1: MCP Foundation (Auth + Transport)

**Rationale:** Auth adapter and transport configuration are prerequisites for all tool work. The middleware bypass must be in place before any MCP request can succeed. Stateless mode must be configured before deploying. These are structural decisions that are expensive to change after tools are built. Addresses auth mismatch, stateful session, and middleware conflict pitfalls before any tool code is written.

**Delivers:** A working /api/mcp endpoint that authenticates Bearer tokens, applies rate limiting, and returns a valid empty MCP server response. No tools yet, but the scaffolding is complete and testable with MCP Inspector.

**Addresses:** Bearer auth (table stakes), Streamable HTTP transport (table stakes)

**Avoids:** Auth model mismatch (Pitfall 3), stateful session in serverless (Pitfall 4), middleware conflict (Pitfall 7)

**Stack:** mcp-handler ^1.1.0, @modelcontextprotocol/sdk ^1.26.0, existing authenticateApiKey + checkRateLimit

### Phase 2: Core Tools (4 Outcome-Oriented Tools)

**Rationale:** With transport working, implement the 4 tools in dependency order: list_templates (no auth complexity, no credit cost, validates tool registration works), then create_carousel (the core value prop, most complex, tests credit deduction and service layer integration), then edit_slide and render_carousel (complete the workflow). Tool descriptions must be written for LLM consumption during implementation, not as a cleanup step after.

**Delivers:** Complete end-to-end agent workflow: discover templates, create carousel, edit slides, get download URLs. Testable with real Claude Desktop and Cursor.

**Implements:** src/lib/mcp/tools.ts, all 4 tool registrations, direct service layer calls, credit check + deduction in tool handlers

**Avoids:** Operation-oriented design (Pitfall 1), tool description quality failures (Pitfall 5)

**Addresses:** All 8 must-have features from MVP definition

### Phase 3: stdio npm Package

**Rationale:** The stdio package is independent and can be built in parallel after the route handler works, but publishing before the hosted server is validated wastes effort. Build it after end-to-end testing with Claude Desktop. The packaging is non-trivial (separate package.json, tsconfig.json, tsup build, shebang, file permissions) and has its own distinct failure modes.

**Delivers:** viralslidemaker-mcp npm package; users configure npx viralslidemaker-mcp in Claude Desktop for local subprocess mode. Tested via npx on a clean machine.

**Avoids:** stdio packaging errors (Pitfall 6) — separate build toolchain, zero shared code with Next.js app, mcp-remote bridge eliminates business logic duplication

**Addresses:** stdio transport (table stakes for local agent use)

### Phase 4: Hardening (Post-Launch)

**Rationale:** These improvements are valuable but not required for launch. Idempotency on credit deduction is acceptable technical debt at 1 credit/operation. P2 features (credit balance in responses, get_project tool) are low-effort and should ship with Phase 2 if time permits.

**Delivers:** Credit deduction idempotency, get_project tool, credit balance in all tool responses, MCP prompt templates, hardened error messages

**Addresses:** Credit idempotency (Pitfall 8), differentiator features (P2 list)

### Phase Ordering Rationale

- Auth before tools: Tools require extra.authInfo.extra.userId which only flows through if withMcpAuth is correctly configured. Building tools without working auth means testing against unauthenticated requests — misleading signal.
- Hosted transport before stdio: The stdio package is a bridge to the hosted endpoint. The hosted endpoint must work before the bridge can be validated.
- Service layer is not a phase: It already exists from v2.2. This is the key dependency that makes v2.3 tractable.
- Stateless design is a precondition: Stateful sessions would require Redis-backed storage (additional infrastructure). Stateless mode is the correct default for serverless and requires no extra work.

### Research Flags

Phases with well-documented patterns (skip additional research-phase):
- **Phase 1:** mcp-handler patterns fully documented with code examples; withMcpAuth + verifyToken adapter pattern is straightforward; no unknowns
- **Phase 2:** Service layer already exists and is tested; tool registration pattern is simple; timeout risk mitigated by maxDuration = 60
- **Phase 3:** mcp-remote bridge pattern is well-established; packaging with tsup is standard

Phase that may benefit from spot research during implementation:
- **Phase 4 (idempotency):** If implementing request_id-based idempotency, verify Supabase UPSERT patterns for the carousel_generations table. Low priority — acceptable to defer entirely.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | mcp-handler v1.1.0 verified on npm; SDK v1.29.0 verified; v2 pre-alpha status confirmed in official repo README; zod compatibility confirmed from SDK package.json |
| Features | HIGH | 4-tool MVP design grounded in multiple production MCP server case studies (Stripe, Notion, Supabase); tool count research from multiple independent sources |
| Architecture | HIGH | Patterns verified against mcp-handler official docs and authorization guide; existing codebase inspected for service layer decoupling, middleware patterns, and auth infrastructure |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls (timeout, stateless sessions, middleware bypass) verified against Vercel serverless constraints and MCP spec; tool description quality backed by multiple sources |

**Overall confidence:** HIGH

### Gaps to Address

- **mcp-remote version compatibility:** The mcp-remote package version compatibility with mcp-handler v1.1.0 was not verified on npm. Check before implementing Phase 3.
- **create_carousel actual latency:** Research estimates 15-45 seconds for the Gemini + Pexels + Supabase chain. Actual measurement needed during Phase 2 to confirm maxDuration = 60 is sufficient. If generation consistently exceeds 55 seconds, an async pattern will be required — this would add a tool and change the workflow design.
- **mcp-handler peer dep flexibility:** Community reports suggest SDK 1.29.0 works with mcp-handler's ^1.26.0 peer dep, but not officially documented. Verify with npm install output during Phase 1.
- **Claude Desktop + Cursor config formats:** Verify against currently installed client versions before publishing user-facing documentation. Config syntax changes with client versions.

## Sources

### Primary (HIGH confidence)
- [Vercel mcp-handler GitHub](https://github.com/vercel/mcp-handler) — route handler setup, createMcpHandler, withMcpAuth, basePath configuration
- [mcp-handler Authorization docs](https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md) — verifyToken pattern, AuthInfo type
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) — v1.29.0 latest stable, v2 pre-alpha status
- [MCP Transports Specification (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Streamable HTTP spec, stateless mode
- [Next.js MCP Guide](https://nextjs.org/docs/app/guides/mcp) — official Next.js MCP integration patterns
- [Stripe MCP Documentation](https://docs.stripe.com/mcp) — production MCP server reference (27 tools)
- [Notion MCP Supported Tools](https://developers.notion.com/guides/mcp/mcp-supported-tools) — production 18-tool reference
- npm registry: mcp-handler@1.1.0, @modelcontextprotocol/sdk@1.29.0 — version verification
- Existing codebase: with-api-auth.ts, middleware.ts, carousel/route.ts, services/carousel.ts — architecture validation

### Secondary (MEDIUM confidence)
- [MCP Best Practices - philschmid.de](https://www.philschmid.de/mcp-best-practices) — tool granularity, outcome-oriented design
- [MCP Context Overload - eclipsesource.com](https://eclipsesource.com/blogs/2026/01/22/mcp-context-overload/) — tool count impact on agent accuracy
- [Less is More: MCP Design Patterns - klavis.ai](https://www.klavis.ai/blog/less-is-more-mcp-design-patterns-for-ai-agents) — outcome-oriented tool design
- [MCP Tool Design: Why Your AI Agent Is Failing - dev.to](https://dev.to/aws-heroes/mcp-tool-design-why-your-ai-agent-is-failing-and-how-to-fix-it-40fc) — description quality research
- [Supabase MCP Server blog](https://supabase.com/blog/mcp-server) — feature-flagged tool groups pattern
- [mcp-remote npm](https://www.npmjs.com/package/mcp-remote) — stdio-to-HTTP bridge

### Tertiary (LOW confidence)
- [MCP Tool Overload Solutions - lunar.dev](https://www.lunar.dev/post/why-is-there-mcp-tool-overload-and-how-to-solve-it-for-your-ai-agents) — context window consumption data (needs validation)
- [The Six-Tool Pattern - mcpbundles.com](https://www.mcpbundles.com/blog/mcp-tool-design-pattern) — tool count sweet spot guidance

---
*Research completed: 2026-04-08*
*Ready for roadmap: yes*

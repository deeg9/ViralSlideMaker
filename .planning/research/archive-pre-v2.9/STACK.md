# Technology Stack: v2.3 MCP Server

**Project:** ViralSlideMaker MCP Server
**Researched:** 2026-04-08
**Confidence:** HIGH (versions verified via npm, patterns verified via official docs)

> **Scope:** This document covers ONLY the stack needed for v2.3 MCP Server.
> The existing stack (Next.js 15.5.13, React 19, Supabase, withApiAuth, Upstash Redis rate limiting, 10 REST endpoints, zod 4.x) is validated and unchanged.

## Key Finding: 2 New Packages Required

The MCP server needs exactly two new npm packages. Everything else (auth, rate limiting, service layer, zod) is already in the project.

## Recommended Stack

### Core MCP Packages

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `mcp-handler` | ^1.1.0 | Next.js App Router MCP route handler | Vercel's official adapter for Next.js. Handles Streamable HTTP transport, SSE fallback, session management, and protocol negotiation in a single dynamic `[transport]` route. Provides `createMcpHandler` for tool registration and `withMcpAuth` for Bearer token verification. Eliminates manual `NodeStreamableHTTPServerTransport` setup. |
| `@modelcontextprotocol/sdk` | ^1.26.0 | MCP protocol implementation (peer dep) | Official TypeScript SDK. Provides `McpServer`, `StdioServerTransport`, JSON-RPC handling, and tool registration primitives. Required as peer dependency of `mcp-handler`. Latest stable is 1.29.0; minimum compatible is 1.26.0. |

### Already In Project (reuse, DO NOT re-add)

| Library | Version | Role in MCP |
|---------|---------|-------------|
| `zod` | ^4.3.6 | Tool input schema validation. SDK accepts `^3.25 \|\| ^4.0` -- fully compatible. |
| `next` | 15.5.13 | Route handler host at `app/api/[transport]/route.ts` |
| `@supabase/supabase-js` | ^2.99.3 | Data access via existing service layer (`generateCarousel`, `listProjects`, etc.) |
| `@upstash/ratelimit` | ^2.0.8 | Rate limiting via existing `checkRateLimit()` |
| `@upstash/redis` | ^1.37.0 | Redis client for rate limiting |

## What NOT to Add

| Package | Why Not |
|---------|---------|
| `@modelcontextprotocol/server` (v2 package) | v2 SDK is pre-alpha (explicitly stated in official repo). Restructures into separate packages but is NOT production-ready. Stick with `@modelcontextprotocol/sdk` v1.x until v2 reaches stable. |
| `@modelcontextprotocol/express` | Not needed. `mcp-handler` handles Next.js integration. Express adapter is for Express-only servers. |
| `@modelcontextprotocol/hono` | Not needed. Same reason -- wrong framework. |
| `@modelcontextprotocol/node` | Bundled within SDK. `mcp-handler` wraps it internally. |
| Any OAuth library (better-auth, clerk, etc.) | Existing Bearer token auth with `vsl_` API keys is sufficient. MCP spec supports Bearer tokens directly. OAuth is only needed for third-party authorization flows, which are out of scope. |
| `mcp-framework` | Over-engineered directory-based discovery for 4 tools. `mcp-handler` + direct registration is simpler. |

## Architecture: Two Transport Implementations

### 1. Streamable HTTP (hosted, primary)

**Route:** `src/app/api/[transport]/route.ts`
**URL:** `https://viralslidemaker.com/api/mcp` (the `[transport]` segment resolves to `mcp`)

`mcp-handler` creates a single dynamic route that handles:
- `POST /api/mcp` -- JSON-RPC messages (tool calls, initialization)
- `GET /api/mcp` -- SSE stream for server-initiated messages
- `DELETE /api/mcp` -- Session cleanup

**Auth flow:** `withMcpAuth` wraps the handler. It extracts the Bearer token from the `Authorization` header and passes it to a `verifyToken` function. This function reuses the existing `authenticateApiKey` to validate `vsl_` tokens and returns auth info that flows to tool handlers via `extra.authInfo`.

**Tool implementation:** Tools call existing service functions DIRECTLY (same Node.js process). No HTTP roundtrip. The service layer (`generateCarousel`, `listProjects`, slide update functions) is already extracted and shared between web UI server actions and REST endpoints.

**Rate limiting and credits:** Must be implemented in the MCP route since tools bypass REST middleware. Reuse `checkRateLimit(keyId)` and `deductCreditAdmin()` directly.

```
Client (Claude Desktop/Cursor)
  |
  | HTTPS POST /api/mcp (Bearer vsl_xxx)
  v
[transport] route.ts
  |
  | withMcpAuth -> verifyToken -> authenticateApiKey
  | checkRateLimit(keyId)
  v
MCP Tool Handler
  |
  | Direct function call (no HTTP)
  v
Service Layer (generateCarousel, etc.)
  |
  v
Supabase / Pexels / Gemini
```

### 2. stdio (npm package, secondary)

**Package:** `viralslidemaker-mcp` (published to npm)
**Entry:** `bin/cli.ts` -> `McpServer` + `StdioServerTransport`

The npm package is a thin CLI that:
1. Reads `VIRALSLIDEMAKER_API_KEY` and `VIRALSLIDEMAKER_BASE_URL` from env vars
2. Creates an `McpServer` with the same 4 tool definitions
3. Each tool calls the hosted REST API via `fetch()` (HTTP client, not direct service calls)
4. Connects to `StdioServerTransport` for stdin/stdout communication

**Why REST calls instead of direct service calls:** The npm package runs on the user's machine, not the server. It has no access to Supabase, service layer, or server-side code. It must go through the REST API.

### Key Integration Pattern

```
Streamable HTTP tools -> service functions (direct, same process)
stdio tools          -> REST API (HTTP, remote)
```

Shared: Tool names, descriptions, input schemas (zod), and response formatting should be defined ONCE in a shared module (`src/lib/mcp/tools.ts`) and imported by both transport implementations.

## Tool-to-Endpoint Mapping

| MCP Tool | REST Endpoint | Service Function (hosted) | Credit Cost |
|----------|---------------|---------------------------|-------------|
| `list_templates` | `GET /api/v1/templates` | Direct template data access | 0 |
| `create_carousel` | `POST /api/v1/carousel` | `generateCarousel()` | 1 |
| `edit_slide` | `PATCH /api/v1/projects/[id]/slides/[index]` | Slide update service | 0 |
| `render_carousel` | `POST /api/v1/projects/[id]/render` | Render service | 0 |

## mcp-handler API Reference

### `createMcpHandler(setup, options, config)`

| Parameter | Type | Purpose |
|-----------|------|---------|
| `setup` | `(server: McpServer) => void` | Register tools, resources, prompts |
| `options` | `object` | Server options (empty `{}` for defaults) |
| `config.basePath` | `string` | Must match the route path prefix (e.g., `/api`) |
| `config.maxDuration` | `number` | Max request duration in seconds |
| `config.verboseLogs` | `boolean` | Enable debug logging |

### `withMcpAuth(handler, verifyToken, options)`

| Parameter | Type | Purpose |
|-----------|------|---------|
| `handler` | MCP handler from `createMcpHandler` | The handler to wrap |
| `verifyToken` | `(req: Request, bearerToken?: string) => Promise<AuthInfo \| undefined>` | Token validation function |
| `options.required` | `boolean` | If `true`, reject unauthenticated requests |

### Tool Registration

```typescript
server.registerTool("tool_name", {
  title: "Human-Readable Title",
  description: "Description for the LLM",
  inputSchema: {
    param: z.string().min(1).max(500),
    optional: z.number().optional(),
  },
}, async (params, extra) => {
  // extra.authInfo?.clientId = userId
  // extra.authInfo?.extra?.keyId = keyId
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  }
})
```

### Route Export

```typescript
// Must export all three HTTP methods
export { authHandler as GET, authHandler as POST, authHandler as DELETE }
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| MCP route handler | `mcp-handler` (Vercel) | Raw `@modelcontextprotocol/sdk` with manual `NodeStreamableHTTPServerTransport` | Manual setup requires handling session IDs, SSE streams, JSON-RPC framing, DELETE cleanup, and transport protocol negotiation. `mcp-handler` does this in ~20 lines. |
| SDK version | v1.x (1.26.0+) | v2 pre-alpha (`@modelcontextprotocol/server`) | v2 restructures into separate packages. Pre-alpha, unstable API, `mcp-handler` does not support it yet. |
| Auth approach | `withMcpAuth` + existing `authenticateApiKey` | Custom middleware wrapping the handler | `withMcpAuth` provides proper MCP-aware auth with `extra.authInfo` flowing to tool handlers. Reinventing this adds no value. |
| Hosted tool implementation | Direct service calls | Call own REST API via fetch | Service functions are already extracted. Direct calls avoid HTTP overhead and the circular dependency of the server calling itself. |
| npm package structure | Separate `packages/mcp-cli/` directory | Inline in main src | The CLI is published independently to npm. It needs its own `package.json`, `tsconfig.json`, and build step. Keep it separate. |

## Installation

```bash
# 2 new packages
npm install mcp-handler @modelcontextprotocol/sdk@^1.26.0
```

**Bundle size note:** `@modelcontextprotocol/sdk` v1.x bundles express, hono, cors, jose, and other dependencies (~15 transitive deps). This is because v1 is a monolithic package covering all transports. These deps are server-only and do NOT affect client bundle size (route handlers are server-only in Next.js App Router). Tree-shaking in v2 will address this, but v2 is not ready.

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| `mcp-handler` for Streamable HTTP | HIGH | Official Vercel package, v1.1.0 released March 2026, purpose-built for Next.js, 29 releases |
| `@modelcontextprotocol/sdk` v1.x | HIGH | Official SDK, npm verified, 1.29.0 latest stable, 1.26.0+ required by mcp-handler |
| Avoid SDK v2 | HIGH | Explicitly marked "pre-alpha" in official repo README |
| Bearer token auth via `withMcpAuth` | HIGH | Documented in mcp-handler AUTHORIZATION.md, `verifyToken` hook maps directly to existing `authenticateApiKey` |
| Zod 4.x compatibility | HIGH | SDK declares `^3.25 \|\| ^4.0`, project has 4.3.6 |
| Direct service calls for hosted transport | HIGH | Service layer already extracted in v2.2 for exactly this purpose (shared between web UI and API) |
| stdio via separate npm package | MEDIUM | Standard pattern per MCP ecosystem. Requires maintaining shared tool definitions and a separate build/publish pipeline. |
| `mcp-handler` peer dep flexibility | MEDIUM | Peer dep pins `1.26.0` exactly, but npm resolves `^1.26.0` range. Tested with 1.29.0 per community reports, but not officially documented. |

## Sources

- [Vercel mcp-handler GitHub](https://github.com/vercel/mcp-handler) -- v1.1.0, route handler setup, tool registration
- [mcp-handler Authorization docs](https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md) -- withMcpAuth, verifyToken pattern
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) -- v1.29.0 latest stable, v2 pre-alpha status
- [MCP SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- McpServer, transport setup, tool definitions
- [MCP SDK v2 docs](https://ts.sdk.modelcontextprotocol.io/v2/) -- confirms v2 is pre-alpha, not recommended
- [Next.js MCP Guide](https://nextjs.org/docs/app/guides/mcp) -- official Next.js MCP guidance
- [Vercel MCP deploy docs](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel) -- deployment patterns
- npm registry: `mcp-handler@1.1.0`, `@modelcontextprotocol/sdk@1.29.0` -- version and dependency verification

---
*Stack research for: ViralSlideMaker v2.3 -- MCP Server*
*Researched: 2026-04-08*

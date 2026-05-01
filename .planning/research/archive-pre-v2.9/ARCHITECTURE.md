# Architecture Research: MCP Server Integration

**Domain:** MCP server (Streamable HTTP + stdio) integration with existing Next.js 15 App Router REST API
**Researched:** 2026-04-08
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Clients                                  │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────────┐       │
│  │Claude Desktop│  │  Cursor  │  │ Other MCP Clients    │       │
│  └──────┬───────┘  └────┬─────┘  └──────────┬───────────┘       │
│         │               │                    │                   │
│    ┌────┴───────────────┴────────────────────┴─────────┐        │
│    │           Streamable HTTP Transport                │        │
│    │    POST/GET https://viralslidemaker.com/api/mcp   │        │
│    └───────────────────────┬───────────────────────────┘        │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│  Next.js 15 App Router     │                                     │
│                            v                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  src/app/api/[transport]/route.ts                        │    │
│  │  mcp-handler: createMcpHandler + withMcpAuth             │    │
│  │  (Bearer token auth via authenticateApiKey)              │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        v                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  src/lib/mcp/tools.ts                                    │    │
│  │  4 MCP tool definitions:                                 │    │
│  │  list_templates | create_carousel | edit_slide | render  │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        v                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  src/lib/services/ (EXISTING - no changes)               │    │
│  │  carousel.ts | projects.ts                               │    │
│  └─────────────────────┬───────────────────────────────────┘    │
│                        │                                         │
│                        v                                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Supabase (admin client) + Pexels + Gemini               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  stdio Transport (npm package: viralslidemaker-mcp)              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  packages/mcp-cli/                                        │   │
│  │  Thin wrapper: stdin/stdout <-> HTTP calls to /api/mcp    │   │
│  │  Uses mcp-remote to bridge transports                     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | New/Modified | Implementation |
|-----------|----------------|--------------|----------------|
| `src/app/api/[transport]/route.ts` | MCP endpoint (Streamable HTTP) | **NEW** | `mcp-handler` createMcpHandler + withMcpAuth |
| `src/lib/mcp/tools.ts` | MCP tool definitions (4 tools) | **NEW** | Calls service layer directly |
| `src/lib/mcp/auth.ts` | MCP auth adapter (reuses authenticateApiKey) | **NEW** | Thin wrapper returning AuthInfo |
| `src/lib/api/auth.ts` | Bearer token authentication | **UNCHANGED** | Already works for vsl_ keys |
| `src/lib/services/carousel.ts` | Carousel generation logic | **UNCHANGED** | Already decoupled from HTTP |
| `src/lib/services/projects.ts` | Project CRUD logic | **UNCHANGED** | Already decoupled from HTTP |
| `src/lib/api/rate-limit.ts` | Upstash Redis rate limiting | **REUSED** | Called from MCP auth wrapper |
| `src/middleware.ts` | Session auth bypass | **MODIFIED** | Add `/api/mcp` bypass alongside `/api/v1` |
| `packages/mcp-cli/` | stdio npm package | **NEW** | Separate package in monorepo |

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── [transport]/        # NEW: mcp-handler dynamic route
│   │   │   └── route.ts        # createMcpHandler + withMcpAuth exports
│   │   └── v1/                 # EXISTING: REST API (unchanged)
│   │       ├── carousel/route.ts
│   │       ├── projects/...
│   │       └── templates/route.ts
│   └── ...
├── lib/
│   ├── mcp/                    # NEW: MCP-specific code
│   │   ├── tools.ts            # 4 tool registrations
│   │   └── auth.ts             # verifyToken adapter for withMcpAuth
│   ├── api/                    # EXISTING: REST API utilities
│   │   ├── auth.ts             # authenticateApiKey (reused by MCP)
│   │   ├── rate-limit.ts       # checkRateLimit (reused by MCP)
│   │   └── ...
│   └── services/               # EXISTING: shared business logic
│       ├── carousel.ts         # generateCarousel (called by MCP tools)
│       └── projects.ts         # getProject, updateProjectService, etc.
├── middleware.ts                # MODIFIED: add /api/mcp bypass
└── ...

packages/                       # NEW: monorepo packages dir
└── mcp-cli/                    # npm package for stdio transport
    ├── package.json            # name: "viralslidemaker-mcp"
    ├── tsconfig.json
    ├── src/
    │   └── index.ts            # stdio server entry point
    └── bin/
        └── cli.js              # npx entry point
```

### Structure Rationale

- **`src/app/api/[transport]/route.ts`:** The `mcp-handler` library uses a dynamic `[transport]` segment to auto-detect Streamable HTTP vs SSE. The route lives at `basePath: "/api"` so `/api/mcp` resolves correctly. This is the official pattern from Vercel's mcp-handler.
- **`src/lib/mcp/`:** Separates MCP-specific code (tool definitions, auth adapter) from REST API code. Tools call the service layer directly -- no internal HTTP calls.
- **`packages/mcp-cli/`:** Separate publishable package for `npx viralslidemaker-mcp`. Makes HTTP calls to the hosted `/api/mcp` endpoint, translating stdio to Streamable HTTP.

## Architectural Patterns

### Pattern 1: Direct Service Layer Calls (NOT Internal REST Calls)

**What:** MCP tools call `src/lib/services/` functions directly instead of making HTTP requests to `/api/v1/*` endpoints.
**When to use:** Always -- for the MCP server hosted in the same Next.js process.
**Trade-offs:** Faster (no HTTP overhead), simpler (no self-referencing fetch), shares the same database connection. Slight risk of logic divergence between REST validation and MCP validation -- mitigate by keeping validation in service layer and using Zod schemas in both.

**Why NOT internal REST calls:**
- Self-fetch in serverless is fragile (cold starts, connection limits, circular invocation on Vercel)
- Adds ~50-100ms latency per tool call for no benefit
- The service layer already exists and is decoupled from HTTP concerns (designed in v2.2)

**Example:**
```typescript
// src/lib/mcp/tools.ts
import { generateCarousel } from '@/lib/services/carousel'
import { getProject, updateProjectService } from '@/lib/services/projects'
import { templates } from '@/lib/render/templates'
import { createAdminClient } from '@/lib/supabase/admin'
import { deductCreditAdmin } from '@/lib/credits/check-credits'

export function registerTools(server: McpServer) {
  server.registerTool(
    "create_carousel",
    {
      title: "Create Carousel",
      description: "Create a TikTok/Instagram carousel from a topic. Costs 1 credit.",
      inputSchema: {
        topic: z.string().min(1).max(500),
        templateId: z.string().optional().default("bold-minimal"),
        slideCount: z.number().int().min(3).max(20).optional().default(7),
        imageSource: z.enum(["stock", "ai"]).optional().default("stock"),
      },
    },
    async ({ topic, templateId, slideCount, imageSource }, extra) => {
      const userId = extra.authInfo?.extra?.userId as string
      const supabase = createAdminClient()

      // Credit check + deduction (same logic as REST handler)
      const { data: balance } = await supabase.rpc('get_credit_balance', { p_user_id: userId })
      if ((balance ?? 0) < 1) {
        return { content: [{ type: "text", text: JSON.stringify({ error: "INSUFFICIENT_CREDITS" }) }] }
      }
      await deductCreditAdmin(supabase, userId, 'carousel_generation', `Carousel: ${topic}`, undefined, 1)

      const result = await generateCarousel(supabase, userId, {
        topic, templateId, slideCount, imageSource,
      })

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            projectId: result.projectId,
            slideCount: result.slideCount,
          }),
        }],
      }
    }
  )
}
```

### Pattern 2: Auth Adapter (Reuse authenticateApiKey via withMcpAuth)

**What:** Create a thin `verifyToken` function that wraps the existing key lookup + rate limiting to satisfy `mcp-handler`'s `withMcpAuth` interface.
**When to use:** For the Streamable HTTP endpoint auth.
**Trade-offs:** Reuses all existing auth infrastructure (SHA-256 key hashing, timing-safe comparison, rate limiting). Does not require duplicating auth logic. Cannot reuse `withApiAuth` directly because it returns NextResponse objects with JSON error bodies, while `withMcpAuth` expects `AuthInfo | undefined`.

**Example:**
```typescript
// src/lib/mcp/auth.ts
import { createHash, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/api/rate-limit'
import type { AuthInfo } from 'mcp-handler'

export async function verifyToken(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken || !bearerToken.startsWith('vsl_')) {
    return undefined  // triggers 401 from withMcpAuth
  }

  const keyHash = createHash('sha256').update(bearerToken).digest('hex')
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data) return undefined

  // Timing-safe comparison
  const storedHashBuf = Buffer.from(data.key_hash, 'utf8')
  const computedHashBuf = Buffer.from(keyHash, 'utf8')
  if (!timingSafeEqual(storedHashBuf, computedHashBuf)) {
    return undefined
  }

  // Rate limit check
  const rl = await checkRateLimit(data.id)
  if (!rl.success) return undefined

  // Fire-and-forget: update last_used_at
  admin.from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    token: bearerToken,
    clientId: data.id,
    scopes: ['carousel:create', 'carousel:read', 'carousel:edit'],
    extra: { userId: data.user_id, keyId: data.id },
  }
}
```

### Pattern 3: mcp-handler Dynamic Route with withMcpAuth

**What:** Single route file using `mcp-handler`'s `createMcpHandler` + `withMcpAuth` for the full MCP endpoint.
**When to use:** For the `/api/mcp` Streamable HTTP endpoint.
**Trade-offs:** Handles transport detection, session management, and JSON-RPC automatically. Depends on `mcp-handler` package (maintained by Vercel, well-supported).

**Example:**
```typescript
// src/app/api/[transport]/route.ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { registerTools } from '@/lib/mcp/tools'
import { verifyToken } from '@/lib/mcp/auth'

export const maxDuration = 60

const handler = createMcpHandler(
  (server) => {
    registerTools(server)
  },
  {
    name: 'viralslidemaker',
    version: '1.0.0',
  },
  {
    basePath: '/api',
    maxDuration: 60,
  }
)

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
})

export { authHandler as GET, authHandler as POST }
```

### Pattern 4: stdio Package as HTTP Bridge

**What:** The npm package (`viralslidemaker-mcp`) is a thin bridge that delegates to `mcp-remote` to translate stdio to Streamable HTTP.
**When to use:** For local agent use (Claude Desktop, Cursor with stdio-only support).
**Trade-offs:** No business logic in the npm package -- zero maintenance burden when tools change. Depends on `mcp-remote` package.

**Recommendation: Use mcp-remote.** The npm package is essentially a configuration wrapper:

```typescript
// packages/mcp-cli/src/index.ts
import { spawn } from 'child_process'

const apiKey = process.env.VIRALSLIDEMAKER_API_KEY
const baseUrl = process.env.VIRALSLIDEMAKER_BASE_URL || 'https://viralslidemaker.com'

if (!apiKey) {
  console.error('VIRALSLIDEMAKER_API_KEY is required')
  process.exit(1)
}

// Delegate to mcp-remote with auth headers
const child = spawn('npx', [
  '-y', 'mcp-remote',
  `${baseUrl}/api/mcp`,
  '--header', `Authorization: Bearer ${apiKey}`,
], { stdio: 'inherit' })

child.on('exit', (code) => process.exit(code ?? 0))
```

## Data Flow

### MCP Tool Call Flow (Streamable HTTP)

```
MCP Client (Claude Desktop)
    │ POST /api/mcp
    │ Authorization: Bearer vsl_xxx
    │ Body: JSON-RPC { method: "tools/call", params: { name: "create_carousel", ... } }
    v
[transport] route.ts
    │ mcp-handler parses JSON-RPC
    │ withMcpAuth extracts Bearer token
    v
verifyToken (src/lib/mcp/auth.ts)
    │ SHA-256 hash lookup in api_keys table
    │ Rate limit check via Upstash Redis
    │ Returns AuthInfo { extra: { userId, keyId } }
    v
Tool handler (src/lib/mcp/tools.ts)
    │ Extracts userId from extra.authInfo
    │ Credit check + deduction
    │ Calls generateCarousel() from service layer
    v
Service layer (src/lib/services/)
    │ Gemini AI content generation
    │ Pexels image search
    │ Supabase project save
    v
Tool returns MCP content response
    │ { content: [{ type: "text", text: JSON.stringify(result) }] }
    v
mcp-handler serializes JSON-RPC response
    │ Returns to client
    v
MCP Client receives result
```

### stdio Transport Flow

```
MCP Client (Claude Desktop)
    │ stdio: spawns `npx viralslidemaker-mcp`
    │ Writes JSON-RPC to subprocess stdin
    v
viralslidemaker-mcp (npm package)
    │ mcp-remote bridges stdio <-> HTTP
    │ Forwards to https://viralslidemaker.com/api/mcp
    │ Adds Authorization header from env
    v
Same Streamable HTTP flow as above
    v
Response flows back: HTTP -> mcp-remote -> stdout -> MCP Client
```

## Integration Points

### New Components

| Component | Type | Dependencies | Build Order |
|-----------|------|--------------|-------------|
| `src/lib/mcp/auth.ts` | Auth adapter | `src/lib/api/auth.ts` logic, `src/lib/api/rate-limit.ts` | 1st |
| `src/lib/mcp/tools.ts` | Tool definitions | `src/lib/services/*`, `src/lib/render/templates`, `src/lib/credits/check-credits` | 2nd |
| `src/app/api/[transport]/route.ts` | Route handler | `mcp-handler`, `src/lib/mcp/*` | 3rd |
| `packages/mcp-cli/` | npm package | `mcp-remote` | 4th (independent) |

### Modified Components

| Component | Change | Risk |
|-----------|--------|------|
| `src/middleware.ts` | Add `/api/mcp` to session auth bypass | LOW -- same pattern as existing `/api/v1` bypass |
| `package.json` | Add `mcp-handler` dependency | LOW |

### Unchanged Components (Reused As-Is)

| Component | How Reused |
|-----------|------------|
| `src/lib/api/auth.ts` | Auth logic extracted into `mcp/auth.ts` adapter |
| `src/lib/api/rate-limit.ts` | Called from `mcp/auth.ts` |
| `src/lib/services/carousel.ts` | Called directly from MCP tools |
| `src/lib/services/projects.ts` | Called directly from MCP tools |
| `src/lib/render/templates.ts` | Template list used by `list_templates` tool |
| `src/lib/credits/check-credits.ts` | Credit deduction in tool handlers |
| `src/lib/supabase/admin.ts` | Admin client for MCP tool DB access |

## Middleware Update

The existing middleware bypasses `/api/v1` for session auth. The `[transport]` dynamic route means the MCP endpoint lives at `/api/mcp`, which does NOT match `/api/v1`.

**Recommended approach -- widen the bypass:**
```typescript
// src/middleware.ts
if (request.nextUrl.pathname.startsWith('/api/v1') ||
    request.nextUrl.pathname.startsWith('/api/mcp')) {
  return
}
```

Alternative: use `/api/v1/mcp` as the path so it's already bypassed. But `/api/v1/mcp` is awkward -- MCP is not part of the REST API versioning scheme. Keep them separate.

## Session Management

MCP Streamable HTTP is stateless per-request (no persistent WebSocket). Each JSON-RPC request is an independent HTTP POST with its own Bearer token auth. This means:

- **No session state needed** on the server between MCP requests
- **No WebSocket upgrade** -- pure HTTP POST/response
- **Rate limiting** works per-key exactly as with REST
- **Credit tracking** works per-request exactly as with REST
- **`mcp-handler` handles** the JSON-RPC framing, optional SSE streaming for long-running tools, and transport negotiation internally

## Dynamic Route Conflict Check

The `[transport]` segment at `src/app/api/[transport]/route.ts` is a catch-all for `/api/*`. This could conflict with other `/api/*` routes. However, Next.js App Router resolves static routes before dynamic ones, so:

- `/api/v1/*` -- matches `src/app/api/v1/` (static, takes priority)
- `/api/webhooks/*` -- matches if it exists as a static route
- `/api/render` -- matches if it exists as a static route
- `/api/mcp` -- matches `src/app/api/[transport]/` (dynamic, as intended)

**Verify:** Check that no other `/api/*` routes exist that are NOT in a static folder. If any bare `/api/something` routes exist as dynamic, there could be conflicts. Based on codebase inspection, all API routes are under `/api/v1/` or in specific static folders, so no conflict.

## Anti-Patterns

### Anti-Pattern 1: MCP Tools Calling Internal REST Endpoints

**What people do:** MCP tool for `create_carousel` makes `fetch('http://localhost:3000/api/v1/carousel', ...)` internally.
**Why it's wrong:** Self-fetch in serverless (Vercel) can fail due to cold starts, connection limits, and potential circular invocation. Adds latency. Duplicates auth (MCP auth + REST auth on the same request).
**Do this instead:** Call service layer functions directly. The service layer is already decoupled from HTTP.

### Anti-Pattern 2: Using withApiAuth HOC for MCP Routes

**What people do:** Wrap the mcp-handler route with the existing `withApiAuth` HOC.
**Why it's wrong:** `withApiAuth` returns `NextResponse` objects with JSON error bodies. `mcp-handler`'s `withMcpAuth` needs to return proper MCP-spec error responses (JSON-RPC errors). Also, `withApiAuth` handles CORS which MCP does not need.
**Do this instead:** Use `withMcpAuth` with a `verifyToken` function that reuses the auth *logic* (key lookup, rate limiting) but not the *HTTP response formatting*.

### Anti-Pattern 3: Building a Custom stdio Server with Full Tool Logic

**What people do:** Implement all 4 MCP tools in the npm package, duplicating the business logic.
**Why it's wrong:** Two codebases to maintain. Business logic changes require npm package republishing.
**Do this instead:** The npm package should be a transport bridge only. All logic lives in the hosted server. Use `mcp-remote`.

### Anti-Pattern 4: Duplicating Validation Logic

**What people do:** Re-implement all the input validation from REST handlers inside MCP tool handlers.
**Why it's wrong:** Leads to divergence over time. Two places to update when validation rules change.
**Do this instead:** Use Zod schemas in MCP tool `inputSchema` (handled natively by mcp-handler) and let the service layer throw on invalid data. Keep complex validation in services if shared.

## Build Order

Based on dependency analysis:

1. **Install mcp-handler** -- `npm install mcp-handler` (requires `@modelcontextprotocol/sdk` >= 1.26.0, already have 1.27.1; requires `zod`, already installed)
2. **Auth adapter** (`src/lib/mcp/auth.ts`) -- depends only on existing `auth.ts` logic and `rate-limit.ts`
3. **Tool definitions** (`src/lib/mcp/tools.ts`) -- depends on auth adapter + existing services
4. **Route handler** (`src/app/api/[transport]/route.ts`) -- depends on auth + tools + `mcp-handler`
5. **Middleware update** (`src/middleware.ts`) -- trivial, do alongside route handler
6. **Test end-to-end** -- use Claude Desktop or curl with JSON-RPC to verify
7. **npm package** (`packages/mcp-cli/`) -- independent, can be done in parallel after route handler works
8. **MCP guide verification** (`docs/MCP-GUIDE.md`) -- after everything is wired up and tested

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k API keys | Current architecture is fine. Single Next.js deployment handles both REST and MCP. |
| 1k-10k API keys | Upstash Redis rate limiting already handles this. Monitor Supabase connection pooling. |
| 10k+ API keys | Consider edge caching for `list_templates` (static data). MCP tool calls are identical load to REST. |

## Sources

- [Vercel mcp-handler GitHub](https://github.com/vercel/mcp-handler) -- route handler pattern, withMcpAuth API, basePath configuration (HIGH confidence)
- [mcp-handler Authorization docs](https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md) -- Bearer token verification pattern (HIGH confidence)
- [mcp-handler docs site](https://www.mcphandler.org/docs) -- withMcpAuth usage, tool auth context (HIGH confidence)
- [mcp-remote npm](https://www.npmjs.com/package/mcp-remote) -- stdio-to-HTTP bridge for npm package (HIGH confidence)
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.27.1 already installed (HIGH confidence)
- Existing codebase inspection: `with-api-auth.ts`, `auth.ts`, `rate-limit.ts`, `carousel.ts`, `projects.ts`, `middleware.ts` (HIGH confidence)

---
*Architecture research for: MCP Server integration with ViralSlideMaker*
*Researched: 2026-04-08*

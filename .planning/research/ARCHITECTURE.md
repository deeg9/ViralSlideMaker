# Architecture Research

**Domain:** REST API & MCP Server for Carousel Image Creator
**Researched:** 2026-04-06
**Confidence:** HIGH

## System Overview

```
                              Consumers
          ┌─────────────────────┬──────────────────────┐
          │                     │                      │
     Web App (existing)   REST API Clients    MCP Clients (Claude, etc.)
          │                     │                      │
          │              Bearer API Key         stdio / Streamable HTTP
          │                     │                      │
          ▼                     ▼                      ▼
    ┌──────────┐      ┌──────────────────┐    ┌──────────────────┐
    │ Server   │      │  /api/v1/*       │    │ /api/mcp/[trans] │
    │ Actions  │      │  Route Handlers  │    │  mcp-handler     │
    │(existing)│      │  (NEW)           │    │  (NEW)           │
    └────┬─────┘      └────────┬─────────┘    └────────┬─────────┘
         │                     │                       │
         │              ┌──────┴───────┐               │
         │              │ API Auth     │               │
         │              │ Middleware   │◄──────────────┘
         │              │ (NEW)        │
         │              └──────┬───────┘
         │                     │
    ┌────┴─────────────────────┴──────────────────────────┐
    │                  Service Layer (NEW)                  │
    │  ┌────────────┐ ┌────────────┐ ┌─────────────────┐  │
    │  │ carousel   │ │ project    │ │ render           │  │
    │  │ service    │ │ service    │ │ service           │  │
    │  └────────────┘ └────────────┘ └─────────────────┘  │
    ├──────────────────────────────────────────────────────┤
    │                  Existing Infrastructure              │
    │  ┌──────────┐ ┌──────────┐ ┌──────┐ ┌───────────┐  │
    │  │ Gemini   │ │ Pexels   │ │Satori│ │ Supabase  │  │
    │  │ 2.5 Flash│ │ API      │ │/next │ │ (DB+Auth) │  │
    │  │          │ │          │ │ /og  │ │           │  │
    │  └──────────┘ └──────────┘ └──────┘ └───────────┘  │
    │  ┌──────────┐ ┌──────────────────────────────────┐  │
    │  │ Stripe   │ │ Credit System (Postgres RPC)     │  │
    │  └──────────┘ └──────────────────────────────────┘  │
    └──────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `/api/v1/*` Route Handlers | REST API endpoints (auth, CRUD, generation, render) | NEW |
| `/api/mcp/[transport]` | MCP protocol endpoint via `mcp-handler` | NEW |
| API Auth Middleware (`lib/api/auth.ts`) | Validate API keys via Bearer token, resolve to userId | NEW |
| Service Layer (`lib/services/`) | Shared business logic extracted from Server Actions | NEW (refactor) |
| `api_keys` table | Store hashed API keys, link to users, track usage | NEW |
| Server Actions (existing) | Continue serving web UI unchanged (thin wrappers) | MODIFY (extract logic) |
| Credit System (existing) | Meter API usage, same deduct_credits RPC | REUSE |
| Rate Limiter (existing) | Protect API endpoints | MODIFY (upgrade to Redis) |
| Render Route (existing `/api/render`) | PNG image generation via Satori/next-og | REUSE |

## Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── v1/                          # NEW: REST API v1
│   │   │   ├── carousels/
│   │   │   │   ├── route.ts             # POST /api/v1/carousels (one-shot)
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts          # GET /api/v1/carousels/:id
│   │   │   │       ├── slides/
│   │   │   │       │   └── [index]/
│   │   │   │       │       ├── route.ts  # PATCH slide text/image
│   │   │   │       │       └── render/
│   │   │   │       │           └── route.ts  # GET rendered PNG
│   │   │   │       └── render/
│   │   │   │           └── route.ts      # GET all slides as ZIP
│   │   │   ├── templates/
│   │   │   │   └── route.ts             # GET available templates
│   │   │   └── me/
│   │   │       └── route.ts             # GET current user info + credits
│   │   ├── mcp/
│   │   │   └── [transport]/
│   │   │       └── route.ts             # MCP protocol handler
│   │   ├── render/
│   │   │   └── route.ts                 # EXISTING: image render
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts             # EXISTING: Stripe webhooks
│   └── (dashboard)/                     # EXISTING: web UI (unchanged)
├── lib/
│   ├── api/                             # NEW: API-specific utilities
│   │   ├── auth.ts                      # API key validation + user resolution
│   │   ├── errors.ts                    # Standardized API error responses
│   │   └── response.ts                  # JSON response helpers
│   ├── services/                        # NEW: extracted business logic
│   │   ├── carousel-service.ts          # Generate carousel (from actions.ts)
│   │   ├── project-service.ts           # CRUD projects
│   │   ├── slide-service.ts             # Edit individual slides
│   │   └── render-service.ts            # Render slides to PNG
│   ├── mcp/                             # NEW: MCP tool definitions
│   │   └── tools.ts                     # Register MCP tools
│   ├── ai/                              # EXISTING (unchanged)
│   ├── credits/                         # EXISTING (unchanged)
│   ├── render/                          # EXISTING (unchanged)
│   ├── pexels/                          # EXISTING (unchanged)
│   └── supabase/                        # EXISTING (unchanged)
```

### Structure Rationale

- **`/api/v1/`**: Version prefix from day one. Folder-based versioning is the Next.js App Router convention. Cheap to add now, painful to retrofit later.
- **`/lib/services/`**: Extract business logic from Server Actions into plain async functions. Server Actions become thin wrappers. API routes call the same services. Single source of truth for all business logic.
- **`/api/mcp/[transport]/`**: Uses Vercel's `mcp-handler` package which needs a dynamic `[transport]` segment to handle both Streamable HTTP and SSE transports.
- **`/lib/api/`**: API-specific concerns (key validation, error formatting) kept separate from core business logic.

## Architectural Patterns

### Pattern 1: Service Extraction (Critical First Step)

**What:** Extract business logic from Server Actions into framework-agnostic service functions. Server Actions and API routes both call the same services.
**When to use:** Before building any API routes. This is the foundation.
**Trade-offs:** Small refactor cost upfront, but prevents duplicating logic between Server Actions and API routes.

**Current state (Server Actions contain all logic):**
```typescript
// app/(dashboard)/project/[id]/actions.ts — currently 165 lines
'use server'
export async function generateCarousel(projectId, topic, ...) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // auth check, credit check, AI generation, image fetch, DB write — all mixed together
}
```

**Target state (Service layer + thin wrappers):**
```typescript
// lib/services/carousel-service.ts — pure business logic
export async function generateCarousel(
  userId: string,
  params: GenerateCarouselParams
): Promise<CarouselResult> {
  // No auth — caller handles that. Just business logic.
  await ensureSubscription(userId)
  const credits = await checkCreditsForUser(userId)
  if (!credits.allowed) throw new InsufficientCreditsError(credits)
  const carousel = await generateSlideContent(params.topic, params.slideCount)
  // ... image fetch, DB write ...
}

// app/(dashboard)/project/[id]/actions.ts — thin wrapper
'use server'
export async function generateCarouselAction(projectId, topic, ...) {
  const user = await requireAuth()  // Supabase cookie auth
  return carouselService.generateCarousel(user.id, { projectId, topic, ... })
}

// app/api/v1/carousels/route.ts — thin wrapper
export async function POST(request: Request) {
  const { userId } = await requireApiKey(request)  // Bearer token auth
  const body = await parseBody(request, CreateCarouselSchema)
  return json(await carouselService.generateCarousel(userId, body))
}
```

**What to extract:** The following Server Action files contain extractable business logic:
- `src/app/(dashboard)/project/[id]/actions.ts` → `carousel-service.ts` (generateCarousel)
- `src/app/(dashboard)/project/[id]/editor-actions.ts` → `slide-service.ts` (saveSlideData, regenerateSlideText, regenerateSlideImageQuery, searchBackgroundPhotos, createUploadUrl, saveTemplateId)
- `src/app/(dashboard)/dashboard/actions.ts` → `project-service.ts` (CRUD operations)

### Pattern 2: Dual Auth (Cookie + API Key)

**What:** Web UI continues using Supabase cookie auth. API routes use Bearer token with API keys stored in a new `api_keys` table. Both resolve to a `userId` before entering the service layer.
**When to use:** Every API route needs this.
**Trade-offs:** Requires a new DB table and key management UI, but cleanly separates web auth from programmatic auth.

**Implementation:**
```typescript
// lib/api/auth.ts
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export async function requireApiKey(request: Request): Promise<{ id: string; userId: string }> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer vsm_')) {
    throw new ApiError(401, 'Missing or invalid Authorization header. Use: Bearer vsm_...')
  }

  const key = header.slice(7)
  const keyHash = crypto.createHash('sha256').update(key).digest('hex')

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single()

  if (!data) throw new ApiError(401, 'Invalid or revoked API key')

  // Update last_used_at (fire-and-forget, don't block response)
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then()

  return { id: data.id, userId: data.user_id }
}
```

**API key format:** `vsm_` prefix + 32 random hex chars. Prefix makes keys identifiable in logs and secret scanners. Only the SHA-256 hash is stored in DB — the plaintext key is shown once at creation.

### Pattern 3: MCP as Embedded Next.js Route (Not Separate Process)

**What:** MCP server runs inside the Next.js app via Vercel's `mcp-handler`. Tools call the service layer directly — no HTTP roundtrips.
**When to use:** This is the recommended approach for this project.
**Trade-offs:** Simplest deployment (same Vercel project). If a standalone CLI-installable MCP server is needed later (stdio for local Claude Desktop), use `mcp-remote` to proxy to the hosted endpoint.

**Decision rationale:**
- `mcp-handler` is Vercel's official MCP adapter for Next.js App Router
- Single deployment target (one Vercel project, zero new infrastructure)
- MCP tools call service functions directly — zero network overhead
- Supports Streamable HTTP transport (what remote MCP clients use)
- No Redis needed unless using SSE transport with resumability

**Implementation:**
```typescript
// app/api/mcp/[transport]/route.ts
import { createMcpHandler } from 'mcp-handler'
import { registerTools } from '@/lib/mcp/tools'

const handler = createMcpHandler(
  (server) => registerTools(server),
  { name: 'viral-slide-maker', version: '1.0.0' },
  { basePath: '/api/mcp', maxDuration: 60 }
)

export { handler as GET, handler as POST }

// lib/mcp/tools.ts
export function registerTools(server: McpServer) {
  server.registerTool('create_carousel', {
    description: 'Generate a complete TikTok/Instagram carousel from a topic.',
    parameters: z.object({
      topic: z.string(),
      slide_count: z.number().min(3).max(20).default(7),
      template: z.string().default('bold-minimal'),
      image_source: z.enum(['stock', 'ai']).default('stock'),
    }),
  }, async (args) => {
    const result = await carouselService.generateCarousel(userId, args)
    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  })

  server.registerTool('edit_slide', { ... }, async (args) => { ... })
  server.registerTool('render_carousel', { ... }, async (args) => { ... })
  server.registerTool('list_templates', { ... }, async (args) => { ... })
}
```

**MCP Auth:** MCP clients authenticate via the same API key mechanism. The `mcp-handler` passes headers through — the tool implementation extracts the Bearer token and resolves the user. This needs to be wired into the tool context.

### Pattern 4: Standardized API Error Responses

**What:** All API errors use a consistent JSON shape with machine-readable error codes.
**When to use:** Every API route and MCP tool error.

```typescript
// lib/api/errors.ts
export function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}

// Usage in route handler
try {
  const { userId } = await requireApiKey(request)
  const body = await parseBody(request, schema)
  const result = await carouselService.generateCarousel(userId, body)
  return Response.json({ data: result })
} catch (err) {
  if (err instanceof ApiError) return errorResponse(err.status, 'AUTH_ERROR', err.message)
  if (err instanceof InsufficientCreditsError) return errorResponse(402, 'INSUFFICIENT_CREDITS', err.message)
  if (err instanceof ZodError) return errorResponse(400, 'VALIDATION_ERROR', err.message)
  return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
}
```

## Data Flow

### One-Shot Carousel Generation (REST API)

```
Client: POST /api/v1/carousels
  Headers: { Authorization: "Bearer vsm_abc123..." }
  Body: { topic: "5 Morning Habits", slide_count: 7, template: "bold-minimal" }
    │
    ▼
Route Handler (app/api/v1/carousels/route.ts)
    │ 1. requireApiKey(request) → { userId }
    │ 2. parseBody(request, CreateCarouselSchema) → validated params
    ▼
carouselService.generateCarousel(userId, params)
    │ 3. ensureSubscription(userId)
    │ 4. deductCredit(userId, 'api_carousel_generation', ...)
    │ 5. generateSlideContent(topic) → Gemini 2.5 Flash → structured slides
    │ 6. searchPhotos() per slide → Pexels background images
    │ 7. INSERT project into Supabase
    ▼
Response: { data: { project_id, title, slides[], render_url_template } }
```

### MCP Tool Invocation

```
AI Agent connects via Streamable HTTP to /api/mcp/mcp
    │ Auth header: Bearer vsm_abc123...
    │ Tool call: create_carousel({ topic: "5 Morning Habits" })
    ▼
mcp-handler routes to registered create_carousel tool
    │ Extract API key from request context
    │ requireApiKey() → { userId }
    ▼
carouselService.generateCarousel(userId, params)
    │ (identical flow as REST)
    ▼
MCP response: { content: [{ type: "text", text: "{ project_id: ..., slides: [...] }" }] }
```

### Key Data Flows

1. **Service layer is the convergence point:** Web UI Server Actions, REST API routes, and MCP tools all call the same service functions. Auth is resolved before entering services — services receive `userId`, never raw tokens.
2. **Credit deduction is atomic and reused:** The existing Postgres RPC `deduct_credits` handles race conditions. API calls use the exact same credit system as web — no separate metering needed. A new credit type `'api_carousel_generation'` distinguishes API usage in billing reports.
3. **Render is already an API route:** The existing `/api/render` endpoint returns PNG images given a projectId and slide index. The REST API can expose this with API key auth at `/api/v1/carousels/:id/slides/:index/render`.

## New Database Objects

### `api_keys` table

```sql
CREATE TABLE api_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,                    -- user-friendly label ("My CLI Key")
  key_prefix text NOT NULL,              -- first 8 chars for display ("vsm_a1b2...")
  key_hash text NOT NULL UNIQUE,         -- SHA-256 of full key
  scopes text[] DEFAULT '{}',            -- future: granular permissions
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE revoked_at IS NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own keys" ON api_keys
  FOR ALL USING (auth.uid() = user_id);
```

### Middleware Changes Required

The existing `src/middleware.ts` redirects unauthenticated users to `/login`. API routes must be excluded:

```typescript
// middleware.ts — add these to the early return
if (request.nextUrl.pathname.startsWith('/api/v1') ||
    request.nextUrl.pathname.startsWith('/api/mcp')) {
  return  // API routes handle their own auth via Bearer tokens
}
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k API users | Current architecture works. In-memory rate limiter is unreliable on Vercel but acceptable at low scale. |
| 1k-10k API users | MUST replace in-memory rate limiter with Upstash Redis. Add API key hash caching (in-memory LRU, 60s TTL). |
| 10k+ API users | Consider async generation with job queue. Return 202 Accepted + polling endpoint for long-running carousels. |

### Scaling Priorities

1. **First bottleneck: Rate limiting.** The current in-memory rate limiter (`src/lib/rate-limit.ts`) uses `Map` objects that reset on every cold start and are per-instance on Vercel. This is a known issue (noted in the code: "For production with multiple serverless instances, replace with Upstash Redis"). Must fix before API launch.
2. **Second bottleneck: Vercel function timeout.** One-shot carousel generation (Gemini AI + 7 Pexels requests + DB write) takes 10-20s typically. The 60s maxDuration is set. AI image generation (Imagen) can push this higher. Monitor and consider async pattern if timeouts occur.
3. **Third bottleneck: API key lookups.** Every API request hits Supabase to validate the key hash. At high volume, add an in-memory LRU cache with short TTL (60s). Key revocation is eventually consistent but acceptable.

## Anti-Patterns

### Anti-Pattern 1: Duplicating Logic in API Routes

**What people do:** Copy-paste generation logic from `actions.ts` into API route handlers.
**Why it's wrong:** Two copies drift apart. Credit deduction logic diverges. Bugs fixed in one place aren't fixed in the other.
**Do this instead:** Extract to service layer first. Both Server Actions and API routes are thin auth wrappers delegating to the same service.

### Anti-Pattern 2: 1:1 REST-to-MCP Mapping

**What people do:** Create one MCP tool per REST endpoint (create_project, set_template, generate_content, search_photos, swap_image, regenerate_text, render_slide, download_zip).
**Why it's wrong:** AI agents perform better with high-level, intention-based tools. Too many granular tools confuse LLMs and increase error rates.
**Do this instead:** Create 3-5 curated MCP tools: `create_carousel` (one-shot), `edit_slide` (modify text/image), `render_carousel` (get images), `list_templates`. Let agents complete common workflows in 1-2 tool calls.

### Anti-Pattern 3: MCP Server as Separate Process

**What people do:** Build the MCP server as a standalone Node.js package that calls the REST API over HTTP.
**Why it's wrong:** For this project size, it adds deployment complexity (two services), network latency on every tool call, and CORS/auth complications. Over-engineering.
**Do this instead:** Use `mcp-handler` to embed MCP inside the Next.js app. Same deployment, same services, zero network overhead. If a standalone stdio MCP server is needed later for Claude Desktop, use `mcp-remote` to proxy to the hosted Streamable HTTP endpoint.

### Anti-Pattern 4: API Keys in Supabase RLS Context

**What people do:** Try to use Supabase Row Level Security policies with API key auth.
**Why it's wrong:** RLS is tied to Supabase Auth JWTs. API keys bypass Supabase Auth entirely — there is no JWT.
**Do this instead:** API key validation uses the admin client (service role key). The service layer handles authorization checks manually (e.g., "does this user_id own this project?").

### Anti-Pattern 5: Blocking on Rate Limiter Migration

**What people do:** Delay API launch until Redis rate limiting is perfectly implemented.
**Why it's wrong:** At launch scale (dozens of users), the in-memory rate limiter works well enough. Premature optimization.
**Do this instead:** Launch with in-memory rate limiter. Upgrade to Upstash Redis when usage grows or when you observe rate limit bypasses in logs. Budget 1-2 hours for the migration — Upstash Redis is a drop-in replacement.

## Zod Version Compatibility Note

The project uses Zod 4.x (`"zod": "^4.3.6"`). `mcp-handler` requires `zod@^3`. Zod 4 ships a `zod/v3` compatibility export that should satisfy this requirement. Verify during implementation:

```typescript
// If mcp-handler fails with Zod 4, try:
import { z } from 'zod/v3'
// Pass this z to mcp-handler tool definitions
```

If incompatible, install `zod@3` as a separate dependency for MCP tools only. This is a known friction point.

## Required New Packages

```bash
npm install mcp-handler @modelcontextprotocol/sdk
# Zod already installed (check v3 compat)
# @upstash/redis — add when upgrading rate limiter
```

## Suggested Build Order

Based on dependency analysis, each step builds on the previous:

1. **Service extraction** — Extract business logic from Server Actions into `lib/services/`. Pure refactor, no new features. All existing behavior must be preserved. This unblocks everything else.
2. **API key infrastructure** — `api_keys` table + migration, key generation utility, `requireApiKey()` auth function, key management page in settings UI.
3. **REST API routes** — Build `/api/v1/` endpoints using the service layer. Start with read-only (GET project, GET templates, GET credits), then one-shot generation (POST carousels), then granular edits (PATCH slide), then render endpoints.
4. **MCP server** — Register 3-5 curated tools in `mcp-handler` calling the same services. Test with Claude Code.
5. **Rate limiting upgrade** — Replace in-memory limiter with Upstash Redis before scaling API access publicly.

## Sources

- [Vercel mcp-handler](https://github.com/vercel/mcp-handler) — Official Vercel MCP adapter for Next.js (HIGH confidence)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — Official MCP SDK (HIGH confidence)
- [MCP SDK Server Docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — Server implementation guide (HIGH confidence)
- [Building APIs with Next.js](https://nextjs.org/blog/building-apis-with-nextjs) — Next.js API best practices (HIGH confidence)
- [Next.js Route Handlers Guide](https://makerkit.dev/blog/tutorials/nextjs-api-best-practices) — App Router API patterns (MEDIUM confidence)
- [Transform REST API to MCP Server](https://dzone.com/articles/transform-nodejs-rest-api-to-mcp-server) — Pattern for wrapping REST APIs as MCP (MEDIUM confidence)
- [Building Custom MCP Servers with Next.js](https://www.trevorlasn.com/blog/building-custom-mcp-servers-with-nextjs-and-mcp-handler) — Practical mcp-handler tutorial (MEDIUM confidence)
- Codebase analysis: `src/app/api/render/route.ts`, `src/app/(dashboard)/project/[id]/actions.ts`, `src/app/(dashboard)/project/[id]/editor-actions.ts`, `src/lib/credits/check-credits.ts`, `src/lib/rate-limit.ts`, `src/middleware.ts`

---
*Architecture research for: v2.0 REST API & MCP Platform integration with existing Next.js carousel creator*
*Researched: 2026-04-06*

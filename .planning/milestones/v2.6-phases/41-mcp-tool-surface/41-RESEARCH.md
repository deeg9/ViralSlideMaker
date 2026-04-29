# Phase 41: MCP Tool Surface - Research

**Researched:** 2026-04-28
**Domain:** MCP tool registration on `mcp-handler@1.1.0` + service-layer wiring
**Confidence:** HIGH

## Summary

Phase 41 is pure service-wiring research: register exactly 4 tools (`list_templates`, `create_carousel`, `edit_slide`, `render_carousel`) inside the empty `setup` callback at `src/app/api/[transport]/route.ts:14`, with handlers calling existing service functions in `src/lib/services/` directly (no HTTP re-entry). All key APIs are confirmed against the installed `node_modules`:

- `mcp-handler@1.1.0` sets `req.auth = AuthInfo` (declared globally in `dist/index.d.ts:124-127`); the SDK's `RequestHandlerExtra` exposes the same on `extra.authInfo` — so `cb(args, extra)` reads `extra.authInfo?.extra?.userId` to honor the Phase 40 cross-phase contract.
- The `McpServer.tool(name, description, paramsSchema, cb)` overload (deprecated but stable; `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:136`) accepts a Zod **raw shape** (plain object of zod field schemas — NOT a wrapped `z.object({...})`). The newer `registerTool(name, config, cb)` form is preferred for forward-compat.
- Tool errors are returned as `{ content: [{ type: 'text', text }], isError: true }` — NOT thrown OAuth errors. OAuth errors are auth-layer only (`verifyToken`).

**Primary recommendation:** Use `server.registerTool(name, { description, inputSchema: zodRawShape }, cb)` for all 4 tools, read `userId` from `extra.authInfo?.extra?.userId`, mirror the credit-deduct + refund pattern in `src/app/api/v1/carousel/route.ts:79-115` exactly for `create_carousel`, and on insufficient credits return `{ isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'INSUFFICIENT_CREDITS', ... }) }] }` (NOT a thrown OAuthError — that's auth-layer only).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Exact tool list (lean scope):** 4 tools, no more, no less. Broader v2.5 surface (publish, fork, bookmarks, brand-kit, profile, credits, AI image gen, Pexels search, slide CRUD beyond edit_slide) deferred to v2.7+.
- **Tool registry location:** `src/lib/mcp/tools.ts`. New file. Must be additively extensible — v2.7+ should add tools by appending to the same registry without architectural rework.
- **Tools call services directly:** import from `src/lib/services/carousel.ts`, `src/lib/services/projects.ts`, `src/lib/services/render.ts` (or wherever render lives). NEVER fetch internal `/api/v1/*` URLs from inside a tool — that would re-trigger auth/rate-limit/credit deduction.
- **Auth context from Phase 40:** read `userId` and `keyId` from `AuthInfo.extra` (set in `src/lib/mcp/auth.ts:36`). Pass `userId` to service functions; `keyId` is for rate-limit attribution if needed.
- **Credit accounting:** `create_carousel` deducts exactly 1 credit via `deductCreditAdmin` (same pattern as `POST /api/v1/carousel`). On insufficient credits, return MCP-protocol-correct error. On generation failure after deduction, refund via the catch pattern already used in `src/app/api/v1/carousel/route.ts`.
- **`edit_slide` patch surface:** accept the same 9 fields as `PATCH /api/v1/projects/{id}/slides/{index}` — `hook_text`, `body_text`, `image_query`, `background_url`, `style_overrides`, `custom_texts`, `custom_images`, `hook_segments`, `body_segments`.
- **`render_carousel` returns URLs only:** never inline binary image data. Return `{ slides: [{ index, downloadUrl }], zipUrl }`.
- **Tool descriptions are self-contained** — agent completes the create→edit→render loop using only `tools/list` output.
- **Tool registration on the existing server:** modify `src/app/api/[transport]/route.ts:14` to import from `src/lib/mcp/tools.ts` and pass to `createMcpHandler`'s setup callback.

### Claude's Discretion

- Exact MCP error shape for insufficient credits (researcher confirms below — use `isError: true` content block, NOT thrown OAuthError).
- Tool input schema format (researcher confirms below — Zod raw shape via `server.tool` or `server.registerTool`).
- `dashboardUrl` shape: env-configurable base URL via `NEXT_PUBLIC_APP_URL` then `VERCEL_URL` fallback (matches the precedent at `src/lib/services/publish.ts:73` and `src/app/(dashboard)/project/[id]/publish-actions.ts:120`).
- Test organization under `src/__tests__/mcp/tools/` — mirror the per-tool file pattern used in Phase 40.

### Deferred Ideas (OUT OF SCOPE)

- Broader tool surface (publish, fork, bookmarks, brand-kit, profile, credits, AI image gen, Pexels search, full slide CRUD) → v2.7+
- MCP Resources or Prompts (per spec terminology) → v2.6 is Tools-only
- Stateful sessions / sampling → out of scope
- Tool-specific rate limits → uses shared per-key budget from Phase 40

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-TOOL-01 | `list_templates` returns same shape as `GET /api/v1/templates`. Free. | `templates` array confirmed at `src/lib/render/templates/index.ts:40-46` (5 templates: highlightBar, newsDrop, newsCyan, y2kPop, boldYellow). REST projection (`{ id, name, thumbnail, textPosition, textAlign }`) at `src/app/api/v1/templates/route.ts:6-12`. |
| MCP-TOOL-02 | `create_carousel` accepts `{ topic, templateId, slideCount?, imageSource? }`, deducts 1 credit, returns `{ projectId, slideCount, dashboardUrl }`. | `generateCarousel(supabase, userId, input)` confirmed at `src/lib/services/carousel.ts:28-32` (signature unchanged from v2.3). Credit pattern at `src/app/api/v1/carousel/route.ts:79-115`. |
| MCP-TOOL-03 | `edit_slide` accepts `{ projectId, slideIndex, patch }` with the 9-field whitelist. Free. | Whitelist confirmed at `src/app/api/v1/projects/[id]/slides/[index]/route.ts:41-51`. Service flow: `getProject` → mutate `slide_data[i]` → `updateProjectService(supabase, userId, projectId, { slide_data })`. Both at `src/lib/services/projects.ts:13-22, 47-59`. |
| MCP-TOOL-04 | `render_carousel` returns `{ slides: [{ index, downloadUrl }], zipUrl }`. URLs only. Free. | Pattern at `src/app/api/v1/projects/[id]/render/route.ts:36-48`. URL shape: `${origin}/api/render?projectId=${id}&slide=${i}&download` for slides, `${origin}/api/v1/projects/${id}/download` for ZIP. No service abstraction exists — the URL construction lives directly in the route. Phase 41 reproduces this in the tool handler using an env-derived origin. |
| MCP-TOOL-05 | Tool descriptions self-contained. | Validated by manual MCP Inspector smoke test (script provided in Validation Architecture section below). |
| MCP-TOOL-06 | Registry pattern accepts new tools cleanly. | Recommended pattern: `tools.ts` exports `registerTools(server: McpServer)` that calls `server.registerTool(...)` for each of the 4 tools. v2.7+ adds new `server.registerTool(...)` calls inside the same function — zero architectural change. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool definitions (schemas + handlers) | API / Backend (`src/lib/mcp/tools.ts`) | — | Pure server-side; handlers call services directly. |
| Tool registration | API / Backend (`src/app/api/[transport]/route.ts` setup callback) | — | Phase 40 wired the route; Phase 41 fills the empty setup. |
| Auth context propagation | API / Backend (mcp-handler injects via `extra.authInfo`) | — | `verifyToken` (Phase 40) sets `extra: { userId, keyId }`. |
| Carousel generation | API / Backend (`src/lib/services/carousel.ts`) | Database (Supabase) | Service already exists; tool just calls it. |
| Slide editing | API / Backend (`src/lib/services/projects.ts`) | Database (Supabase) | Service already exists; tool reproduces REST PATCH's filter+merge logic in TS. |
| Credit gating | API / Backend (`src/lib/credits/check-credits.ts`) | Database (RPC) | Reuse `deductCreditAdmin` + manual refund pattern. |
| Render URL construction | API / Backend (tool handler) | CDN / Storage | URL strings only; actual image generation happens at the `/api/render` route on subsequent download. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `mcp-handler` | 1.1.0 | Vercel's Next.js MCP adapter; provides `createMcpHandler` + `withMcpAuth` | [VERIFIED: node_modules/mcp-handler/package.json] Already installed by Phase 40. |
| `@modelcontextprotocol/sdk` | 1.29.0 | `McpServer`, `AuthInfo`, OAuth error classes, types | [VERIFIED: node_modules/@modelcontextprotocol/sdk/package.json] Already installed by Phase 40. |
| `zod` | ^4.3.6 | Tool input schemas (raw shape format expected by `server.tool` / `server.registerTool`) | [VERIFIED: package.json line 49] |

### Supporting (existing — no new installs)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | (existing) | DB queries via admin client | Service functions accept `SupabaseClient` |
| `pexels` | (existing) | Background image search | `searchPhotos` if `edit_slide` patches `image_query` (see note below) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `server.tool(name, desc, zodRawShape, cb)` (deprecated) | `server.registerTool(name, { description, inputSchema, outputSchema?, annotations? }, cb)` (current) | `registerTool` is the non-deprecated form; supports `outputSchema` for structured content + tool annotations. **Recommendation: use `registerTool`.** [CITED: node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:148-157] |
| Zod raw shape `{ topic: z.string(), ... }` | Wrapped `z.object({ topic: z.string() })` | The SDK overloads explicitly take `ZodRawShapeCompat` (raw shape, NOT a wrapped object schema). Wrapping it WILL fail tool input validation silently. [CITED: mcp.d.ts:126, 250 — `Args extends ZodRawShapeCompat`] |
| Throw `OAuthError` from tool handler | Return `{ isError: true, content: [...] }` | OAuth errors are for the **auth layer** (`verifyToken`). Tool handlers must return the error in-band per the MCP spec. The SDK explicitly converts thrown errors to `createToolError` (`node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js:140-162`). **Recommendation: in-band `isError`.** |

**Installation:** None required. All deps installed by Phase 40.

**Version verification:** Confirmed against installed packages (not npm registry — no need to re-verify; Phase 40 just shipped these versions and the lockfile pins them).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────┐
│ MCP Client (agent)  │
│ Claude Desktop /    │
│ Cursor / Inspector  │
└──────────┬──────────┘
           │ JSON-RPC 2.0 over Streamable HTTP
           │ Authorization: Bearer vsl_***
           ▼
┌─────────────────────────────────────────────────┐
│ /api/mcp (src/app/api/[transport]/route.ts)     │  ◄── Phase 40 (built)
│   withMcpAuth(handler, verifyToken)             │
│     │                                           │
│     ├─► verifyToken (src/lib/mcp/auth.ts)       │
│     │     SHA-256 + DB + timing-safe + RL       │
│     │     → AuthInfo.extra = { userId, keyId }  │
│     │                                           │
│     └─► createMcpHandler( setup ◄── Phase 41 fills here )
└──────────┬──────────────────────────────────────┘
           │ ToolCallback(args, extra)
           │ extra.authInfo.extra.userId
           ▼
┌─────────────────────────────────────────────────┐
│ src/lib/mcp/tools.ts  ◄── Phase 41 NEW          │
│   registerTools(server) → 4 server.registerTool │
│     ├─ list_templates                           │
│     ├─ create_carousel  (1 credit)              │
│     ├─ edit_slide                               │
│     └─ render_carousel                          │
└──────────┬──────────────────────────────────────┘
           │ direct function calls (NO HTTP re-entry)
           ▼
┌─────────────────────────────────────────────────┐
│ Service layer (src/lib/services/, src/lib/credits/)
│   ├─ generateCarousel(supabase, userId, input) │
│   ├─ getProject(supabase, userId, id)          │
│   ├─ updateProjectService(supabase, userId,…)  │
│   ├─ searchPhotos(query, opts)  (edit_slide)   │
│   └─ deductCreditAdmin / getCreditBalanceAdmin │
└──────────┬──────────────────────────────────────┘
           │ SQL + RPC
           ▼
   Supabase (admin client, service-role key)
```

### Component Responsibilities

| File | Responsibility | Status |
|------|----------------|--------|
| `src/app/api/[transport]/route.ts` | MCP route + auth wrap; calls `registerTools(server)` in setup. | MODIFY (fill setup callback, lines 13-18) |
| `src/lib/mcp/tools.ts` | Export `registerTools(server: McpServer)` that registers all 4 tools. | NEW |
| `src/lib/mcp/auth.ts` | (Phase 40) verifyToken sets `AuthInfo.extra`. | UNCHANGED |
| `src/lib/services/carousel.ts` | `generateCarousel` — backs `create_carousel`. | UNCHANGED (called from tool) |
| `src/lib/services/projects.ts` | `getProject`, `updateProjectService` — back `edit_slide` and `render_carousel`. | UNCHANGED |
| `src/lib/credits/check-credits.ts` | `deductCreditAdmin`, `getCreditBalanceAdmin`. | UNCHANGED |
| `src/lib/render/templates/index.ts` | `templates` array — backs `list_templates`. | UNCHANGED |

### Recommended `tools.ts` Structure

```
src/lib/mcp/
├── auth.ts          # (Phase 40) verifyToken
└── tools.ts         # (Phase 41) NEW
    └── registerTools(server: McpServer): void
```

Inside `tools.ts`, four logically-separated `server.registerTool(...)` calls. v2.7+ appends new `server.registerTool(...)` calls to the same function — additive, zero refactor.

### Pattern 1: Tool registration with Zod raw shape
**What:** Pass a raw object of zod field schemas to `server.registerTool`. The SDK normalizes it internally.
**When to use:** Every tool with input parameters.
**Example:**
```typescript
// Source: node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:148-157
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

server.registerTool(
  'create_carousel',
  {
    description: 'Create a new carousel from a topic. Costs 1 credit. Returns projectId, slideCount, and a dashboardUrl the user can open in browser.',
    inputSchema: {
      topic: z.string().min(1).max(500).describe('Carousel topic (e.g. "5 productivity tips for remote workers")'),
      templateId: z.string().describe('Template ID from list_templates (e.g. "highlight-bar", "news-drop")'),
      slideCount: z.number().int().min(3).max(10).optional().describe('Number of slides (3-10). Default 7.'),
      imageSource: z.enum(['stock', 'ai']).optional().describe('"stock" = Pexels (free); "ai" = Imagen (slower). Default stock.'),
    },
  },
  async (args, extra) => {
    const userId = extra.authInfo?.extra?.userId as string | undefined
    if (!userId) {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'UNAUTHORIZED' }) }] }
    }
    // ... handler body
    return { content: [{ type: 'text', text: JSON.stringify({ projectId, slideCount, dashboardUrl }) }] }
  }
)
```

### Pattern 2: Reading Phase 40 AuthInfo inside a tool handler
**What:** `extra.authInfo?.extra?.userId` — the SDK passes `RequestHandlerExtra` as the second arg to every tool callback.
**When to use:** Every tool except `list_templates` (which doesn't need userId).
**Example:**
```typescript
// Source: node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts:181 (`authInfo?: AuthInfo`)
//         node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/types.d.ts:30 (`extra?: Record<string, unknown>`)
// Phase 40 contract (src/lib/mcp/auth.ts:36-40, asserted in src/__tests__/mcp/auth.test.ts:50-55):
//   extra: { userId: string, keyId: string }

const userId = extra.authInfo?.extra?.userId as string | undefined
const keyId = extra.authInfo?.extra?.keyId as string | undefined
if (!userId) {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'UNAUTHORIZED', message: 'Missing auth context' }) }] }
}
```

### Pattern 3: Credit deduct + refund (mirroring REST)
**What:** Check balance → deduct → call service → on failure, insert refund row.
**When to use:** `create_carousel` only (the only paid tool in v2.6).
**Example:**
```typescript
// Source: src/app/api/v1/carousel/route.ts:73-115
import { createAdminClient } from '@/lib/supabase/admin'
import { deductCreditAdmin, getCreditBalanceAdmin, getUserTier, checkProjectLimit, FREE_TIER_PROJECT_LIMIT } from '@/lib/credits/check-credits'
import { generateCarousel } from '@/lib/services/carousel'

const supabase = createAdminClient()

// Free-tier project-count cap (matches REST)
const tier = await getUserTier(userId)
const projectAllowed = await checkProjectLimit(userId, tier)
if (!projectAllowed) {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({
    error: 'PROJECT_LIMIT_EXCEEDED',
    message: `Free plan is limited to ${FREE_TIER_PROJECT_LIMIT} projects. Upgrade for unlimited.`,
  }) }] }
}

// Free-tier slide-count cap (matches REST line 55-61)
if (tier === 'free' && validSlideCount > 3) {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({
    error: 'VALIDATION_ERROR',
    message: 'Free plan is limited to 3 slides per carousel. Upgrade to hobbyist or creator for up to 10.',
  }) }] }
}

// Credit balance check + atomic deduct
const balance = await getCreditBalanceAdmin(supabase, userId)
if (balance < 1) {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({
    error: 'INSUFFICIENT_CREDITS',
    message: 'You need at least 1 credit to create a carousel.',
    creditsRemaining: balance,
  }) }] }
}
const deducted = await deductCreditAdmin(supabase, userId, 'carousel_generation', `MCP: ${topic}`, undefined, 1)
if (!deducted) {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({
    error: 'INSUFFICIENT_CREDITS',
    message: 'Credit deduction failed (race condition or insufficient balance).',
  }) }] }
}

try {
  const result = await generateCarousel(supabase, userId, { topic, templateId, slideCount, imageSource })
  return { content: [{ type: 'text', text: JSON.stringify({
    projectId: result.projectId,
    slideCount: result.slideCount,
    dashboardUrl: `${getAppUrl()}/project/${result.projectId}`,
  }) }] }
} catch (err) {
  // Refund — mirrors src/app/api/v1/carousel/route.ts:106-114
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: 1,
    description: 'Carousel generation failed (MCP)',
  })
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({
    error: 'GENERATION_FAILED',
    message: err instanceof Error ? err.message : 'Unknown error',
  }) }] }
}

function getAppUrl(): string {
  // Mirrors src/lib/services/publish.ts:73 + src/app/(dashboard)/project/[id]/publish-actions.ts:120
  return process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
}
```

### Pattern 4: edit_slide — reproduce REST PATCH filter+merge
**What:** Reuse the exact 9-field whitelist + style_overrides deep-merge logic from `src/app/api/v1/projects/[id]/slides/[index]/route.ts:41-126`.
**Why:** Single source of truth would require extracting a service helper (out of scope for this phase). Reproducing the logic in `tools.ts` is acceptable for v2.6 — flag for extraction in v2.7+.

```typescript
// Source: src/app/api/v1/projects/[id]/slides/[index]/route.ts:41-126

const ALLOWED_PATCH_FIELDS = [
  'hook_text', 'body_text', 'hook_segments', 'body_segments',
  'image_query', 'background_url', 'style_overrides',
  'custom_texts', 'custom_images',
] as const

// Inside the tool handler, after fetching project and validating slideIndex:
const patchFields: Record<string, unknown> = {}
for (const field of ALLOWED_PATCH_FIELDS) {
  if (field in patch) patchFields[field] = patch[field]
}

// Validate background_url scheme (T-25-02 — matches REST line 84-87)
if (typeof patchFields.background_url === 'string' && !patchFields.background_url.startsWith('https://')) {
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({
    error: 'VALIDATION_ERROR', message: 'background_url must use https://'
  }) }] }
}

// Deep-merge style_overrides (matches REST line 105-117)
let mergedStyleOverrides = existingSlide.style_overrides
if (patchFields.style_overrides && typeof patchFields.style_overrides === 'object') {
  mergedStyleOverrides = {
    ...(existingSlide.style_overrides as Record<string, unknown> | undefined),
    ...(patchFields.style_overrides as Record<string, unknown>),
  }
}
const updatedSlide = {
  ...existingSlide,
  ...patchFields,
  ...(patchFields.style_overrides ? { style_overrides: mergedStyleOverrides } : {}),
}
```

**Note on `image_query` semantics:** REST PATCH does NOT auto-fetch a Pexels photo when `image_query` changes — it only updates the field. The v2.3 `tools.ts` plan (line 182) ADDED that behavior, which is a divergence. Recommendation: **match REST exactly — `edit_slide` does NOT call `searchPhotos`**. If the agent wants a new image, it provides `background_url` directly. Document this clearly in the tool description so the agent doesn't expect surprise Pexels behavior.

### Anti-Patterns to Avoid

- **Wrapping schema in `z.object({...})`:** SDK expects raw shape. `z.object({...})` will fail validation silently. [CITED: mcp.d.ts:126,150,250]
- **Throwing OAuthError from a tool handler:** OAuth errors are for `verifyToken` only. Tool handlers must use in-band `{ isError: true, content: [...] }`. [CITED: mcp.js:140-162]
- **Calling `fetch('http://localhost:3000/api/v1/...')` from a tool handler:** double-auth, double-rate-limit, double-credit. Forbidden by the locked decision in CONTEXT.md.
- **Inlining base64 image data in `render_carousel` response:** explicitly forbidden by MCP-TOOL-04 — return URLs only.
- **Hardcoding `https://viralslidemaker.com` as the dashboard URL base:** use the env-derived `getAppUrl()` helper (matches `src/lib/services/publish.ts:73` precedent) — supports staging + self-hosted.
- **Using `bold-minimal` as default templateId:** that template doesn't exist in v2.5 (the v2.3 plan referenced it; the actual template list is highlightBar, newsDrop, newsCyan, y2kPop, boldYellow). Make `templateId` REQUIRED — force the agent to call `list_templates` first. This actually improves the workflow (one of the agent-discovery goals of MCP-TOOL-05).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool input validation | Custom JSON-Schema validator | Zod raw shape passed to `server.registerTool` | SDK calls `safeParseAsync` automatically; failures become `McpError(InvalidParams)` with proper formatting (`mcp.js:166-181`). |
| Tool error responses | Custom JSON-RPC error envelopes | `{ isError: true, content: [{ type: 'text', text }] }` | The SDK converts thrown errors to this shape (`mcp.js:152-162`); be consistent. |
| Carousel generation | Re-implement Gemini + Pexels orchestration in the tool | `generateCarousel(supabase, userId, input)` from `src/lib/services/carousel.ts` | 158-line existing service; tool just calls it. |
| Credit deduction | Custom INSERT into `credit_transactions` | `deductCreditAdmin(supabase, userId, type, desc, ref, amount)` | Calls atomic Postgres RPC `deduct_credits` (`check-credits.ts:67-75`); race-safe. |
| Project read/write | Direct Supabase queries | `getProject` / `updateProjectService` (`src/lib/services/projects.ts:13, 47`) | Already scope-by-userId; no SQL injection risk; consistent with REST. |
| App base URL detection | Hardcoded string | `process.env.NEXT_PUBLIC_APP_URL ?? VERCEL_URL ?? localhost` | Existing precedent at `src/lib/services/publish.ts:73`. |
| Templates list | Maintain a parallel list | Import `templates` from `@/lib/render/templates` | Single source of truth — adding a template later automatically appears in `list_templates`. |

**Key insight:** Phase 41 is gluing existing services to MCP tool slots. The hardest decisions are protocol-correctness (in-band errors, raw-shape schemas), not business logic. Resist any urge to refactor service signatures — those are stable contracts used by REST routes that already work.

## Common Pitfalls

### Pitfall 1: Zod schema wrapping
**What goes wrong:** `inputSchema: z.object({ topic: z.string() })` instead of `inputSchema: { topic: z.string() }`.
**Why it happens:** Most Zod docs show `z.object`; intuition wraps everything. The SDK explicitly takes a raw shape — its internal `normalizeObjectSchema` then constructs the `z.object` itself.
**How to avoid:** Type-check against `ZodRawShapeCompat` from `@modelcontextprotocol/sdk/server/zod-compat.js` if the IDE flags it; the typed overloads (mcp.d.ts:126, 136) will catch it.
**Warning signs:** `tools/list` returns the tool but every `tools/call` fails input validation.

### Pitfall 2: AuthInfo path is double-nested
**What goes wrong:** `extra.userId` instead of `extra.authInfo.extra.userId`.
**Why it happens:** The SDK exposes `extra: RequestHandlerExtra`, which has its own `extra._meta` and the auth object at `authInfo`. The Phase 40 `verifyToken` then sets a SECOND `extra` field on `AuthInfo` itself. So the full path is `(callback's extra).authInfo.extra.userId`.
**How to avoid:** Add a helper at the top of `tools.ts`:
```typescript
function getUserId(extra: { authInfo?: { extra?: Record<string, unknown> } }): string | undefined {
  return extra.authInfo?.extra?.userId as string | undefined
}
```
**Warning signs:** Tool handler receives undefined userId despite valid Bearer auth; `verifyToken` test still passes.

### Pitfall 3: Throwing instead of returning errors
**What goes wrong:** `throw new InvalidRequestError(...)` from a tool handler.
**Why it happens:** OAuth error classes are tempting (they're already imported in Phase 40's auth.ts).
**How to avoid:** OAuth errors are auth-layer only. Tool handlers RETURN `{ isError: true, content: [{ type: 'text', text }] }`. The SDK does catch unhandled throws and convert them, but using the in-band shape gives the agent structured error data.
**Warning signs:** MCP Inspector shows "Tool execution failed" instead of your structured error JSON.

### Pitfall 4: Empty tool descriptions
**What goes wrong:** Description is one terse line ("Creates a carousel."). Agent fails to discover the workflow.
**Why it happens:** Programmer instinct.
**How to avoid:** Each description must include: (1) what it does, (2) when to use it, (3) what it returns, (4) credit cost, (5) prerequisites (e.g., "call list_templates first to get a templateId"). MCP-TOOL-05 is a hard verification target.
**Warning signs:** MCP Inspector smoke test requires the human to look at REST docs to make the tool sequence work.

### Pitfall 5: Forgetting refund on `generateCarousel` failure
**What goes wrong:** Credit deducted, generation throws, user is silently down 1 credit.
**Why it happens:** REST has it; MCP's parallel implementation easily forgets.
**How to avoid:** Wrap `generateCarousel` call in try/catch and insert a `credit_transactions` refund row. EXACT pattern at `src/app/api/v1/carousel/route.ts:106-114`. Also covers the failure case in tests.
**Warning signs:** No automated test asserting "deduction is refunded on failure."

### Pitfall 6: Templates list shape drift
**What goes wrong:** REST returns `{ id, name, thumbnail, textPosition, textAlign }`; MCP returns just `{ id, name, textPosition, textAlign }` (the v2.3 plan's projection).
**Why it happens:** v2.3 plan was written before `thumbnail` existed in the projection.
**How to avoid:** Import the same projection function (or inline the same destructuring) the REST route uses (`src/app/api/v1/templates/route.ts:6-12`). MCP-TOOL-01 says "same shape."
**Warning signs:** A contract test comparing REST `/api/v1/templates` and MCP `list_templates` outputs would catch this.

### Pitfall 7: stale v2.3 reference to "bold-minimal"
**What goes wrong:** Default-`templateId` to `'bold-minimal'` per `27-01-PLAN.md` line 162.
**Why it happens:** v2.3 was written when that template existed; v2.5 trim removed it.
**How to avoid:** Verify against `src/lib/render/templates/index.ts:40-46` — the actual templates are `highlight-bar`, `news-drop`, `news-cyan`, `y2k-pop`, `bold-yellow`. Recommendation: make `templateId` REQUIRED (not optional with a default) — forces the agent to call `list_templates` first, which is the intended workflow.
**Warning signs:** `getTemplate('bold-minimal')` falls back to `templates[0]` (highlightBar), so the carousel succeeds but with the wrong style.

## Code Examples

### Tool 1: list_templates (free)

```typescript
// Source: src/app/api/v1/templates/route.ts:5-15 (REST projection)
import { templates } from '@/lib/render/templates'

server.registerTool(
  'list_templates',
  {
    description: [
      'List available carousel visual styles. Call this FIRST to discover valid templateId values before using create_carousel.',
      'Returns id, name, thumbnail, textPosition, and textAlign for each template.',
      'No credit cost. No authentication required beyond the standard MCP Bearer token.',
      '',
      'Typical workflow: list_templates → create_carousel(topic, templateId) → edit_slide(...) → render_carousel(projectId).',
    ].join(' '),
    inputSchema: {},
  },
  async () => {
    const data = templates.map(({ id, name, thumbnail, textPosition, textAlign }) => ({
      id, name, thumbnail, textPosition, textAlign,
    }))
    return { content: [{ type: 'text', text: JSON.stringify({ templates: data }) }] }
  }
)
```

### Tool 2: create_carousel (1 credit)

See Pattern 3 above for the full handler. Input schema:

```typescript
inputSchema: {
  topic: z.string().min(1).max(500).describe('Carousel topic. Example: "5 productivity tips for remote workers".'),
  templateId: z.string().describe('Template ID from list_templates. Required. Example: "highlight-bar".'),
  slideCount: z.number().int().min(3).max(10).optional().describe('Slide count (3-10). Default 7. Free plan caps at 3.'),
  imageSource: z.enum(['stock', 'ai']).optional().describe('"stock" = Pexels (fast, free); "ai" = Imagen (slower, higher visual quality). Default "stock".'),
}
```

### Tool 3: edit_slide (free)

```typescript
// Source: src/app/api/v1/projects/[id]/slides/[index]/route.ts:41-126

server.registerTool(
  'edit_slide',
  {
    description: [
      'Edit a single slide in an existing carousel project. No credit cost.',
      'Provide projectId from create_carousel, slideIndex (0-based), and a patch object.',
      'Patch supports any of: hook_text, body_text, hook_segments, body_segments, image_query,',
      'background_url (must be https://), style_overrides (deep-merged), custom_texts, custom_images.',
      'Omit fields you do not want to change. background_url is the direct way to swap an image —',
      'image_query updates the metadata field but does NOT auto-fetch a new image.',
      'After editing, call render_carousel to get fresh download URLs.',
    ].join(' '),
    inputSchema: {
      projectId: z.string().uuid().describe('Project ID from create_carousel.'),
      slideIndex: z.number().int().min(0).describe('Zero-based slide index.'),
      patch: z.object({
        hook_text: z.string().optional(),
        body_text: z.string().optional(),
        hook_segments: z.array(z.unknown()).optional(),
        body_segments: z.array(z.unknown()).optional(),
        image_query: z.string().optional(),
        background_url: z.string().url().startsWith('https://').optional(),
        style_overrides: z.record(z.string(), z.unknown()).optional(),
        custom_texts: z.array(z.unknown()).optional(),
        custom_images: z.array(z.unknown()).optional(),
      }).describe('Object containing the fields to update. At least one field required.'),
    },
  },
  async ({ projectId, slideIndex, patch }, extra) => {
    const userId = extra.authInfo?.extra?.userId as string | undefined
    if (!userId) return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'UNAUTHORIZED' }) }] }
    if (!patch || Object.keys(patch).length === 0) {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'VALIDATION_ERROR', message: 'patch must contain at least one field' }) }] }
    }
    const supabase = createAdminClient()
    let project
    try { project = await getProject(supabase, userId, projectId) }
    catch { return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'NOT_FOUND', message: 'Project not found' }) }] } }
    const slideData = (project.slide_data as Record<string, unknown>[] | null) ?? []
    if (slideIndex >= slideData.length) {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'NOT_FOUND', message: 'Slide not found' }) }] }
    }
    // ... apply ALLOWED_PATCH_FIELDS filter + style_overrides deep-merge (Pattern 4)
    // ... await updateProjectService(supabase, userId, projectId, { slide_data: updatedArray })
    return { content: [{ type: 'text', text: JSON.stringify({ slide: updatedSlide }) }] }
  }
)
```

### Tool 4: render_carousel (free)

```typescript
// Source: src/app/api/v1/projects/[id]/render/route.ts:34-48

server.registerTool(
  'render_carousel',
  {
    description: [
      'Get fresh download URLs for every slide in a carousel project, plus a ZIP URL containing all slides.',
      'Use this after create_carousel or edit_slide. No credit cost.',
      'URLs are absolute, ready for the user to open or fetch. URLs are signed and time-limited.',
      'Returns { slides: [{ index, downloadUrl }], zipUrl }. NEVER returns inline image binary data.',
    ].join(' '),
    inputSchema: {
      projectId: z.string().uuid().describe('Project ID from create_carousel.'),
    },
  },
  async ({ projectId }, extra) => {
    const userId = extra.authInfo?.extra?.userId as string | undefined
    if (!userId) return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'UNAUTHORIZED' }) }] }
    const supabase = createAdminClient()
    let project
    try { project = await getProject(supabase, userId, projectId) }
    catch { return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'NOT_FOUND' }) }] } }
    const slides = (project.slide_data as unknown[] | null) ?? []
    if (slides.length === 0) {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: 'NOT_FOUND', message: 'Project has no slides' }) }] }
    }
    const baseUrl = getAppUrl() // env-derived (see Pattern 3)
    const slideUrls = slides.map((_, index) => ({
      index,
      downloadUrl: `${baseUrl}/api/render?projectId=${projectId}&slide=${index}&download`,
    }))
    return { content: [{ type: 'text', text: JSON.stringify({
      slides: slideUrls,
      zipUrl: `${baseUrl}/api/v1/projects/${projectId}/download`,
    }) }] }
  }
)
```

**Note on URL signing:** REST `/api/render` does NOT currently issue signed URLs — it issues plain URLs that re-authenticate the request (the `/api/render` route presumably checks auth against the project's user_id). The MCP tool MUST NOT pretend the URLs are signed if they aren't. Either:
- (a) Document them as "session-bound URLs valid only when fetched by a client with the same Bearer token" — but this is wrong because `/api/render` is a Next.js page-style route, not an API route.
- (b) Confirm with the codebase: does `/api/render` accept anonymous downloads, or does it require auth? **Open Question (see below).**

For Phase 41, return them at face value, matching exactly what REST returns. Defer signed-URL design to v2.7+.

## Runtime State Inventory

> Phase 41 is greenfield code addition (1 new file + edit to one existing file's setup callback). No rename, refactor, or migration involved. Section omitted.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `mcp-handler` | route + tool registration | Yes | 1.1.0 | — |
| `@modelcontextprotocol/sdk` | McpServer type, AuthInfo, errors | Yes | 1.29.0 | — |
| `zod` | tool input schemas | Yes | 4.3.6 | — |
| Supabase admin client | service-layer DB calls | Yes (existing) | — | — |
| `NEXT_PUBLIC_APP_URL` env var | dashboardUrl + render URLs | Optional | — | `VERCEL_URL` then `http://localhost:3000` (matches existing precedent) |
| MCP Inspector | manual smoke test | npx-installable | latest | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `NEXT_PUBLIC_APP_URL` is optional in dev (falls through to localhost). In production, Vercel auto-sets `VERCEL_URL`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `vitest.config.ts` (jsdom env by default; tools tests should use `// @vitest-environment node` directive matching Phase 40 `route.test.ts`) |
| Quick run command | `npx vitest run src/__tests__/mcp/tools/ --no-coverage` |
| Full suite command | `npx vitest run --no-coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MCP-TOOL-01 | `list_templates` returns same shape as REST | unit | `npx vitest run src/__tests__/mcp/tools/list_templates.test.ts -x --no-coverage` | Wave 0 |
| MCP-TOOL-02 | `create_carousel` deducts 1 credit, calls service, returns `{ projectId, slideCount, dashboardUrl }` | unit | `npx vitest run src/__tests__/mcp/tools/create_carousel.test.ts -x --no-coverage` | Wave 0 |
| MCP-TOOL-02 | `create_carousel` returns INSUFFICIENT_CREDITS isError on balance < 1 | unit (same file) | `npx vitest run src/__tests__/mcp/tools/create_carousel.test.ts -t "insufficient" --no-coverage` | Wave 0 |
| MCP-TOOL-02 | `create_carousel` refunds credit on `generateCarousel` failure | unit (same file) | `npx vitest run src/__tests__/mcp/tools/create_carousel.test.ts -t "refund" --no-coverage` | Wave 0 |
| MCP-TOOL-03 | `edit_slide` filters to 9 whitelisted fields and merges style_overrides | unit | `npx vitest run src/__tests__/mcp/tools/edit_slide.test.ts -x --no-coverage` | Wave 0 |
| MCP-TOOL-03 | `edit_slide` rejects non-https background_url | unit (same file) | `npx vitest run src/__tests__/mcp/tools/edit_slide.test.ts -t "https" --no-coverage` | Wave 0 |
| MCP-TOOL-04 | `render_carousel` returns `{ slides: [{ index, downloadUrl }], zipUrl }` | unit | `npx vitest run src/__tests__/mcp/tools/render_carousel.test.ts -x --no-coverage` | Wave 0 |
| MCP-TOOL-04 | `render_carousel` never returns binary `image/*` content | unit (same file, asserts content-type 'text' only) | `npx vitest run src/__tests__/mcp/tools/render_carousel.test.ts -t "no binary" --no-coverage` | Wave 0 |
| MCP-TOOL-05 | Tool descriptions self-contained | manual MCP Inspector smoke test | manual: see script below | manual |
| MCP-TOOL-05 | Each tool description ≥ 200 chars and includes "credit" or "no credit cost" | unit (lint) | `npx vitest run src/__tests__/mcp/tools/contract.test.ts -t "descriptions" --no-coverage` | Wave 0 |
| MCP-TOOL-06 | `tools/list` returns exactly 4 tools with the documented names | integration | `npx vitest run src/__tests__/mcp/tools/contract.test.ts -t "tools/list" --no-coverage` | Wave 0 |
| Cross-phase | Tool handlers can read `extra.authInfo.extra.userId` (Phase 40 contract) | integration | `npx vitest run src/__tests__/mcp/tools/contract.test.ts -t "auth context" --no-coverage` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/mcp/tools/ --no-coverage`
- **Per wave merge:** `npx vitest run src/__tests__/mcp/ --no-coverage` (includes Phase 40 tests too — catches cross-phase regressions)
- **Phase gate:** `npx vitest run --no-coverage` full suite green before `/gsd-verify-work`. Existing 8 pre-existing failures (per Phase 40 SUMMARY line 199) are out-of-scope tolerances — do not let new failures land.

### Wave 0 Gaps
- [ ] `src/__tests__/mcp/tools/list_templates.test.ts` — covers MCP-TOOL-01
- [ ] `src/__tests__/mcp/tools/create_carousel.test.ts` — covers MCP-TOOL-02 (3 sub-cases: happy path, insufficient credits, refund-on-failure)
- [ ] `src/__tests__/mcp/tools/edit_slide.test.ts` — covers MCP-TOOL-03 (2 sub-cases: whitelist filter, https validation)
- [ ] `src/__tests__/mcp/tools/render_carousel.test.ts` — covers MCP-TOOL-04 (2 sub-cases: URL shape, no binary)
- [ ] `src/__tests__/mcp/tools/contract.test.ts` — covers MCP-TOOL-06 + auth-context contract + description quality lint

**No framework install needed** — vitest is the existing project framework. Use the same mocking patterns established in `src/__tests__/mcp/auth.test.ts` (vi.mock for service-layer modules) and `src/__tests__/mcp/route.test.ts` (`@vitest-environment node` directive).

**Manual MCP Inspector smoke test (MCP-TOOL-05 verification):**
```bash
# Terminal 1
npm run dev

# Terminal 2
npx -y @modelcontextprotocol/inspector
# In Inspector UI:
#   URL: http://localhost:3000/api/mcp
#   Authorization: Bearer vsl_<your_test_key>
# Verify:
#   1. tools/list returns exactly 4 tools (list_templates, create_carousel, edit_slide, render_carousel)
#   2. Each tool description reads as a self-contained instruction
#   3. Run sequence with NO REFERENCE TO EXTERNAL DOCS:
#      a. list_templates → pick a templateId
#      b. create_carousel({ topic: "test", templateId }) → get projectId
#      c. edit_slide({ projectId, slideIndex: 0, patch: { hook_text: "edited" } })
#      d. render_carousel({ projectId }) → get downloadUrls and zipUrl
#   4. Open dashboardUrl in browser → confirms cross-modal handoff works
```

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (delegated to Phase 40) | `withMcpAuth` + `verifyToken` already wrap the route |
| V3 Session Management | No | Stateless transport (`sessionIdGenerator: undefined`) |
| V4 Access Control | Yes | Every service call passes `userId` from auth — Supabase queries scope by user_id (`projects.ts:17, 51-58`) |
| V5 Input Validation | Yes | Zod raw shape on every tool input. SDK calls `safeParseAsync` (`mcp.js:174`); failures become `McpError(InvalidParams)` |
| V6 Cryptography | No new surface | Phase 40 owns SHA-256 + timingSafeEqual; tools don't touch crypto |
| V7 Error Handling | Yes | In-band `{ isError: true }` content — no stack traces leaked to agents (mirror Pitfall 6 from Phase 27 plan: error codes only) |
| V8 Data Protection | Yes | `dashboardUrl` and `downloadUrl` use https in production (env-derived); never inline image bytes |

### Known Threat Patterns for MCP tool handlers

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofing userId via tool params | Spoofing | NEVER accept userId as a tool parameter — read from `extra.authInfo.extra.userId` only. Same as the original Phase 27 plan T-27-01. |
| Cross-user project access | Elevation of Privilege | All `getProject` / `updateProjectService` calls pass `userId` — Supabase queries scope by user_id (existing service guarantees). |
| `background_url` SSRF / injection | Tampering | Validate `background_url` starts with `https://` (matches REST line 84-87, Phase 27 T-27-02). |
| Credit-bypass race condition | DoS / fraud | `deductCreditAdmin` calls atomic Postgres RPC `deduct_credits` (`check-credits.ts:67-75`). Double-check pattern (balance check + deduct) prevents most races. |
| Information disclosure via error messages | Information Disclosure | Return generic error codes (NOT_FOUND, INSUFFICIENT_CREDITS, GENERATION_FAILED) — never raw stack traces. Phase 40 already strips bearer tokens from auth-layer error messages (`auth.ts:46-49`); tool layer must apply same discipline to service exceptions. |
| Rate-limit bypass via MCP path | DoS | Phase 40 already keys Upstash limiter by keyId (shared with REST). No new mitigation needed in Phase 41. |
| Slide-index out-of-bounds | Tampering | Zod `int().min(0)` + manual `slideIndex >= slideData.length` check (matches REST line 98-100). |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `/api/render` is callable without an MCP Bearer token (i.e., the URLs in `render_carousel` are usable by browser/curl directly) | Tool 4 + Open Q1 | If wrong, agents get URLs that 401 when followed — workflow breaks silently. Worth grepping `src/app/api/render/route.ts` during Wave 0. [ASSUMED] |
| A2 | `extra.authInfo` is set by `withMcpAuth` on every tool callback (not just on the request handler) | Pattern 2 | If `withMcpAuth` only sets `req.auth` and the SDK doesn't propagate to `extra.authInfo`, tool handlers can't read auth. Mitigation: integration test in `contract.test.ts`. [ASSUMED — based on `RequestHandlerExtra.authInfo` typing at `protocol.d.ts:181`, but NOT confirmed by reading mcp-handler 1.1.0's exact propagation code] |
| A3 | `server.registerTool` is preferred over `server.tool` for forward-compat | Standard Stack | Both work today; `tool` is marked deprecated in mcp.d.ts:124. Using `tool` is acceptable; `registerTool` is just future-proof. [CITED: mcp.d.ts:110, 124, 148] |

## Open Questions

1. **Does `/api/render` require auth?**
   - What we know: REST returns plain URLs; the route presumably reads `projectId` and serves a Satori-rendered image.
   - What's unclear: Whether the URL is followable by an unauthenticated client. If yes — agents can stream image bytes directly. If no — they need to embed a session, which doesn't exist for stateless MCP.
   - Recommendation: Wave 0 task should `Read src/app/api/render/route.ts` and document the answer in the SUMMARY. If auth-required, add a `note` field to `render_carousel` output explaining the URLs need the user's browser session OR an authenticated `/api/v1/projects/{id}/download` GET.

2. **Should `edit_slide` auto-fetch a Pexels photo when `image_query` changes?**
   - What we know: The v2.3 plan (line 182) said yes. REST PATCH says no.
   - What's unclear: Which is the intent for v2.6?
   - Recommendation: **Match REST exactly (no auto-fetch)**. Document explicitly in the tool description: "image_query updates metadata only; use background_url to swap an image."

3. **Should `templateId` be required or default to `'highlight-bar'`?**
   - What we know: v2.3 plan defaulted to `'bold-minimal'` (no longer exists). Current first template (`templates[0]`) is `highlight-bar` (used by `getTemplate` fallback).
   - Recommendation: **Make REQUIRED** (no default). Forces the agent to call `list_templates` first, which is the intended discovery workflow. If the agent is dumb enough to skip discovery, the schema rejection is a clear signal.

## Sources

### Primary (HIGH confidence)
- `node_modules/mcp-handler/dist/index.d.ts` — full type surface for `createMcpHandler`, `withMcpAuth`, `getPublicUrl`
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:108-211` — `McpServer.tool` and `registerTool` overloads
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js:60-211` — runtime behavior (input validation, tool error format, auth propagation via setRequestHandler)
- `node_modules/@modelcontextprotocol/sdk/dist/esm/shared/protocol.d.ts:181` — `RequestHandlerExtra.authInfo`
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/types.d.ts` — AuthInfo with `extra?: Record<string, unknown>`
- `node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/errors.d.ts` — full OAuth error class list
- `src/lib/services/carousel.ts` (lines 28-185), `src/lib/services/projects.ts` (lines 13-59), `src/lib/credits/check-credits.ts` (lines 59-84), `src/lib/render/templates/index.ts` (lines 8-50) — service signatures CONFIRMED unchanged
- `src/app/api/v1/carousel/route.ts` (lines 73-115) — credit deduct + refund pattern
- `src/app/api/v1/projects/[id]/slides/[index]/route.ts` (lines 41-126) — 9-field PATCH whitelist + style_overrides merge
- `src/app/api/v1/projects/[id]/render/route.ts` (lines 34-48) — render URL shape
- `src/app/api/v1/templates/route.ts` (lines 5-15) — templates projection
- `src/lib/mcp/auth.ts:36-40` — Phase 40 AuthInfo.extra contract
- `src/__tests__/mcp/auth.test.ts:50-55` — contract assertion (cross-phase)
- `src/lib/services/publish.ts:73`, `src/app/(dashboard)/project/[id]/publish-actions.ts:120` — env-derived base URL precedent

### Secondary (MEDIUM confidence)
- `.planning/phases/27-mcp-tools/27-01-PLAN.md` — retired v2.3 plan; tool patterns largely valid but: (a) defaults `'bold-minimal'` template no longer exists, (b) `image_query` auto-fetch behavior diverges from REST, (c) `dashboardUrl` not previously addressed.

### Tertiary (LOW confidence)
- `/api/render` auth model (Open Question 1) — not verified in this research session.

## State of the Art

| Old Approach (v2.3) | Current Approach (v2.6) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `server.tool(name, desc, schema, cb)` | `server.registerTool(name, { description, inputSchema, ... }, cb)` | SDK 1.x deprecation cycle | `tool` still works (deprecated comment, mcp.d.ts:124); use `registerTool` for forward-compat. |
| Default `templateId: 'bold-minimal'` | Required `templateId` (force `list_templates` call) | v2.5 template trim removed bold-minimal | Stale defaults silently fall back to `templates[0]` (highlightBar) — wrong style without errors. |
| Auto-Pexels fetch on `image_query` change in `edit_slide` | No auto-fetch — match REST | Consistency with v2.5 REST behavior | Agent gets predictable behavior; uses `background_url` for image swaps. |

**Deprecated/outdated:**
- v2.3 plan's `'bold-minimal'` references — replace with `highlight-bar` if a default is needed; recommended: no default.
- v2.3's `creditsRemaining` post-deduction read in `create_carousel` response — keep it (useful UX for agents tracking quota), but make it optional.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and verified against `node_modules`
- Architecture: HIGH — service signatures verified line-by-line against current `src/`
- Pitfalls: HIGH — derived from reading actual SDK source (mcp.js) plus retired v2.3 plan's mistakes
- Auth propagation (Pattern 2 / A2): MEDIUM — typed correctly per `protocol.d.ts:181` but not confirmed by reading mcp-handler's runtime propagation. Wave 0 contract test will close this.
- `/api/render` auth model (Open Q1): LOW — not researched. Wave 0 task should resolve.

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (mcp-handler 1.x is stable; SDK 1.x is stable; service layer is locked by Phase 40).

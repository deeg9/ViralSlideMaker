// src/app/api/[transport]/route.ts
//
// MCP Streamable HTTP endpoint at /api/mcp.
//
// BUILD GATE (MCP-TRANS-06): the static `import { createMcpHandler, withMcpAuth } from 'mcp-handler'`
// below is what makes `next build` (and `npm run build`) fail fast if `mcp-handler` is missing
// from `node_modules`. Do NOT change to `import type` and do NOT switch to dynamic
// `await import('mcp-handler')` — that is the exact failure mode that retired v2.3
// (the route returned HTTP 500 at request time instead of failing at build time).
import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyToken } from '@/lib/mcp/auth'

const handler = createMcpHandler(
  (_server) => {
    // Phase 41 will register tools here:
    //   list_templates, create_carousel, edit_slide, render_carousel
    // Phase 40 ships an empty server — `tools/list` returns [].
  },
  {
    serverInfo: {
      name: 'viralslidemaker-mcp',
      version: '0.1.0',
    },
    capabilities: { tools: {} },
  },
  {
    basePath: '/api',                 // → /api/mcp via the [transport] segment
    maxDuration: 60,                  // matches REST /api/v1/carousel
    disableSse: true,                 // SSE deprecated by MCP spec 2025-03-26
    redisUrl: undefined,              // explicit: defeat KV_URL/REDIS_URL auto-detect; stateless transport needs no Redis
    // sessionIdGenerator OMITTED → stateless transport (Vercel serverless safe)
  }
)

const authHandler = withMcpAuth(handler, verifyToken, { required: true })

export { authHandler as GET, authHandler as POST, authHandler as DELETE }
export const maxDuration = 60

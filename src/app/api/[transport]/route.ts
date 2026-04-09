import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyToken } from '@/lib/mcp/auth'

// Vercel function timeout: 60s for long-running MCP tool calls (Phase 27)
export const maxDuration = 60

// Create MCP Streamable HTTP handler
// - Empty setup: no tools registered yet (Phase 27 adds them via src/lib/mcp/tools.ts)
// - No sessionIdGenerator: stateless transport mode (per TRANS-03, Vercel-compatible)
// - basePath '/api': so /api/mcp resolves via the [transport] dynamic segment
const handler = createMcpHandler(
  (server) => {
    // Tools registered in Phase 27 -- see src/lib/mcp/tools.ts
  },
  {},
  { basePath: '/api' }
)

// Wrap with Bearer token auth (required: true rejects unauthenticated requests)
const authHandler = withMcpAuth(handler, verifyToken, { required: true })

export { authHandler as GET, authHandler as POST, authHandler as DELETE }

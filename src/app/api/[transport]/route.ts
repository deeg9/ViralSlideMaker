import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyToken } from '@/lib/mcp/auth'
import { registerTools } from '@/lib/mcp/tools'

export const maxDuration = 60

const handler = createMcpHandler(
  (server) => {
    registerTools(server)
  },
  {},
  { basePath: '/api' }
)

// Wrap with Bearer token auth (required: true rejects unauthenticated requests)
const authHandler = withMcpAuth(handler, verifyToken, { required: true })

export { authHandler as GET, authHandler as POST, authHandler as DELETE }

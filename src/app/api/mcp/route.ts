import { createMcpHandler } from 'mcp-handler'
import { withMcpAuth } from 'mcp-handler'
import { registerTools } from '@/lib/mcp/tools'
import { verifyMcpToken } from '@/lib/mcp/auth'

const handler = createMcpHandler(
  (server) => registerTools(server),
  {
    serverInfo: { name: 'viralslidemaker', version: '1.0.0' },
  },
  {
    basePath: '/api/mcp',
    maxDuration: 60,
  }
)

const authHandler = withMcpAuth(handler, verifyMcpToken, { required: true })

export const GET = authHandler
export const POST = authHandler

export const maxDuration = 60

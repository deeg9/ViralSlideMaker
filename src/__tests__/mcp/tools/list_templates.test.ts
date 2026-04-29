// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// Mock heavy service modules to avoid evaluating Pexels client init at module load
// (src/lib/services/carousel.ts -> src/lib/pexels/search-photos.ts requires PEXELS_API_KEY).
vi.mock('@/lib/services/carousel', () => ({ generateCarousel: vi.fn() }))
vi.mock('@/lib/services/projects', () => ({
  getProject: vi.fn(),
  updateProjectService: vi.fn(),
}))
vi.mock('@/lib/credits/check-credits', () => ({
  deductCreditAdmin: vi.fn(),
  getCreditBalanceAdmin: vi.fn(),
  getUserTier: vi.fn(),
  checkProjectLimit: vi.fn(),
  FREE_TIER_PROJECT_LIMIT: 3,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn(() => ({})) }))

import { registerTools } from '@/lib/mcp/tools'

describe('list_templates tool (MCP-TOOL-01)', () => {
  it('returns templates with the same projection as REST GET /api/v1/templates', async () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' })
    registerTools(server)
    // SDK stores tool callback under `handler` (see node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:274)
    const registered = ((server as unknown) as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<{ content: { text: string }[] }> }> })._registeredTools
    const result = await registered.list_templates.handler({}, { authInfo: { extra: { userId: 'u', keyId: 'k' } } })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.templates).toBeInstanceOf(Array)
    expect(parsed.templates.length).toBeGreaterThan(0)
    // Each item must have the 5 projection keys (matches src/app/api/v1/templates/route.ts:6-12)
    for (const t of parsed.templates) {
      expect(t).toHaveProperty('id')
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('thumbnail')
      expect(t).toHaveProperty('textPosition')
      expect(t).toHaveProperty('textAlign')
    }
  })
})

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const mocks = vi.hoisted(() => ({
  getProjectMock: vi.fn(),
}))

// Mock all heavy modules — carousel service must be mocked even if unused, otherwise its
// top-level Pexels client init blows up without PEXELS_API_KEY.
vi.mock('@/lib/services/carousel', () => ({ generateCarousel: vi.fn() }))
vi.mock('@/lib/services/projects', () => ({
  getProject: mocks.getProjectMock,
  updateProjectService: vi.fn(),
}))
vi.mock('@/lib/credits/check-credits', () => ({
  deductCreditAdmin: vi.fn(),
  getCreditBalanceAdmin: vi.fn(),
  getUserTier: vi.fn(),
  checkProjectLimit: vi.fn(),
  FREE_TIER_PROJECT_LIMIT: 3,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { registerTools } from '@/lib/mcp/tools'

function getRenderCarousel() {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server)
  // SDK stores tool callback under `handler` (see node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:274)
  return ((server as unknown) as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text?: string; type: string }[] }> }> })._registeredTools.render_carousel
}

const VALID_AUTH = { authInfo: { extra: { userId: 'u', keyId: 'k' } } }
const PROJECT_ID = '00000000-0000-0000-0000-000000000002'

describe('render_carousel tool (MCP-TOOL-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProjectMock.mockResolvedValue({ id: PROJECT_ID, slide_data: [{}, {}, {}] })
  })

  it('returns { slides: [{ index, downloadUrl }], zipUrl } with HTTPS URLs', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://viralslidemaker.com'
    const tool = getRenderCarousel()
    const res = await tool.handler({ projectId: PROJECT_ID }, VALID_AUTH)
    expect(res.isError).toBeFalsy()
    const body = JSON.parse(res.content[0].text!)
    expect(body.slides).toHaveLength(3)
    expect(body.slides[0]).toEqual({
      index: 0,
      downloadUrl: expect.stringContaining(`https://viralslidemaker.com/api/render?projectId=${PROJECT_ID}&slide=0`),
    })
    expect(body.zipUrl).toBe(`https://viralslidemaker.com/api/v1/projects/${PROJECT_ID}/download`)
  })

  it('never returns binary image content (only type:text content blocks)', async () => {
    const tool = getRenderCarousel()
    const res = await tool.handler({ projectId: PROJECT_ID }, VALID_AUTH)
    for (const block of res.content) {
      expect(block.type).toBe('text')
    }
  })
})

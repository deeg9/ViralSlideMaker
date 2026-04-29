// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const mocks = vi.hoisted(() => ({
  getProjectMock: vi.fn(),
  updateProjectServiceMock: vi.fn(),
}))

// Mock all heavy modules — carousel service must be mocked even if unused, otherwise its
// top-level Pexels client init blows up without PEXELS_API_KEY.
vi.mock('@/lib/services/carousel', () => ({ generateCarousel: vi.fn() }))
vi.mock('@/lib/services/projects', () => ({
  getProject: mocks.getProjectMock,
  updateProjectService: mocks.updateProjectServiceMock,
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

function getEditSlide() {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server)
  // SDK stores tool callback under `handler` (see node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:274)
  return ((server as unknown) as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }> })._registeredTools.edit_slide
}

const VALID_AUTH = { authInfo: { extra: { userId: 'u', keyId: 'k' } } }
const PROJECT_ID = '00000000-0000-0000-0000-000000000001'

describe('edit_slide tool (MCP-TOOL-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getProjectMock.mockResolvedValue({
      id: PROJECT_ID,
      slide_data: [{ hook_text: 'old', body_text: 'old', style_overrides: { hook_font_size: 90 } }],
    })
    mocks.updateProjectServiceMock.mockResolvedValue(undefined)
  })

  it('filters patch to the 9 whitelisted fields and deep-merges style_overrides', async () => {
    const tool = getEditSlide()
    const res = await tool.handler(
      {
        projectId: PROJECT_ID,
        slideIndex: 0,
        patch: {
          hook_text: 'new',
          body_text: 'new',
          not_allowed: 'rejected',
          style_overrides: { hook_text_color: '#fff' },
        },
      },
      VALID_AUTH
    )
    expect(res.isError).toBeFalsy()
    expect(mocks.updateProjectServiceMock).toHaveBeenCalledTimes(1)
    const updateCall = mocks.updateProjectServiceMock.mock.calls[0]
    const slideData = (updateCall[3] as { slide_data: Array<Record<string, unknown>> }).slide_data
    expect(slideData[0].hook_text).toBe('new')
    expect(slideData[0].body_text).toBe('new')
    expect(slideData[0]).not.toHaveProperty('not_allowed')
    // Deep merge: existing hook_font_size preserved, new hook_text_color added
    expect((slideData[0].style_overrides as Record<string, unknown>).hook_font_size).toBe(90)
    expect((slideData[0].style_overrides as Record<string, unknown>).hook_text_color).toBe('#fff')
  })

  it('rejects non-https background_url', async () => {
    const tool = getEditSlide()
    const res = await tool.handler(
      { projectId: PROJECT_ID, slideIndex: 0, patch: { background_url: 'http://insecure.example.com/img.jpg' } },
      VALID_AUTH
    )
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('VALIDATION_ERROR')
    expect(mocks.updateProjectServiceMock).not.toHaveBeenCalled()
  })

  it('returns NOT_FOUND when slideIndex is out of bounds', async () => {
    const tool = getEditSlide()
    const res = await tool.handler(
      { projectId: PROJECT_ID, slideIndex: 99, patch: { hook_text: 'x' } },
      VALID_AUTH
    )
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('NOT_FOUND')
  })
})

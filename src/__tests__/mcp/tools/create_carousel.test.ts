// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// vi.mock factories are hoisted above all top-level statements, so we cannot reference
// regular `const` mocks inside them. vi.hoisted() lets us declare mocks that ARE hoisted
// alongside the vi.mock calls.
const mocks = vi.hoisted(() => {
  const insertMock = vi.fn(() => Promise.resolve({ error: null }))
  const fromMock = vi.fn(() => ({ insert: insertMock }))
  return {
    generateCarouselMock: vi.fn(),
    deductCreditAdminMock: vi.fn(),
    getCreditBalanceAdminMock: vi.fn(),
    getUserTierMock: vi.fn(),
    checkProjectLimitMock: vi.fn(),
    insertMock,
    fromMock,
  }
})

vi.mock('@/lib/services/carousel', () => ({ generateCarousel: mocks.generateCarouselMock }))
vi.mock('@/lib/credits/check-credits', () => ({
  deductCreditAdmin: mocks.deductCreditAdminMock,
  getCreditBalanceAdmin: mocks.getCreditBalanceAdminMock,
  getUserTier: mocks.getUserTierMock,
  checkProjectLimit: mocks.checkProjectLimitMock,
  FREE_TIER_PROJECT_LIMIT: 3,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.fromMock }) }))

import { registerTools } from '@/lib/mcp/tools'

function getCreateCarousel() {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server)
  // SDK stores tool callback under `handler` (see node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:274)
  return ((server as unknown) as { _registeredTools: Record<string, { handler: (args: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }> })._registeredTools.create_carousel
}

const VALID_AUTH = { authInfo: { extra: { userId: 'user-1', keyId: 'key-1' } } }

describe('create_carousel tool (MCP-TOOL-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertMock.mockClear()
    mocks.fromMock.mockClear()
    mocks.getUserTierMock.mockResolvedValue('creator')
    mocks.checkProjectLimitMock.mockResolvedValue(true)
    mocks.getCreditBalanceAdminMock.mockResolvedValue(10)
    mocks.deductCreditAdminMock.mockResolvedValue(true)
  })

  it('happy path: deducts 1 credit, calls generateCarousel, returns { projectId, slideCount, dashboardUrl }', async () => {
    mocks.generateCarouselMock.mockResolvedValue({ projectId: 'proj-123', slideCount: 7 })
    const tool = getCreateCarousel()
    const res = await tool.handler({ topic: 'productivity', templateId: 'highlight-bar' }, VALID_AUTH)
    expect(res.isError).toBeFalsy()
    const body = JSON.parse(res.content[0].text)
    expect(body.projectId).toBe('proj-123')
    expect(body.slideCount).toBe(7)
    expect(body.dashboardUrl).toMatch(/\/project\/proj-123$/)
    expect(mocks.deductCreditAdminMock).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'carousel_generation',
      expect.stringContaining('productivity'),
      undefined,
      1
    )
    expect(mocks.generateCarouselMock).toHaveBeenCalledTimes(1)
  })

  it('insufficient credits: returns INSUFFICIENT_CREDITS in-band error (NOT thrown)', async () => {
    mocks.getCreditBalanceAdminMock.mockResolvedValue(0)
    const tool = getCreateCarousel()
    const res = await tool.handler({ topic: 'x', templateId: 'highlight-bar' }, VALID_AUTH)
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('INSUFFICIENT_CREDITS')
    expect(mocks.deductCreditAdminMock).not.toHaveBeenCalled()
    expect(mocks.generateCarouselMock).not.toHaveBeenCalled()
  })

  it('refund on failure: when generateCarousel throws, inserts a refund credit_transactions row', async () => {
    mocks.generateCarouselMock.mockRejectedValue(new Error('Gemini timeout'))
    const tool = getCreateCarousel()
    const res = await tool.handler({ topic: 'x', templateId: 'highlight-bar' }, VALID_AUTH)
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('GENERATION_FAILED')
    expect(mocks.fromMock).toHaveBeenCalledWith('credit_transactions')
    expect(mocks.insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', type: 'refund', amount: 1 }))
  })
})

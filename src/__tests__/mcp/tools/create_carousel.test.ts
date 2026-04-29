// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const generateCarouselMock = vi.fn()
const deductCreditAdminMock = vi.fn()
const getCreditBalanceAdminMock = vi.fn()
const getUserTierMock = vi.fn()
const checkProjectLimitMock = vi.fn()
const insertMock = vi.fn(() => Promise.resolve({ error: null }))
const fromMock = vi.fn(() => ({ insert: insertMock }))

vi.mock('@/lib/services/carousel', () => ({ generateCarousel: generateCarouselMock }))
vi.mock('@/lib/credits/check-credits', () => ({
  deductCreditAdmin: deductCreditAdminMock,
  getCreditBalanceAdmin: getCreditBalanceAdminMock,
  getUserTier: getUserTierMock,
  checkProjectLimit: checkProjectLimitMock,
  FREE_TIER_PROJECT_LIMIT: 3,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: fromMock }) }))

import { registerTools } from '@/lib/mcp/tools'

function getCreateCarousel() {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server)
  return ((server as unknown) as { _registeredTools: Record<string, { callback: (args: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }> })._registeredTools.create_carousel
}

const VALID_AUTH = { authInfo: { extra: { userId: 'user-1', keyId: 'key-1' } } }

describe('create_carousel tool (MCP-TOOL-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertMock.mockClear()
    fromMock.mockClear()
    getUserTierMock.mockResolvedValue('creator')
    checkProjectLimitMock.mockResolvedValue(true)
    getCreditBalanceAdminMock.mockResolvedValue(10)
    deductCreditAdminMock.mockResolvedValue(true)
  })

  it('happy path: deducts 1 credit, calls generateCarousel, returns { projectId, slideCount, dashboardUrl }', async () => {
    generateCarouselMock.mockResolvedValue({ projectId: 'proj-123', slideCount: 7 })
    const tool = getCreateCarousel()
    const res = await tool.callback({ topic: 'productivity', templateId: 'highlight-bar' }, VALID_AUTH)
    expect(res.isError).toBeFalsy()
    const body = JSON.parse(res.content[0].text)
    expect(body.projectId).toBe('proj-123')
    expect(body.slideCount).toBe(7)
    expect(body.dashboardUrl).toMatch(/\/project\/proj-123$/)
    expect(deductCreditAdminMock).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'carousel_generation',
      expect.stringContaining('productivity'),
      undefined,
      1
    )
    expect(generateCarouselMock).toHaveBeenCalledTimes(1)
  })

  it('insufficient credits: returns INSUFFICIENT_CREDITS in-band error (NOT thrown)', async () => {
    getCreditBalanceAdminMock.mockResolvedValue(0)
    const tool = getCreateCarousel()
    const res = await tool.callback({ topic: 'x', templateId: 'highlight-bar' }, VALID_AUTH)
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('INSUFFICIENT_CREDITS')
    expect(deductCreditAdminMock).not.toHaveBeenCalled()
    expect(generateCarouselMock).not.toHaveBeenCalled()
  })

  it('refund on failure: when generateCarousel throws, inserts a refund credit_transactions row', async () => {
    generateCarouselMock.mockRejectedValue(new Error('Gemini timeout'))
    const tool = getCreateCarousel()
    const res = await tool.callback({ topic: 'x', templateId: 'highlight-bar' }, VALID_AUTH)
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('GENERATION_FAILED')
    expect(fromMock).toHaveBeenCalledWith('credit_transactions')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-1', type: 'refund', amount: 1 }))
  })
})

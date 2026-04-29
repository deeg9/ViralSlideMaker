// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const mocks = vi.hoisted(() => ({
  validateImageBuffer: vi.fn(),
  isValidationError: vi.fn(),
  incrementUploadCount: vi.fn(),
  uploadImage: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('@/lib/upload-validation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/upload-validation')>()
  return {
    ...actual,
    validateImageBuffer: mocks.validateImageBuffer,
    isValidationError: mocks.isValidationError,
  }
})
vi.mock('@/lib/api/images-quota', () => ({
  incrementUploadCount: mocks.incrementUploadCount,
  DAILY_UPLOAD_LIMIT: 200,
}))
vi.mock('@/lib/storage/upload-image', () => ({
  uploadImage: mocks.uploadImage,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mocks.fromMock }),
}))
// registerTools transitively imports modules with module-load-time side effects
// (e.g. pexelsClient at top of carousel.ts requires PEXELS_API_KEY env var).
// Stub them out — upload_image doesn't use these.
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

import { registerTools } from '@/lib/mcp/tools'

type ToolHandler = (
  args: unknown,
  extra: unknown,
) => Promise<{ isError?: boolean; content: { text: string }[] }>

function getUploadImage(): { handler: ToolHandler } {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  registerTools(server)
  return (server as unknown as {
    _registeredTools: Record<string, { handler: ToolHandler }>
  })._registeredTools.upload_image
}

const VALID_AUTH = { authInfo: { extra: { userId: 'user-1', keyId: 'key-1' } } }
const VALID_ARGS = { imageBase64: 'aGVsbG8=', mimeType: 'image/png' }

describe('upload_image tool (v2.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.validateImageBuffer.mockReturnValue({
      mimeType: 'image/png',
      width: 1080,
      height: 1920,
    })
    mocks.isValidationError.mockReturnValue(false)
    mocks.incrementUploadCount.mockResolvedValue({
      allowed: true,
      used: 1,
      limit: 200,
      resetAt: Date.now() + 86400000,
      retryAfter: 86400,
    })
    mocks.uploadImage.mockResolvedValue({
      url: 'https://supabase.co/storage/v1/object/public/slide-backgrounds/user-1/uploads/2026-04/abc.png',
      mimeType: 'image/png',
      sizeBytes: 1234,
      width: 1080,
      height: 1920,
    })
  })

  it('happy path: returns success content with url + metadata', async () => {
    const tool = getUploadImage()
    const res = await tool.handler(VALID_ARGS, VALID_AUTH)
    expect(res.isError).toBeFalsy()
    const body = JSON.parse(res.content[0].text)
    expect(body.url).toContain('https://')
    expect(body.mimeType).toBe('image/png')
    expect(body.width).toBe(1080)
    expect(body.height).toBe(1920)
    expect(body.sizeBytes).toBe(1234)
  })

  it('passes the userId from auth context to uploadImage', async () => {
    const tool = getUploadImage()
    await tool.handler(VALID_ARGS, VALID_AUTH)
    expect(mocks.uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
    )
  })

  it('passes the keyId from auth context to incrementUploadCount', async () => {
    const tool = getUploadImage()
    await tool.handler(VALID_ARGS, VALID_AUTH)
    expect(mocks.incrementUploadCount).toHaveBeenCalledWith('key-1')
  })

  it('returns UNAUTHORIZED when auth context is missing userId', async () => {
    const tool = getUploadImage()
    const res = await tool.handler(VALID_ARGS, { authInfo: { extra: {} } })
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('UNAUTHORIZED')
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })

  it('returns UNAUTHORIZED when auth context is missing keyId', async () => {
    const tool = getUploadImage()
    const res = await tool.handler(VALID_ARGS, {
      authInfo: { extra: { userId: 'user-1' } },
    })
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('UNAUTHORIZED')
  })

  it('returns VALIDATION_ERROR when imageBase64 exceeds pre-decode size cap', async () => {
    const tool = getUploadImage()
    const oversized = 'a'.repeat(7_000_001)
    const res = await tool.handler(
      { imageBase64: oversized, mimeType: 'image/png' },
      VALID_AUTH,
    )
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('VALIDATION_ERROR')
    expect(mocks.validateImageBuffer).not.toHaveBeenCalled()
  })

  it('returns VALIDATION_ERROR (in-band, NOT thrown) when validateImageBuffer rejects', async () => {
    mocks.validateImageBuffer.mockReturnValue({
      code: 'MIME_MISMATCH',
      message: 'Claimed mimeType disagrees with detected format',
    })
    mocks.isValidationError.mockReturnValue(true)
    const tool = getUploadImage()
    const res = await tool.handler(VALID_ARGS, VALID_AUTH)
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('VALIDATION_ERROR')
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })

  it('returns VALIDATION_ERROR for animated PNG rejection', async () => {
    mocks.validateImageBuffer.mockReturnValue({
      code: 'ANIMATED',
      message: 'Animated PNGs are not supported',
    })
    mocks.isValidationError.mockReturnValue(true)
    const tool = getUploadImage()
    const res = await tool.handler(VALID_ARGS, VALID_AUTH)
    expect(res.isError).toBe(true)
    const body = JSON.parse(res.content[0].text)
    expect(body.error).toBe('VALIDATION_ERROR')
    expect(body.message).toContain('Animated')
  })

  it('returns RATE_LIMITED in-band when daily upload quota exceeded', async () => {
    mocks.incrementUploadCount.mockResolvedValue({
      allowed: false,
      used: 201,
      limit: 200,
      resetAt: Date.now() + 3600000,
      retryAfter: 3600,
    })
    const tool = getUploadImage()
    const res = await tool.handler(VALID_ARGS, VALID_AUTH)
    expect(res.isError).toBe(true)
    const body = JSON.parse(res.content[0].text)
    expect(body.error).toBe('RATE_LIMITED')
    expect(body.message).toContain('200')
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })

  it('returns UPLOAD_FAILED in-band when storage upload throws', async () => {
    mocks.uploadImage.mockRejectedValue(new Error('Supabase storage error'))
    const tool = getUploadImage()
    const res = await tool.handler(VALID_ARGS, VALID_AUTH)
    expect(res.isError).toBe(true)
    expect(JSON.parse(res.content[0].text).error).toBe('UPLOAD_FAILED')
  })

  it('quota does NOT bump when validation fails (no charge for invalid input)', async () => {
    mocks.validateImageBuffer.mockReturnValue({
      code: 'INVALID_FORMAT',
      message: 'bad bytes',
    })
    mocks.isValidationError.mockReturnValue(true)
    const tool = getUploadImage()
    await tool.handler(VALID_ARGS, VALID_AUTH)
    expect(mocks.incrementUploadCount).not.toHaveBeenCalled()
  })
})

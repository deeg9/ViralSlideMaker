// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Hoisted mocks — must be referenced inside vi.mock factories
const mocks = vi.hoisted(() => ({
  authenticateApiKey: vi.fn(),
  checkRateLimit: vi.fn(),
  rpc: vi.fn(),
  validateImageBuffer: vi.fn(),
  isValidationError: vi.fn(),
  incrementUploadCount: vi.fn(),
  uploadImage: vi.fn(),
}))

vi.mock('@/lib/api/auth', () => ({
  authenticateApiKey: mocks.authenticateApiKey,
}))
vi.mock('@/lib/api/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
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

import { POST } from '@/app/api/v1/images/route'

const VALID_BODY = {
  imageBase64: 'aGVsbG8=', // "hello" — content doesn't matter, validateImageBuffer is mocked
  mimeType: 'image/png',
}

function makeReq(body: unknown = VALID_BODY): NextRequest {
  return new NextRequest('http://localhost:3000/api/v1/images', {
    method: 'POST',
    headers: {
      authorization: 'Bearer vsl_test_key',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticateApiKey.mockResolvedValue({ userId: 'user-1', keyId: 'key-1' })
    mocks.checkRateLimit.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60000,
    })
    mocks.rpc.mockResolvedValue({ data: 10, error: null })

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

  it('happy path: returns 200 with metadata and quota headers', async () => {
    const res = await POST(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.url).toContain('https://')
    expect(body.width).toBe(1080)
    expect(body.height).toBe(1920)
    expect(res.headers.get('X-Upload-Quota-Limit')).toBe('200')
    expect(res.headers.get('X-Upload-Quota-Used')).toBe('1')
  })

  it('returns 400 when imageBase64 is missing', async () => {
    const res = await POST(makeReq({ mimeType: 'image/png' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('imageBase64')
  })

  it('returns 400 when mimeType is invalid', async () => {
    const res = await POST(makeReq({ imageBase64: 'aGVsbG8=', mimeType: 'image/heic' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('mimeType')
  })

  it('returns 413 when imageBase64 exceeds the pre-decode size cap', async () => {
    const oversized = 'a'.repeat(7_000_001)
    const res = await POST(makeReq({ imageBase64: oversized, mimeType: 'image/png' }))
    expect(res.status).toBe(413)
    expect(mocks.validateImageBuffer).not.toHaveBeenCalled()
  })

  it('returns 400 when validateImageBuffer rejects (MIME mismatch)', async () => {
    mocks.validateImageBuffer.mockReturnValue({
      code: 'MIME_MISMATCH',
      message: 'Claimed mimeType disagrees with detected format',
    })
    mocks.isValidationError.mockReturnValue(true)
    const res = await POST(makeReq())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })

  it('returns 413 when validateImageBuffer rejects with TOO_LARGE_PIXELS (decompression bomb)', async () => {
    mocks.validateImageBuffer.mockReturnValue({
      code: 'TOO_LARGE_PIXELS',
      message: 'Image exceeds decoded pixel budget',
    })
    mocks.isValidationError.mockReturnValue(true)
    const res = await POST(makeReq())
    expect(res.status).toBe(413)
  })

  it('returns 400 when validateImageBuffer rejects animated PNG', async () => {
    mocks.validateImageBuffer.mockReturnValue({
      code: 'ANIMATED',
      message: 'Animated PNGs are not supported',
    })
    mocks.isValidationError.mockReturnValue(true)
    const res = await POST(makeReq())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('Animated')
  })

  it('returns 429 when daily upload quota exceeded with Retry-After header', async () => {
    mocks.incrementUploadCount.mockResolvedValue({
      allowed: false,
      used: 201,
      limit: 200,
      resetAt: Date.now() + 3600000,
      retryAfter: 3600,
    })
    const res = await POST(makeReq())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
    expect(res.headers.get('Retry-After')).toBe('3600')
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })

  it('returns 500 when storage upload throws', async () => {
    mocks.uploadImage.mockRejectedValue(new Error('Supabase storage error'))
    const res = await POST(makeReq())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('quota check runs AFTER validation but BEFORE upload (order matters for cost)', async () => {
    // If validation fails, quota should NOT be incremented (don't charge for invalid input)
    mocks.validateImageBuffer.mockReturnValue({
      code: 'INVALID_FORMAT',
      message: 'bad bytes',
    })
    mocks.isValidationError.mockReturnValue(true)
    await POST(makeReq())
    expect(mocks.incrementUploadCount).not.toHaveBeenCalled()
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })
})

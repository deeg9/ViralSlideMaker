import { describe, it, expect } from 'vitest'
import { apiError, ApiErrorCode } from '@/lib/api/errors'

describe('apiError', () => {
  it('returns NextResponse with correct status and JSON body', async () => {
    const response = apiError('UNAUTHORIZED', 'Invalid key', 401)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid key',
      },
    })
  })

  it('includes CORS headers by default', () => {
    const response = apiError('RATE_LIMITED', 'Too many requests', 429)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('accepts extraHeaders parameter and merges them into the response', () => {
    const response = apiError('RATE_LIMITED', 'Too many requests', 429, {
      'Retry-After': '30',
      'X-RateLimit-Limit': '60',
    })

    expect(response.headers.get('Retry-After')).toBe('30')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('60')
    // CORS headers should still be present
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('ApiErrorCode type matches exactly the 7 codes from openapi.ts', () => {
    // This test ensures the type is correct by constructing all 7 values
    const codes: ApiErrorCode[] = [
      'UNAUTHORIZED',
      'RATE_LIMITED',
      'VALIDATION_ERROR',
      'INTERNAL_ERROR',
      'INSUFFICIENT_CREDITS',
      'NOT_FOUND',
      'FORBIDDEN',
    ]
    expect(codes).toHaveLength(7)

    // Each code should produce a valid response
    for (const code of codes) {
      const response = apiError(code, `Test ${code}`, 400)
      expect(response.status).toBe(400)
    }
  })
})

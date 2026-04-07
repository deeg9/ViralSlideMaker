import { NextResponse } from 'next/server'
import { CORS_HEADERS } from './headers'

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'INSUFFICIENT_CREDITS'
  | 'NOT_FOUND'
  | 'FORBIDDEN'

const STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 400,
  INTERNAL_ERROR: 500,
  INSUFFICIENT_CREDITS: 402,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
}

export class ApiError extends Error {
  code: ErrorCode
  status: number

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = STATUS_MAP[code]
  }
}

export class RateLimitError extends ApiError {
  retryAfter: number
  limit: number
  remaining: number

  constructor(retryAfter: number, limit: number, remaining: number) {
    super('RATE_LIMITED', `Rate limit exceeded. Retry after ${retryAfter} seconds.`)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
    this.limit = limit
    this.remaining = remaining
  }
}

export function apiError(err: unknown): NextResponse {
  if (err instanceof RateLimitError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      {
        status: err.status,
        headers: {
          ...CORS_HEADERS,
          'Retry-After': String(err.retryAfter),
          'X-RateLimit-Limit': String(err.limit),
          'X-RateLimit-Remaining': String(err.remaining),
        },
      }
    )
  }

  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status, headers: { ...CORS_HEADERS } }
    )
  }

  // Zod validation errors
  if (err && typeof err === 'object' && 'issues' in err) {
    const issues = (err as { issues: Array<{ message: string }> }).issues
    const message = issues.map(i => i.message).join(', ')
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message } },
      { status: 400, headers: { ...CORS_HEADERS } }
    )
  }

  // Unknown errors
  console.error('Unhandled API error:', err)
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    { status: 500, headers: { ...CORS_HEADERS } }
  )
}

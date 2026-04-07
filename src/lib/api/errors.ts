// Stub: Will be implemented in Plan 01
// API error classes
import { NextResponse } from 'next/server'

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number = 400) {
    super(message)
    this.code = code
    this.status = status
    this.name = 'ApiError'
  }
}

export class RateLimitError extends ApiError {
  retryAfter: number
  constructor(retryAfter: number) {
    super('RATE_LIMITED', 'Rate limit exceeded', 429)
    this.retryAfter = retryAfter
    this.name = 'RateLimitError'
  }
}

export function apiError(err: unknown): NextResponse {
  throw new Error('Not implemented -- Plan 01 will implement this')
}

import { NextResponse } from 'next/server'
import { corsHeaders } from './cors'

/**
 * Error codes matching the OpenAPI spec (openapi.ts lines 24-30).
 */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'INSUFFICIENT_CREDITS'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'TOS_REQUIRED'

/**
 * Create a structured error response with CORS headers.
 *
 * Generic error messages only -- no stack traces or internal details (T-23-03).
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  extraHeaders?: Record<string, string>
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
      headers: {
        ...corsHeaders(),
        ...extraHeaders,
      },
    }
  )
}

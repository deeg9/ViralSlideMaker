import { NextResponse } from 'next/server'

/**
 * Create a success response with optional credit tracking header.
 *
 * CORS and rate-limit headers are NOT set here -- the withApiAuth HOC
 * appends those after the handler returns.
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  creditsUsed?: number
): NextResponse {
  const response = NextResponse.json(data, { status })
  if (creditsUsed && creditsUsed > 0) {
    response.headers.set('x-credits-used', String(creditsUsed))
  }
  return response
}

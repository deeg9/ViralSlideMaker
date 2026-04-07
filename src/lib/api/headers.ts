import { NextResponse } from 'next/server'
import { getCreditBalance } from '@/lib/credits/check-credits'
import { createAdminClient } from '@/lib/supabase/admin'

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Expose-Headers':
    'x-credits-remaining, x-credits-used, X-RateLimit-Limit, X-RateLimit-Remaining',
}

export function corsOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function buildResponseHeaders(
  userId: string,
  creditsUsed: number = 0,
  rateLimit?: { limit: number; remaining: number }
): Promise<Record<string, string>> {
  const balance = await getCreditBalance(userId, createAdminClient())

  return {
    ...CORS_HEADERS,
    'x-credits-remaining': String(balance),
    'x-credits-used': String(creditsUsed),
    ...(rateLimit
      ? {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        }
      : {}),
  }
}

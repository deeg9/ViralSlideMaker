import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from './auth'
import { checkRateLimit } from './rate-limit'
import { apiError } from './errors'
import { corsHeaders } from './cors'
import { createAdminClient } from '@/lib/supabase/admin'

export type ApiContext = {
  userId: string
  keyId: string
  supabase: ReturnType<typeof createAdminClient>
  creditBalance: number
}

type ApiHandler = (
  req: NextRequest,
  ctx: ApiContext
) => Promise<NextResponse>

/**
 * Higher-order function that wraps API route handlers with:
 * 1. CORS preflight handling (OPTIONS -> 204)
 * 2. Bearer token authentication
 * 3. Rate limiting (60 req/min per API key via Upstash)
 * 4. Credit balance fetch
 * 5. Response header enrichment (rate-limit, credits, CORS)
 * 6. Uncaught error handling (500 INTERNAL_ERROR)
 */
export function withApiAuth(handler: ApiHandler) {
  return async (req: NextRequest) => {
    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(),
      })
    }

    try {
      // 2. Authenticate
      const { userId, keyId } = await authenticateApiKey(req)

      // 3. Rate limiting
      const rl = await checkRateLimit(keyId)
      if (!rl.success) {
        const retryAfter = Math.ceil((rl.reset - Date.now()) / 1000)
        return apiError('RATE_LIMITED', 'Rate limit exceeded', 429, {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
        })
      }

      // 4. Fetch credit balance
      const supabase = createAdminClient()
      const { data: creditBalance } = await supabase.rpc('get_credit_balance', {
        p_user_id: userId,
      })

      // 5. Call handler
      const response = await handler(req, {
        userId,
        keyId,
        supabase,
        creditBalance: creditBalance ?? 0,
      })

      // 6. Enrich response headers
      const cors = corsHeaders()
      for (const [key, value] of Object.entries(cors)) {
        response.headers.set(key, value)
      }
      response.headers.set('X-RateLimit-Limit', String(rl.limit))
      response.headers.set('X-RateLimit-Remaining', String(rl.remaining))

      // Compute x-credits-remaining post-deduction
      const creditsUsed = parseInt(response.headers.get('x-credits-used') || '0', 10)
      const remaining = (creditBalance ?? 0) - creditsUsed
      response.headers.set('x-credits-remaining', String(remaining))

      return response
    } catch (err) {
      // Check if it's an auth error (authenticateApiKey throws)
      // vs an internal error (handler throws)
      if (err instanceof Error && (
        err.message.includes('Authorization') ||
        err.message.includes('API key')
      )) {
        return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)
      }
      return apiError('INTERNAL_ERROR', 'Internal server error', 500)
    }
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from './auth'
import { createAdminClient } from '@/lib/supabase/admin'

export type ApiContext = {
  userId: string
  keyId: string
  supabase: ReturnType<typeof createAdminClient>
}

type ApiHandler = (
  req: NextRequest,
  ctx: ApiContext
) => Promise<NextResponse>

export function withApiAuth(handler: ApiHandler) {
  return async (req: NextRequest) => {
    try {
      const { userId, keyId } = await authenticateApiKey(req)
      const supabase = createAdminClient()
      return await handler(req, { userId, keyId, supabase })
    } catch {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' } },
        { status: 401 }
      )
    }
  }
}

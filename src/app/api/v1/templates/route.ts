import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError } from '@/lib/api/errors'
import { buildResponseHeaders, corsOptions } from '@/lib/api/headers'
import { templates } from '@/lib/render/templates'

export async function OPTIONS() {
  return corsOptions()
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    const rateLimit = await checkRateLimit(auth.keyId, auth.tier)

    const templateList = templates.map((t) => ({
      id: t.id,
      name: t.name,
      thumbnail: t.thumbnail,
      textPosition: t.textPosition,
      textAlign: t.textAlign,
    }))

    const headers = await buildResponseHeaders(auth.userId, 0, rateLimit)

    return NextResponse.json({ data: templateList }, { headers })
  } catch (err) {
    return apiError(err)
  }
}

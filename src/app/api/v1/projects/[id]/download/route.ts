import { NextRequest } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError } from '@/lib/api/errors'
import { buildResponseHeaders, corsOptions, CORS_HEADERS } from '@/lib/api/headers'
import { getProject } from '@/lib/services/project'
import { renderAllSlidesToZip, getBrandKitForUser } from '@/lib/services/render'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function OPTIONS() {
  return corsOptions()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)
    const { id } = await params

    const adminClient = createAdminClient()
    const project = await getProject(auth.userId, id, { adminClient })

    if (!project) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Project not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const brandKit = await getBrandKitForUser(auth.userId)
    const zipBuffer = await renderAllSlidesToZip(auth.userId, id, brandKit)
    const creditHeaders = await buildResponseHeaders(auth.userId, 0, { limit, remaining })

    const title = project.title
    const filename = `${title || 'carousel'}-slides.zip`

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...creditHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return apiError(err)
  }
}

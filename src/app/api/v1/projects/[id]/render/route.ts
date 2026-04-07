import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError } from '@/lib/api/errors'
import { buildResponseHeaders, corsOptions } from '@/lib/api/headers'
import { getProject } from '@/lib/services/project'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Slide } from '@/lib/types/slide'

export const maxDuration = 60

export async function OPTIONS() {
  return corsOptions()
}

export async function POST(
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
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Project not found' } },
        { status: 404 }
      )
    }

    const slides = (project.slide_data ?? []) as Slide[]
    const slideUrls = slides.map((_, index) => ({
      index,
      download_url: `/api/v1/projects/${id}/download/${index}`,
    }))

    const headers = await buildResponseHeaders(auth.userId, 0, { limit, remaining })
    return NextResponse.json(
      {
        data: {
          slides: slideUrls,
          zip_url: `/api/v1/projects/${id}/download`,
        },
      },
      { headers }
    )
  } catch (err) {
    return apiError(err)
  }
}

import { NextRequest } from 'next/server'
import { authenticateApiKey } from '@/lib/api/auth'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { apiError, ApiError } from '@/lib/api/errors'
import { buildResponseHeaders, corsOptions, CORS_HEADERS } from '@/lib/api/headers'
import { getProject } from '@/lib/services/project'
import { renderSlide, getBrandKitForUser } from '@/lib/services/render'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Slide } from '@/lib/types/slide'

export const maxDuration = 60

export async function OPTIONS() {
  return corsOptions()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    const { limit, remaining } = await checkRateLimit(auth.keyId, auth.tier)
    const { id, index } = await params

    const slideIndex = parseInt(index, 10)
    if (isNaN(slideIndex) || slideIndex < 0) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid slide index' } }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const adminClient = createAdminClient()
    const project = await getProject(auth.userId, id, { adminClient })

    if (!project) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Project not found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const slides = (project.slide_data ?? []) as Slide[]
    if (slideIndex >= slides.length) {
      throw new ApiError('NOT_FOUND', `Slide at index ${slideIndex} not found`)
    }

    const brandKit = await getBrandKitForUser(auth.userId)
    const pngBuffer = await renderSlide(auth.userId, id, slideIndex, brandKit)
    const creditHeaders = await buildResponseHeaders(auth.userId, 0, { limit, remaining })

    const slideNum = String(slideIndex + 1).padStart(2, '0')

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        ...creditHeaders,
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="slide-${slideNum}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (err) {
    return apiError(err)
  }
}

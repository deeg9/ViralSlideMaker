import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError, type ApiErrorCode } from '@/lib/api/errors'
import { getProject, updateProjectService } from '@/lib/services/projects'
import { generateImagenBackgroundAdmin } from '@/lib/services/ai-regen'
import { CREDIT_COSTS } from '@/lib/credits/types'
import type { Slide } from '@/lib/types/slide'

export const maxDuration = 60

function extractParams(req: NextRequest) {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/slides/{index}/generate-image
  return { id: segments[4], indexStr: segments[6] }
}

function statusToErrorCode(status: number): ApiErrorCode {
  if (status === 400) return 'VALIDATION_ERROR'
  if (status === 402) return 'INSUFFICIENT_CREDITS'
  if (status === 404) return 'NOT_FOUND'
  return 'INTERNAL_ERROR'
}

export const POST = withApiAuth(async (req, ctx) => {
  const { id, indexStr } = extractParams(req)
  if (!id) return apiError('NOT_FOUND', 'Project not found', 404)

  const slideIndex = parseInt(indexStr, 10)
  if (isNaN(slideIndex) || slideIndex < 0) {
    return apiError('VALIDATION_ERROR', 'Invalid slide index', 400)
  }

  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text.length > 0) body = JSON.parse(text)
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  let project
  try {
    project = await getProject(ctx.supabase, ctx.userId, id)
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  const slideData = (project.slide_data as Slide[] | null) ?? []
  if (slideIndex >= slideData.length) {
    return apiError('NOT_FOUND', 'Slide not found', 404)
  }
  const slide = slideData[slideIndex]
  const prompt = typeof body.prompt === 'string' && body.prompt.trim().length > 0
    ? body.prompt
    : slide.image_query
  if (!prompt || prompt.trim().length === 0) {
    return apiError('VALIDATION_ERROR', 'prompt is required (or slide.image_query must be set)', 400)
  }

  if (ctx.creditBalance < CREDIT_COSTS.imagen_generation) {
    return apiError('INSUFFICIENT_CREDITS', 'Insufficient credits', 402)
  }

  const result = await generateImagenBackgroundAdmin(ctx.supabase, ctx.userId, prompt, id, slideIndex)
  if ('error' in result) {
    return apiError(statusToErrorCode(result.status), result.error, result.status)
  }

  // Persist the new background_url + image_query onto the slide
  const updated = [...slideData]
  updated[slideIndex] = { ...slide, background_url: result.url, image_query: prompt, pexels_photo_id: null }
  await updateProjectService(ctx.supabase, ctx.userId, id, { slide_data: updated })

  return apiSuccess(
    { data: { url: result.url, prompt, slideIndex } },
    200,
    CREDIT_COSTS.imagen_generation,
  )
})

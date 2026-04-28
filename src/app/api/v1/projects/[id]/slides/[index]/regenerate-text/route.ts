import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { getProject, updateProjectService } from '@/lib/services/projects'
import { regenerateSlideText } from '@/lib/services/ai-regen'
import type { Slide } from '@/lib/types/slide'

export const maxDuration = 60

function extractParams(req: NextRequest) {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/slides/{index}/regenerate-text
  return { id: segments[4], indexStr: segments[6] }
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

  // Optional: { customPrompt?: string, persist?: boolean }
  const customPrompt = typeof body.customPrompt === 'string' ? body.customPrompt : undefined
  const persist = body.persist === true

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

  const topic = (project.topic as string | null) ?? project.title ?? ''
  const slide = slideData[slideIndex]

  let result: { hook_text: string; body_text: string }
  try {
    result = await regenerateSlideText(slide, topic, slideIndex, customPrompt)
  } catch {
    return apiError('INTERNAL_ERROR', 'AI text regeneration failed', 500)
  }

  if (persist) {
    const updated = [...slideData]
    updated[slideIndex] = { ...slide, ...result }
    await updateProjectService(ctx.supabase, ctx.userId, id, { slide_data: updated })
  }

  return apiSuccess({ data: { ...result, persisted: persist } })
})

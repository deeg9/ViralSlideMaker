import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { getProject, updateProjectService } from '@/lib/services/projects'

function extractProjectId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/slides -> ['', 'api', 'v1', 'projects', '{id}', 'slides']
  const id = segments[4]
  return id && id.length > 0 ? id : null
}

const MAX_SLIDES = 10

const blankSlide = () => ({
  hook_text: '',
  body_text: '',
  image_query: '',
  is_cta: false,
  background_url: null,
  pexels_photo_id: null,
})

export const POST = withApiAuth(async (req, ctx) => {
  const id = extractProjectId(req)
  if (!id) return apiError('NOT_FOUND', 'Project not found', 404)

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

  const slideData = (project.slide_data as Record<string, unknown>[] | null) ?? []
  if (slideData.length >= MAX_SLIDES) {
    return apiError('VALIDATION_ERROR', `Maximum of ${MAX_SLIDES} slides per project`, 400)
  }

  // Optional `position` body param. Default = append to end.
  let position = slideData.length
  if (body.position !== undefined) {
    const p = Number(body.position)
    if (!Number.isInteger(p) || p < 0 || p > slideData.length) {
      return apiError(
        'VALIDATION_ERROR',
        `position must be an integer between 0 and ${slideData.length}`,
        400,
      )
    }
    position = p
  }

  // Optional `slide` body param. Default = blank slide. Allowed-field gate keeps
  // callers from injecting fields beyond the documented Slide shape.
  const ALLOWED_SLIDE_FIELDS = [
    'hook_text', 'body_text', 'hook_segments', 'body_segments',
    'image_query', 'is_cta', 'background_url', 'pexels_photo_id',
    'style_overrides', 'custom_texts', 'custom_images',
  ] as const
  const newSlide: Record<string, unknown> = blankSlide()
  if (body.slide && typeof body.slide === 'object') {
    const provided = body.slide as Record<string, unknown>
    for (const field of ALLOWED_SLIDE_FIELDS) {
      if (field in provided) newSlide[field] = provided[field]
    }
  }

  const updatedArray = [...slideData]
  updatedArray.splice(position, 0, newSlide)

  await updateProjectService(ctx.supabase, ctx.userId, id, { slide_data: updatedArray })

  return apiSuccess({ data: { slide: newSlide, position, slideCount: updatedArray.length } }, 201)
})

import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { getProject } from '@/lib/services/projects'

export const GET = withApiAuth(async (req, ctx) => {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/slides/{index}
  // ['', 'api', 'v1', 'projects', '{id}', 'slides', '{index}']
  const id = segments[4]
  const indexStr = segments[6]

  if (!id || id.length === 0) {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  const slideIndex = parseInt(indexStr, 10)
  if (isNaN(slideIndex) || slideIndex < 0) {
    return apiError('VALIDATION_ERROR', 'Invalid slide index', 400)
  }

  let project
  try {
    project = await getProject(ctx.supabase, ctx.userId, id)
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  const slide_data = project.slide_data as unknown[] | null
  if (!slide_data || slideIndex >= slide_data.length) {
    return apiError('NOT_FOUND', 'Slide not found', 404)
  }

  return apiSuccess({ data: slide_data[slideIndex] })
})

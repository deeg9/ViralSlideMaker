import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { getProject, updateProjectService } from '@/lib/services/projects'

function extractParams(req: NextRequest) {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/slides/{index}
  // ['', 'api', 'v1', 'projects', '{id}', 'slides', '{index}']
  return { id: segments[4], indexStr: segments[6] }
}

export const GET = withApiAuth(async (req, ctx) => {
  const { id, indexStr } = extractParams(req)

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

const ALLOWED_PATCH_FIELDS = ['hook_text', 'body_text', 'image_query', 'background_url', 'style_overrides'] as const

export const PATCH = withApiAuth(async (req, ctx) => {
  const { id, indexStr } = extractParams(req)

  if (!id || id.length === 0) {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  const slideIndex = parseInt(indexStr, 10)
  if (isNaN(slideIndex) || slideIndex < 0) {
    return apiError('VALIDATION_ERROR', 'Invalid slide index', 400)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  // Filter to allowed fields only
  const patchFields: Record<string, unknown> = {}
  for (const field of ALLOWED_PATCH_FIELDS) {
    if (field in body) {
      patchFields[field] = body[field]
    }
  }

  if (Object.keys(patchFields).length === 0) {
    return apiError('VALIDATION_ERROR', 'At least one field must be provided: hook_text, body_text, image_query, background_url, style_overrides', 400)
  }

  // Validate background_url starts with https:// (T-25-02)
  if (typeof patchFields.background_url === 'string' && !patchFields.background_url.startsWith('https://')) {
    return apiError('VALIDATION_ERROR', 'background_url must use https://', 400)
  }

  // Fetch project
  let project
  try {
    project = await getProject(ctx.supabase, ctx.userId, id)
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  const slideData = (project.slide_data as Record<string, unknown>[] | null) ?? []
  if (slideIndex >= slideData.length) {
    return apiError('NOT_FOUND', 'Slide not found', 404)
  }

  const existingSlide = slideData[slideIndex] as Record<string, unknown>

  // Deep merge style_overrides
  let mergedStyleOverrides = existingSlide.style_overrides
  if (patchFields.style_overrides && typeof patchFields.style_overrides === 'object') {
    mergedStyleOverrides = {
      ...(existingSlide.style_overrides as Record<string, unknown> | undefined),
      ...(patchFields.style_overrides as Record<string, unknown>),
    }
  }

  const updatedSlide = {
    ...existingSlide,
    ...patchFields,
    ...(patchFields.style_overrides ? { style_overrides: mergedStyleOverrides } : {}),
  }

  // Replace slide in array
  const updatedArray = [...slideData]
  updatedArray[slideIndex] = updatedSlide

  await updateProjectService(ctx.supabase, ctx.userId, id, { slide_data: updatedArray })

  return apiSuccess({ data: updatedSlide })
})

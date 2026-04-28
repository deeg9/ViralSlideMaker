import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { getProject, deleteProjectService, updateProjectService } from '@/lib/services/projects'

function extractProjectId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id} -> segments = ['', 'api', 'v1', 'projects', '{id}']
  const id = segments[4]
  return id && id.length > 0 ? id : null
}

export const GET = withApiAuth(async (req, ctx) => {
  const id = extractProjectId(req)
  if (!id) {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  try {
    const project = await getProject(ctx.supabase, ctx.userId, id)
    // Map slide_data to slides for OpenAPI schema compliance
    const { slide_data, ...rest } = project
    const mappedProject = { ...rest, slides: slide_data ?? [] }
    return apiSuccess({ data: mappedProject })
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }
})

const PROJECT_PATCH_FIELDS = ['title', 'description', 'template_id'] as const

export const PATCH = withApiAuth(async (req, ctx) => {
  const id = extractProjectId(req)
  if (!id) {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const update: Record<string, unknown> = {}
  for (const field of PROJECT_PATCH_FIELDS) {
    if (field in body) update[field] = body[field]
  }
  if (Object.keys(update).length === 0) {
    return apiError(
      'VALIDATION_ERROR',
      `At least one field must be provided: ${PROJECT_PATCH_FIELDS.join(', ')}`,
      400,
    )
  }

  if (typeof update.title === 'string') {
    const t = update.title.trim()
    if (!t || t.length > 200) {
      return apiError('VALIDATION_ERROR', 'title must be 1-200 characters', 400)
    }
    update.title = t
  }
  if (update.description !== undefined && update.description !== null && typeof update.description !== 'string') {
    return apiError('VALIDATION_ERROR', 'description must be a string or null', 400)
  }
  if (update.template_id !== undefined && update.template_id !== null && typeof update.template_id !== 'string') {
    return apiError('VALIDATION_ERROR', 'template_id must be a string or null', 400)
  }

  try {
    await getProject(ctx.supabase, ctx.userId, id)
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  await updateProjectService(ctx.supabase, ctx.userId, id, update)
  const updated = await getProject(ctx.supabase, ctx.userId, id)
  const { slide_data, ...rest } = updated
  return apiSuccess({ data: { ...rest, slides: slide_data ?? [] } })
})

export const DELETE = withApiAuth(async (req, ctx) => {
  const id = extractProjectId(req)
  if (!id) {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  try {
    // Verify project exists and belongs to user
    await getProject(ctx.supabase, ctx.userId, id)
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  await deleteProjectService(ctx.supabase, ctx.userId, id)
  return apiSuccess({ data: { deleted: true } })
})

import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { getProject, deleteProjectService } from '@/lib/services/projects'

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

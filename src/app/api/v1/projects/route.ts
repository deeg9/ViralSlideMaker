import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { listProjects, createProjectService } from '@/lib/services/projects'

export const GET = withApiAuth(async (_req, ctx) => {
  const projects = await listProjects(ctx.supabase, ctx.userId)

  const data = projects.map(({ slide_data, ...rest }) => ({
    ...rest,
    slides: slide_data,
  }))

  return apiSuccess({ data })
})

export const POST = withApiAuth(async (req, ctx) => {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const { title, topic, templateId } = body as {
    title?: unknown
    topic?: unknown
    templateId?: unknown
  }

  // Validate required fields
  if (typeof title !== 'string' || title.length === 0 || title.length > 200) {
    return apiError('VALIDATION_ERROR', 'title must be a string between 1 and 200 characters', 400)
  }

  // Validate optional fields
  if (topic !== undefined && (typeof topic !== 'string' || topic.length > 2000)) {
    return apiError('VALIDATION_ERROR', 'topic must be a string with max 2000 characters', 400)
  }

  if (templateId !== undefined && typeof templateId !== 'string') {
    return apiError('VALIDATION_ERROR', 'templateId must be a string', 400)
  }

  const result = await createProjectService(ctx.supabase, ctx.userId, {
    title,
    topic: (topic as string) ?? null,
    template_id: (templateId as string) ?? null,
  })

  return apiSuccess({ data: { id: result.id } }, 201)
})

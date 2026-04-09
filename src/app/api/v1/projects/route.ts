import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { listProjects } from '@/lib/services/projects'

export const GET = withApiAuth(async (_req, ctx) => {
  const projects = await listProjects(ctx.supabase, ctx.userId)

  const data = projects.map(({ slide_data, ...rest }) => ({
    ...rest,
    slides: slide_data,
  }))

  return apiSuccess({ data })
})

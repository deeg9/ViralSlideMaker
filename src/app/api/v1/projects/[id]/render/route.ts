import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { getProject } from '@/lib/services/projects'

export const maxDuration = 60

function extractProjectId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/render -> segments = ['', 'api', 'v1', 'projects', '{id}', 'render']
  const id = segments[4]
  return id && id.length > 0 ? id : null
}

export const POST = withApiAuth(async (req, ctx) => {
  const id = extractProjectId(req)
  if (!id) {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  let project
  try {
    project = await getProject(ctx.supabase, ctx.userId, id)
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  const slides = project.slide_data as unknown[] | null
  if (!slides || slides.length === 0) {
    return apiError('NOT_FOUND', 'Project has no slides', 404)
  }

  const baseUrl = new URL(req.url).origin

  const slideUrls = slides.map((_, index) => ({
    index,
    download_url: `${baseUrl}/api/render?projectId=${id}&slide=${index}&download`,
  }))

  const zipUrl = `${baseUrl}/api/v1/projects/${id}/download`

  return apiSuccess({
    data: {
      slides: slideUrls,
      zip_url: zipUrl,
    },
  })
})

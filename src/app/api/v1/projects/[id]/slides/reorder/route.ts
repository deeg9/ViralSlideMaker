import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { getProject, updateProjectService } from '@/lib/services/projects'

function extractProjectId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/slides/reorder -> ['', 'api', 'v1', 'projects', '{id}', 'slides', 'reorder']
  const id = segments[4]
  return id && id.length > 0 ? id : null
}

export const POST = withApiAuth(async (req, ctx) => {
  const id = extractProjectId(req)
  if (!id) return apiError('NOT_FOUND', 'Project not found', 404)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  if (!Array.isArray(body.order)) {
    return apiError('VALIDATION_ERROR', 'order must be an array of integer indices', 400)
  }
  const order = body.order as unknown[]
  if (!order.every((n) => Number.isInteger(n))) {
    return apiError('VALIDATION_ERROR', 'order must contain only integers', 400)
  }
  const orderInts = order as number[]

  let project
  try {
    project = await getProject(ctx.supabase, ctx.userId, id)
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  const slideData = (project.slide_data as unknown[] | null) ?? []

  if (orderInts.length !== slideData.length) {
    return apiError(
      'VALIDATION_ERROR',
      `order length must equal current slide count (${slideData.length})`,
      400,
    )
  }

  // Must be a permutation: every index 0..N-1 appears exactly once
  const seen = new Set<number>()
  for (const idx of orderInts) {
    if (idx < 0 || idx >= slideData.length || seen.has(idx)) {
      return apiError(
        'VALIDATION_ERROR',
        `order must be a permutation of 0..${slideData.length - 1} (each index appearing exactly once)`,
        400,
      )
    }
    seen.add(idx)
  }

  const reordered = orderInts.map((i) => slideData[i])
  await updateProjectService(ctx.supabase, ctx.userId, id, { slide_data: reordered })

  return apiSuccess({ data: { slideCount: reordered.length, order: orderInts } })
})

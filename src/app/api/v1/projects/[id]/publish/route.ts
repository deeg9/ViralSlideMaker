import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError, type ApiErrorCode } from '@/lib/api/errors'
import {
  publishProjectAdmin,
  unpublishProjectAdmin,
  findActivePublishedRow,
  normalizePublishTags,
  appOrigin,
} from '@/lib/services/publish'

export const maxDuration = 60

function extractProjectId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/publish -> ['', 'api', 'v1', 'projects', '{id}', 'publish']
  const id = segments[4]
  return id && id.length > 0 ? id : null
}

function statusToErrorCode(status: number): ApiErrorCode {
  if (status === 400) return 'VALIDATION_ERROR'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  return 'INTERNAL_ERROR'
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

  if (typeof body.title !== 'string') {
    return apiError('VALIDATION_ERROR', 'title is required and must be a string', 400)
  }
  const description =
    body.description === undefined || body.description === null
      ? null
      : typeof body.description === 'string'
        ? body.description
        : undefined
  if (description === undefined) {
    return apiError('VALIDATION_ERROR', 'description must be a string or null', 400)
  }
  const tagsResult = normalizePublishTags(body.tags)
  if ('error' in tagsResult) {
    return apiError('VALIDATION_ERROR', tagsResult.error, 400)
  }

  const result = await publishProjectAdmin(ctx.supabase, ctx.userId, id, {
    title: body.title,
    description,
    tags: tagsResult.tags,
  })
  if (!result.success) {
    return apiError(statusToErrorCode(result.status), result.error, result.status)
  }

  const url = `${appOrigin()}/explore/${result.slug}`
  return apiSuccess(
    { data: { publishedId: result.publishedId, slug: result.slug, url, hero_image_url: result.heroUrl } },
    201,
  )
})

export const DELETE = withApiAuth(async (req, ctx) => {
  const id = extractProjectId(req)
  if (!id) return apiError('NOT_FOUND', 'Project not found', 404)

  const active = await findActivePublishedRow(ctx.supabase, ctx.userId, id)
  if (!active) {
    return apiError('NOT_FOUND', 'No active published carousel for this project', 404)
  }

  const result = await unpublishProjectAdmin(ctx.supabase, ctx.userId, active.id)
  if (!result.success) {
    return apiError(statusToErrorCode(result.status), result.error, result.status)
  }
  return apiSuccess({ data: { unpublished_at: result.unpublished_at, publishedId: active.id } })
})

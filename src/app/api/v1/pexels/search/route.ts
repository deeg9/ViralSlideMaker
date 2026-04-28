import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { searchPhotos } from '@/lib/pexels/search-photos'

const ALLOWED_ORIENTATIONS = ['landscape', 'portrait', 'square'] as const
type Orientation = (typeof ALLOWED_ORIENTATIONS)[number]

export const POST = withApiAuth(async (req) => {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const { query, orientation, perPage } = body as {
    query?: unknown
    orientation?: unknown
    perPage?: unknown
  }

  if (typeof query !== 'string' || query.trim().length === 0) {
    return apiError('VALIDATION_ERROR', 'query is required and must be a non-empty string', 400)
  }
  if (query.length > 200) {
    return apiError('VALIDATION_ERROR', 'query must be 200 characters or fewer', 400)
  }

  let resolvedOrientation: Orientation = 'portrait'
  if (orientation !== undefined) {
    if (typeof orientation !== 'string' || !ALLOWED_ORIENTATIONS.includes(orientation as Orientation)) {
      return apiError(
        'VALIDATION_ERROR',
        `orientation must be one of: ${ALLOWED_ORIENTATIONS.join(', ')}`,
        400,
      )
    }
    resolvedOrientation = orientation as Orientation
  }

  let resolvedPerPage = 12
  if (perPage !== undefined) {
    const n = Number(perPage)
    if (!Number.isInteger(n) || n < 1 || n > 80) {
      return apiError('VALIDATION_ERROR', 'perPage must be an integer between 1 and 80', 400)
    }
    resolvedPerPage = n
  }

  const photos = await searchPhotos(query, {
    orientation: resolvedOrientation,
    per_page: resolvedPerPage,
  })

  return apiSuccess({
    data: {
      query,
      orientation: resolvedOrientation,
      photos: photos.map((p) => ({
        id: p.id,
        url: p.url,
        photographer: p.photographer,
        photographer_url: p.photographer_url,
        src: p.src,
        width: p.width,
        height: p.height,
        alt: p.alt,
      })),
    },
  })
})

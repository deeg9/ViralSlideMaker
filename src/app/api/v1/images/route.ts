import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import {
  validateImageBuffer,
  isValidationError,
  UPLOAD_BASE64_MAX_LENGTH,
  UPLOAD_ALLOWED_MIME_TYPES,
  type UploadMimeType,
} from '@/lib/upload-validation'
import { incrementUploadCount } from '@/lib/api/images-quota'
import { uploadImage } from '@/lib/storage/upload-image'

export const maxDuration = 30

/**
 * POST /api/v1/images
 *
 * Upload a base64-encoded image and receive a public HTTPS URL the caller
 * can pass to other endpoints (e.g. the slide background_url field).
 *
 * Request body:
 *   { imageBase64: string, mimeType: 'image/png' | 'image/jpeg' | 'image/webp' }
 *
 * Response (200):
 *   { success: true, url, mimeType, sizeBytes, width, height }
 *
 * Errors:
 *   400 VALIDATION_ERROR      — invalid body, format, MIME mismatch, animated image
 *   413 VALIDATION_ERROR      — payload too large (pre- or post-decode)
 *   429 RATE_LIMITED          — daily upload quota exceeded
 *   500 INTERNAL_ERROR        — storage failure
 */
export const POST = withApiAuth(async (req, ctx) => {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const { imageBase64, mimeType } = body as {
    imageBase64?: unknown
    mimeType?: unknown
  }

  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return apiError('VALIDATION_ERROR', 'imageBase64 is required and must be a non-empty string', 400)
  }
  if (typeof mimeType !== 'string' || !UPLOAD_ALLOWED_MIME_TYPES.includes(mimeType as UploadMimeType)) {
    return apiError(
      'VALIDATION_ERROR',
      `mimeType must be one of: ${UPLOAD_ALLOWED_MIME_TYPES.join(', ')}`,
      400,
    )
  }

  // Pre-decode size cap — reject before allocating a large Buffer
  if (imageBase64.length > UPLOAD_BASE64_MAX_LENGTH) {
    return apiError('VALIDATION_ERROR', 'Image payload too large (max ~5MB binary)', 413)
  }

  let buffer: Buffer
  try {
    buffer = Buffer.from(imageBase64, 'base64')
  } catch {
    return apiError('VALIDATION_ERROR', 'imageBase64 is not valid base64', 400)
  }

  const validation = validateImageBuffer(buffer, mimeType)
  if (isValidationError(validation)) {
    const status = validation.code === 'OVERSIZED' || validation.code === 'TOO_LARGE_PIXELS' ? 413 : 400
    return apiError('VALIDATION_ERROR', validation.message, status)
  }

  // Daily quota — atomic increment, throttles abuse
  const quota = await incrementUploadCount(ctx.keyId)
  if (!quota.allowed) {
    return apiError(
      'RATE_LIMITED',
      `Daily upload quota of ${quota.limit} exceeded. Resets at ${new Date(quota.resetAt).toISOString()}.`,
      429,
      {
        'Retry-After': String(quota.retryAfter),
        'X-Upload-Quota-Limit': String(quota.limit),
        'X-Upload-Quota-Used': String(quota.used),
      },
    )
  }

  try {
    const result = await uploadImage({
      buffer,
      mimeType: validation.mimeType,
      width: validation.width,
      height: validation.height,
      userId: ctx.userId,
      supabase: ctx.supabase,
    })

    const response = apiSuccess({ success: true, ...result }, 200)
    response.headers.set('X-Upload-Quota-Limit', String(quota.limit))
    response.headers.set('X-Upload-Quota-Used', String(quota.used))
    return response
  } catch {
    return apiError('INTERNAL_ERROR', 'Image upload failed', 500)
  }
})

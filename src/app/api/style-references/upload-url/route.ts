// Phase 74 Plan 03 (REF-02): signed-URL upload route for the slide-references
// bucket. Mirrors src/app/api/v1/me/brand-kit/logo-upload-url/route.ts shape
// with three deliberate divergences:
//
//   1. Bucket: SLIDE_REFERENCES_BUCKET (PRIVATE — no publicUrl in response;
//      Phase 75 mints signed READ URLs at extraction time via createSignedUrl).
//   2. Allowed MIME: ALLOWED_REFERENCE_MIME — png/jpeg/webp/heic only (NO
//      svg+xml; vision LLM doesn't need vector reference art for v2.13).
//   3. Server-side size validation (REF-05, ≤ 20 MB pre-preprocessing) — accept
//      `size_bytes` in request body and reject if > MAX_REFERENCE_SIZE_BYTES.
//
// Validation logic lives in @/lib/storage/upload-reference-validation so the
// React component can run the SAME checks fail-fast before round-tripping the
// network. Defense-in-depth: client validates for UX, server re-validates for
// trust. Drift between the two is a class of bug we don't want to ship.

import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'
import { SLIDE_REFERENCES_BUCKET } from '@/lib/types/projects-storage-constants'
import { validateReferenceUpload } from '@/lib/storage/upload-reference-validation'

export const POST = withApiAuth(async (req, ctx) => {
  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text.length > 0) body = JSON.parse(text)
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const validation = validateReferenceUpload({
    filename: body.filename,
    contentType: body.contentType,
    size_bytes: body.size_bytes,
  })
  if (!validation.ok) {
    return apiError('VALIDATION_ERROR', validation.message, 400)
  }

  const path = `${ctx.userId}/${crypto.randomUUID()}-${validation.safeFilename}`

  const { data, error } = await ctx.supabase.storage
    .from(SLIDE_REFERENCES_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) {
    return apiError(
      'INTERNAL_ERROR',
      error?.message ?? 'Failed to create signed upload URL',
      500,
    )
  }

  // No publicUrl in the response — bucket is private. Phase 75 mints a
  // short-lived signed READ URL at extraction time. Returning a publicUrl here
  // would be a security regression (public exposure of private references).
  return apiSuccess({
    data: {
      uploadUrl: data.signedUrl,
      token: data.token,
      method: 'PUT' as const,
      headers: { 'Content-Type': String(body.contentType) },
      path,
    },
  })
})

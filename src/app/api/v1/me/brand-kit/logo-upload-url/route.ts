import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const BUCKET = 'brand-kit-logos'

export const POST = withApiAuth(async (req, ctx) => {
  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text.length > 0) body = JSON.parse(text)
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const filename = typeof body.filename === 'string' ? body.filename : 'logo.png'
  const contentType = typeof body.contentType === 'string' ? body.contentType : 'image/png'

  if (!ALLOWED_MIME.has(contentType)) {
    return apiError(
      'VALIDATION_ERROR',
      `contentType must be one of: ${Array.from(ALLOWED_MIME).join(', ')}`,
      400,
    )
  }

  // Strip path traversal characters from filename
  const safe = filename.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80)
  const path = `${ctx.userId}/${crypto.randomUUID()}-${safe}`

  const { data, error } = await ctx.supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) {
    return apiError('INTERNAL_ERROR', error?.message ?? 'Failed to create signed upload URL', 500)
  }

  const { data: pub } = ctx.supabase.storage.from(BUCKET).getPublicUrl(path)

  return apiSuccess({
    data: {
      uploadUrl: data.signedUrl,
      token: data.token,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      publicUrl: pub.publicUrl,
      path,
    },
  })
})

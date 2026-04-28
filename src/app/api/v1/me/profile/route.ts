import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'

const ALLOWED_FIELDS = [
  'display_name',
  'bio',
  'avatar_url',
  'website_url',
  'social_links',
] as const

const SOCIAL_KEYS = ['tiktok', 'instagram', 'x', 'youtube'] as const

export const GET = withApiAuth(async (_req, ctx) => {
  const { data: profile } = await ctx.supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, website_url, social_links, created_at')
    .eq('id', ctx.userId)
    .maybeSingle()
  return apiSuccess({ data: profile ?? null })
})

export const PATCH = withApiAuth(async (req, ctx) => {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }

  const update: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field]
  }
  if (Object.keys(update).length === 0) {
    return apiError(
      'VALIDATION_ERROR',
      `At least one field must be provided: ${ALLOWED_FIELDS.join(', ')}`,
      400,
    )
  }

  if (typeof update.bio === 'string' && update.bio.length > 280) {
    return apiError('VALIDATION_ERROR', 'bio must be 280 characters or fewer', 400)
  }
  if (typeof update.website_url === 'string' && update.website_url.length > 0) {
    try {
      const u = new URL(update.website_url)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return apiError('VALIDATION_ERROR', 'website_url must use http:// or https://', 400)
      }
    } catch {
      return apiError('VALIDATION_ERROR', 'website_url must be a valid URL', 400)
    }
  }
  if (update.social_links !== undefined) {
    if (typeof update.social_links !== 'object' || update.social_links === null) {
      return apiError('VALIDATION_ERROR', 'social_links must be an object', 400)
    }
    const cleaned: Record<string, string> = {}
    const raw = update.social_links as Record<string, unknown>
    for (const k of SOCIAL_KEYS) {
      const v = raw[k]
      if (typeof v === 'string' && v.trim().length > 0) {
        cleaned[k] = v.trim().replace(/^@+/, '').slice(0, 64)
      }
    }
    update.social_links = cleaned
  }

  const { data: updated, error } = await ctx.supabase
    .from('profiles')
    .update(update)
    .eq('id', ctx.userId)
    .select('id, username, display_name, bio, avatar_url, website_url, social_links, created_at')
    .single()
  if (error) return apiError('INTERNAL_ERROR', error.message, 500)

  return apiSuccess({ data: updated })
})

import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'

function extractSlug(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/explore/{slug} -> ['', 'api', 'v1', 'explore', '{slug}']
  const slug = segments[4]
  return slug && slug.length > 0 ? slug : null
}

export const GET = withApiAuth(async (req, ctx) => {
  const slug = extractSlug(req)
  if (!slug) return apiError('NOT_FOUND', 'Carousel not found', 404)

  const { data: row } = await ctx.supabase
    .from('published_carousels')
    .select(
      'id, slug, title, description, hero_image_url, slide_data, tags, owner_id, bookmark_count, remix_count, view_count, popularity_score, published_at',
    )
    .eq('slug', slug)
    .is('unpublished_at', null)
    .eq('is_hidden', false)
    .maybeSingle()

  if (!row) return apiError('NOT_FOUND', 'Carousel not found', 404)

  const { data: creator } = await ctx.supabase
    .from('profiles')
    .select('username, display_name, avatar_url, bio')
    .eq('id', row.owner_id as string)
    .maybeSingle()

  return apiSuccess({ data: { ...row, creator } })
})

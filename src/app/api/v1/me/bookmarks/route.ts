import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'

const PAGE_SIZE = 24

export const GET = withApiAuth(async (req, ctx) => {
  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor') ?? null

  let query = ctx.supabase
    .from('bookmarks')
    .select(
      'created_at, published_carousel_id, published_carousels!inner(id, slug, title, hero_image_url, tags, bookmark_count, remix_count, owner_id, published_at)',
    )
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)

  if (cursor) {
    try {
      const ts = Buffer.from(cursor, 'base64').toString('utf-8')
      query = query.lt('created_at', ts)
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid cursor', 400)
    }
  }

  const { data, error } = await query
  if (error) return apiError('INTERNAL_ERROR', error.message, 500)
  const rows = (data as unknown[]) ?? []
  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  let next_cursor: string | null = null
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1] as { created_at: string }
    next_cursor = Buffer.from(last.created_at).toString('base64')
  }

  return apiSuccess({ data: { items: page, next_cursor } })
})

export const POST = withApiAuth(async (req, ctx) => {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body', 400)
  }
  if (typeof body.publishedId !== 'string') {
    return apiError('VALIDATION_ERROR', 'publishedId is required', 400)
  }

  // Verify the carousel exists and is visible
  const { data: pub } = await ctx.supabase
    .from('published_carousels')
    .select('id')
    .eq('id', body.publishedId)
    .is('unpublished_at', null)
    .eq('is_hidden', false)
    .maybeSingle()
  if (!pub) return apiError('NOT_FOUND', 'Carousel not found', 404)

  // Insert is idempotent thanks to (user_id, published_carousel_id) primary key
  const { error } = await ctx.supabase
    .from('bookmarks')
    .insert({ user_id: ctx.userId, published_carousel_id: body.publishedId })
  if (error && error.code !== '23505') {
    return apiError('INTERNAL_ERROR', error.message, 500)
  }
  // 23505 = unique violation = already bookmarked; treat as success.

  return apiSuccess({ data: { bookmarked: true, publishedId: body.publishedId } }, 201)
})

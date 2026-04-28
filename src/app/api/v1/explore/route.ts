import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'

const PAGE_SIZE = 24
const ALLOWED_SORTS = ['trending', 'new', 'featured'] as const
type Sort = (typeof ALLOWED_SORTS)[number]

export const GET = withApiAuth(async (req, ctx) => {
  const url = new URL(req.url)
  const sort = (url.searchParams.get('sort') ?? 'trending') as Sort
  if (!ALLOWED_SORTS.includes(sort)) {
    return apiError('VALIDATION_ERROR', `sort must be one of: ${ALLOWED_SORTS.join(', ')}`, 400)
  }
  const tag = url.searchParams.get('tag')?.trim().toLowerCase() || null
  const q = url.searchParams.get('q')?.trim() || null
  const cursor = url.searchParams.get('cursor') ?? null

  let query = ctx.supabase
    .from('published_carousels')
    .select(
      'id, slug, title, description, hero_image_url, tags, bookmark_count, remix_count, view_count, popularity_score, published_at, owner_id',
    )
    .is('unpublished_at', null)
    .eq('is_hidden', false)
    .limit(PAGE_SIZE + 1)

  if (q) {
    query = query.textSearch('search_vector', q, { type: 'websearch', config: 'simple' })
    query = query.order('published_at', { ascending: false })
  } else if (sort === 'trending') {
    query = query
      .order('popularity_score', { ascending: false })
      .order('published_at', { ascending: false })
  } else if (sort === 'new') {
    query = query.order('published_at', { ascending: false })
  } else {
    query = query.eq('is_featured', true).order('published_at', { ascending: false })
  }

  if (tag) query = query.contains('tags', [tag])

  // Cursor: opaque base64 of `${published_at}|${id}` for tie-breaking. New/trending share the same timestamp scheme.
  if (cursor) {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8')
      const [ts, id] = decoded.split('|')
      if (ts && id) {
        query = query.lt('published_at', ts).neq('id', id)
      }
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid cursor', 400)
    }
  }

  const { data: rows, error } = await query
  if (error) return apiError('INTERNAL_ERROR', error.message, 500)
  const items = (rows as Record<string, unknown>[] | null) ?? []
  const hasMore = items.length > PAGE_SIZE
  const page = hasMore ? items.slice(0, PAGE_SIZE) : items

  let next_cursor: string | null = null
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1]
    next_cursor = Buffer.from(`${last.published_at}|${last.id}`).toString('base64')
  }

  return apiSuccess({
    data: { items: page, next_cursor, sort, tag, q },
  })
})

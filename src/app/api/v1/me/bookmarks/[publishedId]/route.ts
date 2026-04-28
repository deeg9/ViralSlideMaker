import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'

function extractPublishedId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/me/bookmarks/{publishedId} -> ['', 'api', 'v1', 'me', 'bookmarks', '{publishedId}']
  const id = segments[5]
  return id && id.length > 0 ? id : null
}

export const DELETE = withApiAuth(async (req, ctx) => {
  const publishedId = extractPublishedId(req)
  if (!publishedId) return apiError('NOT_FOUND', 'Bookmark not found', 404)

  const { error } = await ctx.supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('published_carousel_id', publishedId)
  if (error) return apiError('INTERNAL_ERROR', error.message, 500)

  return apiSuccess({ data: { deleted: true, publishedId } })
})

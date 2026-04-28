import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiSuccess } from '@/lib/api/response'
import { apiError } from '@/lib/api/errors'

function extractSlug(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/explore/{slug}/fork -> ['', 'api', 'v1', 'explore', '{slug}', 'fork']
  const slug = segments[4]
  return slug && slug.length > 0 ? slug : null
}

export const POST = withApiAuth(async (req, ctx) => {
  const slug = extractSlug(req)
  if (!slug) return apiError('NOT_FOUND', 'Carousel not found', 404)

  const { data: published } = await ctx.supabase
    .from('published_carousels')
    .select('id, title, description, slide_data, remix_count')
    .eq('slug', slug)
    .is('unpublished_at', null)
    .eq('is_hidden', false)
    .maybeSingle()

  if (!published) return apiError('NOT_FOUND', 'Carousel not found', 404)

  // Mirrors fork_published_carousel RPC behavior: deep-copy slide_data,
  // create a new private project owned by the caller, default to highlight-bar
  // template (forker's brand kit re-resolves at render time).
  const { data: newProject, error: insertErr } = await ctx.supabase
    .from('projects')
    .insert({
      user_id: ctx.userId,
      title: `Remix of ${published.title as string}`,
      description: (published.description as string | null) ?? null,
      slide_data: published.slide_data,
      template_id: 'highlight-bar',
      topic: null,
      generation_status: 'complete',
    })
    .select('id')
    .single()

  if (insertErr || !newProject) {
    return apiError('INTERNAL_ERROR', insertErr?.message ?? 'Fork failed', 500)
  }

  // Bump remix_count on the source row (same transaction not possible without RPC,
  // so this is best-effort. publish_carousels.remix_count is also maintained by a
  // direct trigger when the fork RPC fires, so we replicate that increment here.)
  await ctx.supabase
    .from('published_carousels')
    .update({ remix_count: (published.remix_count as number) + 1 })
    .eq('id', published.id as string)

  return apiSuccess({ data: { projectId: newProject.id as string } }, 201)
})

import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/render/templates/index'
import { buildSlideHtml } from '@/lib/render/render-slide'
import { mergeWithBrandKit } from '@/lib/brand-kit/get-effective-template'
import { rateLimit } from '@/lib/rate-limit'
import type { Project } from '@/lib/types/project'
import type { BrandKit } from '@/lib/types/brand-kit'
import nodeHtmlToImage from 'node-html-to-image'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const slideIndex = searchParams.get('slide')
  const download = searchParams.has('download')

  if (!projectId || slideIndex === null) {
    return new Response(
      JSON.stringify({ error: 'Missing required query params: projectId, slide' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const index = parseInt(slideIndex, 10)
  if (isNaN(index) || index < 0) {
    return new Response(
      JSON.stringify({ error: 'Invalid slide index' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Not authenticated' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Rate limit: 30 renders per minute per user
  const { ok } = rateLimit(`render:${user.id}`, 30)
  if (!ok) {
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    )
  }
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (!project) {
    return new Response(
      JSON.stringify({ error: 'Project not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const p = project as Project
  const slide = p.slide_data?.[index]

  if (!slide) {
    return new Response(
      JSON.stringify({ error: `Slide at index ${index} not found` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const template = getTemplate(p.template_id ?? 'bold-minimal')

  // Fetch the brand kit for the project owner and apply overrides
  const { data: brandKit } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', p.user_id)
    .single()

  const effectiveTemplate = mergeWithBrandKit(template, (brandKit as BrandKit) ?? null)
  const html = buildSlideHtml(slide, effectiveTemplate)

  const imageBuffer = await nodeHtmlToImage({
    html,
    type: 'png',
    puppeteerArgs: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  }) as Buffer

  const headers: Record<string, string> = {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=3600',
  }

  if (download) {
    const slideNum = String(index + 1).padStart(2, '0')
    headers['Content-Disposition'] = `attachment; filename="slide-${slideNum}.png"`
  }

  return new Response(new Uint8Array(imageBuffer), { status: 200, headers })
}

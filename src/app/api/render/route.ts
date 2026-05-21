import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { resolveTemplate, getDbTemplatesMap } from '@/lib/render/templates/registry'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import { rateLimitBucket } from '@/lib/rate-limit'
import { getUserTier } from '@/lib/credits/check-credits'
import type { Project } from '@/lib/types/project'

export const maxDuration = 60

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

  // Rate limit: 30 renders per minute (allows burst for ZIP download of all slides)
  const { ok } = rateLimitBucket(`render:${user.id}`, 30)
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

  // Phase 89 (BKSHELVE): brand-kit removed. A legacy template_id === 'brand-kit'
  // resolves to news-oracle via getTemplate's defensive fallback.
  const template = await resolveTemplate(p.template_id ?? 'highlight-bar')

  // Phase 88 (WIRE-04): pre-fetch DB templates so a per-slide DB
  // template_id_override resolves inside buildSlideElement. Never throws.
  const dbTemplates = await getDbTemplatesMap()
  // Forced free-tier watermark: read project owner's tier (server is source of truth)
  const ownerTier = await getUserTier(p.user_id)
  const origin = new URL(request.url).origin
  // Phase 45: thread render context (slideIndex/totalSlides/topic) so overlays
  // resolve through the shared resolveOverlayContent — same source as React preview.
  const totalSlides = (p.slide_data ?? []).length
  const ctx = { slideIndex: index, totalSlides, topic: p.topic }
  // quick-260515-epn: buildSlideElement re-resolves slide.template_id_override
  // internally via resolvePerSlideTemplate; `template` is the project-level
  // fallback the helper returns when no per-slide override is set
  // (TPLREND-05 byte-identity reference).
  const element = buildSlideElement(slide, template, ownerTier, origin, ctx, dbTemplates)
  const fonts = await loadFontBuffersForSlide(slide, template)

  const imageResponse = new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts,
  })

  if (download) {
    const buffer = await imageResponse.arrayBuffer()
    const slideNum = String(index + 1).padStart(2, '0')
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="slide-${slideNum}.png"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  return imageResponse
}

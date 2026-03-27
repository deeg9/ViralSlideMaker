import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/render/templates/index'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { mergeWithBrandKit } from '@/lib/brand-kit/get-effective-template'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import { rateLimitBucket } from '@/lib/rate-limit'
import type { Project } from '@/lib/types/project'
import type { BrandKit } from '@/lib/types/brand-kit'

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

  const template = getTemplate(p.template_id ?? 'bold-minimal')

  // Fetch the brand kit for the project owner and apply overrides
  const { data: brandKit } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', p.user_id)
    .single()

  const effectiveTemplate = mergeWithBrandKit(template, (brandKit as BrandKit) ?? null)
  const element = buildSlideElement(slide, effectiveTemplate)
  const fonts = await loadFontBuffersForSlide(slide, effectiveTemplate)

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

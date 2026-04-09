import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import JSZip from 'jszip'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiError } from '@/lib/api/errors'
import { getProject } from '@/lib/services/projects'
import { getTemplate } from '@/lib/render/templates/index'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { mergeWithBrandKit } from '@/lib/brand-kit/get-effective-template'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import type { Slide } from '@/lib/types/slide'
import type { BrandKit } from '@/lib/types/brand-kit'

export const maxDuration = 60

function extractProjectId(req: NextRequest): string | null {
  const segments = new URL(req.url).pathname.split('/')
  // /api/v1/projects/{id}/download -> segments = ['', 'api', 'v1', 'projects', '{id}', 'download']
  const id = segments[4]
  return id && id.length > 0 ? id : null
}

/**
 * Sanitize project title for use in Content-Disposition filename.
 * Strips quotes and special characters to mitigate header injection (T-25-11).
 */
function sanitizeFilename(title: string): string {
  return title.replace(/["\\/:*?<>|]/g, '').trim() || 'carousel'
}

export const GET = withApiAuth(async (req, ctx) => {
  const id = extractProjectId(req)
  if (!id) {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  let project
  try {
    project = await getProject(ctx.supabase, ctx.userId, id)
  } catch {
    return apiError('NOT_FOUND', 'Project not found', 404)
  }

  const slides = project.slide_data as Slide[] | null
  if (!slides || slides.length === 0) {
    return apiError('NOT_FOUND', 'Project has no slides', 404)
  }

  const template = getTemplate(project.template_id ?? 'bold-minimal')

  // Fetch brand kit for the project owner
  const { data: brandKit } = await ctx.supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', ctx.userId)
    .single()

  const effectiveTemplate = mergeWithBrandKit(template, (brandKit as BrandKit) ?? null)

  // Render each slide sequentially to avoid memory pressure
  const zip = new JSZip()
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const element = buildSlideElement(slide, effectiveTemplate)
    const fonts = await loadFontBuffersForSlide(slide, effectiveTemplate)
    const imgRes = new ImageResponse(element, {
      width: 1080,
      height: 1920,
      fonts,
    })
    const buffer = await imgRes.arrayBuffer()
    zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, Buffer.from(buffer))
  }

  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })

  const filename = sanitizeFilename(project.title || 'carousel')

  // Return as NextResponse to satisfy withApiAuth's ApiHandler type
  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}.zip"`,
    },
  })
})

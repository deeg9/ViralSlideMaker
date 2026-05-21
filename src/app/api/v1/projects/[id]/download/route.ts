import { NextRequest, NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import JSZip from 'jszip'
import { withApiAuth } from '@/lib/api/with-api-auth'
import { apiError } from '@/lib/api/errors'
import { getProject } from '@/lib/services/projects'
import { resolveTemplate, getDbTemplatesMap } from '@/lib/render/templates/registry'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import { getUserTier } from '@/lib/credits/check-credits'
import type { Slide } from '@/lib/types/slide'

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

  // Phase 89 (BKSHELVE): brand-kit removed. A legacy template_id === 'brand-kit'
  // resolves to news-oracle via getTemplate's defensive fallback.
  const template = await resolveTemplate(project.template_id ?? 'highlight-bar')

  // Phase 88 (WIRE-04): pre-fetch DB templates ONCE for the whole ZIP so
  // every slide's per-slide DB template_id_override resolves. Never throws.
  const dbTemplates = await getDbTemplatesMap()

  // Forced free-tier watermark: ctx.userId is the owner (getProject enforces ownership)
  const ownerTier = await getUserTier(ctx.userId)
  const origin = new URL(req.url).origin

  // Render each slide sequentially to avoid memory pressure
  const zip = new JSZip()
  // Phase 45: per-slide render ctx (slideIndex/totalSlides/topic) flows into
  // overlay resolution — same shape used by /api/render single-slide endpoint.
  const totalSlides = slides.length
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const renderCtx = { slideIndex: i, totalSlides, topic: project.topic }
    // quick-260515-epn: buildSlideElement re-resolves slide.template_id_override
    // internally via resolvePerSlideTemplate; `template` is the project-level
    // fallback (the helper short-circuits to the same reference when no
    // per-slide override is set, preserving TPLREND-05 byte-identity).
    const element = buildSlideElement(slide, template, ownerTier, origin, renderCtx, dbTemplates)
    const fonts = await loadFontBuffersForSlide(slide, template)
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

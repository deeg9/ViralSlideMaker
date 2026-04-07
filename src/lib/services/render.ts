import { ImageResponse } from 'next/og'
import JSZip from 'jszip'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import { getTemplate } from '@/lib/render/templates'
import { mergeWithBrandKit } from '@/lib/brand-kit/get-effective-template'
import { ApiError } from '@/lib/api/errors'
import type { BrandKit } from '@/lib/types/brand-kit'
import type { Slide } from '@/lib/types/slide'

interface ProjectData {
  id: string
  user_id: string
  title: string | null
  slide_data: Slide[]
  template_id: string | null
}

async function fetchProject(userId: string, projectId: string): Promise<ProjectData> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('projects')
    .select('id, user_id, title, slide_data, template_id')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to fetch project')
  }
  if (!data) {
    throw new ApiError('NOT_FOUND', 'Project not found')
  }

  return {
    ...data,
    slide_data: (data.slide_data ?? []) as Slide[],
  } as ProjectData
}

export async function getBrandKitForUser(userId: string): Promise<BrandKit | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  return (data as BrandKit) ?? null
}

export async function renderSlide(
  userId: string,
  projectId: string,
  slideIndex: number,
  brandKit?: BrandKit | null
): Promise<ArrayBuffer> {
  const project = await fetchProject(userId, projectId)
  const slide = project.slide_data[slideIndex]

  if (!slide) {
    throw new ApiError('NOT_FOUND', `Slide at index ${slideIndex} not found`)
  }

  const template = getTemplate(project.template_id ?? 'bold-minimal')
  const effectiveTemplate = mergeWithBrandKit(template, brandKit ?? null)
  const element = buildSlideElement(slide, effectiveTemplate)
  const fonts = await loadFontBuffersForSlide(slide, effectiveTemplate)

  const imageResponse = new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts,
  })

  return imageResponse.arrayBuffer()
}

async function renderSlideFromData(
  slide: Slide,
  templateId: string | null,
  brandKit: BrandKit | null
): Promise<ArrayBuffer> {
  const template = getTemplate(templateId ?? 'bold-minimal')
  const effectiveTemplate = mergeWithBrandKit(template, brandKit)
  const element = buildSlideElement(slide, effectiveTemplate)
  const fonts = await loadFontBuffersForSlide(slide, effectiveTemplate)

  const imageResponse = new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts,
  })

  return imageResponse.arrayBuffer()
}

export async function renderAllSlidesToZip(
  userId: string,
  projectId: string,
  brandKit?: BrandKit | null
): Promise<ArrayBuffer> {
  const project = await fetchProject(userId, projectId)
  const zip = new JSZip()

  // Render sequentially to avoid memory pressure on serverless
  for (let i = 0; i < project.slide_data.length; i++) {
    const pngBuffer = await renderSlideFromData(
      project.slide_data[i],
      project.template_id,
      brandKit ?? null
    )
    const filename = `slide-${String(i + 1).padStart(2, '0')}.png`
    zip.file(filename, pngBuffer)
  }

  return zip.generateAsync({ type: 'arraybuffer' })
}

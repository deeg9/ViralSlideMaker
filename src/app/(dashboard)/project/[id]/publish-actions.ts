'use server'

import { ImageResponse } from 'next/og'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTemplate } from '@/lib/render/templates/index'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import {
  mergeWithBrandKit,
  synthesizeBrandKitTemplate,
  BRAND_KIT_TEMPLATE_ID,
} from '@/lib/brand-kit/get-effective-template'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import { getUserTier } from '@/lib/credits/check-credits'
import type { Project } from '@/lib/types/project'
import type { BrandKit } from '@/lib/types/brand-kit'

export type PublishResult =
  | { success: true; slug: string; publishedId: string }
  | { success: false; error: string }

const TAG_REGEX = /^[a-z0-9][a-z0-9_-]*[a-z0-9]?$/

function normalizeTag(raw: string): string | null {
  const t = raw.trim().toLowerCase()
  if (!t || t.length > 24 || !TAG_REGEX.test(t)) return null
  return t
}

const BANNED_TAG_PATTERNS = [/n[i1]gg/i, /f[a4]g/i, /tr[a4]nn/i, /cunt/i, /retard/i]

function isOffensive(tag: string): boolean {
  return BANNED_TAG_PATTERNS.some((re) => re.test(tag))
}

async function renderHero(
  project: Project,
  brandKit: BrandKit | null,
  origin: string,
): Promise<Buffer> {
  const slide = project.slide_data?.[0]
  if (!slide) throw new Error('Project has no slides to render')

  const template =
    project.template_id === BRAND_KIT_TEMPLATE_ID && brandKit
      ? synthesizeBrandKitTemplate(brandKit)
      : getTemplate(project.template_id ?? 'bold-minimal')

  const effectiveTemplate = mergeWithBrandKit(template, brandKit)
  const ownerTier = await getUserTier(project.user_id)
  const element = buildSlideElement(slide, effectiveTemplate, brandKit, ownerTier, origin)
  const fonts = await loadFontBuffersForSlide(slide, effectiveTemplate)

  const imageResponse = new ImageResponse(element, {
    width: 1080,
    height: 1920,
    fonts,
  })
  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  return buffer
}

export async function publishProjectToExplore(
  projectId: string,
  formData: FormData,
): Promise<PublishResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const title = ((formData.get('title') as string) ?? '').trim()
  const description = ((formData.get('description') as string) ?? '').trim() || null
  const tagsRaw = ((formData.get('tags') as string) ?? '').trim()

  if (!title) return { success: false, error: 'Title is required' }
  if (title.length > 120) return { success: false, error: 'Title must be 120 characters or fewer' }
  if (description && description.length > 500) {
    return { success: false, error: 'Description must be 500 characters or fewer' }
  }

  const rawTags = tagsRaw
    .split(/[,\s]+/)
    .map((t) => t.replace(/^#+/, ''))
    .filter(Boolean)

  const tags: string[] = []
  for (const raw of rawTags) {
    const norm = normalizeTag(raw)
    if (!norm) continue
    if (isOffensive(norm)) {
      return { success: false, error: `Tag "${norm}" is not allowed` }
    }
    if (!tags.includes(norm)) tags.push(norm)
    if (tags.length >= 5) break
  }

  // Validate ownership + load project
  const { data: projectRow } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!projectRow) return { success: false, error: 'Project not found' }
  const project = projectRow as Project
  if (!project.slide_data || project.slide_data.length === 0) {
    return { success: false, error: 'Cannot publish an empty carousel' }
  }

  // Brand kit for hero render
  const { data: brandKitRow } = await supabase
    .from('brand_kits')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  const brandKit = (brandKitRow as BrandKit) ?? null

  // Render hero PNG (slide 1)
  const proto =
    process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  let heroBuffer: Buffer
  try {
    heroBuffer = await renderHero(project, brandKit, proto)
  } catch (err) {
    return { success: false, error: `Hero render failed: ${(err as Error).message}` }
  }

  // Upload hero to public bucket BEFORE inserting the published row, so we have a URL
  const heroFilename = `${user.id}/${crypto.randomUUID()}.png`
  const { error: uploadErr } = await supabase.storage
    .from('hero-thumbnails')
    .upload(heroFilename, heroBuffer, { contentType: 'image/png', upsert: false })
  if (uploadErr) {
    return { success: false, error: `Hero upload failed: ${uploadErr.message}` }
  }
  const { data: pub } = supabase.storage.from('hero-thumbnails').getPublicUrl(heroFilename)
  const heroUrl = pub.publicUrl

  // Call publish_carousel RPC
  const { data: published, error: rpcErr } = await supabase.rpc('publish_carousel', {
    p_project_id: projectId,
    p_title: title,
    p_description: description,
    p_tags: tags,
    p_hero_image_url: heroUrl,
  })

  if (rpcErr) {
    // Best-effort cleanup of orphaned hero
    await supabase.storage.from('hero-thumbnails').remove([heroFilename])
    return { success: false, error: rpcErr.message }
  }

  const row = (published as Array<{ id: string; slug: string }> | { id: string; slug: string } | null)
  const result = Array.isArray(row) ? row[0] : row
  if (!result) {
    return { success: false, error: 'Publish RPC returned no row' }
  }

  revalidatePath(`/project/${projectId}`)
  revalidatePath('/explore')
  revalidatePath(`/explore/${result.slug}`)

  return { success: true, slug: result.slug, publishedId: result.id }
}

export async function unpublishCarousel(
  publishedId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { error } = await supabase.rpc('unpublish_carousel', { p_published_id: publishedId })
  if (error) return { success: false, error: error.message }
  revalidatePath('/explore')
  return { success: true }
}

// Pulls the storage path out of a Supabase public URL.
// Public URLs look like: <project>.supabase.co/storage/v1/object/public/<bucket>/<path>
// Returns null if the URL doesn't match the expected bucket prefix.
function extractStoragePath(publicUrl: string | null, bucket: string): string | null {
  if (!publicUrl) return null
  const marker = `/object/public/${bucket}/`
  const idx = publicUrl.indexOf(marker)
  if (idx === -1) return null
  const path = publicUrl.slice(idx + marker.length).split('?')[0]
  return path || null
}

export async function deletePublishedCarousel(
  publishedId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: row, error: readErr } = await supabase
    .from('published_carousels')
    .select('hero_image_url, owner_id, slug')
    .eq('id', publishedId)
    .maybeSingle()
  if (readErr) return { success: false, error: readErr.message }
  if (!row) return { success: false, error: 'Published carousel not found' }
  if (row.owner_id !== user.id) {
    return { success: false, error: 'Not authorized to delete this carousel' }
  }

  const heroPath = extractStoragePath(row.hero_image_url as string | null, 'hero-thumbnails')

  // Delete the row first — RLS validates ownership again as defense in depth.
  // If this fails, nothing else changes.
  const { error: deleteErr } = await supabase
    .from('published_carousels')
    .delete()
    .eq('id', publishedId)
  if (deleteErr) return { success: false, error: deleteErr.message }

  // Best-effort storage cleanup. The row is already gone, so a missed file
  // is at worst a small orphan — never a broken reference.
  if (heroPath) {
    const { error: storageErr } = await supabase.storage
      .from('hero-thumbnails')
      .remove([heroPath])
    if (storageErr) {
      console.error(
        `[deletePublishedCarousel] Hero file orphaned for ${publishedId}: ${heroPath} (${storageErr.message})`,
      )
    }
  }

  revalidatePath('/explore')
  revalidatePath(`/explore/${row.slug}`)
  revalidatePath('/bookmarks')
  return { success: true }
}

import { ImageResponse } from 'next/og'
import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
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

const TAG_REGEX = /^[a-z0-9][a-z0-9_-]*[a-z0-9]?$/
const BANNED_TAG_PATTERNS = [/n[i1]gg/i, /f[a4]g/i, /tr[a4]nn/i, /cunt/i, /retard/i]

export function normalizePublishTags(rawTags: unknown): { tags: string[] } | { error: string } {
  let parts: string[]
  if (Array.isArray(rawTags)) {
    parts = rawTags.filter((t): t is string => typeof t === 'string')
  } else if (typeof rawTags === 'string') {
    parts = rawTags.split(/[,\s]+/).map((t) => t.replace(/^#+/, '')).filter(Boolean)
  } else if (rawTags === undefined || rawTags === null) {
    return { tags: [] }
  } else {
    return { error: 'tags must be an array of strings or a comma-separated string' }
  }

  const tags: string[] = []
  for (const raw of parts) {
    const t = raw.trim().toLowerCase()
    if (!t || t.length > 24 || !TAG_REGEX.test(t)) continue
    if (BANNED_TAG_PATTERNS.some((re) => re.test(t))) {
      return { error: `Tag "${t}" is not allowed` }
    }
    if (!tags.includes(t)) tags.push(t)
    if (tags.length >= 5) break
  }
  return { tags }
}

export async function renderHeroBuffer(
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
  return Buffer.from(await imageResponse.arrayBuffer())
}

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

function slugifyTitle(title: string): string {
  let s = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!s) s = 'carousel'
  if (s.length > 60) s = s.slice(0, 60)
  return s
}

function shortNanoid(): string {
  return randomBytes(4).toString('hex').slice(0, 6)
}

export type PublishOptions = {
  title: string
  description?: string | null
  tags?: string[]
}

export type PublishResult =
  | { success: true; publishedId: string; slug: string; heroUrl: string }
  | { success: false; error: string; status: number }

/**
 * Publish a project to Explore using the admin client (API key auth path).
 * Mirrors the logic of `publishProjectToExplore` server action but doesn't
 * rely on `auth.uid()` — it validates ownership explicitly.
 */
export async function publishProjectAdmin(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
  opts: PublishOptions,
): Promise<PublishResult> {
  const title = opts.title.trim()
  if (!title) return { success: false, error: 'Title is required', status: 400 }
  if (title.length > 120) return { success: false, error: 'Title must be 120 characters or fewer', status: 400 }
  const description = opts.description?.toString().trim() || null
  if (description && description.length > 500) {
    return { success: false, error: 'Description must be 500 characters or fewer', status: 400 }
  }

  const { data: projectRow } = await admin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!projectRow) return { success: false, error: 'Project not found', status: 404 }
  const project = projectRow as Project
  if (!project.slide_data || project.slide_data.length === 0) {
    return { success: false, error: 'Cannot publish an empty carousel', status: 400 }
  }

  const { data: brandKitRow } = await admin
    .from('brand_kits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  const brandKit = (brandKitRow as BrandKit) ?? null

  let heroBuffer: Buffer
  try {
    heroBuffer = await renderHeroBuffer(project, brandKit, appOrigin())
  } catch (err) {
    return { success: false, error: `Hero render failed: ${(err as Error).message}`, status: 500 }
  }

  const heroFilename = `${userId}/${crypto.randomUUID()}.png`
  const { error: uploadErr } = await admin.storage
    .from('hero-thumbnails')
    .upload(heroFilename, heroBuffer, { contentType: 'image/png', upsert: false })
  if (uploadErr) return { success: false, error: `Hero upload failed: ${uploadErr.message}`, status: 500 }
  const { data: pub } = admin.storage.from('hero-thumbnails').getPublicUrl(heroFilename)
  const heroUrl = pub.publicUrl

  // Slug retry loop (mirrors publish_carousel RPC behavior)
  const baseSlug = slugifyTitle(title)
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidateSlug = `${baseSlug}-${shortNanoid()}`
    const { data: inserted, error: insertErr } = await admin
      .from('published_carousels')
      .insert({
        owner_id: userId,
        source_project_id: projectId,
        slug: candidateSlug,
        title,
        description,
        hero_image_url: heroUrl,
        slide_data: project.slide_data,
        tags: opts.tags ?? [],
      })
      .select('id, slug')
      .maybeSingle()
    if (!insertErr && inserted) {
      return {
        success: true,
        publishedId: inserted.id as string,
        slug: inserted.slug as string,
        heroUrl,
      }
    }
    if (insertErr && insertErr.code !== '23505') {
      // Not a unique-violation; cleanup hero and bail
      await admin.storage.from('hero-thumbnails').remove([heroFilename])
      return { success: false, error: insertErr.message, status: 500 }
    }
    // unique violation → retry with a new suffix
  }
  await admin.storage.from('hero-thumbnails').remove([heroFilename])
  return { success: false, error: 'slug_collision_retry_exhausted', status: 500 }
}

export type UnpublishResult =
  | { success: true; unpublished_at: string }
  | { success: false; error: string; status: number }

export async function unpublishProjectAdmin(
  admin: SupabaseClient,
  userId: string,
  publishedId: string,
): Promise<UnpublishResult> {
  // Validate ownership; pull row so we can return its updated state
  const { data: row } = await admin
    .from('published_carousels')
    .select('owner_id, unpublished_at')
    .eq('id', publishedId)
    .maybeSingle()
  if (!row) return { success: false, error: 'Published carousel not found', status: 404 }
  if (row.owner_id !== userId) return { success: false, error: 'Not authorized', status: 403 }

  const now = new Date().toISOString()
  const { error: updErr } = await admin
    .from('published_carousels')
    .update({ unpublished_at: now })
    .eq('id', publishedId)
  if (updErr) return { success: false, error: updErr.message, status: 500 }

  return { success: true, unpublished_at: now }
}

/**
 * Find the active (unpublished_at IS NULL) published_carousels row for a project,
 * if one exists. Used by `DELETE /projects/{id}/publish` to convert a project ID
 * into a published_id for unpublishing.
 */
export async function findActivePublishedRow(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<{ id: string } | null> {
  const { data } = await admin
    .from('published_carousels')
    .select('id')
    .eq('source_project_id', projectId)
    .eq('owner_id', userId)
    .is('unpublished_at', null)
    .maybeSingle()
  return data ? { id: data.id as string } : null
}

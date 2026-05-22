'use server'

import * as React from 'react'
import { ImageResponse } from 'next/og'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveTemplate, getDbTemplatesMap } from '@/lib/render/templates/registry'
import { buildSlideElement } from '@/lib/render/render-slide-satori'
import { loadFontBuffersForSlide } from '@/lib/render/load-font'
import { getUserTier } from '@/lib/credits/check-credits'
import { resolveFormat, scaleFontPx } from '@/lib/render/carousel-formats'
import type { Project } from '@/lib/types/project'

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
  origin: string,
): Promise<Buffer> {
  const slide = project.slide_data?.[0]
  if (!slide) throw new Error('Project has no slides to render')

  // Phase 89 (BKSHELVE): brand-kit removed. A legacy template_id === 'brand-kit'
  // resolves to news-oracle via getTemplate's defensive fallback.
  const template = await resolveTemplate(project.template_id ?? 'highlight-bar')

  const ownerTier = await getUserTier(project.user_id)
  // Phase 45: hero render is always slide 0 of a single-slide payload — overlay
  // counter resolves to '1/1' (per CONTEXT.md graceful-fallback path); topic
  // comes from the project for slide-field overlays.
  const ctx = { slideIndex: 0, totalSlides: 1, topic: project.topic }
  // Phase 88 (WIRE-04): per-slide DB override resolution for the publish hero.
  const dbTemplates = await getDbTemplatesMap()
  // Phase 90: hero renders at the project's chosen carousel format.
  const format = resolveFormat(project.output_format)
  const element = buildSlideElement(slide, template, ownerTier, origin, ctx, dbTemplates, format)
  const fonts = await loadFontBuffersForSlide(slide, template)

  const imageResponse = new ImageResponse(element, {
    width: format.w,
    height: format.h,
    fonts,
  })
  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  return buffer
}

/**
 * quick-260514-minimal-hero-fallback: minimal Satori-safe slide renderer used
 * as a fallback when the full `renderHero` chokes on a CSS-subset edge case.
 * Composes a single root flex div with two text children — no overlays,
 * decorations, custom_images, watermarks, or template-specific layers.
 * Always produces a valid PNG so publish never has to fall back to the raw
 * `background_url` (which the user explicitly didn't want).
 */
async function renderMinimalHero(
  project: Project,
): Promise<Buffer> {
  const slide = project.slide_data?.[0]
  if (!slide) throw new Error('Project has no slides to render')

  // Phase 89 (BKSHELVE): brand-kit removed. A legacy template_id === 'brand-kit'
  // resolves to news-oracle via getTemplate's defensive fallback.
  const template = await resolveTemplate(project.template_id ?? 'highlight-bar')

  const hookText = slide.hook_text?.trim() ?? ''
  const bodyText = slide.body_text?.trim() ?? ''

  // Phase 90: minimal hero renders at the project's chosen carousel format;
  // the absolute-pixel font sizes are scaled by the format's height ratio.
  const format = resolveFormat(project.output_format)

  const element = React.createElement(
    'div',
    {
      style: {
        width: format.w,
        height: format.h,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        backgroundColor: template.backgroundColor,
        color: template.textColor,
        fontFamily: template.fontFamily,
      },
    },
    hookText
      ? React.createElement(
          'div',
          {
            key: 'hook',
            style: {
              display: 'flex',
              fontSize: scaleFontPx(120, format),
              fontWeight: 900,
              lineHeight: 1.1,
              textAlign: 'center',
              marginBottom: bodyText ? 40 : 0,
            },
          },
          hookText,
        )
      : null,
    bodyText
      ? React.createElement(
          'div',
          {
            key: 'body',
            style: {
              display: 'flex',
              fontSize: scaleFontPx(48, format),
              fontWeight: 400,
              lineHeight: 1.4,
              textAlign: 'center',
              opacity: 0.9,
            },
          },
          bodyText,
        )
      : null,
  )

  const fonts = await loadFontBuffersForSlide(slide, template)
  const imageResponse = new ImageResponse(element, {
    width: format.w,
    height: format.h,
    fonts,
  })
  return Buffer.from(await imageResponse.arrayBuffer())
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

  // Render hero PNG (slide 1). quick-260514-minimal-hero-fallback: two-layer
  // fallback so publish always succeeds with a RENDERED first-slide thumbnail
  // (never the raw background_url):
  //   1. renderHero — full Satori composition (template, overlays, decorations, etc).
  //   2. renderMinimalHero — bg-color + hook + body only; guaranteed Satori-safe.
  // Both are uploaded to the hero-thumbnails bucket so the published row gets
  // a stable, project-scoped URL — never the project's raw photo bg.
  const proto =
    process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  let heroBuffer: Buffer
  try {
    heroBuffer = await renderHero(project, proto)
  } catch (err) {
    console.warn('[publish] renderHero failed, falling back to renderMinimalHero:', (err as Error).message)
    try {
      heroBuffer = await renderMinimalHero(project)
    } catch (err2) {
      return { success: false, error: `Hero render failed: ${(err2 as Error).message}` }
    }
  }

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
